---
title: "select、poll、epoll：一个线程怎么等多个连接"
description: "一个线程守着几千条连接，不能卡在任何一条上。select、poll、epoll 都请内核帮忙盯着，差别在每一轮要查多少。"
pubDate: 2026-11-02
tags: ["操作系统", "计算机网络", "计算机基础"]
---

写一个聊天服务器。为了简单，只开一个线程，挨个读每条连接：

```c
char buf[4096];
for (;;) {
    for (int i = 0; i < n; i++) {
        ssize_t len = read(conns[i], buf, sizeof buf);
        if (len > 0)
            handle(conns[i], buf, len);
    }
}
```

`conns` 里存的是每条连接的 fd（文件描述符）。Linux 里打开的文件、建立的连接，在程序里都用这样一个小整数来指代，`read()` 拿着它，就知道该从哪条连接读。

问题出在 `read()` 默认会阻塞：连接上没有数据，它就一直不返回。A 连上来以后一句话也不说，线程就停在 `read(A)` 上。这时 B 发来一条消息，没人理；C、D 也一样，全得等 A 先开口。

几千条连接里，总有不说话的。线程不能停在任何一条上。

## 两个笨办法

第一个，一条连接配一个线程。每个线程只管一条连接，`read()` 卡住也只卡它自己。连接少的时候这样最省心，上了几千、上万条就吃不消了：每个线程都要有自己的栈，Linux 上默认预留 8 MB；内核还得在这么多线程之间来回切换，而它们大部分时间什么也没干，只是在等。一台服务器怎么同时撑住一万个连接，1999 年就有人专门写文章讨论过，叫 C10K 问题。

第二个，把 socket 设成非阻塞：

```c
fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);
```

这以后，没数据时 `read()` 不再等，立刻返回 -1，`errno` 是 `EAGAIN`，意思是“现在没有，待会儿再来”。线程就能挨个试过去，谁有数据处理谁。

不会卡住了，可大多数时候都是白试。哪怕所有连接都一声不吭，这个循环也在全速空转，把一个 CPU 核占满。

## 让内核帮忙盯着

数据从网卡进来，是内核先收到，放进对应 socket 的接收缓冲区。哪条连接有数据，内核最清楚。

那就换个分工：线程把关心的连接交给内核，自己睡下；哪条连接来了数据，内核把线程叫醒，告诉它是哪几条。一个线程就这样同时等着很多条连接，这叫 **I/O 多路复用**。

select、poll、epoll 都是干这个的，先后出现，一个比一个省事。它们只负责通知“可以读了”“可以写了”，数据还是程序自己调 `read()`、`write()` 去读写。

## select：每次交一张位图

select 用一张位图记下要监听哪些 fd，类型叫 `fd_set`：第几位是 1，就表示监听几号 fd。读、写、异常各用一张，这里只看读。

```c
fd_set rset;
for (;;) {
    FD_ZERO(&rset);
    for (int i = 0; i < n; i++)
        FD_SET(conns[i], &rset);         // 每一轮都重新填

    select(maxfd + 1, &rset, NULL, NULL, NULL);

    for (int i = 0; i < n; i++)
        if (FD_ISSET(conns[i], &rset))   // 挨个看谁就绪了
            handle(conns[i]);
}
```

第一个参数是最大的 fd 加一，告诉内核查到第几位为止。调用时，这张位图被拷进内核，内核去查每个打了勾的 fd；一个都没就绪，线程就睡下。等到有 fd 就绪，`select()` 把同一张位图改写成结果再返回：只有就绪的那几位还是 1。

