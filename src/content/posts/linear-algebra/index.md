---
title: "线性代数到底在讲什么"
description: "矩阵乘法为什么是行乘列？把矩阵看成对空间的一次变换，乘法、行列式、秩、逆、叉积、特征值都能从同一个画面里推出来。"
pubDate: 2026-11-09
updatedDate: 2026-11-11
tags: ["数学", "线性代数", "计算机图形学"]
---

第一次学矩阵乘法，规则是这样给的：

$$
\begin{bmatrix}1&2\\3&4\end{bmatrix}
\begin{bmatrix}5&6\\7&8\end{bmatrix}
=
\begin{bmatrix}1\cdot5+2\cdot7&1\cdot6+2\cdot8\\3\cdot5+4\cdot7&3\cdot6+4\cdot8\end{bmatrix}
=
\begin{bmatrix}19&22\\43&50\end{bmatrix}
$$

左边取一行，右边取一列，对应相乘再相加。照着算不难，怪的是它为什么长这样。加法是对应位置相加，乘法凭什么不是对应位置相乘？$AB$ 为什么不等于 $BA$？行列式那串一正一负的符号又是哪来的？

这些规则都是从同一个画面里推出来的。课本把画面省了，只留下推完的结果。

画面是这样的：**矩阵是一个函数。** 吃进一个向量，吐出一个向量；放到整个平面上看，它把平面拉伸、旋转、推斜成另一副样子。认了这一点，后面的东西一件件都有着落——矩阵乘法是两个变换接着做，行列式是面积放大了几倍，逆矩阵是把变换倒着放，特征向量是没被转走的那几个方向。

下面的图都能动手：按钮会把变换的过程放一遍，箭头尖上的圆点可以拖。

## 向量：能相加，能伸缩

向量是一支箭头：尾巴钉在原点，箭头尖落在哪，它就是哪个向量。把尖的坐标记下来，比如 $(3,2)$，往右 3、往上 2。箭头和这组数说的是同一个东西。

它只有两种运算。相加是接着走：先沿 $\mathbf{v}$ 走到头，再沿 $\mathbf{w}$ 走，到的地方就是 $\mathbf{v}+\mathbf{w}$。数乘是伸缩：$2\mathbf{v}$ 同方向、两倍长，$-\mathbf{v}$ 掉头。

线性代数从头到尾只用这两种运算。所以任何东西只要能这样相加、伸缩——多项式、一段声音、一张图片的像素——后面的结论对它原样成立。这门课用途那么广，原因就在这。

## 基：坐标是一份配方

$(3,2)$ 里藏着两个没写出来的向量：往右一格的 $\hat\imath=(1,0)$，往上一格的 $\hat\jmath=(0,1)$。

$$
\begin{bmatrix}3\\2\end{bmatrix}=3\,\hat\imath+2\,\hat\jmath
$$

坐标是一份配方：3 份 $\hat\imath$，2 份 $\hat\jmath$，加起来。

配料可以换。把几个向量各乘一个数再相加，叫它们的线性组合；所有配得出来的结果合在一起，叫它们张成的空间。两个不共线的平面向量能配出平面上任何一点；共线的两个，怎么配都出不了那条直线。

配料里没有多余的（谁也不能被其余几个配出来，这叫线性无关），又刚好够配出整个空间，这样一组向量叫一组**基**。选定一组基，每个向量的配方只有一份，这份配方就是它在这组基下的坐标。

图里橙色的 $\mathbf{b}_1$ 和蓝色的 $\mathbf{b}_2$ 是另一组基，斜网格是它们眼里的“横平竖直”。三个圆点都能拖：

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 36px; height: 36px; margin: -18px 0 0 -18px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--text); cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 11px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); }
  .knob:active { cursor: grabbing; }
  .read { font: 13px var(--font-mono); }
  .read + .stage + .read { margin-top: 4px; }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="同一支箭头在两组基下的坐标">
  <div class="bar">
    <span class="read r0"></span>
    <button type="button" class="key play">按配方走一遍</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <div class="read r1"></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const r0 = root.querySelector('.r0'), r1 = root.querySelector('.r1');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0;
let b1 = [2, 1], b2 = [-1, 1], v = [1, 2];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
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
// 箭头旁的名字是叠在画布上的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function label(tex, at, color, from = [0, 0]) {
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  name(tex, x + (x - ox) / L * 22, y + (y - oy) / L * 22, color);
}

const sg = (x) => (x < -.004 ? `(${num(x)})` : num(x));
const B1 = '\\htmlClass{i}{\\mathbf{b}_1}', B2 = '\\htmlClass{j}{\\mathbf{b}_2}';

// v = c1·b1 + c2·b2，两列共线时没有解
function recipe() {
  const D = b1[0] * b2[1] - b2[0] * b1[1];
  if (Math.abs(D) < 1e-6) return null;
  return [(v[0] * b2[1] - b2[0] * v[1]) / D, (b1[0] * v[1] - v[0] * b1[1]) / D];
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1, m = [b1[0], b2[0], b1[1], b2[1]], c = recipe();
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .4;
  for (let k = -3 * R; k <= 3 * R; k++) {
    seg(ap(m, [k, -3 * R]), ap(m, [k, 3 * R]), C.blue, k ? 1 : 1.6);
    seg(ap(m, [-3 * R, k]), ap(m, [3 * R, k]), C.accent, k ? 1 : 1.6);
  }
  ctx.globalAlpha = 1;
  if (c) {
    // 先沿 b1 走 c1 份，再沿 b2 走 c2 份
    const e = ease(t), p1 = Math.min(1, e * 2), p2 = Math.max(0, e * 2 - 1), mid = [c[0] * b1[0], c[0] * b1[1]];
    seg([0, 0], [mid[0] * p1, mid[1] * p1], C.accent, 2.4, [6, 5]);
    if (p2 > 0) seg(mid, [mid[0] + (v[0] - mid[0]) * p2, mid[1] + (v[1] - mid[1]) * p2], C.blue, 2.4, [6, 5]);
  }
  arrow(v, C.text, 2.4); label('\\mathbf{v}', v, C.text);
  arrow(b1, C.accent); arrow(b2, C.blue);
  label('\\mathbf{b}_1', b1, C['accent-ink']); label('\\mathbf{b}_2', b2, C.blue);
  knobs.forEach((k) => k.place());

  r0.textContent = `$\\hat\\imath$、$\\hat\\jmath$ 下：$\\mathbf{v} = (${num(v[0])}, ${num(v[1])})$`;
  r1.textContent = c
    ? `$${B1}$、$${B2}$ 下：$\\mathbf{v} = (${num(c[0])}, ${num(c[1])}) = ${num(c[0])}\\,${B1} + ${sg(c[1])}\\,${B2}$`
    : `$${B1}$、$${B2}$ 共线，不是一组基`;
  cv.setAttribute('aria-label', c ? `v 在标准基下是 (${num(v[0])}, ${num(v[1])})，在 b1、b2 下是 (${num(c[0])}, ${num(c[1])})` : 'b1、b2 共线');
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 200;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1800)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}

function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => { cancelAnimationFrame(raf); t = 1; set(snap(p)); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(U(e.clientX - r.left, e.clientY - r.top)); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('pointercancel', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take([p[0] + d[0] * s, p[1] + d[1] * s]);
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; } };
}
const knobs = [
  knob('', 'v', () => v, (p) => { v = p; }),
  knob('i', 'b1', () => b1, (p) => { b1 = p; }),
  knob('j', 'b2', () => b2, (p) => { b2 = p; }),
];
root.querySelector('.play').addEventListener('click', play);

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(380, W * .6)));
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

默认 $\mathbf{b}_1=(2,1)$、$\mathbf{b}_2=(-1,1)$。同一支 $\mathbf{v}$，在 $\hat\imath$、$\hat\jmath$ 下是 $(1,2)$，在这组基下是 $(1,1)$：

$$
1\cdot\begin{bmatrix}2\\1\end{bmatrix}+1\cdot\begin{bmatrix}-1\\1\end{bmatrix}=\begin{bmatrix}1\\2\end{bmatrix}
$$

箭头没动，数变了。**坐标是向量和一组基之间的关系，换一组基就换一组数。**

再把 $\mathbf{b}_2$ 拖到和 $\mathbf{b}_1$ 一条线上。斜网格塌成一条线，线外的 $\mathbf{v}$ 配不出来了，它俩不再是基。这个“塌掉”后面还要见好几次。

## 线性变换：网格不许弯

吃一个向量、吐一个向量的函数叫变换。换个名字是想换个看法：别盯着一个输入，把平面上所有点同时搬到各自的输出位置，看整张平面怎么动。

随手写一个函数，平面多半被揉得乱七八糟。线性变换只收守两条规矩的：

$$
f(\mathbf{u}+\mathbf{v})=f(\mathbf{u})+f(\mathbf{v}),\qquad f(c\,\mathbf{v})=c\,f(\mathbf{v})
$$

先加再变等于先变再加，先伸缩再变等于先变再伸缩。画出来是一句话：**变换之后，网格线还是直的、平行的、间隔均匀的，原点不动。** 旋转、拉伸、剪切、镜像都守规矩。平移不守，它挪走了原点。

两条规矩合起来有个后果，整门课都压在它上面。任何向量都能写成 $x\hat\imath+y\hat\jmath$，于是

$$
f(x\hat\imath+y\hat\jmath)=x\,f(\hat\imath)+y\,f(\hat\jmath)
$$

**知道 $\hat\imath$、$\hat\jmath$ 落在哪，就知道每一个向量落在哪。** 一个定义在无穷多个点上的函数，两个落点就定死了。

把这两个落点竖着并排写下来，就是矩阵：

$$
A=\begin{bmatrix}a&b\\c&d\end{bmatrix}
\qquad
\text{第一列 }(a,c)\text{ 是 }\hat\imath\text{ 的落点，第二列 }(b,d)\text{ 是 }\hat\jmath\text{ 的落点}
$$

橙色是 $\hat\imath$，蓝色是 $\hat\jmath$，黑色是 $\mathbf{v}=(1,2)$。两个圆点可以拖，自己定一个变换：

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 36px; height: 36px; margin: -18px 0 0 -18px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 11px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); }
  .knob:active { cursor: grabbing; }
  .scrub { display: flex; align-items: center; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-top: 4px; min-height: 44px; font: 13px var(--font-mono); }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="线性变换：网格跟着 î、ĵ 的落点一起动">
  <div class="bar">
    <div class="seg" role="group" aria-label="选一个变换">
      <button type="button" data-p="0">旋转</button>
      <button type="button" data-p="1">剪切</button>
      <button type="button" data-p="2">伸缩</button>
      <button type="button" data-p="3">镜像</button>
      <button type="button" data-p="4">弯的</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <label class="scrub"><span>进度</span><input type="range" min="0" max="1000" value="1000" aria-label="变换进度" /></label>
  <div class="foot"><span class="mat"></span><span class="read"></span></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), mat = root.querySelector('.mat'), read = root.querySelector('.read');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0;

const presets = [
  { m: [0, -1, 1, 0], rot: Math.PI / 2 },
  { m: [1, 1, 0, 1] },
  { m: [2, 0, 0, .5] },
  { m: [0, 1, 1, 0] },
  { bend: true },
];
let A = presets[0].m.slice(), rot = presets[0].rot, bend = false, cur = 0;
const v = [1, 2];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'faint', 'rule', 'rule-strong', 'accent', 'accent-ink', 'accent-soft', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const pair = (p) => `(${num(p[0])}, ${num(p[1])})`;
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });

// 进度 t 对应的矩阵：旋转按角度走，其余从单位矩阵直线走到 A
function M(t) {
  const e = ease(t);
  if (rot !== undefined) { const c = Math.cos(rot * e), s = Math.sin(rot * e); return [c, -s, s, c]; }
  return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e];
}
// 对照组：一个不线性的函数，会把直线掰弯
const warp = ([x, y], e) => [x + e * .6 * Math.sin(1.2 * y), y + e * .16 * x * x];

function seg(a, b, color, w = 1, dash = []) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function curve(fn, R, color, w) {
  ctx.beginPath();
  for (let k = 0; k <= R * 8; k++) { const [x, y] = P(fn(-R + k / 4)); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash([]); ctx.stroke();
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
// 箭头旁的名字是叠在画布上的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function label(tex, at, color, from = [0, 0]) {
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  name(tex, x + (x - ox) / L * 22, y + (y - oy) / L * 22, color);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), e = ease(t), f = bend ? (p) => warp(p, e) : (p) => ap(m, p);
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 2;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .5;
  for (let k = -3 * R; k <= 3 * R; k++) {
    if (bend) {
      if (Math.abs(k) > R) continue;
      curve((s) => f([k, s]), R, k ? C.muted : C.text, k ? 1 : 1.6);
      curve((s) => f([s, k]), R, k ? C.muted : C.text, k ? 1 : 1.6);
    } else {
      seg(f([k, -3 * R]), f([k, 3 * R]), k ? C.muted : C.text, k ? 1 : 1.6);
      seg(f([-3 * R, k]), f([3 * R, k]), k ? C.muted : C.text, k ? 1 : 1.6);
    }
  }
  ctx.globalAlpha = 1;
  const i = f([1, 0]), j = f([0, 1]), out = f(v);
  if (!bend) {
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => P(f(p)));
    ctx.beginPath(); sq.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = C['accent-soft']; ctx.globalAlpha = .75; ctx.fill(); ctx.globalAlpha = 1;
  }
  // v 的配方：先走 1 份 f(î)，再走 2 份 f(ĵ)
  const xi = [v[0] * i[0], v[0] * i[1]], mix = [xi[0] + v[1] * j[0], xi[1] + v[1] * j[1]];
  seg([0, 0], xi, C.accent, 2, [5, 5]); seg(xi, mix, C.blue, 2, [5, 5]);
  if (bend) {
    const [x, y] = P(mix);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.setLineDash([]); ctx.strokeStyle = C.muted; ctx.lineWidth = 2; ctx.stroke();
  }
  arrow(out, C.text, 2.4); label('\\mathbf{v}', out, C.text);
  arrow(i, C.accent); arrow(j, C.blue);
  label('\\hat\\imath', i, C['accent-ink']); label('\\hat\\jmath', j, C.blue);
  knobs.forEach((k) => k.place());

  mat.hidden = bend;
  // 两列各用自己那支箭头的颜色
  mat.textContent = `$A = \\begin{bmatrix}\\htmlClass{i}{${num(m[0])}}&\\htmlClass{j}{${num(m[1])}}\\\\\\htmlClass{i}{${num(m[2])}}&\\htmlClass{j}{${num(m[3])}}\\end{bmatrix}$`;
  read.textContent = bend
    ? `$1\\cdot\\htmlClass{i}{f(\\hat\\imath)} + 2\\cdot\\htmlClass{j}{f(\\hat\\jmath)} = ${pair(mix)}$　$f(\\mathbf{v}) = ${pair(out)}$`
    : `$\\mathbf{v} \\to 1\\cdot\\htmlClass{i}{${pair(i)}} + 2\\cdot\\htmlClass{j}{${pair(j)}} = ${pair(out)}$`;
  range.value = Math.round(t * 1000);
  cv.setAttribute('aria-label', `î 落在 ${pair(i)}，ĵ 落在 ${pair(j)}，v 落在 ${pair(out)}`);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 250;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1500)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
