---
title: "CPU 是怎么执行一行代码的"
description: "`*a + *b` 编译完只剩 5 个字节。从一枚开关搭起，看 CPU 怎么跑完这 5 个字节，又为什么常常在等内存。"
pubDate: 2026-10-31
updatedDate: 2026-11-11
tags: ["计算机组成原理", "计算机基础"]
---

写一个只做加法的函数：

```c title="add.c"
int add(int *a, int *b) {
    return *a + *b;
}
```

用 GCC 开 `-O2` 编译，再反汇编：

```text
$ gcc -O2 -c add.c && objdump -d add.o

0000000000000000 <add>:
   0:	8b 06                	mov    (%rsi),%eax
   2:	03 07                	add    (%rdi),%eax
   4:	c3                   	ret
```

三条指令。寄存器是 CPU 里的几个小格子，一格放一个数，指令要算的数和算出的结果都放在里面。按 Linux 上的约定，函数的头两个参数放在 `rdi` 和 `rsi` 里，返回值放在 `eax` 里，所以进来的时候 `rdi` 是 `a`，`rsi` 是 `b`。`(%rsi)` 带着括号，意思是把 `rsi` 里的数当成地址，取那个地址上的东西，也就是 `*b`。

连起来读：把 `*b` 读进 `eax`，把 `*a` 加上去，返回。先读哪个结果都一样，编译器挑了 `*b`。

中间那一列才是 CPU 拿到的东西，一共 5 个字节：`8b 06 03 07 c3`。变量名、类型、加号，全都没了。

再写个 `main` 调它，用 gdb 停在 `add` 的第一条指令上，一条一条往下走：

```c title="main.c"
#include <stdio.h>
int add(int *a, int *b);
int main(void) {
    int x = 27, y = 37;
    printf("%d\n", add(&x, &y));
}
```

```text
(gdb) break add
Breakpoint 1 at 0x11b0: file add.c, line 2.
(gdb) run
Breakpoint 1, add (a=a@entry=0x7fffffffdb40, b=b@entry=0x7fffffffdb44) at add.c:2
2	    return *a + *b;
(gdb) x/5xb $rip
0x5555555551b0 <add>:	0x8b	0x06	0x03	0x07	0xc3
(gdb) stepi
0x00005555555551b2	2	    return *a + *b;
(gdb) p $eax
$1 = 37
(gdb) stepi
0x00005555555551b4	3	}
(gdb) p $eax
$2 = 64
```

`x/5xb $rip` 把接下来要执行的 5 个字节打了出来，和反汇编里那一列一样；`stepi` 每次只走一条指令。`eax` 先变成 37，再变成 64。

这篇就把这两步拆到底：这 5 个字节怎么变成电信号，电信号怎么把 27 和 37 加成 64，64 又存在哪。

和[《互联网是怎么连起来的》](/posts/computer-networks/)一样，从最底下往上搭，这回搭的是一台机器：开关，门，加法器，寄存器，时钟，内存，最后拼成一个能跑这 5 个字节的 CPU。搭完再看它为什么快，又常常卡在哪。

## 一枚开关

CPU 里的每一位，都是一根导线上的电压：高是 1，低是 0。

只分两档，是因为电压总在抖。噪声、温度、旁边导线的干扰，都会让它偏一点。两档隔得远，偏一点也认得出来；要是分十档表示 0 到 9，每档只剩一小截，抖一下就读错。

晶体管是一枚用电压控制的开关。它有三个脚，中间那个叫栅极，栅极上的电压决定另外两个脚之间通不通。苹果的 A17 Pro 芯片上有 190 亿个。

1937 年，香农在硕士论文里指出：开关串起来就是“与”，两个都通才通；并起来就是“或”，有一个通就通。逻辑从此可以交给电路去算。

现在的芯片用 CMOS，晶体管分两种：N 型在栅极是 1 时导通，P 型在栅极是 0 时导通。一个门里，P 型那一半接电源，N 型那一半接地，输出接在中间：哪一半通了，输出就被拉到哪一边。

点 A、B 切换输入，橙色的线是 1，蓝色的是 0：

```render html
<style>
  .cm { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .cm { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .keys { display: flex; gap: 8px; }
  .key { min-width: 72px; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key b { margin-left: 8px; font: 600 14px var(--font-mono); }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .seg { display: flex; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .cm svg { display: block; width: 100%; height: auto; margin-top: 14px; overflow: visible; user-select: none; -webkit-user-select: none; }
  .w { fill: none; stroke: var(--rule-strong); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 3 5; transition: stroke .2s; }
  .w.v1 { stroke: var(--accent); stroke-width: 3; stroke-dasharray: none; }
  .w.v0 { stroke: var(--blue); stroke-width: 2.4; stroke-dasharray: none; }
  .pin { fill: var(--bg); stroke: var(--muted); stroke-width: 1.6; }
  .blade { stroke: var(--muted); stroke-width: 3; stroke-linecap: round; transition: transform .24s cubic-bezier(.34, 1.4, .64, 1), stroke .2s; }
  .blade.v1 { stroke: var(--accent); }
  .blade.v0 { stroke: var(--blue); }
  .hit { fill: transparent; cursor: pointer; }
  .sw:hover .pin { stroke: var(--text); }
  .lab { fill: var(--text); font: 600 14px var(--font-mono); dominant-baseline: central; }
  .net { fill: var(--muted); font-size: 12px; text-anchor: end; }
  .rv { font: 600 14px var(--font-mono); dominant-baseline: central; }
  .rv.v1 { fill: var(--accent-ink); }
  .rv.v0 { fill: var(--blue); }
  .out { font: 650 32px var(--font-sans); dominant-baseline: central; }
  .out.v1 { fill: var(--accent-ink); }
  .out.v0 { fill: var(--blue); }
  .cap { fill: var(--muted); font-size: 12px; }
  .th { fill: var(--muted); font-size: 12px; text-anchor: middle; }
  .td { fill: var(--faint); font: 14px var(--font-mono); text-anchor: middle; dominant-baseline: central; transition: fill .2s; }
  .td.cur { fill: var(--text); font-weight: 600; }
  .td.o.cur.v1 { fill: var(--accent-ink); }
  .td.o.cur.v0 { fill: var(--blue); }
  .row { fill: var(--accent-soft); transition: transform .26s cubic-bezier(.22, 1, .36, 1); }
  @media (prefers-reduced-motion: reduce) { .blade, .row { transition: none; } }
</style>
<section class="cm" aria-label="CMOS 门：上半 P 型开关接电源，下半 N 型开关接地，输出被拉到其中一边">
  <div class="top">
    <div class="seg" role="group" aria-label="门的种类">
      <button type="button" data-g="nand" aria-pressed="true">与非</button>
      <button type="button" data-g="nor" aria-pressed="false">或非</button>
    </div>
    <div class="keys">
      <button type="button" class="key" data-k="a">A<b></b></button>
      <button type="button" class="key" data-k="b">B<b></b></button>
    </div>
  </div>
  <svg role="img"></svg>
</section>
<script>
const root = document.querySelector('.cm'), svg = root.querySelector('svg');
const inp = { a: 1, b: 1 };
let gate = 'nand', width = 0, c = null;

// 开关竖着放：上触点 y1，下触点 y2。P 型输入为 0 时合上，N 型为 1 时合上。
// 节点：vdd、gnd、out，以及两个串联开关中间的 m
function circuit(cx, d, top, bot) {
  const L = cx - d, R = cx + d;
  if (gate === 'nand') {
    const yo = top + 92;
    return {
      yo, mid: yo, wires: [
        ['vdd', `M${L} ${top}V${top + 20}M${R} ${top}V${top + 20}`],
        ['out', `M${L} ${top + 66}V${yo}H${R}V${top + 66}M${cx} ${yo}V${yo + 22}`],
        ['m', `M${cx} ${yo + 68}V${yo + 86}`],
        ['gnd', `M${cx} ${yo + 132}V${bot}`],
      ],
      sw: [
        { k: 'a', p: true, x: L, y1: top + 20, y2: top + 66, n1: 'vdd', n2: 'out' },
        { k: 'b', p: true, x: R, y1: top + 20, y2: top + 66, n1: 'vdd', n2: 'out' },
        { k: 'a', p: false, x: cx, y1: yo + 22, y2: yo + 68, n1: 'out', n2: 'm' },
        { k: 'b', p: false, x: cx, y1: yo + 86, y2: yo + 132, n1: 'm', n2: 'gnd' },
      ],
    };
  }
  const yo = top + 132;
  return {
    yo, mid: yo, wires: [
      ['vdd', `M${cx} ${top}V${top + 20}`],
      ['m', `M${cx} ${top + 66}V${top + 86}`],
      ['out', `M${cx} ${top + 132}V${yo}M${L} ${yo + 22}V${yo}H${R}V${yo + 22}`],
      ['gnd', `M${L} ${yo + 68}V${bot}M${R} ${yo + 68}V${bot}`],
    ],
    sw: [
      { k: 'a', p: true, x: cx, y1: top + 20, y2: top + 66, n1: 'vdd', n2: 'm' },
      { k: 'b', p: true, x: cx, y1: top + 86, y2: top + 132, n1: 'm', n2: 'out' },
      { k: 'a', p: false, x: L, y1: yo + 22, y2: yo + 68, n1: 'out', n2: 'gnd' },
      { k: 'b', p: false, x: R, y1: yo + 22, y2: yo + 68, n1: 'out', n2: 'gnd' },
    ],
  };
}

const closed = (s) => (s.p ? !inp[s.k] : !!inp[s.k]);
const gateOut = (a, b) => (gate === 'nand' ? +!(a && b) : +!(a || b));

// 顺着合上的开关把节点连成片，看每片接到了电源还是地
function levels() {
  const up = { vdd: 'vdd', gnd: 'gnd', out: 'out', m: 'm' };
  const find = (n) => (up[n] === n ? n : (up[n] = find(up[n])));
  for (const s of c.sw) if (closed(s)) up[find(s.n1)] = find(s.n2);
  const v = {};
  for (const n in up) v[n] = find(n) === find('vdd') ? 1 : find(n) === find('gnd') ? 0 : null;
  return v;
}

function geo() {
  const wide = width >= 470, s = wide ? 46 : 38;
  // 左边留给 P、N 的说明，右边是输出；宽屏再在右侧放真值表
  const cx = wide ? Math.round(Math.max(150, (width - 470) / 2 + 150)) : Math.round(Math.min(width - 136, 128));
  return { wide, s, cx, top: 30, bot: 296, H: wide ? 316 : 432 };
}

function mount() {
  const g = geo(), top = g.top, bot = g.bot;
  c = circuit(g.cx, g.s, top, bot);
  const L = g.cx - g.s - 26, R = g.cx + g.s + 26, ox = g.cx + g.s + (g.wide ? 52 : 40);
  let s = '';
  s += `<path class="w v1" d="M${L} ${top}H${R}"/><text class="rv v1" x="${R + 8}" y="${top}">1</text><text class="cap" x="${R + 22}" y="${top + 1}" dominant-baseline="central">电源</text>`;
  s += `<path class="w v0" d="M${L} ${bot}H${R}"/><text class="rv v0" x="${R + 8}" y="${bot}">0</text><text class="cap" x="${R + 22}" y="${bot + 1}" dominant-baseline="central">地</text>`;
  for (const [n, d] of c.wires) s += `<path class="w" data-n="${n}" d="${d}"/>`;
  s += `<path class="w" data-n="out" d="M${g.cx + g.s} ${c.yo}H${ox}"/><circle class="pin" cx="${ox}" cy="${c.yo}" r="4"/>`;
  s += `<text class="cap" x="${ox + 12}" y="${c.yo - 30}">输出</text><text class="out" x="${ox + 10}" y="${c.yo + 1}"></text>`;
  for (const sw of c.sw) {
    s += `<g class="sw" data-k="${sw.k}">`;
    s += `<line class="blade" x1="${sw.x}" y1="${sw.y2}" x2="${sw.x}" y2="${sw.y1 + 3}" style="transform-origin:${sw.x}px ${sw.y2}px"/>`;
    s += `<circle class="pin" cx="${sw.x}" cy="${sw.y1}" r="3.4"/><circle class="pin" cx="${sw.x}" cy="${sw.y2}" r="3.4"/>`;
    s += `<text class="lab" x="${sw.x + 12}" y="${(sw.y1 + sw.y2) / 2}">${sw.k.toUpperCase()}</text>`;
    s += `<rect class="hit" x="${sw.x - 34}" y="${sw.y1 - 6}" width="62" height="${sw.y2 - sw.y1 + 12}" rx="6"/></g>`;
  }
  // P、N 两半的说明靠左，各对准自己那一半
  const nx = L - 10, py = (top + c.yo) / 2, ny = (c.yo + bot) / 2;
  s += `<text class="net" x="${nx}" y="${py - 8}">P 型</text><text class="net" x="${nx}" y="${py + 10}">0 时通</text>`;
  s += `<text class="net" x="${nx}" y="${ny - 8}">N 型</text><text class="net" x="${nx}" y="${ny + 10}">1 时通</text>`;
  s += g.wide ? tableV(ox + 96, 60) : tableH(Math.max(6, (width - 248) / 2), bot + 42);
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
  update();
}

// 真值表：宽屏竖着放在右边，窄屏横着放在下面；当前这一组垫底色
function tableV(x, y) {
  const cw = 38, rh = 32;
  let s = `<rect class="row" data-step="0,${rh}" x="${x - 6}" y="${y + 14}" width="${cw * 3 + 12}" height="${rh - 2}" rx="6"/>`;
  ['A', 'B', '输出'].forEach((h, i) => (s += `<text class="th" x="${x + cw * i + cw / 2}" y="${y}">${h}</text>`));
  for (let r = 0; r < 4; r++)
    [r >> 1, r & 1, gateOut(r >> 1, r & 1)].forEach((val, i) =>
      (s += `<text class="td${i === 2 ? ' o' : ''} v${val}" data-r="${r}" x="${x + cw * i + cw / 2}" y="${y + 29 + r * rh}">${val}</text>`));
  return s;
}
function tableH(x, y) {
  const lw = 48, cw = 50, rh = 28;
  let s = `<rect class="row" data-step="${cw},0" x="${x + lw + 4}" y="${y - 16}" width="${cw - 8}" height="${rh * 3 + 4}" rx="6"/>`;
  ['A', 'B', '输出'].forEach((h, i) => (s += `<text class="th" x="${x + lw / 2 - 6}" y="${y + i * rh + 4}">${h}</text>`));
  for (let r = 0; r < 4; r++)
    [r >> 1, r & 1, gateOut(r >> 1, r & 1)].forEach((val, i) =>
      (s += `<text class="td${i === 2 ? ' o' : ''} v${val}" data-r="${r}" x="${x + lw + r * cw + cw / 2}" y="${y + i * rh}">${val}</text>`));
  return s;
}

function update() {
  const v = levels(), out = gateOut(inp.a, inp.b), row = inp.a * 2 + inp.b;
  const cls = (n) => (v[n] === 1 ? 'v1' : v[n] === 0 ? 'v0' : '');
  svg.querySelectorAll('[data-n]').forEach((w) => w.setAttribute('class', `w ${cls(w.dataset.n)}`));
  svg.querySelectorAll('.blade').forEach((b, i) => {
    const sw = c.sw[i], on = closed(sw);
    b.setAttribute('class', `blade ${on ? cls(sw.n1) : ''}`);
    b.style.transform = `rotate(${on ? 0 : -34}deg)`;
  });
  const o = svg.querySelector('.out');
  o.textContent = out;
  o.setAttribute('class', `out v${out}`);
  const mark = svg.querySelector('.row'), [dx, dy] = mark.dataset.step.split(',').map(Number);
  mark.style.transform = `translate(${row * dx}px, ${row * dy}px)`;
  svg.querySelectorAll('.td').forEach((t) => t.classList.toggle('cur', Number(t.dataset.r) === row));
  root.querySelectorAll('.key').forEach((k) => {
    k.setAttribute('aria-pressed', String(!!inp[k.dataset.k]));
    k.querySelector('b').textContent = inp[k.dataset.k];
  });
  root.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === gate)));
  svg.setAttribute('aria-label', `${gate === 'nand' ? '与非' : '或非'}门：A = ${inp.a}，B = ${inp.b}，输出 ${out}，被拉到${out ? '电源' : '地'}`);
}

function flip(k) { inp[k] ^= 1; update(); }
root.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => flip(k.dataset.k)));
root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { if (gate !== b.dataset.g) { gate = b.dataset.g; mount(); } }));
svg.addEventListener('click', (e) => { const sw = e.target.closest('.sw'); if (sw) flip(sw.dataset.k); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; mount(); }
}).observe(svg);
</script>
```

默认是与非门，A、B 都是 1。下面两个 N 型串着，全通了，把输出拉到地，是 0；上面两个 P 型并着，全断开。只要有一个输入是 0，下面那串就断了，上面总有一个 P 型通着，把输出拉到电源，是 1。或非门反过来，下面并，上面串。

上下两半不会同时通，电源到地之间没有直通的路。门不翻转的时候几乎不耗电，电都花在翻转的那一下。

这样搭出来的门天生带一个“非”：输入是 1，通的是接地那一半，输出反而是 0。所以最省晶体管的是与非和或非，4 个就够。