```render html title="同一张 fd_set，select() 前后。一共 1024 位，这里只画了前 12 位"
<style>
  .fs { font-size: 13px; line-height: 1.4; font-variant-ligatures: none; }
  .row { display: grid; grid-template-columns: 4.2em repeat(12, minmax(0, 1fr)) 1.6em; gap: 4px; align-items: center; margin-top: 10px; }
  .row:first-child { margin-top: 0; }
  .lbl { color: var(--muted); white-space: nowrap; }
  .num, .more { color: var(--faint); font: 11.5px var(--font-mono); text-align: center; }
  .b { display: grid; place-items: center; height: 28px; border: 1px solid var(--rule-strong); border-radius: 4px; background: var(--bg-raised); color: var(--faint); font: 13px var(--font-mono); }
  .b.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 650; }
  .note { display: block; margin: 4px 0 0 calc(4.2em + 4px); color: var(--muted); font-size: 12.5px; }
</style>
<section class="fs" aria-label="同一张 fd_set：调用前第 3、4、6、9 位是 1，返回后只剩第 6 位"></section>
<script>
const ROWS = [
  ['调用前', [3, 4, 6, 9], '想监听 3、4、6、9 号'],
  ['返回后', [6], '只剩就绪的 6 号，其余都清零了'],
];
const root = document.querySelector('.fs');
const cell = (className, text) => Object.assign(document.createElement('span'), { className, textContent: text });
const row = cells => {
  const div = document.createElement('div');
  div.className = 'row';
  div.append(...cells);
  return div;
};
const bits = Array.from({ length: 12 }, (_, i) => i);
root.append(row([cell('lbl', 'fd'), ...bits.map(i => cell('num', i)), cell('more', '…')]));
for (const [name, on, note] of ROWS) {
  root.append(
    row([cell('lbl', name), ...bits.map(i => cell(on.includes(i) ? 'b on' : 'b', on.includes(i) ? 1 : 0)), cell('more', '…')]),
    cell('note', note),
  );
}
</script>
```

想监听谁的信息被覆盖掉了，所以每一轮开头都得重新填一遍。返回值只说有几个就绪，具体是哪几个，还得挨个 `FD_ISSET` 去找。

还有个硬限制：glibc 里的 `fd_set` 固定 1024 位，只能放编号 0 到 1023 的 fd。这个数写死在头文件里，自己重新定义 `FD_SETSIZE` 也改不了。限制的是**编号**，不是个数。Linux 分配 fd 总是挑最小的空号，进程里同时开着的文件和连接一多，新连接的编号就会超过 1023，哪怕只想监听这一条也放不进去，硬放会越界写坏内存。select 的手册里自己都写着：新程序应该用 poll 或 epoll。

## poll：位图换成数组

poll 改用一个数组，每一项是一个 `struct pollfd`：

```c
struct pollfd {
    int   fd;       // 哪个 fd
    short events;   // 关心什么：POLLIN 可读，POLLOUT 可写
    short revents;  // 发生了什么，由内核填
};
```

关心什么、发生了什么，分成了两个字段。内核只写 `revents`，`events` 不会被覆盖，数组填好一次就能一直用。数组多长由程序定，1024 的限制也没了：

```c
struct pollfd pfds[n];
for (int i = 0; i < n; i++)
    pfds[i] = (struct pollfd){ .fd = conns[i], .events = POLLIN };

for (;;) {
    poll(pfds, n, -1);                   // -1：没有事件就一直等
    for (int i = 0; i < n; i++)
        if (pfds[i].revents & POLLIN)    // 还是挨个看
            handle(pfds[i].fd);
}
```

写起来顺手多了，可每一轮要干的活，一点没少。

## 每一轮都从头查

拆开一次 `select()` 或 `poll()` 调用，内核大致做了这几件事：

1. 把整张位图或整个数组从程序拷进内核。
2. 挨个查每个 fd 有没有数据。没有的，就在它的 socket 上挂一个钩子：有数据了叫醒我。
3. 一个都没有，线程睡下。
4. 某条连接来了数据，它上面的钩子把线程叫醒。
5. 钩子只管叫醒，不说是谁。线程只好再从头查一遍。
6. 把刚才挂的钩子一个个摘掉，结果拷回程序。

回到程序里，还要再挨个看一遍结果。

一万条连接，这一轮只有一条来了数据，前前后后也要把一万个 fd 过好几遍。下一轮，再来一次。连接越多，每一轮越慢，而大多数连接其实什么也没发。

## epoll：登记一次，只拿就绪的

epoll 把“登记”和“等待”拆开了，一共三个调用：

- `epoll_create1()`：在内核里建一个 epoll 实例，返回一个 fd 代表它；
- `epoll_ctl()`：往实例里添加、修改、删除要监听的 fd；
- `epoll_wait()`：等，返回的只有就绪的那几个。

同一个程序，换成 epoll：

