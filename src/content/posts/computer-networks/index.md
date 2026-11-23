---
title: "互联网是怎么连起来的"
description: "从两台电脑间的一根网线出发，顺着每一层遇到的新问题，看看交换机、IP、路由、TCP、DNS 和 HTTPS 怎么把整个互联网拼起来。"
pubDate: 2026-10-24
updatedDate: 2026-11-11
tags: ["计算机网络", "计算机基础"]
---

在深圳访问一台架在美国的服务器，用 `traceroute` 能把沿途经过的节点逐个列出来（下面换成了示例地址）：

```text
$ traceroute -q 1 www.example.com
traceroute to www.example.com (203.0.113.10), 30 hops max, 60 byte packets
 1  192.168.1.1  1.1 ms
 2  100.64.0.1  3.9 ms
 3  10.47.0.1  4.6 ms
 4  *
 5  198.51.100.17  7.2 ms
 6  198.51.100.33  9.8 ms
 7  198.51.100.65  31.4 ms
 8  198.51.100.97  33.0 ms
 9  203.0.113.129  178.6 ms
10  203.0.113.141  180.2 ms
11  203.0.113.161  183.5 ms
12  *
13  203.0.113.10  185.1 ms
```

每一行是路上的一台路由器，后面是发包过去再返回的往返时间。第 8 跳到第 9 跳突然多了 145 毫秒，因为数据包正是在这里跨过了太平洋。

这 12 台路由器里没有哪一台知道完整路线。每台收到包后只看目的地址，查表决定下一跳交给谁，发出去就不管了。互联网没有总控中心，也没有一张全网地图，几十亿台设备就靠这种接力连在一起。

这篇笔记从两台电脑间的一根网线开始，顺着每一步碰到的新问题，一层层往下理。

## 一根网线

两台电脑拉一根网线就能互相传数据。线上跑的都是 0 和 1 的比特流，只不过介质不同，网线里靠电压高低，光纤里靠光脉冲，Wi‑Fi 里靠无线电波变化。比特怎么编成物理信号属于物理层，这里不展开。

衡量一条线路最核心的是两个数。**带宽**是每秒能塞进线路的比特数，比如家里 500 Mbps 的宽带，就是每秒 5 亿个比特。**延迟**是一个比特从这头传到那头要多久。

拿公路来比，带宽像路有多宽，延迟像路有多长。路拓宽了，同时能跑的车多了，单辆车开到终点的时间却一点没少。

延迟的下限被光速锁死了。光在光纤里每秒跑约 20 万公里，1 毫秒 200 公里。深圳到美国西海岸的海底光缆一万多公里，单程 60 多毫秒，往返 130 毫秒上下。开头多出来的 145 毫秒大头就花在这里，带宽升再高也压不下去。

线上的比特是连续的一长串，接收方得知道一段数据从哪开始、到哪结束，中间有没有被干扰出错。所以数据会按块发送，一块叫一个**帧**，开头带约定标记，末尾附校验码，收到后重算一遍，对不上就整帧扔掉。

## 局域网与交换机

三台电脑两两拉线只要 3 根，可到了 50 台就要 1225 根。实际做法是把所有电脑都连到中间一台设备上统一转发，它就是**交换机**。

要定向转发就得知道谁是谁。每块网卡出厂时都烧录了一个全球唯一的编号，叫 **MAC 地址**，长 48 位，写成 6 个十六进制字节：

```text
3c:22:fb:91:0a:7e
```

前 3 个字节是厂商编号，后 3 个由厂商自己顺序分配。

每个帧开头都带着目的 MAC 和源 MAC。交换机收到一帧后，查表找到目的 MAC 对应的端口，只从那个口发出去。

这张表不需要手动配，是交换机在转发中自动学出来的。每收到一帧，它就记下“这个源 MAC 来自几号口”。如果目的 MAC 还没学过，就往除入口外的其他端口各发一份，这叫**泛洪**，地址匹配的那台收下，其余扔掉。

四台电脑接在同一台交换机上，初始状态是 A 刚给 C 发完第一帧：

```render html
<style>
  .sw { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .sw { --blue: #95bfdc; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .key b { margin-left: 6px; font-weight: 600; }
  .say { align-self: center; margin-left: 4px; color: var(--accent-ink); font-size: 13px; font-weight: 600; }
  .sw svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; user-select: none; -webkit-user-select: none; }
  .host { cursor: pointer; }
  .hit { fill: transparent; }
  .screen { fill: var(--bg-raised); stroke: var(--muted); stroke-width: 1.4; }
  .stand { fill: none; stroke: var(--muted); stroke-width: 1.4; }
  .host.src .screen { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
  .host.dst .screen { stroke: var(--blue); stroke-width: 2; }
  .host:hover .screen { stroke-width: 2; }
  .name { fill: var(--text); font-size: 16px; font-weight: 650; text-anchor: middle; dominant-baseline: central; }
  .mac { fill: var(--muted); font: 11.5px var(--font-mono); text-anchor: middle; }
  .wire { stroke: var(--rule-strong); stroke-width: 2; }
  .wire.hot { stroke: var(--accent); stroke-opacity: .55; }
  .box { fill: var(--surface); stroke: var(--rule-strong); }
  .lane { stroke: var(--rule-strong); }
  .port { fill: var(--bg); stroke: var(--muted); }
  .pnum { fill: var(--muted); font: 11px var(--font-mono); }
  .pkt { fill: var(--accent); }
  .badge { fill: var(--bg); stroke-width: 1.4; }
  .badge.ok { stroke: var(--accent); }
  .badge.no { stroke: var(--rule-strong); }
  .tick { fill: none; stroke: var(--accent-ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .cross { fill: none; stroke: var(--muted); stroke-width: 1.8; stroke-linecap: round; }
  .th { fill: var(--muted); font-size: 12px; }
  .td { fill: var(--text); font: 13px var(--font-mono); }
  .slot { stroke: var(--rule-strong); stroke-dasharray: 2 3; }
  .fresh { fill: var(--accent-soft); }
  .fresh-text { fill: var(--accent-ink); }
</style>
<section class="sw" aria-label="交换机一边转发，一边记下每个 MAC 在哪个口">
  <div class="keys">
    <button type="button" class="key send">发送<b></b></button>
    <button type="button" class="key clear">清空表</button>
    <output class="say">没学过 C：泛洪</output>
  </div>
  <svg role="img" aria-label="四台电脑连在交换机的四个口上，交换机里有一张 MAC 表"></svg>
</section>
<script>
const NAMES = ['A', 'B', 'C', 'D'];
const MACS = ['…:a1', '…:b2', '…:c3', '…:d4'];
// 预设的发送顺序；首帧停在第一帧发完的样子
const SCRIPT = [[0, 2], [2, 0], [0, 2], [3, 1], [1, 3]];
const DOWN = 420, UP = 420, ROW = 21;
const root = document.querySelector('.sw'), svg = root.querySelector('svg');
const [sendKey, clearKey] = root.querySelectorAll('.key');
const say = root.querySelector('.say');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// next 是按钮上下一次要发的；shown 是图里正在演示或刚演示完的那一次
let width = 0, table = [0], fresh = -1, step = 1, picking = false;
let next = SCRIPT[1].slice(), shown = SCRIPT[0].slice();
let run = null, marks = [[1, false], [2, true], [3, false]], lit = [0, 1, 2, 3];

function geo() {
  const n = NAMES.length, mw = Math.min(58, width / n - 22), mh = Math.round(mw * .62);
  const hx = NAMES.map((_, i) => Math.round(width * (i + .5) / n));
  const top = 10, wireTop = top + mh + 32, sy = wireTop + 44;
  const left = hx[0] - mw / 2 - 6, right = hx.at(-1) + mw / 2 + 6;
  return { hx, mw, mh, top, wireTop, sy, mid: sy + 15, left, right, H: sy + 30 + 26 + ROW * NAMES.length + 10 };
}

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const across = (g, from, to) => 260 + Math.abs(g.hx[to] - g.hx[from]) * .9;

function draw(now) {
  const g = geo(), cx = (g.left + g.right) / 2, cw = Math.min(170, g.right - g.left - 40);
  let s = '';
  g.hx.forEach((x, i) => {
    s += `<line class="wire${lit.includes(i) ? ' hot' : ''}" x1="${x}" y1="${g.wireTop}" x2="${x}" y2="${g.sy}"/>`;
  });
  s += `<rect class="box" x="${g.left}" y="${g.sy}" width="${g.right - g.left}" height="${g.H - g.sy - 2}" rx="5"/>`;
  s += `<line class="lane" x1="${g.left}" x2="${g.right}" y1="${g.sy + 30}" y2="${g.sy + 30}"/>`;
  // 交换机里的 MAC 表：四个空位，学到一个填一个
  const ty = g.sy + 30 + 20;
  s += `<text class="th" x="${cx - cw / 2}" y="${ty}">MAC</text><text class="th" x="${cx + cw / 2}" y="${ty}" text-anchor="end">端口</text>`;
  NAMES.forEach((_, k) => {
    const y = ty + 6 + k * ROW, h = table[k];
    if (k === fresh) s += `<rect class="fresh" x="${cx - cw / 2 - 6}" y="${y}" width="${cw + 12}" height="${ROW}" rx="2"/>`;
    if (h === undefined) s += `<line class="slot" x1="${cx - cw / 2}" x2="${cx + cw / 2}" y1="${y + ROW - 4}" y2="${y + ROW - 4}"/>`;
    else s += `<text class="td${k === fresh ? ' fresh-text' : ''}" x="${cx - cw / 2}" y="${y + 15}">${MACS[h]}</text><text class="td${k === fresh ? ' fresh-text' : ''}" x="${cx + cw / 2}" y="${y + 15}" text-anchor="end">${h + 1}</text>`;
  });
  g.hx.forEach((x, i) => {
    s += `<rect class="port" x="${x - 7}" y="${g.sy - 4}" width="14" height="8" rx="1.5"/><text class="pnum" x="${x + 11}" y="${g.sy - 8}">${i + 1}</text>`;
    const cls = i === shown[0] ? ' src' : i === shown[1] ? ' dst' : '';
    s += `<g class="host${cls}" data-i="${i}"><rect class="hit" x="${x - g.mw / 2 - 10}" y="0" width="${g.mw + 20}" height="${g.wireTop}"/>` +
      `<rect class="screen" x="${x - g.mw / 2}" y="${g.top}" width="${g.mw}" height="${g.mh}" rx="3"/>` +
      `<path class="stand" d="M${x} ${g.top + g.mh}v6M${x - 9} ${g.top + g.mh + 6}h18"/>` +
      `<text class="name" x="${x}" y="${g.top + g.mh / 2}">${NAMES[i]}</text>` +
      `<text class="mac" x="${x}" y="${g.top + g.mh + 24}">${MACS[i]}</text></g>`;
  });
  for (const [i, ok] of marks) {
    const x = g.hx[i] + g.mw / 2, y = g.top;
    s += `<circle class="badge ${ok ? 'ok' : 'no'}" cx="${x}" cy="${y}" r="9"/>` +
      (ok ? `<path class="tick" d="M${x - 4} ${y}l2.8 3 5.2-6"/>` : `<path class="cross" d="M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7"/>`);
  }
  if (run) s += packets(g, now - run.start);
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
}

function packets(g, t) {
  const box = (x, y) => `<rect class="pkt" x="${x - 9}" y="${y - 6}" width="18" height="12" rx="2"/>`;
  if (t < DOWN) return box(g.hx[run.src], lerp(g.wireTop, g.mid, t / DOWN));
  let s = '';
  for (const j of run.targets) {
    const a = across(g, run.src, j), u = t - DOWN;
    if (u < a) s += box(lerp(g.hx[run.src], g.hx[j], u / a), g.mid);
    else if (u < a + UP) s += box(g.hx[j], lerp(g.mid, g.wireTop, (u - a) / UP));
  }
  return s;
}

// 帧进了交换机：先记下源 MAC，再决定发往哪些口
function learn() {
  let k = table.indexOf(run.src);
  if (k < 0) k = table.push(run.src) - 1;
  fresh = k;
  const known = table.includes(run.dst);
  run.targets = known ? [run.dst] : NAMES.map((_, j) => j).filter(j => j !== run.src);
  lit = [run.src, ...run.targets];
  say.textContent = known ? `${NAMES[run.dst]} 在 ${run.dst + 1} 口：只发这一口` : `没学过 ${NAMES[run.dst]}：泛洪`;
}

function tick(now) {
  const g = geo(), t = now - run.start;
  if (t >= DOWN && !run.targets) learn();
  if (run.targets) {
    for (const j of run.targets) {
      if (!run.done.has(j) && t - DOWN >= across(g, run.src, j) + UP) {
        run.done.add(j);
        marks.push([j, j === run.dst]);
      }
    }
    if (run.done.size === run.targets.length) return finish();
  }
  draw(now);
  requestAnimationFrame(tick);
}

function send() {
  if (run || next[1] < 0) return;
  shown = next.slice();
  run = { src: next[0], dst: next[1], start: performance.now(), targets: null, done: new Set() };
  marks = [];
  lit = [run.src];
  keys();
  if (reduce) {
    learn();
    marks = run.targets.map(j => [j, j === run.dst]);
    return finish();
  }
  requestAnimationFrame(tick);
}

function finish() {
  run = null;
  step = (step + 1) % SCRIPT.length;
  next = SCRIPT[step].slice();
  keys();
  draw();
  setTimeout(() => { fresh = -1; if (!run) draw(); }, 900);
}

// 点一台定源，再点一台定目的并立刻发送
function pick(i) {
  if (run) return;
  if (!picking || i === next[0]) {
    picking = true;
    next = [i, -1];
    shown = [i, -1];
    marks = [];
    lit = [];
    say.textContent = '';
    keys();
    draw();
  } else {
    picking = false;
    next[1] = i;
    send();
  }
}

function keys() {
  sendKey.querySelector('b').textContent = `${NAMES[next[0]]} → ${next[1] < 0 ? '?' : NAMES[next[1]]}`;
  sendKey.disabled = !!run || next[1] < 0;
  clearKey.disabled = !!run || !table.length;
}

svg.addEventListener('click', e => {
  const host = e.target.closest('.host');
  if (host) pick(Number(host.dataset.i));
});
sendKey.addEventListener('click', send);
clearKey.addEventListener('click', () => {
  table = [];
  shown = [-1, -1];
  marks = [];
  lit = [];
  say.textContent = '';
  keys();
  draw();
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(performance.now()); }
}).observe(svg);
keys();
</script>
```

第一帧发出去时表里还没有 C，所以泛洪了，B 和 D 白收了一份。但交换机同时记下了 A 在 1 号口，接着 C 给 A 回包时，这一帧就会只从 1 号口出去。

目的 MAC 写成 `ff:ff:ff:ff:ff:ff` 的是**广播帧**，交换机永远泛洪，局域网里每台机器都能收到，后面的 ARP 和 DHCP 都要用到它。表里的条目几分钟不刷新就会过期，电脑换了端口也能重新学到。

Wi‑Fi 也在这一层。无线路由器里的无线接入点（AP）干的就是交换机的活，只是网线换成了无线电。

## 为什么交换机连不了全世界

能不能把全世界的电脑用交换机一级级串起来？这行不通。

因为 MAC 地址是扁平的、不含位置信息。它像身份证号，虽然唯一，但光看号码看不出这块网卡眼下在哪。交换机只能逐条记录，全世界几十亿块网卡，难道每台交换机都记几十亿行？而且每次碰到没见过的地址，泛洪还会扩散到整个地球。

寄信就不存在这个问题。信封上写的“广东省 深圳市 南山区 某路 某号”是分层的，北京分拣中心看到“广东省”就知道往南发，到了深圳再看区，到了区再看街道，没有任何分拣中心需要认识全国每一户人家。

互联网借用了同样的分层思路。一台交换机只管一小片区域（一间屋子或一层楼），叫一个**网络**，不同网络之间用**路由器**连接。地址也换成分层的，前半段说明在哪个网络，后半段说明是网络里的哪台主机，这就是 IP 地址。

## IP 地址：前半段表示网络

IPv4 地址一共 32 位，每 8 位写成十进制并用点隔开，比如 `192.168.1.23`。

前多少位算网络号要单独标明。`192.168.1.23/24` 表示前 24 位是网络号、后 8 位是主机号。前 24 位相同的都在同一个网络里，从 `192.168.1.0` 到 `192.168.1.255` 共 256 个地址。老写法叫子网掩码，把前 24 位置 1、后 8 位置 0，写成 `255.255.255.0`，意思一样。

用上 IP 后，数据前面会多出一个写着源 IP 和目的 IP 的包头，合起来叫一个**包**。包没法直接上线，发送时还得装进帧里。帧头的 MAC 管当前这段链路交给谁，包头的 IP 管最终去哪。

电脑发包前，先拿自己的网络前缀和目的 IP 比对。前缀一致说明在同一个网络里，直接发给对方，不一致就交给**默认网关**，也就是连着外网的那台路由器：

