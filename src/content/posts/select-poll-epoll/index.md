---
title: "select、poll、epoll：一个线程怎么等多个连接"
description: "单线程要同时应付几千条连接，就不能卡在任何一条上。看看 select、poll 和 epoll 怎么把等待交给内核，以及各自每轮要多干多少活。"
pubDate: 2026-11-02
updatedDate: 2026-11-11
tags: ["操作系统", "计算机网络", "计算机基础"]
---

假设写一个简单的聊天服务器，为了省去多线程同步，先只开一个线程循环读取每条连接：

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

`conns` 里存的是每条连接的文件描述符（fd）。在 Linux 里，打开的文件和建立的连接对程序来说都是一个小整数，`read()` 靠它就知道该从哪条连接读。

但 `read()` 默认是阻塞的，没数据时不会返回。如果 A 连上来后一直没发消息，线程就会卡在 `read(A)` 上。此时就算 B、C、D 发来消息也顾不上处理，都得干等 A 那边有动静。几千条连接里总有空闲的，单线程不能被其中任何一条拖住。

## 两种直接的做法

最简单的办法是每条连接开一个线程，`read()` 阻塞也只影响它自己。并发小的时候很省心，可连接涨到几千上万条就不划算了。每个线程都要独立的栈（Linux 默认按 8 MB 预留，碰过的页才真占内存），内核还得在大量线程间频繁切换，而它们绝大多数时间只是在等。单机怎么撑住一万条连接，Dan Kegel 在 1999 年写过一篇著名文章，这就是 C10K 问题。

另一种办法是把 socket 设成非阻塞。socket 是连接在内核里的端点，fd 指的就是它：

```c
fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);
```

设成非阻塞后，没数据时 `read()` 会立刻返回 -1，并把 `errno` 设为 `EAGAIN`（意思是现在没数据，稍后再试）。这样线程就能挨个轮询，有数据就处理，没数据就跳过。

这么改虽然不会卡死，但绝大多数轮询都在做无用功。每次 `read()` 都是一次系统调用，涉及用户态和内核态切换，开销远高于普通函数调用。哪怕所有连接此时都没流量，循环也会全速空转，把一个 CPU 核跑满。

## 把等待交给内核

数据从网卡进来后，本来就是内核先收到，放进对应 socket 的接收缓冲区。哪条连接来了数据，内核本来就知道。

所以可以把分工换一下：线程把要关注的连接交给内核，然后挂起等待，等有连接收到数据了，内核再唤醒线程并告诉它是哪几条。单个线程同时等很多条连接，这种机制叫 **I/O 多路复用**。select、poll、epoll 解决的都是同一件事，按时间先后出现，后一个主要在修补前一个的局限。

把这三种方式放到同一条时间线上对比。A、B、C 三条连接里，B 和 C 很早发了消息，A 拖到第 9 格才发：