```c
int epfd = epoll_create1(0);
for (int i = 0; i < n; i++) {
    struct epoll_event ev = { .events = EPOLLIN, .data.fd = conns[i] };
    epoll_ctl(epfd, EPOLL_CTL_ADD, conns[i], &ev);   // 登记一次
}

struct epoll_event ready[64];
for (;;) {
    int k = epoll_wait(epfd, ready, 64, -1);         // 只拿回就绪的
    for (int i = 0; i < k; i++)
        handle(ready[i].data.fd);
}
```

监听哪些 fd，一直记在内核里（存在一棵红黑树上，增删查都快），登记一次就行，之后每一轮不用再传。

钩子也只挂一次。`epoll_ctl()` 登记时，内核就在这条连接的 socket 上挂好钩子，之后一直挂着，不用每轮挂了又摘。这个钩子也不只是叫醒线程：数据来了，它先把这条连接放进 epoll 实例里的一个**就绪列表**，再叫醒等在 `epoll_wait()` 上的线程。线程醒来不用从头查，就绪列表里有谁，就把谁交给程序。

像老师收作业。select 和 poll 是老师每隔一会儿把全班挨个问一遍“写完没有”；epoll 是谁写完了谁举手，老师只看举手的。

```render html title="同一批连接来了数据：select 和 poll 醒来从头查，epoll 只看就绪列表"
<style>
  .mx { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .keys { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .keys span { margin-right: 4px; color: var(--muted); }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 32px; margin-top: 18px; }
  @media (max-width: 520px) { .panes { grid-template-columns: minmax(0, 1fr); } }
  .title { margin-bottom: 10px; color: var(--text); font-size: 14px; font-weight: 650; }
  .title small { margin-left: 8px; color: var(--muted); font-size: 12px; font-weight: 400; }
  .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 5px; }
  .grid i { aspect-ratio: 1; border: 1.5px solid var(--rule-strong); border-radius: 50%; background: var(--bg-raised); }
  .grid i.seen { border-color: var(--faint); background: var(--bg-sunken); }
  .grid i.data { border-color: var(--accent); }
  .grid i.hit { border-color: var(--accent); background: var(--accent); }
  .box { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-height: 36px; margin-top: 12px; padding: 4px 10px; border: 1px dashed var(--rule-strong); border-radius: 6px; color: var(--muted); }
  .chip { padding: 0 6px; border-radius: 3px; background: var(--accent-soft); color: var(--accent-ink); font: 12px/20px var(--font-mono); }
  .stat { margin-top: 10px; color: var(--muted); }
  .stat b { color: var(--text); font: 600 15px var(--font-mono); }
</style>
<section class="mx" aria-label="同一批连接来了数据：select 和 poll 每轮从头查到尾，epoll 只看就绪列表">
  <div class="keys">
    <span>来数据：</span>
    <button type="button" class="key" data-k="1">1 条</button>
    <button type="button" class="key" data-k="6">6 条</button>
    <button type="button" class="key" data-k="48">全部 48 条</button>
  </div>
  <div class="panes">
    <div>
      <div class="title">select / poll<small>醒来从头查一遍</small></div>
      <div class="grid" role="img" aria-label="48 条连接"></div>
      <div class="box">每轮：48 项拷进内核，查完再拷回来</div>
      <div class="stat" aria-live="polite"></div>
    </div>
    <div>
      <div class="title">epoll<small>只看就绪列表</small></div>
      <div class="grid" role="img" aria-label="同样的 48 条连接"></div>
      <div class="box ready"></div>
      <div class="stat" aria-live="polite"></div>
    </div>
  </div>
</section>
<script>
const N = 48, STEP = 16, TAKE = 360;
const root = document.querySelector('.mx');
const [scanGrid, epGrid] = root.querySelectorAll('.grid');
const [scanStat, epStat] = root.querySelectorAll('.stat');
const list = root.querySelector('.ready');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fill = grid => Array.from({ length: N }, () => grid.appendChild(document.createElement('i')));
const scanCells = fill(scanGrid), epCells = fill(epGrid);
let ready = new Set([21]), start = 0, raf = 0;

// t 是这一轮开始后过了多久；返回 true 表示两边都演示完了
function paint(t) {
  const seen = Math.min(N, Math.floor(Math.max(0, t) / STEP)), taken = t >= TAKE;
  let found = 0;
  scanCells.forEach((c, i) => {
    const has = ready.has(i);
    if (i < seen && has) found++;
    c.className = i < seen ? (has ? 'hit' : 'seen') : has ? 'data' : '';
  });
  epCells.forEach((c, i) => {
    c.className = ready.has(i) ? (taken ? 'hit' : 'data') : '';
  });
  const got = ready.size;
  scanStat.innerHTML = `这一轮查了 <b>${seen}</b> 个，找到 <b>${found}</b> 个`;
  epStat.innerHTML = taken ? `这一轮查了 <b>${got}</b> 个，找到 <b>${got}</b> 个` : `钩子把 <b>${got}</b> 条放进了就绪列表`;
  list.replaceChildren('就绪列表：');
  if (taken) list.append('已被 epoll_wait() 取走');
  else {
    const fds = [...ready].sort((a, b) => a - b).map(i => i + 4);
    for (const fd of fds.slice(0, 4)) list.append(Object.assign(document.createElement('span'), { className: 'chip', textContent: `fd ${fd}` }));
    if (fds.length > 4) list.append(`+${fds.length - 4}`);
  }
  return seen === N && taken;
}

function run(k) {
  const order = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  ready = new Set(order.slice(0, k));
  cancelAnimationFrame(raf);
  if (reduce) return paint(Infinity);
  start = performance.now();
  const loop = now => { if (!paint(now - start)) raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

root.querySelectorAll('.key').forEach(b => b.addEventListener('click', () => run(Number(b.dataset.k))));
paint(Infinity);
</script>
```

