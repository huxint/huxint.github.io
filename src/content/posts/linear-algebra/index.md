---
title: "线性代数到底在讲什么"
description: "矩阵乘法为什么是行乘列？把矩阵看成一个函数、一次对空间的变换，行列式、秩、逆、特征值就都有了画面。"
pubDate: 2026-11-09
tags: ["数学", "线性代数", "计算机图形学"]
---

第一次学矩阵乘法，规则大概是这样给的：

$$
\begin{bmatrix}1&2\\3&4\end{bmatrix}
\begin{bmatrix}5&6\\7&8\end{bmatrix}
=
\begin{bmatrix}1\cdot5+2\cdot7&1\cdot6+2\cdot8\\3\cdot5+4\cdot7&3\cdot6+4\cdot8\end{bmatrix}
=
\begin{bmatrix}19&22\\43&50\end{bmatrix}
$$

左边取一行，右边取一列，对应相乘再相加。规则不难记，难的是它为什么长这样。矩阵加法是对应位置相加，乘法为什么不是对应位置相乘？为什么 $AB$ 和 $BA$ 不一样？行列式那一串交错的正负号又是从哪来的？

课本通常先给定义，再证性质，最后举例。这些定义其实都是从一个画面里推出来的，只是画面被省掉了。

这个画面是：**矩阵不是一张数表，是一个函数。** 它吃进一个向量，吐出一个向量；放到整个空间上看，它把空间拉伸、旋转、剪切成另一个样子。接受了这一点，矩阵乘法就是两个函数接连做，行列式是面积放大了几倍，逆矩阵是把变换倒着放一遍，特征向量是变换里方向不变的那几根轴。

这篇从向量开始，一步一步搭到特征值和奇异值分解，再看它们在计算机图形学、搜索引擎和机器学习里干什么。中间会穿插写代码的视角：线性变换是一种特别守规矩的函数，矩阵是把它存下来的那张表。

文中的图都能动手：点播放看变换的过程，拖动箭头头上的圆点改矩阵。

## 向量：箭头，也是一组数

向量有三种常见的说法。

- 物理里，它是一支箭头，有长度，有方向。
- 写程序时，它是一组有顺序的数，比如 `[3, 2]`。
- 数学里，只要能相加、能乘一个数，并且满足几条运算规矩的东西，都叫向量。

前两种在线性代数里是同一件事：把箭头的尾巴钉在原点，箭头尖的坐标就是那组数。$(3,2)$ 的意思是往右走 3，往上走 2。

向量只有两种基本运算。相加是首尾相接、接着走：先走 $\mathbf{v}$，再走 $\mathbf{w}$，终点就是 $\mathbf{v}+\mathbf{w}$。数乘是把箭头拉长、缩短或者掉头：$2\mathbf{v}$ 是同方向两倍长，$-\mathbf{v}$ 是反过来。

整个线性代数，都是在这两种运算上搭起来的。第三种说法先放着，到后面会发现，函数、多项式、一段声音，也都能这样相加和数乘，于是这篇里的一切对它们同样成立。

## 坐标是配方

$(3,2)$ 还有一层意思常被跳过。平面上有两个特殊的单位向量：往右的 $\hat\imath=(1,0)$，往上的 $\hat\jmath=(0,1)$。于是

$$
\begin{bmatrix}3\\2\end{bmatrix}=3\hat\imath+2\hat\jmath .
$$

坐标是一份配方：取 3 份 $\hat\imath$，2 份 $\hat\jmath$，加起来。

把几个向量各乘一个数再加起来，叫线性组合：$a\mathbf{v}+b\mathbf{w}$。$a$、$b$ 取遍所有实数，能配出来的向量合在一起，叫 $\mathbf{v}$ 和 $\mathbf{w}$ 张成的空间。

- 两个不共线的平面向量，能张成整个平面。
- 两个共线的，只能张成一条过原点的直线。
- 两个都是零向量，只剩原点一个点。

到了三维也一样。两个不共线的向量张成一个过原点的平面；再来第三个向量，只有它不落在这个平面里，才能把张成的空间撑成整个三维。如果每个向量都贡献了别人配不出来的新方向，就说它们线性无关；有一个能被其他几个配出来，它就是多余的，叫线性相关。

一组线性无关、又能张成整个空间的向量，叫一组基。选定了基，每个向量的配方就唯一确定，这份配方就是它在这组基下的坐标。

$\hat\imath$ 和 $\hat\jmath$ 只是最顺手的一组基，不是唯一的一组。换一组基，同一支箭头的坐标就变了。拖动 $\mathbf{b}_1$、$\mathbf{b}_2$ 和 $\mathbf{v}$ 头上的圆点试试：

```render html title="同一个点，在两组基下的配方"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .stage { position: relative; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 32px; height: 32px; margin: -16px 0 0 -16px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 9px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); } .knob.v { color: var(--text); }
  .knob:active { cursor: grabbing; }
  .knob:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
  .read { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 20px; margin-top: 8px; font: 13px var(--font-mono); }
  .read p { margin: 0; }
  .read small { display: block; color: var(--muted); font: 12px var(--font-sans); }
  .read .i { color: var(--accent-ink); } .read .j { color: var(--blue); }
  .note { margin: 6px 0 0; min-height: 1.5em; color: var(--muted); font-size: 13px; }
  @media (max-width: 520px) { .read { grid-template-columns: 1fr; } }
</style>
<section class="la" aria-label="拖动两个基向量和 v，比较 v 在标准基和新基下的坐标">
  <div class="stage"><canvas role="img" aria-label="平面网格、两个基向量和向量 v"></canvas></div>
  <div class="read">
    <p><small>用 î、ĵ 配</small><span class="std"></span></p>
    <p><small>用 b₁、b₂ 配</small><span class="new"></span></p>
  </div>
  <p class="note" aria-live="polite"></p>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const C = {};
let W = 0, H = 0, S = 40;
let b1 = [2, 1], b2 = [-1, 1], v = [1, 2];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0]) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
// 标签放在箭头尖外侧，顺着箭头的方向
function label(text, at, color, from = [0, 0]) {
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  ctx.fillStyle = color; ctx.font = '600 15px KaTeX_Main, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (x - ox) / L * 22, y + (y - oy) / L * 22);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  seg([-R, 0], [R, 0], C['rule-strong'], 1.4); seg([0, -R], [0, R], C['rule-strong'], 1.4);

  const det = b1[0] * b2[1] - b1[1] * b2[0];
  const flat = Math.abs(det) < 1e-9, zero = Math.hypot(...b1) < 1e-9 && Math.hypot(...b2) < 1e-9;
  ctx.globalAlpha = .55;
  if (!flat) {
    // 新基的网格：c₁ 或 c₂ 取整数的那些线
    // 相邻两条线隔 |det| / |b|，要铺满画面就得画到 G 条
    const G = Math.min(60, Math.ceil(R * Math.max(Math.hypot(...b1), Math.hypot(...b2)) / Math.abs(det)) + 1);
    const at = (c1, c2) => [c1 * b1[0] + c2 * b2[0], c1 * b1[1] + c2 * b2[1]];
    for (let k = -G; k <= G; k++) {
      seg(at(k, -200), at(k, 200), C.blue, k ? 1 : 1.6);
      seg(at(-200, k), at(200, k), C.accent, k ? 1 : 1.6);
    }
  } else if (!zero) {
    const d = Math.hypot(...b1) > 1e-9 ? b1 : b2, n = Math.hypot(...d);
    seg([-60 * d[0] / n, -60 * d[1] / n], [60 * d[0] / n, 60 * d[1] / n], C.accent, 2.4);
  }
  ctx.globalAlpha = 1;

  const std = root.querySelector('.std'), nw = root.querySelector('.new'), note = root.querySelector('.note');
  std.innerHTML = `v = ${num(v[0])}·<span class="i">î</span> + ${num(v[1])}·<span class="j">ĵ</span> → (${num(v[0])}, ${num(v[1])})`;
  if (!flat) {
    const c1 = (v[0] * b2[1] - v[1] * b2[0]) / det, c2 = (b1[0] * v[1] - b1[1] * v[0]) / det;
    const p1 = [c1 * b1[0], c1 * b1[1]];
    seg([0, 0], p1, C.accent, 2, [5, 5]);
    seg(p1, v, C.blue, 2, [5, 5]);
    nw.innerHTML = `v = ${num(c1)}·<span class="i">b₁</span> + ${num(c2)}·<span class="j">b₂</span> → (${num(c1)}, ${num(c2)})`;
    note.textContent = '虚线是配方：先沿 b₁ 走 c₁ 份，再沿 b₂ 走 c₂ 份。';
  } else {
    nw.innerHTML = '配不出来';
    note.textContent = zero ? 'b₁、b₂ 都是零向量，只能配出原点。' : 'b₁、b₂ 共线，只能张成一条线；v 不在线上就配不出来，它们不是一组基。';
  }
  arrow(b1, C.accent); arrow(b2, C.blue); arrow(v, C.text, 2.4);
  label('b₁', b1, C['accent-ink']); label('b₂', b2, C.blue); label('v', v, C.text);
  knobs.forEach((k) => k.place());
}

function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const move = (e) => { const r = cv.getBoundingClientRect(); set(snap(U(e.clientX - r.left, e.clientY - r.top))); draw(); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    set(snap([p[0] + d[0] * s, p[1] + d[1] * s])); draw();
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; } };
}
const knobs = [
  knob('i', '基向量 b₁', () => b1, (p) => (b1 = p)),
  knob('j', '基向量 b₂', () => b2, (p) => (b2 = p)),
  knob('v', '向量 v', () => v, (p) => (v = p)),
];

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(250, Math.min(360, W * .6)));
  S = H / 8;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
</script>
```

默认的新基是 $\mathbf{b}_1=(2,1)$、$\mathbf{b}_2=(-1,1)$。同一个 $\mathbf{v}$，用 $\hat\imath$、$\hat\jmath$ 配是 $(1,2)$，用 $\mathbf{b}_1$、$\mathbf{b}_2$ 配是 $(1,1)$：

$$
1\cdot\begin{bmatrix}2\\1\end{bmatrix}+1\cdot\begin{bmatrix}-1\\1\end{bmatrix}=\begin{bmatrix}1\\2\end{bmatrix}.
$$

橙色和蓝色的斜网格，是新基眼里的“横平竖直”。把 $\mathbf{b}_2$ 拖到和 $\mathbf{b}_1$ 共线，网格就塌成一条线：两个向量只能张成一条线，线外的点怎么配也配不出来，它们不再是一组基。

这件事后面会反复用到：**坐标不是向量自己的属性，是向量和一组基之间的关系。** 箭头本身没变，换一组基，描述它的数就变了。好比同一个人，在不同的语言里名字念法不一样。

## 线性变换：一种守规矩的函数

函数吃一个输入，吐一个输出。吃一个向量、吐一个向量的函数，在线性代数里叫变换。叫变换而不叫函数，是想让你换个方式看它：不是盯着一个输入看它变成什么，而是把平面上每一个点同时搬到它的输出位置上，看整张平面怎么动。

大多数函数会把平面揉得乱七八糟。线性变换只满足两条规矩：

$$
f(\mathbf{u}+\mathbf{v})=f(\mathbf{u})+f(\mathbf{v}),\qquad f(c\,\mathbf{v})=c\,f(\mathbf{v}).
$$

先加再变，等于先变再加；先缩放再变，等于先变再缩放。

画到平面上，这两条规矩等价于一句话：**变换之后，网格线还是直线，还互相平行、间隔均匀，原点不动。** 平移不是线性变换，它把原点挪走了，$f(\mathbf{0})$ 应该等于 $f(0\cdot\mathbf{0})=0\cdot f(\mathbf{0})=\mathbf{0}$；$f(x,y)=(x^2,y)$ 也不是，它把竖线掰弯了。旋转、拉伸、剪切、镜像都是。

写程序的人对这种规矩并不陌生。字符串拼接之后再求长度，等于各自求长度再相加：

```ts
(a + b).length === a.length + b.length
```

先拼接两个数组再 `map`，等于各自 `map` 再拼接。这类函数和“合并”可以交换顺序，所以能把数据切成块，各算各的，最后再合起来，MapReduce 就靠这个。线性变换就是向量上的这种函数：拆开算再合起来，和合起来再算，结果一样。

这条规矩有个惊人的后果。任何一个向量都能写成 $\mathbf{v}=x\hat\imath+y\hat\jmath$，于是

$$
f(\mathbf{v})=f(x\hat\imath+y\hat\jmath)=x\,f(\hat\imath)+y\,f(\hat\jmath).
$$

**只要知道 $\hat\imath$ 和 $\hat\jmath$ 去了哪，就知道每一个向量去了哪。** 一个定义在无穷多个点上的函数，被两个向量完全确定了。

把这两个落点竖着并排写，就是矩阵：

$$
A=\begin{bmatrix}a&b\\c&d\end{bmatrix}
\qquad
\text{第一列 }(a,c)\text{ 是 }\hat\imath\text{ 的落点，第二列 }(b,d)\text{ 是 }\hat\jmath\text{ 的落点。}
$$

点播放看变换的过程。橙色箭头是 $\hat\imath$，蓝色是 $\hat\jmath$，黑色是 $\mathbf{v}=(1,2)$。拖动两个箭头头上的圆点，可以自己定一个变换：

```render html title="线性变换：网格跟着 î、ĵ 的落点一起动"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 32px; height: 32px; margin: -16px 0 0 -16px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 9px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); }
  .knob:active { cursor: grabbing; }
  .knob:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
  .scrub { display: flex; align-items: center; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-top: 4px; font: 13px var(--font-mono); }
  .m { display: inline-grid; grid-auto-flow: column; grid-template-rows: auto auto; gap: 0 12px; position: relative; padding: 0 9px; font: 13px var(--font-mono); text-align: right; line-height: 1.5; vertical-align: middle; }
  .m::before, .m::after { content: ""; position: absolute; top: 1px; bottom: 1px; width: 5px; border: 1.5px solid var(--muted); }
  .m::before { left: 0; border-right: 0; } .m::after { right: 0; border-left: 0; }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
</style>
<section class="la" aria-label="线性变换演示：选一个变换，播放网格变形">
  <div class="bar">
    <div class="seg" role="group" aria-label="选一个变换">
      <button type="button" data-p="0">旋转</button>
      <button type="button" data-p="1">剪切</button>
      <button type="button" data-p="2">伸缩</button>
      <button type="button" data-p="3">镜像</button>
      <button type="button" data-p="4">随便一个</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <label class="scrub"><span>进度</span><input type="range" min="0" max="1000" value="1000" aria-label="变换进度" /></label>
  <div class="foot"><span>A =</span><span class="m"></span><span class="read"></span></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), playBtn = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0;

const presets = [
  { m: [0, -1, 1, 0], rot: Math.PI / 2 },
  { m: [1, 1, 0, 1] },
  { m: [2, 0, 0, .5] },
  { m: [0, 1, 1, 0] },
  { m: [1.5, -.5, .5, 1] },
];
let A = presets[0].m.slice(), rot = presets[0].rot, cur = 0;
const v = [1, 2];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });

// 进度 t 对应的矩阵：旋转按角度走，其余从单位矩阵直线走到 A
function M(t) {
  const e = ease(t);
  if (rot !== undefined) { const c = Math.cos(rot * e), s = Math.sin(rot * e); return [c, -s, s, c]; }
  return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e];
}

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0]) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
// 标签放在箭头尖外侧，顺着箭头的方向
function label(text, at, color, from = [0, 0]) {
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  ctx.fillStyle = color; ctx.font = '600 15px KaTeX_Main, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (x - ox) / L * 22, y + (y - oy) / L * 22);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function grid(m, color, axis) {
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) * 3;
  for (let k = -R; k <= R; k++) {
    seg(ap(m, [k, -R]), ap(m, [k, R]), k ? color : axis, k ? 1 : 1.6);
    seg(ap(m, [-R, k]), ap(m, [R, k]), k ? color : axis, k ? 1 : 1.6);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), i = [m[0], m[2]], j = [m[1], m[3]];
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .5; grid(m, C.muted, C.text); ctx.globalAlpha = 1;
  // 单位正方形
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => P(ap(m, p)));
  ctx.beginPath(); sq.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = C['accent-soft']; ctx.globalAlpha = .75; ctx.fill(); ctx.globalAlpha = 1;
  // v 的配方：先走 x 份 î，再走 y 份 ĵ
  const xi = [v[0] * i[0], v[0] * i[1]], out = ap(m, v);
  seg([0, 0], xi, C.accent, 2, [5, 5]); seg(xi, out, C.blue, 2, [5, 5]);
  arrow(out, C.text, 2.4); label('v', out, C.text);
  arrow(i, C.accent); arrow(j, C.blue);
  label('î', i, C['accent-ink']); label('ĵ', j, C.blue);
  knobs.forEach((k) => k.place());

  root.querySelector('.m').innerHTML = [m[0], m[2]].map((x) => `<span class="i">${num(x)}</span>`).join('') + [m[1], m[3]].map((x) => `<span class="j">${num(x)}</span>`).join('');
  root.querySelector('.read').innerHTML = `v = (1, 2) → 1·<span class="i">(${num(i[0])}, ${num(i[1])})</span> + 2·<span class="j">(${num(j[0])}, ${num(j[1])})</span> = (${num(out[0])}, ${num(out[1])})`;
  range.value = Math.round(t * 1000);
  cv.setAttribute('aria-label', `î 落在 (${num(i[0])}, ${num(i[1])})，ĵ 落在 (${num(j[0])}, ${num(j[1])})，v 落在 (${num(out[0])}, ${num(out[1])})`);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 250;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1500)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
function pick(p) {
  cur = p; A = presets[p].m.slice(); rot = presets[p].rot;
  root.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === p)));
  play();
}

function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => {
    cancelAnimationFrame(raf); t = 1; rot = undefined; set(p);
    root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    draw();
  };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(snap(U(e.clientX - r.left, e.clientY - r.top))); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take(snap([p[0] + d[0] * s, p[1] + d[1] * s]));
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; } };
}
const knobs = [
  knob('i', 'î 的落点', () => { const m = M(t); return [m[0], m[2]]; }, (p) => { A[0] = p[0]; A[2] = p[1]; }),
  knob('j', 'ĵ 的落点', () => { const m = M(t); return [m[1], m[3]]; }, (p) => { A[1] = p[0]; A[3] = p[1]; }),
];

root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.p))));
playBtn.addEventListener('click', play);
range.addEventListener('input', () => { cancelAnimationFrame(raf); t = range.value / 1000; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(380, W * .6)));
  S = H / 8;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
root.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === cur)));
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

每个变换看完，留意两件事。一是网格线始终是直的、平行的、等距的，原点一直没动。二是黑色的 $\mathbf{v}$ 走的虚线：先沿新的 $\hat\imath$ 走 1 份，再沿新的 $\hat\jmath$ 走 2 份。$\mathbf{v}$ 原来的配方是 $(1,2)$，变换之后配方没变，变的是配料。

这就是矩阵乘向量的真实含义：

$$
\begin{bmatrix}a&b\\c&d\end{bmatrix}\begin{bmatrix}x\\y\end{bmatrix}
=x\begin{bmatrix}a\\c\end{bmatrix}+y\begin{bmatrix}b\\d\end{bmatrix}
=\begin{bmatrix}ax+by\\cx+dy\end{bmatrix}.
$$

**拿 $\mathbf{v}$ 的坐标当配方，把 $A$ 的各列混起来。** 课本上“第一行点乘向量得第一个分量”的算法，是同一堆乘法换了个分组方式；按列来看，才看得出它在干什么。

镜像那个例子值得多看一眼：播放到一半，整张平面被压成了一条斜线，然后才翻过去。把一张纸翻面，中途总有一刻它是侧着的。这个“压扁”后面讲行列式时还会出现。

### 矩阵是函数存下来的那张表

用代码说一遍。向量是一组数，矩阵按列存，`A[j]` 就是第 $j$ 个基向量的落点：

```ts title="linear.ts"
type Vec = number[];
type Mat = Vec[]; // 按列存：A[j] 是第 j 个基向量的落点