```render html title="时间从左往右，一格的长短是示意；真的空转比图里密得多"
<style>
  .wt { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; justify-content: flex-end; }
  .top button { min-height: 38px; padding: 0 16px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font-size: 13px; cursor: pointer; }
  .lane { margin-top: 10px; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 14px; color: var(--muted); }
  .head b { color: var(--text); font-size: 14px; font-weight: 650; }
  .head output { color: var(--text); font: 600 13.5px var(--font-mono); }
  .head output.bad { color: var(--accent-ink); }
  .lane svg { display: block; margin-top: 2px; overflow: visible; }
  .grid { stroke: var(--rule); }
  .who { fill: var(--text); font: 600 11.5px var(--font-mono); text-anchor: end; }
  .msg { fill: var(--accent); }
  .wait { stroke: var(--accent); stroke-width: 3; stroke-linecap: round; }
  .waitn { fill: var(--accent-ink); font: 600 11.5px var(--font-sans); }
  .blk { fill: var(--surface); stroke: var(--rule-strong); }
  .zh { fill: var(--muted); font: 12px var(--font-sans); text-anchor: middle; }
  .try { stroke: var(--faint); stroke-width: 1.5; }
  .hit { stroke: var(--accent); stroke-width: 2.5; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 12px; color: var(--muted); font-size: 12.5px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
</style>
<section class="wt" aria-label="同样三条消息的三种等法：阻塞着读，线程卡在 read(A) 上，B 的消息等了 7 格；非阻塞挨个试，48 次 read() 有 45 次落空；交给内核，线程睡着，消息一到就被叫醒">
  <div class="top"><button type="button">播放</button></div>
  <div class="lane"><div class="head"><b>阻塞着读</b><span>消息最久等 <output></output> 格，白试 <output></output> 次</span></div><svg role="img" aria-label="线程卡在 read(A) 上 9 格，B 的消息等了 7 格，C 等了 4 格"></svg></div>
  <div class="lane"><div class="head"><b>非阻塞，挨个试</b><span>消息最久等 <output></output> 格，白试 <output></output> 次</span></div><svg role="img" aria-label="线程不停地试，48 次 read() 里有 45 次落空"></svg></div>
  <div class="lane"><div class="head"><b>交给内核，睡着等</b><span>消息最久等 <output></output> 格，白试 <output></output> 次</span></div><svg role="img" aria-label="线程睡着，三条消息各叫醒它一次，一到就读"></svg></div>
  <div class="legend">
    <span><svg width="12" height="12"><circle class="msg" cx="6" cy="6" r="4" /></svg>消息到了</span>
    <span><svg width="22" height="12"><line class="wait" x1="3" x2="19" y1="6" y2="6" /></svg>等着被读</span>
    <span><svg width="8" height="14"><line class="try" x1="4" x2="4" y1="4" y2="13" /></svg>落空的 read()</span>
    <span><svg width="8" height="14"><line class="hit" x1="4" x2="4" y1="1" y2="13" /></svg>读到数据</span>
  </div>
</section>
<script>
const T = 12, STEP = 0.25, SILENT = 9, TOP = 46, BOT = 62;
const MSG = [{ who: 'A', at: SILENT, y: 12 }, { who: 'B', at: 2, y: 24 }, { who: 'C', at: 5, y: 36 }];
const root = document.querySelector('.wt');
const lanes = [...root.querySelectorAll('.lane')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = v => String(Math.round(v * 10) / 10);
let now = T, raf = 0;

// 一条消息到了以后，在第几格被读走
function readAt(kind, m) {
  if (kind === 0) return Math.max(m.at, SILENT);   // 线程卡在 read(A) 上，A 开口之前谁也读不到
  if (kind === 2) return m.at;                     // 内核当场把线程叫醒
  let i = Math.ceil(m.at / STEP);                  // 挨个试：等到轮着这条连接的那次 read()
  while ('ABC'[i % 3] !== m.who) i++;
  return i * STEP;
}

function draw(lane, kind) {
  const w = lane.clientWidth, x = v => (v / T) * w;
  const box = (x0, x1, rx, text) => {
    if (x1 - x0 < 2) return '';
    const label = text && x1 - x0 > text.length * 9 + 8 ? `<text class="zh" x="${(x0 + x1) / 2}" y="${TOP + 12}">${text}</text>` : '';
    return `<rect class="blk" x="${x0}" y="${TOP}" width="${x1 - x0}" height="${BOT - TOP}" rx="${rx}" />${label}`;
  };
  const tick = (px, cls, y0) => `<line class="${cls}" x1="${px}" x2="${px}" y1="${y0}" y2="${BOT}" />`;
  let s = '', wasted = 0, longest = 0;
  for (let g = 0; g <= T; g++) s += `<line class="grid" x1="${x(g)}" x2="${x(g)}" y1="4" y2="${BOT}" />`;
  if (kind === 0) {
    s += box(x(0), x(Math.min(now, SILENT)), 2, '卡在 read(A)');
    if (now >= SILENT) {
      for (let i = 0; i < 3; i++) s += tick(x(SILENT) + 2 + i * 4, 'hit', TOP);
      s += box(x(SILENT) + 14, x(now), 2, '卡在 read(A)');   // 读完一圈，又卡回 A 上
    }
  } else if (kind === 1) {
    for (let i = 0; i * STEP <= now && i * STEP < T; i++) {
      const hit = MSG.some(m => readAt(1, m) === i * STEP);
      if (!hit) wasted++;
      s += tick(x(i * STEP) + 1, hit ? 'hit' : 'try', hit ? TOP : TOP + 5);
    }
  } else {
    const wake = [0, ...MSG.map(m => m.at).sort((a, b) => a - b), T];
    for (let i = 0; i + 1 < wake.length && now > wake[i]; i++) {
      s += box(x(wake[i]) + 3, x(Math.min(now, wake[i + 1])) - 3, 8, '睡');
      if (i) s += tick(x(wake[i]), 'hit', TOP);
    }
  }
  for (const m of MSG) {
    if (now < m.at) continue;
    const end = Math.min(readAt(kind, m), now), waited = end - m.at;
    longest = Math.max(longest, waited);
    if (waited > 0) s += `<line class="wait" x1="${x(m.at)}" x2="${x(end)}" y1="${m.y}" y2="${m.y}" />`;
    s += `<circle class="msg" cx="${x(m.at)}" cy="${m.y}" r="4" /><text class="who" x="${x(m.at) - 8}" y="${m.y + 4}">${m.who}</text>`;
    if (waited >= 1) s += `<text class="waitn" x="${x(end) + 7}" y="${m.y + 4}">等 ${fmt(waited)} 格</text>`;
  }
  const svg = lane.querySelector('svg');
  svg.setAttribute('width', w);
  svg.setAttribute('height', BOT + 2);
  svg.innerHTML = s;
  const [wait, miss] = lane.querySelectorAll('output');
  wait.textContent = fmt(longest);
  wait.classList.toggle('bad', longest >= 1);
  miss.textContent = wasted;
  miss.classList.toggle('bad', wasted > 0);
}

const render = () => lanes.forEach(draw);
function play() {
  cancelAnimationFrame(raf);
  if (reduce) { now = T; render(); return; }
  const t0 = performance.now();
  const frame = t => {
    now = Math.max(0, Math.min(T, (t - t0) / 350));   // 一格走 0.35 秒
    render();
    if (now < T) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
root.querySelector('button').addEventListener('click', play);
new ResizeObserver(render).observe(root);
render();
if (!reduce) new IntersectionObserver((entries, io) => {
  if (entries.some(e => e.isIntersecting)) { io.disconnect(); play(); }
}, { threshold: 0.6 }).observe(root);
</script>
```

图里第三行就是后面三个接口要达到的效果，没数据时线程休眠不占 CPU，一醒来就有数据可处理。

内核通知的是“就绪”，意思是现在去读或写不会被阻塞：

- 可读：接收缓冲区里有数据；对端关闭连接也算可读，这时 `read()` 会立刻返回 0；监听 socket（专门接新连接的那个）上有新连接排队同样算可读。
- 可写：发送缓冲区还有空位。

这些接口只管通知，真正读写数据还是程序自己调 `read()` 和 `write()`。

## select：每轮传一张位图

`select` 用位图记下要监听哪些 fd，类型是 `fd_set`，第几位是 1 就表示监听几号 fd。读、写、异常各用一张，这里先只看读：

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

第一个参数是最大 fd 加 1，告诉内核扫描到第几位为止。后面三个 `NULL` 依次是可写位图、异常位图和超时时间，超时传 `NULL` 表示一直等。