只来一条数据时，左边也得把 48 个查完；换成一万条连接，就是一万个。右边来几条就查几条。点“全部”看看：每条连接都有数据时，两边查的一样多。

`epoll_wait()` 一次最多返回 `maxevents` 个（上面是 64），就绪的更多，剩下的留到下一次。`data` 字段登记时填什么，返回时就原样带回来：可以放 fd，也可以放一个指向连接对象的指针，拿到事件就能直接找到这条连接的状态。

常有人说，epoll 快是因为用 mmap 和内核共享了内存，省掉了拷贝。其实没有：就绪事件照样要从内核拷给程序，只是只拷就绪的那几个。

## 放在一起比一比

| | select | poll | epoll |
| --- | --- | --- | --- |
| 怎么告诉内核监听谁 | 每轮传一张位图 | 每轮传整个数组 | 登记一次，变了再改 |
| 内核每轮查多少 | 全部 | 全部 | 只看就绪列表 |
| 程序怎么找就绪的 | 挨个 `FD_ISSET` | 挨个看 `revents` | 直接用返回的事件 |
| fd 的限制 | 编号必须小于 1024 | 没有固定上限 | 没有固定上限 |
| 平台 | POSIX | POSIX | 只有 Linux |

没有固定上限，也还受进程能打开的 fd 数（`ulimit -n`）和内存约束。

epoll 也不是什么时候都赢：

- 连接多、同一时刻只有少数在说话，这是 epoll 最擅长的，比如挂着大量长连接的服务器。
- 每条连接都很忙时，每一轮几乎全都就绪，epoll 也得一个个处理，跟 poll 差不多。
- 只盯几个 fd，用哪个都一样快。epoll 每次增删监听还要多一次 `epoll_ctl()` 系统调用，poll 写起来反而简单。
- 普通的磁盘文件不能交给 epoll，`epoll_ctl()` 会返回 `EPERM`。文件总被当作随时可读，等也没有意义。
- epoll 只有 Linux 有。macOS 和 BSD 上对应的是 kqueue；Windows 上是 IOCP，思路又不太一样。

## LT 和 ET：提醒几次

epoll 的通知有两种方式：

- **LT（水平触发）**：默认就是它。只要 fd 还处在就绪状态，比如接收缓冲区里还有没读完的数据，每次 `epoll_wait()` 都会报告。
- **ET（边缘触发）**：登记时加上 `EPOLLET`。只在有新变化时通知，比如新数据到了；没读完的，不会再提醒。