const add = (u: Vec, v: Vec): Vec => u.map((x, i) => x + v[i]);
const scale = (c: number, v: Vec): Vec => v.map((x) => c * x);
const basis = (n: number): Vec[] =>
  Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)));

// 表 → 函数：拿 v 的坐标当配方，把 A 的各列混起来
const apply = (A: Mat) => (v: Vec): Vec =>
  A.map((col, j) => scale(v[j], col)).reduce(add);

// 函数 → 表：只问它每个基向量去了哪
const tabulate = (f: (v: Vec) => Vec, n: number): Mat => basis(n).map(f);
```

`tabulate` 把一个函数变成一张表，`apply` 把表变回函数。拿逆时针转 90° 试试：

```ts
const rotate = ([x, y]: Vec): Vec => [-y, x];

tabulate(rotate, 2);                // î 去了 (0, 1)，ĵ 去了 (-1, 0)
apply(tabulate(rotate, 2))([3, 2]); // [-2, 3]，和 rotate([3, 2]) 一样
```

函数定义在无穷多个输入上，表只有 $n$ 列。能压缩成这样，全靠线性：只要 $f$ 守那两条规矩，`apply(tabulate(f, n))` 和 $f$ 在每个输入上都给出同样的结果。

换一个不守规矩的函数，表就不够用了：

```ts
const square = ([x, y]: Vec): Vec => [x * x, y];

apply(tabulate(square, 2))([3, 2]); // [3, 2]
square([3, 2]);                     // [9, 2]
```

知道 $f(\hat\imath)$ 和 $f(\hat\jmath)$，推不出 $f(3\hat\imath+2\hat\jmath)$。线性函数之所以能被一个矩阵记住，是因为它对配方是透明的：输入怎么配，输出就怎么配。

所以说矩阵是函数，不只是打比方。一个 $m\times n$ 的矩阵，和一个从 $\mathbb{R}^n$ 到 $\mathbb{R}^m$ 的线性函数，是同一个东西的两种存法。

## 矩阵乘法：先做一个，再做一个

先用 $B$ 变换一次，再用 $A$ 变换一次。两次接连做，网格线依旧是直的、平行等距的，原点依旧不动，所以合起来还是一个线性变换，也就有自己的矩阵。把它记作 $AB$。

它的每一列怎么求？还是只问基向量去了哪。$\hat\imath$ 先被 $B$ 送到 $B$ 的第一列，再被 $A$ 送到“$A$ 作用在 $B$ 的第一列上”的位置。$\hat\jmath$ 同理。于是：

> [!IMPORTANT]
> $AB$ 的第 $j$ 列，等于 $A$ 作用在 $B$ 的第 $j$ 列上。

拿开头那道题验证。$B$ 的第一列是 $(5,7)$，用它当配方去混 $A$ 的两列：

$$
5\begin{bmatrix}1\\3\end{bmatrix}+7\begin{bmatrix}2\\4\end{bmatrix}=\begin{bmatrix}19\\43\end{bmatrix},
\qquad
6\begin{bmatrix}1\\3\end{bmatrix}+8\begin{bmatrix}2\\4\end{bmatrix}=\begin{bmatrix}22\\50\end{bmatrix}.
$$

正是 $\begin{bmatrix}19&22\\43&50\end{bmatrix}$ 的两列。“行乘列”的规则就是这么来的：结果第 $i$ 行第 $j$ 列那个数，是 $A$ 作用在 $B$ 第 $j$ 列上之后的第 $i$ 个分量，按行去算它，恰好是 $A$ 的第 $i$ 行和 $B$ 的第 $j$ 列对应相乘再相加。规则不是规定出来的，是从“接连做两次变换”推出来的。

写成代码，矩阵乘法就是函数复合，再存成表：

```ts
const compose = <A, B, C>(f: (b: B) => C, g: (a: A) => B) => (x: A): C => f(g(x));

const mul = (A: Mat, B: Mat): Mat => tabulate(compose(apply(A), apply(B)), B.length);
```

展开 `tabulate` 会发现，它就是把 `apply(A)` 作用到 $B$ 的每一列上：`B.map(apply(A))`。

$AB$ 的写法也要从右往左读，和 $f(g(x))$ 一样：先做 $B$，再做 $A$。

顺序到底要不要紧，看一个例子。$R$ 是逆时针转 90°，$S$ 是向右剪切。对一个字母 F 分别试两种顺序：

```render html title="先剪切再旋转，和先旋转再剪切"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  canvas { display: block; width: 100%; margin-top: 10px; }
  .steps { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 6px; font: 13px var(--font-mono); }
  .steps .st { display: inline-flex; align-items: center; gap: 6px; color: var(--faint); transition: color .2s; }
  .steps .st.on { color: var(--text); }
  .steps .st small { font: 12px var(--font-sans); }
  .m { display: inline-grid; grid-auto-flow: column; grid-template-rows: auto auto; gap: 0 12px; position: relative; padding: 0 9px; text-align: right; line-height: 1.5; }
  .m::before, .m::after { content: ""; position: absolute; top: 1px; bottom: 1px; width: 5px; border: 1.5px solid currentColor; }
  .m::before { left: 0; border-right: 0; } .m::after { right: 0; border-left: 0; }
  .track { margin: 6px 0 0; color: var(--muted); font: 13px var(--font-mono); }
  .track .i { color: var(--accent-ink); } .track .j { color: var(--blue); }
</style>
<section class="la" aria-label="同样两个变换，换个顺序，结果不同">
  <div class="bar">
    <div class="seg" role="group" aria-label="顺序">
      <button type="button" data-o="0" aria-pressed="true">先剪切，再旋转</button>
      <button type="button" data-o="1" aria-pressed="false">先旋转，再剪切</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <canvas role="img"></canvas>
  <div class="steps"></div>
  <p class="track"></p>
</section>
<script>
const root = document.querySelector('.la');
const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 2, raf = 0, order = 0;

const Rm = { name: 'R', m: [0, -1, 1, 0], rot: Math.PI / 2, say: '旋转' };
const Sm = { name: 'S', m: [1, 1, 0, 1], say: '剪切' };
const F = [[0, 0], [0, 2], [1.3, 2], [1.3, 1.6], [.45, 1.6], [.45, 1.18], [1.05, 1.18], [1.05, .78], [.45, .78], [.45, 0]];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const mm = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const vec = ([x, y]) => `(${num(x)}, ${num(y)})`;

function part(T, e) {
  if (T.rot) { const c = Math.cos(T.rot * e), s = Math.sin(T.rot * e); return [c, -s, s, c]; }
  return [1 + (T.m[0] - 1) * e, T.m[1] * e, T.m[2] * e, 1 + (T.m[3] - 1) * e];
}
const seq = () => (order ? [Rm, Sm] : [Sm, Rm]);
// t 在 [0, 1] 做第一步，[1, 2] 做第二步
function M(t) {
  const [a, b] = seq();
  return t <= 1 ? part(a, ease(t)) : mm(part(b, ease(t - 1)), a.m);
}

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0]) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function grid(m, color, axis) {
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) * 3;
  for (let k = -R; k <= R; k++) {
    seg(ap(m, [k, -R]), ap(m, [k, R]), k ? color : axis, k ? 1 : 1.6);
    seg(ap(m, [-R, k]), ap(m, [R, k]), k ? color : axis, k ? 1 : 1.6);
  }
}
const mat = (m) => `<span class="m">${[m[0], m[2], m[1], m[3]].map((x) => `<span>${num(x)}</span>`).join('')}</span>`;

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .5; grid(m, C.muted, C.text); ctx.globalAlpha = 1;
  // 原来的 F 留一个虚影
  const path = (pts) => { ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = P(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
  path(F); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
  path(F.map((p) => ap(m, p)));
  ctx.fillStyle = C['accent-soft']; ctx.fill(); ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
  arrow([m[0], m[2]], C.accent); arrow([m[1], m[3]], C.blue);

  const [a, b] = seq(), prod = mm(b.m, a.m), stage = t <= 0 ? -1 : t <= 1 ? 0 : t < 2 ? 1 : 2;
  root.querySelector('.steps').innerHTML =
    `<span class="st${stage === 0 ? ' on' : ''}"><small>第一步 ${a.say}</small>${a.name} = ${mat(a.m)}</span>` +
    `<span class="st${stage === 1 ? ' on' : ''}"><small>第二步 ${b.say}</small>${b.name} = ${mat(b.m)}</span>` +
    `<span class="st${stage === 2 ? ' on' : ''}"><small>合起来</small>${b.name}${a.name} = ${mat(prod)}</span>`;
  const i1 = [a.m[0], a.m[2]], j1 = [a.m[1], a.m[3]];
  root.querySelector('.track').innerHTML =
    `<span class="i">î：(1, 0) → ${vec(i1)} → ${vec(ap(b.m, i1))}</span><br><span class="j">ĵ：(0, 1) → ${vec(j1)} → ${vec(ap(b.m, j1))}</span>`;
  cv.setAttribute('aria-label', `先${a.say}再${b.say}，合起来的矩阵第一列 ${vec([prod[0], prod[2]])}，第二列 ${vec([prod[1], prod[3]])}`);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 2; return draw(); }
  const t0 = performance.now() + 250;
  // 两步之间停一下，看清中间状态
  const step = (now) => { const k = (now - t0) / 1300; t = k < 1 ? Math.max(0, k) : k < 1.35 ? 1 : Math.min(2, k - .35); draw(); if (t < 2) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
root.querySelectorAll('[data-o]').forEach((btn) => btn.addEventListener('click', () => {
  order = Number(btn.dataset.o);
  root.querySelectorAll('[data-o]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
  play();
}));
root.querySelector('.play').addEventListener('click', play);

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(240, Math.min(320, W * .5)));
  S = H / 7;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(cv);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(cv);
</script>
```

两种顺序，F 最后躺的姿势不一样，合起来的矩阵也不一样：

$$
RS=\begin{bmatrix}0&-1\\1&1\end{bmatrix},\qquad SR=\begin{bmatrix}1&-1\\1&0\end{bmatrix}.
$$

图下面跟踪了 $\hat\imath$、$\hat\jmath$ 的两段旅程，终点就是合起来那个矩阵的两列。用这种方法，不用背规则也能算出任何两个矩阵的乘积。

从“函数复合”出发，矩阵乘法的性质几乎都不用证：

- **不能交换。** 先穿袜子再穿鞋，和先穿鞋再穿袜子，不是一回事。
- **满足结合律。** $(AB)C$ 和 $A(BC)$ 都是先做 $C$，再做 $B$，最后做 $A$，括号只决定先把哪两个合成一张表。用下标求和去证，要写半页 $\sum$；用函数看，一句话。
- **单位矩阵 $I$ 是什么也不做的函数**，`x => x`。

### 形状就是类型签名

一个 $m\times n$ 的矩阵有 $n$ 列，每列 $m$ 个数：它吃 $n$ 维向量，吐 $m$ 维向量，是一个 $\mathbb{R}^n\to\mathbb{R}^m$ 的函数。

两个矩阵能不能相乘，就是两个函数能不能复合：

$$
\underbrace{A}_{p\times m}\;\underbrace{B}_{m\times n}=\underbrace{AB}_{p\times n}
\qquad\Longleftrightarrow\qquad
(\mathbb{R}^m\to\mathbb{R}^p)\circ(\mathbb{R}^n\to\mathbb{R}^m)=(\mathbb{R}^n\to\mathbb{R}^p).
$$

$B$ 吐出来的是 $m$ 维，$A$ 吃进去的也得是 $m$ 维。中间那两个数对不上，就是类型错误。“左边的列数等于右边的行数”这条规定，本来就是在做类型检查。

### 同一个乘法，四种看法

矩阵乘法里那 $n^3$ 次乘法，可以有四种分组方式，每种对应一个视角。设 $A$ 的列是 $\mathbf{a}_k$、行是 $\mathbf{r}_i^\top$，$B$ 的列是 $\mathbf{b}_j$、行是 $\mathbf{s}_k^\top$：

| 看法 | 写法 | 它在说什么 |
| --- | --- | --- |
| 按列 | $AB=\begin{bmatrix}A\mathbf{b}_1&\cdots&A\mathbf{b}_n\end{bmatrix}$ | $A$ 作用在 $B$ 的每一列上，就是复合 |
| 按行 | 第 $i$ 行 $=\mathbf{r}_i^\top B$ | 用 $A$ 的一行当配方，去混 $B$ 的各行 |
| 按元素 | $(AB)_{ij}=\mathbf{r}_i\cdot\mathbf{b}_j$ | 课本上的行乘列，适合算单个数 |
| 按外积 | $AB=\sum_k \mathbf{a}_k\,\mathbf{s}_k^\top$ | 拆成若干个“一列乘一行”的叠加 |

按行看，是高斯消元的视角：左乘一个矩阵，就是对右边矩阵的行做组合。按外积看，每一项 $\mathbf{a}_k\mathbf{s}_k^\top$ 都是一个最简单的矩阵，所有列都是同一个向量的倍数。这种“一层一层叠起来”的看法，到奇异值分解时会变成主角。

## 行列式：面积被放大了几倍

$\hat\imath$ 和 $\hat\jmath$ 围出一个面积为 1 的单位正方形。变换之后，它变成以 $A$ 的两列为边的平行四边形。

网格变换后依旧平行、等距，所以平面上每一个小方格都变成了同样大小的平行四边形。任何形状都能用足够小的方格去拼，于是**所有形状的面积，都被放大了同一个倍数**。这个倍数就是行列式 $\det A$。

拖动 $\hat\imath$、$\hat\jmath$ 的落点，看平行四边形的面积；试试把 $\hat\jmath$ 拖到 $\hat\imath$ 的右手边：

```render html title="行列式：单位正方形变成了多大的平行四边形"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .16); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .18); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 32px; height: 32px; margin: -16px 0 0 -16px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 9px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); }
  .knob:active { cursor: grabbing; }
  .knob:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
  .read { margin: 6px 0 0; font: 14px var(--font-mono); }
  .read b { font-weight: 650; }
  .read .pos { color: var(--accent-ink); } .read .neg { color: var(--blue); }
  .note { margin: 2px 0 0; min-height: 1.5em; color: var(--muted); }
</style>
<section class="la" aria-label="拖动 î、ĵ 的落点，观察单位正方形的面积和朝向">
  <div class="bar">
    <div class="seg" role="group" aria-label="例子">
      <button type="button" data-p="0" aria-pressed="true">放大</button>
      <button type="button" data-p="1" aria-pressed="false">剪切</button>
      <button type="button" data-p="2" aria-pressed="false">翻面</button>
      <button type="button" data-p="3" aria-pressed="false">压扁</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <p class="read"></p>
  <p class="note" aria-live="polite"></p>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0;