const mark = () => root.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === cur)));
function pick(p) {
  const q = presets[p];
  cur = p; bend = Boolean(q.bend); rot = q.rot;
  if (q.m) A = q.m.slice();
  mark(); play();
}

function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => { cancelAnimationFrame(raf); t = 1; rot = undefined; cur = -1; set(snap(p)); mark(); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(U(e.clientX - r.left, e.clientY - r.top)); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('pointercancel', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take([p[0] + d[0] * s, p[1] + d[1] * s]);
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; b.style.display = bend ? 'none' : ''; } };
}
const knobs = [
  knob('i', 'î 的落点', () => { const m = M(t); return [m[0], m[2]]; }, (p) => { A[0] = p[0]; A[2] = p[1]; }),
  knob('j', 'ĵ 的落点', () => { const m = M(t); return [m[1], m[3]]; }, (p) => { A[1] = p[0]; A[3] = p[1]; }),
];

root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.p))));
root.querySelector('.play').addEventListener('click', play);
range.addEventListener('input', () => { cancelAnimationFrame(raf); t = range.value / 1000; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(380, W * .6)));
  S = H / 8;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme(); mark();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

看黑色箭头脚下那两段虚线：沿新的 $\hat\imath$ 走 1 份，再沿新的 $\hat\jmath$ 走 2 份。$\mathbf{v}$ 的配方 $(1,2)$ 没变，变的是配料。矩阵乘向量算的就是这个：

$$
\begin{bmatrix}a&b\\c&d\end{bmatrix}\begin{bmatrix}x\\y\end{bmatrix}
=x\begin{bmatrix}a\\c\end{bmatrix}+y\begin{bmatrix}b\\d\end{bmatrix}
=\begin{bmatrix}ax+by\\cx+dy\end{bmatrix}
$$

**拿向量的坐标当配方，去混矩阵的各列。** 课本教的“第一行乘向量得第一个数”是同一堆乘法换了个分组，按列看才看得出它在干什么。

切到“弯的”再看一眼，那是个不线性的函数。网格线弯了，按配方走到的地方（空心圆）和 $\mathbf{v}$ 真正的落点对不上：知道 $f(\hat\imath)$、$f(\hat\jmath)$，推不出 $f(\mathbf{v})$。这种函数没法用四个数记下来。矩阵能存下一个函数，全靠线性。

还有“镜像”。播到一半，整张平面被压成一条斜线，然后才翻过去——把一张纸翻面，中途总有一刻是侧着的。记住这一下，讲行列式时用得上。

## 矩阵乘法：先做一个，再做一个

先做变换 $B$，再做变换 $A$。两次下来网格还是直的、平行等距的，原点还在，所以合起来仍是一个线性变换，也有自己的矩阵，记作 $AB$。

它的两列是什么？老办法，问基向量去了哪。$\hat\imath$ 先被 $B$ 送到 $B$ 的第一列，这个向量再被 $A$ 送走。所以：

> [!IMPORTANT]
> $AB$ 的第 $j$ 列，就是 $A$ 作用在 $B$ 的第 $j$ 列上。

拿开头那道题试。$B$ 的第一列是 $(5,7)$，当配方去混 $A$ 的两列；第二列 $(6,8)$ 照办：

$$
5\begin{bmatrix}1\\3\end{bmatrix}+7\begin{bmatrix}2\\4\end{bmatrix}=\begin{bmatrix}19\\43\end{bmatrix},
\qquad
6\begin{bmatrix}1\\3\end{bmatrix}+8\begin{bmatrix}2\\4\end{bmatrix}=\begin{bmatrix}22\\50\end{bmatrix}
$$

正是答案的两列。“行乘列”也跟着出来了：结果第 $i$ 行第 $j$ 列的那个数，是“$A$ 作用在 $B$ 的第 $j$ 列上”得到的向量的第 $i$ 个分量。把它单拎出来算，恰好是 $A$ 的第 $i$ 行和 $B$ 的第 $j$ 列对应相乘再相加。

没人规定乘法要这么算，是“接着做两次变换”逼出来的。历史上也是这个顺序：1858 年凯莱定义矩阵乘法，为的就是把两次线性代换合成一次。

$AB$ 要从右往左读，和 $f(g(x))$ 一样，先做 $B$。

顺序要紧吗？$S$ 是向右剪切，$R$ 是逆时针转 90°，两种顺序各走一遍：

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; align-items: center; gap: 14px; }
  .key { flex: none; min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .scrub { display: flex; flex: 1; min-width: 0; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; }
  .scrub span { flex: none; min-width: 4.2em; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .duo { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 22px; margin-top: 10px; }
  figure { margin: 0; min-width: 0; }
  figcaption { color: var(--muted); font-size: 13px; }
  canvas { display: block; width: 100%; }
  .foot { margin-top: 2px; min-height: 38px; font: 13px var(--font-mono); }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
  .stage { position: relative; }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
  @media (max-width: 520px) { .duo { grid-template-columns: 1fr; } }
</style>
<section class="la" aria-label="同样两个变换，两种先后顺序">
  <div class="bar">
    <label class="scrub"><span class="stepname"></span><input type="range" min="0" max="2000" value="2000" aria-label="进度：两步变换" /></label>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="duo">
    <figure><figcaption>先剪切 $S$，再旋转 $R$</figcaption><div class="stage"><canvas role="img"></canvas></div><div class="foot"></div></figure>
    <figure><figcaption>先旋转 $R$，再剪切 $S$</figcaption><div class="stage"><canvas role="img"></canvas></div><div class="foot"></div></figure>
  </div>
</section>
<script>
const root = document.querySelector('.la');
const range = root.querySelector('input'), stepname = root.querySelector('.stepname');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let t = 2, raf = 0; // 0→1 做第一步，1→2 做第二步

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'rule', 'accent', 'accent-ink', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const ease = (x) => x * x * (3 - 2 * x);
const clamp = (x) => Math.max(0, Math.min(1, x));
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const rotate = (e) => { const c = Math.cos(Math.PI / 2 * e), s = Math.sin(Math.PI / 2 * e); return [c, -s, s, c]; };
const shear = (e) => [1, e, 0, 1];
const orders = [{ f: [shear, rotate], name: ['S', 'RS'] }, { f: [rotate, shear], name: ['R', 'SR'] }];
// 后做的写在左边
const M = (o) => mul(orders[o].f[1](ease(clamp(t - 1))), orders[o].f[0](ease(clamp(t))));
const F = [[[.3, .2], [.3, 1.8]], [[.3, 1.8], [1.3, 1.8]], [[.3, 1], [1, 1]]];

const panels = [...root.querySelectorAll('figure')].map((fig, o) => {
  const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d'), foot = fig.querySelector('.foot');
  // 箭头旁的名字是叠在画布上的公式：同一个名字只排版一次，之后只挪位置
  const tags = cv.parentNode.appendChild(document.createElement('div')), names = {};
  tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
  // 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
  const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
    if (!box.inlineSize) return;
    el.size = [box.inlineSize, box.blockSize];
    if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
  }));
  keep.observe(tags);
  function settle(el) {
    const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
    const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
    const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
  function name(tex, x, y, color, shift = '-50%, -50%') {
    let el = names[tex];
    if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
    el.hidden = false; el.style.color = color;
    el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
  }
  let W = 0, H = 0, S = 30;
  const P = ([x, y]) => [W / 2 + x * S, H * .58 - y * S];
  function seg(a, b, color, w = 1) {
    const [x1, y1] = P(a), [x2, y2] = P(b);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  }
  function arrow(to, color, tex, ink) {
    const [x1, y1] = P([0, 0]), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 2) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(11, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    name(tex, x2 + ux * 16, y2 + uy * 16, ink);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const m = M(o), R = Math.ceil(Math.hypot(W, H) / S) + 1;
    ctx.lineCap = 'butt';
    for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
    ctx.globalAlpha = .45;
    for (let k = -R; k <= R; k++) {
      seg(ap(m, [k, -R]), ap(m, [k, R]), k ? C.muted : C.text, k ? 1 : 1.5);
      seg(ap(m, [-R, k]), ap(m, [R, k]), k ? C.muted : C.text, k ? 1 : 1.5);
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'round';
    F.forEach(([a, b]) => seg(ap(m, a), ap(m, b), C.text, 5));
    arrow([m[0], m[2]], C.accent, '\\hat\\imath', C['accent-ink']); arrow([m[1], m[3]], C.blue, '\\hat\\jmath', C.blue);
    foot.textContent = `$${orders[o].name[t > 1 ? 1 : 0]} = \\begin{bmatrix}\\htmlClass{i}{${num(m[0])}}&\\htmlClass{j}{${num(m[1])}}\\\\\\htmlClass{i}{${num(m[2])}}&\\htmlClass{j}{${num(m[3])}}\\end{bmatrix}$`;
    cv.setAttribute('aria-label', `î 落在 (${num(m[0])}, ${num(m[2])})，ĵ 落在 (${num(m[1])}, ${num(m[3])})`);
  }
  function size() {
    W = cv.clientWidth; H = Math.round(Math.max(210, Math.min(300, W * .8)));
    S = H / 6.4;
    const r = devicePixelRatio;
    cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  new ResizeObserver(() => { size(); draw(); }).observe(fig);
  return draw;
});

function draw() {
  panels.forEach((d) => d());
  range.value = Math.round(t * 1000);
  stepname.textContent = t > 1 ? '第 2 步' : '第 1 步';
}
function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 2; return draw(); }
  const t0 = performance.now() + 250;
  const step = (now) => { t = 2 * clamp((now - t0) / 3400); draw(); if (t < 2) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
root.querySelector('.play').addEventListener('click', play);
range.addEventListener('input', () => { cancelAnimationFrame(raf); t = range.value / 1000; draw(); });
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .5 }).observe(root);
</script>
```

F 最后躺的姿势不一样，矩阵也不一样：

$$
RS=\begin{bmatrix}0&-1\\1&1\end{bmatrix},\qquad SR=\begin{bmatrix}1&-1\\1&0\end{bmatrix}
$$

每张图里 $\hat\imath$、$\hat\jmath$ 最后停的位置，就是下面那个矩阵的两列。照这个办法，不背规则也能把任何两个矩阵乘出来。

把乘法当成“接着做”，几条性质不用证：

- **不能交换。** 先穿袜子再穿鞋，和先穿鞋再穿袜子，不是一回事。
- **能结合。** $(AB)C$ 和 $A(BC)$ 都是先 $C$、后 $B$、再 $A$，括号只管先把哪两步合并。用下标硬证，要写半页求和号。
- **单位矩阵 $I$** 是什么都不做的那个变换。

写程序的人有个现成的词可以对上：矩阵乘法就是函数复合。$m\times n$ 的矩阵吃 $n$ 维、吐 $m$ 维；“左边的列数要等于右边的行数”查的是前一个函数的输出能不能喂给后一个，形状就是类型签名。

“接着做还是线性的”还有一个用处。神经网络的每一层都要先乘一个矩阵。层与层之间要是什么都不夹，一百层乘下来还是一个矩阵，和一层没有分别。所以每层后面都跟着一个不线性的函数，比如把负数全压成 0 的 ReLU。

## 行列式：面积放大了几倍

$\hat\imath$ 和 $\hat\jmath$ 围着一个面积为 1 的正方形。变换之后，它成了以矩阵两列为边的平行四边形。

网格变换后还是平行、等距的，所以每个小方格都变成同样大的平行四边形。任何形状都能拿足够小的方格去拼，于是**平面上所有形状的面积，被放大了同一个倍数**。这个倍数叫行列式，记作 $\det A$。

图里除了单位正方形，还放了一个圆盘。换几个变换，或者拖箭头尖上的圆点，对比两个形状各放大了几倍：

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 18px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 38px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 36px; height: 36px; margin: -18px 0 0 -18px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 11px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob.i { color: var(--accent); } .knob.j { color: var(--blue); }
  .knob:active { cursor: grabbing; }
  .scrub { display: flex; align-items: center; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .read { display: flex; flex-wrap: wrap; gap: 2px 22px; margin-top: 4px; min-height: 22px; font: 13px var(--font-mono); }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="行列式：正方形和圆的面积被放大同一个倍数，翻面时为负">
  <div class="bar">
    <div class="seg" role="group" aria-label="选一个变换">
      <button type="button" data-p="0">放大</button>
      <button type="button" data-p="1">剪切</button>
      <button type="button" data-p="2">压扁</button>
      <button type="button" data-p="3">翻面</button>
    </div>
    <button type="button" class="key play">播放</button>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <label class="scrub"><span>进度</span><input type="range" min="0" max="1000" value="1000" aria-label="变换进度" /></label>
  <div class="read"></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), read = root.querySelector('.read');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0, cur = 0;
// 每个矩阵按 [a, b, c, d] 存：î 落在 (a, c)，ĵ 落在 (b, d)
const presets = [[2, 1, 0, 1.5], [1, 1, 0, 1], [2, 1, 1, .5], [1, 2, 2, 1]];
let A = presets[0].slice();
const disc = Array.from({ length: 48 }, (_, k) => [-1.2 + .6 * Math.cos(k * Math.PI / 24), 1 + .6 * Math.sin(k * Math.PI / 24)]);

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'rule', 'accent', 'accent-ink', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const sg = (x) => (x < -.004 ? `(${num(x)})` : num(x));
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });
const M = (t) => { const e = ease(t); return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e]; };

function seg(a, b, color, w = 1) {
  const [x1, y1] = P(a), [x2, y2] = P(b);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash([]); ctx.stroke();
}
// 箭头旁的名字是叠在画布上的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function arrow(to, color, tex, ink) {
  const [x1, y1] = P([0, 0]), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  name(tex, x2 + ux * 22, y2 + uy * 22, ink);
  ctx.lineCap = 'butt';
}
function shape(pts, color) {
  ctx.beginPath(); pts.map(P).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.globalAlpha = .2; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (const el of tags.children) el.hidden = true;
  const m = M(t), d = m[0] * m[3] - m[1] * m[2], R = Math.ceil(Math.hypot(W, H) / 2 / S) + 2;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .5;
  for (let k = -3 * R; k <= 3 * R; k++) {
    seg(ap(m, [k, -3 * R]), ap(m, [k, 3 * R]), k ? C.muted : C.text, k ? 1 : 1.6);
    seg(ap(m, [-3 * R, k]), ap(m, [3 * R, k]), k ? C.muted : C.text, k ? 1 : 1.6);
  }
  ctx.globalAlpha = 1;
  // 翻面以后换一种颜色
  const tint = d < 0 ? C.blue : C.accent;
  shape([[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => ap(m, p)), tint);
  shape(disc.map((p) => ap(m, p)), tint);
  // 正方形里的 R 跟着变换走：把画布自己的坐标也乘上这个矩阵
  ctx.save();
  ctx.transform(m[0], -m[2], -m[1], m[3], W / 2, H / 2);
  ctx.fillStyle = C.text; ctx.font = `600 ${S * .62}px Inter Variable, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('R', S * .5, -S * .5);
  ctx.restore();
  arrow([m[0], m[2]], C.accent, '\\hat\\imath', C['accent-ink']); arrow([m[1], m[3]], C.blue, '\\hat\\jmath', C.blue);
  knobs.forEach((k) => k.place());

  const area = Math.abs(d), state = area < .005 ? '压成了一条线' : d < 0 ? '翻面了' : '';
  read.innerHTML =
    `<span>$\\det A = \\htmlClass{i}{${sg(m[0])}}\\cdot\\htmlClass{j}{${sg(m[3])}} - \\htmlClass{j}{${sg(m[1])}}\\cdot\\htmlClass{i}{${sg(m[2])}} = \\mathbf{${num(d)}}$</span>` +
    `<span>方格 $1 \\to ${num(area)}$</span><span>圆 $1.13 \\to ${num(1.131 * area)}$</span><span>${state}</span>`;
  range.value = Math.round(t * 1000);
  cv.setAttribute('aria-label', `行列式 ${num(d)}：面积变成 ${num(area)} 倍${d < 0 ? '，并且翻了面' : ''}`);
}