调用时，这张位图被拷进内核，由内核逐个检查置 1 的 fd。如果都没就绪，线程就挂起休眠。等有 fd 就绪，`select()` 会把结果直接写回同一张位图再返回，此时只有就绪的几位还是 1：

```render html title="fd_set 一共 1024 位，这里只画前 12 位"
<style>
  .fs { font-size: 13px; line-height: 1.4; font-variant-ligatures: none; }
  .row { display: grid; grid-template-columns: 4.2em repeat(12, minmax(0, 1fr)) 1.4em; gap: 4px; align-items: center; }
  .lbl { color: var(--muted); white-space: nowrap; }
  .num, .more { color: var(--faint); font: 11.5px var(--font-mono); text-align: center; }
  .b { display: grid; place-items: center; height: 28px; border: 1px solid var(--rule-strong); border-radius: 4px; color: var(--faint); font: 13px var(--font-mono); }
  .b.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 650; }
  .call { margin: 6px 0 6px calc(4.2em + 4px); color: var(--muted); font: 12.5px var(--font-mono); }
</style>
<section class="fs" aria-label="同一张 fd_set：调用前第 3、4、6、9 位是 1，select 返回后只剩第 6 位"></section>
<script>
const root = document.querySelector('.fs');
const cell = (className, text) => Object.assign(document.createElement('span'), { className, textContent: text });
const bits = Array.from({ length: 12 }, (_, i) => i);
const row = (name, on) => {
  const div = cell('row', '');
  div.append(cell('lbl', name), ...bits.map(i => (on ? cell(on.includes(i) ? 'b on' : 'b', on.includes(i) ? 1 : 0) : cell('num', i))), cell('more', '…'));
  return div;
};
root.append(row('fd'), row('调用前', [3, 4, 6, 9]), cell('call', '↓ select()'), row('返回后', [6]));
</script>
```

调用前监听的是 3、4、6、9 号，返回后就只剩就绪的 6 号了。原本要监听谁被结果盖掉了，每轮开头都得重新填。返回值也只告诉你有几个就绪，具体是哪几个还得挨个调 `FD_ISSET`。

另外，`select` 还有个硬限制。glibc 里的 `fd_set` 固定 1024 位，只能放编号 0 到 1023 的 fd，这个数写死在头文件里，自己重定义 `FD_SETSIZE` 也改不了。注意限制的是**编号**而不是个数。Linux 分配 fd 总挑最小的空号，进程同时开着的文件和连接一多，新连接编号就会超过 1023，哪怕只想监听这一条也塞不进去，硬放就是越界写内存。`select` 的手册里也直接建议新程序改用 `poll` 或 `epoll`。

## poll：把位图换成数组

`poll` 改用调用方传入的 `struct pollfd` 数组：

```c
struct pollfd {
    int   fd;       // 哪个 fd
    short events;   // 关心什么：POLLIN 可读，POLLOUT 可写
    short revents;  // 发生了什么，由内核填
};
```

关注什么、发生了什么拆成了两个字段。内核只改 `revents`，`events` 不会被覆盖，数组填好一次就能一直复用，而且长度由程序自己定，1024 的限制也没了：

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

单看接口确实顺手了不少，但每一轮内核要做的活一点没少。

## 每轮都要从头扫描

先看内核怎么唤醒休眠的线程。每个 socket 都带着一个等待队列，队列里的每一项相当于一个回调，记着“有事件时做什么”，最常见的是唤醒某个线程。数据到达后，内核先放进接收缓冲区，再把等待队列上的回调依次执行一遍。往队列里加一项，下面简称挂一个钩子。阻塞 `read()` 是在单个 socket 上挂好钩子再休眠，`select` 和 `poll` 则是给每个 socket 都挂一个。

线程调一次 `select()` 或 `poll()`、休眠再醒来，前后要走完这些步骤：

1. 把整张位图或整个数组从用户态拷进内核。
2. 逐个检查每个 fd 是否就绪，顺手在它的 socket 上挂一个唤醒钩子。
3. 如果一个都没就绪，线程挂起休眠。
4. 某条连接收到数据，上面的钩子唤醒线程。但它只管唤醒，并不记是哪条连接触发的。
5. 线程醒来后，内核只好把所有 fd 从头再查一遍，找出是谁就绪了。
6. 把挂上去的钩子一个个摘掉，再把结果拷回用户态。
7. 回到用户程序，再遍历结果挑出就绪的 fd。

哪怕有一万条连接、这一轮只有一条来了数据，也要把一万个 fd 前前后后扫上五遍，下一轮还得从第 1 步重来。连接越多每一轮越慢，可大多数连接此时什么也没发。

## epoll：登记一次，只取就绪事件

上面有两件事是每轮白做的：监听名单反复拷进内核，钩子挂上又摘掉。`epoll` 把“登记”和“等待”拆成独立的调用，这两件事就都只需要做一次：

- `epoll_create1()`：在内核里建一个 epoll 实例，返回一个代表它的 fd。
- `epoll_ctl()`：往实例里添加、修改或删除要监听的 fd。
- `epoll_wait()`：阻塞等待，返回的只有就绪的那几个。

还是前面那个程序，换成 `epoll` 后是这样：

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

`struct epoll_event` 有两个成员：`events` 是关心的事件，`data` 留给程序自己用，登记时填什么，事件回来时就原样带回什么。上面直接存了 fd，真实服务器更常放一个指向连接对象的指针，拿到事件就能定位连接状态。注意 `data` 是个 union，fd 和指针只能二选一。

监听名单保存在内核的 epoll 实例里（底层是一棵红黑树，增删查都快），之后每轮不用再传。

钩子也是登记时一次性挂好并一直留着。这回挂的是 epoll 自己的回调，它知道自己绑在哪条连接上。数据到了，回调先把连接记进实例的**就绪列表**，再唤醒等在 `epoll_wait()` 上的线程。线程醒来不用从头扫，直接把列表里的项拷给用户态就行。