```render html
<style>
  .pf { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .pf { --blue: #95bfdc; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font: 13.5px var(--font-mono); cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .pf svg { display: block; width: 100%; height: auto; margin-top: 14px; overflow: visible; }
  .lbl { fill: var(--muted); font-size: 12.5px; dominant-baseline: central; }
  .dec { fill: var(--text); font: 500 14px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .dot { fill: var(--muted); font: 14px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .bit { font: 13px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .bit.net { fill: var(--text); }
  .bit.host { fill: var(--faint); }
  .bit.diff { fill: var(--bg); font-weight: 700; }
  .sq.net { fill: var(--text); }
  .sq.host { fill: var(--faint); }
  .sq.diff { fill: var(--bg); }
  .zero.net { fill: none; stroke: var(--text); stroke-opacity: .5; }
  .zero.host { fill: none; stroke: var(--faint); stroke-opacity: .6; }
  .zero.diff { fill: none; stroke: var(--bg); }
  .band { fill: var(--accent-soft); }
  .hit { fill: var(--accent); }
  .cut { stroke: var(--accent); stroke-width: 2; }
  .len { fill: var(--accent-ink); font: 600 14px var(--font-mono); text-anchor: middle; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 20px; margin-top: 10px; }
  .ctl { display: flex; align-items: center; gap: 12px; flex: 1 1 220px; color: var(--muted); }
  .ctl output { min-width: 2.4em; color: var(--text); font: 600 14px var(--font-mono); }
  .ctl input { flex: 1; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .verdict { color: var(--text); font-size: 15px; font-weight: 600; }
  .verdict.far { color: var(--blue); }
</style>
<section class="pf" aria-label="拿前缀比较两个 IP 地址，决定直接发还是交给网关">
  <div class="seg" role="group" aria-label="目的地址"></div>
  <svg role="img"></svg>
  <div class="foot">
    <label class="ctl"><span>前缀</span><output></output><input type="range" min="8" max="30" value="24" aria-label="前缀长度"/></label>
    <span class="verdict" aria-live="polite"></span>
  </div>
</section>
<script>
const ME = [192, 168, 1, 23];
const TARGETS = [[192, 168, 1, 200], [192, 168, 3, 7], [203, 0, 113, 10]];
const root = document.querySelector('.pf'), svg = root.querySelector('svg'), slider = root.querySelector('input');
let target = 1, width = 0;

const bits = ip => ip.flatMap(o => Array.from({ length: 8 }, (_, k) => (o >> (7 - k)) & 1));
const mask = n => [0, 1, 2, 3].map(k => 255 & (0xff00 >> Math.min(8, Math.max(0, n - 8 * k))));

function render() {
  const n = Number(slider.value), narrow = width < 460;
  const lw = narrow ? 34 : 46, sep = narrow ? 8 : 12;
  const c = Math.min(20, Math.floor((width - lw - 3 * sep) / 32)), digits = c >= 11;
  const x = i => lw + i * c + Math.floor(i / 8) * sep;
  const rowH = 46, top = 26, H = top + 3 * rowH;
  const rows = [['本机', ME], ['掩码', mask(n)], ['目的', TARGETS[target]]];
  const a = bits(ME), b = bits(TARGETS[target]);
  const diff = i => i < n && a[i] !== b[i];
  const cut = n % 8 ? x(n) : x(n) - sep / 2;
  let s = '';
  // 网络号那一段打底色
  for (let k = 0; k < 4; k++) {
    const from = 8 * k, to = Math.min(n, 8 * k + 8);
    if (to > from) s += `<rect class="band" x="${x(from)}" y="${top - 2}" width="${x(to - 1) + c - x(from)}" height="${3 * rowH - 6}" rx="2"/>`;
  }
  rows.forEach(([name, ip], r) => {
    const y = top + r * rowH, yb = y + 26, bs = bits(ip);
    s += `<text class="lbl" x="0" y="${yb}">${name}</text>`;
    ip.forEach((o, k) => {
      s += `<text class="dec" x="${x(8 * k) + 4 * c}" y="${y + 6}">${o}</text>`;
      if (k) s += `<text class="dot" x="${x(8 * k) - sep / 2}" y="${y + 6}">.</text>`;
    });
    bs.forEach((v, i) => {
      const kind = r !== 1 && diff(i) ? 'diff' : i < n ? 'net' : 'host', cx = x(i) + c / 2;
      if (kind === 'diff') s += `<rect class="hit" x="${x(i) + .5}" y="${yb - 10}" width="${c - 1}" height="20" rx="2"/>`;
      if (digits) s += `<text class="bit ${kind}" x="${cx}" y="${yb}">${v}</text>`;
      else if (v) s += `<rect class="sq ${kind}" x="${cx - 2.5}" y="${yb - 5}" width="5" height="10" rx="1"/>`;
      else s += `<rect class="zero ${kind}" x="${cx - 2}" y="${yb - 4.5}" width="4" height="9" rx="1"/>`;
    });
  });
  s += `<line class="cut" x1="${cut}" x2="${cut}" y1="${top - 8}" y2="${H - 6}"/><text class="len" x="${cut}" y="${top - 14}">/${n}</text>`;
  svg.setAttribute('viewBox', `0 -4 ${width} ${H + 2}`);
  svg.innerHTML = s;
  const same = !a.slice(0, n).some((v, i) => v !== b[i]);
  const verdict = root.querySelector('.verdict');
  verdict.textContent = same ? '同一个网络 · 直接发' : '不在一个网络 · 交给网关';
  verdict.classList.toggle('far', !same);
  root.querySelector('output').textContent = '/' + n;
  svg.setAttribute('aria-label', `${ME.join('.')}/${n} 和 ${TARGETS[target].join('.')}：${verdict.textContent}`);
}

const seg = root.querySelector('.seg');
TARGETS.forEach((ip, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = ip.join('.');
  b.addEventListener('click', () => {
    target = i;
    seg.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i)));
    render();
  });
  b.setAttribute('aria-pressed', String(i === target));
  seg.append(b);
});
slider.addEventListener('input', render);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

主机号全 0 代表网络本身，全 1 是网络广播地址，都不分给机器，所以一个 `/24` 可用的是 254 个。

就算可以直接发，也得先知道对方的 MAC，交换机只认 MAC。从 IP 查 MAC 靠 **ARP**，主机在局域网里广播问“谁是 `192.168.1.1`，告诉 `192.168.1.23`”，只有 `192.168.1.1` 会单播回复自己的 MAC。发往网关的包也要走这一步，网关就在同一个局域网里，得先拿到它的 MAC 才能把帧送过去。查到的结果会缓存一阵，`ip neigh` 能看到：

```text
192.168.1.1 dev eth0 lladdr 3c:22:fb:91:0a:7e REACHABLE
```

电脑自己的 `192.168.1.23`、`/24` 和网关地址，通常是连网时用 **DHCP** 拿到的。刚连上时还没地址，只能先发广播：

```text
电脑   → 广播     DISCOVER   有谁能给我分个地址？
路由器 → 电脑     OFFER      192.168.1.23/24 给你，网关和 DNS 都找 192.168.1.1
电脑   → 广播     REQUEST    那我就用这个了
路由器 → 电脑     ACK        定了，租期一天
```

拿到的地址有租期，到期前要续租。换个 Wi‑Fi 等于进了另一个网络，设备会重新走一遍流程拿到新地址。

## 跨网转发：MAC 逐跳更换，IP 不变

目标不在本网络时，包就要经过一台台路由器。每台路由器至少连着两个网络，每个接口各有自己的 MAC 和 IP。

跨一跳的过程很直接：路由器收到一帧，拆掉帧头，看里面的目的 IP，查路由表决定下一跳，再套上新帧头发出去。一路下来，源 IP 和目的 IP 始终不变，外层帧头每过一跳都会换掉。

下面演示电脑隔着两台路由器给服务器发包。图里把包画成两层，外圈橙色是帧头，里面是 IP 包：

```render html
<style>
  .hp { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .hp { --blue: #95bfdc; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .hp svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .link { stroke: var(--rule-strong); stroke-width: 2; }
  .link.on { stroke: var(--text); }
  .dev { fill: var(--bg-raised); stroke: var(--muted); stroke-width: 1.4; }
  .glyph { fill: none; stroke: var(--muted); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
  .name { fill: var(--text); font-size: 13px; }
  .ip { fill: var(--muted); font: 11.5px var(--font-mono); }
  .m { fill: var(--faint); font: 12px var(--font-mono); dominant-baseline: central; }
  .m.src { fill: var(--accent-ink); font-weight: 600; }
  .m.dst { fill: var(--blue); font-weight: 600; }
  .wrap { fill: var(--accent); }
  .core { fill: var(--bg); stroke: var(--text); stroke-width: 1.6; }
  .frame { position: relative; margin-top: 20px; padding: 6px 0 8px; border: 1.5px solid var(--rule-strong); border-radius: 6px; }
  .tag { position: absolute; top: -10px; left: 8px; padding: 0 5px; background: var(--bg); color: var(--muted); font-size: 12px; line-height: 18px; }
  .grid { display: grid; grid-template-columns: 4.6em repeat(3, minmax(0, 1fr)); gap: 4px 6px; margin: 0 6px; padding: 0 6px; border: 1.5px solid transparent; }
  .packet { position: relative; margin-top: 14px; padding: 12px 6px 6px; border: 1.5px dashed var(--rule-strong); border-radius: 5px; }
  .hop { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 12.5px; white-space: nowrap; cursor: pointer; }
  .hop[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .rl { display: flex; align-items: center; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .c { display: flex; align-items: center; justify-content: center; min-height: 30px; padding: 2px 4px; border-radius: 3px; background: var(--surface); color: var(--text); font: 500 13px var(--font-mono); white-space: nowrap; transition: background-color .9s, color .9s; }
  .c.dst { color: var(--blue); }
  .c.src { color: var(--accent-ink); }
  .c.on { background: var(--accent-soft); }
  .c.wait { background: none; box-shadow: inset 0 0 0 1px var(--rule); }
  .c.flash { background: var(--accent); color: var(--bg); transition: none; }
  .c.all { grid-column: 2 / -1; }
  @media (prefers-reduced-motion: reduce) { .c { transition: none; } }
  @media (max-width: 420px) {
    .grid { grid-template-columns: 4.4em repeat(3, minmax(0, 1fr)); gap: 4px; margin: 0 4px; padding: 0 4px; }
    .packet { margin-top: 14px; padding: 12px 4px 4px; }
    .hop { font-size: 12px; }
    .c { font-size: 12.5px; }
  }
</style>
<section class="hp" aria-label="包经过两台路由器：每一段的帧头都换成这一段两头的 MAC，IP 包里的地址不变，只有 TTL 在减">
  <button type="button" class="key play">播放</button>
  <svg role="img"></svg>
  <div class="frame">
    <span class="tag">帧</span>
    <div class="grid">
      <span></span>
      <button type="button" class="hop" data-hop="0">电脑→R1</button>
      <button type="button" class="hop" data-hop="1">R1→R2</button>
      <button type="button" class="hop" data-hop="2">R2→服务器</button>
      <span class="rl">目的 MAC</span>
      <span class="c dst" data-k="dst" data-hop="0"></span>
      <span class="c dst" data-k="dst" data-hop="1"></span>
      <span class="c dst" data-k="dst" data-hop="2"></span>
      <span class="rl">源 MAC</span>
      <span class="c src" data-k="src" data-hop="0"></span>
      <span class="c src" data-k="src" data-hop="1"></span>
      <span class="c src" data-k="src" data-hop="2"></span>
    </div>
    <div class="grid packet">
      <span class="tag">IP 包</span>
      <span class="rl">TTL</span>
      <span class="c" data-k="ttl" data-hop="0"></span>
      <span class="c" data-k="ttl" data-hop="1"></span>
      <span class="c" data-k="ttl" data-hop="2"></span>
      <span class="rl">源 IP</span>
      <span class="c all">192.168.1.23</span>
      <span class="rl">目的 IP</span>
      <span class="c all">203.0.113.10</span>
    </div>
  </div>
</section>
<script>
// 每台设备朝左、朝右各一个口；电脑和服务器只有一个
const DEVICES = [
  { name: '电脑', kind: 'pc', ip: '192.168.1.23', right: '…51:0d' },
  { name: 'R1', kind: 'router', left: '…0a:7e', right: '…0a:7f' },
  { name: 'R2', kind: 'router', left: '…9e:40', right: '…9e:41' },
  { name: '服务器', kind: 'server', ip: '203.0.113.10', left: '…3a:12' },
];
const HOPS = DEVICES.length - 1, MOVE = 900, SWAP = 800;
const root = document.querySelector('.hp'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// hop：表里点亮的是第几段；reached：播放到了第几段，后面的列先空着
// at：包在哪。router 为假时在第 i 段线上走了 f，为真时正穿过第 i 台设备
// wrap：帧头的不透明度，穿过路由器时淡出再淡入
let width = 0, hop = 0, reached = HOPS - 1, wrap = 1, run = 0;
let at = { router: false, i: 0, f: .5 };

function glyph(d, x, y) {
  if (d.kind === 'router') {
    return `<circle class="dev" cx="${x}" cy="${y}" r="17"/>` +
      `<path class="glyph" d="M${x - 8} ${y - 3.5}h15m-4 -3.5l4 3.5-4 3.5M${x + 8} ${y + 3.5}h-15m4 -3.5l-4 3.5 4 3.5"/>`;
  }
  if (d.kind === 'pc') {
    return `<rect class="dev" x="${x - 19}" y="${y - 15}" width="38" height="25" rx="3"/><path class="glyph" d="M${x} ${y + 10}v5M${x - 8} ${y + 15}h16"/>`;
  }
  return `<rect class="dev" x="${x - 14}" y="${y - 18}" width="28" height="36" rx="3"/>` +
    `<path class="glyph" d="M${x - 14} ${y - 6}h28M${x - 14} ${y + 6}h28M${x - 8} ${y - 12}h3M${x - 8} ${y}h3M${x - 8} ${y + 12}h3"/>`;
}

function draw() {
  if (!width) return;
  const pad = 22, xs = DEVICES.map((_, i) => pad + (width - 2 * pad) * i / HOPS);
  const y = 44, H = 110, gap = 17;
  let s = '';
  for (let i = 0; i < HOPS; i++) {
    s += `<line class="link${i === hop ? ' on' : ''}" x1="${xs[i]}" x2="${xs[i + 1]}" y1="${y}" y2="${y}"/>`;
    // 每个口的 MAC 都标着：一段线的源在上方靠左，目的在下方靠右
    s += `<text class="m${i === hop ? ' src' : ''}" x="${xs[i] + 22}" y="${y - gap}">${DEVICES[i].right}</text>`;
    s += `<text class="m${i === hop ? ' dst' : ''}" x="${xs[i + 1] - 22}" y="${y + gap}" text-anchor="end">${DEVICES[i + 1].left}</text>`;
  }
  DEVICES.forEach((d, i) => {
    // 两头的设备把文字往里收，免得出界
    const [tx, anchor] = i === 0 ? [xs[i] - 20, 'start'] : i === HOPS ? [xs[i] + 15, 'end'] : [xs[i], 'middle'];
    s += glyph(d, xs[i], y) + `<text class="name" x="${tx}" y="${y + 40}" text-anchor="${anchor}">${d.name}</text>`;
    if (d.ip) s += `<text class="ip" x="${tx}" y="${y + 58}" text-anchor="${anchor}">${d.ip}</text>`;
  });
  // 包画成两层：外面一圈是帧头，里面是 IP 包
  const px = at.router ? xs[at.i] - 24 + 48 * at.f : xs[at.i] + 24 + (xs[at.i + 1] - xs[at.i] - 48) * at.f;
  s += `<rect class="wrap" x="${px - 11}" y="${y - 8}" width="22" height="16" rx="3" opacity="${wrap.toFixed(2)}"/>`;
  s += `<rect class="core" x="${px - 5}" y="${y - 4}" width="10" height="8" rx="1.5"/>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
}

// 把表填到 reached 那一段，点亮 hop 那一列；fresh 那一列闪一下
function table(fresh) {
  root.querySelectorAll('.c[data-k]').forEach(el => {
    const k = Number(el.dataset.hop), shown = k <= reached;
    const value = { dst: DEVICES[k + 1].left, src: DEVICES[k].right, ttl: String(64 - k) }[el.dataset.k];
    el.textContent = shown ? value : '';
    el.classList.toggle('wait', !shown);
    el.classList.toggle('on', k === hop);
    if (k === fresh) {
      el.classList.add('flash');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('flash')));
    }
  });
  root.querySelectorAll('.hop').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.hop) === hop)));
  svg.setAttribute('aria-label', `第 ${hop + 1} 段：源 MAC ${DEVICES[hop].right}，目的 MAC ${DEVICES[hop + 1].left}，TTL ${64 - hop}；源 IP 和目的 IP 没变`);
}

const ease = t => (t < .5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2);
// 在 ms 毫秒里把 fn 从 0 推到 1；中途有人点了别的，就停下并返回 false
function tween(ms, fn) {
  if (reduce) { fn(1); draw(); return Promise.resolve(true); }
  const id = run;
  return new Promise(done => {
    const t0 = performance.now();
    const step = now => {
      if (id !== run) return done(false);
      const t = Math.min(1, Math.max(0, (now - t0) / ms));
      fn(t);
      draw();
      if (t < 1) requestAnimationFrame(step);
      else done(true);
    };
    requestAnimationFrame(step);
  });
}

async function play() {
  run++;
  hop = 0; reached = 0; wrap = 1;
  at = { router: false, i: 0, f: 0 };
  table(0);
  draw();
  for (let k = 0; k < HOPS; k++) {
    if (!(await tween(MOVE, t => { at = { router: false, i: k, f: ease(t) }; }))) return;
    if (k === HOPS - 1) return;
    // 穿过路由器：前一半拆掉旧帧头，走到一半换成下一段，后一半套上新的
    const ok = await tween(SWAP, t => {
      at = { router: true, i: k + 1, f: t };
      wrap = Math.abs(2 * t - 1);
      if (t >= .5 && hop === k) { hop = k + 1; reached = hop; table(hop); }
    });
    if (!ok) return;
  }
}

function show(k) {
  run++;
  hop = k; reached = HOPS - 1; wrap = 1;
  table(k);
  tween(MOVE, t => { at = { router: false, i: k, f: ease(t) }; });
}

root.querySelector('.play').addEventListener('click', play);
root.querySelectorAll('.hop').forEach(b => b.addEventListener('click', () => show(Number(b.dataset.hop))));
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
table(-1);
</script>
```

第一段最容易绕晕，帧头里的目的 MAC 写的是网关，里面 IP 包的目的 IP 却是远端服务器。记住帧头指下一站、包头指终点，就不会混了。

IP 头里还有个 **TTL** 字段，每过一台路由器减 1，减到 0 就把包扔掉，免得它在路由环路里一直打转。

扔包的同时，路由器会给源地址回一条“超时”消息。它走的是 **ICMP** 协议，`ping` 底层用的也是它。

开头的 `traceroute` 正是利用这个机制把沿途机器一台台问出来的。先发 TTL 为 1 的包，第一台路由器扔掉并回信，就知道第一跳是谁；再发 TTL 为 2 的问出第二跳，一路递增到目的地：

```render html
<style>
  .tr { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .tr { --blue: #95bfdc; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .tr svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .col { stroke: var(--rule); stroke-dasharray: 2 5; }
  .dev { fill: var(--bg-raised); stroke: var(--muted); stroke-width: 1.4; }
  .glyph { fill: none; stroke: var(--muted); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
  .found .dev { stroke: var(--accent); stroke-width: 2; }
  .name { fill: var(--text); font-size: 13px; }
  .probe { stroke: var(--accent); stroke-width: 2.2; stroke-linecap: round; }
  .pkt { fill: var(--accent); }
  .ttl { fill: var(--accent-ink); font: 600 12px var(--font-mono); text-anchor: middle; }
  .end { fill: var(--bg); stroke: var(--muted); stroke-width: 1.4; }
  .end.ok { stroke: var(--accent); }
  .cross { fill: none; stroke: var(--muted); stroke-width: 1.8; stroke-linecap: round; }
  .tick { fill: none; stroke: var(--accent-ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .reply { stroke: var(--blue); stroke-width: 1.6; stroke-dasharray: 5 4; }
  .reply-head { fill: var(--blue); }
  .back { fill: var(--blue); font-size: 12px; text-anchor: middle; }
</style>
<section class="tr" aria-label="traceroute：TTL 从 1 开始一个个加，每个探测包比上一个多走一跳才被扔掉，回信的那台就是这一跳">
  <button type="button" class="key play">播放</button>
  <svg role="img" aria-label="四个探测包，TTL 分别是 1、2、3、4：前三个依次死在 R1、R2、R3，各自换回一条超时消息；第四个到了服务器"></svg>
</section>
<script>
const NODES = [
  { name: '电脑', kind: 'pc' },
  { name: 'R1', kind: 'router' },
  { name: 'R2', kind: 'router' },
  { name: 'R3', kind: 'router' },
  { name: '服务器', kind: 'server' },
];
const LAST = NODES.length - 1;
// 每一跳去程 OUT 毫秒、回程 BACK 毫秒；到站停 HOLD，两个探测包之间歇 REST
const OUT = 300, BACK = 200, HOLD = 160, REST = 320;
const PROBES = [];
let total = 0;
for (let k = 1; k <= LAST; k++) {
  const out1 = total + k * OUT, back0 = out1 + HOLD, back1 = back0 + k * BACK;
  PROBES.push({ ttl: k, out0: total, out1, back0, back1 });
  total = back1 + REST;
}
const root = document.querySelector('.tr'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// now 是动画走到了第几毫秒；首帧停在全部问完的样子
let width = 0, now = total, raf = 0;

function glyph(d, x, y) {
  if (d.kind === 'router') {
    return `<circle class="dev" cx="${x}" cy="${y}" r="17"/>` +
      `<path class="glyph" d="M${x - 8} ${y - 3.5}h15m-4 -3.5l4 3.5-4 3.5M${x + 8} ${y + 3.5}h-15m4 -3.5l-4 3.5 4 3.5"/>`;
  }
  if (d.kind === 'pc') {
    return `<rect class="dev" x="${x - 19}" y="${y - 15}" width="38" height="25" rx="3"/><path class="glyph" d="M${x} ${y + 10}v5M${x - 8} ${y + 15}h16"/>`;
  }
  return `<rect class="dev" x="${x - 14}" y="${y - 18}" width="28" height="36" rx="3"/>` +
    `<path class="glyph" d="M${x - 14} ${y - 6}h28M${x - 14} ${y + 6}h28M${x - 8} ${y - 12}h3M${x - 8} ${y}h3M${x - 8} ${y + 12}h3"/>`;
}

function draw() {
  if (!width) return;
  const pad = 22, xs = NODES.map((_, i) => pad + (width - 2 * pad) * i / LAST);
  const top = 30, first = 112, pitch = 60, H = first + (PROBES.length - 1) * pitch + 36;
  let s = '';
  xs.forEach(x => { s += `<line class="col" x1="${x}" x2="${x}" y1="${top + 48}" y2="${H - 4}"/>`; });
  NODES.forEach((d, i) => {
    // 回信到了电脑，这一跳才算问出来
    const found = i > 0 && now >= PROBES[i - 1].back1;
    const [tx, anchor] = i === 0 ? [xs[i] - 20, 'start'] : i === LAST ? [xs[i] + 15, 'end'] : [xs[i], 'middle'];
    s += `<g class="${found ? 'found' : ''}">${glyph(d, xs[i], top)}</g>`;
    s += `<text class="name" x="${tx}" y="${top + 38}" text-anchor="${anchor}">${d.name}</text>`;
  });
  PROBES.forEach((p, r) => {
    if (now <= p.out0) return;
    const y = first + r * pitch, k = p.ttl, x0 = xs[0], x1 = xs[k];
    const fo = Math.min(1, (now - p.out0) / (p.out1 - p.out0)), head = x0 + (x1 - x0) * fo;
    s += `<line class="probe" x1="${x0}" x2="${head}" y1="${y}" y2="${y}"/>`;
    // 每一段线上方写着包在这一段里的 TTL：过一台路由器少 1
    for (let j = 0; j < k && fo * k >= j + .5; j++) {
      s += `<text class="ttl" x="${(xs[j] + xs[j + 1]) / 2}" y="${y - 8}">${j ? '' : 'TTL '}${k - j}</text>`;
    }
    if (fo < 1) {
      s += `<rect class="pkt" x="${head - 6}" y="${y - 5}" width="12" height="10" rx="2"/>`;
      return;
    }
    // 减到 0 的那台把包扔掉；最后一个探测包到了服务器
    const arrived = k === LAST;
    s += `<circle class="end${arrived ? ' ok' : ''}" cx="${x1}" cy="${y}" r="8"/>`;
    s += arrived ? `<path class="tick" d="M${x1 - 4} ${y}l2.8 3 5.2-6"/>` : `<path class="cross" d="M${x1 - 3.5} ${y - 3.5}l7 7M${x1 + 3.5} ${y - 3.5}l-7 7"/>`;
    if (now <= p.back0) return;
    const fb = Math.min(1, (now - p.back0) / (p.back1 - p.back0)), yb = y + 14, tail = x1 - (x1 - x0) * fb;
    s += `<line class="reply" x1="${x1}" x2="${tail}" y1="${yb}" y2="${yb}"/>`;
    s += `<polygon class="reply-head" points="${tail - 1},${yb} ${tail + 8},${yb - 4} ${tail + 8},${yb + 4}"/>`;
    s += `<text class="back" x="${(xs[k - 1] + xs[k]) / 2}" y="${yb + 16}">${arrived ? '到了' : '超时'}</text>`;
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { now = total; return draw(); }
  const t0 = performance.now();
  const step = t => {
    now = Math.min(total, Math.max(0, t - t0));
    draw();
    if (now < total) raf = requestAnimationFrame(step);
  };
  now = 0;
  draw();
  raf = requestAnimationFrame(step);
}

root.querySelector('.play').addEventListener('click', play);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

超时回包的源 IP 就是扔包那台路由器，发出到收到回包的时间差就是那一行的毫秒数。开头那两个星号，是因为对应路由器被设成了不回 ICMP 超时消息。

## 路由表与最长前缀匹配

路由器查的表叫路由表，每行记录一个目的网络前缀，以及匹配后的下一跳和出口：

```text
目的网络            下一跳          出口
203.0.113.0/24     10.0.0.2        eth1
203.0.113.0/25     10.0.0.6        eth2
0.0.0.0/0          198.51.100.1    eth0
```

一个目的 IP 经常同时命中好几行。`203.0.113.10` 既在 `203.0.113.0/24` 里，也在 `203.0.113.0/25` 里，`0.0.0.0/0` 更是包含所有地址。选哪条靠**最长前缀匹配**，命中的条目里前缀越长、划得越具体，就按哪条走。

把目的地址和三行前缀展开成二进制按位对齐，虚线部分在前缀之外，不参与比较：

```render html
<style>
  .lp { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font: 13.5px var(--font-mono); cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .lp svg { display: block; width: 100%; height: auto; margin-top: 14px; overflow: visible; }
  .lbl { fill: var(--muted); font-size: 12.5px; dominant-baseline: central; }
  .len { fill: var(--muted); font: 13px var(--font-mono); dominant-baseline: central; }
  .dec { fill: var(--text); font: 500 14px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .dot { fill: var(--muted); font: 14px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .bit { fill: var(--text); font: 13px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .bit.off { fill: var(--faint); }
  .bit.diff { fill: var(--bg); font-weight: 700; }
  .sq { fill: var(--text); }
  .sq.off { fill: var(--faint); }
  .sq.diff { fill: var(--bg); }
  .zero { fill: none; stroke: var(--text); stroke-opacity: .5; }
  .zero.off { stroke: var(--faint); stroke-opacity: .6; }
  .zero.diff { stroke: var(--bg); stroke-opacity: 1; }
  .band { fill: var(--surface); }
  .band.win { fill: var(--accent-soft); }
  .hit { fill: var(--muted); }
  .free { stroke: var(--rule-strong); stroke-dasharray: 2 4; }
  .out { fill: var(--muted); font: 13px var(--font-mono); text-anchor: end; dominant-baseline: central; }
  .out.off { fill: var(--faint); text-decoration: line-through; }
  .out.win, .len.win { fill: var(--accent-ink); font-weight: 700; }
  .verdict { margin: 8px 0 0; color: var(--text); font-size: 15px; font-weight: 600; }
</style>
<section class="lp" aria-label="把目的地址和路由表里每一行的前缀按位对齐：对得上的行里，前缀最长的那一行决定出口">
  <div class="seg" role="group" aria-label="目的地址"></div>
  <svg role="img"></svg>
  <p class="verdict" aria-live="polite"></p>
</section>
<script>
const ROUTES = [
  { net: [203, 0, 113, 0], len: 24, out: 'eth1' },
  { net: [203, 0, 113, 0], len: 25, out: 'eth2' },
  { net: [0, 0, 0, 0], len: 0, out: 'eth0' },
];
const TARGETS = [[203, 0, 113, 10], [203, 0, 113, 200], [8, 8, 8, 8]];
const root = document.querySelector('.lp'), svg = root.querySelector('svg');
const seg = root.querySelector('.seg'), verdict = root.querySelector('.verdict');
let target = 0, width = 0;

const bits = ip => ip.flatMap(o => Array.from({ length: 8 }, (_, k) => (o >> (7 - k)) & 1));

function render() {
  if (!width) return;
  const narrow = width < 460, lw = narrow ? 30 : 42, rw = 40, sep = narrow ? 6 : 10;
  const c = Math.min(18, Math.floor((width - lw - rw - 3 * sep) / 32)), digits = c >= 11;
  const x = i => lw + i * c + Math.floor(i / 8) * sep;
  const a = bits(TARGETS[target]);
  // 一行前缀的每一位都和目的地址相同，才算匹配；/0 一位都不用比
  const rows = ROUTES.map(r => {
    const b = bits(r.net);
    return { ...r, b, match: b.slice(0, r.len).every((v, i) => v === a[i]) };
  });
  const best = Math.max(...rows.filter(r => r.match).map(r => r.len));
  // 一位：宽的时候写数字，窄的时候 1 画实心、0 画空心
  const cell = (v, kind, i, y) => {
    const cx = x(i) + c / 2;
    let out = kind === 'diff' ? `<rect class="hit" x="${x(i) + .5}" y="${y - 10}" width="${c - 1}" height="20" rx="2"/>` : '';
    if (digits) out += `<text class="bit ${kind}" x="${cx}" y="${y}">${v}</text>`;
    else if (v) out += `<rect class="sq ${kind}" x="${cx - 2.5}" y="${y - 5}" width="5" height="10" rx="1"/>`;
    else out += `<rect class="zero ${kind}" x="${cx - 2}" y="${y - 4.5}" width="4" height="9" rx="1"/>`;
    return out;
  };

  const y0 = 30;
  let s = `<text class="lbl" x="0" y="${y0}">目的</text>`;
  TARGETS[target].forEach((o, k) => {
    s += `<text class="dec" x="${x(8 * k) + 4 * c}" y="8">${o}</text>`;
    if (k) s += `<text class="dot" x="${x(8 * k) - sep / 2}" y="8">.</text>`;
  });
  a.forEach((v, i) => { s += cell(v, '', i, y0); });

  rows.forEach((r, k) => {
    const y = 74 + k * 36, win = r.match && r.len === best;
    // 匹配的行，前缀那一段打底色
    for (let g = 0; g < 4 && r.match; g++) {
      const from = 8 * g, to = Math.min(r.len, 8 * g + 8);
      if (to > from) s += `<rect class="band${win ? ' win' : ''}" x="${x(from)}" y="${y - 12}" width="${x(to - 1) + c - x(from)}" height="24" rx="2"/>`;
    }
    // 前缀之后的位不比较，画成虚线
    if (r.len < 32) s += `<line class="free" x1="${x(r.len)}" x2="${x(31) + c}" y1="${y}" y2="${y}"/>`;
    for (let i = 0; i < r.len; i++) s += cell(r.b[i], r.b[i] !== a[i] ? 'diff' : r.match ? '' : 'off', i, y);
    s += `<text class="len${win ? ' win' : ''}" x="0" y="${y}">/${r.len}</text>`;
    s += `<text class="out${win ? ' win' : r.match ? '' : ' off'}" x="${width}" y="${y}">${r.out}</text>`;
  });

  const won = rows.find(r => r.match && r.len === best), n = rows.filter(r => r.match).length;
  verdict.textContent = n > 1 ? `匹配 ${n} 行，/${won.len} 最长 · 走 ${won.out}` : `只匹配 /${won.len} · 走 ${won.out}`;
  svg.setAttribute('viewBox', `0 0 ${width} 166`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', `${TARGETS[target].join('.')}：${verdict.textContent}`);
}

TARGETS.forEach((ip, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = ip.join('.');
  b.setAttribute('aria-pressed', String(i === target));
  b.addEventListener('click', () => {
    target = i;
    seg.querySelectorAll('button').forEach((el, j) => el.setAttribute('aria-pressed', String(j === i)));
    render();
  });
  seg.append(b);
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(svg);
</script>
```

把目的地址换成 `203.0.113.200`，它的第 25 位是 1，而 `/25` 那行要求第 25 位为 0（只覆盖到 `.127`），对不上，于是落回 `/24` 走 `eth1`。

`0.0.0.0/0` 前缀长度为 0，不用比较任何位就能匹配所有地址，同时优先级最低。它是**默认路由**，前面的条目都对不上时就往这里送。家用路由器基本全靠这一条，凡是出局域网的包一律交给运营商。

## 路由表是怎么生成的

家用路由器一条默认路由就够，但运营商骨干路由器得知道全球网段往哪走，这张表从哪来？

没人统一下发。互联网由七万多个各自运营的网络拼成，包括运营商、云服务商、大学和大公司，每个叫一个**自治系统**（AS），有独立编号。AS 内部怎么选路自己说了算，通常是路由器间互相通报直连链路，各自拼出拓扑图再用 Dijkstra 算最短路，OSPF 就是这么干的。

不同 AS 之间靠 **BGP** 交换路由，更像邻居间的口口相传：

1. 拥有 `203.0.113.0/24` 的 AS 告诉邻居：“这个网络在我这里。”
2. 邻居记下来，在路径前拼上自己的编号，继续转告它的邻居：“经过我、再经过它，就能到达。”
3. 消息一圈圈传开。一个 AS 可能从好几个邻居那里听到同一个网段，通常会挑经过 AS 最少的那条。

如果收到的路径里已经包含自己的编号，说明绕回来了，直接丢掉就不会成环。

下图每个圆圈代表一个 AS，箭头是它选的下一跳，橙色那条是你的包实际走的路线。每个 AS 只关心自己的下一跳，整条路是箭头一个个接出来的。点“重新宣告”，就能看到路由从服务器所在 AS 一圈圈传出来：

```render html
<style>
  .bg { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .bg { --blue: #95bfdc; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .bg svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; user-select: none; -webkit-user-select: none; }
  .sea { fill: var(--blue); fill-opacity: .07; }
  .sea-name { fill: var(--blue); fill-opacity: .7; font-size: 12px; text-anchor: middle; letter-spacing: 4px; }
  .link { stroke: var(--rule-strong); stroke-width: 1.6; }
  .link.cut { stroke-dasharray: 3 4; }
  .snip { stroke: var(--muted); stroke-width: 1.8; stroke-linecap: round; }
  .hit { stroke: transparent; stroke-width: 22; cursor: pointer; }
  .hit:hover { stroke: var(--accent); stroke-opacity: .14; }
  .tree { stroke: var(--muted); stroke-width: 1.6; }
  .tip { fill: var(--muted); }
  .path { fill: none; stroke: var(--accent); stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
  .path-tip { fill: var(--accent); }
  .as { fill: var(--bg-raised); stroke: var(--muted); stroke-width: 1.4; }
  .as.lost { fill: var(--bg); stroke: var(--rule-strong); stroke-dasharray: 2 2; }
  .as.you { stroke: var(--accent); stroke-width: 2; }
  .as.origin { fill: var(--text); stroke: var(--text); }
  .as.fake { fill: var(--accent); stroke: var(--accent); }
  .pulse { fill: none; stroke: var(--accent); }
  .tag { fill: var(--text); font-size: 13px; }
  .pre { fill: var(--muted); font: 12px var(--font-mono); }
  .pre.fake { fill: var(--accent-ink); }
</style>
<section class="bg" aria-label="BGP 路由宣告从服务器所在的 AS 一圈圈传开，每个 AS 只记下一跳；剪断光缆或者有人冒认前缀，各自的下一跳跟着变">
  <div class="keys">
    <button type="button" class="key announce">重新宣告</button>
    <button type="button" class="key snip-key">剪断海缆</button>
    <button type="button" class="key hijack" aria-pressed="false">冒认 /25</button>
    <button type="button" class="key reset">重置</button>
  </div>
  <svg role="img"></svg>
</section>
<script>
// 坐标是 0 到 1 的比例；0 是你，8 是服务器所在的 AS，4 等着冒认
const NODES = [[.03, .45], [.2, .1], [.2, .82], [.36, .45], [.34, 1], [.66, .1], [.64, .5], [.8, .86], [.97, .45]];
const LINKS = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [1, 5], [3, 6], [2, 7], [5, 6], [5, 8], [6, 7], [7, 8]];
const YOU = 0, ORIGIN = 8, FAKE = 4, STEP = 320;
const root = document.querySelector('.bg'), svg = root.querySelector('svg');
const hijackKey = root.querySelector('.hijack'), snipKey = root.querySelector('.snip-key');
// 跨过太平洋的线就是海缆
const OCEAN = LINKS.map(([a, b]) => (NODES[a][0] < .5) !== (NODES[b][0] < .5));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let width = 0, cut = new Set(), hijack = false;
// 每个 AS 现在指向的下一跳，和它最近一次改主意的时间；epoch 每次重算加一，旧的定时器就此作废
let next = [], changedAt = [], frame = 0, epoch = 0;

function bfs(origin, skip) {
  const dist = NODES.map(() => Infinity), hop = NODES.map(() => -1);
  dist[origin] = 0;
  const queue = [origin];
  while (queue.length) {
    const u = queue.shift();
    LINKS.forEach(([a, b], k) => {
      if (cut.has(k)) return;
      const v = a === u ? b : b === u ? a : -1;
      if (v < 0 || v === skip || dist[v] <= dist[u] + 1) return;
      // 同样远时选编号小的邻居
      if (dist[v] === dist[u] + 1 && hop[v] < u) return;
      dist[v] = dist[u] + 1;
      hop[v] = u;
      queue.push(v);
    });
  }
  return { dist, hop };
}

// 有 /25 就走 /25，最长前缀匹配；服务器自己的地址不听别人的
function routes() {
  const real = bfs(ORIGIN, -1), fake = hijack ? bfs(FAKE, ORIGIN) : null;
  return NODES.map((_, i) => {
    if (i === ORIGIN || (hijack && i === FAKE)) return { hop: -1, dist: 0 };
    if (fake && fake.hop[i] >= 0) return { hop: fake.hop[i], dist: fake.dist[i] };
    return { hop: real.hop[i], dist: real.dist[i] };
  });
}

function update() {
  const now = performance.now(), r = routes(), mine = ++epoch;
  const far = Math.max(...r.map(x => (Number.isFinite(x.dist) ? x.dist : 0))) + 1;
  r.forEach((x, i) => {
    if (x.hop === next[i]) return;
    // 离宣告的源头越远，消息到得越晚
    const delay = reduce ? 0 : (Number.isFinite(x.dist) ? x.dist : far) * STEP;
    setTimeout(() => {
      if (mine !== epoch) return;
      next[i] = x.hop;
      changedAt[i] = performance.now();
    }, delay);
  });
  hijackKey.setAttribute('aria-pressed', String(hijack));
  cancelAnimationFrame(frame);
  const end = now + far * STEP + 900;
  const loop = t => { draw(t); if (t < end) frame = requestAnimationFrame(loop); };
  frame = requestAnimationFrame(loop);
}

function geo() {
  const narrow = width < 460, pad = narrow ? 16 : 22, H = narrow ? 250 : 300;
  return { narrow, H, r: narrow ? 9 : 11, pt: ([x, y]) => [pad + x * (width - 2 * pad), 16 + y * (H - 58)] };
}

function arrow(cls, [x1, y1], [x2, y2], at, size) {
  const x = x1 + (x2 - x1) * at, y = y1 + (y2 - y1) * at, a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d, s) => `${(x + Math.cos(a + d) * s).toFixed(1)},${(y + Math.sin(a + d) * s).toFixed(1)}`;
  return `<polygon class="${cls}" points="${p(0, size)} ${p(2.5, size)} ${p(-2.5, size)}"/>`;
}

function route() {
  const path = [YOU];
  while (path.length < NODES.length && next[path.at(-1)] >= 0 && !path.includes(next[path.at(-1)])) path.push(next[path.at(-1)]);
  return path;
}
const linkOf = (a, b) => LINKS.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
const cable = () => { const p = route(); return p.slice(1).map((h, i) => linkOf(p[i], h)).find(k => OCEAN[k]) ?? -1; };

function draw(now = performance.now()) {
  const g = geo(), P = NODES.map(g.pt);
  let s = '';
  const [sx0] = g.pt([.45, 0]), [sx1] = g.pt([.55, 0]);
  s += `<rect class="sea" x="${sx0}" y="0" width="${sx1 - sx0}" height="${g.H - 4}" rx="4"/>`;
  s += `<text class="sea-name" x="${(sx0 + sx1) / 2}" y="${g.H - 14}">太平洋</text>`;
  LINKS.forEach(([a, b], k) => {
    const [x1, y1] = P[a], [x2, y2] = P[b];
    s += `<line class="link${cut.has(k) ? ' cut' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (cut.has(k)) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      s += `<path class="snip" d="M${mx - 5} ${my - 5}l10 10M${mx + 5} ${my - 5}l-10 10"/>`;
    }
  });
  // 每个 AS 选的下一跳
  next.forEach((h, i) => {
    if (h < 0) return;
    s += `<line class="tree" x1="${P[i][0]}" y1="${P[i][1]}" x2="${P[h][0]}" y2="${P[h][1]}"/>` + arrow('tip', P[i], P[h], .5, 5.5);
  });
  // 你的包实际走的路
  const path = route();
  if (path.length > 1) {
    s += `<polyline class="path" points="${path.map(i => P[i].join(',')).join(' ')}"/>`;
    path.slice(1).forEach((h, k) => { s += arrow('path-tip', P[path[k]], P[h], .5, 7); });
  }
  NODES.forEach((_, i) => {
    const [x, y] = P[i], age = now - (changedAt[i] ?? -1e9);
    if (age < 700 && !reduce) s += `<circle class="pulse" cx="${x}" cy="${y}" r="${g.r + age / 30}" stroke-opacity="${1 - age / 700}"/>`;
    const cls = i === ORIGIN ? ' origin' : i === FAKE && hijack ? ' fake' : i === YOU ? ' you' : next[i] < 0 ? ' lost' : '';
    s += `<circle class="as${cls}" cx="${x}" cy="${y}" r="${g.r}"/>`;
  });
  s += `<text class="tag" x="${P[YOU][0] - g.r + 2}" y="${P[YOU][1] + g.r + 18}">你</text>`;
  s += `<text class="tag" x="${P[ORIGIN][0] + g.r - 2}" y="${P[ORIGIN][1] + g.r + 18}" text-anchor="end">服务器</text>`;
  s += `<text class="pre" x="${P[ORIGIN][0] + g.r - 2}" y="${P[ORIGIN][1] - g.r - 8}" text-anchor="end">/24</text>`;
  if (hijack) s += `<text class="pre fake" x="${P[FAKE][0] + g.r + 7}" y="${P[FAKE][1] + 4}">/25</text>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
  LINKS.forEach(([a, b], k) => {
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hit.setAttribute('class', 'hit');
    [['x1', P[a][0]], ['y1', P[a][1]], ['x2', P[b][0]], ['y2', P[b][1]]].forEach(([n, v]) => hit.setAttribute(n, v));
    hit.dataset.k = k;
    svg.prepend(hit);
  });
  snipKey.disabled = cable() < 0;
  const end = path.at(-1);
  svg.setAttribute('aria-label', end === ORIGIN ? `你的包经过 ${path.length - 2} 个 AS 到达服务器` : end === FAKE ? '你的包被引到了冒认的 AS' : '你到不了服务器');
}

svg.addEventListener('click', e => {
  const hit = e.target.closest('.hit');
  if (!hit) return;
  const k = Number(hit.dataset.k);
  cut.has(k) ? cut.delete(k) : cut.add(k);
  update();
});
hijackKey.addEventListener('click', () => { hijack = !hijack; update(); });
snipKey.addEventListener('click', () => { const k = cable(); if (k >= 0) { cut.add(k); update(); } });
root.querySelector('.reset').addEventListener('click', () => { cut.clear(); hijack = false; update(); });
// 让每个 AS 先忘掉学到的路，再看宣告从服务器那头传过来
root.querySelector('.announce').addEventListener('click', () => {
  next = NODES.map(() => -1);
  changedAt = [];
  update();
});
// 首帧直接是收敛好的样子
routes().forEach((x, i) => { next[i] = x.hop; });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

全程没有任何中心节点指挥。哪根海底光缆断了，撤销消息也按同样的方式一圈圈传开，各 AS 收到后各自换路绕行。

不过 BGP 基本信任邻居说的话。2008 年巴基斯坦电信想在国内封掉 YouTube，误在 BGP 里宣告了 YouTube 的一个 `/24` 前缀，比 YouTube 自己宣告的 `/22` 更具体。消息被上游传遍全球，按最长前缀匹配，各地发往 YouTube 的流量全被引去了巴基斯坦，YouTube 全球断了大约两小时。点图里的“冒认 /25”演示的正是这回事，只要有人宣告了更具体的前缀，流量就会拐走。现在有 RPKI 给“谁有权宣告哪个前缀”加签名，但还没完全普及。

真实世界里 BGP 选路也不只看远近，商业关系往往排在前面。小网络向大网络付钱买**转接**，请对方把包送往全世界；规模差不多的网络常在互联网交换中心（IXP）拉专线直接**对等**，免费交换彼此用户的流量。策略上通常是能走客户就不走对等，能走对等就不走自己付钱的上游。最顶上的十几家一级运营商谁也不向谁付钱，彼此对等，撑起了全球骨干。

谁跟谁直连、流量走哪家，都是一份份商业合同谈出来的，并没有一张总设计图。洲与洲之间主要靠铺在海底的几百条光缆。

## 端口与 UDP：把包交给具体程序

IP 把包送到了机器上，可一台电脑同时开着浏览器、聊天软件和下载工具，这个包该交给哪个程序？

于是在 IP 之外又加了**端口**，长 16 位，范围 0 到 65535。服务端守在固定端口上，网页是 80 和 443，SSH 是 22，DNS 是 53；客户端每建一条连接，系统随机分一个临时端口。IP 像楼的地址，端口像房间号。

一条连接由四个数确定：源 IP、源端口、目的 IP 和目的端口。浏览器开两个标签页连同一个网站，目的地完全一样，系统靠源端口区分，用 `ss -tn` 能看到：

```text
State  Recv-Q  Send-Q  Local Address:Port   Peer Address:Port
ESTAB  0       0       192.168.1.23:51432   203.0.113.10:443
ESTAB  0       0       192.168.1.23:51433   203.0.113.10:443
```

服务器那边同理，成千上万个客户端同时连它的 443 端口，只要四元组各不相同，就能互不干扰。

在 IP 之上只加端口、别的什么都不管，就是 **UDP**。它的头部只有 8 字节（源端口、目的端口、长度、校验和），丢包和乱序都不处理。听着简陋，但很多场景正需要这种轻量，比如 DNS 查询一问一答、超时重问就行，视频通话里迟到的旧画面也不如直接丢掉。

## NAT：全家用一个公网地址

32 位的 IPv4 只有约 43 亿个地址，远不够全球设备分，分配机构早在 2011 年就把最后几块发完了。

省地址的办法是划出三段**私有地址**，它们在公网上不路由，谁都能在自己局域网里随便用：

```text
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

你家和我家都可以有 `192.168.1.23`，互不冲突，因为它们根本不会出现在公网上。内网设备连外网靠路由器做 **NAT**（网络地址转换）：包发出去时，路由器把源 IP 换成自己的公网 IP，源端口换成一个新号，在表里记下映射；回包到了，再按表还原回去。

```render html
<style>
  .nt { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .nt { --blue: #95bfdc; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 38px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .nt svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; }
  .zone { fill: var(--muted); font-size: 12px; }
  .fence { stroke: var(--rule-strong); stroke-dasharray: 4 4; }
  .link { stroke: var(--rule-strong); stroke-width: 2; }
  .link.hot { stroke: var(--accent); stroke-opacity: .6; }
  .dev { fill: var(--bg-raised); stroke: var(--muted); stroke-width: 1.4; }
  .glyph { fill: none; stroke: var(--muted); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
  .router .dev { fill: var(--surface); stroke: var(--text); }
  .name { fill: var(--text); font-size: 13px; }
  .ip { fill: var(--muted); font: 11.5px var(--font-mono); }
  .name, .ip { paint-order: stroke; stroke: var(--bg); stroke-width: 4px; stroke-linejoin: round; }
  .ip.pub { fill: var(--text); }
  .pkt { fill: var(--accent); }
  .badge { fill: var(--bg); stroke-width: 1.4; }
  .badge.ok { stroke: var(--accent); }
  .badge.no { stroke: var(--muted); }
  .tick { fill: none; stroke: var(--accent-ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .cross { fill: none; stroke: var(--muted); stroke-width: 1.8; stroke-linecap: round; }
  .th { fill: var(--muted); font-size: 12px; }
  .td { fill: var(--text); font: 13px var(--font-mono); }
  .row-hot { fill: var(--accent-soft); }
  .rule { stroke: var(--rule-strong); }
  .hdr { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); gap: 4px 8px; align-items: center; margin-top: 14px; }
  .hdr small { color: var(--muted); font-size: 12px; }
  .hdr .side { padding-right: 4px; color: var(--muted); font-size: 12.5px; white-space: nowrap; }
  .hdr span.v { padding: 5px 8px; border-radius: 3px; background: var(--bg-sunken); color: var(--text); font: 500 13px var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background-color .9s; }
  .hdr span.v.empty { color: var(--faint); }
  .hdr span.v.new { background: var(--accent-soft); color: var(--accent-ink); }
  .hdr span.v.flash { transition: none; background: var(--accent); color: var(--bg); }
  @media (max-width: 460px) {
    .hdr { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .hdr > span:first-child { display: none; }
    .hdr .side { grid-column: 1 / -1; margin-top: 4px; }
    .hdr span.v { font-size: 12px; padding: 5px 6px; }
  }
</style>
<section class="nt" aria-label="家里的设备共用一个公网地址；路由器改写源地址和端口，并记在 NAT 表里">
  <div class="keys">
    <button type="button" class="key" data-a="0">手机 → 服务器</button>
    <button type="button" class="key" data-a="1">电脑 → 服务器</button>
    <button type="button" class="key" data-a="2">陌生人 → 你家</button>
  </div>
  <svg role="img"></svg>
  <div class="hdr" aria-live="polite">
    <span></span><small>源</small><small>目的</small>
    <span class="side">家里</span><span class="v" data-c="h0"></span><span class="v" data-c="h1"></span>
    <span class="side">外面</span><span class="v" data-c="o0"></span><span class="v" data-c="o1"></span>
  </div>
</section>
<script>
const HOME = [{ name: '手机', ip: '192.168.1.5' }, { name: '电脑', ip: '192.168.1.23' }];
const PORT = 51432, PUBLIC = '198.51.100.7', SERVER = '203.0.113.10:443', STRANGER = '203.0.113.66:6000';
const root = document.querySelector('.nt'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 首帧：手机已经出过一次门，表里有一行
let width = 0, nat = [{ home: 0, port: 40001 }], nextPort = 40002, hotRow = -1;
let pkt = null, lit = [], marks = [], busy = false;

function geo() {
  const narrow = width < 460;
  const L = narrow ? 30 : Math.max(60, width * .14), R = width - L, M = width / 2;
  const top = 46, bottom = 152, mid = (top + bottom) / 2;
  return {
    narrow, M, fenceTop: 8, mid,
    home: [[L, top], [L, bottom]], router: [M, mid], server: [R, top], stranger: [R, bottom],
    tableY: bottom + 80,
  };
}

function device([x, y], kind) {
  if (kind === 'phone') return `<rect class="dev" x="${x - 10}" y="${y - 16}" width="20" height="32" rx="4"/><path class="glyph" d="M${x - 3} ${y + 11}h6"/>`;
  if (kind === 'pc') return `<rect class="dev" x="${x - 18}" y="${y - 14}" width="36" height="24" rx="3"/><path class="glyph" d="M${x} ${y + 10}v4M${x - 8} ${y + 14}h16"/>`;
  if (kind === 'server') return `<rect class="dev" x="${x - 13}" y="${y - 17}" width="26" height="34" rx="3"/><path class="glyph" d="M${x - 13} ${y - 6}h26M${x - 13} ${y + 6}h26M${x - 7} ${y - 11}h3M${x - 7} ${y}h3M${x - 7} ${y + 11}h3"/>`;
  return `<circle class="dev" cx="${x}" cy="${y - 4}" r="9"/><path class="glyph" d="M${x - 15} ${y + 17}c2-9 28-9 30 0"/>`;
}

function badge([x, y], ok) {
  return `<circle class="badge ${ok ? 'ok' : 'no'}" cx="${x}" cy="${y}" r="9"/>` +
    (ok ? `<path class="tick" d="M${x - 4} ${y}l2.8 3 5.2-6"/>` : `<path class="cross" d="M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7"/>`);
}

function draw() {
  const g = geo(), [M, mid] = g.router;
  const label = (p, dy, anchor, name, ip, pub) =>
    `<text class="name" x="${p[0]}" y="${p[1] + dy}" text-anchor="${anchor}">${name}</text><text class="ip${pub ? ' pub' : ''}" x="${p[0]}" y="${p[1] + dy + 16}" text-anchor="${anchor}">${ip}</text>`;
  let s = `<line class="fence" x1="${M}" x2="${M}" y1="${g.fenceTop}" y2="${g.tableY - 30}"/>`;
  s += `<text class="zone" x="${M - 10}" y="${g.fenceTop + 10}" text-anchor="end">家里</text><text class="zone" x="${M + 10}" y="${g.fenceTop + 10}">公网</text>`;
  const links = [['h0', g.home[0]], ['h1', g.home[1]], ['s', g.server], ['x', g.stranger]];
  for (const [id, p] of links) s += `<line class="link${lit.includes(id) ? ' hot' : ''}" x1="${p[0]}" y1="${p[1]}" x2="${M}" y2="${mid}"/>`;
  s += device(g.home[0], 'phone') + device(g.home[1], 'pc') + device(g.server, 'server') + device(g.stranger, 'person');
  // 窄的时候两侧文字贴边对齐，免得出界
  const at = (p, side) => g.narrow ? [[p[0] + side * 18, p[1]], side < 0 ? 'start' : 'end'] : [p, 'middle'];
  const put = (p, side, dy, name, ip) => { const [q, a] = at(p, side); return label(q, dy, a, name, ip); };
  s += put(g.home[0], -1, 30, HOME[0].name, HOME[0].ip) + put(g.home[1], -1, 30, HOME[1].name, HOME[1].ip);
  s += put(g.server, 1, 32, '服务器', '203.0.113.10') + put(g.stranger, 1, 32, '陌生人', '203.0.113.66');
  s += `<g class="router"><circle class="dev" cx="${M}" cy="${mid}" r="17"/><path class="glyph" d="M${M - 8} ${mid - 3.5}h15m-4 -3.5l4 3.5-4 3.5M${M + 8} ${mid + 3.5}h-15m4 -3.5l-4 3.5 4 3.5"/></g>`;
  s += `<text class="ip" x="${M - 8}" y="${mid + 34}" text-anchor="end">192.168.1.1</text><text class="ip pub" x="${M + 8}" y="${mid + 34}">${PUBLIC}</text>`;
  // NAT 表
  const tw = Math.min(width - 8, 300), tx = M - tw / 2, ty = g.tableY;
  s += `<text class="th" x="${tx}" y="${ty}">内网地址</text><text class="th" x="${tx + tw}" y="${ty}" text-anchor="end">公网端口</text>`;
  s += `<line class="rule" x1="${tx}" x2="${tx + tw}" y1="${ty + 7}" y2="${ty + 7}"/>`;
  [0, 1].forEach(k => {
    const y = ty + 8 + k * 24, r = nat[k];
    if (k === hotRow) s += `<rect class="row-hot" x="${tx - 6}" y="${y + 1}" width="${tw + 12}" height="22" rx="2"/>`;
    if (r) s += `<text class="td" x="${tx}" y="${y + 17}">${HOME[r.home].ip}:${PORT}</text><text class="td" x="${tx + tw}" y="${y + 17}" text-anchor="end">${r.port}</text>`;
  });
  for (const [p, ok] of marks) s += badge(p, ok);
  if (pkt) s += `<rect class="pkt" x="${pkt[0] - 9}" y="${pkt[1] - 6}" width="18" height="12" rx="2"/>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${ty + 8 + 2 * 24 + 4}`);
  svg.innerHTML = s;
}

function header(cells, fresh = []) {
  for (const [k, v] of Object.entries(cells)) {
    const el = root.querySelector(`[data-c="${k}"]`);
    el.textContent = v ?? '—';
    el.classList.toggle('empty', v == null);
    el.classList.toggle('new', fresh.includes(k));
    if (fresh.includes(k)) {
      el.classList.add('flash');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('flash')));
    }
  }
}

const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
function move(a, b, ms = 650) {
  if (reduce) { pkt = b; draw(); return Promise.resolve(); }
  return new Promise(done => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2;
      pkt = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
      draw();
      t < 1 ? requestAnimationFrame(step) : done();
    };
    requestAnimationFrame(step);
  });
}

async function request(h) {
  const g = geo(), inside = `${HOME[h].ip}:${PORT}`;
  lit = ['h' + h];
  header({ h0: inside, h1: SERVER, o0: null, o1: null });
  await move(g.home[h], g.router);
  let k = nat.findIndex(r => r.home === h);
  if (k < 0) k = nat.push({ home: h, port: nextPort++ }) - 1;
  hotRow = k;
  const outside = `${PUBLIC}:${nat[k].port}`;
  header({ o0: outside, o1: SERVER }, ['o0']);
  lit.push('s');
  await wait(700);
  await move(g.router, g.server);
  hotRow = -1;
  marks = [[[g.server[0] + 14, g.server[1] - 18], true]];
  await wait(500);
  marks = [];
  header({ h0: null, h1: null, o0: SERVER, o1: outside });
  await move(g.server, g.router);
  hotRow = k;
  header({ h0: SERVER, h1: inside }, ['h1']);
  await wait(700);
  await move(g.router, g.home[h]);
  pkt = null;
  hotRow = -1;
  marks = [[[g.home[h][0] + 16, g.home[h][1] - 18], true]];
}

async function stranger() {
  const g = geo();
  lit = ['x'];
  header({ h0: null, h1: null, o0: STRANGER, o1: `${PUBLIC}:8080` });
  await move(g.stranger, g.router);
  pkt = null;
  marks = [[[g.router[0] + 15, g.router[1] - 17], false]];
}

root.querySelectorAll('.key').forEach(key => key.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  marks = [];
  root.querySelectorAll('.key').forEach(k => { k.disabled = true; });
  const a = Number(key.dataset.a);
  await (a < 2 ? request(a) : stranger());
  draw();
  busy = false;
  root.querySelectorAll('.key').forEach(k => { k.disabled = false; });
}));
header({ h0: `${HOME[0].ip}:${PORT}`, h1: SERVER, o0: `${PUBLIC}:40001`, o1: SERVER }, ['o0']);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

图里手机和电脑碰巧都用了 51432 作为源端口。路由器分别映射成不同的公网端口，回包回来时正是靠这个端口号分清该转给谁。

所以前面说“转发时 IP 一路不变”，家用路由器的 NAT 算是个例外，源 IP 和源端口在这里都被改写了。

顺便说一句，家里买来叫“路由器”的盒子通常集成了好几样功能：交换机、无线接入点、路由器、NAT，再加上自动发地址的 DHCP。

NAT 的副作用是外面没法主动连进来。没主动发过包的连接在表里没有记录，外网来的包不知道转给谁，只能扔掉。这顺带挡掉不少攻击，但也让在家架服务或两台电脑 P2P 直连麻烦很多。P2P 软件常靠“打洞”，双方约好同时往对方的公网地址发包，各自在自家 NAT 上留下映射，对方的包就进得来了。

后来连每户一个公网 IPv4 都不够了，运营商又在外面套了一层运营商级 NAT（CGNAT），用专门预留的 `100.64.0.0/10`，开头 `traceroute` 第 2 跳就是它。现在很多家庭宽带压根没有独立公网 IP。

彻底的解法是 **IPv6**，128 位地址大到给地球上每粒沙子分一大把都够用，每台设备都能有公网地址。不过它和 IPv4 不兼容，迁移拖了二十多年，好在现在不少手机网络默认已走 IPv6。

## TCP：在不可靠的 IP 上保证可靠传输

IP 只管尽力送，不保证送达。包会因为路由器队列满被直接丢弃，也会因为走不同路径乱序，还可能重复或受干扰出错。每个 IP 包都像单独寄出的明信片，寄出去后网络中间节点就不管结果了。

让网络自己保证可靠也不是没人做过。电话网在通话前让沿途交换机预留专用线路，通话期间别人占不走，所以不会丢字。互联网走了分组交换的另一条路，数据切成一个个包各走各的，线路谁有数据谁用，路由器只管转发、转完就忘，不记任何连接状态。这样一条线能让成千上万人共用，路由器也简单，半路坏一台包绕过去就行。丢包、乱序的善后全推给两端主机处理，这就是**端到端原则**。

但下载文件要求一字节不差、顺序不乱。**TCP** 在不可靠的 IP 之上建起一条可靠字节流通道，这头按顺序塞进字节，那头按顺序原样读出来。

靠的是编号、确认和重传三件事。每个字节都编号，接收方据此排序和去重；接收方回 **ACK** 告知“下一个期望收到第几号”，前面的就都算确认了；发送方等太久没收到确认，就超时重发。

不过“发一个、等确认、再发下一个”太慢了。按跨洋 150 毫秒往返算，以太网一帧最多带 1500 字节（MTU），减去 IP 和 TCP 头各 20 字节，一包最多装 1460 字节，每秒只能发不到 7 个包，连 10 KB/s 都不到。因此 TCP 引入了**窗口**，允许一批未确认的包同时在路上跑，每确认一个，窗口往前滑一格就能再发新包。

下图按包编号简化示意（真实 TCP 按字节编号）。上排是发送方，灰格子已确认，框出来的是窗口；下排是接收方。画面停在 5 号丢了以后，6、7、8 虽然到了但还交不出去，三个重复 ACK 正往回传，要的都是 5 号：

```render html
<style>
  .tw { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .tw { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .ctl { display: flex; align-items: center; gap: 10px; flex: 1 1 200px; max-width: 320px; color: var(--muted); }
  .ctl output { min-width: 1em; color: var(--text); font: 600 14px var(--font-mono); }
  .ctl input { flex: 1; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .tw svg { display: block; width: 100%; height: auto; margin-top: 8px; overflow: visible; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  .who { fill: var(--muted); font-size: 12px; }
  .lane { stroke: var(--rule); stroke-dasharray: 1 5; }
  .cell { fill: none; stroke: var(--rule-strong); }
  .cell.acked { fill: var(--rule-strong); stroke: var(--rule-strong); }
  .cell.flying { fill: var(--accent-soft); stroke: var(--accent); }
  .cell.ready { stroke: var(--accent); stroke-dasharray: 3 3; }
  .cell.got { fill: var(--accent); stroke: var(--accent); }
  .cell.held { fill: var(--accent-soft); stroke: var(--accent); stroke-dasharray: 3 3; }
  .num { fill: var(--muted); font: 12px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .num.on { fill: var(--accent-ink); }
  .num.dark { fill: var(--text); }
  .num.inv { fill: var(--bg); }
  .win { fill: none; stroke: var(--accent); stroke-width: 2.4; }
  .data { fill: var(--accent); }
  .data.retx { fill: var(--accent-ink); }
  .ack { fill: var(--blue); }
  .pnum { fill: var(--bg); font: 600 11px var(--font-mono); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  .lost { fill: none; stroke: var(--muted); stroke-width: 2; stroke-linecap: round; }
  .clock { fill: var(--text); font: 600 14px var(--font-mono); text-anchor: end; }
  .clock tspan { fill: var(--muted); font: 12px var(--font-sans); }
  .legend { display: flex; flex-wrap: wrap; gap: 2px 18px; margin-top: 6px; color: var(--muted); font-size: 12.5px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { flex: none; width: 12px; height: 12px; border-radius: 3px; background: var(--accent); }
  .legend i.a { width: 16px; border-radius: 6px; background: var(--blue); }
  .legend i.r { background: var(--accent-ink); }
  .legend i.h { border: 1px dashed var(--accent); background: var(--accent-soft); }
</style>
<section class="tw" aria-label="滑动窗口：一批包同时在路上，丢了一个就靠重复 ACK 发现并重传">
  <div class="top">
    <div class="keys"><button type="button" class="key play">播放</button><button type="button" class="key again">重来</button><button type="button" class="key drop">打掉一个包</button></div>
    <label class="ctl"><span>窗口</span><output></output><input type="range" min="1" max="6" value="4" aria-label="窗口大小"/></label>
  </div>
  <svg role="img"></svg>
  <div class="legend">
    <span><i></i>数据</span>
    <span><i class="r"></i>重传</span>
    <span><i class="a"></i>ACK，数字是接着要的号</span>
    <span><i class="h"></i>先到的，等前面的</span>
  </div>
</section>
<script>
const N = 12, D = 1000, GAP = 170, RTO = 2 * D + 1000, DT = 10, T0 = 3900, LOSE_AT = .5;
const root = document.querySelector('.tw'), svg = root.querySelector('svg');
const playKey = root.querySelector('.play'), slider = root.querySelector('input');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let sim, width = 0, playing = false, last = 0, spare = 0;

function fresh(w) {
  return {
    t: 0, w, base: 1, next: 1, dup: 0, last: -1e9, timer: 0, retx: 0, recovery: false, recover: 0,
    expected: 1, held: new Set(), packets: [], marks: [], drop: new Set([5]),
  };
}

function send(s, n, retx) {
  const p = { kind: 'data', n, col: n - 1, t0: s.t, retx, lost: false };
  // 预设：5 号第一次发出时丢在半路
  if (!retx && s.drop.has(n)) { s.drop.delete(n); p.lost = true; p.lostAt = LOSE_AT; }
  s.packets.push(p);
  // 重发了，这个包的叉号就擦掉
  s.marks = s.marks.filter(m => m.kind !== 'data' || m.n !== n);
  s.last = s.t;
  if (s.base === n || s.next === s.base) s.timer = s.t;
}

function onData(s, p) {
  const k = p.n;
  if (k === s.expected) {
    s.expected++;
    while (s.held.delete(s.expected)) s.expected++;
  } else if (k > s.expected) s.held.add(k);
  s.packets.push({ kind: 'ack', n: s.expected, col: p.col, t0: s.t, lost: false });
}

function onAck(s, a) {
  if (a > s.base) {
    s.base = a;
    s.dup = 0;
    s.timer = s.t;
    // 补上一个洞后，如果后面还有洞，接着重传
    if (s.recovery && a < s.recover) s.retx = a;
    else s.recovery = false;
  } else if (a === s.base && s.base < s.next) {
    s.dup++;
    if (s.dup === 3 && !s.recovery) {
      s.retx = s.base;
      s.recovery = true;
      s.recover = s.next;
      s.timer = s.t;
    }
  }
}

function step(s) {
  s.t += DT;
  for (const p of s.packets) {
    if (p.done) continue;
    const f = (s.t - p.t0) / D;
    if (p.lost && f >= p.lostAt) {
      p.done = true;
      if (p.kind === 'data') s.marks.push({ n: p.n, col: p.col, f: p.lostAt, kind: p.kind });
    } else if (!p.lost && f >= 1) {
      p.done = true;
      p.kind === 'data' ? onData(s, p) : onAck(s, p.n);
    }
  }
  s.packets = s.packets.filter(p => !p.done);
  // 数据包的叉号留到它被重发或者被确认；打掉的 ACK 没人重发，叉号留一会儿就擦掉
  s.marks = s.marks.filter(m => (m.kind === 'data' ? m.n >= s.base : s.t - m.at < 1500));
  if (s.base <= N && s.base < s.next && s.t - s.timer >= RTO) {
    s.retx = s.base;
    s.timer = s.t;
  }
  if (s.t - s.last >= GAP) {
    if (s.retx) { send(s, s.retx, true); s.retx = 0; }
    else if (s.next <= N && s.next < s.base + s.w) send(s, s.next++, false);
  }
}

function geo() {
  const narrow = width < 460, pad = 2, cw = (width - 2 * pad) / N, ch = Math.min(28, cw - 4);
  const yS = 22, net = narrow ? 210 : 250, yR = yS + ch + net;
  return { pad, cw, ch, yS, yR, H: yR + ch + 24, size: Math.min(20, cw * .62), from: yS + ch, to: yR };
}

function draw() {
  const s = sim, g = geo(), cx = c => g.pad + (c + .5) * g.cw;
  let out = `<text class="who" x="${g.pad}" y="${g.yS - 8}">发送方</text><text class="who" x="${g.pad}" y="${g.yR + g.ch + 18}">接收方</text>`;
  out += `<text class="clock" x="${width - g.pad}" y="${g.yS - 8}">${(s.t / (2 * D)).toFixed(1)}<tspan dx="4">个来回</tspan></text>`;
  for (let c = 0; c < N; c++) out += `<line class="lane" x1="${cx(c)}" x2="${cx(c)}" y1="${g.from + 4}" y2="${g.to - 4}"/>`;
  for (let n = 1; n <= N; n++) {
    const x = cx(n - 1) - g.cw / 2 + 2, w = g.cw - 4;
    const sc = n < s.base ? 'acked' : n < s.next ? 'flying' : n < s.base + s.w ? 'ready' : '';
    out += `<rect class="cell ${sc}" x="${x}" y="${g.yS}" width="${w}" height="${g.ch}" rx="3"/>`;
    out += `<text class="num${sc === 'flying' || sc === 'ready' ? ' on' : sc === 'acked' ? ' dark' : ''}" x="${cx(n - 1)}" y="${g.yS + g.ch / 2}">${n}</text>`;
    const rc = n < s.expected ? 'got' : s.held.has(n) ? 'held' : '';
    out += `<rect class="cell ${rc}" x="${x}" y="${g.yR}" width="${w}" height="${g.ch}" rx="3"/>`;
    out += `<text class="num${rc === 'got' ? ' inv' : rc === 'held' ? ' on' : ''}" x="${cx(n - 1)}" y="${g.yR + g.ch / 2}">${n}</text>`;
  }
  // 窗口：从最早没确认的那个开始，往后 w 格
  const a = s.base, b = Math.min(N, s.base + s.w - 1);
  if (a <= N) out += `<rect class="win" x="${cx(a - 1) - g.cw / 2}" y="${g.yS - 4}" width="${(b - a + 1) * g.cw}" height="${g.ch + 8}" rx="5"/>`;
  for (const m of s.marks) {
    const x = cx(m.col), y = g.from + m.f * (g.to - g.from), r = 6;
    out += `<path class="lost" d="M${x - r} ${y - r}l${2 * r} ${2 * r}M${x + r} ${y - r}l${-2 * r} ${2 * r}"/>`;
  }
  const z = g.size;
  for (const p of s.packets) {
    const f = Math.min(1, (s.t - p.t0) / D), x = cx(p.col);
    const y = p.kind === 'data' ? g.from + f * (g.to - g.from) : g.to - f * (g.to - g.from);
    if (p.kind === 'data') out += `<rect class="data${p.retx ? ' retx' : ''}" x="${x - z / 2}" y="${y - z / 2}" width="${z}" height="${z}" rx="3"/>`;
    else out += `<rect class="ack" x="${x - z / 2 - 2}" y="${y - z / 2}" width="${z + 4}" height="${z}" rx="${z / 2}"/>`;
    if (z >= 15) out += `<text class="pnum" x="${x}" y="${y + .5}">${p.n}</text>`;
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = out;
  svg.setAttribute('aria-label', `窗口 ${s.w}：已确认到 ${s.base - 1} 号，接收方按顺序收到 ${s.expected - 1} 号，${s.held.size} 个先到的在等`);
}

const finished = () => sim.base > N && !sim.packets.length;

function frame() {
  if (!playing) return;
  // 按真实时间推进，不满一步的零头留到下一帧；切走再回来最多补 100 ms
  const now = performance.now();
  spare = Math.min(100, spare + Math.max(0, now - last));
  last = now;
  for (; spare >= DT; spare -= DT) step(sim);
  draw();
  if (finished()) return pause();
  requestAnimationFrame(frame);
}

function play() {
  if (finished()) sim = fresh(sim.w);
  playing = true;
  playKey.textContent = '暂停';
  last = performance.now();
  spare = 0;
  requestAnimationFrame(frame);
}
function pause() {
  playing = false;
  playKey.textContent = '播放';
}
function restart() {
  sim = fresh(Number(slider.value));
  draw();
  if (reduce) {
    while (!finished()) step(sim);
    return draw();
  }
  play();
}

playKey.addEventListener('click', () => (playing ? pause() : play()));
root.querySelector('.again').addEventListener('click', restart);
// 拖动时只改数字，松手再从头跑
slider.addEventListener('input', () => { root.querySelector('output').textContent = slider.value; });
slider.addEventListener('change', restart);
// 把一个还在路上的包打掉：当场拿走，原地留个叉
function knock(p) {
  const f = Math.min(1, (sim.t - p.t0) / D);
  sim.packets = sim.packets.filter(q => q !== p);
  sim.marks.push({ n: p.n, col: p.col, f: p.kind === 'data' ? f : 1 - f, kind: p.kind, at: sim.t });
  draw();
}
// 按钮挑的是飞得最久的数据包；路上没有数据包，就挑 ACK
root.querySelector('.drop').addEventListener('click', () => {
  const flying = sim.packets.filter(p => !p.lost);
  const data = flying.filter(p => p.kind === 'data'), pool = data.length ? data : flying;
  if (pool.length) knock(pool.reduce((a, b) => (a.t0 <= b.t0 ? a : b)));
});
// 也可以直接点空中的包
svg.addEventListener('pointerdown', e => {
  const g = geo(), box = svg.getBoundingClientRect(), k = width / box.width;
  const x = (e.clientX - box.left) * k, y = (e.clientY - box.top) * k;
  let best = null, bestD = Math.max(g.cw * .6, 22);
  for (const p of sim.packets) {
    if (p.lost) continue;
    const f = Math.min(1, (sim.t - p.t0) / D);
    const py = p.kind === 'data' ? g.from + f * (g.to - g.from) : g.to - f * (g.to - g.from);
    const d = Math.hypot(x - (g.pad + (p.col + .5) * g.cw), y - py);
    if (d < bestD) { best = p; bestD = d; }
  }
  if (best) knock(best);
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);

// 首帧：快进到 5 号刚丢、三个重复 ACK 正往回飞的时候
sim = fresh(4);
while (sim.t < T0) step(sim);
root.querySelector('output').textContent = slider.value;
</script>
```

前面丢了一个包，后面到得再多，接收方的 ACK 也只能一直要它。发送方连收三个重复 ACK 就不等超时直接重发，这叫**快速重传**。一两个重复 ACK 可能只是乱序晚到，三个基本就能断定丢包了。连重复 ACK 都等不来时（比如末尾几个包全丢），只能等超时。

图里飞行中的包可以直接点掉。平时丢一个 ACK 通常没事，因为 ACK 是累计确认的，后面的到了前面也就确认了。但要是打掉这三个重复 ACK 中的一个，发送方凑不够三个，就只能干等超时。

窗口设成 1 就退回了一来一回。想跑满带宽，窗口至少得装满一个往返的在途数据。100 Mbps、150 毫秒的线路一个往返能装约 1.9 MB，窗口小于这个数链路就填不满。

严格按序也有代价，前面缺一个，后面先到的只能在缓冲区干等、交不出去，这叫**队头阻塞**，讲 HTTP/3 时还会碰到。

另外常有人误解“粘包”。TCP 是无边界字节流，分两次写进 `hello` 和 `world`，对端可能一次读出 `helloworld`，也可能先读出 `hel`。TCP 本身不管消息边界，一条消息从哪到哪得由应用自己定，比如在前面加上长度字段。UDP 没有这个问题，发一次就是一个完整数据报，收到也是完整一个。

## 三次握手与四次挥手

TCP 里的“连接”是通信两端各自维护的一份状态，记着自己发到几号、对方发到几号、窗口多大，沿途路由器对此一无所知。传数据前，两边先把状态建起来并互报初始序号。初始序号各自随机选而不从 0 开始，免得跟之前同端口残留的旧包混在一起，也让外部没那么容易猜中伪造。

```text
客户端 → 服务器   SYN       seq=x
服务器 → 客户端   SYN+ACK   seq=y, ack=x+1
客户端 → 服务器   ACK       ack=y+1
```

双方各自报序号并确认收到，本来需要四步。服务器把确认（ACK）和自己的 SYN 合并进同一个包，于是成了三次握手。

为什么不能改成两次？隐患出在网络里滞留的旧包。客户端很早以前发过一个 SYN，卡在半路没回音，客户端早就超时放弃了，过了很久它才送到服务器：

```render html
<style>
  .hs { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .hs { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 20px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .hs svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .scrub { display: flex; align-items: center; gap: 10px; margin-top: 4px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .life { stroke: var(--rule-strong); stroke-width: 2; }
  .cursor { stroke: var(--rule-strong); stroke-dasharray: 2 4; }
  .who { fill: var(--text); font-size: 14px; font-weight: 600; text-anchor: middle; }
  .msg { fill: none; stroke: var(--text); stroke-width: 1.5; }
  .msg.old { stroke: var(--muted); stroke-dasharray: 5 4; }
  .msg.rst { stroke: var(--blue); }
  .head, .tip { fill: var(--text); }
  .head.old, .tip.old { fill: var(--muted); }
  .head.rst, .tip.rst { fill: var(--blue); }
  .lab { fill: var(--text); font: 12.5px var(--font-mono); }
  .lab.old { fill: var(--muted); }
  .lab.rst { fill: var(--blue); }
  .note { fill: var(--muted); font-size: 12.5px; }
  .x { stroke: var(--muted); stroke-width: 2; stroke-linecap: round; }
  .state { fill: var(--accent-soft); stroke: var(--accent); }
  .state-lab { fill: var(--accent-ink); font-size: 12.5px; }
  .q { fill: var(--muted); font-size: 16px; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
</style>
<section class="hs" aria-label="一个滞留很久的旧 SYN 到了服务器：两次握手会白白建立连接，三次握手能把它拒掉">
  <div class="top">
    <div class="seg" role="group" aria-label="握手方式">
      <button type="button" data-m="2" aria-pressed="true">两次握手</button>
      <button type="button" data-m="3" aria-pressed="false">三次握手</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <svg role="img"></svg>
  <label class="scrub"><span>时间</span><input type="range" min="0" max="1000" value="1000" aria-label="时间"/></label>
</section>
<script>
// 时间从上往下走，一共 END 格。旧 SYN 在 0.6 出发，1.2 卡在半路，5.4 才放行，6 到服务器
const END = 10, PLAY_MS = 6500;
const T = { syn: .6, stuck: 1.2, quit: 3, free: 5.4, arrive: 6, reply: 6.2, back: 7.4, rst: 7.6, idle: 8.6, drop: 8.8 };
const root = document.querySelector('.hs'), svg = root.querySelector('svg'), range = root.querySelector('input');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode = 2, width = 0, now = END, raf = 0;

function arrow(cls, x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = (d, s) => `${(x2 - Math.cos(a + d) * s).toFixed(1)},${(y2 - Math.sin(a + d) * s).toFixed(1)}`;
  return `<line class="msg ${cls}" x1="${x1}" y1="${y1}" x2="${x2 - Math.cos(a) * 6}" y2="${y2 - Math.sin(a) * 6}"/><polygon class="head ${cls}" points="${x2},${y2} ${p(.38, 10)} ${p(-.38, 10)}"/>`;
}

function draw() {
  if (!width) return;
  const narrow = width < 460, C = narrow ? 34 : width * .2, S = width - C, mid = (C + S) / 2;
  const top = 28, H = 352, y = t => top + t * (H - top - 8) / END;
  // 一段路：t1 出发，t2 到；还没走完时只画到当前位置，头上带一个圆点
  const part = (cls, x1, t1, x2, t2, head) => {
    if (now <= t1) return '';
    const f = Math.min(1, (now - t1) / (t2 - t1));
    const xb = x1 + (x2 - x1) * f, yb = y(t1) + (y(t2) - y(t1)) * f;
    if (f === 1 && head) return arrow(cls, x1, y(t1), xb, yb);
    return `<line class="msg ${cls}" x1="${x1}" y1="${y(t1)}" x2="${xb}" y2="${yb}"/>` + (f < 1 ? `<circle class="tip ${cls}" cx="${xb}" cy="${yb}" r="4"/>` : '');
  };
  const cross = (x, yy) => `<path class="x" d="M${x - 6} ${yy - 6}l12 12M${x + 6} ${yy - 6}l-12 12"/>`;

  let s = `<text class="who" x="${C}" y="16">客户端</text><text class="who" x="${S}" y="16">服务器</text>`;
  s += `<line class="life" x1="${C}" x2="${C}" y1="${top}" y2="${H - 6}"/><line class="life" x1="${S}" x2="${S}" y1="${top}" y2="${H - 6}"/>`;
  if (now < END) s += `<line class="cursor" x1="0" x2="${width}" y1="${y(now)}" y2="${y(now)}"/>`;

  // 旧 SYN：出门不久就卡在半路，很久以后才到
  s += part('old', C, T.syn, mid, T.stuck) + part('old', mid, T.stuck, mid, T.free) + part('old', mid, T.free, S, T.arrive, true);
  if (now > T.syn) s += `<text class="lab old" x="${C + 10}" y="${y(T.syn) - 6}">SYN seq=100</text>`;
  if (now > T.stuck + .6) s += `<text class="note" x="${mid + 10}" y="${y((T.stuck + T.free) / 2) + 4}">滞留</text>`;
  if (now >= T.quit) s += cross(C, y(T.quit)) + `<text class="note" x="${C + 12}" y="${y(T.quit) + 4}">超时放弃</text>`;

  // 服务器收到以后回 SYN+ACK
  s += part('', S, T.reply, C, T.back, true);
  if (now > T.reply) s += `<text class="lab" x="${mid}" y="${y((T.reply + T.back) / 2) + 20}" text-anchor="middle">SYN+ACK ack=101</text>`;

  const bx = S + 6, bw = 12;
  if (now > T.arrive) {
    // 服务器这头的状态：两次握手收到 SYN 就算连上了，三次握手还要等客户端确认
    const until = mode === 2 ? Math.min(now, END) : Math.min(now, T.drop);
    s += `<rect class="state" x="${bx}" y="${y(T.arrive)}" width="${bw}" height="${Math.max(1, y(until) - y(T.arrive))}" rx="2"/>`;
    if (mode === 3) s += `<text class="state-lab" x="${S - 8}" y="${y(T.arrive) + 34}" text-anchor="end">等确认</text>`;
  }
  if (mode === 2) {
    if (now >= T.back) s += `<text class="q" x="${C - 14}" y="${y(T.back)}">?</text>`;
    // 标签放在回信下面，免得和 SYN+ACK 的字挤在一起
    if (now >= T.idle) s += `<text class="state-lab" x="${S - 8}" y="${y(T.idle)}" text-anchor="end">已连接，空等</text>`;
  } else {
    s += part('rst', C, T.rst, S, T.drop, true);
    if (now > T.rst) s += `<text class="lab rst" x="${mid}" y="${y((T.rst + T.drop) / 2) + 20}" text-anchor="middle">RST</text>`;
    if (now >= T.drop) s += cross(bx + bw / 2, y(T.drop) + 10) + `<text class="note" x="${S - 10}" y="${y(T.drop) + 16}" text-anchor="end">释放</text>`;
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
}

function sync() {
  range.value = Math.round(now / END * 1000);
  draw();
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { now = END; return sync(); }
  const t0 = performance.now();
  const step = t => {
    now = Math.min(END, Math.max(0, (t - t0) / PLAY_MS * END));
    sync();
    if (now < END) raf = requestAnimationFrame(step);
  };
  now = 0;
  sync();
  raf = requestAnimationFrame(step);
}

function label() {
  svg.setAttribute('aria-label', mode === 2 ? '两次握手：服务器为旧 SYN 建立了连接，一直空等' : '三次握手：客户端回 RST，服务器释放半开的连接');
}

root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
  mode = Number(b.dataset.m);
  root.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  label();
  draw();
}));
root.querySelector('.play').addEventListener('click', play);
range.addEventListener('input', () => {
  cancelAnimationFrame(raf);
  now = range.value / 1000 * END;
  draw();
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
label();
</script>
```

客户端能认出这个确认不是自己要的，但两次握手下服务器发完就单方面算连上了，客户端没机会表态。多出来的第三步，就是留给它最终确认或发 RST 拒绝的。

关闭连接时，两个发送方向各自独立关：

```text
客户端 → 服务器   FIN
服务器 → 客户端   ACK
                  ……服务器把剩下的数据发完……
服务器 → 客户端   FIN
客户端 → 服务器   ACK       客户端进入 TIME_WAIT
```

一方发 FIN 表示“没有要发的数据了”，另一方可能还有数据没发完，先回 ACK，等自己发完再发 FIN，所以是四步。如果服务器刚好也没数据要发，中间的 ACK 和 FIN 也能合成一个包。

先关的一方回完最后一个 ACK 后还要等 `2 MSL` 才释放，这叫 `TIME_WAIT`。MSL 是包在网络里的最长存活时间，RFC 定为 2 分钟，Linux 直接把 `TIME_WAIT` 写死成 60 秒。要等两个原因：一是最后那个 ACK 万一丢了，对端重发 FIN 时这边还得在场补回；二是等够时间让旧连接留在路上的包过期，不会混进下一条复用同端口的新连接。

## 拥塞控制：在看不见路况时试探带宽

接收方的缓冲区有限，每个 ACK 里会带上剩余空位，叫接收窗口，发送方在途数据不能超过它。上层读得慢、空位变少，发送方就自动降速，这叫**流量控制**，保护的是接收方。

中间链路也会堵。路由器队列满了只会悄悄丢包，不会通知谁减速。大家一见丢包就拼命重传，很快就会把网络塞瘫。1986 年互联网真出过这事，劳伦斯伯克利实验室到几百米外的加州大学伯克利分校，吞吐量从 32 kbps 跌到了 40 bps。

1988 年，Van Jacobson 给 TCP 加上了**拥塞控制**。发送方自己维护拥塞窗口 `cwnd`，在途数据同时受限于接收窗口和 `cwnd`。由于不知道路有多宽，只能靠试探：

- **慢启动**：从很小起步（现在通常 10 个包），每过一个往返翻倍。名字叫慢，指数增长涨得很快。
- **拥塞避免**：超过阈值后改为每往返加 1。阈值最初很高，丢包后改成当时窗口的一半。
- **丢包处理**：出现丢包说明堵了，窗口砍半再慢慢加。若严重到超时，窗口直接打回起点重新慢启动。

这种线性加、乘性减的策略叫 AIMD，画出来是一把锯齿：

```render html title="示意：窗口和容量都按包数算，窗口从 1 起步；超过容量的那个来回算丢包"
<style>
  .cw { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .cw { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key[aria-pressed="true"] { border-color: var(--blue); color: var(--blue); }
  .ctl { display: flex; align-items: center; gap: 10px; flex: 1 1 200px; max-width: 340px; color: var(--muted); }
  .ctl output { min-width: 1.6em; color: var(--text); font: 600 14px var(--font-mono); }
  .ctl input { flex: 1; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .cw svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; }
  .grid { stroke: var(--rule); }
  .axis { stroke: var(--rule-strong); }
  .tick { fill: var(--muted); font: 11px var(--font-mono); }
  .ax { fill: var(--muted); font-size: 12px; }
  .ax.mono { font-family: var(--font-mono); }
  .cap { stroke: var(--text); stroke-width: 1.4; stroke-dasharray: 5 4; }
  .cap-lab { fill: var(--text); font-size: 12px; }
  .f1 { fill: none; stroke: var(--accent); stroke-width: 2.2; stroke-linejoin: round; }
  .f2 { fill: none; stroke: var(--blue); stroke-width: 2.2; stroke-linejoin: round; }
  .sum { fill: none; stroke: var(--muted); stroke-width: 1.2; stroke-dasharray: 1 3; }
  .drop { fill: var(--bg); stroke-width: 1.6; }
  .drop.a { stroke: var(--accent); }
  .drop.b { stroke: var(--blue); }
  .phase { fill: var(--muted); font-size: 12px; }
  .lab2 { fill: var(--blue); font-size: 12px; }
</style>
<section class="cw" aria-label="拥塞窗口随时间的变化：慢启动翻倍，之后每个来回加一，丢包砍半">
  <div class="top">
    <button type="button" class="key" aria-pressed="false">第二条连接</button>
    <label class="ctl"><span>容量</span><output></output><input type="range" min="16" max="64" value="40" aria-label="线路容量"/></label>
  </div>
  <svg role="img"></svg>
</section>
<script>
const ROUNDS = 64, YMAX = 80, JOIN = 22;
const root = document.querySelector('.cw'), svg = root.querySelector('svg'), slider = root.querySelector('input'), key = root.querySelector('.key');
let width = 0, two = false;

// 按来回模拟：总和超过容量，大家一起丢包、一起砍半
function simulate(cap) {
  const flows = [{ start: 0 }, ...(two ? [{ start: JOIN }] : [])].map(f => ({ ...f, cwnd: 1, ss: Infinity, pts: [], drops: [] }));
  const sum = [];
  for (let r = 0; r <= ROUNDS; r++) {
    const live = flows.filter(f => f.start <= r);
    live.forEach(f => f.pts.push([r, f.cwnd]));
    const total = live.reduce((s, f) => s + f.cwnd, 0);
    if (two) sum.push([r, total]);
    if (total > cap) {
      live.forEach(f => { f.drops.push([r, f.cwnd]); f.ss = Math.max(2, Math.floor(f.cwnd / 2)); f.cwnd = f.ss; });
    } else {
      live.forEach(f => { f.cwnd = f.cwnd < f.ss ? Math.min(f.cwnd * 2, f.ss) : f.cwnd + 1; });
    }
  }
  return { flows, sum };
}

function render() {
  const cap = Number(slider.value), narrow = width < 460;
  const L = 30, R = narrow ? 8 : 44, T = 12, H = narrow ? 240 : 280, B = 30;
  const x = r => L + r / ROUNDS * (width - L - R), y = v => T + (1 - Math.min(v, YMAX) / YMAX) * (H - T - B);
  const { flows, sum } = simulate(cap);
  let s = '';
  for (let v = 0; v <= YMAX; v += 20) s += `<line class="grid" x1="${L}" x2="${width - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  for (let r = 0; r <= ROUNDS; r += narrow ? 16 : 8) s += `<text class="tick" x="${x(r)}" y="${H - B + 16}" text-anchor="middle">${r}</text>`;
  s += `<line class="axis" x1="${L}" x2="${width - R}" y1="${y(0)}" y2="${y(0)}"/>`;
  s += `<text class="ax" x="${width - R}" y="${H - 2}" text-anchor="end">来回次数</text><text class="ax mono" x="${L + 6}" y="${T + 2}" dominant-baseline="hanging">cwnd</text>`;
  s += `<line class="cap" x1="${L}" x2="${width - R}" y1="${y(cap)}" y2="${y(cap)}"/>`;
  s += `<text class="cap-lab" x="${width - R}" y="${y(cap) - 6}" text-anchor="end">容量</text>`;
  if (two) s += `<polyline class="sum" points="${sum.map(([r, v]) => `${x(r)},${y(v)}`).join(' ')}"/>`;
  flows.forEach((f, i) => {
    s += `<polyline class="f${i + 1}" points="${f.pts.map(([r, v]) => `${x(r)},${y(v)}`).join(' ')}"/>`;
    f.drops.forEach(([r, v]) => { s += `<circle class="drop ${i ? 'b' : 'a'}" cx="${x(r)}" cy="${y(v)}" r="3.2"/>`; });
  });
  // 标出第一段慢启动
  const first = flows[0].drops[0];
  if (first) s += `<text class="phase" x="${x(first[0]) + 8}" y="${y(6)}">慢启动</text>`;
  if (two) s += `<text class="lab2" x="${x(JOIN) - 4}" y="${y(0) - 8}" text-anchor="end">加入</text>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  root.querySelector('output').textContent = cap;
  key.setAttribute('aria-pressed', String(two));
  svg.setAttribute('aria-label', `容量 ${cap}：窗口先翻倍冲过容量，之后在 ${Math.floor(cap / 2)} 到 ${cap} 之间锯齿形起落${two ? '；第二条连接加入后，两条逐渐平分' : ''}`);
}

slider.addEventListener('input', render);
key.addEventListener('click', () => { two = !two; render(); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(svg);
</script>
```

最左边陡的那段是慢启动，冲过容量触发首次丢包才停。之后每个齿都是一格格加到丢包，再一刀砍半。

点开“第二条连接”，让两条连接走同一段路。一起丢包砍半时，它们的差距缩小一半，接着一起加 1 差距不变，几个来回下来就会自动收敛到平分带宽，全程不需要互相协调。

现在 Linux 默认用 CUBIC，窗口按三次函数增长，在又宽又长的线路上恢复更快。Google 的 BBR 换了思路，不等丢包，而是直接估计带宽和最小延迟，按估算出的速度发送。

## DNS：把域名翻译成 IP

前面说的都得先知道对方的 IP。可没人记得住 `203.0.113.10`，平时用的是 `www.example.com`，负责把域名翻译成 IP 的就是 **DNS**。

全世界域名太多还天天在变，放不进一台服务器，所以 DNS 按层级从右往左分开管。根服务器知道每个顶级域（`com`、`cn`、`org` 等）归谁管，`com` 的服务器知道 `example.com` 归谁管，只有 `example.com` 自己的服务器才知道 `www.example.com` 的具体地址。每一级都不包揽，只负责把你指给下一级。

你的电脑不会亲自跑完这一圈，而是把问题交给**递归解析器**，由它逐级去查，拿到结果再交回来。解析器通常是运营商的，也可以换成 `223.5.5.5`、`8.8.8.8` 这类公共 DNS。找谁问是 DHCP 发地址时一起告诉电脑的，家用路由器常把自己报上去，收到后再转给运营商：

```render html
<style>
  .dn { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .dn { --blue: #95bfdc; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .dn svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .life { stroke: var(--rule-strong); stroke-width: 1.4; }
  .life.idle { stroke: var(--rule); stroke-dasharray: 2 4; }
  .who { fill: var(--text); font-size: 13px; text-anchor: middle; }
  .who.mono { font-family: var(--font-mono); }
  .who.idle { fill: var(--faint); }
  .tier { fill: var(--muted); font-size: 11.5px; text-anchor: middle; }
  .q { stroke: var(--text); stroke-width: 1.4; }
  .a { stroke: var(--accent); stroke-width: 1.8; }
  .qh { fill: var(--text); }
  .ah { fill: var(--accent); }
  .lab { font: 12px var(--font-mono); text-anchor: middle; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; stroke-linejoin: round; }
  .lab.q { fill: var(--muted); stroke-width: 4px; }
  .lab.a { fill: var(--accent-ink); }
  .lab.cn { font-family: var(--font-sans); }
  .tag { fill: var(--accent-ink); font-size: 12px; text-anchor: middle; }
  .tag-bg { fill: var(--accent-soft); }
  .time { fill: var(--text); font: 600 15px var(--font-mono); text-anchor: end; }
</style>
<section class="dn" aria-label="递归解析器从根开始一层层问，问到地址再交回来；缓存能省掉大部分步骤">
  <div class="seg" role="group" aria-label="查询场景">
    <button type="button" data-m="0" aria-pressed="true">第一次查</button>
    <button type="button" data-m="1" aria-pressed="false">再查一次</button>
    <button type="button" data-m="2" aria-pressed="false">查 mail.example.com</button>
  </div>
  <svg role="img"></svg>
</section>
<script>
const LANES = [['你'], ['解析器'], ['根'], ['com', 1], ['example.com', 1]];
// 每一步：从第几条线到第几条线、问还是答、标签；时间按往返示意：解析器 10 ms，根 30，com 40，example.com 150
const SCENES = [
  { steps: [[0, 1, 'q', 'www.example.com ?'], [1, 2, 'q', ''], [2, 1, 'a', '去问 com', 1], [1, 3, 'q', ''], [3, 1, 'a', '去问 example.com', 1], [1, 4, 'q', ''], [4, 1, 'a', '203.0.113.10'], [1, 0, 'a', '203.0.113.10']], ms: 230 },
  { steps: [[0, 1, 'q', 'www.example.com ?'], [1, 0, 'a', '203.0.113.10']], ms: 10, cached: true },
  { steps: [[0, 1, 'q', 'mail.example.com ?'], [1, 4, 'q', ''], [4, 1, 'a', '203.0.113.25'], [1, 0, 'a', '203.0.113.25']], ms: 160, cached: true },
];
const ROWS = 8, PER = 360;
const root = document.querySelector('.dn'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let scene = 0, width = 0, shown = 0, t0 = 0, frame = 0;

function draw(now = performance.now()) {
  const S = SCENES[scene], narrow = width < 460;
  // 窄屏时最右那条线往里收，给 example.com 留出位置
  const m = narrow ? 24 : Math.max(60, width * .09), right = narrow ? width - 46 : width - m;
  const gap = (right - m) / (LANES.length - 1), x = i => m + i * gap, top = 46, row = 34, H = top + 18 + ROWS * row + 28;
  const used = new Set(S.steps.flatMap(([a, b]) => [a, b]));
  const p = reduce ? 1 : Math.min(1, (now - t0) / PER);
  let s = '';
  LANES.forEach(([name, mono], i) => {
    const idle = !used.has(i);
    const end = narrow && i === LANES.length - 1;
    s += `<text class="who${mono ? ' mono' : ''}${idle ? ' idle' : ''}" x="${end ? width - 1 : x(i)}" y="18"${end ? ' style="text-anchor: end"' : ''}>${name}</text>`;
    s += `<line class="life${idle ? ' idle' : ''}" x1="${x(i)}" x2="${x(i)}" y1="${top - 14}" y2="${H - 30}"/>`;
  });
  if (S.cached) s += `<rect class="tag-bg" x="${x(1) - 19}" y="24" width="38" height="18" rx="3"/><text class="tag" x="${x(1)}" y="37">缓存</text>`;
  S.steps.forEach(([a, b, kind, label, cn], i) => {
    if (i > shown) return;
    const y = top + 18 + i * row, dir = Math.sign(b - a), x1 = x(a) + dir * 3, x2 = x(b) - dir * 3;
    const f = i === shown ? p : 1, xe = x1 + (x2 - x1) * f;
    s += `<line class="${kind}" x1="${x1}" x2="${xe - dir * 6}" y1="${y}" y2="${y}"/>`;
    s += `<polygon class="${kind}h" points="${xe},${y} ${xe - dir * 9},${y - 4} ${xe - dir * 9},${y + 4}"/>`;
    if (label && f === 1) {
      let lx = (x1 + x2) / 2;
      // 箭头比标签短时，标签挪到解析器右边
      if (a + b === 1 && label.length * 7.2 > gap - 12) lx = x(1) + 10 + label.length * 3.6;
      s += `<text class="lab ${kind}${cn ? ' cn' : ''}" x="${lx}" y="${y - 7}">${label}</text>`;
    }
  });
  if (shown >= S.steps.length - 1 && p === 1) s += `<text class="time" x="${width - 2}" y="${H - 6}">≈ ${S.ms} ms</text>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  if (p < 1) frame = requestAnimationFrame(draw);
  else if (shown < S.steps.length - 1) { shown++; t0 = now; frame = requestAnimationFrame(draw); }
}

function show(k, animate) {
  scene = k;
  root.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.m) === k)));
  svg.setAttribute('aria-label', `${SCENES[k].steps.length} 步，约 ${SCENES[k].ms} 毫秒`);
  cancelAnimationFrame(frame);
  shown = animate && !reduce ? 0 : SCENES[k].steps.length - 1;
  t0 = animate ? performance.now() : -1e9;
  if (width) draw();
}

root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => show(Number(b.dataset.m), true)));
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
show(0, false);
</script>
```

每条结果都带一个 TTL，标明能缓存多少秒（和 IP 头的 TTL 只是同名，两码事）。根和 `com` 的指引一般能缓存两天，热门域名的 IP 在解析器里几乎常年命中缓存，真正从根问起的时候很少。修改域名解析后常要等一阵才生效，也是各地缓存还没过期。

根服务器只有 13 个名字（`a.root-servers.net` 到 `m.root-servers.net`），背后是分布在全球的上千台机器。它们靠 Anycast 运作，同一个地址在全球多地同时通过 BGP 宣告，查询包自然落到最近的那台。

DNS 查询默认走 UDP 53 端口，明文且不验证来源，路上谁都能看到你在查什么，也能抢先回个假答案。为了补短板，后来有了给结果加签名的 DNSSEC，以及把查询装进加密连接的 DoH 和 DoT。

## HTTP：浏览器与服务器的对话

IP 拿到了，TCP 也连上了，浏览器可以正式发请求了。HTTP/1.1 报文是一段可读的纯文本：

```http
GET / HTTP/1.1
Host: www.example.com
Accept: text/html

```

服务器回的响应格式也差不多：

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 1256

<!doctype html>
<html>...
```

第一行是方法和路径（或者状态码），接着一行一个头，空一行后是正文。常见状态码里，200 表示成功，404 是没找到，301 是重定向，500 是服务器内部出错。

请求头里的 `Host` 看着多余，连接都已经建好了，干嘛还要报域名？因为同一个 IP 上常常跑着成百上千个网站，服务器得靠它分清你找的是哪一个。

HTTP 本身是无状态的，每个请求相互独立。网站要记住你已经登录，就会在响应里下发一个 Cookie，浏览器之后每次请求再原样带回去。

HTTP/1.1 在一条连接上同一时刻只能跑一个请求，前一个响应没收完，后一个就得排队。一个网页动辄上百个资源，浏览器只好对同一网站同时开好几条连接。HTTP/2 把一条连接分成多条流，把请求和响应切块交错发送，一条连接就能并发跑很多请求。

但这把 TCP 的队头阻塞放大了。TCP 只认字节顺序，不知道哪些字节属于哪个请求，丢一个包，后面到的不管属于谁全得干等。于是 HTTP/3 换掉了 TCP，改用跑在 UDP 上的 **QUIC**。QUIC 自己实现编号、确认和重传，每个请求一条独立的流，各自按序交付、互不拖累：

```render html title="示意：三个请求的数据轮流发，一格一个包，从左到右是到达的先后；3 号丢了，重传的那份最后才到"
<style>
  .hb { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; align-items: center; gap: 14px; }
  .key { flex: none; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .scrub { display: flex; flex: 1; min-width: 0; max-width: 360px; align-items: center; gap: 10px; color: var(--muted); }
  .scrub input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 32px; margin-top: 14px; }
  @media (max-width: 600px) { .panes { grid-template-columns: minmax(0, 1fr); } }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 12px; margin-bottom: 6px; color: var(--muted); }
  .head b { color: var(--text); font-size: 14px; font-weight: 650; }
  .head output { color: var(--text); font: 600 14px var(--font-mono); }
  .row { display: grid; grid-template-columns: 2.6em repeat(10, minmax(0, 1fr)); gap: 3px; align-items: center; margin-top: 3px; }
  .row > span { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .p { display: grid; place-items: center; height: 26px; border: 1px solid var(--rule-strong); border-radius: 3px; color: var(--faint); font: 12px var(--font-mono); font-style: normal; }
  .p.held { border: 1px dashed var(--accent); background: var(--accent-soft); color: var(--accent-ink); }
  .p.done { border-color: var(--accent); background: var(--accent); color: var(--bg); font-weight: 650; }
  .p.lost { border: 1px dashed var(--muted); color: var(--muted); text-decoration: line-through; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 14px; color: var(--muted); font-size: 12.5px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend .p { width: 18px; height: 14px; }
</style>
<section class="hb" aria-label="三个请求共用一条 TCP 连接时，丢一个包，后面到的数据不管是谁的都得等；QUIC 里只有丢包的那个请求在等">
  <div class="top">
    <button type="button" class="key play">播放</button>
    <label class="scrub"><span>时间</span><input type="range" min="0" max="10" step="1" value="9" aria-label="时间：到了第几个包"/></label>
  </div>
  <div class="panes">
    <div class="pane" data-p="tcp"><div class="head"><b>HTTP/2 · 一条 TCP 连接</b><span>浏览器拿到 <output></output></span></div></div>
    <div class="pane" data-p="quic"><div class="head"><b>HTTP/3 · QUIC</b><span>浏览器拿到 <output></output></span></div></div>
  </div>
  <div class="legend">
    <span><i class="p done"></i>交给了浏览器</span>
    <span><i class="p held"></i>到了，在等前面的</span>
    <span><i class="p lost"></i>丢了</span>
  </div>
</section>
<script>
const N = 9, LOST = 3, END = N + 1, NAMES = ['CSS', 'JS', '图片'];
const root = document.querySelector('.hb'), range = root.querySelector('input'), playKey = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, className, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
// 包轮流属于三个请求：1 号是 CSS 的，2 号是 JS 的，3 号是图片的，4 号又是 CSS 的
const rowOf = n => (n - 1) % NAMES.length;
// 每一列是一个时刻：前 9 列是 1 到 9 号依次到达，最后一列是重传的 3 号
const COLS = Array.from({ length: END }, (_, c) => (c < N ? c + 1 : LOST));
let t = N, timer = 0;

const panes = [...root.querySelectorAll('.pane')].map(pane => {
  const cells = [];
  NAMES.forEach((name, r) => {
    const row = el('div', 'row');
    row.append(el('span', '', name));
    COLS.forEach((n, c) => {
      const mine = rowOf(n) === r;
      const cell = row.appendChild(el('i', mine ? 'p' : '', mine ? String(n) : ''));
      if (mine) cells[c] = cell;
    });
    pane.append(row);
  });
  return { quic: pane.dataset.p === 'quic', cells, out: pane.querySelector('output') };
});

// 第 c 列的包在时刻 t 是什么状态
function state(c, quic) {
  const n = COLS[c];
  if (c + 1 > t) return '';
  if (c + 1 === LOST) return 'lost';
  if (c === N) return 'done';
  // 前面有洞就得等：TCP 看的是整条连接，QUIC 只看同一个请求
  const blocked = n > LOST && t < END && (!quic || rowOf(n) === rowOf(LOST));
  return blocked ? 'held' : 'done';
}

function render() {
  for (const { quic, cells, out } of panes) {
    let got = 0;
    cells.forEach((cell, c) => {
      const s = state(c, quic);
      cell.className = s ? `p ${s}` : 'p';
      if (s === 'done') got++;
    });
    out.textContent = `${got} / ${N}`;
  }
  range.value = t;
}

function stop() {
  clearTimeout(timer);
  timer = 0;
}
function tick() {
  t++;
  render();
  if (t >= END) return stop();
  // 重传到之前多停一会儿
  timer = setTimeout(tick, t === N ? 1800 : 550);
}
function play() {
  stop();
  if (reduce) { t = END; return render(); }
  t = 0;
  render();
  timer = setTimeout(tick, 550);
}

playKey.addEventListener('click', play);
range.addEventListener('input', () => { stop(); t = Number(range.value); render(); });
render();
</script>
```

3 号包装的是图片数据。左边 HTTP/2 里，CSS 和 JS 后面的包已经到了却被它挡住交不出去；右边 QUIC 里只有图片自己在等。

## 拆开一个真实的数据包

前面那个 GET 请求真正发出去时，网卡上走的字节流长这样：

```render html
<style>
  .by { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .by { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 20px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .dump { display: grid; grid-template-columns: auto auto auto; justify-content: start; gap: 0 14px; margin-top: 14px; font: 13px/1 var(--font-mono); }
  .off, .hex, .asc { display: grid; gap: 3px 0; }
  .off { color: var(--faint); }
  .off span { display: flex; align-items: center; height: 22px; }
  .hex { grid-template-columns: repeat(var(--n), 24px); }
  .asc { grid-template-columns: repeat(var(--n), 9px); }
  .b { display: flex; align-items: center; justify-content: center; height: 22px; color: var(--faint); cursor: pointer; }
  .hex .b.gap { margin-right: 6px; }
  .b.layer { color: var(--text); background: var(--accent-soft); }
  .b.layer.odd { background: color-mix(in srgb, var(--accent-soft) 55%, var(--accent) 22%); }
  .b.layer.pick { color: var(--bg); background: var(--accent); }
  .b.first { border-radius: 3px 0 0 3px; }
  .b.last { border-radius: 0 3px 3px 0; }
  .foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .step { flex: none; min-width: 38px; padding: 0; }
  .read { display: flex; flex: 1; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; min-width: 0; margin: 0; }
  .read b { color: var(--accent-ink); font-size: 14px; font-weight: 600; }
  .read span { color: var(--text); font: 500 14px var(--font-mono); overflow-wrap: anywhere; }
  @media (max-width: 520px) {
    .dump { grid-template-columns: auto auto; gap: 0 12px; }
    .off { display: none; }
    .hex { grid-template-columns: repeat(var(--n), 26px); }
  }
</style>
<section class="by" aria-label="一个发出 HTTP 请求的以太网帧，按字节看每一层的头">
  <div class="top">
    <div class="seg" role="group" aria-label="哪一层"></div>
    <button type="button" class="key tls" aria-pressed="false">HTTPS</button>
  </div>
  <div class="dump"><div class="off"></div><div class="hex"></div><div class="asc"></div></div>
  <div class="foot">
    <button type="button" class="key step" data-d="-1" aria-label="上一个字段">←</button>
    <button type="button" class="key step" data-d="1" aria-label="下一个字段">→</button>
    <p class="read" aria-live="polite"><b></b><span></span></p>
  </div>
</section>
<script>
const HTTP = 'GET / HTTP/1.1\r\nHost: www.example.com\r\nAccept: text/html\r\n\r\n';
const MAC_DST = [0x3c, 0x22, 0xfb, 0x91, 0x0a, 0x7e], MAC_SRC = [0xa4, 0x83, 0xe7, 0x2c, 0x51, 0x0d];
const IP_SRC = [192, 168, 1, 23], IP_DST = [203, 0, 113, 10];
const root = document.querySelector('.by');
const u16 = v => [v >> 8 & 255, v & 255], u32 = v => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];
const hex = b => b.toString(16).padStart(2, '0');
const num = b => b.reduce((v, x) => v * 256 + x, 0);

function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) sum += (bytes[i] << 8) + (bytes[i + 1] ?? 0);
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return ~sum & 0xffff;
}
function random(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 拼出整个帧，顺便记下每一层、每个字段占哪几个字节
function build(https) {
  const text = [...new TextEncoder().encode(HTTP)];
  let payload, appFields;
  if (https) {
    // TLS 记录：类型 23 是应用数据；密文 = 明文 + 1 字节类型 + 16 字节认证标签
    const r = random(7), len = text.length + 17;
    payload = [23, 3, 3, ...u16(len), ...Array.from({ length: len }, () => Math.floor(r() * 256))];
    appFields = [['TLS 记录头', 5, b => `应用数据，${num(b.slice(3))} 字节`], ['密文', len, b => `${b.length} 字节，看不出内容`]];
  } else {
    payload = text;
    appFields = [['请求', text.length, () => 'GET / HTTP/1.1 …']];
  }
  const tcp = [...u16(51432), ...u16(https ? 443 : 80), ...u32(0x7a3c19e2), ...u32(0x4b1d0f37), 0x50, 0x18, ...u16(64240), 0, 0, 0, 0];
  const pseudo = [...IP_SRC, ...IP_DST, 0, 6, ...u16(tcp.length + payload.length)];
  tcp.splice(16, 2, ...u16(checksum([...pseudo, ...tcp, ...payload])));
  const ip = [0x45, 0, ...u16(20 + tcp.length + payload.length), ...u16(0x1c46), 0x40, 0, 64, 6, 0, 0, ...IP_SRC, ...IP_DST];
  ip.splice(10, 2, ...u16(checksum(ip)));
  const bytes = [...MAC_DST, ...MAC_SRC, 8, 0, ...ip, ...tcp, ...payload];
  const mac = b => b.map(hex).join(':'), dotted = b => b.join('.');
  const spec = [
    ['以太网', [['目的 MAC', 6, mac], ['源 MAC', 6, mac], ['类型', 2, b => `0x${b.map(hex).join('')}，IPv4`]]],
    ['IP', [['版本和头长', 1, () => '4，20 字节'], ['服务类型', 1, () => '0'], ['总长度', 2, b => `${num(b)} 字节`], ['标识', 2, b => `0x${b.map(hex).join('')}`],
      ['标志和分片', 2, () => '不分片'], ['TTL', 1, b => `${b[0]}`], ['协议', 1, () => '6，TCP'], ['校验和', 2, b => `0x${b.map(hex).join('')}`],
      ['源 IP', 4, dotted], ['目的 IP', 4, dotted]]],
    ['TCP', [['源端口', 2, b => `${num(b)}`], ['目的端口', 2, b => `${num(b)}`], ['序号', 4, b => `${num(b)}`], ['确认号', 4, b => `${num(b)}`],
      ['头长', 1, () => '20 字节'], ['标志', 1, () => 'PSH，ACK'], ['窗口', 2, b => `${num(b)}`], ['校验和', 2, b => `0x${b.map(hex).join('')}`], ['紧急指针', 2, () => '0']]],
    [https ? 'TLS' : 'HTTP', appFields],
  ];
  let at = 0;
  const layers = spec.map(([name, fields]) => {
    const from = at;
    const fs = fields.map(([fname, len, show]) => {
      const f = { name: fname, from: at, to: at + len, show: () => show(bytes.slice(f.from, f.to)) };
      at += len;
      return f;
    });
    return { name, from, to: at, fields: fs };
  });
  return { bytes, layers };
}

let https = false, frame = build(false), layer = 1, field = 9, perRow = 16;
const seg = root.querySelector('.seg'), key = root.querySelector('.tls');

function render() {
  perRow = root.clientWidth < 520 ? 8 : 16;
  const { bytes, layers } = frame, L = layers[layer];
  root.style.setProperty('--n', perRow);
  const fieldOf = i => L.fields.findIndex(f => i >= f.from && i < f.to);
  const cls = i => {
    if (i < L.from || i >= L.to) return 'b';
    const k = fieldOf(i), f = L.fields[k];
    let c = 'b layer' + (k % 2 ? ' odd' : '') + (k === field ? ' pick' : '');
    if (i === f.from || i % perRow === 0) c += ' first';
    if (i === f.to - 1 || i % perRow === perRow - 1) c += ' last';
    return c;
  };
  const cells = (fn, gap) => bytes.map((b, i) => `<span class="${cls(i)}${gap && i % perRow === 7 && perRow === 16 ? ' gap' : ''}" data-i="${i}">${fn(b)}</span>`).join('');
  root.querySelector('.hex').innerHTML = cells(hex, true);
  root.querySelector('.asc').innerHTML = cells(b => (b >= 33 && b < 127 ? String.fromCharCode(b).replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`) : '·'), false);
  root.querySelector('.off').innerHTML = Array.from({ length: Math.ceil(bytes.length / perRow) }, (_, r) => `<span>${(r * perRow).toString(16).padStart(4, '0')}</span>`).join('');
  const f = L.fields[field];
  root.querySelector('.read b').textContent = f.name;
  root.querySelector('.read span').textContent = f.show();
  seg.querySelectorAll('button').forEach((b, i) => {
    b.textContent = layers[i].name;
    b.setAttribute('aria-pressed', String(i === layer));
  });
  key.setAttribute('aria-pressed', String(https));
}

['', '', '', ''].forEach((_, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.addEventListener('click', () => { layer = i; field = 0; render(); });
  seg.append(b);
});
root.querySelector('.dump').addEventListener('click', e => {
  const cell = e.target.closest('[data-i]');
  if (!cell) return;
  const i = Number(cell.dataset.i);
  layer = frame.layers.findIndex(l => i >= l.from && i < l.to);
  field = frame.layers[layer].fields.findIndex(f => i >= f.from && i < f.to);
  render();
});
// 一个字段一个字段往前、往后翻；翻过一层的头尾，就进相邻的那一层
root.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => {
  const layers = frame.layers;
  field += Number(b.dataset.d);
  if (field < 0) {
    layer = (layer + layers.length - 1) % layers.length;
    field = layers[layer].fields.length - 1;
  } else if (field >= layers[layer].fields.length) {
    layer = (layer + 1) % layers.length;
    field = 0;
  }
  render();
}));
key.addEventListener('click', () => {
  https = !https;
  frame = build(https);
  field = Math.min(field, frame.layers[layer].fields.length - 1);
  render();
});
new ResizeObserver(() => {
  const n = root.clientWidth < 520 ? 8 : 16;
  if (n !== perRow) render();
}).observe(root);
render();
</script>
```

一层套一层，每一层只看自己的头。交换机看 MAC，路由器看 IP，操作系统看端口，浏览器看 HTTP。这就是**分层**，上层不管下层怎么送，下层也不用看懂上层装了什么。所以同一个 HTTP 能跑在 Wi‑Fi、5G 和光纤上，以太网帧里也能装 IPv6 或其他协议。

教科书常把这套整理成五层：应用层、传输层、网络层、链路层和物理层。交换机在链路层，常叫二层设备；路由器在网络层，叫三层设备。OSI 模型是七层，多出的表示层和会话层在实际协议栈里基本都并进了应用层。

把五层画出来，最窄的一截正好是中间的 IP 层：

```render html
<style>
  .hg { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .hg svg { display: block; width: 100%; height: auto; overflow: visible; }
  .glass { fill: var(--rule); fill-opacity: .55; stroke: var(--rule-strong); stroke-width: 1.2; }
  .waist { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.4; }
  .w { fill: var(--text); font-size: 13.5px; text-anchor: middle; dominant-baseline: central; }
  .w.mono { font-family: var(--font-mono); font-size: 13px; }
  .ip { fill: var(--accent-ink); font: 700 16px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .layer { fill: var(--muted); font-size: 12px; dominant-baseline: central; }
</style>
<section class="hg" aria-label="沙漏：上面很多种应用，下面很多种线路，中间只有 IP">
  <svg role="img" aria-label="应用和传输在上，链路和物理在下，中间最窄处只有 IP"></svg>
</section>
<script>
// 每一层：层名、宽屏的词、窄屏的词；词全是名字，等宽字体的是协议
const ROWS = [
  ['应用层', ['HTTP', 'DNS', 'SSH', '邮件', '视频通话', '游戏'], ['HTTP', 'DNS', '邮件', '游戏']],
  ['传输层', ['TCP', 'UDP', 'QUIC'], ['TCP', 'UDP', 'QUIC']],
  ['网络层', ['IP'], ['IP']],
  ['链路层', ['以太网', 'Wi‑Fi', '4G/5G', '蓝牙'], ['以太网', 'Wi‑Fi', '5G']],
  ['物理层', ['网线', '光纤', '无线电', '卫星', '同轴电缆'], ['网线', '光纤', '无线电']],
];
const svg = document.querySelector('.hg svg');
let width = 0;

function render() {
  const narrow = width < 460, L = narrow ? 0 : 60, cx = L + (width - L) / 2, full = width - L;
  const rowH = 46, top = 6, H = top + ROWS.length * rowH + 6, waist = narrow ? 64 : 76;
  const mid = top + 2.5 * rowH;
  // 沙漏两边是弯的：越靠近 IP 收得越快
  const half = full / 2 - 2, neck = [mid - rowH / 2, mid + rowH / 2];
  const span = y => {
    const u = y < mid ? (neck[0] - y) / (neck[0] - top) : (y - neck[1]) / (H - 6 - neck[1]);
    return waist + (2 * half - waist) * Math.max(0, u) ** .55;
  };
  const side = (y0, y1) => Array.from({ length: 25 }, (_, i) => y0 + (y1 - y0) * i / 24);
  const bulb = (y0, y1) => {
    const ys = side(y0, y1);
    return `M${ys.map(y => `${(cx - span(y) / 2).toFixed(1)},${y.toFixed(1)}`).join('L')}L${ys.reverse().map(y => `${(cx + span(y) / 2).toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
  };
  let s = `<path class="glass" d="${bulb(top, neck[0])}"/><path class="glass" d="${bulb(neck[1], H - 6)}"/>`;
  s += `<rect class="waist" x="${cx - waist / 2}" y="${neck[0]}" width="${waist}" height="${rowH}" rx="3"/>`;
  ROWS.forEach(([name, wide, small], r) => {
    const y = top + (r + .5) * rowH;
    if (!narrow) s += `<text class="layer" x="0" y="${y}">${name}</text>`;
    if (r === 2) { s += `<text class="ip" x="${cx}" y="${y}">IP</text>`; return; }
    // 词在这一行的沙漏宽度里均匀摆开
    const room = span(y) * .84, words = narrow ? small : wide;
    words.forEach((w, i) => {
      const x = cx - room / 2 + room * (i + .5) / words.length;
      s += `<text class="w${/^[\x00-\x7f]+$/.test(w) ? ' mono' : ''}" x="${x}" y="${y}">${w}</text>`;
    });
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
}

new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(svg);
</script>
```

任何底层网络只要能送 IP 包就能接进来，任何应用只要会收发 IP 包就能跑在所有网络上。做通信线路的和写上层应用的不用打交道，5G 和短视频可以各自演进。

反过来，这截细腰也最难改，因为全世界都压在它上面。IPv6 推了二十多年依然不容易，难就难在这里。

换成 HTTPS 也是同样一层层套，只是最后那段载荷变成了密文，以太网、IP、TCP 头照样是明文。路上的人仍然知道你在和哪个 IP 的 443 端口通信，只是看不到具体内容。

## HTTPS：防止路上的人窃听与篡改

走明文 HTTP 时，路上每一跳都能读也能改。咖啡馆的 Wi‑Fi 和沿途路由器都能看见你提交的密码，早些年还有运营商往明文网页里插广告。

加密本身倒不难，双方握着同一把密钥，用 AES 这类对称加密既快又安全。难的是你和一台素未谋面的服务器，如何在全程可能被窃听的线路上商量出一把只有你们俩知道的密钥？

**Diffie–Hellman**（DH）密钥交换解决的正是这件事。拿调颜料打比方，把颜料混在一起容易，混好后几乎分不开：

1. 双方先公开约定一种公共色，路上的人也能看到。
2. 两边各自偷偷挑一种私密色，绝不告诉别人。
3. 各自把私密色混进公共色，把混好的那桶发给对方。
4. 收到对方发来的那桶后，再把自己的私密色混进去。

两边最后得到的都是“公共色 + 你的 + 我的”，完全一样。偷听者手里只有公共色和两桶混好的颜料，就算把两桶倒在一起，里面公共色也多了一份，颜色对不上：

```render html
<style>
  .dh { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 20px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .dh svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .who { fill: var(--text); font-size: 14px; font-weight: 600; text-anchor: middle; }
  .who.eve { fill: var(--accent-ink); }
  .col { stroke: var(--rule); stroke-dasharray: 2 5; }
  .sw { stroke: var(--text); stroke-opacity: .25; stroke-width: 1; }
  .sw.secret { stroke-opacity: .7; stroke-dasharray: 3 2; }
  .tex { fill: var(--text); font: 15px KaTeX_Main, var(--font-serif); text-anchor: middle; }
  .tex .v { font-family: KaTeX_Math, var(--font-serif); font-style: italic; }
  .msg { fill: none; stroke: var(--muted); stroke-width: 1.4; }
  .msg-head { fill: var(--muted); }
  .bond { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 5 4; }
  .eq { fill: var(--accent-ink); font: 17px KaTeX_Main, var(--font-serif); text-anchor: middle; dominant-baseline: central; }
  .ne { fill: var(--muted); font: 17px KaTeX_Main, var(--font-serif); text-anchor: middle; dominant-baseline: central; }
</style>
<section class="dh" aria-label="用调颜料比喻 Diffie–Hellman：偷听的人凑不出共享的颜色，中间人却能两头冒充">
  <div class="top">
    <div class="seg" role="group" aria-label="路上的人">
      <button type="button" data-m="listen" aria-pressed="true">偷听</button>
      <button type="button" data-m="mitm" aria-pressed="false">中间人</button>
    </div>
    <button type="button" class="key">换颜色</button>
  </div>
  <svg role="img"></svg>
</section>
<script>
const root = document.querySelector('.dh'), svg = root.querySelector('svg');
let mode = 'listen', width = 0, hues = { a: 210, b: 330, e: 265 };

// 颜料按吸光度混合：混进去的每一份都在，和顺序无关
function hsl(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}
const absorb = rgb => rgb.map(c => -Math.log(Math.max(c, .03)));
const PIG = () => ({ P: absorb(hsl(48, .9, .6)), a: absorb(hsl(hues.a, .75, .45)), b: absorb(hsl(hues.b, .75, .45)), e: absorb(hsl(hues.e, .55, .3)) });
function mix(parts) {
  const pig = PIG(), n = parts.length, k = [0, 1, 2].map(c => parts.reduce((s, p) => s + pig[p][c], 0) / n);
  return `rgb(${k.map(v => Math.round(255 * Math.exp(-v))).join(',')})`;
}
// 标签：字母用 KaTeX 斜体，加号用正体；相同字母合并成系数
function tex(parts) {
  const count = {};
  parts.forEach(p => { count[p] = (count[p] || 0) + 1; });
  return Object.entries(count).map(([p, c]) => `${c > 1 ? c : ''}<tspan class="v">${p}</tspan>`).join('<tspan>+</tspan>');
}

function draw() {
  const narrow = width < 460, r = narrow ? 15 : 19, X = [narrow ? 36 : width * .14, width / 2, width - (narrow ? 36 : width * .14)];
  const rows = [52, 116, 180, 260, 340], H = rows[4] + 64, mitm = mode === 'mitm', dx = narrow ? r + 22 : r + 14;
  let s = '';
  ['你', mitm ? '中间人' : '偷听的人', '服务器'].forEach((w, i) => { s += `<text class="who${i === 1 ? ' eve' : ''}" x="${X[i]}" y="18">${w}</text>`; });
  X.forEach(x => { s += `<line class="col" x1="${x}" x2="${x}" y1="28" y2="${H - 8}"/>`; });
  const blob = (x, y, parts, secret) => `<circle class="sw${secret ? ' secret' : ''}" cx="${x}" cy="${y}" r="${r}" fill="${mix(parts)}"/><text class="tex" x="${x}" y="${y + r + 17}">${tex(parts)}</text>`;
  const arrow = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), ex = x2 - Math.cos(a) * (r + 4), ey = y2 - Math.sin(a) * (r + 4), sx = x1 + Math.cos(a) * (r + 4), sy = y1 + Math.sin(a) * (r + 4);
    const p = (d, l) => `${(ex - Math.cos(a + d) * l).toFixed(1)},${(ey - Math.sin(a + d) * l).toFixed(1)}`;
    return `<line class="msg" x1="${sx}" y1="${sy}" x2="${ex - Math.cos(a) * 5}" y2="${ey - Math.sin(a) * 5}"/><polygon class="msg-head" points="${ex},${ey} ${p(.4, 9)} ${p(-.4, 9)}"/>`;
  };
  // 第一行：大家都知道公共色
  X.forEach(x => { s += blob(x, rows[0], ['P']); });
  s += blob(X[0], rows[1], ['a'], true) + blob(X[2], rows[1], ['b'], true);
  s += blob(X[0], rows[2], ['P', 'a']) + blob(X[2], rows[2], ['P', 'b']);
  if (!mitm) {
    // 两桶颜料交叉送到对面，路上的人各抄一份
    s += arrow(X[0], rows[2], X[2], rows[3]) + arrow(X[2], rows[2], X[0], rows[3]);
    s += blob(X[0], rows[3], ['P', 'b']) + blob(X[2], rows[3], ['P', 'a']);
    s += blob(X[1] - dx, rows[3], ['P', 'a']) + blob(X[1] + dx, rows[3], ['P', 'b']);
    s += blob(X[0], rows[4], ['P', 'a', 'b']) + blob(X[2], rows[4], ['P', 'a', 'b']) + blob(X[1], rows[4], ['P', 'P', 'a', 'b']);
    const y = rows[4] + r + 30;
    s += `<path class="bond" d="M${X[0]} ${rows[4] + r + 24}Q${X[1]} ${y + 22} ${X[2]} ${rows[4] + r + 24}"/>`;
    s += `<text class="ne" x="${(X[0] + X[1]) / 2 + 4}" y="${rows[4]}">≠</text><text class="ne" x="${(X[1] + X[2]) / 2 - 4}" y="${rows[4]}">≠</text>`;
  } else {
    s += blob(X[1], rows[1], ['e'], true) + blob(X[1], rows[2], ['P', 'e']);
    // 中间人截下两边的颜料，各回一桶自己的
    s += arrow(X[0], rows[2], X[1] - dx, rows[3]) + arrow(X[2], rows[2], X[1] + dx, rows[3]);
    s += arrow(X[1], rows[2], X[0], rows[3]) + arrow(X[1], rows[2], X[2], rows[3]);
    s += blob(X[0], rows[3], ['P', 'e']) + blob(X[2], rows[3], ['P', 'e']);
    s += blob(X[1] - dx, rows[3], ['P', 'a']) + blob(X[1] + dx, rows[3], ['P', 'b']);
    s += blob(X[0], rows[4], ['P', 'e', 'a']) + blob(X[2], rows[4], ['P', 'e', 'b']);
    s += blob(X[1] - dx, rows[4], ['P', 'a', 'e']) + blob(X[1] + dx, rows[4], ['P', 'b', 'e']);
    const y = rows[4] + r + 24;
    s += `<path class="bond" d="M${X[0]} ${y}Q${(X[0] + X[1] - dx) / 2} ${y + 22} ${X[1] - dx} ${y}"/>`;
    s += `<path class="bond" d="M${X[2]} ${y}Q${(X[2] + X[1] + dx) / 2} ${y + 22} ${X[1] + dx} ${y}"/>`;
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', mitm ? '中间人分别和两边各凑出一种共享颜色' : '两边凑出同一种颜色，偷听的人混出来的不一样');
}

root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.m;
  root.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  draw();
}));
// 换一组私密色，避开公共色的黄
root.querySelector('.key').addEventListener('click', () => {
  const pick = () => 90 + Math.random() * 260;
  hues.a = pick();
  do hues.b = pick(); while (Math.abs(hues.b - hues.a) < 60);
  do hues.e = pick(); while (Math.abs(hues.e - hues.a) < 45 || Math.abs(hues.e - hues.b) < 45);
  draw();
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

真正的算法把“混颜色”换成了模幂运算。先公开大素数 $p$ 和底数 $g$，你挑私密的 $a$ 并发出 $A=g^a \bmod p$，对方挑 $b$ 并发回 $B=g^b \bmod p$，两边再各算一次：

$$
B^a \bmod p = g^{ab} \bmod p = A^b \bmod p
$$

代组小数字试试，$p=23$、$g=5$、$a=6$、$b=15$，算出 $A=8$、$B=19$，两边最后都得到 $2$。偷听者知道 $p$、$g$、$A$、$B$，想反推 $a$ 得解离散对数。只要参数够大（$p$ 取两千多位，或者换成椭圆曲线），就算不动了。

但它只能防偷听，防不了冒充。把图切到“中间人”看看，攻击者不光听还会把包掉包，分别跟你和服务器各做一次交换。两边都以为在跟对面加密说话，结果全在跟中间人说，他解开看完再加密转出去，谁都察觉不到。

所以还得确认对面到底是谁，这靠**数字签名**和**证书**。

签名用一对公私钥，私钥自己留着，公钥公开。私钥签过的东西谁拿公钥都能验真伪，没有私钥却签不出来。握手时服务器用私钥给发出的 DH 数据签名，中间人换掉的数据就拿不出这个签名。

可公钥本身凭什么可信？中间人也能自己生成一对密钥冒充服务器。所以公钥要装进证书里，写明“`www.example.com` 的公钥是这个”，由证书颁发机构（CA）签名背书，CA 的公钥又由上一级 CA 签，一直追溯到根证书：

```text
根证书             装在操作系统和浏览器里
└─ 中间证书         由根签名
   └─ www.example.com   由中间证书签名，里面是服务器的公钥
```

根证书一共一百多个，随操作系统和浏览器预装好，是整条信任链的起点。浏览器顺着链条一级级验签，再核对域名和有效期，都对上了才相信对面就是 `www.example.com`。

TLS 1.3 把这些步骤压进了一个往返里：

```text
客户端 → 服务器   ClientHello：支持哪些算法，我的 DH 公开值
服务器 → 客户端   ServerHello：服务器的 DH 公开值
                  证书、签名、Finished（从这里开始已经加密）
客户端 → 服务器   Finished，紧跟着第一个 HTTP 请求
```

DH 算出的共享密钥再派生出对称密钥，之后的数据全用 AES 或 ChaCha20 加密。

不过握手开头仍有一样信息是明文的，ClientHello 里会用 SNI 写明你想访问的域名，好让同一个 IP 上的不同网站各自出示对应证书。所以路上的人仍知道你在访问哪个网站，只是看不到内容。正在推广的 ECH 就是用来把这一段也加密的。

## 回到浏览器地址栏

现在可以把开头那件事完整串一遍了。地址栏敲下 `https://www.example.com` 回车，底层大致按这个顺序走：

1. 查 DNS，拿到 `203.0.113.10`。
2. 对比前缀发现目标不在本网络，要走默认网关，先用 ARP 查出网关的 MAC。
3. 包逐跳出门，家里路由器做 NAT，运营商和骨干网按路由表转发，跨过海底光缆。
4. TCP 三次握手。
5. TLS 握手，验证书并商量出密钥。
6. 发 HTTP 请求，拿回 HTML。
7. 浏览器解析 HTML，发现还要 CSS、JS 和图片，接着发更多请求。

整套流程里最花时间的是往返次数，数据大小倒在其次。每次握手、每次依赖前一步的请求都得等一个往返，隔着太平洋一个往返就是 150 毫秒：

```render html
<style>
  .wf { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .ctl { display: flex; align-items: center; gap: 10px; max-width: 420px; margin-top: 6px; color: var(--muted); }
  .ctl output { min-width: 4.2em; color: var(--text); font: 600 14px var(--font-mono); }
  .ctl input { flex: 1; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .wf svg { display: block; width: 100%; height: auto; margin-top: 8px; overflow: visible; }
  .row { fill: var(--text); font: 13px var(--font-mono); dominant-baseline: central; }
  .grid { stroke: var(--rule); }
  .tick { fill: var(--muted); font: 11px var(--font-mono); text-anchor: middle; }
  .hand { fill: var(--rule-strong); }
  .dns { fill: var(--muted); fill-opacity: .55; }
  .req { fill: var(--accent); }
  .xfer { fill: var(--text); }
  .total { fill: var(--text); font: 600 16px var(--font-mono); dominant-baseline: central; }
  .bar-in { fill: var(--bg); font: 11px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
</style>
<section class="wf" aria-label="打开一个 HTTPS 网页时，各步各要几个来回">
  <div class="seg" role="group" aria-label="协议"></div>
  <label class="ctl"><span>往返</span><output></output><input type="range" min="5" max="250" step="5" value="150" aria-label="往返时间"/></label>
  <svg role="img"></svg>
</section>
<script>
// 每种组合：每一行要几个来回；DNS 假设解析器那边有缓存，来回 10 ms
const MODES = [
  ['HTTP/1.1 + TLS 1.2', [['TCP', 1], ['TLS', 2], ['HTTP', 1]]],
  ['HTTP/2 + TLS 1.3', [['TCP', 1], ['TLS', 1], ['HTTP', 1]]],
  ['HTTP/3', [['QUIC', 1], ['HTTP', 1]]],
  ['HTTP/3 再访问', [['QUIC', 0], ['HTTP', 1]]],
];
const DNS = 10, XFER = 8, MAX = 1100;
const root = document.querySelector('.wf'), svg = root.querySelector('svg'), slider = root.querySelector('input'), seg = root.querySelector('.seg');
let mode = 0, width = 0;

function render() {
  const rtt = Number(slider.value), narrow = width < 460, L = 52, R = narrow ? 70 : 90;
  const x = ms => L + ms / MAX * (width - L - R), rowH = 34, top = 8;
  const rows = [['DNS', null], ...MODES[mode][1]];
  const H = top + rows.length * rowH + 30;
  let s = '';
  for (let t = 0; t <= 1000; t += narrow ? 500 : 200) {
    s += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 24}"/><text class="tick" x="${x(t)}" y="${H - 8}">${t}${t ? '' : ' ms'}</text>`;
  }
  let t = 0;
  rows.forEach(([name, n], i) => {
    const y = top + i * rowH + rowH / 2, h = 18;
    s += `<text class="row" x="0" y="${y}">${name}</text>`;
    if (n === null) {
      s += `<rect class="dns" x="${x(0)}" y="${y - h / 2}" width="${Math.max(2, x(DNS) - x(0))}" height="${h}" rx="2"/>`;
      t = DNS;
      return;
    }
    // 一格一个来回，中间留一道缝，方便数
    for (let k = 0; k < n; k++) {
      const w = x(t + rtt) - x(t);
      s += `<rect class="${name === 'HTTP' ? 'req' : 'hand'}" x="${x(t) + .5}" y="${y - h / 2}" width="${Math.max(1.5, w - 1.5)}" height="${h}" rx="2"/>`;
      t += rtt;
    }
    if (name === 'HTTP') {
      s += `<rect class="xfer" x="${x(t)}" y="${y - h / 2}" width="${Math.max(1.5, x(t + XFER) - x(t))}" height="${h}" rx="1"/>`;
      t += XFER;
      s += `<text class="total" x="${x(t) + 10}" y="${y}">${Math.round(t)} ms</text>`;
    }
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', `${MODES[mode][0]}，往返 ${rtt} ms：约 ${Math.round(t)} ms 拿到网页`);
  root.querySelector('output').textContent = `${rtt} ms`;
  seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === mode)));
}

MODES.forEach(([name], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = name;
  b.addEventListener('click', () => { mode = i; render(); });
  seg.append(b);
});
slider.addEventListener('input', render);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(svg);
</script>
```

一个 100 KB 的网页在 100 Mbps 宽带上传完只要 8 毫秒。想让网页加载更快，要么减少往返次数，要么把单次往返变短。

减少往返靠协议演进。TLS 1.3 把握手从两个往返压到一个；QUIC 把传输和加密握手合成一次，访问过的网站还能 0-RTT，第一个包里就直接带上请求。

把往返变短的话，光速改不了，就只能把内容搬近。CDN 在各地机房、甚至运营商机房里放好网站副本，DNS 按你的位置返回最近那台的地址。所以打开大网站时，内容多半就在同一座城市里，一个往返只要几毫秒。

## 参考资料

- Kurose & Ross. *Computer Networking: A Top-Down Approach*。
- Saltzer, Reed & Clark. [End-to-End Arguments in System Design](https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf), 1984。
- [RFC 791](https://www.rfc-editor.org/rfc/rfc791)（IP）、[RFC 826](https://www.rfc-editor.org/rfc/rfc826)（ARP）、[RFC 2131](https://www.rfc-editor.org/rfc/rfc2131)（DHCP）、[RFC 768](https://www.rfc-editor.org/rfc/rfc768)（UDP）、[RFC 9293](https://www.rfc-editor.org/rfc/rfc9293)（TCP）。
- [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918)（私有地址）、[RFC 6598](https://www.rfc-editor.org/rfc/rfc6598)（`100.64.0.0/10`）、[RFC 4271](https://www.rfc-editor.org/rfc/rfc4271)（BGP-4）。
- [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034)、[RFC 1035](https://www.rfc-editor.org/rfc/rfc1035)（DNS）。
- [RFC 5681](https://www.rfc-editor.org/rfc/rfc5681)（TCP 拥塞控制）；Jacobson. [Congestion Avoidance and Control](https://ee.lbl.gov/papers/congavoid.pdf), 1988；Cardwell et al. [BBR: Congestion-Based Congestion Control](https://queue.acm.org/detail.cfm?id=3022184), 2016。
- Diffie & Hellman. New Directions in Cryptography, 1976；[RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)（TLS 1.3）。
- [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000)（QUIC）、[RFC 9114](https://www.rfc-editor.org/rfc/rfc9114)（HTTP/3）。
- RIPE NCC. [YouTube Hijacking: A RIPE NCC RIS case study](https://www.ripe.net/publications/news/industry-developments/youtube-hijacking-a-ripe-ncc-ris-case-study), 2008。
