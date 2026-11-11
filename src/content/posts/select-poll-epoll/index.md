---
title: "select、poll、epoll：一个线程怎么等多个连接"
description: "一个线程守着几千条连接，不能卡在任何一条上。select、poll、epoll 都请内核帮忙盯着，差别在每一轮要查多少。"
pubDate: 2026-11-02
updatedDate: 2026-11-11
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

`conns` 里存的是每条连接的 fd（文件描述符）。Linux 里打开的文件、建立的连接，在程序里都用一个小整数指代，`read()` 拿着它就知道该从哪条连接读。

问题出在 `read()` 默认会阻塞：连接上没数据，它就不返回。A 连上来以后一句话不说，线程就停在 `read(A)` 上。这时 B 发来消息，没人理；C、D 也一样，全得等 A 先开口。

几千条连接里总有不说话的，线程不能停在任何一条上。

## 两个笨办法

第一个，一条连接配一个线程。`read()` 卡住也只卡它自己。连接少的时候这样最省心，到了几千上万条就不划算了：每个线程要一段自己的栈（Linux 默认按 8 MB 预留，碰过的页才真占内存），内核还得在这么多线程之间来回切换，而它们绝大部分时间只是在等。一台机器怎么同时撑住一万条连接，Dan Kegel 在 1999 年专门写过一篇文章，这就是 C10K 问题。

第二个，把 socket 设成非阻塞。socket 是连接在内核里的那一头，fd 指的就是它：

```c
fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);
```

这以后，没数据时 `read()` 不再等，立刻返回 -1，`errno` 是 `EAGAIN`，意思是“现在没有，待会儿再来”。线程可以挨个试过去，谁有数据处理谁。

不会卡住了，可绝大多数都是白试。每试一次还是一趟系统调用，要从程序陷进内核再出来，比普通的函数调用贵得多。哪怕所有连接都一声不吭，这个循环也在全速空转，占满一个 CPU 核。

## 让内核帮忙盯着

数据从网卡进来，是内核先收到，放进对应 socket 的接收缓冲区。哪条连接有数据，内核本来就知道。

那就换个分工：线程把关心的连接交给内核，自己睡下；哪条连接来了数据，内核把线程叫醒，告诉它是哪几条。一个线程同时等很多条连接，这叫 **I/O 多路复用**。select、poll、epoll 干的都是这件事，出现有先后，后一个补前一个的毛病。

把三种等法放到同一条时间线上。A、B、C 三条连接，B 和 C 早早发了消息，A 拖到第 9 格才开口：

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

第三行就是后面三个接口要做到的事：没消息的时候线程睡着，不占 CPU；一醒来就有数据可读。

内核报的是“就绪”，意思是现在去读或者去写，不会被卡住：

- 可读：接收缓冲区里有数据。对方关了连接也算，这时 `read()` 会立刻返回 0。监听 socket（服务器专门用来接新连接的那一个）上有新连接在排队，同样算可读。
- 可写：发送缓冲区还有空位。

它们只管通知，数据还是程序自己调 `read()`、`write()` 去读写。

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

第一个参数是最大的 fd 加一，告诉内核查到第几位为止。后面三个 `NULL` 依次是监听可写的位图、监听异常的位图和超时时间，超时传 `NULL` 就是一直等。

调用时，这张位图被拷进内核，内核去查每个标了 1 的 fd；一个都没就绪，线程睡下。等到有 fd 就绪，`select()` 把结果写回同一张位图再返回：只有就绪的那几位还是 1。

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

调用前想监听 3、4、6、9 号，返回后只剩就绪的 6 号。想监听谁，这份信息被结果盖掉了，所以每一轮开头都得重新填。返回值只说有几个就绪，具体是哪几个，还得挨个 `FD_ISSET`。

还有个硬限制：glibc 里的 `fd_set` 固定 1024 位，只能放编号 0 到 1023 的 fd。这个数写死在头文件里，自己重新定义 `FD_SETSIZE` 也改不了。注意限制的是**编号**，跟监听几个没关系。Linux 分配 fd 总是挑最小的空号，进程里同时开着的文件和连接一多，新连接的编号就会超过 1023；哪怕只想监听这一条也放不进去，硬放就是越界写内存。select 的手册里自己都写着：新程序应该用 poll 或 epoll。