下面是 8 条已登记的连接里，9 号和 6 号先后收到数据的过程：

```render html
<style>
  .ep { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
  .ctl button { min-height: 38px; padding: 0 16px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font-size: 13px; cursor: pointer; }
  .say { flex: 1 1 12em; font-weight: 600; }
  .edge { display: flex; align-items: center; gap: 8px; margin: 12px 0 2px; color: var(--faint); font-size: 12px; }
  .edge::before, .edge::after { content: ""; flex: 1; border-top: 1px dashed var(--rule-strong); }
  .line { display: grid; grid-template-columns: 4.6em minmax(0, 1fr); gap: 8px; align-items: center; margin-top: 6px; padding: 0 8px; }
  .name { color: var(--muted); font-size: 12.5px; white-space: nowrap; }
  .inst { margin-top: 8px; padding-bottom: 8px; border-radius: 6px; background: var(--surface); }
  .tag { padding: 4px 8px 0; color: var(--faint); font-size: 12px; }
  .cols { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; }
  .cols i { display: grid; place-items: center; height: 28px; border: 1px solid var(--rule-strong); border-radius: 4px; color: var(--faint); font: normal 12.5px var(--font-mono); }
  .cols i.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 650; }
  .list { display: flex; align-items: center; gap: 4px; min-height: 28px; }
  .list i { display: grid; place-items: center; width: 34px; height: 28px; border: 1px solid var(--accent); border-radius: 4px; background: var(--accent-soft); color: var(--accent-ink); font: 650 12.5px var(--font-mono); }
  .none { color: var(--faint); font-size: 12px; }
  .hook i, .nic i { height: 16px; border: 0; }
  .hook i::before { content: ""; width: 2px; height: 16px; background: var(--rule-strong); }
  .hook i.on { background: none; }
  .hook i.on::before { width: 4px; background: var(--accent); }
  .nic i { color: var(--accent-ink); font-size: 14px; }
  .pill { justify-self: start; padding: 2px 12px; border: 1px solid var(--rule-strong); border-radius: 999px; background: var(--surface); color: var(--muted); }
  .pill.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
</style>
<section class="ep" aria-label="epoll 的一轮：8 条连接都在监听名单里，各自的 socket 上挂着钩子。9 号和 6 号来了数据，它们的钩子把它们记进就绪列表，epoll_wait() 只把这两项拷给程序，另外 6 条没人碰">
  <div class="ctl">
    <button type="button" class="play">播放</button>
    <button type="button" class="next">下一步</button>
    <span class="say" aria-live="polite"></span>
  </div>
  <div class="edge">程序</div>
  <div class="line"><span class="name">线程</span><span class="pill"></span></div>
  <div class="line"><span class="name"><code>ready[]</code></span><span class="list out"></span></div>
  <div class="edge">内核</div>
  <div class="inst">
    <div class="tag">epoll 实例</div>
    <div class="line"><span class="name">就绪列表</span><span class="list rdy"></span></div>
    <div class="line"><span class="name">监听名单</span><span class="cols ent"></span></div>
  </div>
  <div class="line"><span class="name">钩子</span><span class="cols hook"></span></div>
  <div class="line"><span class="name">socket</span><span class="cols sock"></span></div>
  <div class="line"><span class="name">网卡</span><span class="cols nic"></span></div>
</section>
<script>
const FDS = [5, 6, 7, 8, 9, 10, 11, 12];
// data：哪些 socket 里有数据；nic：这一步刚到的包是给谁的；rdy：就绪列表；out：拷给程序的
const STEPS = [
  { say: '线程睡着，8 条连接都没数据', data: [], rdy: [], out: [] },
  { say: '9 号来了数据', data: [9], nic: 9, rdy: [], out: [] },
  { say: '9 的钩子：记进就绪列表，叫醒线程', data: [9], rdy: [9], out: [], woke: true },
  { say: '线程还没跑起来，6 号也来了数据', data: [9, 6], nic: 6, rdy: [9], out: [], woke: true },
  { say: '6 的钩子：接在列表后面', data: [9, 6], rdy: [9, 6], out: [], woke: true },
  { say: 'epoll_wait() 只拷出列表里这 2 项', data: [9, 6], rdy: [9, 6], out: [9, 6], woke: true, done: true },
];
const LAST = STEPS.length - 1;
const root = document.querySelector('.ep');
const say = root.querySelector('.say'), pill = root.querySelector('.pill');
const playBtn = root.querySelector('.play'), nextBtn = root.querySelector('.next');
const outBox = root.querySelector('.out'), rdyBox = root.querySelector('.rdy');
const el = (tag, className, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
const cells = name => FDS.map(() => root.querySelector('.' + name).appendChild(el('i', '')));
const ent = cells('ent'), hook = cells('hook'), sock = cells('sock'), nic = cells('nic');
const fill = (box, fds) => box.replaceChildren(...(fds.length ? fds.map(fd => el('i', '', fd)) : [el('span', 'none', '空')]));
let at = LAST, timer = 0;

function paint() {
  const s = STEPS[at];
  fill(outBox, s.out);
  fill(rdyBox, s.rdy);
  FDS.forEach((fd, i) => {
    const has = s.data.includes(fd), fired = s.rdy.includes(fd);   // 进了就绪列表，说明它的钩子响过
    ent[i].textContent = fd;
    ent[i].className = fired ? 'on' : '';
    hook[i].className = fired ? 'on' : '';
    sock[i].textContent = has ? '●' : '';
    sock[i].className = has ? 'on' : '';
    nic[i].textContent = s.nic === fd ? '↑' : '';
  });
  pill.textContent = s.done ? 'epoll_wait() 返回 2' : s.woke ? '被叫醒' : '睡在 epoll_wait() 里';
  pill.className = s.woke ? 'pill on' : 'pill';
  say.textContent = s.say;
  nextBtn.textContent = at === LAST ? '从头' : '下一步';
}
function stop() {
  clearInterval(timer);
  timer = 0;
}
function play() {
  stop();
  at = 0;
  paint();
  timer = setInterval(() => {
    at += 1;
    paint();
    if (at === LAST) stop();
  }, 1100);
}
playBtn.addEventListener('click', play);
nextBtn.addEventListener('click', () => {
  stop();
  at = at === LAST ? 0 : at + 1;
  paint();
});
paint();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) new IntersectionObserver((entries, io) => {
  if (entries.some(e => e.isIntersecting)) { io.disconnect(); play(); }
}, { threshold: 0.6 }).observe(root);
</script>
```