名字来自电路：水平触发看电平是高是低，边缘触发只看电平跳变的那一下。

比如接收缓冲区来了 100 字节，程序这次只读走 40 字节，还剩 60：

- LT 下，下一次 `epoll_wait()` 还会报告这个 fd，提醒你回来取剩下的 60 字节。
- ET 下，这 60 字节不算新变化，不会再报告。要等对方再发来数据，才会再通知一次。

在内核里，两者只差一步。`epoll_wait()` 把一个 fd 报告给程序以后，LT 会把它放回就绪列表，下一轮再查一次，还有数据就接着报；ET 不放回，只有新数据到了、钩子再响一次，它才回到列表里。

下面停在读走 40 字节之后。分别在 LT 和 ET 下点一次 `epoll_wait()`：

```render html title="缓冲区还剩 60 字节：LT 会接着报，ET 不会"
<style>
  .tr { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .tr { --blue: #95bfdc; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .state { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 12px 16px; align-items: center; margin-top: 16px; }
  .state > span { color: var(--muted); }
  .buf { display: flex; align-items: center; gap: 12px; }
  .blocks { display: grid; flex: 1; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 3px; }
  .blocks i { height: 22px; border-radius: 2px; background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--rule); transition: background-color .25s; }
  .blocks i.on { background: var(--accent); box-shadow: none; }
  .buf output { min-width: 4.6em; color: var(--text); font: 600 14px var(--font-mono); text-align: right; }
  .slot { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; min-height: 26px; }
  .chip { padding: 0 8px; border-radius: 3px; background: var(--accent-soft); color: var(--accent-ink); font: 13px/22px var(--font-mono); }
  .none { color: var(--faint); }
  .slot small { color: var(--muted); font-size: 12px; }
  .thread { color: var(--text); }
  .thread.sleep { color: var(--blue); font-weight: 600; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .log { min-height: calc(5 * 1.75em + 20px); margin: 14px 0 0; padding: 10px 14px; border-radius: 6px; background: var(--bg-sunken); list-style: none; font: 12.5px/1.75 var(--font-mono); }
  .log li { color: var(--muted); }
  .log li:last-child { color: var(--text); }
  .log li.warn { color: var(--accent-ink); font-weight: 600; }
</style>
<section class="tr" aria-label="LT 和 ET 下，没读完的数据会不会再通知">
  <div class="seg" role="group" aria-label="触发方式">
    <button type="button" data-mode="lt">LT 水平触发</button>
    <button type="button" data-mode="et">ET 边缘触发</button>
  </div>
  <div class="state">
    <span>接收缓冲区</span><div class="buf"><div class="blocks"></div><output></output></div>
    <span>就绪列表</span><div class="slot"></div>
    <span>线程</span><div class="thread"></div>
  </div>
  <div class="keys">
    <button type="button" class="key" data-act="send">对方发来 100 字节</button>
    <button type="button" class="key" data-act="read">read 40 字节</button>
    <button type="button" class="key" data-act="drain">读到 EAGAIN</button>
    <button type="button" class="key" data-act="wait">epoll_wait()</button>
    <button type="button" class="key" data-act="reset">重来</button>
  </div>
  <ol class="log" aria-live="polite"></ol>
</section>
<script>
const UNIT = 20, NOTE = { lt: 'LT：报告完放回列表，下一轮再查', et: 'ET：报告完就拿走，新数据来了才放回' };
const root = document.querySelector('.tr');
const blocksEl = root.querySelector('.blocks');
const blocks = Array.from({ length: 15 }, () => blocksEl.appendChild(document.createElement('i')));
const out = root.querySelector('output');
const slot = root.querySelector('.slot');
const thread = root.querySelector('.thread');
const logEl = root.querySelector('.log');
const modes = root.querySelectorAll('.seg button');
const keys = Object.fromEntries([...root.querySelectorAll('.key')].map(b => [b.dataset.act, b]));
const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text });
let mode = 'lt', buf = 0, listed = false, sleeping = false, log = [];

const say = (text, cls = '') => log.push([text, cls]);

function report() {
  say('epoll_wait() 返回：fd 5 可读');
  listed = mode === 'lt';
}

const acts = {
  send() {
    buf += 100;
    listed = true;
    if (!sleeping) return say('对方发来 100 字节，钩子把 fd 5 放进就绪列表');
    say('对方发来 100 字节，钩子把 fd 5 放进就绪列表，叫醒线程');
    sleeping = false;
    report();
  },
  read() {
    if (!buf) return say('read(fd, buf, 40) = -1，EAGAIN');
    const n = Math.min(40, buf);
    buf -= n;
    say(`read(fd, buf, 40) = ${n}`);
  },
  drain() {
    if (buf) say(`read(fd, buf, 4096) = ${buf}`);
    buf = 0;
    say('read(fd, buf, 4096) = -1，EAGAIN：读空了');
  },
  wait() {
    if (listed && buf) return report();
    say(listed ? 'epoll_wait()：fd 5 已经读空，移出就绪列表，线程睡着了' : 'epoll_wait()：就绪列表是空的，线程睡着了');
    listed = false;
    sleeping = true;
    if (buf) say(`缓冲区里还有 ${buf} 字节，却不会再通知了`, 'warn');
  },
  // 回到同一个起点：来了 100 字节，报告过一次，读走 40
  reset() {
    buf = 0;
    listed = sleeping = false;
    log = [];
    acts.send();
    acts.wait();
    acts.read();
  },
};

function render() {
  blocks.forEach((b, i) => b.classList.toggle('on', i < buf / UNIT));
  out.textContent = `${buf} 字节`;
  slot.replaceChildren(listed ? el('span', 'chip', 'fd 5') : el('span', 'none', '空'), el('small', '', NOTE[mode]));
  thread.textContent = sleeping ? '在 epoll_wait() 里睡着' : '醒着';
  thread.classList.toggle('sleep', sleeping);
  keys.read.disabled = keys.drain.disabled = keys.wait.disabled = sleeping;
  logEl.replaceChildren(...log.slice(-5).map(([text, cls]) => el('li', cls, text)));
  modes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

modes.forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  acts.reset();
  render();
}));
Object.entries(keys).forEach(([act, b]) => b.addEventListener('click', () => {
  acts[act]();
  render();
}));
acts.reset();
render();
</script>
```