## poll：位图换成数组

poll 改用一个数组，每一项是一个 `struct pollfd`：

```c
struct pollfd {
    int   fd;       // 哪个 fd
    short events;   // 关心什么：POLLIN 可读，POLLOUT 可写
    short revents;  // 发生了什么，由内核填
};
```

关心什么、发生了什么，分成了两个字段。内核只写 `revents`，`events` 不会被盖掉，数组填好一次就能一直用。数组多长由程序定，1024 的限制也没了：

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

接口顺手了，每一轮要干的活却一点没少。

## 每一轮都从头查

先说内核怎么叫醒一个睡着的线程。每个 socket 都带着一个等待队列，上面每一项记着“这里有动静时要做什么”，最常见的一种是“叫醒某个线程”。数据到了，内核把它放进接收缓冲区，再把队列上的每一项执行一遍。往队列上加一项，下面叫挂一个钩子。阻塞的 `read()` 就是在一个 socket 上挂好钩子再睡下；select 和 poll 是给每个 socket 都挂一个。

线程在 `select()` 或 `poll()` 里睡一觉再醒来，这一轮里内核和程序前后做了这些事：

1. 把整张位图或整个数组从程序拷进内核。
2. 挨个查每个 fd 有没有数据，顺手在它的 socket 上挂一个钩子：有动静了叫醒我。
3. 一个都没有，线程睡下。
4. 某条连接来了数据，它上面的钩子把线程叫醒。钩子只管叫醒，不记是哪条连接叫的。
5. 线程只好从头再查一遍，找出是谁。
6. 把钩子一个个摘掉，结果拷回程序。
7. 回到程序里，再挨个看一遍结果。

一万条连接，这一轮只有一条来了数据，也要把一万个 fd 前前后后过上五遍。下一轮从第 1 步重来。连接越多，每一轮越慢，而大多数连接其实什么也没发。

## epoll：登记一次，只拿就绪的

这里面有两件事是每轮白做的：监听名单重新交一遍，钩子挂了又摘。epoll 把“登记”和“等待”拆成不同的调用，这两件事就都只做一次：

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

`struct epoll_event` 里有两样东西。`events` 是关心的事件；`data` 留给程序自己用，登记时填什么，事件回来时就原样带着什么。这里填的是 fd，真实的服务器更常填一个指向连接对象的指针，拿到事件就直接找到这条连接的状态。`data` 是个 union，fd 和指针只能填一个。

监听名单一直记在 epoll 实例里（一棵红黑树，增删查都快），之后每一轮不用再传。

钩子也是登记时挂好，之后一直挂着。这回钩子上记的是 epoll 自己的一小段代码，它知道自己挂在哪条连接上：数据来了，先把这条连接记进实例里的一个**就绪列表**，再叫醒等在 `epoll_wait()` 上的线程。线程醒来不用从头查，列表里有谁，就把谁拷给程序。

8 条连接都登记过了，9 号和 6 号先后来了数据：

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

`epoll_ctl()` 只改监听名单，`epoll_wait()` 只看就绪列表，两头靠钩子连着。另外 6 条连接没来数据，这一轮里从头到尾没人碰过它们。

把一轮里碰过的 fd 数出来，和 select、poll 放在一起。32 条连接，线程睡着的时候其中一条来了数据：

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

左边不管来几条数据都是五整行；换成一万条连接，每行就是一万格。右边那行登记只在连接刚建立时做一次，之后每一轮来几条碰几条。选“全部”，右边也排满了一行：每条连接都很忙的时候，epoll 省下的只是那几遍重复，量级上和 poll 一样了。

`epoll_wait()` 一次最多返回 `maxevents` 个（上面是 64）。就绪的更多，剩下的留在列表里，下一次再取。

常有人说 epoll 快是因为用 mmap 和内核共享了内存，省掉了拷贝。没有这回事：就绪事件照样要从内核拷给程序，只是只拷就绪的那几个。

## 放在一起比一比