const presets = [[2, 1, 0, 1.5], [1, 1, 0, 1], [.5, 1.5, 1.5, .5], [1, 2, .5, 1]];
let A = presets[0].slice();

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });
const M = (t) => { const e = ease(t); return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e]; };

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0]) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function label(text, at, color, from = [0, 0]) {
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  ctx.fillStyle = color; ctx.font = '600 15px KaTeX_Main, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (x - ox) / L * 22, y + (y - oy) / L * 22);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function grid(m, color, axis) {
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) * 3;
  for (let k = -R; k <= R; k++) {
    seg(ap(m, [k, -R]), ap(m, [k, R]), k ? color : axis, k ? 1 : 1.6);
    seg(ap(m, [-R, k]), ap(m, [R, k]), k ? color : axis, k ? 1 : 1.6);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), i = [m[0], m[2]], j = [m[1], m[3]], det = m[0] * m[3] - m[1] * m[2];
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .45; grid(m, C.muted, C.text); ctx.globalAlpha = 1;

  const flat = Math.abs(det) < .005;
  const sq = [[0, 0], i, [i[0] + j[0], i[1] + j[1]], j].map(P);
  ctx.beginPath(); sq.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = det >= 0 ? C['accent-soft'] : C['blue-soft']; ctx.fill();
  ctx.strokeStyle = flat ? C.text : det >= 0 ? C.accent : C.blue; ctx.lineWidth = flat ? 2.4 : 1.2; ctx.setLineDash([]); ctx.stroke();

  // 从 î 转到 ĵ 的方向：逆时针是正，顺时针是负
  const ai = Math.atan2(i[1], i[0]), aj = Math.atan2(j[1], j[0]);
  let sw = aj - ai; while (sw > Math.PI) sw -= 2 * Math.PI; while (sw <= -Math.PI) sw += 2 * Math.PI;
  if (!flat && Math.hypot(...i) > .3 && Math.hypot(...j) > .3) {
    const [ox, oy] = P([0, 0]), r = .55 * S, end = ai + sw * .92, col = det > 0 ? C['accent-ink'] : C.blue;
    ctx.beginPath(); ctx.arc(ox, oy, r, -ai, -end, sw > 0); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
    const ex = ox + r * Math.cos(end), ey = oy - r * Math.sin(end), s = Math.sign(sw), tx = -Math.sin(end) * s, ty = -Math.cos(end) * s;
    ctx.beginPath(); ctx.moveTo(ex + tx * 7, ey + ty * 7); ctx.lineTo(ex - ty * 4, ey + tx * 4); ctx.lineTo(ex + ty * 4, ey - tx * 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  if (!flat) {
    const c = P([(i[0] + j[0]) / 2, (i[1] + j[1]) / 2]);
    ctx.fillStyle = det >= 0 ? C['accent-ink'] : C.blue; ctx.font = '600 15px JetBrains Mono Variable, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num(det), c[0], c[1]); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  arrow(i, C.accent); arrow(j, C.blue);
  label('î', i, C['accent-ink']); label('ĵ', j, C.blue);
  knobs.forEach((k) => k.place());

  const cls = det > .005 ? 'pos' : det < -.005 ? 'neg' : '';
  root.querySelector('.read').innerHTML = `det = ${num(m[0])}·${num(m[3])} − ${num(m[1])}·${num(m[2])} = <b class="${cls}">${num(det)}</b>`;
  root.querySelector('.note').textContent = flat
    ? '面积是 0：整个平面被压成了一条线（或一个点）。'
    : det > 0
      ? `面积放大到 ${num(det)} 倍；从 î 到 ĵ 仍是逆时针。`
      : `面积放大到 ${num(-det)} 倍，但平面翻了个面：从 î 到 ĵ 变成了顺时针，所以带负号。`;
  cv.setAttribute('aria-label', `行列式 ${num(det)}`);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 250;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1500)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => { cancelAnimationFrame(raf); t = 1; set(p); root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', 'false')); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(snap(U(e.clientX - r.left, e.clientY - r.top))); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take(snap([p[0] + d[0] * s, p[1] + d[1] * s]));
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; } };
}
const knobs = [
  knob('i', 'î 的落点', () => { const m = M(t); return [m[0], m[2]]; }, (p) => { A[0] = p[0]; A[2] = p[1]; }),
  knob('j', 'ĵ 的落点', () => { const m = M(t); return [m[1], m[3]]; }, (p) => { A[1] = p[0]; A[3] = p[1]; }),
];
root.querySelectorAll('[data-p]').forEach((btn) => btn.addEventListener('click', () => {
  A = presets[Number(btn.dataset.p)].slice();
  root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
  play();
}));
root.querySelector('.play').addEventListener('click', play);

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(360, W * .58)));
  S = H / 7;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

剪切那个例子，形状歪了，面积却还是 1：底没变，高也没变。翻面那个例子，面积是 2，行列式却是 $-2$。

**负号表示平面被翻了个面。** 原本从 $\hat\imath$ 逆时针转一个小角度就到 $\hat\jmath$；翻面之后，得顺时针转。就像把一张透明纸翻过来，上面的字全成了镜像。点“翻面”的播放，留意行列式从 1 一路减到 $-2$，中途必定经过 0：要翻面，平面总得先被压扁一下。

三维里，行列式是单位立方体变成的平行六面体的体积；符号看右手定则：$\hat\imath$、$\hat\jmath$、$\hat k$ 变换后还满足右手定则就是正，变成左手就是负。

### ad − bc 是怎么来的

二维的公式可以直接从图上读出来。设 $\hat\imath$ 落到 $(a,c)$，$\hat\jmath$ 落到 $(b,d)$，用外面那个大矩形减掉周围的边角：

```render svg title="(a+b)(c+d) − ac − bd − 2bc = ad − bc，图里 a=3, c=1, b=1, d=2"
<svg viewBox="0 0 560 210" xmlns="http://www.w3.org/2000/svg" font-family="Inter Variable, sans-serif">
  <g stroke="var(--rule-strong)" stroke-width="1.2">
    <path d="M30 175 L165 175 L165 130 Z M75 85 L75 40 L210 40 Z" fill="var(--bg-sunken)" />
    <path d="M30 175 L75 85 L30 85 Z M165 130 L210 130 L210 40 Z" fill="var(--bg-sunken)" />
    <path d="M165 130 H210 V175 H165 Z M30 40 H75 V85 H30 Z" fill="var(--surface)" />
  </g>
  <path d="M30 175 L165 130 L210 40 L75 85 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" />
  <rect x="30" y="40" width="180" height="135" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 4" />
  <g font-size="12" fill="var(--muted)" text-anchor="middle">
    <text x="120" y="165">ac/2</text>
    <text x="120" y="56">ac/2</text>
    <text x="46" y="118">bd/2</text>
    <text x="195" y="104">bd/2</text>
    <text x="187" y="157">bc</text>
    <text x="52" y="67">bc</text>
  </g>
  <g font-size="12" fill="var(--faint)" text-anchor="middle">
    <text x="97" y="194">a</text>
    <text x="187" y="194">b</text>
    <text x="16" y="133">d</text>
    <text x="16" y="66">c</text>
  </g>
  <text x="120" y="112" font-size="17" font-weight="600" fill="var(--accent-ink)" text-anchor="middle">ad − bc</text>
  <g font-size="15" fill="currentColor" font-family="JetBrains Mono Variable, monospace">
    <text x="262" y="78">大矩形  (a+b)(c+d)</text>
    <text x="262" y="106">四个三角  − ac − bd</text>
    <text x="262" y="134">两个小矩形 − 2bc</text>
    <text x="262" y="166" fill="var(--accent-ink)" font-weight="600">剩下  ad − bc</text>
  </g>
</svg>
```

$(a+b)(c+d)=ac+ad+bc+bd$，减掉 $ac+bd+2bc$，剩下 $ad-bc$。图里是 $3\cdot2-1\cdot1=5$。

### 性质都能从画面里读出来

- **$\det(AB)=\det A\cdot\det B$。** 先放大 $\det B$ 倍，再放大 $\det A$ 倍。用公式硬证三阶的情况，要展开几十项。
- **$\det A=0$ 意味着空间被压扁了**，二维压成线或点，三维压成面、线或点。压扁会丢信息，后面马上会看到，这时变换没法撤回。
- **把一行的若干倍加到另一行上，行列式不变。** 这在几何上是一次剪切，剪切不改变面积。高斯消元主要就是不停地做剪切，把矩阵化成上三角，行列式等于对角线的乘积；中途遇到要交换两行，就照一次镜子，符号翻一次。计算机算行列式就是这么做的，$O(n^3)$；课本上按定义展开的公式有 $n!$ 项，二十阶就算不动了。

至于三阶以上那串交错的正负号，它们是“朝向”在代数里的影子：交换两个基向量，等于照一次镜子，符号就翻一次。

## 逆矩阵与 Ax = b：倒着找输入

一个方程组：

$$
\begin{aligned}
2x+y&=5\\
x+3y&=5
\end{aligned}
\qquad\Longleftrightarrow\qquad
\begin{bmatrix}2&1\\1&3\end{bmatrix}\begin{bmatrix}x\\y\end{bmatrix}=\begin{bmatrix}5\\5\end{bmatrix}.
$$

左边一行一行看，是两条直线求交点。换成变换的眼光，$A\mathbf{x}=\mathbf{b}$ 问的是：**哪个向量经过 $A$ 变换之后，正好落在 $\mathbf{b}$ 上？**

再换一种说法。$A\mathbf{x}=x\,\mathbf{a}_1+y\,\mathbf{a}_2$，所以它也在问：用 $A$ 的两列当配料，怎么配才能配出 $\mathbf{b}$？答案是 $x=2$、$y=1$：

$$
2\begin{bmatrix}2\\1\end{bmatrix}+1\begin{bmatrix}1\\3\end{bmatrix}=\begin{bmatrix}5\\5\end{bmatrix}.
$$

这又绕回了开头的“坐标是配方”：**解方程组，就是求 $\mathbf{b}$ 在“$A$ 的各列”这组基下的坐标。** 第一张图其实一直在解方程组：$\mathbf{b}_1$、$\mathbf{b}_2$ 是 $A$ 的两列，$\mathbf{v}$ 是 $\mathbf{b}$，右边读出来的配方就是解。

只要 $\det A\ne0$，变换没有把空间压扁，每个输出都恰好来自一个输入，变换就能撤回。撤回它的那个变换叫逆矩阵 $A^{-1}$：

$$
A^{-1}A=I,\qquad \mathbf{x}=A^{-1}\mathbf{b}.
$$

$A$ 把电影往前放，$A^{-1}$ 倒着放。写代码的说法是：一个函数有反函数，当且仅当它是一一对应的。二阶的逆矩阵有个现成公式：

$$
\begin{bmatrix}a&b\\c&d\end{bmatrix}^{-1}=\frac{1}{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}.
$$

前面那个 $\frac{1}{ad-bc}$ 是在把面积缩回去：$A$ 放大了 $\det A$ 倍，$A^{-1}$ 就得缩小同样的倍数。$\det A=0$ 时这一项没有意义，逆矩阵也就不存在。

实际计算时，很少真的去求 $A^{-1}$ 再乘 $\mathbf{b}$。高斯消元每一步都是一个简单的变换：把一行的倍数加到另一行（剪切）、某一行乘个数（伸缩）、交换两行（镜像）。不停地做，直到 $A$ 变成 $I$；同样的操作作用在 $\mathbf{b}$ 上，$\mathbf{b}$ 就变成了解。这些小变换乘起来正好是 $A^{-1}$。所以消元法还顺便说明了一件事：**任何可逆的变换，都能拆成一串剪切、伸缩和镜像。**

## 秩、列空间、零空间：压扁之后剩下什么

$\det A=0$ 时会发生什么？看 $A=\begin{bmatrix}2&4\\1&2\end{bmatrix}$，它的第二列正好是第一列的两倍。

先选“秩 1”，点播放。再拖动 $\mathbf{b}$，看哪些输入会落到它上面：