function play() {
  cancelAnimationFrame(raf);
  if (reduce) { t = 1; return draw(); }
  const t0 = performance.now() + 250;
  const step = (now) => { t = Math.max(0, Math.min(1, (now - t0) / 1700)); draw(); if (t < 1) raf = requestAnimationFrame(step); };
  t = 0; draw(); raf = requestAnimationFrame(step);
}
const mark = () => root.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === cur)));

function knob(cls, name, get, set) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `knob ${cls}`; b.setAttribute('aria-label', `${name}：拖动或用方向键移动`);
  stage.append(b);
  const take = (p) => { cancelAnimationFrame(raf); t = 1; cur = -1; set(snap(p)); mark(); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(U(e.clientX - r.left, e.clientY - r.top)); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.onpointermove = move; });
  b.addEventListener('pointerup', () => { b.onpointermove = null; });
  b.addEventListener('pointercancel', () => { b.onpointermove = null; });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1, p = get();
    take([p[0] + d[0] * s, p[1] + d[1] * s]);
  });
  return { place() { const [x, y] = P(get()); b.style.transform = `translate(${x}px, ${y}px)`; } };
}
const knobs = [
  knob('i', 'î 的落点', () => { const m = M(t); return [m[0], m[2]]; }, (p) => { A[0] = p[0]; A[2] = p[1]; }),
  knob('j', 'ĵ 的落点', () => { const m = M(t); return [m[1], m[3]]; }, (p) => { A[1] = p[0]; A[3] = p[1]; }),
];

root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { cur = Number(b.dataset.p); A = presets[cur].slice(); mark(); play(); }));
root.querySelector('.play').addEventListener('click', play);
range.addEventListener('input', () => { cancelAnimationFrame(raf); t = range.value / 1000; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(380, W * .6)));
  S = H / 8;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme(); mark();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(stage);
</script>
```

“剪切”把正方形推歪了，面积还是 1：底没变，高也没变。“压扁”让两列躺到同一条线上，平行四边形没了面积，行列式是 0。

“翻面”的结果是 $-3$。面积不会是负的，负号记的是另一件事：正方形里的 R 成了镜像。原来从 $\hat\imath$ 逆时针转过去是 $\hat\jmath$，现在得顺时针转，平面被翻了个面。拉着进度条慢慢走，行列式从 1 一路降到 $-3$，中间非经过 0 不可。前面说的那张纸，翻面途中侧过来的一刻，就是这里的 0。

三维里一样：行列式是单位立方体变成的平行六面体的体积，负号表示右手系变成了左手系。

### ad − bc 从哪来

二维的公式能从图上直接量出来。$\hat\imath$ 落在 $(a,c)$，$\hat\jmath$ 落在 $(b,d)$，拿外面的大矩形减掉四周的边角：

```render html title="图里 $a = 3$，$c = 1$，$b = 1$，$d = 2$"
<style>
  .ab { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 32px; font-size: 14px; line-height: 1.5; font-variant-ligatures: none; }
  .ab svg { flex: none; display: block; width: 240px; max-width: 100%; height: auto; }
  .sum { display: grid; grid-template-columns: max-content max-content; gap: 6px 16px; font-family: var(--font-mono); }
  .sum > span:nth-child(odd) { color: var(--muted); font-family: var(--font-sans); }
  .sum > span.hit { color: var(--accent-ink); font-weight: 650; }
  .ab text { font: italic 13.5px KaTeX_Math, var(--font-serif); }
  .ab text tspan { font-family: KaTeX_Main, var(--font-serif); font-style: normal; }
  .ab text.hit { font-size: 18px; }
</style>
<div class="ab" role="img" aria-label="大矩形减去四个三角形和两个小矩形，剩下的平行四边形面积是 ad − bc">
  <svg viewBox="6 30 214 172" xmlns="http://www.w3.org/2000/svg">
    <g stroke="var(--rule-strong)" stroke-width="1.2">
      <path d="M30 175 L165 175 L165 130 Z M75 85 L75 40 L210 40 Z" fill="var(--bg-sunken)" />
      <path d="M30 175 L75 85 L30 85 Z M165 130 L210 130 L210 40 Z" fill="var(--bg-sunken)" />
      <path d="M165 130 H210 V175 H165 Z M30 40 H75 V85 H30 Z" fill="var(--surface)" />
    </g>
    <path d="M30 175 L165 130 L210 40 L75 85 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" />
    <rect x="30" y="40" width="180" height="135" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 4" />
    <g fill="var(--muted)" text-anchor="middle">
      <text x="120" y="165">ac<tspan>/2</tspan></text>
      <text x="120" y="56">ac<tspan>/2</tspan></text>
      <text x="46" y="118">bd<tspan>/2</tspan></text>
      <text x="195" y="104">bd<tspan>/2</tspan></text>
      <text x="187" y="157">bc</text>
      <text x="52" y="67">bc</text>
    </g>
    <g fill="var(--faint)" text-anchor="middle">
      <text x="97" y="194">a</text>
      <text x="187" y="194">b</text>
      <text x="16" y="133">d</text>
      <text x="16" y="66">c</text>
    </g>
    <text class="hit" x="120" y="113" fill="var(--accent-ink)" text-anchor="middle">ad <tspan>−</tspan> bc</text>
  </svg>
  <div class="sum">
    <span>大矩形</span><span>$(a+b)(c+d)$</span>
    <span>四个三角</span><span>$-\,ac - bd$</span>
    <span>两个小矩形</span><span>$-\,2bc$</span>
    <span class="hit">剩下</span><span class="hit">$ad - bc$</span>
  </div>
</div>
```

图里是 $3\cdot2-1\cdot1=5$。

### 几条性质，看图就有

- $\det(AB)=\det A\cdot\det B$。先放大 $\det B$ 倍，再放大 $\det A$ 倍。拿公式硬证三阶的情形，要展开一百多项。
- $\det A=0$，是平面被压成了一条线或一个点。压扁要丢东西，下一节会看到，这样的变换倒不回去。
- 把一行的若干倍加到另一行，行列式不变。这是一次剪切，剪切不改面积。高斯消元干的主要就是这个：一路剪切，把矩阵化成上三角，行列式就是对角线上几个数的乘积；途中每交换一次两行，等于照一次镜子，符号翻一次。计算机就这么算行列式，$O(n^3)$。按定义展开的式子有 $n!$ 项，20 阶就是 $2.4\times10^{18}$ 项。

开头问的那串一正一负，也是从“翻面”来的。平行四边形的一条边拉长两倍，面积就两倍；一条边拆成两段相加，面积也是两块相加。行列式对每一列都是线性的。

那就把每一列拆开。第一列是 $a\hat\imath+c\hat\jmath$，第二列是 $b\hat\imath+d\hat\jmath$，行列式跟着拆成四项，每一项从两列里各挑一根轴：

$$
\det\begin{bmatrix}a&b\\c&d\end{bmatrix}
=ab\underbrace{\det\begin{bmatrix}\hat\imath&\hat\imath\end{bmatrix}}_{0}
+ad\underbrace{\det\begin{bmatrix}\hat\imath&\hat\jmath\end{bmatrix}}_{1}
+cb\underbrace{\det\begin{bmatrix}\hat\jmath&\hat\imath\end{bmatrix}}_{-1}
+cd\underbrace{\det\begin{bmatrix}\hat\jmath&\hat\jmath\end{bmatrix}}_{0}
$$

两列挑了同一根轴的，压扁了，是 0。两根轴原样放着的是单位正方形，1。两根轴对调的，照了一次镜子，$-1$。剩下 $ad-bc$。

三阶照办：从三列里各挑一根互不相同的轴，有 6 种挑法，相当于把三根轴重新排一遍队。排队要对调奇数次的带负号，所以三正三负。$n$ 阶有 $n!$ 种排法，上面说的 $n!$ 项就是这么来的。

## 逆矩阵与 Ax = b：倒着找输入

一个方程组：

$$
\begin{aligned}
2x-y&=0\\
x+y&=3
\end{aligned}
\qquad\Longleftrightarrow\qquad
\begin{bmatrix}2&-1\\1&1\end{bmatrix}\begin{bmatrix}x\\y\end{bmatrix}=\begin{bmatrix}0\\3\end{bmatrix}
$$

一行一行看，是两条直线求交点。换成变换来看，$A\mathbf{x}=\mathbf{b}$ 问的是另一件事：**哪个向量被 $A$ 搬过之后，正好落在 $\mathbf{b}$ 上？** 变换和落点都知道，要找的是出发点。

图里画的是变换之后的样子，黑色箭头已经落在 $\mathbf{b}$ 上。按“倒放”，看它是从哪出发的。$\mathbf{b}$ 上的圆点可以拖：

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .scrub { display: flex; flex: 1; min-width: 180px; align-items: center; gap: 10px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .stage { position: relative; margin-top: 10px; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 36px; height: 36px; margin: -18px 0 0 -18px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--text); cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 11px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob:active { cursor: grabbing; }
  .read { display: flex; flex-wrap: wrap; gap: 2px 22px; margin-top: 6px; font: 13px var(--font-mono); }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="解 Ax = b：把变换倒着放，b 回到它的出发点 x">
  <div class="bar">
    <button type="button" class="key back">倒放</button>
    <button type="button" class="key fwd">正放</button>
    <label class="scrub"><span>变换前</span><input type="range" min="0" max="1000" value="1000" aria-label="进度：最左是变换前，最右是变换后" /><span>变换后</span></label>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <div class="read"></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), read = root.querySelector('.read');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, S = 40, t = 1, raf = 0;
const A = [2, -1, 1, 1]; // î 落在 (2, 1)，ĵ 落在 (−1, 1)
let b = [0, 3];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'rule', 'accent', 'accent-ink', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const ap = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
const ease = (x) => x * x * (3 - 2 * x);
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const pair = (p) => `(${num(p[0])}, ${num(p[1])})`;
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });
const M = (t) => { const e = ease(t); return [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e]; };
// x = A⁻¹b
const solve = () => { const d = A[0] * A[3] - A[1] * A[2]; return [(A[3] * b[0] - A[1] * b[1]) / d, (A[0] * b[1] - A[2] * b[0]) / d]; };

function seg(p, q, color, w = 1, dash = []) {
  const [x1, y1] = P(p), [x2, y2] = P(q);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w = 2.6) {
  const [x1, y1] = P([0, 0]), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.lineCap = 'butt';
}
// 箭头旁的名字是叠在画布上的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function tag(tex, at, color, dx, dy) {
  const [x, y] = P(at);
  name(tex, x + dx, y + dy, color);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const m = M(t), x = solve(), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 2;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .5;
  for (let k = -3 * R; k <= 3 * R; k++) {
    seg(ap(m, [k, -3 * R]), ap(m, [k, 3 * R]), k ? C.muted : C.text, k ? 1 : 1.6);
    seg(ap(m, [-3 * R, k]), ap(m, [3 * R, k]), k ? C.muted : C.text, k ? 1 : 1.6);
  }
  ctx.globalAlpha = 1;
  // 箭头尖走过的路：从出发点 x 到落点 b
  seg(x, b, C.muted, 1.6, [5, 5]);
  const [sx, sy] = P(x);
  ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 7); ctx.setLineDash([]);
  ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = C.muted; ctx.lineWidth = 2; ctx.stroke();
  const i = [m[0], m[2]], j = [m[1], m[3]];
  arrow(i, C.accent); arrow(j, C.blue);
  tag('\\hat\\imath', i, C['accent-ink'], 0, 18); tag('\\hat\\jmath', j, C.blue, -14, -10);
  arrow(ap(m, x), C.text);
  tag('\\mathbf{x}', x, C.muted, 16, 4); tag('\\mathbf{b}', b, C.text, 20, -12);
  knob.place();

  read.innerHTML =
    `<span>$\\mathbf{x} = A^{-1}\\mathbf{b} = ${pair(x)}$</span>` +
    `<span>$A\\mathbf{x} = ${num(x[0])}\\cdot\\htmlClass{i}{(2, 1)} + ${x[1] < -.004 ? `(${num(x[1])})` : num(x[1])}\\cdot\\htmlClass{j}{(-1, 1)} = ${pair(b)}$</span>`;
  range.value = Math.round(t * 1000);
  cv.setAttribute('aria-label', `落在 b = ${pair(b)} 上的是 x = ${pair(x)}`);
}

// to = 0 倒放回变换前，to = 1 正放到变换后
function run(to) {
  cancelAnimationFrame(raf);
  if (reduce) { t = to; return draw(); }
  const from = 1 - to, t0 = performance.now() + 200;
  const step = (now) => { const p = Math.max(0, Math.min(1, (now - t0) / 1700)); t = from + (to - from) * p; draw(); if (p < 1) raf = requestAnimationFrame(step); };
  t = from; draw(); raf = requestAnimationFrame(step);
}

const knob = (() => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'knob'; el.setAttribute('aria-label', '落点 b：拖动或用方向键移动');
  stage.append(el);
  const take = (p) => { cancelAnimationFrame(raf); t = 1; b = snap(p); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(U(e.clientX - r.left, e.clientY - r.top)); };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.onpointermove = move; });
  el.addEventListener('pointerup', () => { el.onpointermove = null; });
  el.addEventListener('pointercancel', () => { el.onpointermove = null; });
  el.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1;
    take([b[0] + d[0] * s, b[1] + d[1] * s]);
  });
  return { place() { const [x, y] = P(b); el.style.transform = `translate(${x}px, ${y}px)`; } };
})();

root.querySelector('.back').addEventListener('click', () => run(0));
root.querySelector('.fwd').addEventListener('click', () => run(1));
range.addEventListener('input', () => { cancelAnimationFrame(raf); t = range.value / 1000; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(260, Math.min(380, W * .6)));
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

倒放到头，箭头停在 $(1,2)$：$x=1$，$y=2$。

倒放也是一个变换，网格照样是直的、等距的，原点没动。它把每个落点送回出发点，叫 $A$ 的**逆矩阵**，记作 $A^{-1}$：

$$
A^{-1}A=I,\qquad \mathbf{x}=A^{-1}\mathbf{b}
$$

先做 $A$ 再做 $A^{-1}$，等于什么都没做。两步接着做的变换，倒放要反着来：$(AB)^{-1}=B^{-1}A^{-1}$。穿的时候先袜子后鞋，脱的时候先鞋后袜子。

二阶的逆有现成的式子：

$$
\begin{bmatrix}a&b\\c&d\end{bmatrix}^{-1}=\frac{1}{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}
$$

前面的 $\frac{1}{ad-bc}$ 是把面积缩回去：$A$ 把面积放大了 $\det A$ 倍，倒放就得缩小同样的倍数。$\det A=0$ 时这一项没法算，逆矩阵不存在。平面压扁以后，挤在同一个点上的那些向量各自从哪来，已经分不清了。

把 $\mathbf{b}$ 拖到别处，出发点跟着变，但始终只有一个。没被压扁的变换，每个落点都有唯一的来处。

### 同一个方程，三种读法

按行读，是两条直线求交点。按变换读，是找落在 $\mathbf{b}$ 上的那个 $\mathbf{x}$。还可以按列读：$A\mathbf{x}$ 是拿 $x$、$y$ 当配方去混 $A$ 的两列，所以方程也在问，这两列怎么配才能配出 $\mathbf{b}$。

$$
1\begin{bmatrix}2\\1\end{bmatrix}+2\begin{bmatrix}-1\\1\end{bmatrix}=\begin{bmatrix}0\\3\end{bmatrix}
$$

这两列就是讲基那张图里的橙色和蓝色箭头。回去把那张图的 $\mathbf{v}$ 拖到 $(0,3)$，底下读出来的配方正是 $(1,2)$。那张图一直在解方程组：**解 $A\mathbf{x}=\mathbf{b}$，就是求 $\mathbf{b}$ 在“$A$ 的各列”这组基下的坐标。**

真要解方程组，很少先求出 $A^{-1}$ 再去乘。高斯消元的每一步——把一行的若干倍加到另一行、给某一行乘个数、交换两行——各是一个简单的变换：剪切、伸缩、镜像。一步步做到 $A$ 变成 $I$，同样的步骤用在 $\mathbf{b}$ 上，$\mathbf{b}$ 就变成了解。这些小步骤接起来正好是 $A^{-1}$，消元是把倒放拆成一小步一小步来做。

## 秩、列空间、零空间：压扁以后

$\det A=0$ 的变换倒不回去，因为它丢了东西。丢的是什么，拿 $A=\begin{bmatrix}2&4\\1&2\end{bmatrix}$ 来看。它的第二列正好是第一列的两倍。

两列共线，怎么配都出不了 $(2,1)$ 所在的那条直线。播放一遍，再把 $\mathbf{b}$ 从虚线上拖开：

```render html
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
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
  .note { margin: 4px 0 0; min-height: 1.5em; color: var(--muted); font: 13px var(--font-mono); }
  .note b { color: var(--text); font-weight: 600; }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="秩 1 的矩阵把平面压成一条线：b 在线上有无穷多解，不在线上无解">
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
// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function dot(at, color, r = 5) { const [x, y] = P(at); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }

// 秩 1 时，b 落在列空间上才有解；k 是 b = k·(2, 1) 里的 k
const onLine = () => Math.abs(b[0] * col[1] - b[1] * col[0]) / Math.hypot(...col) < 1e-6;
const kOf = () => (b[0] * col[0] + b[1] * col[1]) / 5;

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (const el of tags.children) el.hidden = true;
  const m = M(t), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1, L = 40;
  let said;
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
      said = `无穷多解：x = ${vec(p0)} + s·(2, −1)`;
      note.innerHTML = `<b>无穷多解</b>　$\\mathbf{x} = ${vec(p0)} + s\\,(2, -1)$`;
    } else {
      said = '无解：b 不在列空间上';
      note.innerHTML = '<b>无解</b>　$\\mathbf{b}$ 不在列空间上';
    }
    read.innerHTML = `<span><small>秩</small>1</span><span><small>列空间</small>过 $(2, 1)$ 的直线</span><span><small>零空间</small>过 $(2, -1)$ 的直线</span>`;
  } else {
    const A = mats[2], d = A[0] * A[3] - A[1] * A[2];
    const x = [(A[3] * b[0] - A[1] * b[1]) / d, (A[0] * b[1] - A[2] * b[0]) / d];
    dot(ap(m, x), C.accent, 6);
    if (t < .98) { const [px, py] = P(ap(m, x)); name('\\mathbf{x}', px + 15, py - 11, C['accent-ink']); }
    said = `唯一解：x = ${vec(x)}`;
    note.innerHTML = `<b>唯一解</b>　$\\mathbf{x} = ${vec(x)}$`;
    read.innerHTML = `<span><small>秩</small>2</span><span><small>列空间</small>整个平面</span><span><small>零空间</small>只有原点</span>`;
  }
  dot([0, 0], C.text, 2.5);
  const [bx, by] = P(b); name('\\mathbf{b}', bx + 19, by - 13, C.text);
  knob.place();
  range.value = Math.round(t * 1000);
  cv.setAttribute('aria-label', said);
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

$A$ 的输出永远是它各列的线性组合。所以全部可能的输出，就是各列张成的那块空间，叫**列空间**。把矩阵当函数看，它是值域。这里是那条虚线。

列空间有几维，叫矩阵的**秩**，也就是变换之后空间还剩几维。二阶矩阵秩是 2，平面还是平面；秩是 1，压成一条线；秩是 0 的只有零矩阵。方阵的秩等于阶数，叫满秩，一维都没丢。图上可以切到一个满秩的矩阵对比。

橙线上的向量全被压到了原点。满足 $A\mathbf{x}=\mathbf{0}$ 的所有 $\mathbf{x}$ 合起来叫**零空间**，是被这个变换抹掉的方向。满秩的时候，零空间里只有原点自己。

蓝线都和零空间平行，每一条被压成列空间上的一个点。于是压扁之后，$A\mathbf{x}=\mathbf{b}$ 只剩两种结局：

- $\mathbf{b}$ 不在列空间上，没有哪个输入能落到那里，无解；
- $\mathbf{b}$ 在列空间上，落到它上面的是一整条线，无穷多解。

第二种情况里，那条线是零空间平移出来的。设 $A\mathbf{x}_0=\mathbf{b}$，$\mathbf{n}$ 是零空间里的任意一个向量：

$$
A(\mathbf{x}_0+\mathbf{n})=A\mathbf{x}_0+A\mathbf{n}=\mathbf{b}+\mathbf{0}=\mathbf{b}
$$

**通解 = 一个特解 + 整个零空间。**

这个结构其实早就见过：

$$
\int 2x\,\mathrm{d}x=x^2+C
$$

求导守那两条规矩，$(f+g)'=f'+g'$，$(cf)'=cf'$，它是线性的。它把所有常数函数都压成 0，零空间就是常数函数。“哪个函数求导得 $2x$”的答案，是一个特解 $x^2$，加上整个零空间 $C$。

### 维数对得上账

这个例子里，输入 2 维，列空间 1 维，零空间 1 维。对任何 $m\times n$ 的矩阵都有

$$
\underbrace{n}_{\text{输入的维数}}=\underbrace{\operatorname{rank}A}_{\text{留下来的}}+\underbrace{\dim\operatorname{Null}A}_{\text{压没了的}}
$$

输入的每一维，要么进了输出，要么被压没了。

压掉的那几维找不回来。拍照（先不管透视）是一个从三维到二维的变换，零空间是视线方向，远近就丢在这个方向上。单凭一张照片算不出物体离镜头多远，得靠第二只眼睛或者别的线索补。

### 不是方的矩阵

到这里矩阵都是方的，输入输出一样多维。$m\times n$ 的矩阵有 $n$ 列，每列 $m$ 个数：吃 $n$ 维，吐 $m$ 维。

- $3\times2$：两个基向量各自落进三维空间，整张平面成了三维里一张斜放的面。列空间最多二维，三维里绝大多数 $\mathbf{b}$ 都够不着。方程比未知数多的方程组通常无解，说的就是这个。
- $2\times3$：三维压进平面，零空间至少一维。把三维场景画到屏幕上属于这一类。
- $1\times n$：$n$ 维送到一条数轴上，每个向量变成一个数。下一节的点积就是它。

## 点积：把一个向量当尺子

点积有两个定义，看着不相干：

$$
\mathbf{u}\cdot\mathbf{v}=u_xv_x+u_yv_y=\lVert\mathbf{u}\rVert\,\lVert\mathbf{v}\rVert\cos\theta
$$

左边是对应相乘再相加，右边是长度乘长度再乘夹角的余弦。课本拿余弦定理证它俩相等，证完还是不知道为什么。

换成变换来看。取一个单位向量 $\mathbf{u}$，沿它画一条数轴，当一把尺子。“把向量垂直投到尺子上，读出刻度”是一个从平面到数轴的函数。它守那两条规矩：两个向量先相加再投，和各自投完再把读数相加，是一回事。所以它也有矩阵，一行两列，两个数分别是 $\hat\imath$ 和 $\hat\jmath$ 的读数。

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .stage { position: relative; }
  .stage canvas { display: block; width: 100%; touch-action: pan-y; }
  .knob { position: absolute; left: 0; top: 0; width: 36px; height: 36px; margin: -18px 0 0 -18px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--text); cursor: grab; touch-action: none; }
  .knob::after { content: ""; position: absolute; inset: 11px; border: 2px solid currentColor; border-radius: 50%; background: var(--bg); }
  .knob:active { cursor: grabbing; }
  .scrub { display: flex; align-items: center; gap: 12px; min-height: 36px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .scrub output { min-width: 3em; color: var(--text); font: 13px var(--font-mono); }
  .read { display: flex; flex-wrap: wrap; gap: 2px 22px; margin-top: 4px; font: 13px var(--font-mono); }
  .i { color: var(--accent-ink); } .j { color: var(--blue); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="点积：沿 u 放一把尺子，î、ĵ 的读数是 u 的两个坐标，v 的读数是点积">
  <div class="stage"><canvas role="img"></canvas></div>
  <label class="scrub"><span>尺子方向</span><input type="range" min="0" max="180" value="37" aria-label="尺子的方向，单位是度" /><output>37°</output></label>
  <div class="read"></div>
</section>
<script>
const root = document.querySelector('.la');
const stage = root.querySelector('.stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), deg = root.querySelector('output'), read = root.querySelector('.read');
const C = {};
let W = 0, H = 0, S = 50;
let u = [.8, .6], v = [2, 1];

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'rule', 'accent', 'accent-ink', 'bg', 'blue']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const P = ([x, y]) => [W / 2 + x * S, H / 2 - y * S];
const U = (px, py) => [(px - W / 2) / S, (H / 2 - py) / S];
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const sg = (x) => (x < -.004 ? `(${num(x)})` : num(x));
const snap = (p) => p.map((q, k) => { const lim = (k ? H : W) / 2 / S - .4, r = Math.round(q), s = Math.abs(q - r) < .15 ? r : Math.round(q * 10) / 10; return Math.max(-lim, Math.min(lim, s)); });
// 向量在尺子上的读数，和它投到尺子上的落脚点
const along = (p) => p[0] * u[0] + p[1] * u[1];
const foot = (p) => { const k = along(p); return [k * u[0], k * u[1]]; };

function seg(p, q, color, w = 1, dash = []) {
  const [x1, y1] = P(p), [x2, y2] = P(q);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke();
}
function arrow(to, color, w) {
  const [x1, y1] = P([0, 0]), [x2, y2] = P(to), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(12, L * .5), bx = x2 - ux * h, by = y2 - uy * h;
  ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx - uy * h * .45, by + ux * h * .45); ctx.lineTo(bx + uy * h * .45, by - ux * h * .45);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.lineCap = 'butt';
}
// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
// 标签放在箭头尖再往外一点
function tag(tex, at, color) {
  const [x, y] = P(at), [ox, oy] = P([0, 0]), L = Math.hypot(x - ox, y - oy) || 1;
  name(tex, x + (x - ox) / L * 18, y + (y - oy) / L * 18, color);
}
function drop(p, color) {
  const f = foot(p), [x, y] = P(f);
  seg(p, f, color, 1.4, [4, 4]);
  ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = color; ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  // 尺子：过原点、沿 u 的数轴，每隔一个单位一道刻度
  seg([-R * u[0], -R * u[1]], [R * u[0], R * u[1]], C.muted, 1.6);
  for (let k = -R; k <= R; k++) {
    const c = [k * u[0], k * u[1]], n = [-u[1] * .12, u[0] * .12], [x, y] = P(c);
    seg([c[0] - n[0], c[1] - n[1]], [c[0] + n[0], c[1] + n[1]], C.muted, 1.4);
    ctx.fillStyle = C.muted; ctx.font = '11px JetBrains Mono Variable, monospace';
    ctx.fillText(String(k).replace('-', '−'), x + u[1] * 16, y + u[0] * 16);
  }
  drop([1, 0], C.accent); drop([0, 1], C.blue); drop(v, C.text);
  arrow(u, C.muted, 3.2);
  const [tx, ty] = P(u);
  name('\\mathbf{u}', tx - u[1] * 16, ty - u[0] * 16, C.muted);
  arrow([1, 0], C.accent, 2.4); arrow([0, 1], C.blue, 2.4); arrow(v, C.text, 2.6);
  tag('\\hat\\imath', [1, 0], C['accent-ink']); tag('\\hat\\jmath', [0, 1], C.blue); tag('\\mathbf{v}', v, C.text);
  knob.place();

  const d = along(v);
  read.innerHTML =
    `<span class="i">$\\hat\\imath \\to ${num(u[0])}$</span><span class="j">$\\hat\\jmath \\to ${num(u[1])}$</span>` +
    `<span>$\\mathbf{v} \\to ${num(v[0])}\\cdot\\htmlClass{i}{${sg(u[0])}} + ${sg(v[1])}\\cdot\\htmlClass{j}{${sg(u[1])}} = \\mathbf{${num(d)}}$</span>`;
  cv.setAttribute('aria-label', `尺子沿 (${num(u[0])}, ${num(u[1])})：î 读数 ${num(u[0])}，ĵ 读数 ${num(u[1])}，v 读数 ${num(d)}`);
}

const knob = (() => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'knob'; el.setAttribute('aria-label', 'v：拖动或用方向键移动');
  stage.append(el);
  const take = (p) => { v = snap(p); draw(); };
  const move = (e) => { const r = cv.getBoundingClientRect(); take(U(e.clientX - r.left, e.clientY - r.top)); };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.onpointermove = move; });
  el.addEventListener('pointerup', () => { el.onpointermove = null; });
  el.addEventListener('pointercancel', () => { el.onpointermove = null; });
  el.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? 1 : .1;
    take([v[0] + d[0] * s, v[1] + d[1] * s]);
  });
  return { place() { const [x, y] = P(v); el.style.transform = `translate(${x}px, ${y}px)`; } };
})();

