---
title: "互联网是怎么连起来的"
description: "两台电脑拉根网线就能通信。几十亿台互不相识的机器，一个包是怎么找到对面的。"
pubDate: 2026-10-24
tags: ["计算机网络", "计算机基础", "面试"]
---

在深圳打开一个放在美国的网站，`traceroute` 能把一路经过的机器一台台列出来（地址都换成了示例地址）：

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

每一行是路上的一台机器，后面是到它走一个来回要多久。第 8 跳到第 9 跳，一下子多了 145 毫秒：中间隔着太平洋。

路上这 12 台路由器，没有一台知道完整的路线。每一台只看一眼包上的目的地址，决定下一步交给谁，然后就不管了。互联网没有中心，也没有一张总地图，几十亿台设备就靠这种接力连在一起。

下面从两台电脑、一根网线开始，一层一层往上搭。每加一层，都是因为下面那层解决不了某个问题。

## 一根线

两台电脑之间拉一根网线，就能互发数据。线上跑的只有 0 和 1：网线里是电压的高低，光纤里是光的明灭，Wi‑Fi 里是无线电波的变化。比特怎么变成信号，是物理层的事，这篇不展开。

描述一条线路，两个数就够了。**带宽**是每秒能塞进去多少比特，家里宽带说的 500 Mbps，就是每秒 5 亿个比特。**延迟**是一个比特从这头走到那头要多久。

带宽像路有多宽，延迟像路有多长。路修宽了，同时能跑的车多了，每辆车开到的时间却一点没变。

延迟的下限是光速。光在光纤里每秒跑 20 万公里左右，1 毫秒 200 公里。深圳到美国西海岸，海底光缆一趟一万多公里，单程 60 多毫秒，来回 130 毫秒上下。开头那 145 毫秒，大头就花在这里，带宽升级到多少都压不下去。

线上的比特是连续的一长串，接收方还得知道一段数据从哪开始、到哪结束、中间有没有被干扰出错。所以数据按块发，一块叫一个**帧**：开头有约定好的标记，末尾带一个校验码。收到以后算一遍，对不上就整帧扔掉。

## 一屋子电脑：交换机

三台电脑两两拉线，要 3 根；50 台要 1225 根。于是所有电脑都连到中间一个盒子上，由它转发。这个盒子叫**交换机**。

盒子得知道谁是谁。每块网卡出厂时都烧了一个全球唯一的编号，叫 **MAC 地址**，48 位，写成 6 个十六进制字节：

```text
3c:22:fb:91:0a:7e
```

前 3 个字节是厂商编号，后 3 个是厂商自己排的序号。

每一帧的开头都写着目的 MAC 和源 MAC。交换机收到一帧，查表看目的 MAC 在几号口，就只从那个口发出去。

这张表没人配，是交换机自己学的。每收到一帧，它就记下“这个源 MAC 是从几号口进来的”。要发往一个还没记住的地址，就从别的口各发一份，叫**泛洪**，地址对得上的那台收下，其余的扔掉。像新来的前台，第一次谁都不认识，只能挨个房间喊；喊过几回，谁坐哪间就都记住了。