```render html title="把平面压成一条线：哪些 x 会落到 b 上"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 32px; height: 32px; margin: -16px 0 0 -16px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; color: var(--text); }
  .knob::after { content: ""; position: absolute; inset: 9px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob:active { cursor: grabbing; }
  .knob:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
  .scrub { display: flex; align-items: center; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .read { display: flex; flex-wrap: wrap; gap: 2px 22px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); margin-right: 6px; }
  .note { margin: 4px 0 0; min-height: 3em; color: var(--muted); }
  .note b { color: var(--text); font-weight: 600; }
</style>
<section class="la" aria-label="满秩和秩 1 的矩阵，观察 b 的原像">
  <div class="bar">
    <div class="seg" role="group" aria-label="矩阵">
      <button type="button" data-r="2" aria-pressed="false">满秩</button>
      <button type="button" data-r="1" aria-pressed="true">秩 1</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <label class="scrub"><span>进度</span><input type="range" min="0" max="1000" value="1000" aria-label="变换进度" /></label>
  <p class="read"></p>
  <p class="note" aria-live="polite"></p>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0, rank = 1;
const mats = { 2: [2, -1, 1, 1], 1: [2, 4, 1, 2] };
const col = [2, 1], nul = [2, -1]; // 秩 1 时：列空间方向、零空间方向
let b = [2, 1];
const start = { 2: [3, 3], 1: [2, 1] };

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const vec = ([x, y]) => `(${num(x)}, ${num(y)})`;
const clampIn = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4; return Math.max(-lim, Math.min(lim, q)); });
const M = (t) => { const A = mats[rank], e = ease(t); return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e]; };

function seg(a, c, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(c);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function grid(m, color, axis) {
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) * 3;
  for (let k = -R; k <= R; k++) {
    seg(ap(m, [k, -R]), ap(m, [k, R]), k ? color : axis, k ? 1 : 1.6);
    seg(ap(m, [-R, k]), ap(m, [R, k]), k ? color : axis, k ? 1 : 1.6);
  }
}
function text(s, at, color, dx = 0, dy = 0, align = 'left') {
  const [x, y] = P(at);
  ctx.fillStyle = color; ctx.font = '12px Inter Variable, sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, x + dx, y + dy); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function dot(at, color, r = 5) { const [x, y] = P(at); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }

// 秩 1 时，b 落在列空间上才有解；k 是 b = k·(2, 1) 里的 k
const onLine = () => Math.abs(b[0] * col[1] - b[1] * col[0]) / Math.hypot(...col) < 1e-6;
const kOf = () => (b[0] * col[0] + b[1] * col[1]) / 5;

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1, L = 40;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .4; grid(m, C.muted, C.text); ctx.globalAlpha = 1;
  const read = root.querySelector('.read'), note = root.querySelector('.note');

  if (rank === 1) {
    // x + 2y = k 的那些平行线，各自被压成一个点 k·(2, 1)
    for (let k = -3; k <= 3; k++) {
      const p0 = [k, 0], a = [p0[0] - L * nul[0], p0[1] - L * nul[1]], c = [p0[0] + L * nul[0], p0[1] + L * nul[1]];
      // 变换前的位置留一道虚影
      if (t > 0) { ctx.globalAlpha = k ? .25 : .5; seg(a, c, k ? C.blue : C.accent, 1.2, [3, 5]); }
      ctx.globalAlpha = k ? .55 : 1;
      seg(ap(m, a), ap(m, c), k ? C.blue : C.accent, k ? 1.4 : 2.6);
      ctx.globalAlpha = 1;
    }
    seg([-L * col[0], -L * col[1]], [L * col[0], L * col[1]], C.text, 1.4, [6, 5]);
    text('列空间', [2.6 * col[0] / 2, 2.6 * col[1] / 2], C.text, 6, -14);
    text('零空间', [-2.8, 1.4], C['accent-ink'], 10, 0);
    const ok = onLine();
    if (ok) {
      const k = kOf(), p0 = [k, 0], a = [p0[0] - L * nul[0], p0[1] - L * nul[1]], c = [p0[0] + L * nul[0], p0[1] + L * nul[1]];
      if (t > 0) { ctx.globalAlpha = .6; seg(a, c, C.text, 1.6, [6, 5]); ctx.globalAlpha = 1; }
      seg(ap(m, a), ap(m, c), C.text, 3.2);
      dot(ap(m, p0), C.text);
      note.innerHTML = `<b>无穷多个解</b>：x + 2y = ${num(k)} 这一整条线都落到 b 上。随便找一个解，比如 x₀ = ${vec(p0)}，再加上零空间里的任意向量：x = x₀ + s·(2, −1)。`;
    } else {
      note.innerHTML = '<b>无解</b>：b 不在列空间那条线上，没有任何输入能落到这里。把 b 拖到虚线附近，它会吸附上去。';
    }
    read.innerHTML = `<span><small>秩</small>1</span><span><small>列空间</small>过 (2, 1) 的直线</span><span><small>零空间</small>过 (2, −1) 的直线</span>`;
  } else {
    const A = mats[2], d = A[0] * A[3] - A[1] * A[2];
    const x = [(A[3] * b[0] - A[1] * b[1]) / d, (A[0] * b[1] - A[2] * b[0]) / d];
    dot(ap(m, x), C.accent, 6);
    if (t < .98) text('x', ap(m, x), C['accent-ink'], 10, -10);
    note.innerHTML = `<b>恰好一个解</b>：x = A⁻¹b = ${vec(x)}。平面没被压扁，每个 b 都有唯一的来处。`;
    read.innerHTML = `<span><small>秩</small>2</span><span><small>列空间</small>整个平面</span><span><small>零空间</small>只有原点</span>`;
  }
  dot([0, 0], C.text, 2.5);
  text('b', b, C.text, 14, -12);
  knob.place();
  range.value = Math.round(t * 1000);
  cv.setAttribute('aria-label', note.textContent);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 500;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1800)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}

const knob = (() => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'knob'; el.setAttribute('aria-label', '目标 b：拖动或用方向键移动');
  stage.append(el);
  const set = (p) => {
    p = clampIn(p);
    if (rank === 1) {
      // 靠近列空间就吸附上去
      const k = (p[0] * col[0] + p[1] * col[1]) / 5, q = [k * col[0], k * col[1]];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < .3) p = [Math.round(k * 10) / 10 * col[0], Math.round(k * 10) / 10 * col[1]];
      else p = p.map((v) => Math.round(v * 10) / 10);
    } else p = p.map((v) => { const r = Math.round(v); return Math.abs(v - r) < .15 ? r : Math.round(v * 10) / 10; });
    b = p; draw();
  };
  const move = (e) => { const r = cv.getBoundingClientRect(); set(U(e.clientX - r.left, e.clientY - r.top)); };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.onpointermove = move; });
  el.addEventListener('pointerup', () => { el.onpointermove = null; });
  el.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1;
    set([b[0] + d[0] * s, b[1] + d[1] * s]);
  });
  return { place() { const [x, y] = P(b); el.style.transform = `translate(${x}px, ${y}px)`; } };
})();

root.querySelectorAll('[data-r]').forEach((btn) => btn.addEventListener('click', () => {
  rank = Number(btn.dataset.r); b = start[rank].slice();
  root.querySelectorAll('[data-r]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
  play();
}));
root.querySelector('.play').addEventListener('click', play);
range.addEventListener('input', () => { cancelAnimationFrame(raf); t = range.value / 1000; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(360, W * .58)));
  S = H / 8;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

整个平面被压到了一条线上。这条线就是 $A$ 所有可能的输出，叫**列空间**：输出总是 $x\,\mathbf{a}_1+y\,\mathbf{a}_2$，能配出来的只有 $A$ 的各列张成的那部分。用函数的话说，列空间就是值域。

列空间是几维的，叫矩阵的**秩**，也就是变换之后还剩几维。二阶矩阵秩为 2，平面还是平面；秩为 1，压成一条线；秩为 0，全压到原点，那是零矩阵。方阵的秩等于阶数，叫满秩，一个维度都没丢。

橙色那条线上的向量全都被压到了原点。所有 $A\mathbf{x}=\mathbf{0}$ 的 $\mathbf{x}$ 叫**零空间**，又叫核：被变换彻底抹掉的那些方向。满秩时零空间只有原点自己。

图里的蓝线是和零空间平行的其他直线，每一条都被压成了列空间上的一个点。于是 $A\mathbf{x}=\mathbf{b}$ 只有两种情况：

- $\mathbf{b}$ 不在列空间上：没有任何输入能到那里，**无解**。
- $\mathbf{b}$ 在列空间上：落到 $\mathbf{b}$ 的不是一个点，是一整条线，**无穷多解**。

第二种情况的结构值得记住。如果 $A\mathbf{x}_0=\mathbf{b}$，$\mathbf{n}$ 在零空间里，那么

$$
A(\mathbf{x}_0+\mathbf{n})=A\mathbf{x}_0+A\mathbf{n}=\mathbf{b}+\mathbf{0}=\mathbf{b}.
$$

**通解 = 一个特解 + 整个零空间。**

这句话你其实早就见过：

$$
\int 2x\,\mathrm{d}x=x^2+C.
$$

求导是一个线性变换，$(f+g)'=f'+g'$，$(cf)'=cf'$；它会把所有常数函数压成 0，零空间就是常数函数。所以“哪个函数求导得 $2x$”的答案，是一个特解 $x^2$ 加上整个零空间 $C$。微分方程里“齐次解加特解”的套路，和这里是同一条定理。

### 维度守恒

这个例子里，输入是 2 维，列空间 1 维，零空间 1 维。一般地，对 $m\times n$ 的矩阵：

$$
\underbrace{n}_{\text{输入的维数}}=\underbrace{\operatorname{rank}A}_{\text{活下来的}}+\underbrace{\dim\operatorname{Null}A}_{\text{被压扁的}}.
$$

这叫秩–零化度定理。读成大白话：输入的每一个维度，要么活到了输出里，要么被压没了，不会凭空多出来，也不会凭空消失。

被压掉的维度找不回来。拍照（先不管透视）可以看成一个从三维到二维的投影，零空间是视线方向，深度信息就在那个方向上被压没了。所以一张照片推不出物体离你多远，要靠两只眼睛、深度传感器，或者别的线索去补。

秩为 1 的矩阵还有一个很有用的样子：它总能写成一列乘一行 $\mathbf{u}\mathbf{v}^\top$。作用在 $\mathbf{x}$ 上是 $\mathbf{u}(\mathbf{v}^\top\mathbf{x})$：先用 $\mathbf{v}$ 量出一个数，再沿 $\mathbf{u}$ 的方向放出去。刚才那个 $A$ 就是 $\begin{bmatrix}2\\1\end{bmatrix}\begin{bmatrix}1&2\end{bmatrix}$。

## 非方阵：在不同维度之间搬运

前面都是方阵，输入输出一样多维。$m\times n$ 的矩阵把 $n$ 维送到 $m$ 维，形状本身就说明了它在干什么：

- **$3\times2$**：两个基向量，各自落到三维空间里。平面被放进三维，成了一张斜着的平面。列空间最多二维，三维里绝大多数的 $\mathbf{b}$ 都够不着，方程组往往无解。这就是数据点比参数多的拟合问题，后面最小二乘会处理。
- **$2\times3$**：三个基向量落到平面上。三维被压成二维，零空间至少一维。把三维模型画到屏幕上，就是这一类。
- **$1\times n$**：$n$ 维送到一条数轴上，每个向量变成一个数。这是一种“测量”，下一节的点积就是它。

## 点积：把一个向量当成一把尺子

点积的定义有两个，看上去毫不相干：

$$
\mathbf{u}\cdot\mathbf{v}=u_1v_1+u_2v_2+\cdots+u_nv_n=\lVert\mathbf{u}\rVert\,\lVert\mathbf{v}\rVert\cos\theta .
$$

左边是对应相乘再相加，右边是长度乘长度再乘夹角余弦。课本一般用余弦定理证明它们相等，证完了也不知道为什么。换成变换的眼光就清楚了。

上一节说过，$1\times2$ 的矩阵把平面送到数轴上。设 $\mathbf{u}=(u_x,u_y)$ 是单位向量，考虑“把向量投影到 $\mathbf{u}$ 所在的直线上，读出投影的长度”这个操作。投影保持加法和数乘，是线性的，所以它也是一个 $1\times2$ 的矩阵。它的两列是 $\hat\imath$ 和 $\hat\jmath$ 投影之后的长度。

$\hat\imath$ 投到 $\mathbf{u}$ 上有多长？看下面这张图：$\hat\imath$ 投到 $\mathbf{u}$ 上，和 $\mathbf{u}$ 投到 $x$ 轴上，两者关于角平分线对称，一样长。后者就是 $u_x$。

```render svg title="î 投到 u 上的长度，等于 u 投到 x 轴上的长度 u_x"
<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" font-family="Inter Variable, sans-serif">
  <path d="M40 170 H300" stroke="var(--rule-strong)" stroke-width="1.2" />
  <path d="M40 170 L262 15" stroke="var(--rule-strong)" stroke-width="1.2" />
  <path d="M40 170 L192.6 121.8" stroke="var(--faint)" stroke-width="1" stroke-dasharray="2 4" />
  <path d="M240 170 L174.2 76" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 4" />
  <path d="M203.8 55.2 L203.8 170" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 4" />
  <path d="M40 170 L174.2 76" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" opacity=".45" />
  <path d="M40 170 H203.8" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" opacity=".45" />
  <g stroke-width="2.4" stroke-linecap="round">
    <path d="M40 170 H232" stroke="var(--accent)" />
    <path d="M40 170 L197 60" stroke="currentColor" />
  </g>
  <path d="M240 170 L229 164 L229 176 Z" fill="var(--accent)" />
  <path d="M203.8 55.2 L193 57 L199.6 66.5 Z" fill="currentColor" />
  <g font-size="16" font-weight="600">
    <text x="246" y="176" fill="var(--accent-ink)">î</text>
    <text x="205" y="48" fill="currentColor">u</text>
  </g>
  <g font-size="12" fill="var(--muted)">
    <text x="94" y="112" transform="rotate(-35 94 112)">长 uₓ</text>
    <text x="108" y="188">长 uₓ</text>
  </g>
  <g font-size="14" fill="currentColor">
    <text x="320" y="82">î 投到 u 上 → 长 uₓ</text>
    <text x="320" y="108">ĵ 投到 u 上 → 长 uᵧ</text>
    <text x="320" y="142" fill="var(--accent-ink)" font-weight="600">“投到 u 上”这个变换</text>
    <text x="320" y="164" fill="var(--accent-ink)" font-weight="600">的矩阵就是 [uₓ  uᵧ]</text>
  </g>
</svg>
```

同理，$\hat\jmath$ 投过去长 $u_y$。所以“投影到 $\mathbf{u}$ 上”的矩阵就是 $\begin{bmatrix}u_x&u_y\end{bmatrix}$，作用在 $\mathbf{v}$ 上，算出来正是 $u_xv_x+u_yv_y$。**对应相乘再相加，算的就是 $\mathbf{v}$ 在 $\mathbf{u}$ 方向上的投影长度**，也就是 $\lVert\mathbf{v}\rVert\cos\theta$。$\mathbf{u}$ 不是单位向量时，结果再乘上 $\lVert\mathbf{u}\rVert$。两个定义就这样接上了。

这里藏着一个更深的对应：每个向量 $\mathbf{u}$ 都有一个孪生的线性函数 $\mathbf{v}\mapsto\mathbf{u}\cdot\mathbf{v}$，它的矩阵就是把 $\mathbf{u}$ 躺下来写成一行，$\mathbf{u}^\top$。反过来，任何一个从 $\mathbb{R}^n$ 到数轴的线性函数，都是和某个固定向量做点积。**向量和“测量”一一对应**，这叫对偶。

写代码的人可以这样理解：点积是一个两个参数的函数，柯里化之后，`dot(u)` 就是一把尺子。

```ts
const dot = (u: Vec) => (v: Vec): number => u.reduce((s, x, i) => s + x * v[i], 0);