range.addEventListener('input', () => {
  const a = range.value * Math.PI / 180;
  u = [Math.round(Math.cos(a) * 100) / 100, Math.round(Math.sin(a) * 100) / 100];
  deg.textContent = `${range.value}°`;
  draw();
});

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(250, Math.min(360, W * .56)));
  S = H / 5.4;
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(stage);
</script>
```

$\hat\imath$ 在尺子上的读数是多少？$\hat\imath$ 和 $\mathbf{u}$ 都是单位长，谁投到谁身上，长度都是夹角的余弦。$\mathbf{u}$ 投到 $\hat\imath$ 上，量出来的就是 $\mathbf{u}$ 的横坐标 $u_x$，所以 $\hat\imath$ 的读数也是 $u_x$。同理 $\hat\jmath$ 的读数是 $u_y$。这把尺子的矩阵是 $\begin{bmatrix}u_x&u_y\end{bmatrix}$，任何向量的读数跟着就有了：

$$
\begin{bmatrix}u_x&u_y\end{bmatrix}\begin{bmatrix}v_x\\v_y\end{bmatrix}=u_xv_x+u_yv_y
$$

对应相乘再相加，算出来的是 $\mathbf{v}$ 投在 $\mathbf{u}$ 方向上的长度，也就是 $\lVert\mathbf{v}\rVert\cos\theta$。$\mathbf{u}$ 不是单位长的话，读数再乘上 $\lVert\mathbf{u}\rVert$。两个定义对上了。

读数的正负也有用：同向为正，垂直为 0，反向为负。漫反射光照的亮度正比于 $\max(0,\mathbf{n}\cdot\mathbf{l})$，表面的法向 $\mathbf{n}$ 正对着光的方向 $\mathbf{l}$ 时最亮，侧过去变暗，背过去全黑。搜索和推荐里的余弦相似度，是两个向量各自缩成单位长之后的点积。[Transformer 的注意力](/posts/transformer/)拿 $\mathbf{q}\cdot\mathbf{k}$ 打分，量的也是两个向量对得多准。

### 向量躺下来，就是一把尺子

刚才 $\mathbf{u}$ 被横过来写成了一行 $\begin{bmatrix}u_x&u_y\end{bmatrix}$，从一支箭头变成了一个把向量变成数的函数。把列改写成行叫**转置**，记作 $\mathbf{u}^\top$，所以点积也写成 $\mathbf{u}^\top\mathbf{v}$。

反过来，随便哪个从平面到数轴的线性函数，矩阵都是一行两个数（三维就是一行三个），把这一行竖起来就是一个向量。向量和这种“量一下”的函数一个对一个，数学上叫对偶。下一节的叉积要用到它。

矩阵也能转置，行列对调。$A^\top$ 和点积的关系是

$$
(A\mathbf{x})\cdot\mathbf{y}=\mathbf{x}\cdot(A^\top\mathbf{y})
$$

先把 $\mathbf{x}$ 搬过去再拿 $\mathbf{y}$ 这把尺子量，和把尺子用 $A^\top$ 拉回来、直接量原来的 $\mathbf{x}$，读数一样。

旋转和镜像不改长度和夹角，所以不改点积：$(Q\mathbf{x})\cdot(Q\mathbf{y})=\mathbf{x}\cdot\mathbf{y}$。套进上面的式子得到 $Q^\top Q=I$，也就是 $Q^{-1}=Q^\top$。这种矩阵叫正交矩阵，各列是互相垂直的单位向量。旋转的逆不用算，行列对调一下就是。

## 叉积：把体积认成一个向量

先看二维。两个平面向量的叉积是一个数，它俩围成的平行四边形的有向面积：

$$
\mathbf{v}\times\mathbf{w}=v_xw_y-v_yw_x=\det\begin{bmatrix}v_x&w_x\\v_y&w_y\end{bmatrix}
$$

就是把 $\mathbf{v}$、$\mathbf{w}$ 当成 $\hat\imath$、$\hat\jmath$ 的落点，算行列式。正号是 $\mathbf{w}$ 在 $\mathbf{v}$ 的逆时针一侧，负号是顺时针一侧。计算几何里判断点在线段哪一边、求凸包、判断两条线段相不相交，用的都是这一行：

```cpp
// > 0：b 在 o→a 的左边；< 0：右边；= 0：三点共线
long long cross(P o, P a, P b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
```

三维的叉积是一个向量：垂直于 $\mathbf{v}$ 和 $\mathbf{w}$，长度等于它俩围成的平行四边形的面积，朝哪边按右手定则。算它的式子，通常写成一个古怪的行列式：

$$
\mathbf{v}\times\mathbf{w}=\det\begin{bmatrix}\hat\imath&v_x&w_x\\\hat\jmath&v_y&w_y\\\hat k&v_z&w_z\end{bmatrix}
$$

第一列放的是三个向量，不是数。这算哪门子行列式？算出来又凭什么刚好垂直，长度刚好是面积？

用上一节的对偶。固定 $\mathbf{v}$、$\mathbf{w}$，看这个函数：

$$
f(\mathbf{x})=\det\begin{bmatrix}\mathbf{x}&\mathbf{v}&\mathbf{w}\end{bmatrix}
$$

它是 $\mathbf{x}$、$\mathbf{v}$、$\mathbf{w}$ 撑起来的平行六面体的有向体积。行列式对每一列都是线性的，所以 $f$ 是一个从三维到数轴的线性函数，一把尺子。按对偶，它一定是在和某个固定的向量 $\mathbf{p}$ 做点积：$f(\mathbf{x})=\mathbf{p}\cdot\mathbf{x}$。这个 $\mathbf{p}$ 就是 $\mathbf{v}\times\mathbf{w}$。

垂直和长度都能从体积里读出来。体积是底面积乘高：底是 $\mathbf{v}$、$\mathbf{w}$ 围成的平行四边形，高是 $\mathbf{x}$ 垂直于底面的那一份。而 $\mathbf{p}\cdot\mathbf{x}$ 是 $\mathbf{x}$ 投在 $\mathbf{p}$ 方向上的长度，再乘 $\lVert\mathbf{p}\rVert$。两边要对每一个 $\mathbf{x}$ 都相等，$\mathbf{p}$ 只能垂直于底面，长度只能等于底面积。

那个古怪的行列式，是把 $f(\mathbf{x})$ 按 $\mathbf{x}$ 那一列展开，$x$、$y$、$z$ 前面的系数就是 $\mathbf{p}$ 的三个分量。第一列写上 $\hat\imath$、$\hat\jmath$、$\hat k$ 只是个记号，意思是这一列留着放 $\mathbf{x}$。展开是

$$
\mathbf{v}\times\mathbf{w}=(v_yw_z-v_zw_y,\;v_zw_x-v_xw_z,\;v_xw_y-v_yw_x)
$$

画面可以拖着转。让 $\mathbf{w}$ 转一圈，再点“加上 $\mathbf{x}$”：

```render html
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; --blue-soft: rgb(149 191 220 / .16); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .bar label { display: flex; flex: 1; min-width: 180px; align-items: center; gap: 10px; color: var(--muted); font-size: 12px; }
  .bar input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .stage { position: relative; margin-top: 8px; }
  canvas { display: block; width: 100%; cursor: grab; touch-action: pan-y; }
  canvas:active { cursor: grabbing; }
  .read { display: grid; gap: 2px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="叉积 v×w 垂直于 v、w 围成的平行四边形，长度等于它的面积">
  <div class="bar">
    <button type="button" class="key pause">转动 $\mathbf{w}$</button>
    <button type="button" class="key vol" aria-pressed="false">加上 $\mathbf{x}$</button>
    <label><span>$\mathbf{w}$ 的方向</span><input type="range" min="0" max="628" value="110" aria-label="w 绕竖轴转过的角度" /></label>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <div class="read"></div>
</section>
<script>
const root = document.querySelector('.la');
const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
const range = root.querySelector('input'), pauseBtn = root.querySelector('.pause'), volBtn = root.querySelector('.vol');
const C = {};
let W = 0, H = 0, S = 60, yaw = .55, pitch = .38, th = 1.1, running = false, visible = false, vol = false, raf = 0, last = 0;
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
// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = cv.parentNode.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function label(tex, at, color, dx = 8, dy = -4) {
  const [px, py] = P(at);
  name(tex, px + dx, py + dy, color, '0, -100%');
}
function face(pts, fill, alpha) {
  ctx.beginPath(); pts.map(P).forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (const el of tags.children) el.hidden = true;
  for (let k = -3; k <= 3; k++) { seg([k, -3, 0], [k, 3, 0], C.rule); seg([-3, k, 0], [3, k, 0], C.rule); }
  seg([0, 0, 0], [3.2, 0, 0], C['rule-strong'], 1.4); seg([0, 0, 0], [0, 3.2, 0], C['rule-strong'], 1.4); seg([0, 0, 0], [0, 0, 2.6], C['rule-strong'], 1.4);
  ctx.font = 'italic 14px KaTeX_Math, serif'; ctx.fillStyle = C.faint;
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
    arrow(x, C.muted, 2.2); label('\\mathbf{x}', x, C.muted);
    extra = `<span><small>体积 = 底面积 × 高 = </small>$${num(area)} \\times ${num(h)} = ${num(area * h)}$</span><span>$(\\mathbf{v}\\times\\mathbf{w})\\cdot\\mathbf{x} = ${num(V)}$<small>，两者相等</small></span>`;
  }
  arrow(v, C.accent); arrow(w, C.blue); arrow(p, C.text, 2.8);
  label('\\mathbf{v}', v, C['accent-ink']); label('\\mathbf{w}', w, C.blue); label('\\mathbf{v}\\times\\mathbf{w}', p, C.text);

  const ang = Math.acos(Math.max(-1, Math.min(1, dotp(v, w) / len(v) / len(w))));
  root.querySelector('.read').innerHTML =
    `<span>$\\mathbf{v}\\times\\mathbf{w} = ${vec(p)}$</span>` +
    `<span><small>长度 </small>$${num(area)} = \\lVert\\mathbf{v}\\rVert\\,\\lVert\\mathbf{w}\\rVert\\sin\\theta = ${num(len(v))} \\times ${num(len(w))} \\times ${num(Math.sin(ang))}$</span>` + extra;
  cv.setAttribute('aria-label', `v×w = ${vec(p)}，长度 ${num(area)}`);
  range.value = Math.round(((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 100);
}

function loop(now) {
  if (last) th += (now - last) / 1000 * .6;
  last = now; draw();
  raf = running && visible ? requestAnimationFrame(loop) : 0;
}
function kick() { if (running && visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } }
pauseBtn.addEventListener('click', () => { running = !running; pauseBtn.textContent = running ? '暂停' : '转动 $\\mathbf{w}$'; if (!running) { cancelAnimationFrame(raf); raf = 0; } kick(); });
volBtn.addEventListener('click', () => { vol = !vol; volBtn.setAttribute('aria-pressed', String(vol)); draw(); });
range.addEventListener('input', () => { running = false; pauseBtn.textContent = '转动 $\\mathbf{w}$'; cancelAnimationFrame(raf); raf = 0; th = range.value / 100; draw(); });

let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw = drag[2] - (e.clientX - drag[0]) * .01;
  pitch = Math.max(-.1, Math.min(1.3, drag[3] + (e.clientY - drag[1]) * .01));
  draw();
});
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('pointercancel', () => { drag = null; });

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

$\mathbf{w}$ 转到和 $\mathbf{v}$ 共线，平行四边形压成一条线，$\mathbf{v}\times\mathbf{w}$ 缩成零；转过去以后，它从另一侧伸出来。加上 $\mathbf{x}$ 之后，“底面积乘高”和 $(\mathbf{v}\times\mathbf{w})\cdot\mathbf{x}$ 两个数一直相等。

三角形的法向量是它两条边的叉积，算光照要用。顶点按逆时针还是顺时针排，决定了法向朝外还是朝里，渲染时靠这个剔掉背对相机的面。相机的“右”方向，是视线方向和“上”方向的叉积。物理里的力矩、角动量也是它。

## 换一组基：翻译，干活，再翻回来

回到讲基那张图。$\mathbf{b}_1=(2,1)$、$\mathbf{b}_2=(-1,1)$，假设有人就用这组基描述一切。他说的 $(1,1)$，是我们的 $(1,2)$。

把他的坐标翻成我们的：他的 $(c_1,c_2)$ 是 $c_1\mathbf{b}_1+c_2\mathbf{b}_2$，照着算出来就行。这是一次矩阵乘向量：