ET 下最容易出的错就是这个。如果对方发完请求就等着回复，不会再发新数据，剩下的 60 字节就一直躺在缓冲区里：程序等通知，对方等回复，两边干等。

所以用 ET，每次收到通知都要一口气读到读不动为止：

```c
for (;;) {
    ssize_t len = read(fd, buf, sizeof buf);
    if (len > 0) {
        handle(buf, len);
    } else if (len == 0) {   // 对方关闭了连接
        close(fd);
        break;
    } else if (errno == EAGAIN || errno == EWOULDBLOCK) {
        break;               // 读空了，回去等下一次通知
    } else {                 // 出错
        close(fd);
        break;
    }
}
```

这也是 ET 要配非阻塞 socket 的原因：读到没数据的那一次，阻塞的 socket 会让 `read()` 一直等下去，线程又卡住了，回到了开头的问题。

ET 少了些重复通知，代价是每次都得把数据读干净。Nginx 用的是 ET，Redis 用的是默认的 LT。刚开始写事件循环，先用 LT，不容易出错。

## 拼成一个服务器

前面这些拼起来，就是一个最小的 echo 服务器：谁发来什么，原样发回去。用的是默认的 LT：

```c
int lfd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);
/* bind()、listen() 省略 */

int epfd = epoll_create1(0);
struct epoll_event ev = { .events = EPOLLIN, .data.fd = lfd };
epoll_ctl(epfd, EPOLL_CTL_ADD, lfd, &ev);

struct epoll_event ready[64];
char buf[4096];
for (;;) {
    int k = epoll_wait(epfd, ready, 64, -1);
    for (int i = 0; i < k; i++) {
        int fd = ready[i].data.fd;
        if (fd == lfd) {                       // 监听 socket 可读：有新连接
            int conn = accept4(lfd, NULL, NULL, SOCK_NONBLOCK);
            ev = (struct epoll_event){ .events = EPOLLIN, .data.fd = conn };
            epoll_ctl(epfd, EPOLL_CTL_ADD, conn, &ev);
            continue;
        }
        ssize_t len = read(fd, buf, sizeof buf);
        if (len > 0)
            write(fd, buf, len);               // 原样发回去，先假设一次写得完
        else if (len == 0 || errno != EAGAIN)
            close(fd);                         // 对方关了，或者出错了
    }
}
```