`epoll_ctl()` 只维护监听名单，`epoll_wait()` 只看就绪列表，两头靠钩子连着。其余 6 条没收到数据的连接，这一轮从头到尾都没被碰过。

把一轮里访问过的 fd 次数统计出来，和 `select`/`poll` 放一块对比。一共 32 条连接，线程休眠期间有连接来了数据：

```render html title="实心的一格：碰了一次这个 fd。高出来的：来了数据的连接"
<style>
  .ps { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .pick { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pick > span { margin-right: 4px; color: var(--muted); }
  .pick button { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font-size: 13px; cursor: pointer; }
  .pick button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
  .go { min-height: 38px; padding: 0 16px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font-size: 13px; cursor: pointer; }
  .panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px 36px; align-items: start; margin-top: 18px; }
  @media (max-width: 560px) { .panes { grid-template-columns: minmax(0, 1fr); } }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 4px; color: var(--muted); }
  .head b { color: var(--text); font-size: 14px; font-weight: 650; }
  .head output { color: var(--text); font: 600 15px var(--font-mono); }
  .pass { display: grid; grid-template-columns: 6.6em minmax(0, 1fr); gap: 10px; align-items: center; margin-top: 7px; }
  .pass > span { color: var(--muted); font-size: 12.5px; white-space: nowrap; }
  .strip { display: grid; grid-template-columns: repeat(32, minmax(0, 1fr)); gap: 2px; align-items: end; height: 20px; }
  .strip i { height: 12px; border: 1px solid var(--rule-strong); border-radius: 1px; }
  .strip i.v { border-color: var(--faint); background: var(--faint); }
  .strip i.o { background: var(--rule-strong); }
  .strip i.r { height: 20px; border-color: var(--accent); }
  .strip i.v.r { background: var(--accent); }
  .strip i.e { border-color: transparent; }
  .strip i.d { align-self: center; height: 7px; border-color: var(--accent); border-radius: 50%; background: var(--accent); }
</style>
<section class="ps" aria-label="一轮里碰过多少次 fd：select 和 poll 把全部连接过五遍；epoll 登记之后，每轮只碰来了数据的那几条">
  <div class="bar">
    <div class="pick" role="group" aria-label="来了数据的连接数">
      <span>来数据：</span>
      <button type="button" data-k="1">1 条</button>
      <button type="button" data-k="4">4 条</button>
      <button type="button" data-k="32">全部 32 条</button>
    </div>
    <button type="button" class="go">播放</button>
  </div>
  <div class="panes">
    <div class="pane" data-plan="scan"><div class="head"><b>select / poll</b><span>每轮碰 fd <output></output> 次</span></div></div>
    <div class="pane" data-plan="epoll"><div class="head"><b>epoll</b><span>每轮碰 fd <output></output> 次</span></div></div>
  </div>
</section>
<script>
const N = 32, ORDER = [21, 5, 13, 28], TICK = 25, NAP = 12;
for (let i = 0; i < N; i++) if (!ORDER.includes(i)) ORDER.push(i);
// 一行是把 fd 过一遍，从上到下是先后。all：整行挨个碰；hit：只碰来了数据的；nap：线程睡着，中途数据到了；once：建连接时做过一次，不算在每一轮里
const PLAN = {
  scan: [['拷进内核', 'all'], ['查 + 挂钩', 'all'], ['睡，数据来了', 'nap'], ['醒来再查', 'all'], ['摘钩 + 拷回', 'all'], ['程序找结果', 'all']],
  epoll: [['登记，只一次', 'once'], ['睡，数据来了', 'nap'], ['取就绪列表', 'hit']],
};
const root = document.querySelector('.ps');
const el = (tag, className, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
const panes = [...root.querySelectorAll('.pane')].map(pane => {
  const rows = PLAN[pane.dataset.plan].map(([name, kind]) => {
    const pass = el('div', 'pass'), strip = el('div', 'strip');
    pass.append(el('span', '', name), strip);
    pane.append(pass);
    return { kind, cells: Array.from({ length: N }, () => strip.appendChild(el('i', ''))) };
  });
  return { rows, out: pane.querySelector('output') };
});
const buttons = root.querySelectorAll('.pick button');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let k = 1, clock = Infinity, raf = 0;   // clock：这一轮走到第几步，一步碰一个 fd；Infinity 是走完了

function paint() {
  const ready = new Set(ORDER.slice(0, k));
  const queue = [...ready].sort((a, b) => a - b);   // hit 行从左到右碰
  for (const { rows, out } of panes) {
    let start = 0, touched = 0, arrived = false;
    for (const { kind, cells } of rows) {
      const len = kind === 'all' ? N : kind === 'hit' ? k : kind === 'nap' ? NAP : 0;
      const done = Math.max(0, Math.min(len, Math.floor(clock - start)));
      if (kind === 'nap') arrived = clock - start >= NAP / 2;
      else if (kind !== 'once') touched += done;
      cells.forEach((c, i) => {
        const r = arrived && ready.has(i);   // 数据已经到了，在这条连接上
        let cls = '';
        if (kind === 'once') cls = 'o';
        else if (kind === 'nap') cls = r ? 'd' : 'e';
        else if (kind === 'hit') cls = !r ? '' : queue.indexOf(i) < done ? 'v r' : 'r';
        else cls = [i < done && 'v', r && 'r'].filter(Boolean).join(' ');
        if (c.className !== cls) c.className = cls;
      });
      start += len;
    }
    out.textContent = touched;
  }
  buttons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.k) === k)));
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { clock = Infinity; paint(); return; }
  const t0 = performance.now();
  const frame = t => {
    clock = (t - t0) / TICK;
    if (clock >= 5 * N + NAP) clock = Infinity;
    paint();
    if (clock !== Infinity) raf = requestAnimationFrame(frame);
  };
  clock = 0;
  paint();
  raf = requestAnimationFrame(frame);
}
buttons.forEach(b => b.addEventListener('click', () => {
  cancelAnimationFrame(raf);
  k = Number(b.dataset.k);
  clock = Infinity;
  paint();
}));
root.querySelector('.go').addEventListener('click', play);
paint();
if (!reduce) new IntersectionObserver((entries, io) => {
  if (entries.some(e => e.isIntersecting)) { io.disconnect(); play(); }
}, { threshold: 0.6 }).observe(root);
</script>
```