const ruler = dot([0.6, 0.8]); // 一把沿 (0.6, 0.8) 方向量长度的尺子
ruler([3, 4]);                 // 5
```

列向量躺下来变成行向量，就是把“一个东西”变成“沿这个东西的方向量长度的函数”。

点积的符号也很有用：同向为正，垂直为 0，反向为负。

- 图形学里的漫反射光照，亮度正比于 $\max(0,\mathbf{n}\cdot\mathbf{l})$：表面法向 $\mathbf{n}$ 正对光源方向 $\mathbf{l}$ 最亮，侧过去变暗，背过去全黑。
- 推荐系统、搜索里的“余弦相似度”，就是把两个向量归一化之后点积，看方向有多接近。
- [Transformer 的注意力](/posts/transformer/)用 $q\cdot k$ 打分，也是在量两个向量对得有多准。

### 转置和正交矩阵

$\mathbf{u}^\top$ 是把一个向量变成一把尺子，矩阵的转置 $A^\top$ 也有类似的含义：它满足

$$
(A\mathbf{x})\cdot\mathbf{y}=\mathbf{x}\cdot(A^\top\mathbf{y}).
$$

先用 $A$ 把 $\mathbf{x}$ 变过去再用 $\mathbf{y}$ 去量，等于把尺子 $\mathbf{y}$ 用 $A^\top$ 拉回来，直接量原来的 $\mathbf{x}$。

旋转和镜像不改变长度和夹角，所以不改变点积：$(Q\mathbf{x})\cdot(Q\mathbf{y})=\mathbf{x}\cdot\mathbf{y}$。代进上式就得到 $Q^\top Q=I$，也就是

$$
Q^{-1}=Q^\top .
$$

满足这个条件的叫正交矩阵，它的各列是互相垂直的单位向量。旋转的逆矩阵不用算，转置一下就有了。游戏引擎每帧都要用到相机矩阵的逆，靠的就是这个。

## 叉积：把“体积函数”认成一个向量

先看二维。两个平面向量 $\mathbf{v}$、$\mathbf{w}$ 的“叉积”，是它们围成的平行四边形的有向面积：

$$
\mathbf{v}\times\mathbf{w}=v_xw_y-v_yw_x=\det\begin{bmatrix}v_x&w_x\\v_y&w_y\end{bmatrix}.
$$

正号表示 $\mathbf{w}$ 在 $\mathbf{v}$ 的逆时针一侧，负号表示顺时针一侧。写过计算几何的人天天用它：判断点在线段的哪一边、求凸包、判断两条线段是否相交，核心都是这一行：

```cpp
// > 0：b 在 o→a 的左边；< 0：右边；= 0：三点共线
long long cross(P o, P a, P b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
```

多边形面积的鞋带公式 $\frac12\left|\sum_i(x_iy_{i+1}-x_{i+1}y_i)\right|$，也只是把多边形从原点切成一个个三角形，把它们的有向面积加起来，多出来的部分正负抵消。

三维的叉积 $\mathbf{v}\times\mathbf{w}$ 是一个向量：垂直于 $\mathbf{v}$ 和 $\mathbf{w}$，长度等于它们围成的平行四边形面积，方向按右手定则。计算公式通常写成一个奇怪的行列式：

$$
\mathbf{v}\times\mathbf{w}=\det\begin{bmatrix}\hat\imath&v_x&w_x\\\hat\jmath&v_y&w_y\\\hat k&v_z&w_z\end{bmatrix}.
$$

第一列放的是基向量，不是数。这算什么行列式？为什么算出来正好垂直，长度正好是面积？

答案就在上一节的对偶里。固定 $\mathbf{v}$、$\mathbf{w}$，看这个函数：

$$
f(\mathbf{x})=\det\begin{bmatrix}\mathbf{x}&\mathbf{v}&\mathbf{w}\end{bmatrix},
$$

它是 $\mathbf{x}$、$\mathbf{v}$、$\mathbf{w}$ 围成的平行六面体的有向体积。行列式对每一列都是线性的，所以 $f$ 是从三维到数轴的线性函数。按对偶，它一定等于和某个固定向量 $\mathbf{p}$ 做点积：$f(\mathbf{x})=\mathbf{p}\cdot\mathbf{x}$。这个 $\mathbf{p}$ 就是 $\mathbf{v}\times\mathbf{w}$。

它为什么垂直、为什么长度是面积，从体积公式就能看出来。平行六面体的体积是底面积乘高：底是 $\mathbf{v}$、$\mathbf{w}$ 围成的平行四边形，高是 $\mathbf{x}$ 在垂直于底面方向上的分量。而 $\mathbf{p}\cdot\mathbf{x}$ 是 $\mathbf{x}$ 在 $\mathbf{p}$ 方向上的投影长度乘以 $\lVert\mathbf{p}\rVert$。要让这两者对每一个 $\mathbf{x}$ 都相等，$\mathbf{p}$ 只能垂直于底面，长度只能等于底面积。

那个奇怪的行列式，也只是把 $f(\mathbf{x})$ 按 $\mathbf{x}$ 那一列展开，$\mathbf{x}$ 的三个分量的系数就是 $\mathbf{p}$ 的三个分量；把 $\hat\imath,\hat\jmath,\hat k$ 填进去，是“这里等着放 $x,y,z$”的记号。展开是：

$$
\mathbf{v}\times\mathbf{w}=(v_yw_z-v_zw_y,\;v_zw_x-v_xw_z,\;v_xw_y-v_yw_x).
$$

拖动画面可以转视角。$\mathbf{w}$ 绕着转一圈，看 $\mathbf{v}\times\mathbf{w}$ 的长短和朝向；再点“加上 x”，看体积怎么变成点积：

```render html title="叉积：垂直于底面，长度等于底面积"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .bar label { display: flex; flex: 1; min-width: 180px; align-items: center; gap: 10px; color: var(--muted); font-size: 12px; }
  .bar input { flex: 1; min-width: 0; accent-color: var(--accent); }
  canvas { display: block; width: 100%; margin-top: 8px; cursor: grab; touch-action: pan-y; }
  canvas:active { cursor: grabbing; }
  .read { display: grid; gap: 2px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
  .i { color: var(--accent-ink); } .j { color: var(--blue); } .x { color: var(--muted); }
</style>
<section class="la" aria-label="三维叉积演示">
  <div class="bar">
    <button type="button" class="key pause">暂停</button>
    <button type="button" class="key vol" aria-pressed="false">加上 x</button>
    <label><span>w 的方向</span><input type="range" min="0" max="628" value="110" aria-label="w 绕竖轴转过的角度" /></label>
  </div>
  <canvas role="img"></canvas>
  <div class="read"></div>
</section>
<script>
const root = document.querySelector('.la');
const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), pauseBtn = root.querySelector('.pause'), volBtn = root.querySelector('.vol');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 60, yaw = .55, pitch = .38, th = 1.1, running = !reduce, visible = false, vol = false, raf = 0, last = 0;
const v = [1.8, -.2, .15], x = [.5, .7, 1.5];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const num = (n) => String(Math.round(n * 100) / 100 || 0).replace('-', '−');
const vec = (p) => `(${p.map(num).join(', ')})`;
const add = (a, b) => a.map((q, k) => q + b[k]);
const mul = (c, a) => a.map((q) => c * q);
const dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(...a);
const wOf = (th) => [1.4 * Math.cos(th), 1.4 * Math.sin(th), .25];

// x 朝右、y 朝里、z 朝上；yaw 绕 z 转，pitch 是从上往下看的俯角
function P([px, py, pz]) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = px * cy - py * sy, y1 = px * sy + py * cy;
  return [W / 2 + x1 * S, H * .62 - (pz * cp + y1 * sp) * S];
}
function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0, 0]) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function label(s, at, color, dx = 8, dy = -8) {
  const [px, py] = P(at);
  ctx.fillStyle = color; ctx.font = '600 15px KaTeX_Main, serif'; ctx.fillText(s, px + dx, py + dy);
}
function face(pts, fill, alpha) {
  ctx.beginPath(); pts.map(P).forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (let k = -3; k <= 3; k++) { seg([k, -3, 0], [k, 3, 0], C.rule); seg([-3, k, 0], [3, k, 0], C.rule); }
  seg([0, 0, 0], [3.2, 0, 0], C['rule-strong'], 1.4); seg([0, 0, 0], [0, 3.2, 0], C['rule-strong'], 1.4); seg([0, 0, 0], [0, 0, 2.6], C['rule-strong'], 1.4);
  ctx.font = '12px Inter Variable, sans-serif'; ctx.fillStyle = C.faint;
  [['x', [3.4, 0, 0]], ['y', [0, 3.4, 0]], ['z', [0, 0, 2.8]]].forEach(([s, p]) => { const [px, py] = P(p); ctx.fillText(s, px - 3, py + 4); });

  const w = wOf(th), p = cross(v, w), area = len(p);
  face([[0, 0, 0], v, add(v, w), w], C.accent, .22);
  seg([0, 0, 0], v, C.accent, 1); seg(v, add(v, w), C.blue, 1, [4, 4]); seg(w, add(v, w), C.accent, 1, [4, 4]);

  let extra = '';
  if (vol) {
    const n = mul(1 / area, p), h = dotp(x, n), foot = add(x, mul(-h, n)), V = dotp(p, x);
    [[0, 0, 0], v, w, add(v, w)].forEach((q) => seg(q, add(q, x), C.muted, 1, [3, 3]));
    seg(x, add(x, v), C.muted, 1, [3, 3]); seg(x, add(x, w), C.muted, 1, [3, 3]);
    seg(add(x, v), add(add(x, v), w), C.muted, 1, [3, 3]); seg(add(x, w), add(add(x, v), w), C.muted, 1, [3, 3]);
    face([x, add(x, v), add(add(x, v), w), add(x, w)], C.muted, .08);
    seg(x, foot, C.text, 1.6, [5, 4]);
    arrow(x, C.muted, 2.2); label('x', x, C.muted);
    extra = `<span><small>体积 = 底面积 × 高 = </small>${num(area)} × ${num(h)} = ${num(area * h)}</span><span><small>(v×w)·x = </small>${num(V)}<small>，两者相等</small></span>`;
  }
  arrow(v, C.accent); arrow(w, C.blue); arrow(p, C.text, 2.8);
  label('v', v, C['accent-ink']); label('w', w, C.blue); label('v×w', p, C.text);

  const ang = Math.acos(Math.max(-1, Math.min(1, dotp(v, w) / len(v) / len(w))));
  root.querySelector('.read').innerHTML =
    `<span><small>v×w = </small>${vec(p)}</span>` +
    `<span><small>长度 = </small>${num(area)}<small> = |v|·|w|·sin θ = </small>${num(len(v))} × ${num(len(w))} × ${num(Math.sin(ang))}</span>` + extra;
  cv.setAttribute('aria-label', `v×w = ${vec(p)}，长度 ${num(area)}`);
  range.value = Math.round(((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 100);
}

function loop(now) {
  if (last) th += (now - last) / 1000 * .6;
  last = now; draw();
  raf = running && visible ? requestAnimationFrame(loop) : 0;
}
function kick() { if (running && visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } }
pauseBtn.addEventListener('click', () => { running = !running; pauseBtn.textContent = running ? '暂停' : '继续'; if (!running) { cancelAnimationFrame(raf); raf = 0; } kick(); });
volBtn.addEventListener('click', () => { vol = !vol; volBtn.setAttribute('aria-pressed', String(vol)); draw(); });
range.addEventListener('input', () => { running = false; pauseBtn.textContent = '继续'; cancelAnimationFrame(raf); raf = 0; th = range.value / 100; draw(); });

let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw = drag[2] - (e.clientX - drag[0]) * .01;
  pitch = Math.max(-.1, Math.min(1.3, drag[3] + (e.clientY - drag[1]) * .01));
  draw();
});
cv.addEventListener('pointerup', () => { drag = null; });
if (reduce) { pauseBtn.textContent = '继续'; }

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(280, Math.min(380, W * .6)));
  S = Math.min(W / 7, H / 5);
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(cv);
new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { threshold: .3 }).observe(cv);
</script>
```

$\mathbf{w}$ 转到和 $\mathbf{v}$ 共线时，平行四边形压成一条线，$\mathbf{v}\times\mathbf{w}$ 缩成零；转过去之后，它从另一侧伸出来。打开 $\mathbf{x}$ 之后，“底面积乘高”和“$(\mathbf{v}\times\mathbf{w})\cdot\mathbf{x}$”两个数始终相等，这就是叉积的定义本身。

叉积在图形学里随处可见。三角形的法向量是两条边的叉积，光照要用它；顶点按逆时针还是顺时针排列，决定了法向朝外还是朝里，渲染时据此剔除背对相机的面。相机的“右方向”也是用视线方向和“上方向”做叉积求出来的。物理里的力矩、角动量、洛伦兹力，都是叉积。

## 基变换：翻译，干活，再翻译回来

回到第一张图里那组基 $\mathbf{b}_1=(2,1)$、$\mathbf{b}_2=(-1,1)$。假设有人习惯用它描述一切，他说的 $(1,1)$，是我们的 $(1,2)$。

怎么把他的坐标翻译成我们的？他的 $(c_1,c_2)$ 意思是 $c_1\mathbf{b}_1+c_2\mathbf{b}_2$，用我们的坐标算出来就行。这正是一次矩阵乘法：

$$
P=\begin{bmatrix}2&-1\\1&1\end{bmatrix},\qquad
P\begin{bmatrix}1\\1\end{bmatrix}=\begin{bmatrix}1\\2\end{bmatrix}.
$$

$P$ 的两列是他的基向量用我们的语言写下来的样子。$P$ 把他的话翻成我们的话，$P^{-1}$ 把我们的话翻成他的话。

现在想把“逆时针转 90°”告诉他。在我们这边，它的矩阵是 $M=\begin{bmatrix}0&-1\\1&0\end{bmatrix}$；在他那边是什么？他给出一个向量，先用 $P$ 翻译成我们的坐标，用 $M$ 转一下，再用 $P^{-1}$ 翻回去：

$$
P^{-1}MP=\frac13\begin{bmatrix}1&1\\-1&2\end{bmatrix}\begin{bmatrix}0&-1\\1&0\end{bmatrix}\begin{bmatrix}2&-1\\1&1\end{bmatrix}=\frac13\begin{bmatrix}1&-2\\5&-1\end{bmatrix}.
$$

同样从右往左读：翻译，干活，翻译回来。

数看上去面目全非，描述的却是同一个旋转。验证一下：它的行列式是 $\frac19(-1+10)=1$，迹（对角线之和）是 0，和 $M$ 一模一样。行列式、迹、秩、特征值，这些是变换本身的属性，不随描述它的语言改变。$P^{-1}MP$ 和 $M$ 叫相似矩阵，就是同一个变换在不同坐标系下的两张照片。

这个模式在编程里到处都是：要对本地时间做一个只支持 UTC 的计算，先转成 UTC，算完再转回本地时间；要给摄氏度用一个写死华氏度的公式，先换算过去，算完再换回来。$P^{-1}MP$ 就是 `decode ∘ f ∘ encode`。

基变换的意义在于：同一个变换，在某些基下看会特别简单。哪组基最简单？下一节回答。

## 特征向量：变换里不转向的方向

看一个变换时，盯住一支向量和它所在的那条过原点的直线。大多数向量变换完都离开了这条直线，被转到了别的方向上。但总有一些特殊的向量，变换之后还在原来那条线上，只是被拉长、缩短，或者掉了个头：

$$
A\mathbf{v}=\lambda\mathbf{v}.
$$

这样的 $\mathbf{v}$ 叫特征向量，$\lambda$ 叫特征值，就是它被拉伸的倍数。$\lambda$ 为负表示掉头，为 0 表示被压没了，也就是落在零空间里。

点播放，看哪些箭头一直待在自己的直线上：

```render html title="特征向量：变换前后方向不变的那些向量"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 32px; height: 32px; margin: -16px 0 0 -16px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 10px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); }
  .knob:active { cursor: grabbing; }
  .knob:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
  .read { margin: 6px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
  .note { margin: 2px 0 0; min-height: 3em; color: var(--muted); }
  .l1 { color: var(--accent-ink); } .l2 { color: var(--blue); }
</style>
<section class="la" aria-label="特征向量演示">
  <div class="bar">
    <div class="seg" role="group" aria-label="例子">
      <button type="button" data-p="0" aria-pressed="true">两个方向</button>
      <button type="button" data-p="1" aria-pressed="false">对称</button>
      <button type="button" data-p="2" aria-pressed="false">剪切</button>
      <button type="button" data-p="3" aria-pressed="false">旋转</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <p class="read"></p>
  <p class="note" aria-live="polite"></p>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0;
const presets = [{ m: [3, 1, 0, 2] }, { m: [2, 1, 1, 2] }, { m: [1, 1, 0, 1] }, { m: [0, -1, 1, 0], rot: Math.PI / 2 }];
let A = presets[0].m.slice(), rot, E;
const RING = 1.15, N = 32;

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });
function M(t) {
  const e = ease(t);
  if (rot !== undefined) { const c = Math.cos(rot * e), s = Math.sin(rot * e); return [c, -s, s, c]; }
  return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e];
}

// λ² − (a+d)λ + (ad−bc) = 0，λ = m ± √(m² − p)
function eig([a, b, c, d]) {
  const m = (a + d) / 2, p = a * d - b * c, disc = m * m - p;
  if (disc < -1e-9) return { m, p, disc, list: [] };
  const r = Math.sqrt(Math.max(0, disc)), list = [];
  for (const l of r < 1e-6 ? [m] : [m + r, m - r]) {
    const n1 = Math.hypot(a - l, b), n2 = Math.hypot(c, d - l);
    if (Math.max(n1, n2) < 1e-9) { list.push({ l, all: true }); continue; }
    const v = n1 >= n2 ? [b, l - a] : [l - d, c], n = Math.hypot(...v);
    list.push({ l, v: [v[0] / n, v[1] / n] });
  }
  return { m, p, disc, list };
}

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0], head = 12) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(head, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function grid(m, color, axis) {
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) * 3;
  for (let k = -R; k <= R; k++) {
    seg(ap(m, [k, -R]), ap(m, [k, R]), k ? color : axis, k ? 1 : 1.6);
    seg(ap(m, [-R, k]), ap(m, [R, k]), k ? color : axis, k ? 1 : 1.6);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .3; grid(m, C.muted, C.muted); ctx.globalAlpha = 1;

  const all = E.list.some((e) => e.all), cols = [C.accent, C.blue], inks = [C['accent-ink'], C.blue];
  // 特征方向：整条线在变换前后都不动
  E.list.forEach((e, k) => {
    if (!e.v) return;
    seg([-40 * e.v[0], -40 * e.v[1]], [40 * e.v[0], 40 * e.v[1]], cols[k], 1.4, [6, 5]);
    const reach = Math.min(W / 2 / Math.abs(e.v[0] * S || 1e-9), H / 2 / Math.abs(e.v[1] * S || 1e-9)) - .5, sgn = e.v[1] < -1e-9 || (Math.abs(e.v[1]) < 1e-9 && e.v[0] < 0) ? -1 : 1;
    const [lx, ly] = P([sgn * reach * e.v[0], sgn * reach * e.v[1]]);
    ctx.fillStyle = inks[k]; ctx.font = '600 13px Inter Variable, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`λ = ${num(e.l)}`, Math.max(36, Math.min(W - 36, lx + 30)), Math.max(16, Math.min(H - 8, ly - 8))); ctx.textAlign = 'start';
  });
  const samples = [];
  for (let k = 0; k < N; k++) samples.push({ u: [RING * Math.cos(2 * Math.PI * k / N + .05), RING * Math.sin(2 * Math.PI * k / N + .05)] });
  E.list.forEach((e, k) => { if (e.v) for (const s of [1, -1]) samples.push({ u: [s * RING * e.v[0], s * RING * e.v[1]], eig: k }); });
  for (const s of samples) {
    if (s.eig !== undefined || all) continue;
    ctx.globalAlpha = .55; arrow(ap(m, s.u), C.muted, 1.4, [0, 0], 7); ctx.globalAlpha = 1;
  }
  for (const s of samples) {
    if (s.eig === undefined && !all) continue;
    arrow(ap(m, s.u), all ? C.accent : cols[s.eig], 2.8);
  }
  knobs.forEach((k) => k.place());

  const read = root.querySelector('.read'), note = root.querySelector('.note');
  read.innerHTML = `<small>λ² − ${num(2 * E.m)}λ + ${num(E.p)} = 0　→　</small>` +
    (E.disc < -1e-9 ? `λ = ${num(E.m)} ± ${num(Math.sqrt(-E.disc))}i` : E.list.map((e, k) => `<span class="l${k + 1}">λ${E.list.length > 1 ? '₁₂'[k] : ''} = ${num(e.l)}</span>`).join('　'));
  note.textContent = E.disc < -1e-9
    ? '没有实数特征值：每一支箭头都被转走了，没有哪条直线留在原地。'
    : all ? '每一支箭头都只是被拉长：这是一个纯粹的缩放，所有方向都是特征方向。'
      : E.list.length === 1 ? '只有一条特征直线：其余箭头都被推歪了。特征向量凑不齐一组基。'
        : '两条虚线上的箭头只被拉伸，其余的都被转离了自己原来的方向。';
  cv.setAttribute('aria-label', note.textContent);
}

function setA(m, r) { A = m.slice(); rot = r; E = eig(A); }
function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 300;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1800)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => { cancelAnimationFrame(raf); t = 1; const m = M(1); set(m, p); setA(m); root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', 'false')); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(snap(U(e.clientX - r.left, e.clientY - r.top))); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take(snap([p[0] + d[0] * s, p[1] + d[1] * s]));
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; } };
}
const knobs = [
  knob('i', 'î 的落点', () => { const m = M(t); return [m[0], m[2]]; }, (m, p) => { m[0] = p[0]; m[2] = p[1]; }),
  knob('j', 'ĵ 的落点', () => { const m = M(t); return [m[1], m[3]]; }, (m, p) => { m[1] = p[0]; m[3] = p[1]; }),
];
root.querySelectorAll('[data-p]').forEach((btn) => btn.addEventListener('click', () => {
  const p = presets[Number(btn.dataset.p)];
  setA(p.m, p.rot);
  root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
  play();
}));
root.querySelector('.play').addEventListener('click', play);

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(270, Math.min(380, W * .6)));
  S = H / 8.4;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
setA(A);
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

第一个例子 $A=\begin{bmatrix}3&1\\0&2\end{bmatrix}$ 有两条特征直线。$x$ 轴上的向量被拉长 3 倍：$A(1,0)=(3,0)$。过 $(-1,1)$ 的那条线上的向量被拉长 2 倍：$A(-1,1)=(-2,2)$。其余的箭头，全都被转离了原来的方向。

### 怎么求

$A\mathbf{v}=\lambda\mathbf{v}$ 可以改写成 $(A-\lambda I)\mathbf{v}=\mathbf{0}$。要有非零的 $\mathbf{v}$ 满足它，$A-\lambda I$ 就必须把某个方向压成零，也就是把空间压扁：

$$
\det(A-\lambda I)=0 .
$$

前面几节的东西在这里全接上了：**特征向量就是 $A-\lambda I$ 的零空间，特征值就是让 $A-\lambda I$ 行列式为零的那些 $\lambda$。**

二阶矩阵展开是 $\lambda^2-(a+d)\lambda+(ad-bc)=0$。$a+d$ 是迹，$ad-bc$ 是行列式。所以两个特征值之和等于迹，之积等于行列式。设 $m$ 是迹的一半、$p$ 是行列式，直接有

$$
\lambda=m\pm\sqrt{m^2-p}.
$$

$A=\begin{bmatrix}3&1\\0&2\end{bmatrix}$：$m=2.5$，$p=6$，$\lambda=2.5\pm\sqrt{0.25}$，即 3 和 2。

特征值之积等于行列式，也能从画面里看出来：沿两个特征方向各拉伸 $\lambda_1$、$\lambda_2$ 倍，面积自然放大 $\lambda_1\lambda_2$ 倍。

另外几个例子各有看头：

- **旋转**没有实特征向量，每支箭头都被转走了。算出来 $\lambda^2+1=0$，$\lambda=\pm i$。复数特征值就是旋转的信号：特征值 $re^{\pm i\theta}$ 意味着在一组合适的基下看，这个变换是转 $\theta$ 再放大 $r$ 倍。复平面上乘以 $i$ 正好是逆时针转 90°，和这个矩阵干的是同一件事。
- **剪切**只有一条特征直线，$\lambda=1$ 是重根。特征向量凑不齐一组基，这种矩阵不能对角化，是所有“不能对角化”的矩阵的原型。
- **纯缩放** $2I$ 让每个向量都变成两倍长，所有方向都是特征方向。

## 对角化：换到特征基里看

如果特征向量凑得齐一组基，就用它们当基。在这组基下，变换只是沿着每根坐标轴各自拉伸，没有任何旋转和剪切，矩阵是对角的：

$$
A=PDP^{-1},\qquad
P=\begin{bmatrix}1&-1\\0&1\end{bmatrix},\quad
D=\begin{bmatrix}3&0\\0&2\end{bmatrix}.
$$

$P$ 的两列就是两个特征向量。从右往左读还是那句话：先翻译到特征基，各轴拉伸，再翻译回来。上一节问的“哪组基最简单”，答案就是这组。

好处在于连乘。$A$ 做 100 次，中间的 $P^{-1}P$ 两两抵消：

$$
A^{100}=PD^{100}P^{-1},\qquad D^{100}=\begin{bmatrix}3^{100}&0\\0&2^{100}\end{bmatrix}.
$$

同一个变换重复 100 次，在特征基里就是每根轴各自重复拉伸 100 次。

### 斐波那契数列

写过矩阵快速幂的人对这个矩阵不陌生：

$$
\begin{bmatrix}F_{n+1}\\F_n\end{bmatrix}=\begin{bmatrix}1&1\\1&0\end{bmatrix}\begin{bmatrix}F_n\\F_{n-1}\end{bmatrix}.
$$

快速幂能在 $O(\log n)$ 次乘法内算出 $A^n$。特征值则能给出一个通项公式。