| | select | poll | epoll |
| --- | --- | --- | --- |
| 怎么告诉内核监听谁 | 每轮传一张位图 | 每轮传整个数组 | 登记一次，变了再改 |
| 内核每轮查多少 | 全部 | 全部 | 只看就绪列表 |
| 程序怎么找就绪的 | 挨个 `FD_ISSET` | 挨个看 `revents` | 直接用返回的事件 |
| fd 的限制 | 编号必须小于 1024 | 没有固定上限 | 没有固定上限 |
| 平台 | POSIX | POSIX | 只有 Linux |

没有固定上限，也还受进程能打开的 fd 数（`ulimit -n`）和内存约束。

epoll 赢在连接多、同一时刻只有少数在说话的场合，挂着大量长连接的服务器就是这样。每条连接都很忙的时候，优势就像上面那张图里一样缩水了。只盯三五个 fd 的话用哪个都一样快，poll 不用建实例，也不用 `epoll_ctl()`，写起来反而省事。

还有两个限制。普通的磁盘文件不能交给 epoll，`epoll_ctl()` 会返回 `EPERM`：在内核看来普通文件随时可读可写，等它没有意义。另外 epoll 只有 Linux 有，macOS 和 BSD 上对应的是 kqueue；Windows 上是 IOCP，思路不太一样，最后一节会说到。

## LT 和 ET：提醒几次

epoll 的通知有两种方式。默认是 **LT（水平触发）**：只要 fd 还处在就绪状态，每次 `epoll_wait()` 都会报告它。登记时加上 `EPOLLET` 就换成 **ET（边缘触发）**：只在有新动静的时候报告一次，比如又到了一批数据。

差别出在数据没读完的时候。对方发来 100 字节，程序收到通知只读走 40，缓冲区里还剩 60。再调 `epoll_wait()`，LT 会接着报这个 fd；ET 不会，这 60 字节算不上新动静。

把接收缓冲区里的字节数沿时间画出来。对方先后发来两次 100 字节，程序每收到一次通知就读一回，每回只读 40 字节：

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
    marks += `<rect class="nap" x="${a * dx + 2}" y="${LANE}" width="${(b - a) * dx - 4}" height="16" rx="8" />`;
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

名字是从电路里借来的，对着这张图正好能看懂。LT 看的是这条线的高度，不是 0 就报；ET 看的是往上跳的那一下，跳一次报一次。

ET 那一行里，60 字节底下压着一段“睡”：线程睡在 `epoll_wait()` 里，数据躺在缓冲区里。图上是对方后来又发了 100 字节，才把线程叫起来。如果对方发完请求就等着回复，不会再发，那一下往上跳就永远不来：程序等通知，对方等回复，两边干等。图的右半截就是这个下场：第二批之后再没有数据来，120 字节一直压到最后。ET 下最常见的错就是这个。

把按钮换到“读到 EAGAIN”，两行就一样了。用 ET，每次收到通知都得这样一口气读到读不动为止：

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

ET 要配非阻塞 socket，原因就在这个循环里：最后那一次 `read()` 注定读不到数据，阻塞的 socket 会让它一直等下去，线程又卡住了，回到了开头的问题。

在内核里，两者只差一步。`epoll_wait()` 把一个 fd 报告给程序以后，LT 会把它放回就绪列表，下一次调用时再查一眼，还有数据就接着报，没有了才拿掉；ET 不放回去，要等新数据到了、钩子再响一次，它才回到列表里。

那何必用 ET？它的好处在“故意先不处理”的时候才显出来，最典型的是可写事件。发送缓冲区几乎总有空位，LT 下只要登记着 `EPOLLOUT`，每次 `epoll_wait()` 都立刻返回，线程又空转起来了。所以得等有数据发不出去时才登记，发完马上去掉，一来一回都是 `epoll_ctl()` 系统调用。ET 只在登记时和缓冲区从写不进变成能写的那一下报告，`EPOLLOUT` 可以一直挂着。

代价是每次都得读干净，漏一次就是上面那种干等。还有个不那么显眼的问题：某条连接的数据源源不断，“读到 `EAGAIN`”的循环就一直出不来，别的连接全得等它。认真写的服务器会给每次读设个上限，到了就先去照顾别的连接，把这条记进自己的待办，回头接着读。

Nginx 的连接用的是 ET，Redis 和 libuv（Node.js 底下那一层）用的是默认的 LT。刚开始写事件循环先用 LT，漏读一次的后果只是晚一轮处理。

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