左边不管活跃几条，每轮都是五整行，换成一万条连接就是每行一万格。右边登记只在建连时做一次，之后每轮来几条碰几条。但点一下“全部 32 条”，右边也排满了一行：当所有连接同时都很忙时，`epoll` 省下的只是那几遍重复，量级上和 `poll` 差不多。

`epoll_wait()` 一次最多返回 `maxevents` 个事件（前面设的是 64）。如果就绪的更多，剩下的会留在列表里，下一次调用再取。

顺便澄清一个常见误区，网上常说 `epoll` 快是因为用了 `mmap` 和内核共享内存、省了拷贝。并没有这回事，就绪事件照样要从内核拷到用户态，只是每次只拷就绪的那几个。

## 放在一起比一比

| | select | poll | epoll |
| --- | --- | --- | --- |
| 怎么告诉内核监听谁 | 每轮传一张位图 | 每轮传整个数组 | 登记一次，变了再改 |
| 内核每轮查多少 | 全部 | 全部 | 只看就绪列表 |
| 程序怎么找就绪的 | 挨个 `FD_ISSET` | 挨个看 `revents` | 直接用返回的事件 |
| fd 的限制 | 编号必须小于 1024 | 没有固定上限 | 没有固定上限 |
| 平台 | POSIX | POSIX | 只有 Linux |

这里的“没有固定上限”仍受限于进程能打开的 fd 数（`ulimit -n`）和内存大小。

`epoll` 赢在连接总数多、同一时刻只有少数活跃的场合，维持大量长连接的服务器正是如此。如果每条连接都在持续收发，优势就会像上图那样缩小。要是只盯三五个 fd，三者速度几乎没差别，`poll` 不用建实例也不用调 `epoll_ctl()`，写起来反而省事。

还有两个限制要注意。一是普通磁盘文件不能交给 epoll，`epoll_ctl()` 会返回 `EPERM`，因为在内核看来普通文件随时可读可写，等它没有意义。二是平台相关性，`epoll` 只有 Linux 有，macOS 和 BSD 上对应的是 `kqueue`，Windows 上则是思路不同的 IOCP，最后一节会提到。

## LT 和 ET：水平触发与边缘触发

`epoll` 有两种通知模式。默认是 **LT（水平触发）**，只要 fd 还处于就绪状态，每次 `epoll_wait()` 都会继续报告它。登记时加上 `EPOLLET` 就换成 **ET（边缘触发）**，只在状态有新变化时报告一次，比如又到了一批新数据。

差别会在数据没一次性读完时显出来。对端发来 100 字节，程序收到通知只读了 40 字节，缓冲区里还剩 60。再调 `epoll_wait()`，LT 还会接着报这个 fd，ET 则不会，剩下的 60 字节算不上新变化。

把接收缓冲区里的字节数沿时间画出来。对端先后发来两批 100 字节，程序每收到通知只读 40 字节：