$\lambda^2-\lambda-1=0$，两个根是黄金比例 $\varphi=\frac{1+\sqrt5}2\approx1.618$ 和 $\psi=\frac{1-\sqrt5}2\approx-0.618$，对应的特征向量是 $(\varphi,1)$ 和 $(\psi,1)$。起点 $(F_1,F_0)=(1,0)$ 拆成两个特征向量的组合：

$$
\begin{bmatrix}1\\0\end{bmatrix}=\frac1{\sqrt5}\left(\begin{bmatrix}\varphi\\1\end{bmatrix}-\begin{bmatrix}\psi\\1\end{bmatrix}\right).
$$

乘 $n$ 次 $A$，两部分各自乘上 $\varphi^n$ 和 $\psi^n$，看第二个分量：

$$
F_n=\frac{\varphi^n-\psi^n}{\sqrt5}.
$$

满是无理数的式子，算出来每一项都是整数。而且 $|\psi|<1$，$\psi^n$ 很快趋于 0，所以 $F_n$ 就是 $\varphi^n/\sqrt5$ 四舍五入，相邻两项之比趋于 $\varphi$。

### 反复作用：一切都被拉向主特征向量

斐波那契里藏着一个更普遍的现象。随便拿一个向量，拆成两个特征向量的组合，每乘一次 $A$，$\varphi$ 那部分放大 1.618 倍，$\psi$ 那部分缩小到 0.618 倍还换个符号。乘几次之后，$\psi$ 那部分就可以忽略了，向量几乎完全躺在 $\varphi$ 的特征方向上。

下面是十几支方向各异的向量，每次都乘上斐波那契矩阵。箭头只画方向，长度统一：

```render html title="反复乘同一个矩阵，方向都被拉向主特征向量"
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key:disabled { opacity: .5; cursor: default; }
  .count { margin-left: auto; color: var(--muted); font: 13px var(--font-mono); }
  canvas { display: block; width: 100%; margin-top: 8px; }
  .read { display: grid; gap: 2px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
</style>
<section class="la" aria-label="幂迭代演示：反复乘斐波那契矩阵">
  <div class="bar">
    <button type="button" class="key once">再乘一次 A</button>
    <button type="button" class="key auto">连续乘</button>
    <button type="button" class="key reset">重来</button>
    <span class="count"></span>
  </div>
  <canvas role="img"></canvas>
  <div class="read" aria-live="polite"></div>
</section>
<script>
const root = document.querySelector('.la');
const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
const A = [1, 1, 1, 0], phi = (1 + Math.sqrt(5)) / 2, psi = (1 - Math.sqrt(5)) / 2;
const e1 = [phi, 1].map((x) => x / Math.hypot(phi, 1)), e2 = [psi, 1].map((x) => x / Math.hypot(psi, 1));
const K = 15;
let W = 0, H = 0, S = 40, n = 0, vs, from, e = 1, raf = 0, auto = 0;

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x, d = 3) => String(Math.round(x * 10 ** d) / 10 ** d || 0).replace('-', '−');
const ang = ([x, y]) => Math.atan2(y, x);
// 和主特征直线的夹角，0° 到 90°
const off = (v) => Math.acos(Math.min(1, Math.abs(v[0] * e1[0] + v[1] * e1[1]) / Math.hypot(...v))) * 180 / Math.PI;

function reset() {
  n = 0; e = 1;
  vs = [[1, 0]];
  for (let k = 1; k < K; k++) { const a = 2 * Math.PI * k / K + .23; vs.push([Math.cos(a), Math.sin(a)]); }
  from = vs.map((v) => v.slice());
}
function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6) {
  const [x1, y1] = P([0, 0]), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = 11, bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1, r0 = 3;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  seg([-R, 0], [R, 0], C['rule-strong'], 1.4); seg([0, -R], [0, R], C['rule-strong'], 1.4);
  seg(e1.map((x) => -40 * x), e1.map((x) => 40 * x), C.accent, 1.4, [6, 5]);
  seg(e2.map((x) => -40 * x), e2.map((x) => 40 * x), C.blue, 1.4, [6, 5]);
  ctx.font = '600 13px Inter Variable, sans-serif';
  const [ax, ay] = P(e1.map((x) => 3.9 * x)), [bx, by] = P(e2.map((x) => 3.6 * x));
  ctx.fillStyle = C['accent-ink']; ctx.fillText('λ = φ ≈ 1.618', ax + 8, ay + 4);
  ctx.fillStyle = C.blue; ctx.textAlign = 'right'; ctx.fillText('λ = ψ ≈ −0.618', bx - 8, by + 4); ctx.textAlign = 'start';

  const k = ease(e);
  vs.forEach((v, idx) => {
    const a0 = ang(from[idx]), a1 = ang(v);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
    const a = a0 + d * k, tip = [r0 * Math.cos(a), r0 * Math.sin(a)];
    if (idx) arrow(tip, off(v) < 1.5 && e === 1 ? C.accent : C.muted, 1.6);
  });
  const v0 = vs[0], a0 = ang(from[0]); let d = ang(v0) - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
  arrow([r0 * Math.cos(a0 + d * k), r0 * Math.sin(a0 + d * k)], C.text, 2.8);

  const worst = Math.max(...vs.map(off));
  root.querySelector('.count').textContent = `已经乘了 ${n} 次`;
  root.querySelector('.read').innerHTML =
    `<span><small>黑色那支从 (1, 0) 出发，现在是 </small>(${v0[0]}, ${v0[1]})${n ? `<small>，比值 </small>${num(v0[0] / v0[1], 6)}` : ''}</span>` +
    `<span><small>离橙色虚线最远的一支，还差 </small>${num(worst, 2)}°</span>`;
  root.querySelector('.once').disabled = n >= 30;
  cv.setAttribute('aria-label', `乘了 ${n} 次，最远的一支与主特征方向差 ${num(worst, 2)} 度`);
}

function step(done) {
  if (n >= 30) return done && done();
  from = vs.map((v) => v.slice()); vs = vs.map((v) => ap(A, v)); n++;
  cancelAnimationFrame(raf);
  if (reduce) { e = 1; draw(); return done && done(); }
  const t0 = performance.now();
  const go = (now) => { e = Math.min(1, (now - t0) / 650); draw(); if (e < 1) raf = requestAnimationFrame(go); else if (done) done(); };
  e = 0; raf = requestAnimationFrame(go);
}
function run(times) {
  clearTimeout(auto);
  const next = (left) => { if (left > 0) step(() => { auto = setTimeout(() => next(left - 1), 250); }); };
  next(times);
}
root.querySelector('.once').addEventListener('click', () => { clearTimeout(auto); step(); });
root.querySelector('.auto').addEventListener('click', () => run(8));
root.querySelector('.reset').addEventListener('click', () => { clearTimeout(auto); cancelAnimationFrame(raf); reset(); draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(340, W * .55)));
  S = H / 8;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
reset();
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(cv);
new IntersectionObserver(([en], o) => { if (en.isIntersecting) { o.disconnect(); setTimeout(() => run(6), 400); } }, { threshold: .6 }).observe(cv);
</script>
```

乘上五六次，所有箭头就都贴到了橙色虚线上；每多乘一次，剩下的偏差大约缩小到原来的 $|\psi/\varphi|\approx0.38$ 倍。黑色那支的坐标就是 $(F_{n+1},F_n)$，比值很快逼近 1.618。唯一的例外是恰好落在蓝线上的向量，它没有 $\varphi$ 的成分，只会越缩越短。

这个现象叫幂迭代：**同一个变换反复作用，几乎任何起点都会被拉向特征值绝对值最大的那个特征向量。** 收敛快慢取决于第二大和最大特征值之比。

### PageRank：网页的重要性是一个特征向量

早期 Google 给网页排序的 PageRank，就是这个现象的一次大规模应用。

想象一个人在网上随便点链接。每个网页把自己的“重要性”平均分给它链接到的那些网页，一个网页的重要性，等于所有指向它的网页分给它的总和。把所有网页的重要性排成一个向量 $\mathbf{r}$，链接关系排成矩阵 $M$，这句话写出来是：

$$
\mathbf{r}=M\mathbf{r}.
$$

**重要性向量，就是链接矩阵特征值为 1 的那个特征向量。** 实际的网络里有两个麻烦：有的网页没有出链，重要性无处可去；有的网页围成小圈子，进去就出不来。PageRank 的处理是：没有出链的网页，当作链接到所有网页；另外让这个人有 15% 的概率不点链接，随机跳到任意一个网页：$G=0.85\,M+\frac{0.15}{N}\mathbf{1}\mathbf{1}^\top$。这样 $G$ 的每个元素都是正数，每一列加起来都是 1。Perron–Frobenius 定理保证这样的矩阵有唯一一个每个分量都为正的特征向量；每列和为 1，又保证它对应的特征值正好是 1，而且是最大的。

怎么算？就是上面那张图：随便给一个初始向量，反复乘 $G$，几十次就收敛了。几十亿个网页，矩阵大到根本存不下，但每次只需要算 $G\mathbf{r}$，而这一步只要顺着链接把数加一遍。这里“矩阵是函数”的眼光又派上了用场：很多大规模算法从来不把矩阵存成表，只需要一个能算 $\mathbf{v}\mapsto A\mathbf{v}$ 的函数。

马尔可夫链的平稳分布也是同一件事：状态转移矩阵特征值为 1 的特征向量。

### 微分方程：特征值决定命运

连续时间里的反复作用，是微分方程 $\frac{\mathrm{d}\mathbf{x}}{\mathrm{d}t}=A\mathbf{x}$。在特征基里，它拆成互不相干的几个一维方程 $\frac{\mathrm{d}c_k}{\mathrm{d}t}=\lambda_kc_k$，解是 $c_k(t)=c_k(0)e^{\lambda_kt}$。

于是系统的命运由特征值决定：实部为正的成分指数增长，为负的衰减，有虚部的会振荡。弹簧、电路、人口模型、控制系统，判断它稳不稳定，就是看特征值落在复平面的哪一边。

## 对称矩阵：互相垂直的特征轴

满足 $A^\top=A$ 的矩阵叫对称矩阵。它们有一个漂亮的性质，叫谱定理：**特征值都是实数，而且总能找到一组互相垂直的单位特征向量。**

$$
A=Q\Lambda Q^\top ,
$$

$Q$ 是正交矩阵，$\Lambda$ 是对角的。几何上，对称矩阵就是沿着几根互相垂直的轴各自拉伸，没有一点旋转或剪切。前面的“对称”例子 $\begin{bmatrix}2&1\\1&2\end{bmatrix}$ 就是这样：沿 $(1,1)$ 拉伸 3 倍，沿 $(1,-1)$ 保持不变，两条特征直线正好垂直。

对称矩阵在应用里随处可见：

- 数据的协方差矩阵是对称的，它的特征向量是数据散得最开的方向，这就是主成分分析（PCA）。
- 多元函数的二阶导数矩阵（Hessian）是对称的。在梯度为零的点上，特征值全正，函数在这里像一只碗，是极小值；有正有负，就是马鞍面。优化算法关心的“病态”，就是最大和最小特征值差得太远，碗被压成了一道又窄又长的山谷。
- 特征值全正时，$\mathbf{x}^\top A\mathbf{x}=1$ 画出来是一个椭圆（或椭球），主轴沿着特征向量，半轴长 $1/\sqrt{\lambda}$；有正有负就成了双曲线。

还有一个对称矩阵来得毫不费力：对任何矩阵 $A$，$A^\top A$ 都是对称的。这是下一节的入口。

## 奇异值分解：任何矩阵都只是转、拉、转

特征值分解有它的局限：旋转没有实特征向量，剪切凑不齐一组基，非方阵连特征值都没有。有没有一种对任何矩阵都管用的拆法？

有，叫奇异值分解（SVD）：

$$
A=U\Sigma V^\top .
$$

$V^\top$ 和 $U$ 都是旋转（或者带一次镜像），$\Sigma$ 是对角的，对角线上的 $\sigma_1\ge\sigma_2\ge\cdots\ge0$ 叫奇异值。**任何线性变换，都可以拆成：先转一下，沿坐标轴拉伸，再转一下。**

几何上看最清楚：单位圆经过任何可逆变换都变成一个椭圆（压扁的变换会把它变成线段或一个点）。$\sigma_1$、$\sigma_2$ 是椭圆的两个半轴长，$V$ 的列是输入里那两个互相垂直、恰好被送到椭圆主轴上的方向，$U$ 的列是主轴本身的方向。

剪切看上去和“转、拉、转”毫无关系，拆开看看：