$$
P=\begin{bmatrix}2&-1\\1&1\end{bmatrix},\qquad
P\begin{bmatrix}1\\1\end{bmatrix}=\begin{bmatrix}1\\2\end{bmatrix}
$$

$P$ 的两列，是他的基向量用我们的坐标写出来的样子。$P$ 把他的话翻成我们的，$P^{-1}$ 反过来。

现在要把“逆时针转 90°”这个变换告诉他。在我们这边它是 $M=\begin{bmatrix}0&-1\\1&0\end{bmatrix}$。他报一个向量过来，先用 $P$ 翻成我们的坐标，用 $M$ 转，再用 $P^{-1}$ 翻回去：

$$
P^{-1}MP=\frac13\begin{bmatrix}1&1\\-1&2\end{bmatrix}\begin{bmatrix}0&-1\\1&0\end{bmatrix}\begin{bmatrix}2&-1\\1&1\end{bmatrix}=\frac13\begin{bmatrix}1&-2\\5&-1\end{bmatrix}
$$

还是从右往左读：翻译，干活，翻回来。

四个数全变了，说的却是同一个旋转。行列式是 $\frac19(-1+10)=1$，对角线上两个数的和（叫迹）是 0，都和 $M$ 一样。行列式、迹、秩是变换自己的东西，换一组基来描述，它们不变。$P^{-1}MP$ 和 $M$ 叫相似矩阵。

同一个变换，在有的基下写出来乱糟糟，在有的基下很干净。哪组基最干净？

## 特征向量：没被转走的方向

看一个变换的时候，盯住一支向量，和它躺着的那条过原点的直线。多数向量变换完就离开了自己那条线，被转到别处去了。有些不会：变换之后还在原来那条线上，只是长了、短了，或者掉了个头。

$$
A\mathbf{v}=\lambda\mathbf{v}
$$

这样的 $\mathbf{v}$ 叫**特征向量**，$\lambda$ 叫**特征值**，是它伸缩的倍数。$\lambda$ 是负的就是掉头；是 0，这个方向被压没了，$\mathbf{v}$ 在零空间里。

一圈箭头，播放时看哪几支始终没离开自己那条线：