```render html
<style>
  .sw { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .sw { --blue: #95bfdc; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .key b { margin-left: 6px; font-weight: 600; }
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
  run.targets = table.includes(run.dst) ? [run.dst] : NAMES.map((_, j) => j).filter(j => j !== run.src);
  lit = [run.src, ...run.targets];
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

目的 MAC 写成 `ff:ff:ff:ff:ff:ff` 的是**广播帧**，交换机永远泛洪，屋里每台都收得到。后面找人，就靠它。表里的条目几分钟不刷新就过期，电脑换了个口也能重新学到。

Wi‑Fi 也是这一层的东西。无线路由器里的无线接入点，干的就是交换机的活，只是线换成了无线电。

## 交换机连不了全世界

那把全世界的电脑都接上交换机，一层层串起来，行不行？

不行。MAC 地址是平的。它像身份证号，全国唯一，可光看号码，看不出这个人现在在哪。交换机只能一条一条地记：全世界几十亿块网卡，每台交换机都得记几十亿行；每碰到一个没见过的地址，还要泛洪到整个地球。

寄信就不这样。信封上写的是“广东省 深圳市 南山区 某路 某号”，这串地址分了层。北京的分拣中心只看“广东省”就知道该往南发，到了深圳再看区，到了区再看街道。没有哪个分拣中心需要认识全国每一户人家。

网络也需要这样一种地址：前半截说明在哪个网络，后半截说明是网络里的哪一台。这就是 IP 地址。

## IP 地址：前半截是网络

IPv4 地址是 32 位，每 8 位写成一个十进制数，用点隔开，比如 `192.168.1.23`。

前多少位算“网络”，要另外写明。`192.168.1.23/24` 是说前 24 位是网络号，后 8 位是主机号。前 24 位相同的地址都在同一个网络里，从 `192.168.1.0` 到 `192.168.1.255`，一共 256 个。老写法叫子网掩码：前 24 位全是 1，后 8 位全是 0，写出来就是 `255.255.255.0`，一个意思。

电脑要发包，先拿自己的前缀和目的地址比。前缀一样，说明对方就在同一个网络里，直接发；不一样，就交给**默认网关**，也就是连着外面的那台路由器。

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

主机号全是 0 的地址代表网络本身，全是 1 的是这个网络的广播地址，都不分给机器，所以一个 /24 能用的是 254 个。

“直接发”也得知道对方的 MAC，交换机只认 MAC。从 IP 查 MAC 靠 **ARP**：在屋里广播一声“谁是 192.168.1.1？告诉 192.168.1.23”，每台都收得到，只有 192.168.1.1 回话，把自己的 MAC 单独发回来。查到的会缓存一阵，`ip neigh` 能看到：

```text
192.168.1.1 dev eth0 lladdr 3c:22:fb:91:0a:7e REACHABLE
```

那电脑自己的 `192.168.1.23`、`/24` 和网关地址，又是谁定的？一般是连上网的那一刻，用 **DHCP** 问来的。电脑这时还没有地址，只能广播：

```text
电脑   → 广播     DISCOVER   有谁能给我分个地址？
路由器 → 电脑     OFFER      192.168.1.23/24 给你，网关和 DNS 都找 192.168.1.1
电脑   → 广播     REQUEST    那我就用这个了
路由器 → 电脑     ACK        定了，租期一天
```

地址是租的，到期前要续，所以换个 Wi‑Fi，地址就跟着变了。

## 一跳一跳：MAC 在换，IP 不变

目的地不在本网络，包就要经过一台台路由器。每台路由器至少连着两个网络，每个口都有自己的 MAC 和 IP。

过一跳是这样的：路由器收到一帧，拆掉 MAC 这层，看里面的目的 IP，查表决定下一跳，再套上一层新的 MAC 头发出去。源 IP 和目的 IP 一路不变，MAC 头每过一跳换一次。

像寄国际快递。包裹上的收件地址从头到尾不变；从你家到驿站是一辆三轮，驿站到分拨中心是一辆货车，再往后是飞机。每一段运输有自己的一张单子，只写“从这一站到下一站”，到站就撕掉换新的。

```render html
<style>
  .hp { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .hp { --blue: #95bfdc; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .hp svg { display: block; width: 100%; height: auto; margin-top: 14px; overflow: visible; }
  .link { stroke: var(--rule-strong); stroke-width: 2; }
  .link.on { stroke: var(--text); }
  .hit { stroke: transparent; stroke-width: 26; cursor: pointer; }
  .dev { fill: var(--bg-raised); stroke: var(--muted); stroke-width: 1.4; }
  .glyph { fill: none; stroke: var(--muted); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
  .name { fill: var(--text); font-size: 13px; }
  .ip { fill: var(--muted); font: 11.5px var(--font-mono); }
  .m { font: 12px var(--font-mono); dominant-baseline: central; }
  .m.src { fill: var(--accent-ink); }
  .m.dst { fill: var(--blue); }
  .pkt { fill: var(--accent); }
  .frame, .packet { position: relative; display: flex; flex-wrap: wrap; gap: 6px; border: 1.5px solid var(--rule-strong); border-radius: 6px; }
  .frame { margin-top: 22px; padding: 14px 6px 6px; }
  .packet { flex: 1 1 300px; padding: 14px 6px 6px; border-style: dashed; border-radius: 4px; }
  .f { display: grid; flex: 1 1 auto; padding: 4px 8px; border-radius: 3px; background: var(--bg-sunken); transition: background-color .9s; }
  .f small { color: var(--muted); font-size: 11.5px; line-height: 1.3; }
  .f span { color: var(--text); font: 500 13.5px var(--font-mono); white-space: nowrap; }
  .f.dst span { color: var(--blue); }
  .f.src span { color: var(--accent-ink); }
  .f.data { flex: 1 1 3em; }
  @media (max-width: 420px) { .f.data { display: none; } }
  .f.data span { color: var(--faint); }
  .f.flash { background: var(--accent-soft); transition: none; }
  .tag { position: absolute; top: -10px; left: 8px; padding: 0 5px; background: var(--bg); color: var(--muted); font-size: 12px; line-height: 18px; }
</style>
<section class="hp" aria-label="包经过两台路由器：MAC 头每段都换，IP 头不变">
  <div class="seg" role="group" aria-label="第几段"></div>
  <svg role="img"></svg>
  <div class="frame">
    <span class="tag">帧</span>
    <div class="f dst"><small>目的 MAC</small><span data-k="dst"></span></div>
    <div class="f src"><small>源 MAC</small><span data-k="src"></span></div>
    <div class="packet">
      <span class="tag">IP 包</span>
      <div class="f"><small>TTL</small><span data-k="ttl"></span></div>
      <div class="f"><small>源 IP</small><span>192.168.1.23</span></div>
      <div class="f"><small>目的 IP</small><span>203.0.113.10</span></div>
      <div class="f data"><small>数据</small><span>…</span></div>
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
const root = document.querySelector('.hp'), svg = root.querySelector('svg'), seg = root.querySelector('.seg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let hop = 0, width = 0, moveStart = 0, frame = 0;

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

function draw(now = performance.now()) {
  const pad = 22, xs = DEVICES.map((_, i) => pad + (width - 2 * pad) * i / (DEVICES.length - 1));
  const y = 44, H = 112, gap = width < 460 ? 17 : 14;
  let s = '';
  xs.slice(1).forEach((x, i) => {
    s += `<line class="link${i === hop ? ' on' : ''}" x1="${xs[i]}" x2="${x}" y1="${y}" y2="${y}"/>`;
    s += `<line class="hit" data-hop="${i}" x1="${xs[i] + 20}" x2="${x - 20}" y1="${y}" y2="${y}"/>`;
  });
  DEVICES.forEach((d, i) => {
    // 两头的设备把文字往里收，免得出界
    const [tx, anchor] = i === 0 ? [xs[i] - 20, 'start'] : i === DEVICES.length - 1 ? [xs[i] + 15, 'end'] : [xs[i], 'middle'];
    s += glyph(d, xs[i], y) + `<text class="name" x="${tx}" y="${y + 38}" text-anchor="${anchor}">${d.name}</text>`;
    if (d.ip) s += `<text class="ip" x="${tx}" y="${y + 56}" text-anchor="${anchor}">${d.ip}</text>`;
  });
  // 这一段两头的 MAC：源写在线上方靠左，目的写在线下方靠右
  const a = xs[hop], b = xs[hop + 1];
  s += `<text class="m src" x="${a + 22}" y="${y - gap}">${DEVICES[hop].right}</text>`;
  s += `<text class="m dst" x="${b - 22}" y="${y + gap}" text-anchor="end">${DEVICES[hop + 1].left}</text>`;
  const t = reduce ? 1 : Math.min(1, (now - moveStart) / 800), e = 1 - (1 - t) ** 2;
  const px = a + 24 + (b - a - 48) * e;
  s += `<rect class="pkt" x="${px - 9}" y="${y - 6}" width="18" height="12" rx="2"/>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  if (t < 1) frame = requestAnimationFrame(draw);
}

function show(k) {
  hop = k;
  const fields = { dst: DEVICES[k + 1].left, src: DEVICES[k].right, ttl: 64 - k };
  root.querySelectorAll('[data-k]').forEach(el => {
    const value = String(fields[el.dataset.k]);
    if (el.textContent && el.textContent !== value) {
      const box = el.parentElement;
      box.classList.add('flash');
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove('flash')));
    }
    el.textContent = value;
  });
  seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
  svg.setAttribute('aria-label', `第 ${k + 1} 段：源 MAC ${fields.src}，目的 MAC ${fields.dst}，TTL ${fields.ttl}`);
  cancelAnimationFrame(frame);
  moveStart = performance.now();
  if (width) draw();
}

DEVICES.slice(1).forEach((d, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${DEVICES[i].name} → ${d.name}`;
  b.addEventListener('click', () => show(i));
  seg.append(b);
});
svg.addEventListener('click', e => {
  const hit = e.target.closest('[data-hop]');
  if (hit) show(Number(hit.dataset.hop));
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
show(0);
</script>
```

最容易绕晕的是第一段：目的 MAC 是网关的，目的 IP 却是服务器的。帧交给下一站，包去往终点，两件事分开写。

IP 头里还有个 **TTL**，每过一台路由器减 1，减到 0 就扔掉，免得包在环路里永远转下去。

扔的同时，路由器会给源地址回一个 ICMP 的“超时”消息。`traceroute` 就利用了这一点：先发 TTL 为 1 的包，第一台路由器扔掉它、回信，就知道第一跳是谁；再发 TTL 为 2 的，问出第二跳；一路问到目的地。开头那两个星号，是那两台路由器被设置成了不回信。

## 路由表：最具体的那条说了算

路由器怎么“查表决定下一跳”？它有一张路由表，每行是一个网络前缀，和发往那里的包该交给谁：

```text
目的网络            下一跳          出口
203.0.113.0/24     10.0.0.2        eth1
203.0.113.0/25     10.0.0.6        eth2
0.0.0.0/0          198.51.100.1    eth0
```

一个地址常常同时落在好几行里。`203.0.113.10` 既在 `203.0.113.0/24` 里，也在 `203.0.113.0/25` 里，`0.0.0.0/0` 更是什么都包含。规则是**最长前缀匹配**：前缀越长，说得越具体，就听谁的。所以它走 eth2。`203.0.113.200` 不在那个 /25 里（/25 只到 .127），走 eth1。

`0.0.0.0/0` 的前缀长度是 0，匹配一切，但谁都比它长。它是默认路由，意思是“别的都不认识，就往这儿送”。家里的路由器基本只靠这一条：凡是出门的包，一律交给运营商。

## 路由表是谁填的

家里的路由器一条默认路由就够了。可运营商的骨干路由器，得知道全世界每个网络该往哪走，这张表从哪来？

没人统一下发。互联网是七万多个各自运营的网络拼起来的：运营商、云服务商、大学、大公司……每个叫一个**自治系统**（AS），有自己的编号。AS 内部怎么走，自己说了算，通常是路由器之间互相通报自己连着谁，每台都拼出整个 AS 的地图，再用 Dijkstra 算最短路，OSPF 就是这么干的。

AS 和 AS 之间靠 **BGP**，更像口口相传：

1. 拥有 `203.0.113.0/24` 的 AS 告诉邻居：“这个网络在我这儿。”
2. 邻居记下来，在路径前面加上自己的编号，再告诉它的邻居：“经过我，再经过它，能到。”
3. 一圈圈往外传。每个 AS 可能从好几个邻居那儿听到同一个网络，挑一条用，通常是经过的 AS 最少的那条。

收到的路径里要是已经有自己的编号，说明绕回来了，直接丢掉，这样就不会成环。

下图每个圈是一个 AS，箭头指着它选的下一跳，橙色那条是你的包实际走的路。每个 AS 只知道自己的箭头，整条路是一个个箭头接出来的：

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
<section class="bg" aria-label="BGP 路由宣告一圈圈传开；剪断光缆或者有人冒认前缀，各自的下一跳跟着变">
  <div class="keys">
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
// 每个 AS 现在指向的下一跳，和它最近一次改主意的时间
let next = [], changedAt = [], frame = 0;

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
  const now = performance.now(), r = routes();
  const far = Math.max(...r.map(x => (Number.isFinite(x.dist) ? x.dist : 0))) + 1;
  r.forEach((x, i) => {
    if (x.hop === next[i]) return;
    const delay = reduce ? 0 : (Number.isFinite(x.dist) ? x.dist : far) * STEP;
    setTimeout(() => { next[i] = x.hop; changedAt[i] = performance.now(); }, delay);
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
    if (age < 700) s += `<circle class="pulse" cx="${x}" cy="${y}" r="${g.r + age / 30}" stroke-opacity="${1 - age / 700}"/>`;
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
// 首帧直接是收敛好的样子
routes().forEach((x, i) => { next[i] = x.hop; });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

没有谁在指挥。哪根光缆断了，撤销的消息也是这样一圈圈传开，各自换一条路。

BGP 基本上是相信邻居说的话。2008 年，巴基斯坦电信想在国内封掉 YouTube，在 BGP 里宣告了 YouTube 的一个 /24，这比 YouTube 自己宣告的 /22 更具体。消息被上游转发到了全世界，按最长前缀匹配，各地发往 YouTube 的流量都被引去了巴基斯坦，YouTube 全球断了两个小时左右。现在有 RPKI 给“谁有权宣告哪个前缀”签名，还没完全普及。

选路也不只看远近。AS 之间是生意：小网络向大网络买**转接**，付钱让对方把自己的包送往全世界；规模差不多的网络互相**对等**，免费交换彼此用户之间的流量，常在互联网交换中心（IXP）拉根线直连。能走客户就不走对等，能走对等就不走自己付钱的上游，钱往往排在距离前面。最顶上的十几家一级运营商谁也不付钱给谁，彼此对等，撑起了骨干。

所以互联网没有设计图，是一份份合同拼出来的。洲与洲之间，主要靠海底的几百条光缆。

## 端口：交给哪个程序

IP 把包送到了机器上。可一台机器同时开着浏览器、微信、下载工具，这个包给谁？

再加一个编号：**端口**，16 位，0 到 65535。服务端程序守在固定的端口上，网页是 80 和 443，SSH 是 22，DNS 是 53；客户端每开一条连接，系统随手分一个临时端口。IP 是楼的地址，端口是房间号。

一条连接由四个数确定：源 IP、源端口、目的 IP、目的端口。浏览器开两个标签页连同一个网站，目的地一模一样，靠源端口区分，`ss -tn` 能看到：

```text
State  Recv-Q  Send-Q  Local Address:Port   Peer Address:Port
ESTAB  0       0       192.168.1.23:51432   203.0.113.10:443
ESTAB  0       0       192.168.1.23:51433   203.0.113.10:443
```

服务器那边也一样，成千上万个客户端都连它的 443，四元组各不相同，互不干扰。

只加端口、别的什么都不管，就是 **UDP**。它的头只有 8 个字节：源端口、目的端口、长度、校验和。丢了就丢了，乱了就乱了。听着简陋，可很多场合要的就是这个：DNS 查询一问一答，没回音重问一遍就行；视频通话里，晚到的画面不如不要。

## 一个公网地址，全家共用：NAT

32 位的 IPv4 只有 43 亿个地址，联网的设备远不止这么多。分配机构 2011 年就把最后几块发完了。

省地址的办法是**私有地址**。有三段地址被单独划了出来，公网上不路由，谁都能在自己家里随便用：

```text
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

你家有一个 `192.168.1.23`，我家也有一个，互不冲突，因为它们根本出不了门。出门靠路由器做 **NAT**（网络地址转换）：把包的源地址换成自己那个公网地址，源端口换成一个新号，在表里记下对应关系；回包来了，再按表换回去。

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

手机和电脑碰巧都用了源端口 51432。路由器给它们分了不同的公网端口，回包到了，靠的就是这个数分清该给谁。

所以前面说的“IP 一路不变”，家里的路由器是个例外：它改了源地址和源端口。

说到这儿，家里那个叫“路由器”的盒子，其实是好几样东西装在一起：交换机、无线接入点、路由器、NAT，再加一个发地址的 DHCP。

副作用是外面没法主动连进来。没出去过的连接，表里就没有记录，进来的包不知道该给谁，只能扔掉。这顺手挡掉了很多攻击，也让在家架服务器、两台电脑直连（P2P）麻烦了很多。P2P 软件靠“打洞”：两边约好同时往对方的公网地址发包，各自在自家的 NAT 上留下记录，对方的包就进得来了。

地址还是不够，运营商又在外面套了一层，叫运营商级 NAT（CGNAT），用的是专门划出来的 `100.64.0.0/10`。开头 `traceroute` 的第 2 跳就是它。很多家庭宽带，压根没有自己的公网 IP。

根本的解法是 **IPv6**：128 位，多到能给地球上每一粒沙子分一大把，每台设备都能有自己的公网地址。它和 IPv4 不兼容，迁移拖了二十多年，现在不少手机网络默认就走 IPv6 了。

## TCP：不丢、不乱

IP 只管尽力送，不保证送到。包会丢，路由器队列满了，后来的直接扔掉，这是最常见的；会乱序，前后两个包走了不同的路；也会重复，会在路上被干扰出错。每个包都像一张单独寄出的明信片，寄出去就没人管了。

为什么不让网络自己保证送到？电话网就是这么做的：打电话之前，沿途每台交换机给你留出一条线路，通话期间谁也占不走，所以从来不丢字。互联网走了另一条路：数据切成一个个包，各走各的，一条线谁有包谁用；路由器只管转发，转完就忘，不记任何连接。一条线因此能让成千上万人同时用，路由器也做得简单，中间坏了一台，包绕过去就是。丢包、乱序这些麻烦，全推给两头的电脑自己收拾，这叫**端到端原则**。

可下载一个文件，要的是一个字节不差、顺序不乱。**TCP** 在这些明信片之上造出一根可靠的管子：这头按顺序塞进字节，那头按顺序原样流出来。

办法说穿了很朴素。每个字节都编号，接收方据此排序、去重；接收方回 **ACK**，告诉对方“下一个我要第几号”，前面的就都算收到了；发送方等太久没等到确认，就再发一遍。

只是“发一个，等确认，再发下一个”太慢了。一个来回 150 毫秒，一个包最多装 1460 字节（以太网一帧最多带 1500 字节，叫 MTU，再减去 IP 头和 TCP 头各 20），一秒只能发 7 个包，不到 10 KB/s，网线再粗也没用。所以 TCP 允许一批还没确认的包同时在路上，这批的上限叫**窗口**。确认一个，窗口往前滑一格，就能再发一个。

下面每一列是一个包。上面一排是发送方：灰的已经确认，框起来的是窗口，窗口里涂了色的已经发出、还在等确认。往下掉的方块是路上的包，往上飘的蓝色小块是 ACK，上面的数字是接收方下一个想要的号。下面一排是接收方：实心的已经按顺序交给了程序，虚线框的先到了，在等前面的。5 号在半路丢了；空中的包点一下也能打掉：

```render html
<style>
  .tw { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .tw { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .keys { display: flex; gap: 8px; }
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
</style>
<section class="tw" aria-label="滑动窗口：一批包同时在路上，丢了一个就靠重复 ACK 发现并重传">
  <div class="top">
    <div class="keys"><button type="button" class="key play">播放</button><button type="button" class="key again">重来</button></div>
    <label class="ctl"><span>窗口</span><output></output><input type="range" min="1" max="6" value="4" aria-label="窗口大小"/></label>
  </div>
  <svg role="img"></svg>
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
  s.marks = s.marks.filter(m => m.n !== n);
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
// 点空中的包，把它打掉
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
  if (!best) return;
  best.lost = true;
  best.lostAt = Math.min(1, (sim.t - best.t0) / D) + .001;
  draw();
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

一个包丢了，后面的到得再多，接收方的 ACK 也只能一直要它。发送方连着收到三个重复的 ACK，不等超时就重发，这叫**快速重传**。一两个重复 ACK 可能只是乱序，晚一步就到；三个基本可以断定是丢了。连重复 ACK 都等不来时（比如最后几个包全丢了），只能等计时器超时。

打掉一个 ACK 往往什么事都没有：ACK 是累计的，后面的一到，前面的就都算确认了。

窗口是 1，就退回了一来一回的笨办法。窗口至少得装满一个来回：100 Mbps、150 毫秒的线路，一个来回能装 1.9 MB，窗口小于这个数，管子就填不满。

顺序也有代价。前面缺一个，后面先到的只能在缓冲区里干等，一个都交不出去，这叫**队头阻塞**，讲 HTTP/3 时还会碰到。

还有一点常被问：TCP 是字节流，不认“消息”。你分两次写进去 `hello` 和 `world`，对面可能一次读出 `helloworld`，也可能先读出 `hel`。这就是所谓的“粘包”。其实 TCP 本来就没有包的边界，一条消息从哪到哪，得由应用自己定，比如在前面先写上长度。

## 握手和挥手

开始传数据之前，双方得先对一下序号。初始序号不从 0 开始，而是各自随机挑，免得跟之前同一对端口上残留的旧包混在一起，也让别人没那么容易伪造。

```text
客户端 → 服务器   SYN       seq=x
服务器 → 客户端   SYN+ACK   seq=y, ack=x+1
客户端 → 服务器   ACK       ack=y+1
```

双方都要报出自己的序号，也都要听到对方确认收到，本来是四步。服务器的确认和它自己的 SYN 合进了同一个包，所以是三步。

为什么不能两步？麻烦出在网络里滞留的旧包。客户端很早以前发过一个 SYN，卡在了路上，等不到回音，客户端早就放弃了。过了很久，这个旧 SYN 才到服务器：

```render html
<style>
  .hs { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .hs { --blue: #95bfdc; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .hs svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .life { stroke: var(--rule-strong); stroke-width: 2; }
  .who { fill: var(--text); font-size: 14px; font-weight: 600; text-anchor: middle; }
  .msg { fill: none; stroke: var(--text); stroke-width: 1.5; }
  .msg.old { stroke: var(--muted); stroke-dasharray: 5 4; }
  .msg.rst { stroke: var(--blue); }
  .head { fill: var(--text); }
  .head.old { fill: var(--muted); }
  .head.rst { fill: var(--blue); }
  .lab { fill: var(--text); font: 12.5px var(--font-mono); }
  .lab.old { fill: var(--muted); }
  .lab.rst { fill: var(--blue); }
  .note { fill: var(--muted); font-size: 12.5px; }
  .stuck { fill: var(--muted); font-size: 12.5px; dominant-baseline: central; }
  .x { stroke: var(--muted); stroke-width: 2; stroke-linecap: round; }
  .state { fill: var(--accent-soft); stroke: var(--accent); }
  .state-lab { fill: var(--accent-ink); font-size: 12.5px; }
  .gone { fill: var(--rule); stroke: var(--rule-strong); }
  .q { fill: var(--muted); font-size: 16px; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
  .fade { animation: fade .5s ease-out; }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .fade { animation: none; } }
</style>
<section class="hs" aria-label="一个滞留很久的旧 SYN 到了服务器：两次握手会白白建立连接，三次握手能把它拒掉">
  <div class="seg" role="group" aria-label="握手方式">
    <button type="button" data-m="2" aria-pressed="true">两次握手</button>
    <button type="button" data-m="3" aria-pressed="false">三次握手</button>
  </div>
  <svg role="img"></svg>
</section>
<script>
const root = document.querySelector('.hs'), svg = root.querySelector('svg');
let mode = 2, width = 0;

function msg(cls, x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = (d, s) => `${(x2 - Math.cos(a + d) * s).toFixed(1)},${(y2 - Math.sin(a + d) * s).toFixed(1)}`;
  return `<line class="msg ${cls}" x1="${x1}" y1="${y1}" x2="${x2 - Math.cos(a) * 6}" y2="${y2 - Math.sin(a) * 6}"/><polygon class="head ${cls}" points="${x2},${y2} ${p(.38, 10)} ${p(-.38, 10)}"/>`;
}

function draw() {
  const narrow = width < 460, C = narrow ? 34 : width * .2, S = width - (narrow ? 34 : width * .2);
  const top = 28, H = 352, mid = (C + S) / 2;
  let s = `<text class="who" x="${C}" y="16">客户端</text><text class="who" x="${S}" y="16">服务器</text>`;
  s += `<line class="life" x1="${C}" x2="${C}" y1="${top}" y2="${H - 6}"/><line class="life" x1="${S}" x2="${S}" y1="${top}" y2="${H - 6}"/>`;
  // 旧 SYN：出门不久就卡在半路，很久以后才到
  const y0 = top + 16, yStuck = y0 + 22, yFree = 190, yArrive = 214;
  s += `<path class="msg old" d="M${C} ${y0}L${mid} ${yStuck}V${yFree}"/>` + msg('old', mid, yFree, S, yArrive);
  s += `<text class="lab old" x="${C + 10}" y="${y0 - 6}">SYN seq=100</text>`;
  s += `<text class="stuck" x="${mid + 10}" y="${(yStuck + yFree) / 2}">滞留</text>`;
  const yGive = 112;
  s += `<path class="x" d="M${C - 6} ${yGive - 6}l12 12M${C + 6} ${yGive - 6}l-12 12"/><text class="note" x="${C + 12}" y="${yGive + 4}">超时放弃</text>`;
  // 服务器回 SYN+ACK
  const ySa = yArrive + 6, yBack = ySa + 44;
  s += msg('', S, ySa, C, yBack);
  s += `<text class="lab" x="${(C + S) / 2}" y="${(ySa + yBack) / 2 + 20}" text-anchor="middle">SYN+ACK ack=101</text>`;
  const bw = 12, bx = S + 6;
  if (mode === 2) {
    s += `<g class="fade"><rect class="state" x="${bx}" y="${ySa}" width="${bw}" height="${H - 6 - ySa}" rx="2"/>`;
    s += `<text class="state-lab" x="${bx - 6}" y="${H - 14}" text-anchor="end">已连接，空等</text>`;
    s += `<text class="q" x="${C - 14}" y="${yBack}">?</text></g>`;
  } else {
    const yRst = yBack + 6, yGot = yRst + 44;
    s += `<g class="fade"><rect class="state" x="${bx}" y="${ySa}" width="${bw}" height="${yGot - ySa}" rx="2"/>`;
    s += `<text class="state-lab" x="${bx - 8}" y="${ySa + 34}" text-anchor="end">等确认</text>`;
    s += msg('rst', C, yRst, S, yGot) + `<text class="lab rst" x="${(C + S) / 2}" y="${(yRst + yGot) / 2 + 20}" text-anchor="middle">RST</text>`;
    s += `<path class="x" d="M${bx + bw / 2 - 6} ${yGot + 4}l12 12M${bx + bw / 2 + 6} ${yGot + 4}l-12 12"/>`;
    s += `<text class="note" x="${S - 10}" y="${yGot + 16}" text-anchor="end">释放</text></g>`;
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', mode === 2 ? '两次握手：服务器为旧 SYN 建立了连接，一直空等' : '三次握手：客户端回 RST，服务器释放半开的连接');
}

root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
  mode = Number(b.dataset.m);
  root.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  draw();
}));
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

客户端认得出这个确认不是自己要的，可两次握手里，它没有开口的机会。第三步就是留给它拒绝的。

关闭时，两个方向分开关：

```text
客户端 → 服务器   FIN
服务器 → 客户端   ACK
                  ……服务器把剩下的数据发完……
服务器 → 客户端   FIN
客户端 → 服务器   ACK       客户端进入 TIME_WAIT
```

一方发 FIN，意思是“我没有要发的了”，但对方可能还有话没说完，等它也说完了，再发自己的 FIN。所以是四步。服务器要是正好也没话说了，中间的 ACK 和 FIN 也能合成一个。

先关的一方回完最后一个 ACK，还要等 2 MSL 才真正释放，这个状态叫 TIME_WAIT。MSL 是一个包在网络里最多能活多久，RFC 里定的是 2 分钟，Linux 干脆把 TIME_WAIT 写死成 60 秒。要等，一是最后那个 ACK 万一丢了，对方会重发 FIN，这边得还在，才能再回一次；二是等够了时间，这条连接留在路上的旧包都过期了，不会混进下一条用同样端口的新连接。

## 拥塞控制：没人告诉你路有多宽

接收方的缓冲区是有限的。每个 ACK 里都带着它还剩多少空位，叫接收窗口，发送方在路上的数据不能超过这个数。应用读得慢，空位越来越少，发送方就自动慢下来。这叫**流量控制**，照顾的是接收方。

路上也会堵。路由器的队列满了，只会默默丢包，不会通知谁慢一点。要是大家一看丢包就更卖力地重传，网络就会被重传塞满，谁也送不到。1986 年互联网真出过这事：劳伦斯伯克利实验室到加州大学伯克利分校，相隔几百米，吞吐量从 32 kbps 掉到了 40 bps。

1988 年，Van Jacobson 给 TCP 加上了**拥塞控制**。发送方自己维护一个拥塞窗口 `cwnd`，在路上的数据既不能超过接收窗口，也不能超过它。它不知道路有多宽，只能试：

- **慢启动**：从很小开始（现在一般是 10 个包），每过一个来回翻一倍。名字叫慢，其实涨得飞快。
- **拥塞避免**：过了一个阈值以后，每个来回只加 1。
- **丢包**：说明堵了，窗口砍半，接着慢慢往上加。要是一直等到超时，说明堵得厉害，窗口直接打回起点，重新慢启动。

加法慢慢加，乘法一刀砍，叫 AIMD。画出来是一把锯子：

```render html
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

两条连接走同一段路时，一起砍半，差距就缩小一半；一起加 1，差距不变。来回几次，两条就差不多平分了带宽。谁也没跟谁商量，结果却是公平的。

现在 Linux 默认用 CUBIC，窗口按三次函数长，在又宽又长的线路上恢复得更快。Google 的 BBR 换了思路，不等丢包，直接估计带宽和最小延迟，按估出来的速度发。

## DNS：名字换地址

上面这一切，都得先知道对方的 IP。可没人记得住 `203.0.113.10`，大家记的是 `www.example.com`。把名字换成 IP 的，是 **DNS**。

全世界的名字太多，还天天在变，放不进一台服务器。DNS 按名字的层级分开管，从右往左读：根知道每个顶级域（`com`、`cn`、`org`……）归谁管；`com` 的服务器知道 `example.com` 归谁管；只有 `example.com` 自己的服务器，才知道 `www.example.com` 的地址。每一层只管把你指给下一层，像问路时听到的“我不清楚，你去问他”。

你的电脑不自己跑这一圈。它把问题丢给一个**递归解析器**，运营商的（地址是 DHCP 一起发的），或者 `223.5.5.5`、`8.8.8.8` 这种公共的，由解析器挨个去问，问到了再交回来：

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

每个答案都带一个 TTL，说明能缓存多少秒。根和 `com` 给出的指引一般能缓存两天，热门网站的地址在解析器里几乎总是现成的，所以真正从根问起的时候很少。改了域名解析要过一阵才生效，也是因为各地的缓存还没过期。

根服务器只有 13 个名字，`a.root-servers.net` 到 `m.root-servers.net`，背后是分布在全球的上千台机器。它们用 anycast：同一个地址在很多地方同时用 BGP 宣告，你的查询自然就落到最近的那台。

DNS 查询默认走 UDP 的 53 端口，明文，不加密也不验证。路上谁都能看见你在查什么，也能抢先回你一个假答案。DNSSEC 给答案加签名，DoH 和 DoT 把查询装进加密连接。

## HTTP：浏览器说的话

地址有了，TCP 也连上了，浏览器终于可以开口。HTTP 是一段纯文本：

```http
GET / HTTP/1.1
Host: www.example.com
Accept: text/html

```

服务器回：

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 1256

<!doctype html>
<html>...
```

第一行是方法和路径，或者状态码；接着一行一个头；空一行，后面是正文。200 是成功，404 是没找到，301 是搬家了，500 是服务器自己出了错。

`Host` 看着多余：连都连上了，还报什么名字？因为同一个 IP 上常常跑着成百上千个网站，服务器要靠它知道你找的是哪个。

HTTP 本身不记事，每个请求都是独立的。网站要记住“你已经登录了”，就在响应里塞一个 Cookie，浏览器之后每次请求都原样带回去。

## 拆开一个包

上面那个 GET 请求真正发出去时，网卡上走的是这样一串字节：

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
  .read { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; min-height: 28px; margin-top: 12px; }
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
    <button type="button" class="key" aria-pressed="false">HTTPS</button>
  </div>
  <div class="dump"><div class="off"></div><div class="hex"></div><div class="asc"></div></div>
  <p class="read" aria-live="polite"><b></b><span></span></p>
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
const seg = root.querySelector('.seg'), key = root.querySelector('.key');

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

一层套一层，每层只读自己的头。交换机看 MAC，路由器看 IP，操作系统看端口，浏览器看 HTTP。这就是**分层**：上面的层不管下面怎么送，下面的层也不用看懂上面装的是什么。所以同一个 HTTP 能跑在 Wi‑Fi、5G、光纤上，以太网的帧里也能装 IPv6 或者别的协议。

教科书把它整理成五层：应用层、传输层、网络层、链路层、物理层。交换机工作在链路层，常叫二层设备；路由器在网络层，叫三层设备。OSI 模型是七层，多出来的表示层和会话层，实际上都被应用层吃掉了。

五层里最窄的，是中间那层：

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

上面的应用千千万，下面的线路五花八门，中间只有一个 IP。任何网络，只要能把 IP 包从一头送到另一头，就能接进来；任何应用，只要会用 IP，就能跑在所有网络上。互联网的“互联”，靠的就是大家在这一层说同一种话。

反过来，细腰也最难改：全世界都压在它上面。IPv6 推了二十多年，难就难在这里。

HTTPS 也是这么一层层套，只是最后那段成了乱码，以太网、IP、TCP 的头照样是明文。路上的人仍然知道你在跟哪个 IP 的 443 端口说话，只是不知道说了什么。

## HTTPS：路上的人看不见

明文的 HTTP，路上每一跳都能读，也都能改。咖啡馆的 Wi‑Fi、经过的每台路由器，都看得见你提交的密码；早些年还有运营商往网页里插广告。

加密本身不难。双方手里有同一把密钥，用 AES 这类对称加密，又快又安全。难的是，你跟一台从没见过的服务器，怎么商量出一把只有你俩知道的密钥？你们说的每一句话，路上都有人在听。

**Diffie–Hellman** 密钥交换解决的就是这件事。拿调颜料打个比方，颜料混起来容易，混好了却几乎分不开：

1. 先公开约定一种颜色，谁都知道。
2. 两边各自偷偷挑一种颜色，谁也不告诉。
3. 各自把私密色混进公共色，把混好的那桶发给对方。
4. 各自把私密色再混进对方发来的那桶。

两边最后得到的都是“公共色 + 你的 + 我的”，一模一样。偷听的人只看到公共色和两桶混好的颜料，他能做的只是把两桶倒在一起，可那里面公共色多了一份，颜色就不对：

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

真正的版本把“混颜色”换成了取模的乘方。公开一个大素数 $p$ 和底数 $g$；你挑私密的 $a$，发出 $A=g^a \bmod p$；对方挑 $b$，发回 $B=g^b \bmod p$。两边各算一次：

$$
B^a \bmod p = g^{ab} \bmod p = A^b \bmod p
$$

拿小数字试试：$p=23$，$g=5$，$a=6$，$b=15$，算出 $A=8$，$B=19$，两边最后都得到 $2$。偷听的人知道 $p$、$g$、$A$、$B$，想算出 $a$ 得解离散对数。数字一大（$p$ 取两千多位，或者换成椭圆曲线），就算不动了。

但它只防偷听，防不了冒充。中间人不光听，还把包换掉，跟你做一次交换，再跟服务器做一次。两边都以为在跟对方说话，其实都在跟他说。他收到什么，解开、看完、再加密转发过去，谁也察觉不到。

所以还得确认对面到底是谁，这靠**数字签名**和**证书**。

签名用的是一对密钥，私钥自己留着，公钥公开。私钥签过的东西，谁拿公钥都能验证，可没有私钥就签不出来。握手时，服务器用私钥给自己发出的 DH 数据签个名，中间人换掉的数据上就没有这个签名。

可公钥本身凭什么信？中间人也能自己生成一对密钥，说这就是服务器的公钥。所以公钥要装在证书里。证书写着“`www.example.com` 的公钥是这个”，由证书颁发机构（CA）签名；CA 的公钥又由上一级 CA 签，一直到根证书：

```text
根证书             装在操作系统和浏览器里
└─ 中间证书         由根签名
   └─ www.example.com   由中间证书签名，里面是服务器的公钥
```

根证书一共一百多个，随系统和浏览器一起装好，是整条信任链的起点。浏览器顺着链子一级级验签，再核对证书上的域名和有效期，都对上了，才相信对面就是 `www.example.com`。

TLS 1.3 把这些压进了一个来回：

```text
客户端 → 服务器   ClientHello：支持哪些算法，我的 DH 公开值
服务器 → 客户端   ServerHello：服务器的 DH 公开值
                  证书、签名、Finished（从这里开始已经加密）
客户端 → 服务器   Finished，紧跟着第一个 HTTP 请求
```

DH 算出的共享密钥再派生出对称密钥，之后的数据全用 AES 或 ChaCha20 加密。

有一样东西还是明文：ClientHello 里要写明你想访问的域名，叫 SNI，好让同一个 IP 上的网站各自出示自己的证书。所以路上的人知道你在访问哪个网站，只是看不到内容。正在推广的 ECH 会把这一段也加密。

## 回到地址栏

现在能把开头那件事完整走一遍了。地址栏里敲下 `https://www.example.com`，回车：

1. 查 DNS，拿到 `203.0.113.10`。
2. 目的地不在本网络，要交给网关，先用 ARP 问出网关的 MAC。
3. 包一跳一跳出门：家里的路由器做 NAT，运营商和骨干网按路由表转发，跨过海底光缆。
4. TCP 三次握手。
5. TLS 握手，验证证书，商量出密钥。
6. 发 HTTP 请求，拿回 HTML。
7. 浏览器解析 HTML，发现还要 CSS、JS、图片，接着发更多请求。

这里面最花时间的，往往不是数据量，而是来回的次数。每次握手、每次请求，都得等一个来回；隔着太平洋，一个来回就是 150 毫秒。

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

一个 100 KB 的网页，在 100 Mbps 的宽带上传完只要 8 毫秒。想让网页快，要么少几个来回，要么让来回变短。

少几个来回：TLS 1.3 把握手从两个来回压到一个。HTTP/3 底下换成了 QUIC，跑在 UDP 上，把传输和加密的握手合成一次；访问过的网站还能 0-RTT，第一个包里就带上请求。QUIC 顺手也解决了队头阻塞：HTTP/2 把一个页面的所有请求塞进同一条 TCP 连接，丢一个包，所有请求一起等；QUIC 里每个请求是一条独立的流，丢了谁只耽误谁。

让来回变短：光速改不了，那就把内容搬近。CDN 在各地的机房里，甚至运营商的机房里，放好网站的副本，DNS 按你在哪返回最近那台的地址。你打开的大网站，内容多半就在同一座城市里，来回只要几毫秒。

## 面试常问

<details>
<summary>从输入网址到页面显示，发生了什么？</summary>

DNS 解析出 IP；判断不在本网络，ARP 拿到网关的 MAC；包经过 NAT 和一路路由器到达服务器；TCP 三次握手；TLS 握手并验证证书；发 HTTP 请求，收到 HTML；浏览器解析，再请求 CSS、JS、图片，最后渲染。

</details>

<details>
<summary>一台电脑刚连上网，怎么拿到 IP 地址？</summary>

DHCP：广播 DISCOVER，服务器回 OFFER，电脑广播 REQUEST，服务器回 ACK。一起拿到的还有子网掩码、网关和 DNS 服务器地址。地址有租期，到期前续租。

</details>

<details>
<summary>有了 IP 地址，为什么还要 MAC 地址？</summary>

分工不同。IP 是分层的，负责跨网络找路，从头到尾不变；MAC 是平的，只负责在同一个网络里交给下一台设备，每过一跳换一次。

</details>

<details>
<summary>交换机和路由器有什么区别？</summary>

交换机在链路层，按 MAC 在同一个网络里转发，表是自己学的；路由器在网络层，按 IP 在网络之间转发，用最长前缀匹配查路由表，每过一台 TTL 减 1。

</details>

<details>
<summary>TCP 和 UDP 有什么区别？</summary>

TCP 面向连接，有握手，保证可靠、有序，带流量控制和拥塞控制，是字节流；UDP 无连接，只加端口和校验和，不保证送达，保留消息边界，开销小、延迟低。

</details>

<details>
<summary>TCP 怎么保证可靠？</summary>

序号、累积确认、超时重传和快速重传；接收方按序号排序、去重；校验和检错；滑动窗口做流量控制，拥塞窗口做拥塞控制。

</details>

<details>
<summary>为什么是三次握手，不是两次？</summary>

双方都要确认对方收到了自己的初始序号，服务器的 ACK 和 SYN 合成一个包，所以是三次。两次的话，网络里滞留的旧 SYN 到达后，服务器会建立一个没人用的连接；第三步让客户端有机会用 RST 拒掉它。

</details>

<details>
<summary>为什么挥手要四次？TIME_WAIT 为什么要等 2MSL？</summary>

两个方向分别关闭，一方发完了，另一方可能还有数据，所以 ACK 和 FIN 分开发。等 2MSL，一是最后的 ACK 丢了还能重发，二是让这条连接的旧包在网络里过期，不干扰之后的新连接。

</details>

<details>
<summary>服务器上大量 TIME_WAIT 或 CLOSE_WAIT 是怎么回事？</summary>

TIME_WAIT 多，说明这台机器在主动关闭大量短连接，可以改用长连接或连接池，客户端一侧还能开 `tcp_tw_reuse`。CLOSE_WAIT 多，是对方已经关了，自己的程序却没调用 `close`，多半是代码漏了。

</details>

<details>
<summary>流量控制和拥塞控制有什么区别？</summary>

流量控制防止发送方撑爆接收方，靠接收方在 ACK 里通告的窗口；拥塞控制防止把网络堵死，靠发送方自己根据丢包和延迟估出来的拥塞窗口。实际发送量取两者的较小值。

</details>

<details>
<summary>什么是粘包，怎么解决？</summary>

TCP 是字节流，没有消息边界，多次写入可能被一次读出，一次写入也可能被分几次读出。解决办法是在应用层定边界：固定长度、加分隔符，或者在消息前面写上长度。

</details>

<details>
<summary>HTTPS 握手过程是怎样的？为什么需要证书？</summary>

TLS 1.3 里，客户端发 ClientHello 带上 DH 公开值，服务器回 ServerHello 和自己的公开值，再发证书和签名；双方算出共享密钥，派生对称密钥加密之后的数据，一共一个来回。DH 只防偷听，证书和签名证明对面真是这个域名，防中间人。

</details>

<details>
<summary>HTTP/1.1、HTTP/2、HTTP/3 有什么区别？</summary>

HTTP/1.1 一条连接同时只能跑一个请求，浏览器只好开好几条连接；HTTP/2 在一条 TCP 连接上多路复用，头部压缩，但 TCP 丢一个包所有请求都要等；HTTP/3 跑在 QUIC 上，流之间互不阻塞，握手也更少。

</details>

<details>
<summary>DNS 用 TCP 还是 UDP？</summary>

一般用 UDP 的 53 端口，一问一答，开销小。响应太大被截断时改用 TCP 重新查，区域传送也用 TCP；DoT、DoH 则跑在 TLS 或 HTTPS 上。

</details>

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