```render html title="奇异值分解：转、拉、转"
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 30px; height: 30px; margin: -15px 0 0 -15px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; color: var(--muted); }
  .knob::after { content: ""; position: absolute; inset: 10px; border: 1.6px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob:active { cursor: grabbing; }
  .knob:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
  .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
  .steps div { padding: 6px 10px; border-top: 2px solid var(--rule); color: var(--faint); transition: color .2s, border-color .2s; }
  .steps div.on { border-color: var(--accent); color: var(--text); }
  .steps b { display: block; font: 600 14px var(--font-mono); }
  .steps span { font-size: 12px; }
  .scrub { display: flex; align-items: center; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
</style>
<section class="la" aria-label="奇异值分解演示">
  <div class="bar">
    <div class="seg" role="group" aria-label="例子">
      <button type="button" data-p="0" aria-pressed="true">剪切</button>
      <button type="button" data-p="1" aria-pressed="false">对称</button>
      <button type="button" data-p="2" aria-pressed="false">随便一个</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <label class="scrub"><span>进度</span><input type="range" min="0" max="3000" value="3000" aria-label="分解的进度" /></label>
  <div class="steps"></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
const presets = [[1, 1, 0, 1], [2, 1, 1, 2], [1.5, -1, .5, 1]];
let W = 0, H = 0, S = 40, T = 3, raf = 0, A = presets[0].slice(), D;

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue', 'blue-soft']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const mm = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const rot = (a) => [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const deg = (a) => `${String(Math.round(a * 180 / Math.PI) || 0).replace('-', '−')}°`;
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });

// A = rot(ph) · diag(s1, s2) · rot(−th)。v₁ 是 AᵀA 最大特征值的方向；s2 允许为负，把镜像算进去
function svd(m) {
  const [a, b, c, d] = m, p = a * a + c * c, q = a * b + c * d, r = b * b + d * d;
  const at = (th) => {
    const v1 = [Math.cos(th), Math.sin(th)], v2 = [-Math.sin(th), Math.cos(th)], A1 = ap(m, v1);
    const ph = Math.atan2(A1[1], A1[0]), A2 = ap(m, v2);
    return { th, ph, s1: Math.hypot(...A1), s2: -A2[0] * Math.sin(ph) + A2[1] * Math.cos(ph) };
  };
  const th = .5 * Math.atan2(2 * q, p - r), o1 = at(th), o2 = at(th > 0 ? th - Math.PI : th + Math.PI);
  // v₁ 和 −v₁ 都行，挑转得少的那个
  return Math.abs(o1.th) + Math.abs(o1.ph) <= Math.abs(o2.th) + Math.abs(o2.ph) ? o1 : o2;
}
function M(T) {
  const { th, ph, s1, s2 } = D;
  if (T <= 1) return rot(-th * ease(T));
  const e = ease(Math.min(1, T - 1)), sig = [1 + (s1 - 1) * e, 0, 0, 1 + (s2 - 1) * e];
  if (T <= 2) return mm(sig, rot(-th));
  return mm(rot(ph * ease(T - 2)), mm([s1, 0, 0, s2], rot(-th)));
}

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6, from = [0, 0]) {
  const [x1, y1] = P(from), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function label(text, at, color, from = [0, 0]) {
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  ctx.fillStyle = color; ctx.font = '600 14px KaTeX_Main, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (x - ox) / L * 20, y + (y - oy) / L * 20);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function grid(m, color, axis) {
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) * 3;
  for (let k = -R; k <= R; k++) {
    seg(ap(m, [k, -R]), ap(m, [k, R]), k ? color : axis, k ? 1 : 1.6);
    seg(ap(m, [-R, k]), ap(m, [R, k]), k ? color : axis, k ? 1 : 1.6);
  }
}
function circle(m) {
  ctx.beginPath();
  for (let k = 0; k <= 96; k++) { const a = 2 * Math.PI * k / 96, [x, y] = P(ap(m, [Math.cos(a), Math.sin(a)])); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(T), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .35; grid(m, C.muted, C.muted); ctx.globalAlpha = 1;
  circle(A); ctx.setLineDash([4, 5]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
  circle(m); ctx.fillStyle = C['accent-soft']; ctx.globalAlpha = .8; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.text; ctx.lineWidth = 1.6; ctx.stroke();
  const v1 = [Math.cos(D.th), Math.sin(D.th)], v2 = [-Math.sin(D.th), Math.cos(D.th)];
  const a1 = ap(m, v1), a2 = ap(m, v2), stage3 = T > 2;
  arrow(a1, C.accent); arrow(a2, C.blue);
  label(T < .02 ? 'v₁' : stage3 ? 'σ₁u₁' : '', a1, C['accent-ink']);
  label(T < .02 ? 'v₂' : stage3 ? 'σ₂u₂' : '', a2, C.blue);
  knobs.forEach((k) => k.place());

  const st = T <= 0 ? -1 : T <= 1 ? 0 : T <= 2 ? 1 : 2;
  root.querySelector('.steps').innerHTML = [
    ['① Vᵀ：转', `转 ${deg(-D.th)}，把 v₁、v₂ 转到坐标轴上`],
    ['② Σ：拉', `横向 ×${num(D.s1)}，纵向 ×${num(D.s2)}`],
    ['③ U：转', `再转 ${deg(D.ph)}，到最终位置`],
  ].map(([h, s], k) => `<div class="${st === k || (st === 2 && T >= 3 && k === 2) ? 'on' : ''}"><b>${h}</b><span>${s}</span></div>`).join('');
  range.value = Math.round(T * 1000);
  cv.setAttribute('aria-label', `奇异值 ${num(D.s1)} 和 ${num(Math.abs(D.s2))}`);
}

function setA(m) { A = m.slice(); D = svd(A); }
function play() {
  cancelAnimationFrame(raf);
  if (reduce) { T = 3; return draw(); }
  const t0 = performance.now() + 300;
  // 每一步之间停一下
  const step = (now) => {
    const k = Math.max(0, (now - t0) / 1100), seg = Math.floor(k / 1.3), r = k - seg * 1.3;
    T = Math.min(3, seg + Math.min(1, r));
    draw(); if (T < 3) raf = requestAnimationFrame(step);
  };
  T = 0; draw(); raf = requestAnimationFrame(step);
}
function knob(name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'knob'; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => { cancelAnimationFrame(raf); T = 3; const m = A.slice(); set(m, p); setA(m); root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', 'false')); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(snap(U(e.clientX - r.left, e.clientY - r.top))); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take(snap([p[0] + d[0] * s, p[1] + d[1] * s]));
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; b.hidden = T < 3; } };
}
const knobs = [
  knob('î 的落点', () => [A[0], A[2]], (m, p) => { m[0] = p[0]; m[2] = p[1]; }),
  knob('ĵ 的落点', () => [A[1], A[3]], (m, p) => { m[1] = p[0]; m[3] = p[1]; }),
];
root.querySelectorAll('[data-p]').forEach((btn) => btn.addEventListener('click', () => {
  setA(presets[Number(btn.dataset.p)]);
  root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
  play();
}));
root.querySelector('.play').addEventListener('click', play);
range.addEventListener('input', () => { cancelAnimationFrame(raf); T = range.value / 1000; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(360, W * .56)));
  S = H / 6.4;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
setA(A);
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

剪切也只是转了 $-58^\circ$，横向拉到 1.618 倍、纵向压到 0.618 倍，再转 $32^\circ$。两个奇异值又是黄金比例和它的倒数，这不是巧合：$A^\top A=\begin{bmatrix}1&1\\1&2\end{bmatrix}$ 的特征方程是 $\lambda^2-3\lambda+1=0$，两个根是 $\varphi^2$ 和 $1/\varphi^2$。虚线椭圆是最终的位置，拖动圆点可以换一个矩阵。

$V$ 和 $\sigma$ 从哪来？把 $A=U\Sigma V^\top$ 代进 $A^\top A$，中间的 $U^\top U=I$ 抵消掉：

$$
A^\top A=V\Sigma^2V^\top .
$$

这正是对称矩阵 $A^\top A$ 的特征值分解：$V$ 的列是它的特征向量，奇异值是它特征值的平方根。上一节说 $A^\top A$ 总是对称的，用处在这里。

### 一层一层叠起来

把 $U\Sigma V^\top$ 按外积展开，就是前面矩阵乘法的第四种看法：

$$
A=\sigma_1\mathbf{u}_1\mathbf{v}_1^\top+\sigma_2\mathbf{u}_2\mathbf{v}_2^\top+\cdots+\sigma_r\mathbf{u}_r\mathbf{v}_r^\top .
$$

每一项都是一个秩为 1 的矩阵，按重要程度排好了序。只留前 $k$ 项，得到的是所有秩不超过 $k$ 的矩阵里离 $A$ 最近的一个，距离按所有元素误差的平方和来量（Eckart–Young 定理）。

一张灰度图片就是一个矩阵。下面这张 $96\times128$ 的小图是用代码画的，打开页面时在你的浏览器里现算了它的奇异值分解。拖动滑块，看前 $k$ 层叠起来的样子：

```render html title="图片的奇异值分解：前 k 层叠起来"
<style>
  .sv { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .pics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .pics figure { margin: 0; }
  .pics canvas { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 4px; background: var(--bg-sunken); image-rendering: auto; }
  .pics figcaption { margin-top: 2px; color: var(--muted); font-size: 12px; text-align: center; }
  .ctl { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
  .ctl input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .ctl output { min-width: 4.5em; font: 600 14px var(--font-mono); }
  .bars { display: block; width: 100%; height: 70px; margin-top: 6px; }
  .read { display: grid; gap: 2px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
</style>
<section class="sv" aria-label="图片的低秩近似">
  <div class="pics">
    <figure><canvas class="orig" width="128" height="96" role="img" aria-label="原图"></canvas><figcaption>原图</figcaption></figure>
    <figure><canvas class="appr" width="128" height="96" role="img" aria-label="前 k 层叠加"></canvas><figcaption class="cap1">前 k 层</figcaption></figure>
    <figure><canvas class="layer" width="128" height="96" role="img" aria-label="第 k 层"></canvas><figcaption class="cap2">第 k 层</figcaption></figure>
  </div>
  <label class="ctl"><span>k</span><input type="range" min="1" max="60" value="1" aria-label="保留的层数" disabled /><output>计算中</output></label>
  <canvas class="bars" role="img" aria-label="奇异值从大到小"></canvas>
  <div class="read" aria-live="polite"></div>
</section>
<script>
const root = document.querySelector('.sv');
const R = 96, Cn = 128;
const input = root.querySelector('input'), out = root.querySelector('output');
const bars = root.querySelector('.bars'), bctx = bars.getContext('2d');
let sig = [], Ucol = [], Vcol = [], img;

// 用代码画一张小图：天空、太阳、山、房子和一行字
function scene() {
  const c = document.createElement('canvas'); c.width = Cn; c.height = R;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, R); sky.addColorStop(0, '#f2f2f2'); sky.addColorStop(1, '#8a8a8a');
  g.fillStyle = sky; g.fillRect(0, 0, Cn, R);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(98, 22, 11, 0, 2 * Math.PI); g.fill();
  g.fillStyle = '#5a5a5a'; g.beginPath(); g.moveTo(0, 66); g.lineTo(28, 40); g.lineTo(52, 60); g.lineTo(80, 32); g.lineTo(128, 70); g.lineTo(128, 96); g.lineTo(0, 96); g.fill();
  g.fillStyle = '#e8e8e8'; g.fillRect(18, 58, 30, 28);
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(14, 60); g.lineTo(33, 44); g.lineTo(52, 60); g.fill();
  g.fillStyle = '#404040'; g.fillRect(29, 70, 8, 16);
  g.fillStyle = '#ffffff'; g.font = '700 17px Inter Variable, sans-serif'; g.fillText('Ax=b', 66, 89);
  const d = g.getImageData(0, 0, Cn, R).data, a = new Float64Array(R * Cn);
  for (let k = 0; k < R * Cn; k++) a[k] = (d[4 * k] * .299 + d[4 * k + 1] * .587 + d[4 * k + 2] * .114) / 255;
  return a;
}

// 单边 Jacobi：不停地旋转两行，直到所有行两两正交
function svd(a) {
  const rows = Array.from({ length: R }, (_, r) => a.slice(r * Cn, (r + 1) * Cn));
  const V = Array.from({ length: R }, (_, j) => { const v = new Float64Array(R); v[j] = 1; return v; });
  for (let sweep = 0; sweep < 40; sweep++) {
    let worst = 0;
    for (let p = 0; p < R - 1; p++) for (let q = p + 1; q < R; q++) {
      const x = rows[p], y = rows[q];
      let al = 0, be = 0, ga = 0;
      for (let i = 0; i < Cn; i++) { al += x[i] * x[i]; be += y[i] * y[i]; ga += x[i] * y[i]; }
      if (Math.abs(ga) <= 1e-13 * Math.sqrt(al * be)) continue;
      worst = Math.max(worst, Math.abs(ga) / Math.sqrt(al * be));
      const ze = (be - al) / (2 * ga), t = Math.sign(ze || 1) / (Math.abs(ze) + Math.sqrt(1 + ze * ze));
      const c = 1 / Math.sqrt(1 + t * t), s = c * t;
      for (let i = 0; i < Cn; i++) { const xi = x[i], yi = y[i]; x[i] = c * xi - s * yi; y[i] = s * xi + c * yi; }
      const vp = V[p], vq = V[q];
      for (let i = 0; i < R; i++) { const xi = vp[i], yi = vq[i]; vp[i] = c * xi - s * yi; vq[i] = s * xi + c * yi; }
    }
    if (worst < 1e-10) break;
  }
  const order = rows.map((r, j) => [Math.hypot(...r), j]).sort((p, q) => q[0] - p[0]);
  sig = order.map(([s]) => s);
  Ucol = order.map(([s, j]) => V[j]);                 // 长 96：列方向的模式
  Vcol = order.map(([s, j]) => rows[j].map((x) => x / (s || 1))); // 长 128：行方向的模式
}

function paint(canvas, f) {
  const g = canvas.getContext('2d'), im = g.createImageData(Cn, R);
  for (let k = 0; k < R * Cn; k++) { const v = Math.max(0, Math.min(255, Math.round(f(k) * 255))); im.data[4 * k] = im.data[4 * k + 1] = im.data[4 * k + 2] = v; im.data[4 * k + 3] = 255; }
  g.putImageData(im, 0, 0);
}
function drawBars(k) {
  const s = getComputedStyle(root), W = bars.clientWidth, H = 70, r = devicePixelRatio, n = 60;
  bars.width = W * r; bars.height = H * r; bctx.setTransform(r, 0, 0, r, 0, 0); bctx.clearRect(0, 0, W, H);
  const lo = Math.log10(sig[n - 1]), hi = Math.log10(sig[0]), bw = W / n;
  for (let j = 0; j < n; j++) {
    const h = 6 + (H - 22) * (Math.log10(sig[j]) - lo) / (hi - lo);
    bctx.fillStyle = s.getPropertyValue(j < k ? '--accent' : '--rule-strong').trim();
    bctx.fillRect(j * bw + 1, H - 14 - h, Math.max(1, bw - 2), h);
  }
  bctx.fillStyle = s.getPropertyValue('--muted').trim(); bctx.font = '11px Inter Variable, sans-serif';
  bctx.fillText('σ₁', 0, H - 2); bctx.textAlign = 'right'; bctx.fillText('σ₆₀（纵轴取对数）', W, H - 2); bctx.textAlign = 'start';
}
function update() {
  const k = Number(input.value);
  out.textContent = `k = ${k}`;
  const acc = new Float64Array(R * Cn);
  for (let j = 0; j < k; j++) { const u = Ucol[j], v = Vcol[j], s = sig[j]; for (let r = 0; r < R; r++) { const su = s * u[r]; for (let c = 0; c < Cn; c++) acc[r * Cn + c] += su * v[c]; } }
  paint(root.querySelector('.appr'), (i) => acc[i]);
  const u = Ucol[k - 1], v = Vcol[k - 1], s = sig[k - 1];
  let peak = 1e-9; for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) peak = Math.max(peak, Math.abs(s * u[r] * v[c]));
  paint(root.querySelector('.layer'), (i) => .5 + .5 * s * u[Math.floor(i / Cn)] * v[i % Cn] / peak);
  const sub = String(k).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  root.querySelector('.cap1').textContent = `前 ${k} 层叠起来`;
  root.querySelector('.cap2').textContent = `第 ${k} 层 σ${sub}u${sub}v${sub}ᵀ（灰色是 0）`;
  drawBars(k);
  const total = sig.reduce((a, s) => a + s * s, 0), rest = sig.slice(k).reduce((a, s) => a + s * s, 0);
  const store = k * (R + Cn + 1);
  root.querySelector('.read').innerHTML =
    `<span><small>要存的数：</small>${k} × (96 + 128 + 1) = ${store}<small>，原图 12288 个，占 </small>${(store / 122.88).toFixed(1)}%</span>` +
    `<span><small>相对误差：</small>${(Math.sqrt(rest / total) * 100).toFixed(1)}%</span>`;
}

img = scene();
paint(root.querySelector('.orig'), (i) => img[i]);
setTimeout(() => {
  svd(img);
  input.disabled = false; input.value = 8;
  update();
}, 30);
input.addEventListener('input', update);
window.addEventListener('themechange', () => { if (sig.length) drawBars(Number(input.value)); });
new ResizeObserver(() => { if (sig.length) drawBars(Number(input.value)); }).observe(bars);
</script>
```

$k=1$ 时只是一片明暗渐变：第一层总是“大致哪里亮哪里暗”。山和房子这种横平竖直的大块，前几层就出来了；字和斜边要更多层。$k=20$ 左右已经很难和原图分清，要存的数只有原来的三分之一多一点。图下面的柱子是奇异值，从大到小掉得很快，说明大部分信息集中在前面几层。

真实照片做 SVD 压缩，效果不如 JPEG，但这个思路处处可见：

- **主成分分析**：把数据排成矩阵、减去均值做 SVD，前几个右奇异向量就是数据变化最大的方向。几百维的数据，常常几个方向就能解释大部分差异。
- **推荐系统**：用户×商品的评分矩阵大部分是空的，假设它近似低秩，就能用前几层把空格补上。Netflix 当年的推荐大赛，矩阵分解是主力。
- **大模型微调**：[LoRA](/posts/llm-fine-tuning/) 假设微调时权重的变化量是低秩的，只训练两个瘦长的矩阵 $B$、$A$，用 $BA$ 去近似这个变化量。

## 最小二乘：够不着，就找最近的

回到非方阵那一节留下的问题。三个数据点 $(0,1)$、$(1,2)$、$(2,2)$，想用一条直线 $y=c+mx$ 穿过它们。写成方程组：

$$
\begin{bmatrix}1&0\\1&1\\1&2\end{bmatrix}\begin{bmatrix}c\\m\end{bmatrix}=\begin{bmatrix}1\\2\\2\end{bmatrix}.
$$

三个方程两个未知数，三个点不共线，无解。换成列空间的语言：$A$ 的两列在三维空间里张成一个平面，$\mathbf{b}=(1,2,2)$ 不在这个平面上。

够不着 $\mathbf{b}$，就在平面上找离它最近的点 $\mathbf{p}=A\hat{\mathbf{x}}$。最近的点是垂足：误差 $\mathbf{e}=\mathbf{b}-A\hat{\mathbf{x}}$ 必须垂直于整个平面，也就是垂直于 $A$ 的每一列：

```render svg title="左：在数据里拟合一条直线；右：同一件事在三维里是投影"
<svg viewBox="0 0 620 230" xmlns="http://www.w3.org/2000/svg" font-family="Inter Variable, sans-serif">
  <g stroke="var(--rule-strong)" stroke-width="1.2">
    <path d="M40 190 H220 M40 190 V20" />
  </g>
  <g fill="var(--faint)" font-size="11" text-anchor="middle">
    <text x="40" y="206">0</text><text x="100" y="206">1</text><text x="160" y="206">2</text>
    <text x="28" y="134" text-anchor="end">1</text><text x="28" y="74" text-anchor="end">2</text>
  </g>
  <path d="M22 129 L196 42" stroke="var(--accent)" stroke-width="2.2" />
  <g stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="3 3">
    <path d="M40 130 V120 M100 70 V90 M160 70 V60" />
  </g>
  <g fill="currentColor">
    <circle cx="40" cy="130" r="4.5" /><circle cx="100" cy="70" r="4.5" /><circle cx="160" cy="70" r="4.5" />
  </g>
  <text x="196" y="30" font-size="12" fill="var(--accent-ink)" text-anchor="end">y = 7/6 + x/2</text>
  <text x="130" y="224" font-size="12" fill="var(--muted)" text-anchor="middle">虚线是三个误差，平方和最小</text>

  <path d="M300 180 L520 180 L590 110 L370 110 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.2" />
  <text x="318" y="172" font-size="12" fill="var(--accent-ink)">列空间：Ax 能到的所有地方</text>
  <path d="M380 160 L482 137" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" />
  <path d="M492 135 L482.3 141.8 L480.3 133 Z" fill="var(--accent)" />
  <path d="M380 160 L485 52" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  <path d="M492 44 L487.6 55 L481.1 48.8 Z" fill="currentColor" />
  <path d="M492 133 V56" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 4" />
  <path d="M492 123 L503 120 L503 132" fill="none" stroke="var(--muted)" stroke-width="1.2" />
  <circle cx="380" cy="160" r="2.5" fill="currentColor" />
  <g font-size="14" font-weight="600">
    <text x="496" y="40" fill="currentColor">b</text>
    <text x="430" y="132" fill="var(--accent-ink)">p = Ax̂</text>
  </g>
  <text x="500" y="92" font-size="13" fill="var(--muted)">e = b − Ax̂</text>
  <text x="500" y="110" font-size="12" fill="var(--muted)">垂直于列空间</text>
</svg>
```

“垂直于 $A$ 的每一列”写出来就是 $A^\top\mathbf{e}=\mathbf{0}$：

$$
A^\top(\mathbf{b}-A\hat{\mathbf{x}})=\mathbf{0}
\quad\Longrightarrow\quad
A^\top A\,\hat{\mathbf{x}}=A^\top\mathbf{b}.
$$

这叫法方程，“法”就是法线、垂直的意思。代入数字：

$$
\begin{bmatrix}3&3\\3&5\end{bmatrix}\begin{bmatrix}c\\m\end{bmatrix}=\begin{bmatrix}5\\6\end{bmatrix}
\quad\Longrightarrow\quad
c=\frac76,\; m=\frac12 .
$$

三个误差是 $-\frac16,\frac13,-\frac16$。它们加起来是 0，这是 $\mathbf{e}$ 垂直于第一列 $(1,1,1)$；乘上各自的横坐标再加起来，$0\cdot(-\frac16)+1\cdot\frac13+2\cdot(-\frac16)=0$，这是 $\mathbf{e}$ 垂直于第二列 $(0,1,2)$。

同一件事有两幅画面：左边是二维平面里的三个点和一条线，要让误差的平方和最小；右边是三维空间里的一个点和一个平面，要找垂足。误差平方和就是 $\lVert\mathbf{e}\rVert^2$，让它最小，就是让 $\mathbf{b}$ 到平面的距离最短。“最小二乘”这个名字说的是左边，它的本质在右边。

## 计算机图形学：一帧画面里的矩阵

游戏里的每一帧，GPU 要把成千上万个三角形的顶点算到屏幕上。每个顶点都要经过一串变换：

- **模型矩阵** $M$：把模型自己的坐标摆到世界里，旋转、缩放、放到某个位置。
- **视图矩阵** $V$：把世界坐标换成相机眼里的坐标，相机在原点，朝某个固定方向看。这是一次基变换。
- **投影矩阵** $P$：把相机看到的那个视锥体压进一个标准的立方体，近大远小就是在这一步做出来的。

每个顶点要算 $P\,V\,M\,\mathbf{x}$。结合律在这里直接省下了大量计算：一个物体的所有顶点共用同一个 $PVM$，每帧先把三个矩阵乘成一个，再拿这一个去乘每个顶点。

### 平移不是线性变换，那就升一维

问题来了：把物体放到某个位置要平移，平移会挪动原点，不是线性变换，没法写成矩阵。

图形学的办法是给每个点多加一个坐标，固定为 1：二维的点 $(x,y)$ 写成 $(x,y,1)$。于是平面上的点都住在三维空间里 $z=1$ 的那张平面上。再看这个 $3\times3$ 的矩阵：

$$
\begin{bmatrix}1&0&t_x\\0&1&t_y\\0&0&1\end{bmatrix}\begin{bmatrix}x\\y\\1\end{bmatrix}=\begin{bmatrix}x+t_x\\y+t_y\\1\end{bmatrix}.
$$

在三维里，它是一次剪切，完全线性，原点纹丝不动；但在 $z=1$ 那张平面上看，所有点都平移了 $(t_x,t_y)$。拖动画面转个角度，再调 $t_x$、$t_y$：

```render html title="齐次坐标：三维里的剪切，在 z = 1 的平面上就是平移"
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .bar label { display: flex; flex: 1; min-width: 150px; align-items: center; gap: 10px; color: var(--muted); font: 12px var(--font-mono); }
  .bar input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .bar output { min-width: 2.6em; color: var(--text); text-align: right; }
  canvas { display: block; width: 100%; margin-top: 8px; cursor: grab; touch-action: pan-y; }
  canvas:active { cursor: grabbing; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin-top: 4px; }
  .m { display: inline-grid; grid-auto-flow: column; grid-template-rows: repeat(3, auto); gap: 0 12px; position: relative; padding: 0 9px; font: 13px var(--font-mono); text-align: right; line-height: 1.5; }
  .m::before, .m::after { content: ""; position: absolute; top: 1px; bottom: 1px; width: 5px; border: 1.5px solid var(--muted); }
  .m::before { left: 0; border-right: 0; } .m::after { right: 0; border-left: 0; }
  .m .t { color: var(--accent-ink); font-weight: 600; }
  .note { margin: 0; color: var(--muted); }
</style>
<section class="la" aria-label="齐次坐标演示">
  <div class="bar">
    <button type="button" class="key play">播放</button>
    <label>tₓ<input type="range" min="-20" max="20" value="15" data-k="0" aria-label="x 方向平移" /><output></output></label>
    <label>tᵧ<input type="range" min="-20" max="20" value="10" data-k="1" aria-label="y 方向平移" /><output></output></label>
  </div>
  <canvas role="img"></canvas>
  <div class="foot"><span class="m"></span><p class="note"></p></div>
</section>
<script>
const root = document.querySelector('.la');
const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
const inputs = [...root.querySelectorAll('input')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 50, yaw = .5, pitch = .55, tr = [1.5, 1], cur = [1.5, 1], raf = 0;
const F = [[0, 0], [0, 2], [1.3, 2], [1.3, 1.6], [.45, 1.6], [.45, 1.18], [1.05, 1.18], [1.05, .78], [.45, .78], [.45, 0]].map(([x, y]) => [x - .65, y - 1]);

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const num = (n) => String(Math.round(n * 100) / 100 || 0).replace('-', '−');
// 剪切：(x, y, z) → (x + tₓz, y + tᵧz, z)
const sh = ([x, y, z]) => [x + cur[0] * z, y + cur[1] * z, z];
function P([px, py, pz]) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = px * cy - py * sy, y1 = px * sy + py * cy;
  return [W / 2 + x1 * S, H * .72 - (pz * 1.5 * cp + y1 * sp) * S]; // 竖直方向放大 1.5 倍，看得清楚些
}
function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function poly(pts, fill, stroke, w = 1.2, dash = [], alpha = 1) {
  ctx.beginPath(); pts.map(P).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  if (fill) { ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1; }
  if (stroke) { ctx.setLineDash(dash); ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.stroke(); ctx.setLineDash([]); }
}
function text(s, at, color, dx = 6, dy = -6) {
  const [x, y] = P(at);
  ctx.fillStyle = color; ctx.font = '12px Inter Variable, sans-serif'; ctx.fillText(s, x + dx, y + dy);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const G = 3;
  // z = 0：地面，剪切对它毫无影响
  for (let k = -G; k <= G; k++) { seg([k, -G, 0], [k, G, 0], C.rule); seg([-G, k, 0], [G, k, 0], C.rule); }
  text('z = 0', [G, -G, 0], C.faint, 6, 14);
  // 竖杆：底端不动，顶端跟着 z = 1 平移，杆子就斜了
  for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) {
    seg([x, y, 0], [x, y, 1], C.faint, 1, [2, 4]);
    seg([x, y, 0], sh([x, y, 1]), C.muted, 1.3);
  }
  // z = 1：变换前的平面和 F 留虚影
  const L = 2.6, sq = [[-L, -L, 1], [L, -L, 1], [L, L, 1], [-L, L, 1]];
  poly(sq, null, C['rule-strong'], 1, [3, 4]);
  poly(F.map(([x, y]) => [x, y, 1]), null, C.faint, 1.2, [4, 4]);
  poly(sq.map(sh), C.accent, C.accent, 1, [], .07);
  for (let k = -2; k <= 2; k++) { seg(sh([k, -L, 1]), sh([k, L, 1]), C['rule-strong']); seg(sh([-L, k, 1]), sh([L, k, 1]), C['rule-strong']); }
  poly(F.map(([x, y]) => sh([x, y, 1])), C['accent-soft'], C.accent, 2);
  text('z = 1', sh([L, -L, 1]), C['accent-ink'], 6, 14);
  // 原点和三根轴
  seg([0, 0, 0], [0, 0, 1.6], C['rule-strong'], 1.4);
  const [ox, oy] = P([0, 0, 0]); ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, 2 * Math.PI); ctx.fillStyle = C.text; ctx.fill();
  text('原点', [0, 0, 0], C.text, 8, 14);

  root.querySelector('.m').innerHTML = ['1', '0', '0', '0', '1', '0'].map((s) => `<span>${s}</span>`).join('') + `<span class="t">${num(cur[0])}</span><span class="t">${num(cur[1])}</span><span>1</span>`;
  root.querySelector('.note').innerHTML = `在 z = 1 上，F 平移了 (${num(cur[0])}, ${num(cur[1])})；z = 0 上一切没动，原点也没动。`;
  inputs.forEach((el, k) => { el.value = Math.round(cur[k] * 10); el.nextElementSibling.textContent = num(cur[k]); });
  cv.setAttribute('aria-label', root.querySelector('.note').textContent);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { cur = tr.slice(); return draw(); }
  const t0 = performance.now() + 300, ease = (x) => x * x * (3 - 2 * x);
  const step = (now) => { const e = ease(Math.max(0, Math.min(1, (now - t0) / 1600))); cur = tr.map((v) => v * e); draw(); if (e < 1) raf = requestAnimationFrame(step); };
  cur = [0, 0]; draw(); raf = requestAnimationFrame(step);
}
inputs.forEach((el) => el.addEventListener('input', () => { cancelAnimationFrame(raf); tr[Number(el.dataset.k)] = el.value / 10; cur = tr.slice(); draw(); }));
root.querySelector('.play').addEventListener('click', play);
let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw = drag[2] - (e.clientX - drag[0]) * .01;
  pitch = Math.max(0, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * .01));
  draw();
});
cv.addEventListener('pointerup', () => { drag = null; });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(280, Math.min(400, W * .62)));
  S = Math.min(W / 8.5, H / 6);
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(cv);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(cv);
</script>
```

地面上的网格一动不动，竖杆底端钉死、顶端跟着走，整个三维空间被“推斜”了。只有站在 $z=1$ 那张平面上，才会觉得一切都平移了。**低维里不线性的平移，到了高一维就变成了线性的剪切。** 这叫齐次坐标，1827 年莫比乌斯在射影几何里提出，后来成了图形学的地基。

三维图形同理，点写成 $(x,y,z,1)$，变换用 $4\times4$ 的矩阵：左上角 $3\times3$ 管旋转缩放，最右一列管平移。旋转、缩放、平移就能统一成矩阵乘法，再用结合律合并成一个矩阵。

透视投影也借了第四个坐标的光。投影矩阵会把深度放进第四个分量 $w$ 里，矩阵乘完以后，GPU 再把前三个分量都除以 $w$。离得越远 $w$ 越大，除完越小，近大远小就出来了。整条流水线里只有这一步除法不是线性的，其余全是矩阵。

### 法向量要用逆转置来变

还有一个容易踩的坑。模型被不均匀地缩放时，比如横向拉长两倍，它表面的法向量不能直接乘 $M$，否则就不再垂直于表面，光照会算错。正确的做法是乘 $(M^{-1})^\top$。

这是点积那一节“向量和尺子”的区别。表面上的切向量 $\mathbf{t}$ 是真正的箭头，跟着 $M$ 走；法向量 $\mathbf{n}$ 的本职是一把尺子，它的定义是“和所有切向量的点积为 0”。变换之后要继续满足 $\mathbf{n}'\cdot(M\mathbf{t})=0$，取 $\mathbf{n}'=(M^{-1})^\top\mathbf{n}$ 正好：

$$
\mathbf{n}'^\top M\mathbf{t}=\mathbf{n}^\top M^{-1}M\mathbf{t}=\mathbf{n}^\top\mathbf{t}=0 .
$$

旋转时 $(M^{-1})^\top=M$，均匀缩放时两者只差一个倍数，方向一样，所以平时不容易发现；遇到不均匀缩放或剪切，就非用逆转置不可。

### 旋转不能直接插值

前面的动画里，旋转都是按角度一点点转过去的，没有直接在矩阵之间插值。如果直接在单位矩阵和“转 90°”之间取中点：

$$
\frac12\left(\begin{bmatrix}1&0\\0&1\end{bmatrix}+\begin{bmatrix}0&-1\\1&0\end{bmatrix}\right)=\begin{bmatrix}0.5&-0.5\\0.5&0.5\end{bmatrix},
$$

它的行列式是 0.5，转到一半，物体缩小了一圈。旋转矩阵的平均不再是旋转矩阵。动画和游戏里插值旋转要用四元数的球面插值（slerp），沿着“旋转”这个集合本身走，不抄近路。

## 函数也是向量

开头说向量有第三种说法：能相加、能数乘的东西都算。现在可以兑现了。

函数可以相加，$(f+g)(x)=f(x)+g(x)$；可以数乘，$(cf)(x)=c\,f(x)$。所以函数也是向量。写成代码，就是逐点相加的高阶函数：

```ts
const addF = (f: (x: number) => number, g: (x: number) => number) => (x: number) => f(x) + g(x);
const scaleF = (c: number, f: (x: number) => number) => (x: number) => c * f(x);
```

次数不超过 3 的多项式，用 $1,x,x^2,x^3$ 当基，$5+3x-x^3$ 的坐标就是 $(5,3,0,-1)$。求导是线性的，所以它也是一个矩阵。还是老办法，问基向量去了哪：$1\to0$，$x\to1$，$x^2\to2x$，$x^3\to3x^2$，竖着写进各列：

$$
D=\begin{bmatrix}0&1&0&0\\0&0&2&0\\0&0&0&3\\0&0&0&0\end{bmatrix},
\qquad
D\begin{bmatrix}5\\3\\0\\-1\end{bmatrix}=\begin{bmatrix}3\\0\\-3\\0\end{bmatrix}.
$$

结果是 $3-3x^2$，正是 $5+3x-x^3$ 的导数。前面的概念在这里全都有了着落：$D$ 的零空间是常数函数，秩是 3，第一列全是 0，常数被压成了 0，所以它不可逆：求导会丢掉常数项。最后一行全是 0，则说明导数里永远不会出现 $x^3$。$D^4=0$：任何三次多项式求四次导都没了。

求导的特征向量是什么？要找 $f'=\lambda f$ 的函数，答案是 $e^{\lambda x}$。这就是为什么指数函数在微分方程里无处不在：它们是求导这个变换的特征向量，求导对它们只是乘一个数。二阶导数的特征函数里有 $\sin\omega x$ 和 $\cos\omega x$，特征值是 $-\omega^2$，这是一切振动的来源。

傅里叶分析把这个想法推到底：

- 在 $[-\pi,\pi]$ 上，常数 1 和所有的 $\sin kx$、$\cos kx$ 组成一组互相垂直的基，“点积”换成了积分 $\int_{-\pi}^{\pi}f(x)g(x)\,\mathrm{d}x$。
- 一个函数的傅里叶系数，就是它和每个基函数做点积，也就是投影到每根坐标轴上。
- 傅里叶变换是一次基变换：从“每个时刻的值”换成“每个频率的强度”。
- 复指数 $e^{i\omega t}$ 是所有“不随时间改变规则”的线性系统的特征函数（实的正弦波是两个复指数的组合），所以在频率这组基下，滤波器变成了对角矩阵，卷积变成了逐项相乘。这和对角化是同一件事。

JPEG 压缩也是这个套路：把图片切成 $8\times8$ 的小块，每块换到一组余弦图案的基下（离散余弦变换），人眼不敏感的高频系数存得很粗，甚至直接扔掉。换基，再扔掉不重要的坐标，和前面的 SVD 压缩是一个思路。

量子力学干脆把整套理论建在线性代数上：系统的状态是向量，可观测量是对称（厄米）矩阵，测量能得到的结果就是它的特征值。

## 神经网络：为什么非得夹一层非线性

神经网络的一层是 $\mathbf{y}=\sigma(W\mathbf{x}+\mathbf{b})$。$W\mathbf{x}$ 是线性变换，$+\mathbf{b}$ 是平移，用齐次坐标看两者是一回事，合起来叫仿射变换。$\sigma$ 是非线性的激活函数，比如 $\operatorname{ReLU}(x)=\max(0,x)$。

为什么非要 $\sigma$？拿掉它，三层网络就是

$$
W_3(W_2(W_1\mathbf{x}))=(W_3W_2W_1)\,\mathbf{x}.
$$

矩阵乘法那一节说过：线性变换接连做还是线性变换。一百层线性层乘起来只是一个矩阵，和一层没有区别，网络再深也白搭。

几何上，线性层只会均匀地拉伸、旋转、剪切空间，网格始终是平行等距的；ReLU 把每个坐标的负半边压平到 0 上，相当于把空间的一部分拍扁在坐标面上，这一步不再保持网格平行等距。深度网络交替地拉伸和压平，一层一层把纠缠在一起的数据揉开，最后用一个线性的超平面就能把不同的类别分开。

## 同一件事，几种说法

回头看，线性代数里的每个概念，都至少有三副面孔：

| 概念 | 几何上 | 函数上 | 方程组里 |
| --- | --- | --- | --- |
| 矩阵 | 对空间的一次变换 | 线性函数存成的表 | 系数 |
| 矩阵乘法 | 接连做两次变换 | 函数复合 | 代入消元 |
| 矩阵的形状 | 从几维到几维 | 类型签名 | 方程数 × 未知数个数 |
| 行列式 | 面积、体积放大的倍数 | 是否一一对应 | 不为 0 才有唯一解 |
| 逆矩阵 | 把变换倒着放 | 反函数 | $\mathbf{x}=A^{-1}\mathbf{b}$ |
| 列空间 | 变换后能到达的地方 | 值域 | $\mathbf{b}$ 在里面才有解 |
| 零空间 | 被压到原点的方向 | 被丢掉的信息 | 齐次方程的解 |
| 秩 | 变换后还剩几维 | 输出的自由度 | 真正独立的方程个数 |
| 转置 | 把尺子拉回去 | 向量和测量互换 | 行列互换 |
| 基变换 | 换一套坐标网格 | `decode ∘ f ∘ encode` | 换元 |
| 特征向量 | 变换里不转向的方向 | 只被乘一个数的输入 | $(A-\lambda I)\mathbf{v}=\mathbf{0}$ |
| 奇异值分解 | 转、拉、转 | 按重要性分层 | 最小二乘、低秩近似 |

再回到开头那条“行乘列”的规则。它不是谁拍脑袋规定的：1858 年，凯莱在 *A Memoir on the Theory of Matrices* 里定义矩阵乘法时，出发点就是把两次线性代换接连做下去。先有函数复合，后有乘法规则；教科书把顺序倒了过来，画面就丢了。

把画面找回来，线性代数就只剩一句话：**研究那些保持加法和数乘的函数。** 它们简单到只用几个基向量的落点就能完全描述，又足够丰富，从屏幕上的每一个像素、搜索结果的排序，到神经网络的每一层，都是它们在干活。

## 延伸阅读

- 3Blue1Brown 的系列视频 *Essence of Linear Algebra*（中文常译作《线性代数的本质》）。这篇文章的几何视角深受它的影响，动画也更精致。
- Gilbert Strang，*Introduction to Linear Algebra*，以及 MIT 18.06 的公开课。四个基本子空间、最小二乘、SVD 讲得极清楚。
- Sheldon Axler，*Linear Algebra Done Right*。从线性映射而不是矩阵出发，行列式放到最后才讲，和这篇的思路一致，更严格。