```render html title="接收缓冲区里的字节数，时间从左往右"
<style>
  .tg { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .pick { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pick > span { margin-right: 4px; color: var(--muted); }
  .pick button { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font-size: 13px; cursor: pointer; }
  .pick button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  .lane { margin-top: 22px; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 12px; color: var(--muted); }
  .head b { color: var(--text); font-size: 14px; font-weight: 650; }
  .head output { color: var(--text); font: 600 14px var(--font-mono); }
  .lane svg { display: block; overflow: visible; }
  .lane text { fill: var(--muted); font: 11.5px var(--font-mono); text-anchor: middle; }
  .lane .in { fill: var(--text); font-weight: 600; }
  .lane .zh { font: 12px var(--font-sans); }
  .lane .warn { fill: var(--accent-ink); font-weight: 600; }
  .lane .axis { stroke: var(--rule-strong); }
  .lane .lv { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; }
  .lane .hatch { stroke: var(--accent); stroke-width: 1.6; }
  .dot { fill: var(--accent); }
  .nap { fill: var(--surface); stroke: var(--rule-strong); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 20px; margin-top: 14px; color: var(--muted); font-size: 12.5px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend b { color: var(--text); font: 600 11.5px var(--font-mono); }
</style>
<section class="tg" aria-label="同样的数据到达，LT 和 ET 各通知几次、缓冲区里剩多少">
  <div class="pick" role="group" aria-label="每次收到通知读多少">
    <span>每次收到通知：</span>
    <button type="button" data-chunk="40">读 40 字节</button>
    <button type="button" data-chunk="Infinity">读到 EAGAIN</button>
  </div>
  <div class="lane"><div class="head"><b>LT 水平触发</b><span>通知 <output></output> 次，最后剩 <output></output> 字节</span></div><svg role="img"></svg></div>
  <div class="lane"><div class="head"><b>ET 边缘触发</b><span>通知 <output></output> 次，最后剩 <output></output> 字节</span></div><svg role="img"></svg></div>
  <div class="legend">
    <span><b>+100</b>对方发来 100 字节</span>
    <span><svg width="12" height="12"><circle class="dot" cx="6" cy="6" r="5" /></svg>epoll_wait() 报告可读</span>
    <span><svg width="22" height="12"><rect class="nap" x=".5" y=".5" width="21" height="11" rx="5.5" /></svg>线程睡在 epoll_wait() 里</span>
  </div>
</section>
<script>
const T = 9, ARRIVE = { 0: 100, 5: 100 }, MAX = 160;
const TOP = 34, PLOT = 72, BASE = TOP + PLOT, LANE = BASE + 10, HEIGHT = LANE + 18;
const root = document.querySelector('.tg');
const lanes = [...root.querySelectorAll('.lane')];
const buttons = root.querySelectorAll('.pick button');
let chunk = 40;

// 每一格是一段时间。这一格开头被通知了，读的那一下落在下一格开头。
function simulate(edge) {
  const slots = [];
  let buf = 0;
  for (let t = 0; t < T; t++) {
    if (t && slots[t - 1].awake) buf -= Math.min(chunk, buf);
    const arrive = ARRIVE[t] ?? 0;
    buf += arrive;
    slots.push({ level: buf, arrive, awake: edge ? arrive > 0 : buf > 0 });
  }
  return slots;
}

// 把连续的、满足条件的格子并成一段 [起, 止)
function runs(slots, test) {
  const out = [];
  slots.forEach((s, t) => {
    if (!test(s)) return;
    const last = out.at(-1);
    if (last && last[1] === t) last[1] = t + 1;
    else out.push([t, t + 1]);
  });
  return out;
}

function draw(lane, index) {
  const slots = simulate(index === 1);
  const svg = lane.querySelector('svg');
  const w = lane.clientWidth, dx = w / T;
  const y = v => BASE - (v / MAX) * PLOT;
  const mid = (a, b) => ((a + b) / 2) * dx;
  const stuck = s => !s.awake && s.level > 0;
  let wave = `M0 ${BASE}`, marks = '';
  slots.forEach((s, t) => {
    wave += `V${y(s.level)}H${(t + 1) * dx}`;
    if (s.arrive) marks += `<text class="in" x="${mid(t, t + 1)}" y="11">+${s.arrive}</text>`;
    if (!t || s.level !== slots[t - 1].level)
      marks += `<text class="${stuck(s) ? 'warn' : ''}" x="${mid(t, t + 1)}" y="${y(s.level) - 6}">${s.level}</text>`;
    if (s.awake) marks += `<circle class="dot" cx="${mid(t, t + 1)}" cy="${LANE + 8}" r="5" />`;
  });
  for (const [a, b] of runs(slots, stuck)) {
    const top = y(slots[a].level);
    marks += `<rect fill="url(#hatch${index})" x="${a * dx}" y="${top}" width="${(b - a) * dx}" height="${BASE - top}" />`;
    marks += `<text class="zh warn" x="${mid(a, b)}" y="${top - 6}">没人读</text>`;
  }
  for (const [a, b] of runs(slots, s => !s.awake)) {
    marks += `<rect class="nap" x="${a * dx + 2}" y="${LANE}" width="${Math.max(0, (b - a) * dx - 4)}" height="16" rx="8" />`;
    marks += `<text class="zh" x="${mid(a, b)}" y="${LANE + 12}">睡</text>`;
  }
  svg.setAttribute('width', w);
  svg.setAttribute('height', HEIGHT);
  svg.innerHTML =
    `<defs><pattern id="hatch${index}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="hatch" y2="6" /></pattern></defs>` +
    `<path class="lv" d="${wave}V${BASE}" /><line class="axis" x2="${w}" y1="${BASE}" y2="${BASE}" />${marks}`;
  const [count, left] = lane.querySelectorAll('output');
  count.textContent = slots.filter(s => s.awake).length;
  left.textContent = slots.at(-1).level;
  svg.setAttribute('aria-label', `通知 ${count.textContent} 次，最后缓冲区剩 ${left.textContent} 字节`);
}