几处值得多看一眼：

- 监听 socket 也登记进去了。它可读，说明有新连接在排队。一轮只 `accept4()` 一个也没关系，LT 下没接完的，下一轮还会报。
- 每次只读 4096 字节，没读完也不要紧，理由一样。换成 ET，这两处都得改成循环，一直读到 `EAGAIN`。
- 所有 socket 都设成了非阻塞。就算用 LT，偶尔也会报告可读、真去读时数据却没了，比如收到的包校验和不对，被内核丢掉了。阻塞的 `read()` 碰上这种情况就会卡住。
- `close()` 之后，这条连接在 epoll 里的登记会自动删掉。前提是没有别的 fd 还指着同一个 socket，比如 `dup()` 出来的，或者 `fork()` 时子进程继承的。
- `write()` 不一定一次写完。对方收得慢，发送缓冲区满了，就只能写进去一部分。真实的服务器得把剩下的存起来，关注 `EPOLLOUT`，等可写了再接着写。

> [!WARNING]
> 写完就把 `EPOLLOUT` 去掉。发送缓冲区几乎总有空位，LT 下一直关注可写事件，`epoll_wait()` 每次都会立刻返回，线程又空转起来了。

Redis、Nginx、Node.js 的核心都是这样一个循环：`epoll_wait()` 等事件，来一个处理一个，处理完回去接着等。这种写法叫 Reactor：一个循环负责等，等到了再分给对应的处理函数。Go 的写法看上去是一条连接一个 goroutine、阻塞着读，底下也是 Go 的运行时在替你用 epoll 等。

## 用上多个核

一个循环跑在一个线程里，只用得上一个 CPU 核。想把多核用起来，常见的做法是开几个线程或进程，每个各跑一个事件循环、各管一批连接。Nginx 就是这样，每个 worker 进程都有自己的 epoll。

几个 worker 都要接新连接。最直接的办法是共用一个监听 socket，各自登记进自己的 epoll。这样会碰上**惊群**：来一个新连接，所有 worker 都被叫醒，可 `accept4()` 只有一个抢得到，其余的白醒一趟。这也是监听 socket 要设成非阻塞的原因之一：没抢到的 worker 拿到的是 `EAGAIN`，不会卡在 `accept4()` 里。

解法有两种。一是登记监听 socket 时加上 `EPOLLEXCLUSIVE`（Linux 4.5 起），来了连接，尽量只叫醒其中一个。二是开 `SO_REUSEPORT`（Linux 3.9 起），每个 worker 各开一个监听 socket，绑在同一个端口上，由内核把新连接分给它们，谁也不跟谁抢。

还有一种做法，是几个线程一起 `epoll_wait()` 同一个 epoll 实例。这时要小心，同一条连接的事件可能先后交给两个线程：一个线程还在读，新数据又到了，另一个线程也被叫醒来读，两边读到的数据就乱了套。登记时加上 `EPOLLONESHOT` 可以避免：fd 报告一次就停用，处理它的线程忙完了，再用 `EPOLL_CTL_MOD` 重新打开。

## 就绪，还是完成

epoll 告诉你的是“可以读了”，读还得自己来：数据从内核拷到程序的缓冲区，这一步是程序自己调 `read()` 做的。所以 I/O 多路复用仍然是同步 I/O，只是等的时候不再卡在某一条连接上。

Linux 5.1 起有了 io_uring，可以把“读这条连接”整件事交给内核，等通知来的时候，数据已经在缓冲区里了。Windows 的 IOCP 也是这个思路。从“就绪了告诉我”到“做完了告诉我”，这是另一种模型，叫异步 I/O。

## 参考资料

- Linux man-pages：[select(2)](https://man7.org/linux/man-pages/man2/select.2.html)、[poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html)、[epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html)、[epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html)、[epoll_wait(2)](https://man7.org/linux/man-pages/man2/epoll_wait.2.html)。
- Dan Kegel. [The C10K problem](http://www.kegel.com/c10k.html)。