监听 socket 也登记了进去。它可读，说明有新连接在排队。一轮只 `accept4()` 一个没关系：用的是 LT，没接完的下一轮还会报。每次只读 4096 字节也是同样的道理。换成 ET，这两处都得改成循环，一直做到 `EAGAIN`。

所有 socket 都设成了非阻塞，用 LT 也一样。内核偶尔会报了可读、真去读时数据却没了，select 的手册里举的例子是收到的包校验和不对，被丢掉了。阻塞的 `read()` 碰上这种情况就卡住。

`EPOLLERR` 和 `EPOLLHUP` 不用登记也会报。上面没单独处理它们：出了错或者连接断了，`read()` 会返回 -1 或 0，一样走到 `close()` 那一行。`close()` 之后，这条连接在 epoll 里的登记会自动删掉，前提是没有别的 fd 还指着同一个 socket，比如 `dup()` 出来的，或者 `fork()` 之后子进程手里的那份。

偷懒的地方是 `write()`。对方收得慢，发送缓冲区满了，`write()` 就只写进去一部分，或者干脆返回 `EAGAIN`。真实的服务器得把没写完的存起来，登记 `EPOLLOUT`，等可写了接着写；写完记得把 `EPOLLOUT` 去掉，原因上一节说过，LT 下留着它线程会空转。

`epoll_wait()` 的最后一个参数是超时，单位毫秒，-1 是一直等。事件循环里的定时器就靠它：每一轮算出离最近的定时器还有多久，拿这个数当超时，到点醒来把定时器跑掉。Redis 和 libuv 都是这么做的。

Redis、Nginx、Node.js 的核心都是这样一个循环：`epoll_wait()` 等事件，来一个处理一个，处理完回去接着等。这种写法叫 Reactor，一个循环负责等，等到了再分给对应的处理函数。Go 写起来是一条连接一个 goroutine、阻塞着读，底下也是运行时在替你用 epoll 等。

## 用上多个核

一个循环跑在一个线程里，只用得上一个 CPU 核。想用上多核，常见的做法是开几个线程或进程，每个各跑一个事件循环、各管一批连接。Nginx 就是这样，每个 worker 进程都有自己的 epoll 实例。

几个 worker 都要接新连接。最直接的办法是共用一个监听 socket，各自登记进自己的 epoll。这样会碰上**惊群**：来一个新连接，所有 worker 都被叫醒，`accept4()` 却只有一个抢得到，其余的白醒一趟。监听 socket 要设成非阻塞，这也是一个原因：没抢到的 worker 拿到的是 `EAGAIN`，不会卡在 `accept4()` 里。

解法有两种。一是登记监听 socket 时加上 `EPOLLEXCLUSIVE`（Linux 4.5 起），来了连接，内核只叫醒其中一个或少数几个。二是开 `SO_REUSEPORT`（Linux 3.9 起），每个 worker 各开一个监听 socket，绑在同一个端口上，新连接由内核分给它们，谁也不跟谁抢。

还有一种做法，是几个线程一起 `epoll_wait()` 同一个 epoll 实例。这时同一条连接的事件可能先后交给两个线程：一个还在读，新数据又到了，另一个也被叫醒来读，两边读到的数据就乱了。登记时加上 `EPOLLONESHOT` 可以避免：fd 报告一次就停用，处理它的线程忙完了，再用 `EPOLL_CTL_MOD` 重新打开。

## 就绪，还是完成

epoll 说的是“可以读了”，读还得自己来：数据从内核拷到程序的缓冲区，是程序调 `read()` 做的。所以 I/O 多路复用仍然算同步 I/O，只是等的时候不再卡在某一条连接上。

另一种模型是把“读这条连接”整件事交给内核，通知来的时候，数据已经在程序的缓冲区里了。这叫异步 I/O，Windows 的 IOCP 是这个思路，Linux 5.1 起的 io_uring 也是。

## 参考资料

- Linux man-pages：[select(2)](https://man7.org/linux/man-pages/man2/select.2.html)、[poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html)、[epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html)、[epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html)、[epoll_wait(2)](https://man7.org/linux/man-pages/man2/epoll_wait.2.html)。
- Dan Kegel. [The C10K problem](http://www.kegel.com/c10k.html)。