function render() {
  lanes.forEach(draw);
  buttons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.chunk) === chunk)));
}
buttons.forEach(b => b.addEventListener('click', () => {
  chunk = Number(b.dataset.chunk);
  render();
}));
new ResizeObserver(render).observe(root);
render();
</script>
```

这两个名字是从电路里借来的，对照图很好理解。LT 看的是折线的高度，只要非零就报；ET 看的是往上跳变的那一下，跳一次报一次。

看 ET 那一行，60 字节底下压着一段“睡”，数据明明留在缓冲区里，线程却挂在 `epoll_wait()` 里不动了。图里后来能接着读，是因为对端又发了第二批 100 字节才触发通知。可如果对端发完请求就在等回复、不会再发数据，那一下跳变永远不会来，结果就是程序等通知、对端等回复，两边干等。图的右半段就是这样，第二批之后没再收到新数据，120 字节一直压到最后。ET 下最容易踩的坑就是这个。

把按钮切到“读到 EAGAIN”，两行就一致了。用 ET 时，每次收到通知都得循环读到读空为止：

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

ET 必须配非阻塞 socket，原因就在这个循环里。最后一次 `read()` 注定读不到数据，阻塞 socket 会在这里一直卡住，线程又回到了开头的问题。

落到内核里，LT 和 ET 只差一步。`epoll_wait()` 把就绪 fd 报给程序之后，LT 会把它重新放回就绪列表，下一轮再查一眼，还有数据就接着报，没了才移除；ET 不放回去，要等新数据到来、钩子再响一次才回到列表。

既然容易出错，为什么还要用 ET？它的好处在“暂时不处理”的场景才明显，最典型的是可写事件 `EPOLLOUT`。发送缓冲区几乎总有空位，LT 下只要挂着 `EPOLLOUT`，每次 `epoll_wait()` 都立刻返回，线程就会空转。所以 LT 通常要等发不出数据时才登记，发完马上去掉，一来一回都是 `epoll_ctl()` 系统调用。ET 只在刚登记和缓冲区从满变成可写时通知一次，`EPOLLOUT` 可以一直留着。

代价是每次都得读干净，而且还有个不太起眼的问题：如果某条连接数据源源不断，“读到 `EAGAIN`”的循环可能一直退不出来，别的连接都得等它。严谨的服务器会给单次读取设个上限，到了就先处理别的连接，把这条记进自己的待办队列回头再读。

实际项目里，Nginx 的网络连接用 ET，Redis 和 libuv（Node.js 底层）用的是默认 LT。刚开始写事件循环先用 LT 更稳妥，漏读一次顶多晚一轮处理。

## 拼成一个最小的 echo 服务器

把前面这些拼起来，就是一个最小的 echo 服务器，收到什么原样发回去。下面用的是默认的 LT：

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

监听 socket `lfd` 也登记进去了，它可读代表有新连接排队。每轮只 `accept4()` 一个没关系，LT 下没接完的下一轮还会报，每次只读 4096 字节也是同理。如果换成 ET，这两处都得包进循环，做到 `EAGAIN` 为止。

哪怕用 LT，所有 socket 也都要设成非阻塞。内核偶尔会先报了可读、真去 `read()` 时数据却没了，`select` 的手册里就举过例子，比如收到的包校验和不对被内核丢掉了。阻塞 `read()` 碰上这种情况就会卡死。

`EPOLLERR` 和 `EPOLLHUP` 不用登记也会上报。上面没单独判断它们，因为出错或断连时 `read()` 会返回 -1 或 0，一样走到 `close()`。`close()` 之后，这条连接在 epoll 里的登记会自动移除，前提是没有别的 fd 指向同一个 socket（比如 `dup()` 出来的，或 `fork()` 后子进程手里的那份）。

代码里偷懒的地方是 `write()`。对方收得慢、发送缓冲区满了，`write()` 可能只写进一部分或直接返回 `EAGAIN`。真实服务器得把没写完的存起来，登记 `EPOLLOUT` 等可写再接着发，发完立刻去掉 `EPOLLOUT`，免得 LT 下线程空转。

`epoll_wait()` 最后一个参数是毫秒级超时，-1 表示一直等。事件循环里的定时器通常就靠它实现：每轮算出离最近定时器还有多久，拿这个数当超时，到点醒来把定时器跑掉。Redis 和 libuv 都是这么做的。

Redis、Nginx、Node.js 的核心都是这个循环：调用 `epoll_wait()` 等事件，醒来分发处理，处理完继续等。这种模式叫 **Reactor**，一个循环统一等事件，再分给对应处理函数。Go 写起来虽然像一条连接一个 goroutine 阻塞读写，底层运行时一样在用 `epoll` 替你等。

## 利用多核 CPU

单个事件循环跑在一个线程里，最多用上一个 CPU 核。要发挥多核，常见做法是开多个线程或进程，各自跑一个事件循环、各管一批连接。Nginx 就是这样，每个 worker 进程有自己的 epoll 实例。

多个 worker 都要接新连接时，最直接的办法是共用一个监听 socket 并各自登记进 epoll。这会碰上**惊群**：来一个新连接，所有 worker 都被唤醒，`accept4()` 却只有一个抢得到，其余全白醒一趟。这也是监听 socket 必须设非阻塞的原因之一，没抢到的 worker 拿到 `EAGAIN`，不会卡在 `accept4()` 里。

解法主要有两种。一是登记监听 socket 时加上 `EPOLLEXCLUSIVE`（Linux 4.5 起），新连接来了内核只唤醒其中一个或少数几个。二是开 `SO_REUSEPORT`（Linux 3.9 起），每个 worker 各建一个监听 socket 绑到同一端口，由内核把新连接分给它们，谁也不用抢。

还有一种多线程写法是几个线程共同 `epoll_wait()` 同一个 epoll 实例。这时同一条连接的事件可能先后分给两个线程，一个还在读，新数据又到了，另一个也被唤醒来读，数据顺序就乱了。登记时加上 `EPOLLONESHOT` 可以避免：fd 通知一次后就停用，等处理它的线程忙完，再用 `EPOLL_CTL_MOD` 重新打开。

## 通知“就绪”，还是通知“完成”

`epoll` 通知的只是“可以读了”，把数据从内核拷到用户缓冲区，还得程序自己调 `read()` 完成。所以 I/O 多路复用仍然属于同步 I/O，只是等待时不再卡死在某一条连接上。

另一种思路是把“读这条连接”整件事交给内核，通知回来时数据已经在用户缓冲区里了。这叫异步 I/O，Windows 的 IOCP 和 Linux 5.1 起的 `io_uring` 都是这样。

## 参考资料

- Linux man-pages：[select(2)](https://man7.org/linux/man-pages/man2/select.2.html)、[poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html)、[epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html)、[epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html)、[epoll_wait(2)](https://man7.org/linux/man-pages/man2/epoll_wait.2.html)。
- Dan Kegel. [The C10K problem](http://www.kegel.com/c10k.html)。