只用与非门，就能搭出别的所有门。两个输入接在一起，是非门；与非后面接个非门，是与门；有了与和非，或也搭得出来。[Nand2Tetris](https://www.nand2tetris.org/) 这门课就是从一个与非门开始，一路搭到能玩俄罗斯方块的电脑。

一个门的输出可以直接接到下一个门的输入上。后面所有的东西，都是这样一个门接一个门搭出来的。

## 加法：异或和与

一位二进制加法只有四种情况：

| A | B | 和 | 进位 |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 0 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |

和那一列，两个输入不一样才是 1，是异或；进位那一列，两个都是 1 才是 1，是与。一个异或门加一个与门，就能加一位。

从第二位开始，还得把下面一位送上来的进位一起加，三个数相加的电路叫全加器。和是三个数连着异或两次：1 的个数是奇数，和就是 1。进位在两种情况下产生：A、B 都是 1；或者 A、B 里只有一个 1，下面又送上来一个进位。两个异或、两个与，再用一个或把两种情况并起来，5 个门。

8 个全加器排成一排，每一位的进位接到上一位，就是 8 位加法器。默认算 27 + 37。点上面的格子改数，点中间的方块看它里面的门：

```render html
<style>
  .ad { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .seg { display: flex; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .ad svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; user-select: none; -webkit-user-select: none; }
  .lab { fill: var(--muted); font-size: 12px; dominant-baseline: central; }
  .cell { fill: var(--bg-raised); stroke: var(--rule-strong); stroke-width: 1.2; transition: fill .15s, stroke .15s; }
  .cell.on { fill: var(--accent-soft); stroke: var(--accent); }
  .bit { fill: var(--faint); font: 600 15px var(--font-mono); text-anchor: middle; dominant-baseline: central; pointer-events: none; transition: fill .15s; }
  .bit.on { fill: var(--accent-ink); }
  .tap { cursor: pointer; }
  .tap:hover .cell { stroke: var(--text); }
  .sum .cell { fill: var(--bg); }
  .sum .cell.on { fill: var(--accent-soft); }
  .fa { fill: var(--bg); stroke: var(--muted); stroke-width: 1.4; cursor: pointer; transition: stroke .15s; }
  .fa.sel { stroke: var(--accent); stroke-width: 2.2; }
  .fa-t { fill: var(--muted); font-size: 11px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  .w { fill: none; stroke: var(--rule-strong); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; transition: stroke .12s; }
  .w.on { stroke: var(--accent); stroke-width: 2.4; }
  .cv { fill: var(--faint); font: 11px var(--font-mono); text-anchor: middle; transition: fill .12s; }
  .cv.on { fill: var(--accent-ink); font-weight: 700; }
  .num { fill: var(--text); font: 600 15px var(--font-mono); text-anchor: end; dominant-baseline: central; }
  .num.res { fill: var(--accent-ink); }
  .eq { fill: var(--text); font: 600 14px var(--font-mono); dominant-baseline: central; }
  .eq tspan.r { fill: var(--accent-ink); }
  .rule { stroke: var(--rule-strong); stroke-width: 1.2; }
  .zoom { fill: var(--accent-soft); opacity: .45; }
  .colsel { fill: var(--accent-soft); opacity: .45; }
  .hit { fill: transparent; }
  .g { fill: var(--bg); stroke: var(--muted); stroke-width: 1.4; transition: stroke .12s; }
  .g.on { stroke: var(--accent); }
  .gt { fill: var(--muted); font-size: 10.5px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  .io { fill: var(--text); font: 600 13px var(--font-mono); dominant-baseline: central; }
  .io.on { fill: var(--accent-ink); }
  .io tspan { font-size: 10px; }
  .dot { fill: var(--rule-strong); }
  .dot.on { fill: var(--accent); }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .run { display: flex; align-items: center; gap: 14px; }
  .cnt { color: var(--muted); font-size: 13px; white-space: nowrap; }
  .cnt b { display: inline-block; min-width: 1.5em; color: var(--text); font: 600 14px var(--font-mono); text-align: right; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
</style>
<section class="ad" aria-label="8 位加法器：8 个全加器排成一排，进位从右往左一位一位传">
  <div class="top">
    <div class="seg" role="group" aria-label="加还是减">
      <button type="button" data-m="add" aria-pressed="true">加</button>
      <button type="button" data-m="sub" aria-pressed="false">减</button>
    </div>
    <div class="run">
      <span class="cnt">过了<b></b> 级门</span>
      <button type="button" class="key replay">慢放进位</button>
    </div>
  </div>
  <svg role="img"></svg>
</section>
<script>
const N = 8, FAST = 55, SLOW = 170;       // 每推一级门隔多少毫秒：改输入时快放，慢放时慢
const root = document.querySelector('.ad'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let A = 27, B = 37, sub = false, sel = 0, width = 0, G = null;
let v, target = null, raf = 0, last = 0, spare = 0, step = FAST, delays = 0;

const bit = (x, i) => (x >> i) & 1;
const inputs = () => ({ a: A, b: sub ? ~B & 255 : B, cin: +sub });

// 门级模拟：每个门的输出取上一步的输入，一步就是一个门延迟
function tick(p, inp) {
  const n = { p: [], g: [], t: [], s: [], c: [inp.cin] };
  for (let i = 0; i < N; i++) {
    n.p[i] = bit(inp.a, i) ^ bit(inp.b, i);
    n.g[i] = bit(inp.a, i) & bit(inp.b, i);
    n.t[i] = p.p[i] & p.c[i];
    n.c[i + 1] = p.g[i] | p.t[i];
    n.s[i] = p.p[i] ^ p.c[i];
  }
  return n;
}
const same = (x, y) => ['p', 'g', 't', 's', 'c'].every((k) => x[k].every((b, i) => b === y[k][i]));
// 从 from 这个状态一级一级推到不再变：返回稳定后的状态，和一共推了几级
function run(from, inp) {
  let s = from, k = 0;
  for (; k < 6 * N; k++) {
    const n = tick(s, inp);
    if (same(n, s)) break;
    s = n;
  }
  return [s, k];
}
// 0 + 0 算稳以后的样子：每根线都是 0
const ZERO = run({ p: [], g: [], t: [], s: [], c: [] }, { a: 0, b: 0, cin: 0 })[0];
const word = (arr) => arr.slice(0, N).reduce((x, b, i) => x | (b << i), 0);
const signed = (x) => (x > 127 ? x - 256 : x);
const num = (x) => String(x).replace('-', '−');

function geo() {
  const wide = width >= 520, labW = wide ? 44 : 26, readW = wide ? 64 : 14;
  const colW = Math.min(62, (width - labW - readW) / N), cell = Math.min(36, Math.floor(colW) - 7);
  const x0 = Math.round((width - labW - readW - N * colW) / 2);
  const yA = 6, yB = yA + cell + 8, yC = yB + cell + 34, fh = Math.round(cell * .9), yS = yC + fh + 18;
  const yR = yS + cell + (wide ? 0 : 30);
  const zw = Math.min(width, 340), zx = Math.round((width - zw) / 2), zy = yR + (wide ? 40 : 26);
  return { wide, x0, labW, readW, colW, cell, yA, yB, yC, fh, yS, yR, zw, zx, zy, H: zy + 176,
    cx: (i) => x0 + labW + (N - 1 - i + .5) * colW };
}

function mount() {
  G = geo();
  const g = G, c = g.cell;
  let s = `<path class="zoom" d=""/><rect class="colsel" y="${g.yA - 5}" width="${g.colW - 2}" height="${g.yS + c + 5 - (g.yA - 5)}" rx="9"/>`;
  s += `<text class="lab" x="${g.x0}" y="${g.yA + c / 2}">A</text><text class="lab" data-bl x="${g.x0}" y="${g.yB + c / 2}">B</text>`;
  s += `<text class="lab" x="${g.x0}" y="${g.yS + c / 2}">和</text>`;
  for (let i = 0; i < N; i++) {
    const x = g.cx(i) - c / 2;
    for (const [r, y] of [['a', g.yA], ['b', g.yB]])
      s += `<g class="tap" data-t="${r}${i}" tabindex="0" role="button" aria-label="${r.toUpperCase()} 的第 ${i} 位"><rect class="hit" x="${g.cx(i) - g.colW / 2}" y="${y - 4}" width="${g.colW}" height="${c + 8}"/><rect class="cell" x="${x}" y="${y}" width="${c}" height="${c}" rx="6"/><text class="bit" x="${g.cx(i)}" y="${y + c / 2 + 1}"></text></g>`;
    // A、B 两根线落到全加器上
    s += `<path class="w" data-w="a${i}" d="M${g.cx(i) - c * .2} ${g.yB + c + 2}V${g.yC}"/><path class="w" data-w="b${i}" d="M${g.cx(i) + c * .2} ${g.yB + c + 2}V${g.yC}"/>`;
    s += `<path class="w" data-w="s${i}" d="M${g.cx(i)} ${g.yC + g.fh}V${g.yS}"/>`;
    s += `<rect class="fa" data-f="${i}" tabindex="0" role="button" aria-label="放大第 ${i} 位的全加器" x="${x}" y="${g.yC}" width="${c}" height="${g.fh}" rx="5"/><text class="fa-t" x="${g.cx(i)}" y="${g.yC + g.fh / 2}">+</text>`;
    s += `<g class="sum"><rect class="cell" data-sc="${i}" x="${x}" y="${g.yS}" width="${c}" height="${c}" rx="6"/><text class="bit" data-s="${i}" x="${g.cx(i)}" y="${g.yS + c / 2 + 1}"></text></g>`;
  }
  // 进位：每个全加器的进位从左边出来，接到左边那个的右边
  const my = g.yC + g.fh / 2;
  for (let i = 0; i <= N; i++) {
    const xr = i === 0 ? g.cx(0) + g.colW / 2 + 2 : g.cx(i - 1) - c / 2;
    const xl = i === N ? g.cx(N - 1) - g.colW / 2 - 2 : g.cx(i) + c / 2;
    s += `<path class="w" data-w="c${i}" d="M${xr} ${my}H${xl + 3}m5 -3.5l-5 3.5 5 3.5"/>`;
    s += `<text class="cv" data-c="${i}" x="${(xl + xr) / 2}" y="${my - 8}"></text>`;
  }
  if (g.wide) {
    const rx = g.x0 + g.labW + N * g.colW + g.readW;
    s += `<text class="num" data-n="a" x="${rx}" y="${g.yA + c / 2}"></text><text class="num" data-n="b" x="${rx}" y="${g.yB + c / 2}"></text>`;
    s += `<text class="num res" data-n="s" x="${rx}" y="${g.yS + c / 2}"></text>`;
  } else {
    s += `<text class="eq" x="${g.x0 + g.labW}" y="${g.yR + 2}"></text>`;
  }
  s += zoomPanel(g);
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
  update();
}

// 放大的全加器：两个异或、两个与、一个或
function zoomPanel(g) {
  const X = (f) => g.zx + f * g.zw, y = g.zy, w = Math.max(30, g.zw * .11), h = 28;
  const and = (x, y0) => `M${x} ${y0}h${w / 2}a${h / 2} ${h / 2} 0 0 1 0 ${h}h${-w / 2}z`;
  const or = (x, y0) => `M${x} ${y0}q${w * .55} 0 ${w} ${h / 2}q${-w * .45} ${h / 2} ${-w} ${h / 2}q${w * .28} ${-h / 2} 0 ${-h}z`;
  const xor = (x, y0) => or(x + 5, y0) + `M${x} ${y0}q${w * .28} ${h / 2} 0 ${h}`;
  const gate = (d, id, x, y0, t) => `<path class="g" data-g="${id}" d="${d}"/><text class="gt" x="${x + w * .48}" y="${y0 + h / 2}">${t}</text>`;
  const x0 = X(.1), x1 = X(.3), x2 = X(.56), x3 = X(.78), xe = X(1) - 32;
  const yA = y + 18, yB = y + 42, yC = y + 74, yG = y + 140;
  let s = '';
  s += `<text class="io" data-io="a" x="${g.zx}" y="${yA}"></text><text class="io" data-io="b" x="${g.zx}" y="${yB}"></text><text class="io" data-io="c" x="${g.zx}" y="${yC}"></text>`;
  // 导线：A、B 进第一个异或，也分一路去最下面的与门
  s += `<path class="w" data-z="a" d="M${x0} ${yA}H${x1}M${x0 + 10} ${yA}V${yG}H${x2}"/>`;
  s += `<path class="w" data-z="b" d="M${x0} ${yB}H${x1}M${x0 + 22} ${yB}V${yG + 12}H${x2}"/>`;
  s += `<path class="w" data-z="p" d="M${x1 + w + 5} ${yA + 12}H${x2 - 16}V${yA + 26}H${x2}M${x2 - 16} ${yA + 26}V${y + 94}H${x2}"/>`;
  s += `<path class="w" data-z="c" d="M${x0} ${yC}H${x2 - 30}V${yA + 38}H${x2}M${x2 - 30} ${yC}V${y + 106}H${x2}"/>`;
  s += `<path class="w" data-z="s" d="M${x2 + w + 5} ${yA + 32}H${xe}"/>`;
  s += `<path class="w" data-z="t" d="M${x2 + w} ${y + 100}H${x3 - 10}V${y + 112}H${x3}"/>`;
  s += `<path class="w" data-z="gg" d="M${x2 + w} ${yG + 6}H${x3 - 10}V${y + 124}H${x3}"/>`;
  s += `<path class="w" data-z="co" d="M${x3 + w} ${y + 118}H${xe}"/>`;
  for (const [k, x, yy] of [['a', x0 + 10, yA], ['b', x0 + 22, yB], ['p', x2 - 16, yA + 26], ['c', x2 - 30, yC]])
    s += `<circle class="dot" data-d="${k}" cx="${x}" cy="${yy}" r="2.6"/>`;
  s += gate(xor(x1, yA - 2), 'x1', x1 + 3, yA - 2, '异或');
  s += gate(xor(x2, yA + 18), 'x2', x2 + 3, yA + 18, '异或');
  s += gate(and(x2, y + 86), 'a2', x2, y + 86, '与');
  s += gate(and(x2, yG - 8), 'a1', x2, yG - 8, '与');
  s += gate(or(x3, y + 104), 'o', x3, y + 104, '或');
  s += `<text class="io" data-io="s" x="${xe + 6}" y="${yA + 32}"></text><text class="io" data-io="co" x="${xe + 6}" y="${y + 118}"></text>`;
  return s;
}

function update() {
  const g = G, inp = inputs(), i = sel;
  const on = (el, b) => el.classList.toggle('on', !!b);
  for (let k = 0; k < N; k++) {
    for (const [r, x] of [['a', A], ['b', inp.b]]) {
      const t = svg.querySelector(`[data-t="${r}${k}"]`), b = bit(x, k);
      on(t.querySelector('.cell'), b); on(t.querySelector('.bit'), b);
      t.querySelector('.bit').textContent = b;
      on(svg.querySelector(`[data-w="${r}${k}"]`), b);
    }
    const sb = v.s[k];
    on(svg.querySelector(`[data-sc="${k}"]`), sb); on(svg.querySelector(`[data-s="${k}"]`), sb);
    svg.querySelector(`[data-s="${k}"]`).textContent = sb;
    on(svg.querySelector(`[data-w="s${k}"]`), sb);
    svg.querySelector(`[data-f="${k}"]`).classList.toggle('sel', k === sel);
  }
  for (let k = 0; k <= N; k++) {
    const t = svg.querySelector(`[data-c="${k}"]`);
    t.textContent = v.c[k]; on(t, v.c[k]); on(svg.querySelector(`[data-w="c${k}"]`), v.c[k]);
  }
  svg.querySelector('[data-bl]').textContent = sub ? '~B' : 'B';
  root.querySelector('.cnt b').textContent = delays;
  const S = word(v.s), fmt = (x) => num(sub ? signed(x) : x);
  if (g.wide) {
    svg.querySelector('[data-n="a"]').textContent = fmt(A);
    svg.querySelector('[data-n="b"]').textContent = sub ? num(-signed(B)) : B;
    svg.querySelector('[data-n="s"]').textContent = fmt(S);
  } else {
    svg.querySelector('.eq').innerHTML = `${fmt(A)} ${sub ? '−' : '+'} ${fmt(B)} = <tspan class="r">${fmt(S)}</tspan>`;
  }
  // 放大镜：选中的那个全加器
  const fx = g.cx(i) - g.colW / 2 + 1, fy = g.yS + g.cell + 5;
  svg.querySelector('.colsel').setAttribute('x', fx);
  svg.querySelector('.zoom').setAttribute('d', `M${fx + 9} ${fy}L${fx + g.colW - 11} ${fy}L${g.zx + g.zw} ${g.zy - 8}L${g.zx} ${g.zy - 8}Z`);
  const val = { a: bit(inp.a, i), b: bit(inp.b, i), c: v.c[i], p: v.p[i], s: v.s[i], t: v.t[i], gg: v.g[i], co: v.c[i + 1] };
  for (const [k, b] of Object.entries(val)) {
    const w = svg.querySelector(`[data-z="${k}"]`); if (w) on(w, b);
    const d = svg.querySelector(`[data-d="${k}"]`); if (d) on(d, b);
  }
  on(svg.querySelector('[data-g="x1"]'), val.p); on(svg.querySelector('[data-g="x2"]'), val.s);
  on(svg.querySelector('[data-g="a1"]'), val.gg); on(svg.querySelector('[data-g="a2"]'), val.t); on(svg.querySelector('[data-g="o"]'), val.co);
  const io = (k, name, sub_, b) => { const t = svg.querySelector(`[data-io="${k}"]`); t.innerHTML = `${name}<tspan dy="4">${sub_}</tspan><tspan dy="-4" dx="4">${b}</tspan>`; on(t, b); };
  io('a', 'A', i, val.a); io('b', sub ? '~B' : 'B', i, val.b); io('c', 'c', i, val.c); io('s', 'S', i, val.s); io('co', 'c', i + 1, val.co);
  root.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.m === 'sub') === sub)));
  svg.setAttribute('aria-label', `${fmt(A)} ${sub ? '−' : '+'} ${fmt(B)} = ${fmt(S)}，二进制 ${S.toString(2).padStart(8, '0')}；放大的是第 ${i} 位的全加器`);
}

// 输入一变，按门延迟一步一步推，进位一级级往左传
function frame(now) {
  spare = Math.min(400, spare + now - last);
  last = now;
  let moved = false;
  for (; spare >= step; spare -= step) {
    const n = tick(v, inputs());
    if (same(n, v)) { target = null; step = FAST; break; }
    v = n; delays++; moved = true;
  }
  if (moved) update();
  if (target) raf = requestAnimationFrame(frame);
}
function changed() {
  delays = 0;
  if (reduce) { const r = run(v, inputs()); v = r[0]; delays = r[1]; return update(); }
  step = FAST;
  update();
  if (target) return;
  target = true; last = performance.now(); spare = step;
  raf = requestAnimationFrame(frame);
}
// 慢放：假装上一拍算的是 0 + 0，所有线都是 0，再把现在的输入接上去
function replay() {
  if (!G) return;
  cancelAnimationFrame(raf);
  target = null;
  if (reduce) { const r = run(ZERO, inputs()); v = r[0]; delays = r[1]; return update(); }
  v = ZERO; delays = 0; step = SLOW;
  update();
  target = true; last = performance.now(); spare = 0;
  raf = requestAnimationFrame(frame);
}

function act(el) {
  const t = el.closest('[data-t]'), f = el.closest('[data-f]');
  if (t) {
    const i = Number(t.dataset.t.slice(1));
    if (t.dataset.t[0] === 'a') A ^= 1 << i; else B ^= 1 << i;
    changed();
  } else if (f) { sel = Number(f.dataset.f); update(); }
  return Boolean(t || f);
}
svg.addEventListener('click', (e) => { act(e.target); });
svg.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && act(e.target)) e.preventDefault();
});
root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
  if ((b.dataset.m === 'sub') !== sub) { sub = !sub; changed(); }
}));
root.querySelector('.replay').addEventListener('click', replay);
const first = run(ZERO, inputs());
v = first[0]; delays = first[1];
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; mount(); }
}).observe(svg);
</script>
```

点“慢放进位”，从所有线都是 0 开始重算一遍。进位从第 0 位出发，一位一位传到第 6 位，每过一位要穿过一个与门、一个或门，前后 13 级门，和才稳在 64。稳下来之前，导线上的数都是错的：把 A 的最低位点成 0，和会先闪过 65、67、71，一直到 127，才落到 63。

这叫行波进位，每一位都得等下面那一位算完。8 位最坏要等进位走过 7 位，64 位就是 63 位。

真正的 CPU 不这么等。超前进位加法器先把每一段“会不会产生进位”并行算出来，用更多的门换更短的等待，64 位也只要十来级门。

CPU 里做运算的这一块叫 ALU（算术逻辑单元）。加、减、与、或、移位的电路都在里面，几根控制线决定这一次取哪个结果。

## 负数：转一圈

要是 `*b` 是 −37 呢？

最直接的办法是拿最高位当符号，0 正 1 负。可这样 `0000` 和 `1000` 是两个零，加法器还得先比符号，再决定是加还是减。

换个想法。4 位二进制一共 16 个数，像汽车的里程表一样排成一圈：`0000` 往回拨一格是 `1111`，那就让 `1111` 当 −1，`1110` 当 −2，一直到 `1000` 当 −8。这叫补码。

加法器只会往前走，走过头就绕回来。一圈 16 格，往回走 3 格和往前走 13 格停在同一格上，所以把 −3 存成 13，也就是 `1101`，加法器不用知道什么是负数，照常加就对了。

$n$ 位的补码里，$-y$ 存成 $2^n - y$。$2^n - 1$ 是全 1，全 1 减 $y$ 就是把 $y$ 的每一位取反，所以

$$
-y = 2^n - y = ({\sim}y) + 1
$$

取反加一。减法也就不用新电路了：

$$
A - B = A + ({\sim}B) + 1
$$

上面加法器的“减”就是这么接的：B 的每一位先过一个非门，最低位的进位塞一个 1。27 − 37 得 `1111 0110`，按补码读是 −10。

同一串比特有两种读法。外圈按无符号读，内圈按补码读。两段弧都从 A 出发，外圈往前走 B 格，内圈照 B 的正负往前或往回走。默认是 `0111 + 0001`：

```render html
<style>
  .tc { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px 24px; align-items: center; }
  :root[data-theme="dark"] .tc { --blue: #95bfdc; }
  @media (min-width: 560px) { .tc { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); } }
  .tc svg { display: block; width: 100%; max-width: 360px; height: auto; margin: 0 auto; overflow: visible; user-select: none; -webkit-user-select: none; }
  .pad { display: grid; grid-template-columns: 18px max-content 1fr; gap: 12px 6px; align-items: center; justify-content: start; }
  .row { display: contents; }
  .row > span { color: var(--muted); font-size: 13px; }
  .row .bitset { display: flex; gap: 6px; }
  .row button { width: 38px; height: 40px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--faint); font: 600 16px var(--font-mono); cursor: pointer; }
  .row button:hover { border-color: var(--text); }
  .row button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); }
  .row output { margin-left: 6px; font: 600 14px var(--font-mono); white-space: nowrap; }
  .u { color: var(--blue); }
  .s { color: var(--accent-ink); }
  .row output i { color: var(--faint); font-style: normal; font-weight: 400; margin: 0 4px; }
  .legend { grid-column: 3; margin: 0 0 -6px 6px; color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  @media (max-width: 380px) { .row button { width: 34px; } .legend i { margin: 0 2px; } }
  .legend i { color: var(--faint); font-style: normal; margin: 0 4px; }
  .flags { grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
  .again { min-height: 38px; margin-left: auto; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .again:hover { border-color: var(--text); }
  .flag { padding: 2px 10px; border: 1px solid var(--rule-strong); border-radius: 99px; color: var(--muted); font: 12.5px var(--font-mono); }
  .flag.on.cf { border-color: var(--blue); color: var(--blue); font-weight: 700; }
  .flag.on.of { border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .track { fill: none; stroke: var(--rule-strong); stroke-width: 1.2; }
  .st { fill: var(--bg); stroke: var(--rule-strong); stroke-width: 1; }
  .sn { font: 11.5px var(--font-mono); text-anchor: middle; dominant-baseline: central; fill: var(--muted); }
  .sn.end { font-weight: 700; }
  .bits { fill: var(--faint); font: 10.5px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
  .bits.end { fill: var(--text); font-weight: 700; }
  .arc { fill: none; stroke-width: 6; stroke-linecap: round; opacity: .28; }
  .arc.u { stroke: var(--blue); }
  .arc.s { stroke: var(--accent); }
  .head.u { fill: var(--blue); }
  .head.s { fill: var(--accent); }
  .st.u.end { stroke: var(--blue); stroke-width: 2; }
  .st.s.end { stroke: var(--accent); stroke-width: 2; }
  .st.start { stroke: var(--text); stroke-width: 1.6; stroke-dasharray: 2 2; }
  .sn.u.end { fill: var(--blue); }
  .sn.s.end { fill: var(--accent-ink); }
  .seam { stroke: var(--rule-strong); stroke-width: 2; stroke-linecap: round; }
  .seam.on.u { stroke: var(--blue); stroke-width: 3; }
  .seam.on.s { stroke: var(--accent); stroke-width: 3; }
  .tl { font-size: 11px; dominant-baseline: central; }
  .tl.u { fill: var(--blue); }
  .tl.s { fill: var(--accent-ink); }
  .mid { fill: var(--text); font: 650 20px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
</style>
<section class="tc" aria-label="4 位补码表盘：同一个加法结果，按无符号读和按有符号读，溢出的位置不同">
  <svg role="img"></svg>
  <div class="pad">
    <div class="legend"><span class="u">无符号</span><i>·</i><span class="s">有符号</span></div>
    <div class="row" data-r="a"><span>A</span></div>
    <div class="row" data-r="b"><span>B</span></div>
    <div class="flags"><span class="flag cf">CF 进位</span><span class="flag of">OF 溢出</span><button type="button" class="again">再走一遍</button></div>
  </div>
</section>
<script>
const root = document.querySelector('.tc'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const v = { a: 0b0111, b: 0b0001 };
let size = 0, prog = 1, raf = 0;         // prog：从 A 出发走了多少，0 到 1

const sg = (x) => (x > 7 ? x - 16 : x);
const num = (x) => String(x).replace('-', '−');
const bin = (x) => x.toString(2).padStart(4, '0');

for (const r of ['a', 'b']) {
  const row = root.querySelector(`[data-r="${r}"]`), set = document.createElement('div');
  set.className = 'bitset';
  row.append(set);
  for (let i = 3; i >= 0; i--) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.setAttribute('aria-label', `${r.toUpperCase()} 的第 ${i} 位`);
    b.addEventListener('click', () => { v[r] ^= 1 << i; walk(); });
    set.append(b);
  }
  row.append(document.createElement('output'));
}

// 第 k 格在表盘上的位置：0 在正上方，顺时针
const ang = (k) => (k / 16) * 2 * Math.PI;
const pt = (k, r) => [size / 2 + r * Math.sin(ang(k)), size / 2 - r * Math.cos(ang(k))];

// 沿圆走 steps 格（负数逆时针）画一段弧
function arc(from, steps, r) {
  if (!steps) return '';
  const [x0, y0] = pt(from, r), [x1, y1] = pt(from + steps, r);
  const large = Math.abs(steps) > 8 ? 1 : 0, sweep = steps > 0 ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}
function head(from, steps, r, cls) {
  const k = from + steps, d = Math.sign(steps), t = ang(k);
  const [x, y] = pt(k - d * .32, r);
  // 切线方向的小三角
  const tx = Math.cos(t) * d, ty = Math.sin(t) * d, nx = Math.sin(t), ny = -Math.cos(t);
  return `<path class="head ${cls}" d="M${x + tx * 7} ${y + ty * 7}L${x - tx * 2 + nx * 5} ${y - ty * 2 + ny * 5}L${x - tx * 2 - nx * 5} ${y - ty * 2 - ny * 5}Z"/>`;
}

function draw() {
  if (!size) return;
  const a = v.a, b = v.b, r = (a + b) & 15, sb = sg(b), e = prog * prog * (3 - 2 * prog);
  // 走到哪算哪：外圈越过 15 和 0 之间的缝是 CF，内圈越过 7 和 −8 之间的缝是 OF
  const cf = a + b * e > 15.5, of = sb >= 0 ? a <= 7 && a + sb * e > 7.5 : a >= 8 && a + sb * e < 7.5;
  const small = size < 320, Rb = size / 2 - 21, Ru = Rb - (small ? 26 : 30), Rs = Ru - (small ? 31 : 35), sr = small ? 9.5 : 11;
  let s = '';
  s += `<circle class="track" cx="${size / 2}" cy="${size / 2}" r="${Ru}"/><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${Rs}"/>`;
  s += `<path class="arc u" d="${arc(a, b * e, Ru)}"/><path class="arc s" d="${arc(a, sb * e, Rs)}"/>`;
  if (Math.abs(b * e) > .4) s += head(a, b * e, Ru, 'u');
  if (Math.abs(sb * e) > .4) s += head(a, sb * e, Rs, 's');
  // 两道缝：无符号在 15 和 0 之间，有符号在 7 和 −8 之间
  const seam = (k, r0, r1, cls, on) => { const [x0, y0] = pt(k, r0), [x1, y1] = pt(k, r1); return `<line class="seam ${cls}${on ? ' on' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`; };
  s += seam(-.5, Ru - 13, Ru + 13, 'u', cf) + seam(7.5, Rs - 13, Rs + 13, 's', of);
  const [cx_, cy_] = pt(-.5, Rb + 1), [ox_, oy_] = pt(7.5, Rs - 21);
  s += `<text class="tl ${cf ? 'u' : ''}" fill="var(--faint)" x="${cx_}" y="${cy_}" text-anchor="middle">CF</text>`;
  s += `<text class="tl ${of ? 's' : ''}" fill="var(--faint)" x="${ox_}" y="${oy_}" text-anchor="middle">OF</text>`;
  for (let k = 0; k < 16; k++) {
    const end = prog >= 1 && k === r, start = k === a;
    const [bx, by] = pt(k, Rb), [ux, uy] = pt(k, Ru), [sx, sy] = pt(k, Rs);
    s += `<text class="bits${end ? ' end' : ''}" x="${bx}" y="${by}">${bin(k)}</text>`;
    s += `<circle class="st u${end ? ' end' : start ? ' start' : ''}" cx="${ux}" cy="${uy}" r="${sr}"/><text class="sn u${end ? ' end' : ''}" x="${ux}" y="${uy}">${k}</text>`;
    s += `<circle class="st s${end ? ' end' : start ? ' start' : ''}" cx="${sx}" cy="${sy}" r="${sr}"/><text class="sn s${end ? ' end' : ''}" x="${sx}" y="${sy}">${num(sg(k))}</text>`;
  }
  // 圆心：落在哪一串比特上
  s += `<text class="mid" x="${size / 2}" y="${size / 2 - 8}">${bin(r)}</text>`;
  s += `<text class="tl u" x="${size / 2 - 7}" y="${size / 2 + 16}" text-anchor="end">${r}</text><text class="tl" fill="var(--faint)" x="${size / 2}" y="${size / 2 + 16}" text-anchor="middle">·</text><text class="tl s" x="${size / 2 + 7}" y="${size / 2 + 16}" text-anchor="start">${num(sg(r))}</text>`;
  svg.innerHTML = s;
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  for (const k of ['a', 'b']) {
    const row = root.querySelector(`[data-r="${k}"]`);
    row.querySelectorAll('button').forEach((btn) => {
      const on = (v[k] >> btn.dataset.i) & 1;
      btn.textContent = on;
      btn.setAttribute('aria-pressed', String(!!on));
    });
    row.querySelector('output').innerHTML = `<span class="u">${v[k]}</span><i>·</i><span class="s">${num(sg(v[k]))}</span>`;
  }
  root.querySelector('.cf').classList.toggle('on', cf);
  root.querySelector('.of').classList.toggle('on', of);
  const cf1 = a + b > 15, of1 = sg(a) + sb > 7 || sg(a) + sb < -8;
  svg.setAttribute('aria-label', `${bin(a)} + ${bin(b)} = ${bin(r)}。无符号：${a} + ${b} = ${r}${cf1 ? '，绕过顶上的缝，进位溢出' : ''}；有符号：${num(sg(a))} + ${num(sb)} = ${num(sg(r))}${of1 ? '，绕过底下的缝，有符号溢出' : ''}`);
}