```render html
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
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
  .note { margin: 2px 0 0; min-height: 1.5em; color: var(--muted); }
  .l1 { color: var(--accent-ink); } .l2 { color: var(--blue); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="特征向量：变换前后还留在自己那条直线上的箭头">
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

// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(key, tex, x, y, color, shift = '-50%, -50%') {
  let el = names[key];
  if (!el) keep.observe(el = names[key] = tags.appendChild(document.createElement('span')));
  if (el.tex !== tex) { el.tex = tex; el.textContent = `$${tex}$`; }
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
// 系数带着自己的符号：+ 3 或 - 3
const signed = (x) => (x < -.004 ? `- ${num(-x)}` : `+ ${num(x)}`);

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (const el of tags.children) el.hidden = true;
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
    name(k, `\\lambda = ${num(e.l)}`, Math.max(36, Math.min(W - 36, lx + 30)), Math.max(16, Math.min(H - 12, ly - 12)), inks[k]);
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
  read.innerHTML = `<small>$\\lambda^2 ${signed(-2 * E.m)}\\lambda ${signed(E.p)} = 0$　→　</small>` +
    (E.disc < -1e-9 ? `$\\lambda = ${num(E.m)} \\pm ${num(Math.sqrt(-E.disc))}i$` : E.list.map((e, k) => `<span class="l${k + 1}">$\\lambda${E.list.length > 1 ? `_${k + 1}` : ''} = ${num(e.l)}$</span>`).join('　'));
  note.textContent = E.disc < -1e-9
    ? '没有实特征方向，每支箭头都被转走了'
    : all ? '每个方向都是特征方向'
      : E.list.length === 1 ? '只有一条特征直线'
        : '两条特征直线';
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

第一个例子是 $A=\begin{bmatrix}3&1\\0&2\end{bmatrix}$，有两条特征直线。$x$ 轴上的向量拉长到 3 倍：$A(1,0)=(3,0)$。过 $(-1,1)$ 的那条线上，拉长到 2 倍：$A(-1,1)=(-2,2)$。其余的箭头都被转离了原来的方向。

### 怎么找

把 $A\mathbf{v}=\lambda\mathbf{v}$ 移个项：$(A-\lambda I)\mathbf{v}=\mathbf{0}$。要有不是零的 $\mathbf{v}$ 满足它，$A-\lambda I$ 这个变换就得把某个方向压成零，也就是把空间压扁：

$$
\det(A-\lambda I)=0
$$

前面几节在这里接上了：**特征值是让 $A-\lambda I$ 行列式为零的那些 $\lambda$，特征向量是这时候 $A-\lambda I$ 的零空间。**

二阶的展开是 $\lambda^2-(a+d)\lambda+(ad-bc)=0$。$a+d$ 是迹，$ad-bc$ 是行列式，所以两个特征值加起来等于迹，乘起来等于行列式。乘积等于行列式这一条，画面上也看得出：沿两个特征方向各拉 $\lambda_1$、$\lambda_2$ 倍，面积放大 $\lambda_1\lambda_2$ 倍。

上面那个 $A$：迹是 5，行列式是 6，$\lambda^2-5\lambda+6=0$，解出 3 和 2。

另外三个例子：

- “对称”是 $\begin{bmatrix}2&1\\1&2\end{bmatrix}$，两条特征直线互相垂直。这不是碰巧，后面讲。
- “剪切”只有一条特征直线，$\lambda=1$ 是重根。特征向量凑不出一组基。
- “旋转”没有实的特征向量，每支箭头都被转走了。方程是 $\lambda^2+1=0$，$\lambda=\pm i$。解出复数的特征值，就是这个变换里带着旋转。

## 对角化：站到特征方向上看

特征向量凑得出一组基，就拿它们当基。在这组基下，变换只是沿每根轴各自伸缩，没有转也没有推斜，矩阵是对角的：

$$
A=PDP^{-1},\qquad
P=\begin{bmatrix}1&-1\\0&1\end{bmatrix},\quad
D=\begin{bmatrix}3&0\\0&2\end{bmatrix}
$$

$P$ 的两列是两个特征向量。从右往左读还是上一节那三步：翻到特征基，各轴伸缩，翻回来。“哪组基最干净”，答案是这组。

好处在连着乘。同一个变换做 100 次，中间的 $P^{-1}P$ 一对对消掉：

$$
A^{100}=PD^{100}P^{-1},\qquad D^{100}=\begin{bmatrix}3^{100}&0\\0&2^{100}\end{bmatrix}
$$

在特征基里，做 100 次就是每根轴各自伸缩 100 次。

### 斐波那契

斐波那契数列，后一项是前两项之和，写成矩阵：

$$
\begin{bmatrix}F_{n+1}\\F_n\end{bmatrix}=\begin{bmatrix}1&1\\1&0\end{bmatrix}\begin{bmatrix}F_n\\F_{n-1}\end{bmatrix}
$$

每往后一项，就是乘一次这个矩阵。它的特征方程是 $\lambda^2-\lambda-1=0$，两个根是黄金比例 $\varphi=\frac{1+\sqrt5}{2}\approx1.618$ 和 $\psi=\frac{1-\sqrt5}{2}\approx-0.618$，特征向量是 $(\varphi,1)$ 和 $(\psi,1)$。

把起点 $(F_1,F_0)=(1,0)$ 拆成两个特征向量的组合：

$$
\begin{bmatrix}1\\0\end{bmatrix}=\frac1{\sqrt5}\left(\begin{bmatrix}\varphi\\1\end{bmatrix}-\begin{bmatrix}\psi\\1\end{bmatrix}\right)
$$

乘 $n$ 次矩阵，两部分各自乘上 $\varphi^n$、$\psi^n$。看第二个分量：

$$
F_n=\frac{\varphi^n-\psi^n}{\sqrt5}
$$

式子里全是无理数，算出来每一项都是整数。$|\psi|<1$，$\psi^n$ 很快就小得可以不管，所以 $F_n$ 就是 $\varphi^n/\sqrt5$ 四舍五入，相邻两项的比值趋向 $\varphi$。

### 乘很多次：都贴到一条线上

这里头有个更一般的现象。随便取一个向量，拆成两个特征向量的组合。每乘一次，$\varphi$ 那部分变成 1.618 倍，$\psi$ 那部分缩到 0.618 倍，还换一次符号。乘上几次，$\psi$ 那部分就不剩什么了，向量几乎整个躺在 $\varphi$ 的特征方向上。

十几支朝向各不相同的向量，反复乘斐波那契矩阵。箭头只画方向，长度都画成一样：

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key:disabled { opacity: .5; cursor: default; }
  .count { margin-left: auto; color: var(--muted); font: 13px var(--font-mono); }
  .stage { position: relative; margin-top: 8px; }
  canvas { display: block; width: 100%; }
  .read { display: grid; gap: 2px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="反复乘同一个矩阵，各个方向的箭头都贴向主特征方向">
  <div class="bar">
    <button type="button" class="key once">再乘一次 $A$</button>
    <button type="button" class="key auto">连续乘</button>
    <button type="button" class="key reset">重来</button>
    <span class="count"></span>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
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
// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = cv.parentNode.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
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
  const [ax, ay] = P(e1.map((x) => 3.9 * x)), [bx, by] = P(e2.map((x) => 3.6 * x));
  name('\\lambda = \\varphi \\approx 1.618', ax + 8, ay, C['accent-ink'], '0, -50%');
  name('\\lambda = \\psi \\approx -0.618', bx - 8, by, C.blue, '-100%, -50%');

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
  root.querySelector('.count').textContent = `乘了 ${n} 次`;
  root.querySelector('.read').innerHTML =
    `<span><small>黑色 </small>$(${v0[0]}, ${v0[1]})$${n ? `<small>　比值 </small>$${num(v0[0] / v0[1], 6)}$` : ''}</span>` +
    `<span><small>最远的一支还差 </small>$${num(worst, 2)}^\\circ$</span>`;
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

乘五六次，箭头全贴到了橙色虚线上；之后每多乘一次，剩下的偏差缩到原来的 $|\psi/\varphi|\approx0.38$ 倍。黑色那支的坐标就是 $(F_{n+1},F_n)$。只有一种起点例外：正好落在蓝线上的向量，一点 $\varphi$ 的成分都没有，只会越乘越短。

同一个变换反复做，几乎任何起点都被拉向特征值绝对值最大的那个特征方向。拿这一点来求特征向量，叫幂迭代。

### PageRank

早期 Google 给网页排序，用的就是幂迭代。

设想一个人在网上乱点链接。每个网页把自己的重要性平均分给它链出去的网页；一个网页的重要性，是所有链向它的网页分给它的总和。把全部网页的重要性排成向量 $\mathbf{r}$，链接关系写成矩阵 $M$：

$$
\mathbf{r}=M\mathbf{r}
$$

重要性向量是链接矩阵的一个特征向量，特征值为 1。

真实的网络有两个麻烦：有的网页没有链出去的链接，重要性没处去；有的网页互相链成小圈子，进去就出不来。PageRank 的处理是，没有出链的网页当它链向所有网页；再让这个人每一步有 15% 的概率不点链接，随机跳到任意一个网页。改完的矩阵每个数都是正的，每一列加起来是 1。Perron–Frobenius 定理保证这样的矩阵最大的特征值正好是 1，对应的特征方向只有一个，各分量全为正。

算法就是上面那张图：随便取一个初始向量，反复乘，几十次就不怎么动了。几十亿个网页的矩阵根本存不下来，但幂迭代不用存矩阵。它只要能算“给一个 $\mathbf{r}$，$M\mathbf{r}$ 是多少”，而这只是顺着每条链接把数加一遍。矩阵是一个函数，这里只用到了它作为函数的那一面。

## 对称矩阵：特征方向互相垂直

沿对角线对折，两边的数相同，$A^\top=A$，这样的矩阵叫对称矩阵。它们有一条好性质，叫谱定理：特征值都是实数，而且总能挑出一组互相垂直的单位特征向量。

$$
A=Q\Lambda Q^\top
$$

$Q$ 的各列是这组特征向量，是个正交矩阵；$\Lambda$ 是对角的。画面上，对称矩阵干的事就是沿几根互相垂直的轴各自伸缩，没有转，也没有推斜。特征向量那张图里的 $\begin{bmatrix}2&1\\1&2\end{bmatrix}$ 就是：沿 $(1,1)$ 拉到 3 倍，沿 $(1,-1)$ 不动。

数据的协方差矩阵是对称的，它的特征向量是数据散得最开的几个方向，主成分分析（PCA）找的就是它们。还有一种对称矩阵来得不费力：随便什么矩阵 $A$，$A^\top A$ 都是对称的。

## 奇异值分解：转一下，拉一下，再转一下

特征值有它管不了的：旋转没有实的特征向量，剪切凑不齐一组基，不是方的矩阵压根没有特征值。对什么矩阵都管用的拆法是奇异值分解（SVD）：

$$
A=U\Sigma V^\top
$$

$V^\top$ 和 $U$ 是旋转（也可能带一次镜像），$\Sigma$ 是对角的，对角线上的 $\sigma_1\ge\sigma_2\ge\cdots\ge0$ 叫奇异值。**任何一个线性变换，都能拆成三步：先转，沿坐标轴伸缩，再转。**

单位圆经过一个没压扁的变换，变成一个椭圆。$\sigma_1$、$\sigma_2$ 是椭圆的两个半轴长；$V$ 的两列是输入里那两个互相垂直、正好被送到椭圆两根轴上的方向；$U$ 的两列是那两根轴的方向。

剪切看着跟“转、拉、转”一点不沾边。拆开看：

```render html
<style>
  .la { --blue: #356f9b; --blue-soft: rgb(53 111 155 / .14); font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
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
  .steps div > span { font-size: 12px; }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
  .scrub { display: flex; align-items: center; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .scrub input { flex: 1; min-width: 0; accent-color: var(--accent); }
</style>
<section class="la" aria-label="任何矩阵都能拆成三步：转，沿坐标轴拉伸，再转">
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
// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = stage.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
}
function label(tex, at, color, from = [0, 0]) {
  if (!tex) return;
  const [x, y] = P(at), [ox, oy] = P(from), L = Math.hypot(x - ox, y - oy) || 1;
  name(tex, x + (x - ox) / L * 22, y + (y - oy) / L * 22, color);
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
  for (const el of tags.children) el.hidden = true;
  const m = M(T), R = Math.ceil(Math.hypot(W, H) / 2 / S) + 1;
  for (let k = -R; k <= R; k++) { seg([k, -R], [k, R], C.rule); seg([-R, k], [R, k], C.rule); }
  ctx.globalAlpha = .35; grid(m, C.muted, C.muted); ctx.globalAlpha = 1;
  circle(A); ctx.setLineDash([4, 5]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
  circle(m); ctx.fillStyle = C['accent-soft']; ctx.globalAlpha = .8; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.text; ctx.lineWidth = 1.6; ctx.stroke();
  const v1 = [Math.cos(D.th), Math.sin(D.th)], v2 = [-Math.sin(D.th), Math.cos(D.th)];
  const a1 = ap(m, v1), a2 = ap(m, v2), stage3 = T > 2;
  arrow(a1, C.accent); arrow(a2, C.blue);
  label(T < .02 ? '\\mathbf{v}_1' : stage3 ? '\\sigma_1\\mathbf{u}_1' : '', a1, C['accent-ink']);
  label(T < .02 ? '\\mathbf{v}_2' : stage3 ? '\\sigma_2\\mathbf{u}_2' : '', a2, C.blue);
  knobs.forEach((k) => k.place());

  const st = T <= 0 ? -1 : T <= 1 ? 0 : T <= 2 ? 1 : 2;
  root.querySelector('.steps').innerHTML = [
    ['① $V^\\top$：转', `转 ${deg(-D.th)}`],
    ['② $\\Sigma$：拉', `横向 $\\times${num(D.s1)}$，纵向 $\\times${num(D.s2)}$`],
    ['③ $U$：转', `转 ${deg(D.ph)}`],
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

剪切是转 $-58^\circ$，横着拉到 1.618 倍、竖着压到 0.618 倍，再转 $32^\circ$。两个奇异值又是黄金比例和它的倒数：$A^\top A=\begin{bmatrix}1&1\\1&2\end{bmatrix}$ 的特征方程是 $\lambda^2-3\lambda+1=0$，两个根是 $\varphi^2$ 和 $1/\varphi^2$。

求 $V$ 和 $\sigma$，把 $A=U\Sigma V^\top$ 代进 $A^\top A$，中间的 $U^\top U=I$ 消掉：

$$
A^\top A=V\Sigma^2V^\top
$$

这是对称矩阵 $A^\top A$ 的特征分解。$V$ 的列是它的特征向量，奇异值是它特征值的平方根。

### 一层一层叠

$U\Sigma V^\top$ 还能展开成一串“一列乘一行”：

$$
A=\sigma_1\mathbf{u}_1\mathbf{v}_1^\top+\sigma_2\mathbf{u}_2\mathbf{v}_2^\top+\cdots+\sigma_r\mathbf{u}_r\mathbf{v}_r^\top
$$

每一项 $\mathbf{u}\mathbf{v}^\top$ 是一个秩为 1 的矩阵：先拿尺子 $\mathbf{v}$ 量出一个数，再沿 $\mathbf{u}$ 的方向放出去，所有输出都在一条线上。这些项按 $\sigma$ 从大到小排好了。只留前 $k$ 项，得到的是所有秩不超过 $k$ 的矩阵里离 $A$ 最近的那个（Eckart–Young 定理，远近按各元素误差的平方和算）。

一张灰度图就是一个矩阵。下面这张 $96\times128$ 的小图是代码画的，奇异值分解在你的浏览器里现算。拖滑块，看前 $k$ 层叠起来的样子：

```render html
<style>
  .sv { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  .pics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .pics figure { margin: 0; }
  .pics canvas { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 4px; background: var(--bg-sunken); image-rendering: auto; }
  .pics figcaption { margin-top: 2px; color: var(--muted); font-size: 12px; text-align: center; }
  .ctl { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
  .ctl input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .ctl output { min-width: 4.5em; font: 600 14px var(--font-mono); }
  .bars { display: block; width: 100%; height: 70px; margin-top: 6px; }
  .axis { display: flex; justify-content: space-between; height: 14px; margin-top: -14px; color: var(--muted); font-size: 11px; line-height: 14px; }
  .read { display: grid; gap: 2px; margin: 4px 0 0; font: 13px var(--font-mono); }
  .read small { color: var(--muted); font: 12px var(--font-sans); }
</style>
<section class="sv" aria-label="图片的奇异值分解：前面几层叠起来就接近原图">
  <div class="pics">
    <figure><canvas class="orig" width="128" height="96" role="img" aria-label="原图"></canvas><figcaption>原图</figcaption></figure>
    <figure><canvas class="appr" width="128" height="96" role="img" aria-label="前 k 层叠加"></canvas><figcaption class="cap1">前 $k$ 层</figcaption></figure>
    <figure><canvas class="layer" width="128" height="96" role="img" aria-label="第 k 层"></canvas><figcaption class="cap2">第 $k$ 层</figcaption></figure>
  </div>
  <label class="ctl"><span>$k$</span><input type="range" min="1" max="60" value="1" aria-label="保留的层数" disabled /><output>计算中</output></label>
  <canvas class="bars" role="img" aria-label="奇异值从大到小"></canvas>
  <div class="axis" aria-hidden="true"><span>$\sigma_1$</span><span>$\sigma_{60}$（纵轴取对数）</span></div>
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
}
function update() {
  const k = Number(input.value);
  out.textContent = `$k = ${k}$`;
  const acc = new Float64Array(R * Cn);
  for (let j = 0; j < k; j++) { const u = Ucol[j], v = Vcol[j], s = sig[j]; for (let r = 0; r < R; r++) { const su = s * u[r]; for (let c = 0; c < Cn; c++) acc[r * Cn + c] += su * v[c]; } }
  paint(root.querySelector('.appr'), (i) => acc[i]);
  const u = Ucol[k - 1], v = Vcol[k - 1], s = sig[k - 1];
  let peak = 1e-9; for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) peak = Math.max(peak, Math.abs(s * u[r] * v[c]));
  paint(root.querySelector('.layer'), (i) => .5 + .5 * s * u[Math.floor(i / Cn)] * v[i % Cn] / peak);
  root.querySelector('.cap1').textContent = `前 ${k} 层叠起来`;
  root.querySelector('.cap2').textContent = `第 ${k} 层 $\\sigma_{${k}}\\mathbf{u}_{${k}}\\mathbf{v}_{${k}}^\\top$（灰色是 0）`;
  drawBars(k);
  const total = sig.reduce((a, s) => a + s * s, 0), rest = sig.slice(k).reduce((a, s) => a + s * s, 0);
  const store = k * (R + Cn + 1);
  root.querySelector('.read').innerHTML =
    `<span><small>要存的数：</small>$${k} \\times (96 + 128 + 1) = ${store}$<small>，原图 12288 个，占 </small>${(store / 122.88).toFixed(1)}%</span>` +
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

$k=1$ 只有一片明暗。山和房子这种横平竖直的大块，前几层就出来了；字和斜边要多叠些层。到 $k=20$ 上下，和原图已经不好分辨，要存的数是原来的三分之一多一点。底下的柱子是奇异值，掉得很快，大部分内容集中在前面几层。

拿它压真照片比不过 JPEG，但“只留前几层”的想法到处在用。推荐系统里，用户乘商品的评分表大半是空的，假设它差不多是低秩的，就能用前几层把空格补上。微调大模型的 [LoRA](/posts/llm-fine-tuning/) 假设权重的改动量是低秩的，只训练两个瘦长的矩阵，拿它们的乘积去凑这个改动量。

## 最小二乘：够不着，就找最近的

前面说，方程比未知数多的方程组通常无解。实际碰到的偏偏多是这种：数据点比要定的参数多。

三个数据点 $(0,1)$、$(1,2)$、$(2,2)$，想找一条直线 $y=c+mx$ 穿过它们。每个点给一个方程：

$$
\begin{bmatrix}1&0\\1&1\\1&2\end{bmatrix}\begin{bmatrix}c\\m\end{bmatrix}=\begin{bmatrix}1\\2\\2\end{bmatrix}
$$

三个点不在一条线上，无解。用列空间的话说：$A$ 的两列在三维空间里张成一张平面，$\mathbf{b}=(1,2,2)$ 不在这张平面上。

够不着 $\mathbf{b}$，就在平面上找离它最近的点 $\mathbf{p}=A\hat{\mathbf{x}}$。最近的点是垂足：差 $\mathbf{e}=\mathbf{b}-A\hat{\mathbf{x}}$ 垂直于整张平面，也就垂直于 $A$ 的每一列。

```render html
<style>
  .ls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px 24px; }
  .ls > div { position: relative; }
  .ls > div:first-child { flex: 0 1 240px; }
  .ls > div:last-child { flex: 0 1 340px; }
  .ls svg { display: block; width: 100%; height: auto; }
  /* 公式压在图上，位置按图的百分比给，基线落在那个点上 */
  .ls > div > span { position: absolute; color: var(--muted); font-size: 14px; line-height: 1; white-space: nowrap; transform: translateY(-80%); }
  .ls > div > .end { transform: translate(-100%, -80%); }
  .ls .fit, .ls .p { color: var(--accent-ink); }
  .ls .b { color: var(--text); }
  .ls .b, .ls .p { font-size: 15px; }
</style>
<div class="ls" role="img" aria-label="左：三个点和拟合出的直线，三段误差是 −1/6、1/3、−1/6；右：b 垂直投到列空间上，垂足是 Ax̂">
  <div><svg viewBox="10 12 216 200" xmlns="http://www.w3.org/2000/svg" font-family="Inter Variable, sans-serif">
    <path d="M40 190 H220 M40 190 V20" stroke="var(--rule-strong)" stroke-width="1.2" fill="none" />
    <g fill="var(--faint)" font-size="11" text-anchor="middle">
      <text x="40" y="206">0</text><text x="100" y="206">1</text><text x="160" y="206">2</text>
      <text x="28" y="134" text-anchor="end">1</text><text x="28" y="74" text-anchor="end">2</text>
    </g>
    <path d="M22 129 L196 42" stroke="var(--accent)" stroke-width="2.2" />
    <path d="M40 130 V120 M100 70 V90 M160 70 V60" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="3 3" />
    <g fill="var(--text)">
      <circle cx="40" cy="130" r="4.5" /><circle cx="100" cy="70" r="4.5" /><circle cx="160" cy="70" r="4.5" />
    </g>
  </svg>
    <span class="fit end" style="left: 86.1%; top: 10%">$y = \frac76 + \frac{x}{2}$</span>
    <span style="left: 18.5%; top: 66.5%">$-\frac16$</span>
    <span class="end" style="left: 38.4%; top: 37%">$\frac13$</span>
    <span style="left: 73.6%; top: 32%">$-\frac16$</span>
  </div>
  <div><svg viewBox="294 24 302 164" xmlns="http://www.w3.org/2000/svg" font-family="Inter Variable, sans-serif">
    <path d="M300 180 L520 180 L590 110 L370 110 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.2" />
    <text x="318" y="172" font-size="12" fill="var(--accent-ink)">列空间</text>
    <path d="M380 160 L482 137" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M492 135 L482.3 141.8 L480.3 133 Z" fill="var(--accent)" />
    <path d="M380 160 L485 52" stroke="var(--text)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M492 44 L487.6 55 L481.1 48.8 Z" fill="var(--text)" />
    <path d="M492 133 V56" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 4" />
    <path d="M492 123 L503 120 L503 132" fill="none" stroke="var(--muted)" stroke-width="1.2" />
    <circle cx="380" cy="160" r="2.5" fill="var(--text)" />
  </svg>
    <span class="b" style="left: 66.9%; top: 9.8%">$\mathbf{b}$</span>
    <span class="p" style="left: 45%; top: 65.9%">$\mathbf{p} = A\hat{\mathbf{x}}$</span>
    <span style="left: 68.2%; top: 43.9%">$\mathbf{e} = \mathbf{b} - A\hat{\mathbf{x}}$</span>
  </div>
</div>
```

“垂直于 $A$ 的每一列”，用转置写出来是 $A^\top\mathbf{e}=\mathbf{0}$：

$$
A^\top(\mathbf{b}-A\hat{\mathbf{x}})=\mathbf{0}
\quad\Longrightarrow\quad
A^\top A\,\hat{\mathbf{x}}=A^\top\mathbf{b}
$$

这叫法方程，“法”是法线的法。把数代进去：

$$
\begin{bmatrix}3&3\\3&5\end{bmatrix}\begin{bmatrix}c\\m\end{bmatrix}=\begin{bmatrix}5\\6\end{bmatrix}
\quad\Longrightarrow\quad
c=\frac76,\; m=\frac12
$$

三个点离这条线的差是 $-\frac16$、$\frac13$、$-\frac16$。加起来是 0，这是 $\mathbf{e}$ 垂直于第一列 $(1,1,1)$；各自乘上横坐标再加，$0\cdot(-\frac16)+1\cdot\frac13+2\cdot(-\frac16)=0$，这是 $\mathbf{e}$ 垂直于第二列 $(0,1,2)$。

左右两幅图画的是同一件事。左边是平面上三个点、一条线，要三段虚线的平方和最小；这个平方和就是 $\lVert\mathbf{e}\rVert^2$。右边是三维里一个点、一张平面，要 $\mathbf{b}$ 到平面最近。“最小二乘”这个名字说的是左边那幅。

## 一帧画面里的矩阵

游戏的每一帧，显卡要把成千上万个三角形的顶点算到屏幕上：模型转个角度，摆进场景，再换成相机看到的样子。旋转和缩放都是线性变换，有矩阵。头一个麻烦是平移。

### 平移不守规矩，那就升一维

把物体挪个位置，原点跟着走了，平移不是线性变换，写不成矩阵。

办法是给每个点多添一个坐标，固定填 1。二维的点 $(x,y)$ 写成 $(x,y,1)$，平面上的点全都搬到了三维空间里 $z=1$ 的那一层。再看这个 $3\times3$ 的矩阵：

$$
\begin{bmatrix}1&0&t_x\\0&1&t_y\\0&0&1\end{bmatrix}\begin{bmatrix}x\\y\\1\end{bmatrix}=\begin{bmatrix}x+t_x\\y+t_y\\1\end{bmatrix}
$$

在三维里它是一次剪切，线性的，原点没动。在 $z=1$ 那一层上看，每个点都平移了 $(t_x,t_y)$。

```render html
<style>
  .la { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  :root[data-theme="dark"] .la { --blue: #95bfdc; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .bar label { display: flex; flex: 1; min-width: 150px; align-items: center; gap: 10px; color: var(--muted); font: 12px var(--font-mono); }
  .bar input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .bar output { min-width: 2.6em; color: var(--text); text-align: right; }
  .stage { position: relative; margin-top: 8px; }
  canvas { display: block; width: 100%; cursor: grab; touch-action: pan-y; }
  canvas:active { cursor: grabbing; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin-top: 4px; min-height: 58px; }
  .t { color: var(--accent-ink); }
  .note { margin: 0; color: var(--muted); }
  .tags { position: absolute; inset: 0; overflow: hidden; pointer-events: none; line-height: 1; }
  .tags .katex { font-size: 17px; }
  .tags > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
</style>
<section class="la" aria-label="三维里的一次剪切，在 z = 1 的平面上看是平移">
  <div class="bar">
    <button type="button" class="key play">播放</button>
    <label><span>$t_x$</span><input type="range" min="-20" max="20" value="15" data-k="0" aria-label="x 方向平移" /><output></output></label>
    <label><span>$t_y$</span><input type="range" min="-20" max="20" value="10" data-k="1" aria-label="y 方向平移" /><output></output></label>
  </div>
  <div class="stage"><canvas role="img"></canvas></div>
  <div class="foot"><span class="mat"></span><p class="note"></p></div>
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
// 画布上的名字是叠在上面的公式：同一个名字只排版一次，之后只挪位置
const tags = cv.parentNode.appendChild(document.createElement('div')), names = {};
tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true');
// 名字整个留在画布里：公式排好、量出宽高以后，贴边的往回收
const keep = new ResizeObserver((all) => all.forEach(({ target: el, borderBoxSize: [box] }) => {
  if (!box.inlineSize) return;
  el.size = [box.inlineSize, box.blockSize];
  if (el === tags) for (const tag of tags.children) settle(tag); else settle(el);
}));
keep.observe(tags);
function settle(el) {
  const [w, h] = el.size ?? [0, 0], [W, H] = tags.size ?? [Infinity, Infinity];
  const x = Math.max(2, Math.min(W - w - 2, el.at[0] + el.shift[0] * w));
  const y = Math.max(2, Math.min(H - h - 2, el.at[1] + el.shift[1] * h));
  el.style.transform = `translate(${x}px, ${y}px)`;
}
function name(tex, x, y, color, shift = '-50%, -50%') {
  let el = names[tex];
  if (!el) keep.observe(el = names[tex] = tags.appendChild(Object.assign(document.createElement('span'), { textContent: `$${tex}$` })));
  el.hidden = false; el.style.color = color;
  el.at = [x, y]; el.shift = shift.split(',').map((part) => parseFloat(part) / 100); settle(el);
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
  const [zx, zy] = P(sh([L, -L, 1])); name('z = 1', zx + 6, zy + 18, C['accent-ink'], '0, -100%');
  // 原点和三根轴
  seg([0, 0, 0], [0, 0, 1.6], C['rule-strong'], 1.4);
  const [ox, oy] = P([0, 0, 0]); ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, 2 * Math.PI); ctx.fillStyle = C.text; ctx.fill();
  text('原点', [0, 0, 0], C.text, 8, 14);

  root.querySelector('.mat').textContent = `$\\begin{bmatrix}1&0&\\htmlClass{t}{${num(cur[0])}}\\\\0&1&\\htmlClass{t}{${num(cur[1])}}\\\\0&0&1\\end{bmatrix}$`;
  root.querySelector('.note').textContent = `$z = 1$ 上平移 $(${num(cur[0])}, ${num(cur[1])})$，$z = 0$ 不动`;
  inputs.forEach((el, k) => { el.value = Math.round(cur[k] * 10); el.nextElementSibling.textContent = num(cur[k]); });
  cv.setAttribute('aria-label', `z = 1 上平移 (${num(cur[0])}, ${num(cur[1])})，z = 0 不动`);
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

底下 $z=0$ 的网格没动，竖杆的底端钉着，顶端跟着走，整个三维空间被推斜了。只有站在 $z=1$ 那一层上，才觉得一切都平移了。多添的这个坐标叫齐次坐标。

三维的图形照办：点写成 $(x,y,z,1)$，变换用 $4\times4$ 的矩阵，左上角 $3\times3$ 管旋转和缩放，最右一列管平移。

### 一个顶点，三个矩阵

这样一来，旋转、缩放、平移全是矩阵。一个顶点要过三个：

- 模型矩阵 $M$：把模型摆进场景，转多少，放在哪。
- 视图矩阵 $V$：换成相机眼里的坐标，相机在原点，朝一个固定的方向看。这是一次换基，连原点也换了。
- 投影矩阵 $P$：按视野的宽窄缩放 $x$、$y$，再把这个点沿视线方向离相机多远抄进第四个坐标 $w$。

矩阵乘完，显卡把前三个坐标都除以 $w$。离得越远 $w$ 越大，除出来越小。看得见的点，除完的 $x$、$y$ 落在 $-1$ 到 $1$ 之间：$-1$ 是画面的左边缘和下边缘，$1$ 是右边缘和上边缘。除完的 $z$ 留着判断谁挡住谁，这里不管它。

下面这个立方体的八个顶点，都是照这个流程在你的浏览器里现算的。橙色的点是顶点 $(1,1,1)$：

```render html title="相机朝 $-z$ 方向看；投影矩阵的写法照 OpenGL 的习惯"
<style>
  .la { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .katex { font-size: 15px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
  .key { min-height: 36px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .bar label { display: flex; flex: 1; min-width: 150px; align-items: center; gap: 8px; min-height: 36px; color: var(--muted); font-size: 12px; }
  .bar input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .bar output { min-width: 2.8em; color: var(--text); font: 13px var(--font-mono); }
  canvas { display: block; width: 100%; margin-top: 8px; }
  .chain { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 14px; margin-top: 6px; font: 13px var(--font-mono); }
  .chain > span:nth-child(odd) { color: var(--muted); font-family: var(--font-sans); }
  .chain .hit { color: var(--accent-ink); font-weight: 650; }
</style>
<section class="la" aria-label="一个顶点依次乘模型、视图、投影三个矩阵，再除以 w，得到它在屏幕上的位置">
  <div class="bar">
    <button type="button" class="key spin">转一圈</button>
    <label><span>转角</span><input type="range" min="0" max="360" value="30" data-k="th" aria-label="模型绕竖轴转过的角度" /><output></output></label>
    <label><span>相机距离</span><input type="range" min="50" max="120" value="65" data-k="d" aria-label="相机到立方体中心的距离" /><output></output></label>
  </div>
  <canvas role="img"></canvas>
  <div class="chain"></div>
</section>
<script>
const root = document.querySelector('.la');
const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
const chain = root.querySelector('.chain');
const inTh = root.querySelector('[data-k="th"]'), inD = root.querySelector('[data-k="d"]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {};
let W = 0, H = 0, th = 30, d = 6.5, raf = 0;

const theme = () => { const s = getComputedStyle(root); for (const k of ['text', 'muted', 'accent', 'accent-ink']) C[k] = s.getPropertyValue(`--${k}`).trim(); };
const num = (x) => String(Math.round(x * 100) / 100 || 0).replace('-', '−');
const vec = (p) => `(${p.map(num).join(', ')})`;
// 4×4 矩阵按行存成 16 个数
const mul = (a, b) => { const o = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[4 * r + k] * b[4 * k + c]; o.push(s); } return o; };
const ap = (m, v) => [0, 1, 2, 3].map((r) => m[4 * r] * v[0] + m[4 * r + 1] * v[1] + m[4 * r + 2] * v[2] + m[4 * r + 3] * v[3]);
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; };
const move = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
// 透视投影：最后一行 (0, 0, −1, 0) 把相机坐标里的 −z，也就是深度，抄进 w
const NEAR = 1, FAR = 30, F = 2.6;
const persp = (aspect) => [F / aspect, 0, 0, 0, 0, F, 0, 0, 0, 0, (FAR + NEAR) / (NEAR - FAR), 2 * FAR * NEAR / (NEAR - FAR), 0, 0, -1, 0];

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (!W) return;
  const M = rotY(th * Math.PI / 180), V = mul(move(0, 0, -d), rotX(.4)), Pm = persp(W / H);
  const PVM = mul(Pm, mul(V, M)); // 三个矩阵先乘成一个，八个顶点共用
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const c = ap(PVM, [k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1, 1]);
    pts.push({ w: c[3], x: W / 2 + c[0] / c[3] * W / 2, y: H / 2 - c[1] / c[3] * H / 2 });
  }
  const ws = pts.map((p) => p.w), lo = Math.min(...ws), span = Math.max(...ws) - lo || 1;
  ctx.lineCap = 'round'; ctx.strokeStyle = C.text;
  for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) {
    const b = a | bit;
    if (b === a) continue;
    // 离相机近的棱画得粗一些、实一些
    const near = 1 - ((pts[a].w + pts[b].w) / 2 - lo) / span;
    ctx.globalAlpha = .3 + .7 * near; ctx.lineWidth = 1.2 + 1.6 * near;
    ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(pts[7].x, pts[7].y, 5.5, 0, 7); ctx.fillStyle = C.accent; ctx.fill();

  const p = [1, 1, 1, 1], world = ap(M, p), cam = ap(V, world), clip = ap(Pm, cam);
  chain.innerHTML =
    `<span>模型</span><span>$${vec(p)}$</span>` +
    `<span>$\\times M$</span><span>$${vec(world)}$</span>` +
    `<span>$\\times V$</span><span>$${vec(cam)}$</span>` +
    `<span>$\\times P$</span><span>$(${num(clip[0])}, ${num(clip[1])}, ${num(clip[2])}, \\htmlClass{hit}{w = ${num(clip[3])}})$</span>` +
    `<span>$\\div w$</span><span class="hit">$(${num(clip[0] / clip[3])}, ${num(clip[1] / clip[3])})$</span>`;
  const deg = Math.round(((th % 360) + 360) % 360);
  inTh.value = deg; inTh.nextElementSibling.textContent = `${deg}°`;
  inD.value = Math.round(d * 10); inD.nextElementSibling.textContent = num(d);
  cv.setAttribute('aria-label', `顶点 (1, 1, 1) 的 w 是 ${num(clip[3])}，画在屏幕的 (${num(clip[0] / clip[3])}, ${num(clip[1] / clip[3])})`);
}

function spin() {
  cancelAnimationFrame(raf);
  if (reduce) { th += 45; return draw(); }
  const from = th, t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / 6000); th = from + 360 * p; draw(); if (p < 1) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}
root.querySelector('.spin').addEventListener('click', spin);
inTh.addEventListener('input', () => { cancelAnimationFrame(raf); th = Number(inTh.value); draw(); });
inD.addEventListener('input', () => { d = inD.value / 10; draw(); });

function size() {
  W = cv.clientWidth; H = Math.round(Math.max(220, Math.min(320, W * .5)));
  const r = devicePixelRatio;
  cv.width = W * r; cv.height = H * r; cv.style.height = `${H}px`;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
theme();
window.addEventListener('themechange', () => { theme(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(cv);
</script>
```

把相机拉近，立方体变大，朝着相机的那个角也鼓得更厉害：近处的顶点 $w$ 小，除出来大。近大远小是那一下除法做出来的，整条流程里只有它不是线性的。

矩阵乘法能结合，在这里是实打实省下来的计算。一个物体的所有顶点共用同一个 $PVM$，每帧先把三个矩阵乘成一个，再拿这一个去乘每个顶点。

### 法向量不能跟着乘 M

模型横向拉长两倍，表面的法向量要是也乘 $M$，就不再垂直于表面了，光照会算错。该乘的是 $(M^{-1})^\top$。

原因在点积那一节：箭头和尺子是两种东西。表面上的切向量 $\mathbf{t}$ 是箭头，跟着 $M$ 走。法向量 $\mathbf{n}$ 干的是尺子的活，它的定义是“量任何一个切向量，读数都是 0”。变换之后还得满足 $\mathbf{n}'\cdot(M\mathbf{t})=0$，取 $\mathbf{n}'=(M^{-1})^\top\mathbf{n}$ 正好：

$$
\mathbf{n}'^\top M\mathbf{t}=\mathbf{n}^\top M^{-1}M\mathbf{t}=\mathbf{n}^\top\mathbf{t}=0
$$

旋转的时候 $(M^{-1})^\top$ 就是 $M$ 自己，均匀缩放时两者只差一个倍数，方向一样，所以平时看不出毛病。碰上不均匀的缩放或者剪切，才非换不可。

## 函数也是向量

开头说过，能相加、能伸缩的东西，都能套这一整套。函数能相加，也能乘一个数。

拿次数不超过 3 的多项式来说。用 $1$、$x$、$x^2$、$x^3$ 当基，$5+3x-x^3$ 的坐标是 $(5,3,0,-1)$。求导是线性的，所以它有矩阵。老办法，问每个基向量去了哪：$1\to0$，$x\to1$，$x^2\to2x$，$x^3\to3x^2$，一列一列写下来：

$$
D=\begin{bmatrix}0&1&0&0\\0&0&2&0\\0&0&0&3\\0&0&0&0\end{bmatrix},
\qquad
D\begin{bmatrix}5\\3\\0\\-1\end{bmatrix}=\begin{bmatrix}3\\0\\-3\\0\end{bmatrix}
$$

算出来是 $3-3x^2$，正是 $5+3x-x^3$ 的导数。

前面的东西在 $D$ 身上都找得到。第一列全是 0：常数被压成了 0，零空间是常数函数。秩是 3，四维的输入丢了一维。所以 $D$ 没有逆，求导把常数项丢了，积分回去只能补一个 $C$。$D^4=0$：三次多项式求四次导，什么都不剩。

求导也有特征向量。满足 $f'=\lambda f$ 的函数是 $e^{\lambda x}$（它不是多项式，得把范围放宽到一般的函数）。解微分方程总在跟指数函数打交道，是因为求导对它只是乘一个数。求两次导，$\sin\omega x$ 和 $\cos\omega x$ 也是特征向量，特征值是 $-\omega^2$。

傅里叶变换是在函数里换一组基：从“每个时刻的值”换成“每个频率占多少”。新的基由正弦和余弦组成，正好是求导两次的特征向量，所以很多在原来的基下很乱的运算，换过去就成了各管各的伸缩。这和对角化是同一个做法。

## 延伸阅读

- 3Blue1Brown 的系列视频 *Essence of Linear Algebra*（中文常译作《线性代数的本质》）。这篇把矩阵当变换来讲的路子是跟它学的，它的动画也比这里的好。
- Gilbert Strang，*Introduction to Linear Algebra*，和 MIT 18.06 的公开课。列空间、零空间、最小二乘、SVD 都讲得很细。
- Sheldon Axler，*Linear Algebra Done Right*。从线性映射讲起，行列式放到最后，更严格。