// 从 A 出发沿着两圈各走一遍：外圈往前走 B 格，内圈按 B 的正负往前或往回
function walk() {
  cancelAnimationFrame(raf);
  if (reduce || !size) { prog = 1; return draw(); }
  const t0 = performance.now(), dur = 300 + 90 * Math.max(v.b, 1);
  const next = (now) => {
    prog = Math.max(0, Math.min(1, (now - t0) / dur));
    draw();
    if (prog < 1) raf = requestAnimationFrame(next);
  };
  prog = 0;
  draw();
  raf = requestAnimationFrame(next);
}
root.querySelector('.again').addEventListener('click', walk);

new ResizeObserver(([entry]) => {
  const w = Math.floor(Math.min(entry.contentRect.width, 360));
  if (w !== size) { size = w; draw(); }
}).observe(svg);
draw();
</script>
```

7 + 1 得 `1000`。外圈读成 8，没问题；内圈读成 −8，正数加正数加出了负数，这就是溢出。

两圈的接缝不在一处：外圈在顶上，15 和 0 之间；内圈在底下，7 和 −8 之间。把 B 改成 `1101`：外圈往前走 13 格，越过了顶上的接缝；内圈往回走 3 格，什么都没越过。两段弧停在同一格 `0100` 上，无符号读是 4，可 7 + 13 该是 20，丢了一个 16；有符号读是 7 − 3 = 4，没错。

CPU 不知道你打算按哪种读，两种都记着：越过外圈的接缝，设 CF（进位标志）；越过内圈的接缝，设 OF（溢出标志）。编译器知道变量是什么类型，挑对应的那个看。

C 语言里，`unsigned` 溢出就绕回去，结果是确定的；`int` 溢出是未定义行为，编译器可以当它不会发生。想要绕回去，就用 `unsigned`。

## 同样的比特，换一条指令

把 `add` 里的 `int` 全换成 `float`，重新编译：

```text
0000000000000000 <add>:
   0:	f3 0f 10 07          	movss  (%rdi),%xmm0
   4:	f3 0f 58 06          	addss  (%rsi),%xmm0
   8:	c3                   	ret
```

加法换成了 `addss`，寄存器换成了 `xmm0`，背后是另一套电路。内存里还是 4 个字节，上面没有记号说它是整数还是小数。类型是编译器知道的事：它看到 `float`，就挑 `addss`。

float 的 32 位分三段：1 位符号 $s$，8 位阶码 $e$，23 位尾数 $m$，值是

$$
(-1)^s \times 1.m \times 2^{e-127}
$$

就是二进制的科学计数法。阶码存的是指数加 127，这样负的指数也能用一个不带符号的数存下；二进制里小数点前面那一位只能是 1，干脆不存，白赚一位。

下面是 0.1 存成 float 的样子。点比特翻转，或者直接输一个数：

```render html
<style>
  .fl { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .fl { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
  .in { display: flex; align-items: center; gap: 8px; color: var(--muted); }
  .in input { width: 150px; min-height: 38px; padding: 0 10px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font: 600 15px var(--font-mono); }
  .in input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button { min-height: 32px; padding: 0 10px; border: 1px solid var(--rule-strong); border-radius: 99px; background: none; color: var(--muted); font: 12.5px var(--font-mono); cursor: pointer; }
  .chips button:hover { border-color: var(--text); color: var(--text); }
  .bits { display: flex; flex-wrap: wrap; gap: 10px 8px; margin: 18px 0 14px; }
  .grp { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .grp > div { display: flex; flex-wrap: wrap; gap: 2px; }
  .grp > span { font-size: 12px; }
  .b { width: 18px; height: 30px; padding: 0; border: 1px solid var(--rule-strong); border-radius: 4px; background: var(--bg-raised); color: var(--faint); font: 600 13px var(--font-mono); cursor: pointer; }
  .b:hover { border-color: var(--text); }
  .b.on { color: var(--bg); }
  .sgn .b.on { background: var(--text); border-color: var(--text); }
  .exp .b.on { background: var(--blue); border-color: var(--blue); }
  .man .b.on { background: var(--accent); border-color: var(--accent); }
  .sgn > span { color: var(--text); }
  .exp > span { color: var(--blue); }
  .man > span { color: var(--accent-ink); }
  .grp > span b { font: 600 12px var(--font-mono); margin-left: 6px; }
  @media (max-width: 520px) { .b { width: 20px; } .man > div { max-width: 264px; } }
  @media (pointer: coarse) { .b { width: 28px; height: 38px; } .man > div { max-width: none; } .chips button { min-height: 38px; } }
  dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 16px; margin: 0; }
  dt { color: var(--muted); }
  dt code { color: var(--text); font: 600 13px var(--font-mono); }
  dd { margin: 0; font: 600 14px var(--font-mono); overflow-wrap: anywhere; }
  dd.f { color: var(--accent-ink); }
  dd small { display: block; color: var(--muted); font: 12.5px var(--font-mono); margin-top: 2px; }
  dd small sup { font-size: 9.5px; }
</style>
<section class="fl" aria-label="同样 32 个比特，被整数加法和浮点加法读成两个不同的数">
  <div class="top">
    <label class="in">输入 <input type="text" inputmode="decimal" spellcheck="false" autocomplete="off" value="0.1" aria-label="输入一个数，看它存成 float 的样子"></label>
    <div class="chips">
      <button type="button" data-v="0.1">0.1</button>
      <button type="button" data-v="1">1</button>
      <button type="button" data-v="16777217">16777217</button>
      <button type="button" data-bits="64">eax 里的 64</button>
    </div>
  </div>
  <div class="bits">
    <div class="grp sgn"><div></div><span>符号</span></div>
    <div class="grp exp"><div></div><span>阶码<b></b></span></div>
    <div class="grp man"><div></div><span>尾数</span></div>
  </div>
  <dl>
    <dt><code>add</code> 读成</dt><dd class="i"></dd>
    <dt><code>addss</code> 读成</dt><dd class="f"></dd>
    <dt>相邻的 float</dt><dd class="u"></dd>
  </dl>
</section>
<script>
const root = document.querySelector('.fl'), input = root.querySelector('input');
const dv = new DataView(new ArrayBuffer(4));
let bits = 0, typed = null;

const toBits = (x) => (dv.setFloat32(0, x), dv.getUint32(0));
const toFloat = (u) => (dv.setUint32(0, u >>> 0), dv.getFloat32(0));
const toInt = (u) => (dv.setUint32(0, u >>> 0), dv.getInt32(0));
const minus = (s) => s.replace(/^-/, '−');
const sup = (n) => `<sup>${minus(String(n))}</sup>`;

// 科学计数法：1.49 × 10⁻⁹
function sci(x, digits = 3) {
  if (x === 0) return '0';
  const [m, e] = Math.abs(x).toExponential(digits - 1).split('e');
  const head = (x < 0 ? '−' : '') + m.replace(/\.?0+$/, '');
  return Number(e) === 0 ? head : `${head} × 10${sup(Number(e))}`;
}

// float 精确的十进制展开：值 = m × 2^p，p < 0 时等于 m × 5^(−p) / 10^(−p)
function exact(u) {
  const s = u >>> 31, e = (u >>> 23) & 255, f = u & 0x7fffff;
  if (e === 255) return f ? 'NaN' : s ? '−∞' : '+∞';
  const m = BigInt(e ? f | 0x800000 : f), p = (e || 1) - 150;
  if (m === 0n) return s ? '−0' : '0';
  let str;
  if (p >= 0) str = (m << BigInt(p)).toString();
  else {
    const d = -p, t = (m * 5n ** BigInt(d)).toString().padStart(d + 1, '0');
    str = (t.slice(0, -d) + '.' + t.slice(-d)).replace(/0+$/, '');
  }
  return str.length > 40 ? `≈ ${sci(toFloat(u), 8)}` : (s ? "−" : "") + str;
}

function formula(u) {
  const s = u >>> 31, e = (u >>> 23) & 255, f = u & 0x7fffff, sign = s ? '−' : '+';
  if (e === 255) return f ? '阶码全 1、尾数不为 0：NaN' : '阶码全 1、尾数为 0：无穷';
  if (e === 0) return f ? `${sign}0.${(f / 2 ** 23).toFixed(8).slice(2)} × 2${sup(-126)}（阶码全 0，前面那位是 0）` : '阶码和尾数全 0：零';
  return `${sign}1.${(f / 2 ** 23).toFixed(8).slice(2)} × 2${sup(e - 127)}`;
}

function gap(u) {
  const e = (u >>> 23) & 255;
  if (e === 255) return '—';
  const x = Math.abs(toFloat(u)), next = toFloat((u & 0x7fffffff) + 1);
  return `隔 ${sci(next - x)}`;
}

const groups = { sgn: [31], exp: [30, 29, 28, 27, 26, 25, 24, 23], man: [] };
for (let i = 22; i >= 0; i--) groups.man.push(i);
for (const [g, list] of Object.entries(groups)) {
  const box = root.querySelector(`.${g} > div`);
  for (const i of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'b';
    b.dataset.i = i;
    b.setAttribute('aria-label', `第 ${i} 位`);
    b.addEventListener('click', () => { bits = (bits ^ (1 << i)) >>> 0; typed = null; input.value = ''; draw(); });
    box.append(b);
  }
}

function draw() {
  root.querySelectorAll('.b').forEach((b) => {
    const on = (bits >>> b.dataset.i) & 1;
    b.textContent = on;
    b.classList.toggle('on', !!on);
    b.setAttribute('aria-pressed', String(!!on));
  });
  const e = (bits >>> 23) & 255;
  root.querySelector('.exp b').textContent = e === 0 || e === 255 ? e : `${e} − 127 = ${minus(String(e - 127))}`;
  root.querySelector('.i').textContent = minus(String(toInt(bits)));
  const x = toFloat(bits);
  let note = formula(bits);
  if (typed !== null && Number.isFinite(typed) && typed !== x) note += `<br>比输入的 ${minus(String(typed))} ${x > typed ? '大' : '小'}了 ${sci(Math.abs(x - typed))}`;
  root.querySelector('.f').innerHTML = `${exact(bits)}<small>${note}</small>`;
  root.querySelector('.u').innerHTML = gap(bits);
}

function set(text) {
  const t = text.trim().replace(/^−/, '-');
  if (!t) return;
  const n = Number(t);
  if (Number.isNaN(n) && !/^[-+]?nan$/i.test(t)) return;
  typed = n;
  bits = toBits(n);
  draw();
}
input.addEventListener('input', () => set(input.value));
root.querySelectorAll('.chips button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.bits) { bits = Number(b.dataset.bits); typed = null; input.value = ''; draw(); }
  else { input.value = b.dataset.v; set(b.dataset.v); }
}));
set(input.value);
</script>
```

0.1 写成二进制是 0.000110011001100…，`0011` 无限循环，23 位尾数装不下，只能就近舍入。真正存进去的是 0.100000001490116119384765625。

double 有 52 位尾数，一样装不下。Python 用的就是 double：

```text
>>> 0.1 + 0.2
0.30000000000000004
```

0.1 和 0.2 存进去时各舍入了一次，加完再舍入一次，结果落在了离 0.3 最近的那个 double 的隔壁。

尾数的位数是定死的，阶码每加 1，这些位要铺开的范围就翻一倍，所以数越大，相邻两个浮点数离得越远。0.1 附近，相邻的 float 差 $7.45 \times 10^{-9}$；到了 $2^{24}$，也就是 16777216，相邻的差 2，16777217 存不进去，会变成 16777216。所以浮点数别用 `==` 比，钱要用整数存到分。

再点“eax 里的 64”：整数 64 的 4 个字节按 float 读，是 $8.97 \times 10^{-44}$。

## 记住一个数：锁存器

加法器算出的 64 只停在导线上，输入一变它就跟着变。要把它留住，电路得能记。

办法是让输出绕回来，接到输入上。两个或非门交叉接，每个门的输出都接到另一个门的输入。按住 S 或 R 试试：

```render html
<style>
  .lt { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 40px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; touch-action: none; -webkit-user-select: none; user-select: none; }
  .key:hover { border-color: var(--text); }
  .key b { font: 600 14px var(--font-mono); margin-right: 6px; }
  .key[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); box-shadow: none; transform: translateY(2px); }
  .lt svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; user-select: none; -webkit-user-select: none; }
  .w { fill: none; stroke: var(--rule-strong); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: stroke .15s; }
  .w.on { stroke: var(--accent); stroke-width: 3; }
  .gate { fill: var(--bg); stroke: var(--muted); stroke-width: 1.6; }
  .gate.on { stroke: var(--accent); }
  .gt { fill: var(--muted); font-size: 11px; text-anchor: middle; dominant-baseline: central; }
  .io { fill: var(--text); font: 600 14px var(--font-mono); dominant-baseline: central; }
  .val { fill: var(--faint); font: 12px var(--font-mono); dominant-baseline: central; }
  .val.on { fill: var(--accent-ink); font-weight: 700; }
  .dot { fill: var(--rule-strong); }
  .dot.on { fill: var(--accent); }
  .pad { fill: var(--bg-raised); stroke: var(--rule-strong); stroke-width: 1.4; cursor: pointer; }
  .pad.on { fill: var(--accent); stroke: var(--accent); }
  .lamp { fill: var(--bg); stroke: var(--rule-strong); stroke-width: 2; transition: fill .2s, stroke .2s; }
  .lamp.on { fill: var(--accent-soft); stroke: var(--accent); }
  .glow { fill: var(--accent); opacity: 0; transition: opacity .3s; }
  .glow.on { opacity: .16; }
  .word { fill: var(--muted); font-size: 13px; text-anchor: middle; }
  .word.now { fill: var(--accent-ink); font-weight: 600; }
  .tr { fill: none; stroke: var(--muted); stroke-width: 1.6; stroke-linejoin: round; }
  .tr.q { stroke: var(--accent); stroke-width: 2.2; }
  .tl { fill: var(--muted); font: 12px var(--font-mono); dominant-baseline: central; }
  .base { stroke: var(--rule); stroke-width: 1; stroke-dasharray: 2 4; }
  .tick { stroke: var(--rule); stroke-width: 1; }
  @media (prefers-reduced-motion: reduce) { .w, .lamp, .glow { transition: none; } }
</style>
<section class="lt" aria-label="SR 锁存器：两个或非门的输出互相接回对方的输入，松开按钮以后状态还在">
  <div class="keys">
    <button type="button" class="key" data-k="s"><b>S</b>按住置位</button>
    <button type="button" class="key" data-k="r"><b>R</b>按住复位</button>
  </div>
  <svg role="img"></svg>
</section>
<script>
const root = document.querySelector('.lt'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP = 170, COLS = 12;
let S = 0, R = 0, width = 0, G = null;
// 当前各节点的值；q 和 qb 各自经过一个门延迟才跟上输入
let q = 1, qb = 0, timer = 0;
// 波形：每次按下或松开记一列；首帧是 S 按过一次又松开
let hist = [[0, 0, 0], [1, 0, 1], [0, 0, 1], [0, 0, 1]];

const nor = (a, b) => +!(a || b);

function geo() {
  const wide = width >= 480, X = wide ? Math.round((width - 470) / 2) : 0, k = wide ? 1 : (width - 10) / 400;
  const x = (v) => X + v * k;
  const yT = 40, yB = 168, waveY = 270;
  return { wide, x, yT, yB, waveY, H: waveY + 3 * 30 + 6 };
}

function mount() {
  G = geo();
  const g = G, x = g.x, yT = g.yT, yB = g.yB;
  const gx = x(150), gw = Math.max(48, x(206) - x(150)), gh = 50;
  // 或非门：或门的形状加一个输出小圈
  const nr = (y0) => `M${gx} ${y0}q${gw * .55} 0 ${gw} ${gh / 2}q${-gw * .45} ${gh / 2} ${-gw} ${gh / 2}q${gw * .28} ${-gh / 2} 0 ${-gh}z`;
  const ox = gx + gw + 11, qT = yT + gh / 2, qB = yB + gh / 2;
  const jq = x(250), jqb = x(268), lx = Math.min(width - 26, x(372));
  let s = '';
  // 输入：R 进上面的门，S 进下面的门
  s += `<path class="w" data-w="r" d="M${x(26)} ${yT + 12}H${gx + 6}"/><path class="w" data-w="s" d="M${x(26)} ${yB + gh - 12}H${gx + 6}"/>`;
  // 交叉的两根反馈线
  s += `<path class="w" data-w="q" d="M${ox} ${qT}H${lx - 18}M${jq} ${qT}V${qT + 30}L${x(118)} ${yB - 4}V${yB + 12}H${gx + 6}"/>`;
  s += `<path class="w" data-w="qb" d="M${ox} ${qB}H${x(312)}M${jqb} ${qB}V${qB - 30}L${x(132)} ${yT + gh + 4}V${yT + gh - 12}H${gx + 6}"/>`;
  s += `<circle class="dot" data-d="q" cx="${jq}" cy="${qT}" r="3.4"/><circle class="dot" data-d="qb" cx="${jqb}" cy="${qB}" r="3.4"/>`;
  s += `<path class="gate" data-g="t" d="${nr(yT)}"/><circle class="gate" data-g="tb" cx="${gx + gw + 5}" cy="${qT}" r="5"/>`;
  s += `<path class="gate" data-g="b" d="${nr(yB)}"/><circle class="gate" data-g="bb" cx="${gx + gw + 5}" cy="${qB}" r="5"/>`;
  s += `<text class="gt" x="${gx + gw * .42}" y="${qT}">或非</text><text class="gt" x="${gx + gw * .42}" y="${qB}">或非</text>`;
  s += `<circle class="pad" data-p="r" cx="${x(26)}" cy="${yT + 12}" r="9"/><text class="io" x="${x(26) + 16}" y="${yT - 4}">R</text>`;
  s += `<circle class="pad" data-p="s" cx="${x(26)}" cy="${yB + gh - 12}" r="9"/><text class="io" x="${x(26) + 16}" y="${yB + gh + 12}">S</text>`;
  s += `<text class="val" data-v="r" x="${x(26) + 34}" y="${yT - 4}"></text><text class="val" data-v="s" x="${x(26) + 34}" y="${yB + gh + 12}"></text>`;
  s += `<text class="io" x="${x(292)}" y="${qT - 16}">Q</text><text class="val" data-v="q" x="${x(292) + 16}" y="${qT - 16}"></text>`;
  s += `<text class="io" x="${x(292)}" y="${qB + 18}">Q̄</text><text class="val" data-v="qb" x="${x(292) + 16}" y="${qB + 18}"></text>`;
  s += `<circle class="glow" cx="${lx}" cy="${qT}" r="24"/><circle class="lamp" cx="${lx}" cy="${qT}" r="16"/>`;
  s += `<text class="word" x="${lx}" y="${qT + 44}"></text>`;
  // 波形：S、R、Q 三行
  const wx = x(26), ww = Math.min(width - wx - 4, 420);
  ['S', 'R', 'Q'].forEach((n, i) => {
    const y = g.waveY + i * 30;
    s += `<text class="tl" x="${wx - (g.wide ? 0 : 0)}" y="${y + 9}">${n}</text><line class="base" x1="${wx + 22}" x2="${wx + ww}" y1="${y + 18}" y2="${y + 18}"/>`;
    s += `<path class="tr${n === 'Q' ? ' q' : ''}" data-t="${i}" d=""/>`;
  });
  s += `<g data-ticks></g>`;
  G.wave = { x: wx + 22, w: ww - 22 };
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
  update();
}

function update() {
  const on = (sel, b) => svg.querySelectorAll(sel).forEach((el) => el.classList.toggle('on', !!b));
  on('[data-w="r"]', R); on('[data-w="s"]', S); on('[data-w="q"]', q); on('[data-w="qb"]', qb);
  on('[data-d="q"]', q); on('[data-d="qb"]', qb);
  on('[data-p="r"]', R); on('[data-p="s"]', S);
  on('[data-g="t"], [data-g="tb"]', q); on('[data-g="b"], [data-g="bb"]', qb);
  on('.lamp', q); on('.glow', q);
  for (const [k, b] of [['r', R], ['s', S], ['q', q], ['qb', qb]]) {
    const t = svg.querySelector(`[data-v="${k}"]`);
    t.textContent = b; t.classList.toggle('on', !!b);
  }
  const busy = S || R, word = S && R ? 'S、R 一起按' : S ? '置位' : R ? '复位' : '保持';
  const w = svg.querySelector('.word');
  w.textContent = word; w.classList.toggle('now', !!busy);
  // 波形：每列等宽，最新的在右边
  // 不满一屏时，左边用最早的状态补齐
  const cols = Array(Math.max(0, COLS - hist.length)).fill(hist[0]).concat(hist.slice(-COLS)), cw = G.wave.w / COLS, x0 = G.wave.x;
  for (let i = 0; i < 3; i++) {
    const y = (b) => G.waveY + i * 30 + (b ? 2 : 18);
    let d = `M${x0} ${y(cols[0][i])}`;
    cols.forEach((c, j) => { d += `V${y(c[i])}H${x0 + (j + 1) * cw}`; });
    svg.querySelector(`[data-t="${i}"]`).setAttribute('d', d);
  }
  root.querySelectorAll('.key').forEach((k) => k.setAttribute('aria-pressed', String(!!(k.dataset.k === 's' ? S : R))));
  svg.setAttribute('aria-label', `S = ${S}，R = ${R}，Q = ${q}：${word}`);
}

// 一次一个门延迟：两个门同时看上一步的值
function settle() {
  clearTimeout(timer);
  const nq = nor(R, qb), nqb = nor(S, q);
  if (nq === q && nqb === qb) {
    const last = hist[hist.length - 1];
    if (last[0] !== S || last[1] !== R || last[2] !== q) hist.push([S, R, q]);
    return update();
  }
  q = nq; qb = nqb;
  update();
  if (reduce) settle(); else timer = setTimeout(settle, STEP);
}

function set(k, b) {
  if ((k === 's' ? S : R) === b) return;
  if (k === 's') S = b; else R = b;
  hist.push([S, R, hist[hist.length - 1][2]]);
  update();
  settle();
}

for (const key of root.querySelectorAll('.key')) {
  const k = key.dataset.k;
  key.addEventListener('pointerdown', (e) => { e.preventDefault(); key.setPointerCapture(e.pointerId); set(k, 1); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) key.addEventListener(ev, () => set(k, 0));
  key.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); set(k, 1); } });
  key.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') set(k, 0); });
}
svg.addEventListener('pointerdown', (e) => {
  const p = e.target.closest('.pad');
  if (!p) return;
  e.preventDefault();
  svg.setPointerCapture(e.pointerId);
  const k = p.dataset.p;
  set(k, 1);
  const up = () => { set(k, 0); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; mount(); }
}).observe(svg);
</script>
```

现在 S、R 都是 0。上面那个门的两个输入 R 和 $\bar{Q}$ 都是 0，或非得 1，所以 Q = 1；Q 送到下面那个门，让 $\bar{Q}$ 保持 0。两个门互相撑着，谁都不变。按一下 R，Q 被拉成 0，松手以后，两个门换成另一种互相撑着的样子。

这叫 SR 锁存器，S 是置位（set），R 是复位（reset）。S、R 一起按住，两个输出都被压成 0，同时松手以后落到哪边说不准，所以用的时候不让它俩同时是 1。

锁存器能记，可它太听话：S、R 什么时候动，它就什么时候变。加法器的输出稳下来之前要乱跳一阵，前面闪过的 127 就是，这些中间值不该被记进去。得有一根线来说“现在抄”，这根线就是时钟。

给锁存器添几个门，让它听时钟的；再把两个这样的锁存器前后串起来。时钟是 0 时，前一个跟着输入 D 变，后一个不动；时钟一跳到 1，前一个锁住，后一个把它锁住的值放到输出 Q 上。合起来的效果是，Q 只在时钟从 0 跳到 1 的那一下抄一次 D。这叫 D 触发器。先多翻几次 D，再拨时钟：

```render html
<style>
  .ff { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .ff { --blue: #95bfdc; }
  .keys { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .key { min-height: 40px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key b { margin-left: 8px; font: 600 14px var(--font-mono); }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .q { margin-left: auto; color: var(--muted); white-space: nowrap; }
  .q b { margin-left: 6px; color: var(--accent-ink); font: 600 16px var(--font-mono); }
  .ff svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .rl { fill: var(--muted); font-size: 12px; dominant-baseline: central; }
  .base { stroke: var(--rule); stroke-width: 1; stroke-dasharray: 2 4; }
  .tr { fill: none; stroke-width: 2; stroke-linejoin: round; }
  .tr.c { stroke: var(--muted); stroke-width: 1.6; }
  .tr.d { stroke: var(--blue); }
  .tr.q { stroke: var(--accent); stroke-width: 2.6; }
  .edge { stroke: var(--text); stroke-width: 1.2; stroke-dasharray: 3 3; }
  .got { fill: var(--text); font-size: 12px; text-anchor: middle; }
  .dot.d { fill: var(--blue); }
  .dot.q { fill: var(--accent); }
</style>
<section class="ff" aria-label="D 触发器：Q 只在时钟从 0 跳到 1 的那一下抄一次 D，其他时候 D 怎么变都不理">
  <div class="keys">
    <button type="button" class="key" data-k="d">D<b></b></button>
    <button type="button" class="key" data-k="clk">时钟<b></b></button>
    <button type="button" class="key reset">重来</button>
    <span class="q">Q<b></b></span>
  </div>
  <svg role="img"></svg>
</section>
<script>
const root = document.querySelector('.ff'), svg = root.querySelector('svg');
// 每一列是一次动作之后的样子：[时钟, D, Q, 这一列是不是从上升沿开始]
const START = [[0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 1, 0, 0], [1, 1, 1, 1], [1, 0, 1, 0], [0, 0, 1, 0], [0, 1, 1, 0], [0, 0, 1, 0], [1, 0, 0, 1], [0, 0, 0, 0], [0, 1, 0, 0]];
const NAMES = ['时钟', 'D', 'Q'], CLS = ['c', 'd', 'q'];
let hist = START.slice(), width = 0;

function flip(k) {
  const last = hist[hist.length - 1];
  let clk = last[0], d = last[1], q = last[2], edge = 0;
  if (k === 'd') d ^= 1;
  else {
    clk ^= 1;
    if (clk) { q = d; edge = 1; }        // 上升沿：把这一刻的 D 抄给 Q
  }
  hist.push([clk, d, q, edge]);
  if (hist.length > 60) hist = hist.slice(-40);
  draw();
}

function draw() {
  if (!width) return;
  const COLS = width < 440 ? 12 : 16, x0 = 38, cw = (width - x0 - 6) / COLS, top = 26, rowH = 44;
  const y = (i, b) => top + i * rowH + (b ? 4 : 26);
  const shown = hist.slice(-COLS), first = hist[0];
  const cols = Array(COLS - shown.length).fill([first[0], first[1], first[2], 0]).concat(shown);
  let s = '';
  // 上升沿：一条竖虚线穿过三行，顶上写抄到了什么
  cols.forEach((c, j) => {
    if (!c[3]) return;
    const x = x0 + j * cw;
    s += `<line class="edge" x1="${x}" x2="${x}" y1="${top - 6}" y2="${y(2, 0) + 4}"/><text class="got" x="${x}" y="${top - 12}">抄 ${c[1]}</text>`;
  });
  for (let i = 0; i < 3; i++) {
    s += `<text class="rl" x="0" y="${top + i * rowH + 15}">${NAMES[i]}</text><line class="base" x1="${x0}" x2="${x0 + COLS * cw}" y1="${y(i, 0)}" y2="${y(i, 0)}"/>`;
    let d = `M${x0} ${y(i, cols[0][i])}`;
    cols.forEach((c, j) => { d += `V${y(i, c[i])}H${x0 + (j + 1) * cw}`; });
    s += `<path class="tr ${CLS[i]}" d="${d}"/>`;
  }
  // 上升沿那一刻 D 上的值，和 Q 抄到的值
  cols.forEach((c, j) => {
    if (!c[3]) return;
    const x = x0 + j * cw;
    s += `<circle class="dot d" cx="${x}" cy="${y(1, c[1])}" r="4"/><circle class="dot q" cx="${x}" cy="${y(2, c[2])}" r="4"/>`;
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${top + 3 * rowH + 4}`);
  svg.innerHTML = s;
  const now = hist[hist.length - 1];
  root.querySelectorAll('[data-k]').forEach((b) => {
    const val = now[b.dataset.k === 'd' ? 1 : 0];
    b.querySelector('b').textContent = val;
    b.setAttribute('aria-pressed', String(!!val));
  });
  root.querySelector('.q b').textContent = now[2];
  svg.setAttribute('aria-label', `时钟 = ${now[0]}，D = ${now[1]}，Q = ${now[2]}。Q 只在时钟从 0 跳到 1 时抄一次 D`);
}

root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => flip(b.dataset.k)));
root.querySelector('.reset').addEventListener('click', () => { hist = START.slice(); draw(); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

竖的虚线是时钟的上升沿，Q 只在这几处变，变成的是那一刻的 D。两次上升沿之间 D 翻了几回，Q 都没看见；时钟从 1 落回 0，也什么都不发生。现在 D 是 1，Q 还是 0，要等下一次上升沿。

32 个 D 触发器排成一排，接同一根时钟线，就是寄存器 `eax`。

## 时钟：拍子不能太快

CPU 里所有的触发器，都在同一个时钟信号的上升沿抄数。两次上升沿之间是一拍。

我这台笔记本的 CPU 最高 4.7 GHz，一拍 0.21 纳秒，光在这段时间里只走 6 厘米多。

一拍之内，加法器得把结果算稳。每个门翻转都要一点时间，进位还要一位一位往上传。下面是 27 + 37 的 8 个和位随时间的变化，拖动时钟沿，看寄存器抄到什么：

```render html title="假设每个门 20 皮秒"
<style>
  .oc { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font: 14px var(--font-mono); cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .ctl { display: flex; align-items: center; gap: 10px; flex: 1 1 220px; max-width: 320px; color: var(--muted); }
  .ctl output { min-width: 5.2em; color: var(--text); font: 600 14px var(--font-mono); white-space: nowrap; }
  .ctl input { flex: 1; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .oc svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  .rl { fill: var(--muted); font: 12px var(--font-mono); dominant-baseline: central; }
  .lane { stroke: var(--rule); stroke-width: 1; }
  .wave { fill: none; stroke: var(--muted); stroke-width: 1.6; stroke-linejoin: round; }
  .fill { fill: var(--accent); opacity: .18; }
  .hi { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; }
  .after { opacity: .35; }
  .ax { fill: var(--muted); font: 11px var(--font-mono); text-anchor: middle; }
  .axl { stroke: var(--rule-strong); stroke-width: 1; }
  .settle { stroke: var(--text); stroke-width: 1.2; stroke-dasharray: 3 3; }
  .settle-t { fill: var(--text); font-size: 12px; text-anchor: middle; }
  .clk { stroke: var(--accent); stroke-width: 2.4; }
  .clk-h { fill: var(--accent); cursor: ew-resize; }
  .clk-t { fill: var(--accent-ink); font-size: 12px; font-weight: 600; }
  .grab { fill: transparent; cursor: ew-resize; }
  .cap { fill: var(--bg); stroke: var(--accent); stroke-width: 1.6; }
  .cap.on { fill: var(--accent); }
  .got { font: 600 14px var(--font-mono); text-anchor: middle; dominant-baseline: central; fill: var(--text); }
  .got.bad { fill: var(--accent-ink); }
  .badbg { fill: var(--accent-soft); }
  .ch { fill: var(--muted); font-size: 11px; text-anchor: middle; }
  .res { fill: var(--text); font: 600 14px var(--font-mono); }
  .res .bad { fill: var(--accent-ink); }
  .res .ok { fill: var(--text); }
  .res .dim { fill: var(--muted); font-weight: 400; }
</style>
<section class="oc" aria-label="超频：时钟沿来得太早，寄存器抄到的是加法器还没算完的中间值">
  <div class="top">
    <div class="seg" role="group" aria-label="输入">
      <button type="button" data-p="0">27 + 37</button>
      <button type="button" data-p="1">127 + 1</button>
      <button type="button" data-p="2">1 + 1</button>
    </div>
    <label class="ctl"><span>主频</span><output></output><input type="range" min="2" max="9" step="0.1" value="4.5" aria-label="时钟频率，单位 GHz"></label>
  </div>
  <svg role="img"></svg>
</section>
<script>
const N = 8, T = 20, PS = 20;           // 画 20 个门延迟；假设一个门延迟 20 皮秒
const PRESETS = [[27, 37], [127, 1], [1, 1]];
const root = document.querySelector('.oc'), svg = root.querySelector('svg'), slider = root.querySelector('input');
let preset = 0, width = 0, G = null, hist = [];

const bit = (x, i) => (x >> i) & 1;

// 和加法器那张图同一套门级模拟：上一拍是 0 + 0，这一拍输入换成 a、b
function simulate(a, b) {
  let v = { p: Array(N).fill(0), g: Array(N).fill(0), t: Array(N).fill(0), s: Array(N).fill(0), c: Array(N + 1).fill(0) };
  const out = [v.s.slice()];
  for (let k = 1; k <= T; k++) {
    const n = { p: [], g: [], t: [], s: [], c: [0] };
    for (let i = 0; i < N; i++) {
      n.p[i] = bit(a, i) ^ bit(b, i);
      n.g[i] = bit(a, i) & bit(b, i);
      n.t[i] = v.p[i] & v.c[i];
      n.c[i + 1] = v.g[i] | v.t[i];
      n.s[i] = v.p[i] ^ v.c[i];
    }
    v = n;
    out.push(v.s.slice());
  }
  return out;
}

const word = (bits) => bits.reduce((x, b, i) => x | (b << i), 0);
const bin = (x) => x.toString(2).padStart(8, '0').replace(/(....)(....)/, '$1 $2');

function geo() {
  const narrow = width < 480, labW = narrow ? 26 : 34, capW = narrow ? 34 : 56;
  const top = 34, rowH = narrow ? 28 : 30, x0 = labW, x1 = width - capW - (narrow ? 6 : 14);
  const H = top + N * rowH + 32 + 58;
  return { narrow, labW, capW, top, rowH, x0, x1, H, tx: (t) => x0 + (t / T) * (x1 - x0), ty: (i) => top + i * rowH };
}

function mount() {
  G = geo();
  svg.setAttribute('viewBox', `0 0 ${width} ${G.H}`);
  draw();
}

function draw() {
  const g = G, [a, b] = PRESETS[preset], f = Number(slider.value);
  const edge = Math.min(T, 1000 / f / PS);          // 时钟周期，折算成门延迟
  const k = Math.floor(edge + 1e-9);
  const fin = hist[T], got = hist[k];
  let settle = 0;
  for (let t = 0; t <= T; t++) if (word(hist[t]) !== word(fin)) settle = t + 1;
  let s = '';
  // 时间轴（皮秒）
  const yAx = g.ty(N) + 6;
  s += `<line class="axl" x1="${g.x0}" x2="${g.x1}" y1="${yAx}" y2="${yAx}"/>`;
  for (let t = 0; t <= T; t += 5) {
    s += `<line class="axl" x1="${g.tx(t)}" x2="${g.tx(t)}" y1="${yAx}" y2="${yAx + 4}"/>`;
    if (Math.abs(g.tx(t) - g.tx(edge)) > 16) s += `<text class="ax" x="${g.tx(t)}" y="${yAx + 18}">${t * PS}${t === T ? ' ps' : ''}</text>`;
  }
  // 每一行一位：S0 在最上面，进位从上往下传
  for (let i = 0; i < N; i++) {
    const y = g.ty(i), hiY = y + 5, loY = y + g.rowH - 7;
    s += `<text class="rl" x="0" y="${(hiY + loY) / 2}">S${i}</text><line class="lane" x1="${g.x0}" x2="${g.x1}" y1="${loY}" y2="${loY}"/>`;
    let d = '', fill = '';
    for (let t = 0; t < T; t++) {
      const v = hist[t][i], xa = g.tx(t), xb = g.tx(t + 1);
      d += `${t ? 'L' : 'M'}${xa} ${v ? hiY : loY}L${xb} ${v ? hiY : loY}`;
      if (v) fill += `M${xa} ${hiY}H${xb}V${loY}H${xa}Z`;
    }
    s += `<path class="fill" d="${fill}"/><path class="wave" d="${d}"/>`;
  }
  // 时钟沿之后的部分淡掉：寄存器已经抄完了
  s += `<rect x="${g.tx(edge)}" y="${g.top - 4}" width="${Math.max(0, g.x1 - g.tx(edge))}" height="${N * g.rowH + 4}" fill="var(--bg)" opacity=".55"/>`;
  // 稳定时刻
  if (settle > 0) {
    const xs = g.tx(settle);
    s += `<line class="settle" x1="${xs}" x2="${xs}" y1="${g.top - 8}" y2="${yAx}"/>`;
    s += `<text class="settle-t" x="${Math.min(xs, g.x1 - 30)}" y="${g.top - 14}">${word(fin)} 稳了</text>`;
  }
  // 时钟沿：可以直接拖
  const xe = g.tx(edge);
  s += `<line class="clk" x1="${xe}" x2="${xe}" y1="${g.top - 8}" y2="${yAx + 26}"/><path class="clk-h" d="M${xe - 7} ${yAx + 36}h14l-7 -9z"/>`;
  s += `<text class="clk-t" x="${xe + (xe > g.x1 - 60 ? -12 : 12)}" y="${yAx + 34}" text-anchor="${xe > g.x1 - 60 ? 'end' : 'start'}">时钟沿</text>`;
  s += `<rect class="grab" x="${xe - 18}" y="${g.top - 10}" width="36" height="${yAx - g.top + 50}"/>`;
  // 每一行在时钟沿上抄到的值；和最终值不一样的标出来
  const cx = width - g.capW / 2 - 2;
  s += `<text class="ch" x="${cx}" y="${g.top - 14}">抄到</text>`;
  for (let i = 0; i < N; i++) {
    const y = g.ty(i), bad = got[i] !== fin[i], hiY = y + 5, loY = y + g.rowH - 7, cy = (hiY + loY) / 2;
    s += `<circle class="cap${got[i] ? ' on' : ''}" cx="${xe}" cy="${got[i] ? hiY : loY}" r="3.6"/>`;
    if (bad) s += `<rect class="badbg" x="${cx - 13}" y="${cy - 11}" width="26" height="22" rx="5"/>`;
    s += `<text class="got${bad ? ' bad' : ''}" x="${cx}" y="${cy}">${got[i]}</text>`;
  }
  const ok = word(got) === word(fin), ry = yAx + 64;
  s += `<text class="res" x="0" y="${ry}"><tspan class="dim">寄存器抄到 </tspan><tspan class="${ok ? 'ok' : 'bad'}">${g.narrow ? '' : bin(word(got)) + ' = '}${word(got)}</tspan><tspan class="dim">${ok ? '，对了' : `，应该是 ${word(fin)}`}</tspan></text>`;
  svg.innerHTML = s;
  root.querySelector('output').textContent = `${f.toFixed(1)} GHz`;
  root.querySelectorAll('[data-p]').forEach((bt) => bt.setAttribute('aria-pressed', String(Number(bt.dataset.p) === preset)));
  svg.setAttribute('aria-label', `${a} + ${b}：主频 ${f.toFixed(1)} GHz，一拍 ${Math.round(1000 / f)} 皮秒；和在 ${settle * PS} 皮秒时才稳定；寄存器抄到 ${word(got)}${ok ? '，正确' : `，应为 ${word(fin)}`}`);
}

function pick(p) { preset = p; hist = simulate(...PRESETS[p]); draw(); }
root.querySelectorAll('[data-p]').forEach((bt) => bt.addEventListener('click', () => pick(Number(bt.dataset.p))));
slider.addEventListener('input', draw);

// 在图上横着拖，直接改时钟沿的位置
let dragging = false;
function dragTo(e) {
  const box = svg.getBoundingClientRect(), x = (e.clientX - box.left) * (width / box.width);
  const t = Math.max(1000 / 9 / PS, Math.min(T, ((x - G.x0) / (G.x1 - G.x0)) * T));
  slider.value = (1000 / (t * PS)).toFixed(1);
  draw();
}
svg.addEventListener('pointerdown', (e) => {
  const box = svg.getBoundingClientRect(), x = (e.clientX - box.left) * (width / box.width);
  if (x < G.x0 - 10 || x > G.x1 + 10) return;
  dragging = true;
  svg.setPointerCapture(e.pointerId);
  dragTo(e);
});
svg.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
for (const ev of ['pointerup', 'pointercancel']) svg.addEventListener(ev, () => { dragging = false; });

hist = simulate(...PRESETS[0]);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; mount(); }
}).observe(svg);
</script>
```

结果先是 62，也就是 27 异或 37；然后进位一位一位往上走，把 1 清成 0：60、56、48、32、0，最后才是 64。时钟定在 4.5 GHz，一拍 222 皮秒，和要到 260 皮秒才稳，寄存器抄到的是 0。

超频超过头程序会算错，原因就在这：电路还没算完，结果就被抄走了。一拍得比最慢的那条路径长，这条路径叫关键路径，而且要按最坏的输入算。换成 127 + 1，进位要从最低位一路传到最高位，300 皮秒才稳，主频得降到 3.3 GHz 才抄得对。

想让时钟更快，要么让门翻转得更快，要么让一拍里要穿过的门更少。前一条路得抬电压，而功耗大致和电压的平方乘频率成正比，发热涨得比频率快得多：2004 年奔腾 4 就到了 3.8 GHz，二十年后最快的桌面 CPU 也才 6 GHz 出头。后一条路是把一件事拆成几拍来做，后面的流水线就是这么来的。

## 内存：数住在哪

`add` 拿到的 `rdi`、`rsi` 不是 27 和 37，是两个地址。内存是一长排字节，每个字节有一个编号，这个编号就是地址。寄存器 `rsp` 里存的是栈顶的地址，在 gdb 里看它往上的 16 个字节：

```text
(gdb) x/16xb $rsp
0x7fffffffdb38:	0x80	0x50	0x55	0x55	0x55	0x55	0x00	0x00
0x7fffffffdb40:	0x1b	0x00	0x00	0x00	0x25	0x00	0x00	0x00
```

`0x7fffffffdb40` 开始的 `1b 00 00 00` 是 27，后面的 `25 00 00 00` 是 37。低位字节放在低地址，倒着读，这叫小端。x86 和绝大多数 ARM 系统都是小端；网络协议里的数按大端传，高位在前。

前 8 个字节倒过来是 `0x555555555080`，是 `main` 里 `call` 的下一条指令，`add` 返回以后要回到这里。`x` 和 `y` 为什么挨着放在栈上，[《C++ 的变量都住在哪》](/posts/cpp-memory/)里讲过。

这么多字节，不能像寄存器那样用触发器存：一个触发器要十几二十个晶体管，16 GB 是一千三百多亿位。内存条里用的是 DRAM，每一位只有一个晶体管加一个小电容，电容里有电荷是 1，没有是 0。地址送进去，译码器把它变成一根被选中的线，$k$ 位地址能选 $2^k$ 根。电容会漏电，每隔几十毫秒就得全部读一遍再写回去，叫刷新。

这样做便宜，能做大，代价是慢。这笔账等 CPU 搭好再算。

## 取指，译码，执行

零件齐了：ALU 算，寄存器记，内存存数也存指令，时钟打拍子。还差一个东西来安排它们这一拍各干什么。

CPU 里有个寄存器 `rip`，存着下一条指令的地址。剩下的就是一个循环：

1. 取指：按 `rip` 从内存读出指令的字节，`rip` 往后挪到下一条。
2. 译码：看这几个字节是什么指令，用哪些寄存器。
3. 执行：让 ALU 算，读写寄存器和内存。

第一条指令是 `8b 06`。头一个字节 `8b` 是操作码，意思是“从寄存器或内存读 4 个字节，放进一个寄存器”。具体是哪两个，写在下一个字节里，这个字节叫 ModRM。`06` 拆开是 `00 000 110`：

| 字段 | 位 | 意思 |
| --- | --- | --- |
| mod | `00` | r/m 指的是内存，不加偏移 |
| reg | `000` | `eax` |
| r/m | `110` | 地址在 `rsi` 里 |

第二条是 `03 07`。`03` 是加法，`07` 是 `00 000 111`，`111` 是 `rdi`。`06` 和 `07` 只差最后一位，差的就是 `rsi` 和 `rdi`。

译码器是一张焊死的表：字节进去，控制信号出来。控制信号就是一把导线，哪个寄存器接到 ALU 上，ALU 做加法还是减法，结果写回哪里，都看这些线上是 0 还是 1。

下面这台小 CPU 跑的就是这 5 个字节，地址和数都是 gdb 里看到的。现在停在第一条指令刚译码完的地方，点“单步”往下走：

```render html title="地址、字节和寄存器的值来自 gdb（GCC 16.2，-O2）"
<style>
  .mc { position: relative; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 20px; }
  .keys { display: flex; gap: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .stages { display: flex; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .stages li { padding: 3px 10px; border-radius: 99px; color: var(--faint); font-size: 13px; transition: background-color .2s, color .2s; }
  .stages li.on { background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px 28px; margin-top: 16px; }
  @media (min-width: 600px) { .grid { grid-template-columns: max-content minmax(0, 1fr); } .mem { grid-column: 1 / -1; } }
  .h { margin-bottom: 6px; color: var(--muted); font-size: 12px; }
  .regs { display: grid; grid-template-columns: max-content max-content; gap: 4px 12px; align-content: start; }
  .regs span { color: var(--muted); font: 13px var(--font-mono); }
  .regs code { padding: 0 6px; margin: 0 -6px; border-radius: 4px; color: var(--text); font: 600 13.5px var(--font-mono); transition: background-color .5s; }
  .regs code.hot { background: var(--accent-soft); color: var(--accent-ink); transition: none; }
  .regs code small { color: var(--muted); font-weight: 400; margin-left: 6px; }
  .dec { min-height: 150px; }
  .ins { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
  .ins b { font: 650 22px var(--font-mono); letter-spacing: .04em; }
  .ins .asm { color: var(--accent-ink); font: 600 14px var(--font-mono); }
  .fields { display: grid; grid-template-columns: max-content max-content minmax(0, 1fr); gap: 2px 14px; margin-top: 10px; align-items: baseline; }
  @media (max-width: 599px) { .fields { grid-template-columns: max-content minmax(0, 1fr); } .fields .mean { grid-column: 1 / -1; margin: -2px 0 6px; } }
  .fields .hx { color: var(--text); font: 600 14px var(--font-mono); }
  .fields .bn { font: 14px var(--font-mono); letter-spacing: .02em; }
  .fields .bn i { font-style: normal; padding: 0 1px; border-bottom: 2px solid var(--rule-strong); }
  .fields .bn i.f1 { border-color: var(--rule-strong); }
  .fields .bn i.f2 { border-color: var(--accent); }
  .fields .bn i.f3 { border-color: var(--accent); }
  .fields .mean { color: var(--muted); font-size: 12.5px; }
  .fields .mean em { color: var(--text); font-style: normal; font-family: var(--font-mono); }
  .op { margin-top: 8px; color: var(--text); font: 600 14px var(--font-mono); overflow-wrap: anywhere; }
  .op + .op { margin-top: 2px; }
  .op .r { color: var(--accent-ink); }
  .op span { color: var(--muted); font-weight: 400; font-family: var(--font-sans); }
  .mem { display: grid; gap: 14px; }
  .strip .sl { margin-bottom: 4px; color: var(--muted); font-size: 12px; }
  .strip .sl code { margin-left: 6px; color: var(--text); font: 12.5px var(--font-mono); }
  .cells { display: grid; gap: 3px; padding-top: 18px; }
  .code .cells { grid-template-columns: repeat(5, minmax(0, 34px)); }
  .stack .cells { grid-template-columns: repeat(16, minmax(0, 1fr)); max-width: 640px; }
  .c { position: relative; display: flex; align-items: center; justify-content: center; height: 30px; border: 1px solid var(--rule-strong); border-radius: 4px; background: var(--bg-raised); color: var(--text); font: 13px var(--font-mono); transition: background-color .25s, border-color .25s; }
  .c.hl { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  .c.done { color: var(--faint); }
  .tag { position: absolute; bottom: 100%; left: 0; margin-bottom: 2px; color: var(--muted); font: 11px var(--font-mono); white-space: nowrap; }
  .tag.rip { color: var(--accent-ink); font-weight: 600; }
  .grp { grid-row: 2; padding-top: 3px; border-top: 2px solid var(--rule-strong); color: var(--muted); font-size: 12px; text-align: center; white-space: nowrap; }
  .grp code { font: 12px var(--font-mono); color: var(--text); }
  @media (max-width: 599px) {
    .stack .cells { grid-template-columns: repeat(8, minmax(0, 1fr)); row-gap: 3px; }
    .stack .c:nth-child(-n+8) { grid-row: 1; }
    .stack .c:nth-child(n+9) { grid-row: 3; }
    .grp.ra { grid-row: 2; grid-column: 1 / span 8; margin-bottom: 14px; }
    .grp.x { grid-row: 4; grid-column: 1 / span 4; }
    .grp.y { grid-row: 4; grid-column: 5 / span 4; }
  }
  @media (min-width: 600px) { .grp.ra { grid-column: 1 / span 8; } .grp.x { grid-column: 9 / span 4; } .grp.y { grid-column: 13 / span 4; } }
  .note { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .pkt { position: absolute; z-index: 2; padding: 1px 8px; border-radius: 99px; background: var(--accent); color: var(--bg); font: 600 12.5px var(--font-mono); white-space: nowrap; pointer-events: none; }
</style>
<section class="mc" aria-label="一个只认三条指令的 x86 小 CPU，按 gdb 里的真实地址跑 add 的 5 个字节">
  <div class="top">
    <div class="keys">
      <button type="button" class="key next">单步</button>
      <button type="button" class="key auto">自动</button>
      <button type="button" class="key again">重来</button>
    </div>
    <ol class="stages"><li>取指</li><li>译码</li><li>执行</li></ol>
  </div>
  <div class="grid">
    <div><div class="h">寄存器</div><div class="regs"></div></div>
    <div class="dec"><div class="h">指令</div><div class="body"></div></div>
    <div class="mem">
      <div class="strip code"><div class="sl">代码<code>0x5555555551b0</code></div><div class="cells"></div></div>
      <div class="strip stack"><div class="sl">栈<code>0x7fffffffdb38</code></div><div class="cells"></div></div>
    </div>
  </div>
  <p class="note" aria-live="polite"></p>
</section>
<script>
const root = document.querySelector('.mc');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CODE = 0x5555555551b0, STACK = 0x7fffffffdb38;
const R64 = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi'], R32 = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const OPS = { 0x8b: ['mov', '把 r/m 指的数读进 reg'], 0x03: ['add', 'reg 加上 r/m 指的数'], 0xc3: ['ret', '从栈顶取出返回地址，放进 rip'] };
const hex = (x, n = 2) => x.toString(16).padStart(n, '0');
const bin = (x) => x.toString(2).padStart(8, '0');

// 内存里就这两段：add 的 5 个字节，和栈上的返回地址、x、y（全部来自 gdb）
const mem = new Map();
[0x8b, 0x06, 0x03, 0x07, 0xc3].forEach((b, i) => mem.set(CODE + i, b));
[0x80, 0x50, 0x55, 0x55, 0x55, 0x55, 0x00, 0x00, 0x1b, 0, 0, 0, 0x25, 0, 0, 0].forEach((b, i) => mem.set(STACK + i, b));
const read = (a, n) => { let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + mem.get(a + i); return v; };

// 先把每一步的状态算出来：一个只认 mov、add、ret 的 CPU
function run() {
  const r = { rip: CODE, rsp: STACK, rdi: STACK + 8, rsi: STACK + 12, rax: 0 };
  const snap = (stage, x = {}) => ({ stage, regs: { ...r }, ...x });
  const out = [snap(-1)];
  for (;;) {
    const at = r.rip, op = mem.get(at), len = op === 0xc3 ? 1 : 2, bytes = [];
    for (let i = 0; i < len; i++) bytes.push(mem.get(at + i));
    r.rip += len;
    out.push(snap(0, { at, bytes, hot: ['rip'], read: { from: at, n: len } }));
    const m = len === 2 ? { mod: bytes[1] >> 6, reg: (bytes[1] >> 3) & 7, rm: bytes[1] & 7 } : null;
    out.push(snap(1, { at, bytes, m }));
    if (op === 0xc3) {
      const from = r.rsp, back = read(from, 8);
      r.rip = back; r.rsp += 8;
      out.push(snap(2, { at, bytes, m, hot: ['rip', 'rsp'], read: { from, n: 8 }, to: 'rip', ret: back }));
      break;
    }
    const from = r[R64[m.rm]], val = read(from, 4), before = r.rax;
    r.rax = op === 0x8b ? val : (before + val) >>> 0;
    out.push(snap(2, { at, bytes, m, hot: ['rax'], read: { from, n: 4 }, to: 'rax', val, before }));
  }
  return out;
}
const STEPS = run();
let idx = 2, timer = 0, playing = false;

// 搭格子
const regs = root.querySelector('.regs');
for (const [k, name] of [['rip', 'rip'], ['rsp', 'rsp'], ['rdi', 'rdi'], ['rsi', 'rsi'], ['rax', 'eax']])
  regs.insertAdjacentHTML('beforeend', `<span>${name}</span><code data-r="${k}"></code>`);
const cells = (box, base, n) => { for (let i = 0; i < n; i++) box.insertAdjacentHTML('beforeend', `<span class="c" data-a="${base + i}">${hex(mem.get(base + i))}</span>`); };
cells(root.querySelector('.code .cells'), CODE, 5);
const sc = root.querySelector('.stack .cells');
cells(sc, STACK, 16);
sc.insertAdjacentHTML('beforeend', '<span class="grp ra">返回地址</span><span class="grp x"><code>x</code> = 27</span><span class="grp y"><code>y</code> = 37</span>');
const cell = (a) => root.querySelector(`.c[data-a="${a}"]`);

function regText(k, v) {
  if (k === 'rax') return `0x${hex(v, 8)}<small>${v}</small>`;
  return `0x${hex(v, 12)}`;
}

function decodeHTML(S) {
  if (S.stage < 0) return '';
  const [name, mean] = OPS[S.bytes[0]];
  let h = `<div class="ins"><b>${S.bytes.map((b) => hex(b)).join(' ')}</b>`;
  if (S.stage >= 1) h += `<span class="asm">${S.m ? `${name} (%${R64[S.m.rm]}),%${R32[S.m.reg]}` : name}</span>`;
  h += '</div>';
  if (S.stage >= 1) {
    h += `<div class="fields"><span class="hx">${hex(S.bytes[0])}</span><span class="bn">${bin(S.bytes[0])}</span><span class="mean"><em>${name}</em>：${mean}</span>`;
    if (S.m) {
      const b = bin(S.bytes[1]);
      h += `<span class="hx">${hex(S.bytes[1])}</span><span class="bn"><i class="f1">${b.slice(0, 2)}</i> <i class="f2">${b.slice(2, 5)}</i> <i class="f3">${b.slice(5)}</i></span>`;
      h += `<span class="mean">mod <em>${b.slice(0, 2)}</em> 读内存 · reg <em>${b.slice(2, 5)}</em> = <em>${R32[S.m.reg]}</em> · r/m <em>${b.slice(5)}</em> = <em>${R64[S.m.rm]}</em></span>`;
    }
    h += '</div>';
  }
  if (S.stage === 0) h += `<div class="op">rip ← 0x${hex(S.regs.rip, 12)} <span>跳过这 ${S.bytes.length} 个字节</span></div>`;
  if (S.stage === 2) {
    const bytes = [];
    for (let i = 0; i < S.read.n; i++) bytes.push(hex(mem.get(S.read.from + i)));
    const src = S.ret ? 'rsp' : R64[S.m.rm], val = S.ret ? `0x${hex(S.ret, 12)}` : S.val;
    h += `<div class="op">(%${src}) → ${bytes.join(' ')} <span>倒过来读</span> ${val}</div>`;
    if (S.ret) h += `<div class="op">rip ← <span class="r">${val}</span></div><div class="op">rsp ← 0x${hex(S.regs.rsp, 12)} <span>加 8</span></div>`;
    else if (S.bytes[0] === 0x8b) h += `<div class="op">eax ← <span class="r">${S.val}</span></div>`;
    else h += `<div class="op">eax ← ${S.before} + ${S.val} = <span class="r">${S.before + S.val}</span> <span>运算器</span></div>`;
  }
  return h;
}

const NOTES = [
  'call 刚跳过来：rip 指着 add 的第一个字节',
  '取指：按 rip 读出这条指令的字节，rip 跳过它们',
  '译码：拆开比特，查出要做什么、对谁做',
  '执行',
];

function draw(S, prev) {
  root.querySelectorAll('.stages li').forEach((li, i) => li.classList.toggle('on', i === S.stage));
  for (const k of ['rip', 'rsp', 'rdi', 'rsi', 'rax']) {
    const el = root.querySelector(`[data-r="${k}"]`);
    el.innerHTML = regText(k, S.regs[k]);
    el.classList.toggle('hot', !!S.hot?.includes(k));
  }
  root.querySelector('.dec .body').innerHTML = decodeHTML(S);
  root.querySelectorAll('.c').forEach((c) => c.classList.remove('hl'));
  if (S.read) for (let i = 0; i < S.read.n; i++) cell(S.read.from + i).classList.add('hl');
  // rip 指在哪个字节上；ret 之后已经离开这段代码
  // 哪些寄存器正指着哪个字节；ret 之后 rip 已经离开这段代码
  root.querySelectorAll('.tag').forEach((t) => t.remove());
  const at = {};
  for (const k of ['rip', 'rsp', 'rdi', 'rsi']) if (cell(S.regs[k])) (at[S.regs[k]] ??= []).push(k);
  for (const [a, ks] of Object.entries(at)) cell(Number(a)).insertAdjacentHTML('afterbegin', `<i class="tag${ks.includes('rip') ? ' rip' : ''}">${ks.join(' ')}</i>`);
  let note = NOTES[S.stage + 1];
  if (S.stage === 2) note = S.ret ? '执行：rsp 指着的 8 个字节就是返回地址，rip 换成它，回到 main' : S.bytes[0] === 0x8b ? `执行：按 ${R64[S.m.rm]} 里的地址读 4 个字节，放进 ${R32[S.m.reg]}` : `执行：按 ${R64[S.m.rm]} 里的地址读 4 个字节，和 ${R32[S.m.reg]} 一起送进运算器`;
  root.querySelector('.note').textContent = note;
  root.querySelector('.next').disabled = idx >= STEPS.length - 1;
  root.querySelector('.auto').textContent = playing ? '暂停' : '自动';
  if (prev && !reduce) fly(S);
}

// 一小块数据从内存飞到它要去的地方
function fly(S) {
  if (!S.read) return;
  const box = root.getBoundingClientRect();
  const from = cell(S.read.from).getBoundingClientRect(), last = cell(S.read.from + S.read.n - 1).getBoundingClientRect();
  const target = S.stage === 0 ? root.querySelector('.ins b') : root.querySelector(`[data-r="${S.to}"]`);
  if (!target) return;
  const to = target.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'pkt';
  const bytes = [];
  for (let i = 0; i < S.read.n; i++) bytes.push(hex(mem.get(S.read.from + i)));
  p.textContent = bytes.join(' ');
  root.append(p);
  const pw = p.offsetWidth, ph = p.offsetHeight;
  const x0 = (from.left + last.right) / 2 - box.left - pw / 2, y0 = from.top - box.top + (from.height - ph) / 2;
  const x1 = to.left - box.left + Math.min(to.width, 140) / 2 - pw / 2, y1 = to.top - box.top + (to.height - ph) / 2;
  p.style.left = '0px'; p.style.top = '0px';
  p.animate([
    { transform: `translate(${x0}px, ${y0}px)`, opacity: 0 },
    { transform: `translate(${x0}px, ${y0}px)`, opacity: 1, offset: .15 },
    { transform: `translate(${x1}px, ${y1}px)`, opacity: 1, offset: .85 },
    { transform: `translate(${x1}px, ${y1}px)`, opacity: 0 },
  ], { duration: 900, easing: 'cubic-bezier(.4, 0, .2, 1)' }).finished.then(() => p.remove());
}

function go(i) {
  const prev = STEPS[idx];
  idx = i;
  draw(STEPS[idx], i > 0 && prev);
}
function stop() { playing = false; clearInterval(timer); draw(STEPS[idx]); }
root.querySelector('.next').addEventListener('click', () => { stop(); if (idx < STEPS.length - 1) go(idx + 1); });
root.querySelector('.again').addEventListener('click', () => { stop(); go(0); });
root.querySelector('.auto').addEventListener('click', () => {
  if (playing) return stop();
  if (idx >= STEPS.length - 1) go(0);
  playing = true;
  draw(STEPS[idx]);
  timer = setInterval(() => {
    if (idx >= STEPS.length - 1) return stop();
    go(idx + 1);
    if (idx >= STEPS.length - 1) stop();
  }, 1400);
});
draw(STEPS[idx]);
</script>
```

最后一条 `ret` 从栈顶读出 8 个字节放进 `rip`，`rsp` 加 8，下一次取指就回到了 `main`。

指令和数据放在同一块内存里，CPU 照着 `rip` 一条条取来执行，这个设计写在 1945 年冯·诺依曼的 EDVAC 报告里，到现在也没变。

x86 的指令长短不一，短的 1 个字节，长的 15 个字节，前面还能加各种前缀，译码器很复杂。现代的 x86 CPU 会先把指令拆成更简单的微操作（µop），比如 `add (%rdi),%eax` 拆成一个读内存、一个加法。

## 内存跟不上

CPU 一拍 0.21 纳秒，读一次内存要多久？

测法叫指针追逐：一块内存里，每个数存着下一个数的位置，顺序全部打乱。不读出这一个，就不知道下一个在哪，CPU 没法提前去取，只能干等。把这块内存从 4 KB 一路加到 64 MB，看平均每次读要多久。点按钮可以在你的设备上测一遍：

```render html title="我的笔记本：i7-12650H，Chromium，测量时开着省电模式"
<style>
  .lat { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .status { color: var(--muted); font-size: 13px; }
  .status b { color: var(--accent-ink); font: 600 13px var(--font-mono); }
  .legend { display: inline-flex; align-items: center; gap: 6px; color: var(--accent-ink); font-size: 12.5px; font-weight: 600; }
  .legend[hidden] { display: none; }
  .legend i { width: 18px; height: 3px; border-radius: 2px; background: var(--accent); }
  .lat svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; }
  .grid { stroke: var(--rule); stroke-width: 1; }
  .ax { fill: var(--muted); font: 11px var(--font-mono); }
  .axt { fill: var(--muted); font-size: 12px; }
  .cache { stroke: var(--rule-strong); stroke-width: 1; stroke-dasharray: 3 4; }
  .cache-t { fill: var(--faint); font: 11px var(--font-mono); text-anchor: middle; }
  .zone { fill: var(--text); font-size: 12.5px; font-weight: 600; text-anchor: middle; }
  .ref { fill: none; stroke: var(--muted); stroke-width: 2; stroke-linejoin: round; }
  .ref-d { fill: var(--bg); stroke: var(--muted); stroke-width: 1.6; }
  .you { fill: none; stroke: var(--accent); stroke-width: 2.4; stroke-linejoin: round; }
  .you-d { fill: var(--accent); }
  .lab { font-size: 12px; font-weight: 600; }
  .lab.ref-l { fill: var(--muted); }
  .lab.you-l { fill: var(--accent-ink); }
</style>
<section class="lat" aria-label="一块内存越大，随机读一次越慢；曲线是一级一级的台阶">
  <div class="top">
    <button type="button" class="key run">在这台设备上测一遍</button>
    <span class="status" aria-live="polite"></span>
    <span class="legend" hidden><i></i>这台设备</span>
  </div>
  <svg role="img"></svg>
</section>
<script>
// 我的笔记本（i7-12650H，Chromium）上用同一段代码测的结果：每次读要多少纳秒
const MINE = { 4: 3.0, 8: 3.1, 16: 3.2, 32: 3.1, 64: 8.2, 128: 8.5, 256: 8.4, 512: 9.3, 1024: 14.4, 2048: 35.3, 4096: 37.1, 8192: 46.5, 16384: 130.1, 32768: 191.1, 65536: 180.8 };
const SIZES = Object.keys(MINE).map(Number);
const CACHES = [[48, 'L1'], [1280, 'L2'], [24576, 'L3']];
const root = document.querySelector('.lat'), svg = root.querySelector('svg');
const runKey = root.querySelector('.run'), status = root.querySelector('.status');
let width = 0, yours = {}, running = false;

const kb = (k) => (k >= 1024 ? `${k / 1024} MB` : `${k} KB`);

function geo() {
  const narrow = width < 480, l = narrow ? 34 : 44, r = narrow ? 8 : 16, t = 34, h = narrow ? 210 : 250;
  const lx = (k) => Math.log2(k), x0 = lx(SIZES[0]), x1 = lx(SIZES.at(-1));
  const ly = (ns) => Math.log10(ns), y0 = ly(1), y1 = ly(300);
  return { narrow, l, r, t, h, H: t + h + 46,
    x: (k) => l + ((lx(k) - x0) / (x1 - x0)) * (width - l - r),
    y: (ns) => t + h - ((ly(ns) - y0) / (y1 - y0)) * h };
}

function line(g, data, cls) {
  const ks = SIZES.filter((k) => data[k]);
  if (!ks.length) return '';
  let s = `<path class="${cls}" d="${ks.map((k, i) => `${i ? 'L' : 'M'}${g.x(k)} ${g.y(data[k])}`).join('')}"/>`;
  for (const k of ks) s += `<circle class="${cls}-d" cx="${g.x(k)}" cy="${g.y(data[k])}" r="${cls === 'ref' ? 3 : 3.4}"/>`;
  return s;
}

function draw() {
  if (!width) return;
  const g = geo();
  let s = '';
  for (const ns of [1, 3, 10, 30, 100, 300]) {
    s += `<line class="grid" x1="${g.l}" x2="${width - g.r}" y1="${g.y(ns)}" y2="${g.y(ns)}"/><text class="ax" x="${g.l - 6}" y="${g.y(ns) + 4}" text-anchor="end">${ns}</text>`;
  }
  s += `<text class="axt" x="${g.l}" y="${g.t - 16}">每次读（纳秒）</text>`;
  const ticks = g.narrow ? [4, 64, 1024, 16384] : [4, 32, 256, 2048, 16384, 65536];
  for (const k of ticks) s += `<text class="ax" x="${g.x(k)}" y="${g.t + g.h + 18}" text-anchor="${k === SIZES.at(-1) ? 'end' : k === SIZES[0] ? 'start' : 'middle'}">${kb(k)}</text>`;
  s += `<text class="axt" x="${width - g.r}" y="${g.t + g.h + 38}" text-anchor="end">数据块大小</text>`;
  // 我那台机器的三级缓存有多大：台阶就落在这几条线附近
  for (const [k, name] of CACHES) {
    s += `<line class="cache" x1="${g.x(k)}" x2="${g.x(k)}" y1="${g.t}" y2="${g.t + g.h}"/>`;
    if (!g.narrow) s += `<text class="cache-t" x="${g.x(k)}" y="${g.t - 2}">${kb(k)}</text>`;
  }
  const zones = [[8, 'L1', 3.1], [256, 'L2', 8.4], [4096, 'L3', 37.1], [45000, '内存', 191]];
  for (const [k, name, ns] of zones) s += `<text class="zone" x="${Math.min(g.x(k), width - g.r - 14)}" y="${g.y(ns) - 12}">${name}</text>`;
  s += line(g, MINE, 'ref') + line(g, yours, 'you');
  const ks = SIZES.filter((k) => yours[k]);
  s += `<text class="lab ref-l" x="${g.x(256)}" y="${g.y(MINE[256]) + 22}" text-anchor="middle">我的笔记本</text>`;

  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
  root.querySelector('.legend').hidden = !ks.length;
  const desc = ks.length ? `；这台设备：${ks.map((k) => `${kb(k)} ${yours[k].toFixed(1)} 纳秒`).join('，')}` : '';
  svg.setAttribute('aria-label', `随机读一次的时间：我的笔记本上 4 KB 约 3 纳秒，256 KB 约 8 纳秒，4 MB 约 37 纳秒，64 MB 约 181 纳秒${desc}`);
}

// 指针追逐：每个缓存行放一个数，指向下一个随机的缓存行；读不出这一个，就不知道下一个在哪
function chase(a, start, steps) {
  let p = start;
  for (let i = 0; i < steps; i++) p = a[p];
  return p;
}

const pause = () => new Promise((r) => setTimeout(r, 0));

async function measure() {
  running = true;
  runKey.disabled = true;
  yours = {};
  draw();
  let a;
  try { a = new Int32Array((SIZES.at(-1) * 1024) / 4); }
  catch { a = new Int32Array((16 << 20) / 4); }
  chase(a, 0, 1 << 16);                       // 先让 JIT 编译好
  let seed = 1;
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 8;
  for (const k of SIZES) {
    const lines = (k * 1024) / 64;
    if (lines * 16 > a.length) break;
    status.innerHTML = `正在测 <b>${kb(k)}</b>`;
    await pause();
    // Sattolo 洗牌：所有缓存行串成一个大圈
    const order = new Int32Array(lines);
    for (let i = 0; i < lines; i++) order[i] = i;
    for (let i = lines - 1; i > 0; i--) { const j = rand() % i, t = order[i]; order[i] = order[j]; order[j] = t; }
    for (let i = 0; i < lines; i++) a[order[i] * 16] = order[(i + 1) % lines] * 16;
    let p = chase(a, 0, lines * 2), steps = 1 << 16, best = Infinity;
    // 每次至少跑 30 毫秒，取三次里最快的
    for (;;) { const t0 = performance.now(); p = chase(a, p, steps); if (performance.now() - t0 > 30) break; steps *= 2; }
    for (let r = 0; r < 3; r++) {
      const t0 = performance.now();
      p = chase(a, p, steps);
      best = Math.min(best, ((performance.now() - t0) * 1e6) / steps);
      await pause();
    }
    yours[k] = Math.max(best, 1.01);
    draw();
  }
  a = null;
  running = false;
  runKey.disabled = false;
  runKey.textContent = '再测一遍';
  status.textContent = '';
}

runKey.addEventListener('click', () => { if (!running) measure(); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

曲线是一级一级的台阶，每一级的边都落在一个缓存的大小附近：

| 数据放在 | 大小 | 读一次 |
| --- | --- | --- |
| L1 | 48 KB | 3 纳秒左右 |
| L2 | 1.25 MB | 8 纳秒左右 |
| L3 | 24 MB | 几十纳秒 |
| 内存 | 16 GB | 180 纳秒左右 |

测的时候开着省电模式，主频只有 1.7 GHz 左右，L1 的 3 纳秒正好是 5 拍。

缓存是 CPU 里的几小块快内存，存着最近读过的数据的副本。读一个地址，先在缓存里找：找到了叫命中，直接用；没找到叫缺失，这才去内存读，读回来的留一份在缓存里，挤掉一份旧的。

这台 CPU 有三级缓存，都是 SRAM：每一位用 6 个晶体管搭成一个锁存器，不用刷新，快，但占地方，也贵。L1 离运算单元最近，最小最快；越往外越大，越慢。数据块小到 L1 装得下，每次读都命中 L1；大过 L1，就有一部分要去 L2 找，曲线上了一级台阶。

L1 和内存差 60 倍。把一拍放大成一秒，读 L1 是 5 秒，读一次内存是五分钟出头。

这么小的缓存能管用，是因为程序读内存很有规律：刚读过的，很快还会再读，这是时间局部性；读了这里，很快会读旁边，这是空间局部性。所以缺失的时候不只搬一个数，而是把它周围的 64 个字节一起搬进来，这 64 个字节叫一个缓存行。

## 缓存行：一次搬 64 字节

`x` 在 `0x7fffffffdb40`，`y` 在 `0x7fffffffdb44`。`0x7fffffffdb40` 是 64 的倍数，两个数落在同一个缓存行里，搬一次就都有了。

同样的数据，换个顺序读，缺失次数能差好几倍。下面把缓存缩小到只装得下 4 个缓存行，一个缓存行 4 个数。数组是 8 × 8 的，在内存里一行接一行地放，一行 8 个数正好占两个缓存行，图里每行中间留了一道缝。按行、按列各读一遍：

```render html title="缓存缩小成 4 个缓存行、每个 4 个数；底下的耗时是真跑的"
<style>
  .cl { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 250px)); gap: 16px 36px; margin-top: 16px; }
  @media (max-width: 420px) { .pair { gap: 16px 14px; } }
  .h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .h b { font-size: 14px; }
  .h span { color: var(--muted); font: 12.5px var(--font-mono); white-space: nowrap; }
  .h span em { color: var(--accent-ink); font-style: normal; font-weight: 700; }
  .m { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) 4px repeat(4, minmax(0, 1fr)); gap: 3px; max-width: 250px; }
  .m i { position: relative; aspect-ratio: 1; background: var(--bg-raised); border: 1px solid var(--rule-strong); border-radius: 3px; transition: background-color .15s, border-color .15s; }
  .m i:nth-child(8n+5) { grid-column-start: 6; }
  .m i.hit { background: var(--accent-soft); border-color: var(--accent-soft); }
  .m i.miss { background: var(--accent); border-color: var(--accent); }
  .m i.in { border-color: var(--text); }
  .m i.cur { outline: 2px solid var(--text); outline-offset: 1px; z-index: 1; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 12px; color: var(--muted); font-size: 12.5px; }
  .legend i { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border-radius: 3px; vertical-align: -1px; }
  .legend .miss { background: var(--accent); }
  .legend .hit { background: var(--accent-soft); border: 1px solid var(--rule-strong); }
  .legend .in { border: 1px solid var(--text); }
  .bench { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; gap: 6px 10px; align-items: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--rule); }
  .bench > b { grid-column: 1 / -1; min-width: 0; color: var(--muted); font-size: 12.5px; font-weight: 400; overflow-wrap: anywhere; }
  .bench span { color: var(--muted); font-size: 12.5px; }
  .bench .bar { height: 12px; border-radius: 2px; background: var(--rule-strong); transition: width .4s cubic-bezier(.22, 1, .36, 1); }
  .bench .bar.col { background: var(--accent); }
  .bench output { font: 600 13px var(--font-mono); text-align: right; }
  .bench .run { grid-column: 1 / -1; justify-self: start; margin-top: 4px; }
</style>
<section class="cl" aria-label="同一个 8×8 的数组，按行读和按列读，缓存缺失的次数差 4 倍">
  <div class="keys">
    <button type="button" class="key play">从头走一遍</button>
    <button type="button" class="key step">走一步</button>
  </div>
  <div class="pair">
    <div data-w="row"><div class="h"><b>按行</b><span>缺失 <em></em> 次</span></div><div class="m"></div></div>
    <div data-w="col"><div class="h"><b>按列</b><span>缺失 <em></em> 次</span></div><div class="m"></div></div>
  </div>
  <div class="legend"><span><i class="miss"></i>缺失，搬一个缓存行（4 个数）</span><span><i class="hit"></i>命中</span><span><i class="in"></i>此刻在缓存里</span></div>
  <div class="bench">
    <b>2048 × 2048 个 int，加一遍</b>
    <span>按行</span><div><div class="bar row"></div></div><output class="row"></output>
    <span>按列</span><div><div class="bar col"></div></div><output class="col"></output>
    <button type="button" class="key run">在这台设备上测</button>
  </div>
</section>
<script>
const N = 8, LINE = 4, WAYS = 4, DT = 70;
// 我的笔记本上（Chromium）测的：按行、按列各加一遍要多少毫秒
const MINE = { row: 2.4, col: 8.3 };
const root = document.querySelector('.cl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let t = N * N, timer = 0, bench = { ...MINE }, mine = true;

// 一个只有 4 行的小缓存，满了就踢掉最久没用的那行
function walk(order) {
  const cache = [], marks = [];
  for (const i of order) {
    const line = Math.floor(i / LINE), k = cache.indexOf(line);
    if (k >= 0) cache.splice(k, 1); else if (cache.length === WAYS) cache.shift();
    cache.push(line);
    marks.push([i, k >= 0, cache.slice()]);
  }
  return marks;
}
const rowOrder = [], colOrder = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) rowOrder.push(r * N + c);
for (let c = 0; c < N; c++) for (let r = 0; r < N; r++) colOrder.push(r * N + c);
const WALKS = { row: walk(rowOrder), col: walk(colOrder) };

for (const w of ['row', 'col']) root.querySelector(`[data-w="${w}"] .m`).innerHTML = '<i></i>'.repeat(N * N);

function draw() {
  for (const w of ['row', 'col']) {
    const cells = root.querySelectorAll(`[data-w="${w}"] i`);
    cells.forEach((c) => (c.className = ''));
    let miss = 0;
    WALKS[w].slice(0, t).forEach(([i, hit], j) => {
      cells[i].className = hit ? 'hit' : 'miss';
      if (!hit) miss++;
      if (j === t - 1 && t < N * N) cells[i].classList.add('cur');
    });
    // 走到一半时，描出此刻缓存里装着的那 4 行
    if (t > 0 && t < N * N) for (const line of WALKS[w][t - 1][2]) for (let k = 0; k < LINE; k++) cells[line * LINE + k].classList.add('in');
    root.querySelector(`[data-w="${w}"] em`).textContent = miss;
  }
  const max = Math.max(bench.row, bench.col);
  for (const w of ['row', 'col']) {
    root.querySelector(`.bar.${w}`).style.width = `${(bench[w] / max) * 100}%`;
    root.querySelector(`output.${w}`).textContent = `${bench[w].toFixed(1)} ms`;
  }
  root.querySelector('.bench b').textContent = `2048 × 2048 个 int，加一遍（${mine ? '我的笔记本' : '这台设备'}）`;
}

function play() {
  clearInterval(timer);
  if (reduce) { t = N * N; return draw(); }
  t = 0;
  draw();
  timer = setInterval(() => {
    t++;
    draw();
    if (t >= N * N) clearInterval(timer);
  }, DT);
}
function stepOnce() {
  clearInterval(timer);
  t = t >= N * N ? 1 : t + 1;
  draw();
}

// 真跑一遍：同样的数据，只换循环的顺序
function sum(m, n, byRow) {
  let s = 0;
  if (byRow) { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) s += m[r * n + c]; }
  else { for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) s += m[r * n + c]; }
  return s;
}
async function measure() {
  const key = root.querySelector('.run');
  key.disabled = true;
  key.textContent = '正在测…';
  await new Promise((r) => setTimeout(r, 30));
  const n = 2048, m = new Int32Array(n * n);
  for (let i = 0; i < m.length; i++) m[i] = i & 255;
  const best = { row: Infinity, col: Infinity };
  for (let k = 0; k < 5; k++) {
    for (const w of ['row', 'col']) {
      const t0 = performance.now();
      sum(m, n, w === 'row');
      if (k) best[w] = Math.min(best[w], performance.now() - t0);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  bench = best;
  mine = false;
  draw();
  key.disabled = false;
  key.textContent = '再测一次';
}

root.querySelector('.play').addEventListener('click', play);
root.querySelector('.step').addEventListener('click', stepOnce);
root.querySelector('.run').addEventListener('click', measure);
draw();
</script>
```

按行读，每个缓存行只缺失一次，后面 3 个数都命中，一共 16 次。按列读次次缺失，64 次：一列 8 个数分在 8 个缓存行里，缓存只装得下 4 个。点“走一步”看按列那一边，描了边的是此刻留在缓存里的缓存行：读到第 5 行，第 1 行的那个就被踢了，等读下一列回到第 1 行，又得重新搬。

真跑 2048 × 2048 的数组，按行加一遍 2.4 毫秒，按列 8.3 毫秒。C 的二维数组按行存，所以双重循环要让外层走行、内层走列。数组怎么摆、按什么顺序读，往往比省两条指令要紧得多。

缓存怎么知道一个地址在不在里面？每个缓存行旁边记着它是从内存的哪个位置搬来的。查的时候挨个比太慢，所以先用地址中间的几位直接选出一组，只和这一组里的几个缓存行比，L1 里通常是 8 个或 12 个，这叫组相联。一组满了，再踢掉其中一个。上面那张图为了简单，只有一组。

写也是先写进缓存，等这个缓存行被踢出去，才写回内存。

## 地址是假的：虚拟内存

`0x7fffffffdb40` 换算一下，差不多是 128 TB 的位置。我这台电脑只有 16 GB 内存，这个地址是它的 8 千多倍。

程序看到的都是虚拟地址。操作系统把内存按 4 KB 一页分好，给每个进程一张表，记着每个虚拟页对应哪个物理页；每次读写内存，CPU 都先照这张表把虚拟地址换成物理地址。4 KB 是 $2^{12}$，地址的低 12 位是页内偏移，原样照抄；高位拿去查表。

x86-64 通常只用地址的低 48 位，去掉 12 位偏移还剩 36 位，也就是 $2^{36}$ 个页。一页一项、一项 8 字节，一张平铺的表要 512 GB。好在绝大部分虚拟页根本没人用，所以表分成四级，像一棵树，没用到的那几枝不用建。每级用 9 位当下标：

```render html
<style>
  .pw { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .pw { --blue: #95bfdc; }
  .va { margin-bottom: 10px; color: var(--muted); }
  .va code { margin-left: 6px; color: var(--text); font: 600 15px var(--font-mono); }
  .fields { display: grid; grid-template-columns: 9fr 9fr 9fr 9fr 12fr; gap: 6px; }
  .f { display: grid; gap: 2px; align-content: start; padding: 6px 8px 7px; border-top: 3px solid var(--rule-strong); background: var(--bg-raised); border-radius: 0 0 6px 6px; min-width: 0; }
  .f .bits { font: 12.5px var(--font-mono); letter-spacing: .02em; overflow-wrap: anywhere; }
  .f .pos { color: var(--faint); font: 11px var(--font-mono); }
  .f .what { color: var(--muted); font-size: 12px; }
  .f .what b { color: var(--text); font: 600 13px var(--font-mono); margin-left: 4px; }
  .f.lv { border-top-color: var(--blue); }
  .f.off { border-top-color: var(--accent); }
  .f.off .what b { color: var(--accent-ink); }
  .walk { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin-top: 18px; align-items: stretch; }
  .s { position: relative; display: grid; gap: 2px; align-content: start; padding: 7px 8px; border: 1px solid var(--rule-strong); border-radius: 6px; min-width: 0; }
  .s span { color: var(--muted); font-size: 12px; }
  .s b { font: 600 13px var(--font-mono); overflow-wrap: anywhere; }
  .s b.t { font: 600 13px var(--font-sans); }
  .s.lv b { color: var(--blue); }
  .s.end { border-color: var(--accent); background: var(--accent-soft); }
  .s.end b { color: var(--accent-ink); }
  .s + .s::before { content: ''; position: absolute; left: -7px; top: 50%; width: 7px; border-top: 1.5px solid var(--muted); }
  .s.lv::after { content: '读一次内存'; position: absolute; left: 0; right: 0; bottom: -20px; color: var(--faint); font-size: 11px; text-align: center; white-space: nowrap; }
  .walk { padding-bottom: 20px; }
  @media (max-width: 560px) {
    .fields { grid-template-columns: 1fr; gap: 4px; }
    .f { grid-template-columns: 40px minmax(0, 1fr) max-content; align-items: baseline; gap: 8px; padding: 5px 8px; border-top: 0; border-left: 3px solid var(--rule-strong); border-radius: 0 6px 6px 0; }
    .f .bits { font-size: 12px; letter-spacing: 0; white-space: nowrap; }
    .f.lv { border-left-color: var(--blue); }
    .f.off { border-left-color: var(--accent); }
    .f .pos { order: -1; }
    .walk { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 28px; }
    .s:nth-child(4)::before { display: none; }
  }
  .ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 8px; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .cnt { color: var(--muted); }
  .cnt b { margin: 0 3px; color: var(--text); font: 600 14px var(--font-mono); }
  .f, .s { transition: opacity .2s; }
  .pw.run .f, .pw.run .s { opacity: .32; }
  .pw.run .f.done, .pw.run .s.done, .pw.run .f.on, .pw.run .s.on { opacity: 1; }
  .pw.run .f.on, .pw.run .s.on { outline: 2px solid var(--text); outline-offset: 1px; }
  @media (prefers-reduced-motion: reduce) { .f, .s { transition: none; } }
</style>
<section class="pw" aria-label="虚拟地址 0x7fffffffdb40 拆成四个 9 位的下标和一个 12 位的页内偏移，查四级页表">
  <div class="va">虚拟地址<code>0x7fffffffdb40</code></div>
  <div class="fields">
    <div class="f lv"><span class="pos">47–39</span><span class="bits">011111111</span><span class="what">第 1 级<b>255</b></span></div>
    <div class="f lv"><span class="pos">38–30</span><span class="bits">111111111</span><span class="what">第 2 级<b>511</b></span></div>
    <div class="f lv"><span class="pos">29–21</span><span class="bits">111111111</span><span class="what">第 3 级<b>511</b></span></div>
    <div class="f lv"><span class="pos">20–12</span><span class="bits">111111101</span><span class="what">第 4 级<b>509</b></span></div>
    <div class="f off"><span class="pos">11–0</span><span class="bits">101101000000</span><span class="what">页内偏移<b>0xb40</b></span></div>
  </div>
  <div class="walk">
    <div class="s"><span>CR3 寄存器</span><b class="t">第 1 级表在哪</b></div>
    <div class="s lv"><span>第 1 级表</span><b>[255]</b></div>
    <div class="s lv"><span>第 2 级表</span><b>[511]</b></div>
    <div class="s lv"><span>第 3 级表</span><b>[511]</b></div>
    <div class="s lv"><span>第 4 级表</span><b>[509]</b></div>
    <div class="s end"><span>物理页</span><b>+ 0xb40</b></div>
  </div>
  <div class="ctl">
    <button type="button" class="key go">一级一级查</button>
    <span class="cnt">读内存<b></b>次</span>
  </div>
</section>
<script>
const root = document.querySelector('.pw');
const fields = [...root.querySelectorAll('.f')], steps = [...root.querySelectorAll('.s')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const count = root.querySelector('.cnt b');
let k = -1, timer = 0;                  // −1：整条路都亮着；0 到 5：查到下面第几格

function draw() {
  root.classList.toggle('run', k >= 0);
  steps.forEach((s, i) => { s.classList.toggle('on', i === k); s.classList.toggle('done', k >= 0 && i < k); });
  // 第 k 格用的是上面第 k − 1 段：前四段是四级表的下标，最后一段是页内偏移
  fields.forEach((f, i) => { f.classList.toggle('on', i === k - 1); f.classList.toggle('done', k >= 0 && i < k - 1); });
  count.textContent = k < 0 ? 4 : Math.min(4, k);
}
function next() {
  k = k >= 5 ? -1 : k + 1;
  if (k < 0) clearInterval(timer);
  draw();
}
root.querySelector('.go').addEventListener('click', () => {
  clearInterval(timer);
  if (reduce) return next();            // 不放动画：点一下走一格
  k = 0;
  draw();
  timer = setInterval(next, 900);
});
draw();
</script>
```

CR3 寄存器里记着第 1 级表放在哪。拿地址最高的那 9 位当下标，在第 1 级表里读出一项，这一项说的是第 2 级表在哪；再拿下一段 9 位去第 2 级表里读，一路读到第 4 级，拿到的才是物理页的位置，加上页内偏移，就是数据真正住的地方。

每张表 512 项，每项 8 字节，正好 4 KB，一页。翻译一个地址，要先读四次内存。

CPU 不会每次都这么查。它有一个专门存翻译结果的小缓存，叫 TLB，命中时几乎不花时间。前面那条台阶曲线右边那么高，有一部分就是 TLB 装不下，得一遍遍重新查页表。

页表还管着别的事。每个进程一套页表，A 进程的地址翻译不到 B 进程的内存，谁也看不见谁。页表项里记着这一页能不能写、能不能执行；查不到，或者权限不对，CPU 就报异常，操作系统一般会给进程发 SIGSEGV，也就是段错误。内存不够时，操作系统还能把不常用的页挪到硬盘上，用到了再搬回来。

## 流水线：几条指令错开做

一段程序跑多久，可以拆成三个数相乘：

$$
\text{时间} = \text{指令条数} \times \text{CPI} \times \text{每拍多长}
$$

CPI 是平均每条指令要几拍。指令条数由程序和编译器决定，剩下两个数连在一起。前面说过，想让每拍短，就得把一件事拆成几拍做。把一条指令拆成五步，每步一拍，各有各的电路：

- 取指：按地址读出指令；
- 译码：认出是什么指令，把要用的寄存器读出来；
- 执行：ALU 算；
- 访存：要读写内存的指令，在这一步读写；
- 写回：把结果写进寄存器。

拍子短了，可一条指令要走 5 拍，CPI 是 5。而且一条做完再做下一条，五套电路大部分时候闲着。洗衣服也不会等第一筐烘干了才洗第二筐：第一条在译码时，第二条就可以取指了。相邻两步之间隔着一排寄存器，每到一个时钟沿，每条指令的半成品往前挪一格。

讲流水线，教科书一般用 RISC 指令集：指令一样长，只有专门的 load、store 指令读写内存，切成五段很整齐。`add` 编译成 RISC-V 是这样：

```text
lw    a0, 0(a0)
lw    a1, 0(a1)
addw  a0, a1, a0
ret
```

`a0`、`a1` 是寄存器，头两个参数放在里面，返回值也放在 `a0`。`lw` 是按寄存器里的地址读 4 个字节。x86 的 `add (%rdi),%eax` 一条指令里又读内存又做加法，在这里得分成两条。x86 那种长短不一的指令，CPU 内部也是先拆成类似的微操作，再送进流水线。

下面是 `main` 调用 `add` 前后真正执行的 12 条 RISC-V 指令。每行一条指令，每列一拍，竖着看一列，就是这一拍五个工位上各是谁。点“播放”，或者拖滑块一拍一拍看：

```render html title="教科书上的五级流水线，带转发；指令是 clang 编译的 RISC-V 版"
<style>
  .pl { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .pl { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .run { display: flex; align-items: center; gap: 10px; flex: 1 1 260px; max-width: 380px; }
  .key { flex: none; min-width: 4.4em; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .ctl { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; color: var(--muted); }
  .ctl output { min-width: 4.4em; color: var(--text); font: 600 14px var(--font-mono); white-space: nowrap; }
  .ctl input { flex: 1; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .snap { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: 14px; }
  .snap div { display: grid; gap: 1px; padding: 5px 8px 6px; border-radius: 6px; background: var(--bg-raised); border-top: 3px solid var(--rule-strong); min-width: 0; }
  .snap span { color: var(--muted); font-size: 12px; }
  .snap b { overflow: hidden; font: 600 12.5px var(--font-mono); white-space: nowrap; text-overflow: ellipsis; }
  .snap b.none { color: var(--faint); font-weight: 400; }
  .pl svg { display: block; width: 100%; height: auto; margin-top: 14px; overflow: visible; }
  .il { fill: var(--text); font: 12px var(--font-mono); dominant-baseline: central; }
  .il.dim { fill: var(--faint); }
  .cell { stroke: var(--bg); stroke-width: 1; }
  .st0 { fill: var(--rule-strong); }
  .st1 { fill: var(--blue); opacity: .55; }
  .st2 { fill: var(--accent); }
  .st3 { fill: var(--accent); opacity: .55; }
  .st4 { fill: var(--accent); opacity: .28; }
  .wait { fill: none; stroke: var(--muted); stroke-width: 1.2; stroke-dasharray: 2 2; }
  .ct { fill: var(--bg); font-size: 10.5px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  .ct.dark { fill: var(--text); }
  .later { opacity: .22; }
  .now { fill: var(--text); opacity: .07; }
  .nowl { stroke: var(--text); stroke-width: 1.2; }
  .ax { fill: var(--muted); font: 11px var(--font-mono); text-anchor: middle; }
  .fw { fill: none; stroke: var(--text); stroke-width: 1.4; }
  .fwh { fill: var(--text); }
  .note { fill: var(--muted); font-size: 11.5px; dominant-baseline: central; }
  .tot { fill: var(--text); font: 600 13px var(--font-mono); }
  .tot tspan { fill: var(--muted); font: 400 12px var(--font-sans); }
  .key-s { fill: var(--muted); font-size: 11.5px; dominant-baseline: central; }
</style>
<section class="pl" aria-label="五级流水线：main 调用 add 前后的 12 条 RISC-V 指令，错开着走过取指、译码、执行、访存、写回">
  <div class="top">
    <div class="seg" role="group" aria-label="怎么执行">
      <button type="button" data-m="pipe" aria-pressed="true">流水线</button>
      <button type="button" data-m="nojump" aria-pressed="false">不猜跳转</button>
      <button type="button" data-m="seq" aria-pressed="false">一条做完再下一条</button>
    </div>
    <div class="run">
      <button type="button" class="key play">播放</button>
      <label class="ctl"><span>第</span><output></output><input type="range" min="1" value="9" aria-label="第几拍"></label>
    </div>
  </div>
  <div class="snap"></div>
  <svg role="img"></svg>
</section>
<script>
const STAGES = ['取指', '译码', '执行', '访存', '写回'];
// main 调用 add 前后真正执行到的 12 条指令（clang -O2，RISC-V）
const PROG = [
  ['li a0, 27', 'li', { w: 'a0' }],
  ['li a1, 37', 'li', { w: 'a1' }],
  ['sw a0, 4(sp)', 'sw', { r: ['a0'] }],
  ['sw a1, 0(sp)', 'sw', { r: ['a1'] }],
  ['addi a0, sp, 4', 'addi', { w: 'a0' }],
  ['mv a1, sp', 'mv', { w: 'a1' }],
  ['call add', 'call', { jump: 1 }],
  ['lw a0, 0(a0)', 'lw', { r: ['a0'], w: 'a0', load: true }],
  ['lw a1, 0(a1)', 'lw', { r: ['a1'], w: 'a1', load: true }],
  ['addw a0, a1, a0', 'addw', { r: ['a1', 'a0'], w: 'a0' }],
  ['ret', 'ret', { jump: 2 }],
  ['mv a1, a0', 'mv', { r: ['a0'], w: 'a1' }],
];
const root = document.querySelector('.pl'), svg = root.querySelector('svg'), slider = root.querySelector('input');
let mode = 'pipe', width = 0, plan = null;

// 排一张时刻表：每条指令哪一拍进哪个工位
function schedule(m) {
  const rows = [];
  PROG.forEach(([, , x], i) => {
    const p = rows[i - 1], jump = PROG[i - 1]?.[2].jump;
    let f = p ? Math.max(p.f + 1, p.d) : 1, d, e;
    if (m === 'seq') {
      f = p ? p.w + 1 : 1; d = f + 1; e = d + 1;
    } else {
      // 不猜跳转：跳转指令算出目标之前，下一条没法取指（call 在译码、ret 在执行才知道去哪）
      if (m === 'nojump' && jump) f = Math.max(f, (jump === 1 ? p.d : p.e) + 1);
      d = p ? Math.max(f + 1, p.e) : f + 1;
      e = d + 1;
      // 上一条刚从内存读出来的数，这一条马上要用：得等它访存完，再转发过来
      if (p && PROG[i - 1][2].load && x.r?.includes(PROG[i - 1][2].w)) e = Math.max(e, p.m + 1);
    }
    rows.push({ f, d, e, m: e + 1, w: e + 2 });
  });
  return rows;
}

// 这一拍里，第 i 条指令在哪个工位（等待的那几拍也算在那个工位上）
function stageAt(r, c) {
  if (c < r.f || c > r.w) return null;
  if (c < r.d) return { s: 0, wait: c > r.f };
  if (c < r.e) return { s: 1, wait: c > r.d };
  return { s: c === r.e ? 2 : c === r.m ? 3 : 4, wait: false };
}

function geo() {
  const narrow = width < 520, labW = narrow ? 44 : 122, rowH = narrow ? 20 : 22, top = 22;
  const total = plan.at(-1).w, cw = (width - labW - 4) / total;
  return { narrow, labW, rowH, top, total, cw, H: top + PROG.length * rowH + 52, x: (c) => labW + (c - 1) * cw };
}

function draw() {
  const g = geo(), now = Number(slider.value);
  let s = '';
  s += `<rect class="now" x="${g.x(now)}" y="${g.top - 4}" width="${g.cw}" height="${PROG.length * g.rowH + 8}"/>`;
  const every = g.cw < 9 ? 10 : g.cw < 16 ? 5 : 1;
  for (let c = 1; c <= g.total; c++) if (c % every === 0 || c === 1) s += `<text class="ax" x="${g.x(c) + g.cw / 2}" y="${g.top - 8}">${c}</text>`;
  PROG.forEach(([full, short], i) => {
    const r = plan[i], y = g.top + i * g.rowH;
    s += `<text class="il${r.f > now ? ' dim' : ''}" x="0" y="${y + g.rowH / 2}">${g.narrow ? short : full}</text>`;
    for (let c = r.f; c <= r.w; c++) {
      const at = stageAt(r, c), x = g.x(c) + .5, w = Math.max(1, g.cw - 1), h = g.rowH - 3;
      const later = c > now ? ' later' : '';
      if (at.wait) s += `<rect class="wait${later}" x="${x + .5}" y="${y + 1.5}" width="${Math.max(0, w - 1)}" height="${h - 1}" rx="2"/>`;
      else s += `<rect class="cell st${at.s}${later}" x="${x}" y="${y + 1}" width="${w}" height="${h}" rx="2"/>`;
      if (!at.wait && g.cw >= 22) s += `<text class="ct${at.s === 0 || at.s >= 3 ? ' dark' : ''}${later}" x="${x + w / 2}" y="${y + 1 + h / 2}">${STAGES[at.s][0]}</text>`;
    }
  });
  // 读内存那条到用它的那条：结果从访存转发给执行
  if (mode !== 'seq') {
    const p = plan[8], q = plan[9], y0 = g.top + 8 * g.rowH + g.rowH / 2, y1 = g.top + 9 * g.rowH + 2;
    const x0 = g.x(p.m) + g.cw * .5, x1 = g.x(q.e) + g.cw * .5;
    s += `<path class="fw" d="M${x0} ${y0}C${x0} ${y1 - 2},${x1} ${y0 + 4},${x1} ${y1 - 1}"/><path class="fwh" d="M${x1 - 3.5} ${y1 - 6}h7l-3.5 5z"/>`;
  }
  const yb = g.top + PROG.length * g.rowH + 22;
  const legend = STAGES.map((n, k) => `<rect class="cell st${k}" x="${k * 54}" y="${yb - 6}" width="12" height="12" rx="2"/><text class="key-s" x="${k * 54 + 16}" y="${yb}">${n}</text>`).join('');
  s += g.narrow ? '' : legend + `<rect class="wait" x="${5 * 54}" y="${yb - 6}" width="12" height="12" rx="2"/><text class="key-s" x="${5 * 54 + 16}" y="${yb}">等</text>`;
  s += `<text class="tot" x="${width}" y="${yb + (g.narrow ? 0 : 22)}" text-anchor="end"><tspan>12 条指令，共 </tspan>${g.total}<tspan> 拍</tspan></text>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${g.H}`);
  svg.innerHTML = s;
  // 这一拍，五个工位上各是哪条指令
  const at = STAGES.map(() => null);
  PROG.forEach((p, i) => { const a = stageAt(plan[i], now); if (a) at[a.s] = { name: p[0], wait: a.wait }; });
  root.querySelector('.snap').innerHTML = STAGES.map((n, k) => `<div style="border-top-color:var(--${['rule-strong', 'blue', 'accent', 'accent', 'accent'][k]})"><span>${n}</span><b class="${at[k] ? '' : 'none'}">${at[k] ? (g.narrow ? at[k].name.split(' ')[0] : at[k].name) : '空'}</b></div>`).join('');
  root.querySelector('output').textContent = `${now} 拍`;
  root.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
  svg.setAttribute('aria-label', `${mode === 'seq' ? '一条做完再下一条' : mode === 'nojump' ? '流水线，跳转要等算出目标' : '流水线'}：12 条指令共 ${g.total} 拍；第 ${now} 拍时，${STAGES.map((n, k) => `${n}：${at[k]?.name ?? '空'}`).join('，')}`);
}

const playKey = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer = 0;
function stop() {
  clearInterval(timer);
  timer = 0;
  playKey.textContent = '播放';
}
// 一拍一拍往前走，走到最后一拍停下
function advance() {
  const last = Number(slider.max), now = Number(slider.value);
  slider.value = now >= last ? 1 : now + 1;
  draw();
  if (Number(slider.value) >= last) stop();
}
playKey.addEventListener('click', () => {
  if (timer) return stop();
  if (reduce) return advance();          // 不放动画：点一下走一拍
  if (Number(slider.value) >= Number(slider.max)) { slider.value = 1; draw(); }
  playKey.textContent = '暂停';
  timer = setInterval(advance, Math.max(120, Math.min(420, 7000 / Number(slider.max))));
});

function setMode(m) {
  stop();
  mode = m;
  plan = schedule(m);
  slider.max = plan.at(-1).w;
  if (Number(slider.value) > plan.at(-1).w) slider.value = plan.at(-1).w;
  draw();
}
root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
slider.addEventListener('input', () => { stop(); draw(); });
plan = schedule(mode);
slider.max = plan.at(-1).w;
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

一条做完再下一条，要 60 拍；流水线只要 17 拍，CPI 从 5 掉到 1.4。每条指令自己还是走 5 拍，快在同时有好几条在路上。

几条指令挤在路上，就会互相碍事。头一种：后一条要用的数，前一条还没算出来。图里那条箭头就是：`lw a1` 要到访存那一拍才从内存读出 37，紧跟着的 `addw` 这时候本该已经在执行了。等它写回寄存器再读太慢，电路把访存的结果直接转发给执行；即便这样还是晚了一拍，`addw` 得原地等一拍，这一拍叫气泡。

另一种是跳转：下一条该从哪取，得等这一条算出来才知道。切到“不猜跳转”：`call` 到译码才知道跳去哪，`ret` 到执行才知道回哪，后面的指令只能干等，一共 20 拍。

真正的 CPU 不等，先猜一个地址接着取。`call` 的目标写在指令里，好猜；`ret` 回哪要看栈上的返回地址，CPU 专门存了一小摞最近 `call` 的返回地址，叫返回地址栈，`ret` 一来就从顶上拿一个。

现在的 CPU 流水线有十几到二十几级，每拍能同时处理好几条，还能不按顺序执行：前面的指令在等内存，后面不相干的先做。我笔记本的大核每拍最多译码 6 条，同时有几百条指令在路上。`add` 里的两个读内存互不相干，可以一起发出去。

## 分支：先猜再说

`call` 和 `ret` 好猜，`if` 难猜：

```c
for (int i = 0; i < n; i++)
    if (a[i] >= 128) sum += a[i];
```

`a[i]` 是 0 到 255 的随机数时，这个 `if` 一半进一半不进。

CPU 猜的办法是记账：这个 `if` 前几次进没进。最简单的预测器是一个两位计数器，0、1 猜不进，2、3 猜进；真进了加一，没进减一，到头就停。停在 0 或 3 的时候，要连着错两次才改主意，偶尔一次例外带不偏它。

下面是 40 个数，橙色的会进 `if`。中间那条折线是计数器，落在有底色的上半截就猜进：

```render html title="上面是两位计数器的模拟；下面的耗时是真跑的"
<style>
  .bp { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
  .seg { display: flex; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .score { color: var(--muted); font-size: 13px; }
  .score b { color: var(--accent-ink); font: 600 15px var(--font-mono); margin: 0 3px; }
  .score i { font: 13px var(--font-mono); font-style: normal; }
  .bp svg { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; }
  .bar { fill: var(--rule-strong); }
  .bar.t { fill: var(--accent); opacity: .75; }
  .thr { stroke: var(--text); stroke-width: 1.2; stroke-dasharray: 4 3; }
  .thr-t { fill: var(--text); font: 11.5px var(--font-mono); }
  .rl { fill: var(--muted); font-size: 12px; dominant-baseline: central; }
  .ok { fill: var(--rule-strong); }
  .bad { fill: var(--accent-ink); }
  .later { opacity: .22; }
  .band { fill: var(--accent-soft); }
  .mid { stroke: var(--rule-strong); stroke-width: 1; stroke-dasharray: 2 3; }
  .cnt { fill: none; stroke: var(--text); stroke-width: 1.8; stroke-linejoin: round; }
  .lv { fill: var(--faint); font: 10.5px var(--font-mono); text-anchor: end; dominant-baseline: central; }
  .now { fill: none; stroke: var(--text); stroke-width: 1.4; }
  .btn { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .btn:hover { border-color: var(--text); }
  .bench { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; gap: 6px 10px; align-items: center; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--rule); }
  .bench > b { grid-column: 1 / -1; min-width: 0; color: var(--muted); font-size: 12.5px; font-weight: 400; overflow-wrap: anywhere; }
  .bench span { color: var(--muted); font-size: 12.5px; }
  .bench .b { height: 12px; border-radius: 2px; background: var(--rule-strong); transition: width .4s cubic-bezier(.22, 1, .36, 1); }
  .bench .b.rand { background: var(--accent); }
  .bench output { font: 600 13px var(--font-mono); text-align: right; }
  .key { grid-column: 1 / -1; justify-self: start; margin-top: 4px; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
</style>
<section class="bp" aria-label="分支预测：数据乱序时一半猜错，排好序以后几乎全猜对">
  <div class="top">
    <div class="seg" role="group" aria-label="数据">
      <button type="button" data-m="rand" aria-pressed="true">乱序</button>
      <button type="button" data-m="sorted" aria-pressed="false">排好序</button>
    </div>
    <button type="button" class="btn play">走一遍</button>
    <span class="score">猜错<b></b>次 / <i></i></span>
  </div>
  <svg role="img"></svg>
  <div class="bench">
    <b>100 万个 0–255 的数，跑 10 遍（我的笔记本）</b>
    <span>乱序</span><div><div class="b rand"></div></div><output class="rand"></output>
    <span>排好序</span><div><div class="b sorted"></div></div><output class="sorted"></output>
    <button type="button" class="key">在这台设备上跑</button>
  </div>
</section>
<script>
const N = 40;
// 我的笔记本（Chromium）上同一段循环的耗时，毫秒
const MINE = { rand: 49, sorted: 7 };
const root = document.querySelector('.bp'), svg = root.querySelector('svg');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode = 'rand', width = 0, bench = { ...MINE };
let t = N, timer = 0;                    // t：已经走过几个数；N 是全部走完

let seed = 7;
const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) & 255;
const RAND = Array.from({ length: N }, rand), SORTED = [...RAND].sort((a, b) => a - b);

// 两位饱和计数器：0、1 猜不跳，2、3 猜跳；真跳了加一，没跳减一，到头就停
// c 记的是猜这一个数之前计数器停在几
function predict(data) {
  let c = 1;
  return data.map((v) => {
    const taken = v >= 128, before = c;
    c = taken ? Math.min(3, c + 1) : Math.max(0, c - 1);
    return { v, taken, c: before, ok: (before >= 2) === taken };
  });
}

function draw() {
  if (!width) return;
  const rows = predict(mode === 'rand' ? RAND : SORTED), labW = width < 480 ? 34 : 46;
  const cw = (width - labW) / N, barH = 90, top = 16, yC = top + barH + 12, cH = 30, yM = yC + cH + 16, H = yM + 10;
  const cy = (c) => yC + cH - (c / 3) * cH;
  let s = '';
  s += `<text class="rl" x="0" y="${top + barH / 2}">a[i]</text><text class="rl" x="0" y="${yC + cH / 2}">计数</text><text class="rl" x="0" y="${yM}">猜错</text>`;
  // 计数器那一行：上半截（2、3）猜进，下半截（0、1）猜不进
  s += `<rect class="band" x="${labW}" y="${yC - 3}" width="${width - labW}" height="${cH / 2 + 3}"/><line class="mid" x1="${labW}" x2="${width}" y1="${yC + cH / 2}" y2="${yC + cH / 2}"/>`;
  s += `<text class="lv" x="${labW - 4}" y="${cy(3)}">3</text><text class="lv" x="${labW - 4}" y="${cy(0)}">0</text>`;
  let path = '';
  rows.forEach((r, i) => {
    const x = labW + i * cw, h = Math.max(2, (r.v / 255) * barH), later = i >= t ? ' later' : '';
    s += `<rect class="bar${r.taken ? ' t' : ''}${later}" x="${x + cw * .15}" y="${top + barH - h}" width="${cw * .7}" height="${h}" rx="1"/>`;
    if (i >= t) return;
    path += `${i ? 'V' : `M${x} `}${cy(r.c)}H${x + cw}`;
    s += r.ok ? `<circle class="ok" cx="${x + cw / 2}" cy="${yM}" r="${Math.min(3, cw * .2)}"/>` : `<circle class="bad" cx="${x + cw / 2}" cy="${yM}" r="${Math.min(5.5, cw * .36)}"/>`;
  });
  if (path) s += `<path class="cnt" d="${path}"/>`;
  // 走到一半时，框出正在猜的这一个
  if (t > 0 && t < N) s += `<rect class="now" x="${labW + (t - 1) * cw}" y="${top - 4}" width="${cw}" height="${yM + 12 - top}" rx="2"/>`;
  const ty = top + barH - (128 / 255) * barH;
  s += `<line class="thr" x1="${labW}" x2="${width}" y1="${ty}" y2="${ty}"/><text class="thr-t" x="${width}" y="${ty - 5}" text-anchor="end">128</text>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${H + 6}`);
  svg.innerHTML = s;
  const miss = rows.filter((r, i) => i < t && !r.ok).length, all = rows.filter((r) => !r.ok).length;
  root.querySelector('.score b').textContent = miss;
  root.querySelector('.score i').textContent = t;
  root.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
  svg.setAttribute('aria-label', `${mode === 'rand' ? '乱序' : '排好序'}的 40 个数，a[i] >= 128 时进 if；两位计数器猜错 ${all} 次`);
  const max = Math.max(bench.rand, bench.sorted);
  for (const k of ['rand', 'sorted']) {
    root.querySelector(`.b.${k}`).style.width = `${(bench[k] / max) * 100}%`;
    root.querySelector(`output.${k}`).textContent = `${Math.round(bench[k])} ms`;
  }
}

// 真跑：和正文里那段 C 一样的循环
function count(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) if (a[i] >= 128) s += a[i];
  return s;
}
async function measure() {
  const key = root.querySelector('.key');
  key.disabled = true;
  key.textContent = '正在跑…';
  await new Promise((r) => setTimeout(r, 30));
  // 随机数得真随机：周期短的伪随机数，预测器能把规律学会
  const n = 1 << 20, a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 256) | 0;
  const b = a.slice().sort();
  const best = { rand: Infinity, sorted: Infinity };
  for (let k = 0; k < 4; k++) {
    for (const [name, arr] of [['rand', a], ['sorted', b]]) {
      const t0 = performance.now();
      for (let r = 0; r < 10; r++) count(arr);
      if (k) best[name] = Math.min(best[name], performance.now() - t0);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  bench = best;
  root.querySelector('.bench b').textContent = '100 万个 0–255 的数，跑 10 遍（这台设备）';
  key.disabled = false;
  key.textContent = '再跑一次';
  draw();
}

// 从第一个数开始，一个一个猜过去
function play() {
  clearInterval(timer);
  if (reduce) { t = N; return draw(); }
  t = 0;
  draw();
  timer = setInterval(() => {
    t++;
    draw();
    if (t >= N) clearInterval(timer);
  }, 150);
}
root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { clearInterval(timer); t = N; mode = b.dataset.m; draw(); }));
root.querySelector('.play').addEventListener('click', play);
root.querySelector('.key').addEventListener('click', measure);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(svg);
</script>
```

乱序时，40 次猜错 19 次，和抛硬币差不多：计数器跟着上一两个数走，可下一个数和它们没关系。排好序以后，前面一直不进，后面一直进，计数器贴着底走完前半段，只在分界处错 2 次，然后贴着顶走到头。

猜错的代价，是把流水线里照着猜测取进来的指令全扔掉，从对的地址重新取。真跑 100 万个数、10 遍，乱序 49 毫秒，排好序 7 毫秒，算下来每猜错一次多花 8 纳秒左右，十几拍。

真实的预测器比两位计数器聪明得多，能记住很长的历史，学会重复的模式。我一开始用了一个写错的随机数生成器，生成的数 419 个一循环，结果乱序和排好序跑得一样快：预测器把这 419 个全背下来了。

另一个办法是干脆不跳。GCC 开 `-O2` 编译这段 C，`if` 会变成一条 `cmovge`：两种结果都备好，按条件挑一个，没有分支，也就没得猜错，乱序和排好序一样快。浏览器的 JavaScript 引擎有时也这么干，所以在你的设备上，未必跑得出差别。

## 回到这 5 个字节

现在把 `add(&x, &y)` 从头再走一遍。

`call` 还没执行完，预测器就猜到了要跳去 `0x5555555551b0`。取指从 L1 指令缓存里拿到 `8b 06 03 07 c3`，译码器拆成微操作：两个读内存，一个加法，一个返回。

两个读内存互不依赖，一起发出去。`x` 和 `y` 刚被 `main` 写进栈，还在 L1 里，5 拍左右就回来；查 TLB 和查 L1 同时开始，不多花时间。

两个数一到，加法在一拍之内做完：信号穿过十来级门，算出 64，顺手设好 CF、OF 这些标志，在下一个时钟沿被抄进 `eax`。

`ret` 回哪，返回地址栈早就猜好了，CPU 已经在执行 `main` 里的下一条。整个 `add` 只花几纳秒，大部分时间在等 L1。

要是 `x` 不在缓存里，光等它就要一两百纳秒，够这台 CPU 做上千次加法。

## 参考资料

- Patterson & Hennessy. *Computer Organization and Design RISC-V Edition*。
- Hennessy & Patterson. *Computer Architecture: A Quantitative Approach*。
- Bryant & O'Hallaron. *Computer Systems: A Programmer's Perspective*。
- Harris & Harris. *Digital Design and Computer Architecture*。
- 唐朔飞.《计算机组成原理》。
- Nisan & Schocken. [Nand2Tetris](https://www.nand2tetris.org/)；Ben Eater. [Build an 8-bit computer from scratch](https://eater.net/8bit)。
- Shannon. A Symbolic Analysis of Relay and Switching Circuits, 1938；von Neumann. First Draft of a Report on the EDVAC, 1945。
- Intel. [Intel 64 and IA-32 Architectures Software Developer's Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)。
- IEEE 754-2019. IEEE Standard for Floating-Point Arithmetic。
- Drepper. [What Every Programmer Should Know About Memory](https://www.akkadia.org/drepper/cpumemory.pdf), 2007。
- Stack Overflow. [Why is processing a sorted array faster than processing an unsorted array?](https://stackoverflow.com/questions/11227809), 2012。
