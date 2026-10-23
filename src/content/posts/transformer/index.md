---
title: "Transformer：理解 Attention Is All You Need"
description: "从“他”怎样找到“小明”讲起：拖动向量看注意力怎样打分、分配和混合，再看多头、位置编码，以及解码器为什么训练时能并行、生成时只能一个一个来。"
pubDate: 2026-09-06T10:00:00+08:00
updatedDate: 2026-10-23
tags: ["机器学习", "论文笔记"]
---

“小明累了，他想睡觉。”

“他”是谁？你不用想就知道是小明。模型得自己找出来。

2017 年以前，翻译模型的主流是 RNN：从左往右一个词一个词地读，每读一个，就把到目前为止的意思压进一个固定长度的向量，交给下一步。读到“他”的时候，“小明”已经在这个向量里被揉过两轮了。句子一长，开头的东西越揉越淡。更麻烦的是第 10 个词得等第 9 个词算完，GPU 再多也只能排队。

《Attention Is All You Need》把这条链拆了：每个词直接去看整句话，自己决定看谁、看多少。“他”和“小明”隔多远都只差一步，所有词还能同时算。这个结构叫 Transformer，后来的 GPT、BERT 都是从它长出来的。

下面一直用这句话。文中说的“词”，在模型里其实是 token，可能是一个字，也可能是半个词，不影响理解。

## 注意力：带着问题去查

每个词进模型时是一个向量 $x$。注意力先用三个不同的矩阵，把它变成三个新向量：

$$
q=xW^Q,\qquad k=xW^K,\qquad v=xW^V.
$$

可以当成查资料。$q$（query）是我要找什么；$k$（key）是贴在每个词身上的标签，写着我能提供什么；$v$（value）是标签对上之后，真正被读走的内容。三个矩阵都是训练出来的。

“他”的 $q$ 大概在问“前面哪个是人”，“小明”的 $k$ 写着“我是个人”。两个方向对得越准，“他”就越多地读走“小明”的 $v$。

把这几个向量压到二维画出来。拖动 $q$ 的箭头，盯住右边的 $o$：

```render html title="二维示意，数值是编的；分数已经除以 √2"
<style>
  .att { position: relative; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 16px; margin-bottom: 4px; }
  .who > span { color: var(--muted); font-size: 12px; }
  .who button { min-height: 38px; padding: 0 1px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); font-size: 15px; cursor: pointer; }
  .who button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .planes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
  .plane p { margin: 0; color: var(--muted); font-size: 12px; text-align: center; }
  .plane p i { color: var(--text); font: italic 16px KaTeX_Math, var(--font-serif); }
  .plane svg { display: block; width: 100%; height: auto; overflow: visible; }
  .k-plane { touch-action: pan-y; cursor: crosshair; }
  .k-plane:focus { outline: none; }
  .k-plane:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
  .ring { fill: none; stroke: var(--rule-strong); stroke-dasharray: 2 4; }
  .hull { fill: color-mix(in srgb, var(--rule) 40%, transparent); stroke: var(--rule-strong); stroke-dasharray: 2 4; }
  .k-line { stroke: var(--rule-strong); stroke-width: 1.3; }
  .k-head { fill: var(--rule-strong); }
  .label { fill: var(--muted); font-size: 13px; dominant-baseline: central; }
  .label.top { fill: var(--accent-ink); font-weight: 600; }
  .shadow { stroke: var(--accent); stroke-width: 4; opacity: .3; }
  .shadow.top { opacity: .85; }
  .perp { stroke: var(--accent); stroke-dasharray: 3 3; }
  .q-line { stroke: var(--accent); stroke-width: 2.6; stroke-linecap: round; }
  .q-head { fill: var(--accent); }
  .knob { fill: var(--bg); stroke: var(--accent); stroke-width: 2; cursor: grab; touch-action: none; }
  .hit { fill: transparent; cursor: grab; touch-action: none; }
  .dragging .hit, .dragging .knob { cursor: grabbing; }
  .sym { fill: var(--accent-ink); font: italic 17px KaTeX_Math, var(--font-serif); dominant-baseline: central; text-anchor: middle; }
  .sym.o { fill: var(--text); }
  .spring { stroke: var(--accent); stroke-linecap: round; }
  .v-dot { fill: var(--accent); stroke: var(--accent); }
  .o-dot { fill: var(--text); stroke: var(--bg); stroke-width: 2; }
  .o-halo { fill: none; stroke: var(--text); stroke-opacity: .35; }
  .bars { display: grid; gap: 2px; margin-top: 10px; }
  .bar { display: grid; grid-template-columns: 2.6em minmax(0, 1fr) 3.4em 3.6em; gap: 12px; align-items: center; min-height: 25px; }
  .bar.head { min-height: 0; color: var(--faint); font-size: 11px; }
  .bar > :nth-child(n + 3) { text-align: right; }
  .bar > span { color: var(--muted); }
  .bar i { display: block; height: 10px; background: var(--rule-strong); }
  .bar.top > span { color: var(--accent-ink); font-weight: 600; }
  .bar.top i { background: var(--accent); }
  .bar output { color: var(--text); font: 12px var(--font-mono); }
  .bar small { color: var(--muted); font: 11px var(--font-mono); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 520px) {
    .planes { gap: 0 10px; }
    .label { font-size: 12px; }
    .bar { gap: 8px; }
  }
</style>
<section class="att" aria-label="拖动 q，观察五个词的分数、权重和混合结果">
  <div class="who" role="group" aria-label="谁的 q"><span>谁在查</span></div>
  <div class="planes">
    <div class="plane"><p>用 <i>q</i> 给每个 <i>k</i> 打分</p><svg class="k-plane" tabindex="0" role="img"></svg></div>
    <div class="plane"><p>按权重混合 <i>v</i></p><svg class="v-plane" role="img"></svg></div>
  </div>
  <div class="bars"></div>
  <output class="sr" aria-live="polite"></output>
</section>
<script>
const words = ['小明', '累了', '他', '想', '睡觉'];
const RAD = Math.PI / 180;
const polar = (deg, r) => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
const kAngles = [95, 155, 220, 290, 20];
const KR = 1.8, K = kAngles.map(a => polar(a, KR));
const V = [[-1.3, 1], [1.2, 1.15], [0.05, 0.05], [1.35, -0.85], [-0.55, -1.4]];
// 每个词的 q：[方向（度）, 长度]
const presets = [[150, 1.4], [100, 1.5], [105, 1.55], [25, 1.5], [295, 1.4]].map(([a, r]) => polar(a, r));
const MIN = .25, MAX = 2.4;

const root = document.querySelector('.att');
const kSvg = root.querySelector('.k-plane'), vSvg = root.querySelector('.v-plane');
let who = 2, q = presets[who].slice(), size = 0, frame = 0;

const f = n => n.toFixed(1);
const unit = () => size / 2 / 2.6;
const px = ([x, y]) => [size / 2 + x * unit(), size / 2 - y * unit()];

function attend(q) {
  const s = K.map(([x, y]) => (q[0] * x + q[1] * y) / Math.SQRT2);
  const top = Math.max(...s), e = s.map(v => Math.exp(v - top)), sum = e.reduce((a, b) => a + b);
  const w = e.map(v => v / sum);
  const o = V.reduce(([ox, oy], [x, y], j) => [ox + w[j] * x, oy + w[j] * y], [0, 0]);
  return { s, w, o, best: s.indexOf(top) };
}

function arrow(from, to, cls, head) {
  const [x1, y1] = px(from), [x2, y2] = px(to);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const bx = x2 - ux * head, by = y2 - uy * head, w = head * .45;
  return `<line class="${cls}-line" x1="${f(x1)}" y1="${f(y1)}" x2="${f(bx)}" y2="${f(by)}"/>` +
    `<polygon class="${cls}-head" points="${f(x2)},${f(y2)} ${f(bx - uy * w)},${f(by + ux * w)} ${f(bx + uy * w)},${f(by - ux * w)}"/>`;
}

function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => list.reduce((h, pt) => {
    while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], pt) <= 0) h.pop();
    h.push(pt);
    return h;
  }, []);
  const lower = half(p), upper = half(p.reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const vHull = hull(V);

function render() {
  const { s, w, o, best } = attend(q);
  const [cx, cy] = px([0, 0]), u = unit();
  let k = `<circle class="ring" cx="${f(cx)}" cy="${f(cy)}" r="${f(KR * u)}"/>`;
  // q 在每个 k 方向上的影子；背过身去的不画，分数看下面
  const shadow = j => (q[0] * K[j][0] + q[1] * K[j][1]) / KR;
  K.forEach(([x, y], j) => {
    const p = shadow(j);
    k += arrow([0, 0], K[j], 'k', 6);
    if (p > 0) {
      const [ex, ey] = px([x / KR * p, y / KR * p]);
      k += `<line class="shadow${j === best ? ' top' : ''}" x1="${f(cx)}" y1="${f(cy)}" x2="${f(ex)}" y2="${f(ey)}"/>`;
    }
    const [lx, ly] = px(polar(kAngles[j], KR + .4));
    k += `<text class="label${j === best ? ' top' : ''}" x="${f(lx)}" y="${f(ly)}" text-anchor="middle">${words[j]}</text>`;
  });
  const bp = shadow(best), [fx, fy] = px([K[best][0] / KR * bp, K[best][1] / KR * bp]), [qx, qy] = px(q);
  k += `<line class="perp" x1="${f(qx)}" y1="${f(qy)}" x2="${f(fx)}" y2="${f(fy)}"/>`;
  k += arrow([0, 0], q, 'q', 11);
  // 标签放在 q 背向最高分那个 k 的一侧
  const len = Math.hypot(...q), turn = q[0] * K[best][1] - q[1] * K[best][0] > 0 ? 1 : -1;
  const side = [turn * q[1] / len, -turn * q[0] / len];
  k += `<text class="sym" x="${f(qx + side[0] * 16)}" y="${f(qy - side[1] * 16)}">q</text>`;
  k += `<circle class="hit" cx="${f(qx)}" cy="${f(qy)}" r="22"/><circle class="knob" cx="${f(qx)}" cy="${f(qy)}" r="5.5"/>`;
  kSvg.innerHTML = k;
  kSvg.setAttribute('aria-label', `${words[who]}的 q，分数最高的是${words[best]}。方向键可旋转和伸缩`);

  const [ox, oy] = px(o);
  let v = `<polygon class="hull" points="${vHull.map(p => px(p).map(f).join(',')).join(' ')}"/>`;
  V.forEach((p, j) => {
    const [x, y] = px(p);
    v += `<line class="spring" x1="${f(ox)}" y1="${f(oy)}" x2="${f(x)}" y2="${f(y)}" stroke-width="${f(.6 + 3.4 * w[j])}" stroke-opacity="${(.12 + .5 * w[j]).toFixed(2)}"/>`;
  });
  V.forEach((p, j) => {
    const [x, y] = px(p), r = 2.5 + 12 * Math.sqrt(w[j]);
    const d = Math.hypot(...p) > .3 ? p.map(c => c / Math.hypot(...p)) : [.7, -.7];
    const [lx, ly] = [x + d[0] * (r + 14), y - d[1] * (r + 12)];
    v += `<circle class="v-dot" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill-opacity="${(.18 + .55 * w[j]).toFixed(2)}"/>`;
    v += `<text class="label${j === best ? ' top' : ''}" x="${f(lx)}" y="${f(ly)}" text-anchor="middle">${words[j]}</text>`;
  });
  v += `<circle class="o-halo" cx="${f(ox)}" cy="${f(oy)}" r="11"/><circle class="o-dot" cx="${f(ox)}" cy="${f(oy)}" r="5"/>`;
  v += `<text class="sym o" x="${f(ox + 15)}" y="${f(oy - 14)}">o</text>`;
  vSvg.innerHTML = v;
  vSvg.setAttribute('aria-label', `输出 o 被拉向${words[best]}的 v`);

  root.querySelector('.bars').innerHTML = '<div class="bar head"><span></span><span></span><span>权重</span><span>分数</span></div>' +
    words.map((word, j) => `<div class="bar${j === best ? ' top' : ''}"><span>${word}</span><span><i style="width:${(w[j] * 100).toFixed(1)}%"></i></span><output>${(w[j] * 100).toFixed(1)}%</output><small>${s[j].toFixed(2)}</small></div>`).join('');
  root.querySelector('.sr').textContent = `${words[best]}的权重 ${(w[best] * 100).toFixed(0)}%`;
}

function setQ([x, y]) {
  const len = Math.hypot(x, y) || 1, r = Math.min(MAX, Math.max(MIN, len));
  q = [x / len * r, y / len * r];
  render();
}

function pointerQ(event) {
  const box = kSvg.getBoundingClientRect(), scale = size / box.width;
  return [((event.clientX - box.left) * scale - size / 2) / unit(), (size / 2 - (event.clientY - box.top) * scale) / unit()];
}

let dragging = false;
kSvg.addEventListener('pointerdown', event => {
  if (!event.target.matches('.hit, .knob')) return;
  dragging = true;
  kSvg.setPointerCapture(event.pointerId);
  root.classList.add('dragging');
  cancelAnimationFrame(frame);
});
kSvg.addEventListener('pointermove', event => { if (dragging) setQ(pointerQ(event)); });
const stop = () => { dragging = false; root.classList.remove('dragging'); };
kSvg.addEventListener('pointerup', stop);
kSvg.addEventListener('pointercancel', stop);
kSvg.addEventListener('click', event => { if (!event.target.matches('.hit, .knob')) setQ(pointerQ(event)); });
kSvg.addEventListener('keydown', event => {
  const angle = Math.atan2(q[1], q[0]), len = Math.hypot(...q);
  const moves = { ArrowLeft: [5, 0], ArrowRight: [-5, 0], ArrowUp: [0, .1], ArrowDown: [0, -.1] };
  if (!moves[event.key]) return;
  event.preventDefault();
  const [da, dl] = moves[event.key];
  setQ(polar(angle / RAD + da, len + dl));
});

function glide(to) {
  cancelAnimationFrame(frame);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setQ(to);
  const from = q.slice(), start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / 320), e = 1 - (1 - t) ** 3;
    setQ([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

const whoBox = root.querySelector('.who');
const buttons = words.map((word, j) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = word;
  button.addEventListener('click', () => {
    who = j;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === who)));
    glide(presets[j]);
  });
  whoBox.append(button);
  return button;
});
buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === who)));

new ResizeObserver(([entry]) => {
  const width = Math.round(entry.contentRect.width);
  if (width === size) return;
  size = width;
  [kSvg, vSvg].forEach(svg => svg.setAttribute('viewBox', `0 0 ${size} ${size}`));
  render();
}).observe(kSvg);
</script>
```

整个过程分三步。

**打分。** $q$ 和每个 $k$ 做点积。几何上，点积就是 $q$ 落在 $k$ 方向上的影子长度，再乘上 $k$ 的长度。方向越一致，影子越长，分数越高；背过身去，影子落到反方向，分数就是负的。分数还要再除以 $\sqrt{d_k}$，$d_k$ 是向量的维数，这里是 2。为什么要除，下一节说。

**分配。** softmax 把五个分数变成五个权重：

$$
w_j=\frac{e^{s_j}}{\sum_i e^{s_i}}.
$$

权重都是正的，加起来正好是 1。分数高的拿得多，分数低的也不是零。

**混合。** 用这组权重把五个 $v$ 加权平均，得到 $o$，也就是“他”在这一层的输出。把权重想成质量，$o$ 就是五个 $v$ 的重心。

“他”的 $q$ 对着“小明”，“小明”拿到 57% 的权重。“他”自己的 $v$ 几乎在原点，本来没什么内容；读完这一下，$o$ 被一把拽向“小明”的 $v$，“他”就带上了小明的信息。

再试两件事。把 $q$ 拉长，分数之间的差距跟着放大，权重越来越集中到一个词上，$o$ 贴到那个点上；把 $q$ 缩短，权重趋于平均，$o$ 退回中间。另外，不管怎么拖，$o$ 都跑不出那块灰色区域。它是个加权平均，只能落在几个 $v$ 中间。这件事讲多头时还会用到。

## 分数为什么要缩小

刚才拉长 $q$，分布就变尖。维数一高，这件事会自己发生。

点积是逐维相乘再相加。论文脚注里算过：假设 $q$、$k$ 的每个分量都是均值 0、方差 1 的独立随机数，点积的方差就是 $d_k$，相加的项越多，结果越容易跑得很大。论文用的 $d_k=64$，分数的标准差就是 8，几个分数之间差个十几二十很正常。

softmax 对差距是指数敏感的。差 20，$e^{20}$ 大约是 5 亿倍，权重几乎全给了最大的那个，其他位置只分到零头。训练就麻烦在这儿：softmax 一旦这样饱和，输入再怎么动，输出都几乎不变，梯度传回来接近零，参数学不动。论文的说法是，softmax 被推进了“梯度极小的区域”。

除以 $\sqrt{d_k}$，方差就回到 1。拖动维数看看两种算法的差别：

```render html title="示意：6 个分数，标准差随维数按平方根增长"
<style>
  .dk { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .dk-grid { display: grid; grid-template-columns: 4.4em minmax(0, 1fr); gap: 6px 14px; align-items: center; }
  .dk-grid > span { color: var(--muted); font-size: 12px; text-align: right; white-space: nowrap; }
  .dk-grid > span i { color: var(--text); font: italic 14px KaTeX_Math, var(--font-serif); }
  .dk-grid > span b { font: 400 14px KaTeX_Main, var(--font-serif); }
  .dk-grid > span sub { font: 10px KaTeX_Main, var(--font-serif); }
  .dk-grid > .sec { grid-column: 1 / -1; margin-top: 8px; color: var(--faint); font-size: 11px; text-align: left; }
  .dk-grid > .sec:first-child { margin-top: 0; }
  .dk svg { display: block; width: 100%; overflow: visible; }
  .lane { stroke: var(--rule); }
  .zero { stroke: var(--rule-strong); }
  .tick { fill: var(--faint); font: 10px var(--font-mono); text-anchor: middle; }
  .dot { fill: var(--rule-strong); stroke: var(--bg); stroke-width: 1.5; }
  .dot.max { fill: var(--accent); }
  .stack { display: flex; height: 28px; overflow: hidden; }
  .stack i { display: grid; flex: 0 1 auto; place-items: center; overflow: hidden; border-right: 2px solid var(--bg); background: var(--rule-strong); color: var(--text); font: 11px var(--font-mono); white-space: nowrap; }
  .stack i:nth-child(even) { background: var(--rule); }
  .stack i.max { background: var(--accent); color: var(--bg); }
  .stack i:last-child { border-right: 0; }
  .dk-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; margin-top: 16px; color: var(--muted); }
  .dk-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .dk-controls i { font: italic 15px KaTeX_Math, var(--font-serif); }
  .dk-controls sub { font: 11px KaTeX_Main, var(--font-serif); }
  .dk-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
</style>
<section class="dk" aria-label="维数越高，不缩放的 softmax 越接近只选一个">
  <div class="dk-grid">
    <p class="sec">分数</p>
    <span>不缩放</span><svg class="raw-dots"></svg>
    <span><b>÷ √</b><i>d</i><sub>k</sub></span><svg class="scaled-dots"></svg>
    <span></span><svg class="axis"></svg>
    <p class="sec">softmax 之后的权重</p>
    <span>不缩放</span><div class="stack raw-stack"></div>
    <span><b>÷ √</b><i>d</i><sub>k</sub></span><div class="stack scaled-stack"></div>
  </div>
  <label class="dk-controls"><span><i>d</i><sub>k</sub></span><output></output><input type="range" min="1" max="9" step="1" value="6" aria-label="向量维数 d_k"/></label>
</section>
<script>
const z = [1.3, .7, -.2, .4, -1.1, 0];
const LIMIT = 32;
const root = document.querySelector('.dk');
const slider = root.querySelector('input');
const softmax = s => {
  const top = Math.max(...s), e = s.map(v => Math.exp(v - top)), sum = e.reduce((a, b) => a + b);
  return e.map(v => v / sum);
};
let width = 0;

function dots(svg, scores) {
  const x = v => (v + LIMIT) / (2 * LIMIT) * width;
  const max = scores.indexOf(Math.max(...scores));
  svg.setAttribute('viewBox', `0 0 ${width} 22`);
  svg.innerHTML = `<line class="lane" x1="0" x2="${width}" y1="11" y2="11"/><line class="zero" x1="${x(0)}" x2="${x(0)}" y1="4" y2="18"/>` +
    scores.map((v, j) => [v, j]).sort((a, b) => (a[1] === max) - (b[1] === max))
      .map(([v, j]) => `<circle class="dot${j === max ? ' max' : ''}" cx="${x(Math.max(-LIMIT, Math.min(LIMIT, v))).toFixed(1)}" cy="11" r="5"/>`).join('');
}

function stack(box, weights) {
  const max = weights.indexOf(Math.max(...weights));
  box.innerHTML = weights.map((w, j) => `<i class="${j === max ? 'max' : ''}" style="flex-basis:${(w * 100).toFixed(2)}%">${w > .1 ? Math.round(w * 100) + '%' : ''}</i>`).join('');
}

function render() {
  const d = 2 ** Number(slider.value), raw = z.map(v => v * Math.sqrt(d)), scaled = raw.map(v => v / Math.sqrt(d));
  dots(root.querySelector('.raw-dots'), raw);
  dots(root.querySelector('.scaled-dots'), scaled);
  const axis = root.querySelector('.axis'), x = v => (v + LIMIT) / (2 * LIMIT) * width;
  axis.setAttribute('viewBox', `0 0 ${width} 14`);
  axis.innerHTML = (width > 360 ? [-30, -20, -10, 0, 10, 20, 30] : [-30, -15, 0, 15, 30])
    .map(v => `<text class="tick" x="${x(v)}" y="10">${v}</text>`).join('');
  stack(root.querySelector('.raw-stack'), softmax(raw));
  stack(root.querySelector('.scaled-stack'), softmax(scaled));
  root.querySelector('output').textContent = d;
  slider.setAttribute('aria-valuetext', `d_k = ${d}`);
}

slider.addEventListener('input', render);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root.querySelector('.raw-dots'));
</script>
```

$d_k=64$ 时，不缩放的那一行已经把 99% 给了同一个词。除过之后还是 39%、22%、16%……分数排序一样，分布却还留着余地，梯度也就能传回去。

## 一整句一起算

刚才只看了“他”。其实五个词同时在做同一件事，各自拿自己的 $q$ 去和所有 $k$ 打分。把五个 $q$ 摞成矩阵 $Q$，五个 $k$ 摞成 $K$，五个 $v$ 摞成 $V$，所有词的注意力就是一个式子：

$$
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V.
$$

$QK^\top$ 其实就是一张乘法表：行头是每个词的 $q$，列头是每个词的 $k$，格子里填两者的点积。点一个格子看它怎么来的：

```render html title="和第一张图同一组二维向量；格子里大字是权重，小字是分数"
<style>
  .tbl { --row: #356f9b; --col: #3a7a5c; position: relative; font-size: 13px; line-height: 1.4; font-variant-ligatures: none; }
  :root[data-theme="dark"] .tbl { --row: #95bfdc; --col: #8cc9ac; }
  .grid { display: grid; grid-template-columns: 6.6em repeat(5, minmax(0, 1fr)) 6.4em; gap: 3px; }
  .head { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 4px 2px; color: var(--muted); text-align: center; }
  .head b { color: var(--text); font-size: 14px; font-weight: 500; }
  .head small { color: var(--faint); font: 10.5px var(--font-mono); white-space: nowrap; }
  .head.rowhead { align-items: flex-start; padding-left: 0; text-align: left; }
  .head.out { align-items: flex-end; padding-right: 0; text-align: right; }
  .corner { display: flex; justify-content: space-between; align-items: flex-end; padding: 4px 6px 4px 0; color: var(--muted); }
  .sym { color: var(--text); font: italic 16px KaTeX_Math, var(--font-serif); }
  .tag { color: var(--muted); font-size: 11px; }
  .tag .sym { font-size: 14px; }
  .cell { position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; min-width: 0; min-height: 46px; padding: 0; border: 0; border-radius: 3px; background: color-mix(in srgb, var(--accent) calc(var(--w) * 70%), transparent); color: var(--text); cursor: pointer; }
  .cell b { font: 500 14px var(--font-mono); }
  .cell small { color: var(--muted); font: 10px var(--font-mono); }
  .cell:hover { box-shadow: inset 0 0 0 1px var(--rule-strong); }
  .cell.on { box-shadow: inset 0 0 0 2px var(--accent-ink); }
  .cell:focus-visible { outline-offset: 2px; }
  .head.row-on, .head.row-on b { color: var(--row); }
  .head.col-on, .head.col-on b { color: var(--col); }
  .head.row-on b, .head.col-on b { font-weight: 650; }
  .grid .band { grid-column: 2 / 7; border-radius: 3px; pointer-events: none; }
  .detail { display: grid; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--rule); }
  .line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-height: 40px; font-size: 18px; }
  .line > span:first-child { flex: 0 0 5.4em; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .line math { flex: 0 0 auto; }
  .r { color: var(--row); }
  .c { color: var(--col); }
  .ans { color: var(--accent-ink); }
  @media (max-width: 560px) {
    .grid { grid-template-columns: 3.2em repeat(5, minmax(0, 1fr)); }
    .head small, .out, .vrow { display: none; }
    .corner .tag:last-child { display: none; }
    .line { font-size: 16px; }
    .line > span:first-child { flex-basis: 100%; }
  }
</style>
<section class="tbl" aria-label="五个词的 q 和 k 两两点积，每行 softmax 后加权平均 v">
  <div class="grid" role="grid"></div>
  <div class="detail" aria-live="polite"></div>
</section>
<script>
const words = ['小明', '累了', '他', '想', '睡觉'];
const RAD = Math.PI / 180;
const polar = (deg, r) => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
const K = [95, 155, 220, 290, 20].map(a => polar(a, 1.8));
const V = [[-1.3, 1], [1.2, 1.15], [0.05, 0.05], [1.35, -0.85], [-0.55, -1.4]];
const Q = [[150, 1.4], [100, 1.5], [105, 1.55], [25, 1.5], [295, 1.4]].map(([a, r]) => polar(a, r));
const S = Q.map(q => K.map(k => (q[0] * k[0] + q[1] * k[1]) / Math.SQRT2));
const A = S.map(row => {
  const top = Math.max(...row), e = row.map(v => Math.exp(v - top)), sum = e.reduce((a, b) => a + b);
  return e.map(v => v / sum);
});
const O = A.map(row => V.reduce(([x, y], v, j) => [x + row[j] * v[0], y + row[j] * v[1]], [0, 0]));

const root = document.querySelector('.tbl');
const grid = root.querySelector('.grid'), detail = root.querySelector('.detail');
let row = 2, col = 0;

const n = v => v.toFixed(2).replace('-', '−');
const vec = v => `(${n(v[0])}, ${n(v[1])})`;
const mn = (v, cls = '') => `<mn${cls ? ` class="${cls}"` : ''}>${v.replace('−', '&minus;')}</mn>`;
const signed = (v, cls) => v < 0 ? `<mrow><mo>(</mo>${mn(n(v), cls)}<mo>)</mo></mrow>` : mn(n(v), cls);
const sub = (sym, word, cls = '') => `<msub><mi>${sym}</mi><mtext${cls ? ` class="${cls}"` : ''}>${word}</mtext></msub>`;
const math = body => `<math display="inline">${body}</math>`;

function build() {
  const parts = [`<div class="corner"><span class="tag"><span class="sym">q</span> ↓</span><span class="tag"><span class="sym">k</span> →</span></div>`];
  words.forEach((w, j) => parts.push(`<div class="head colhead" data-col="${j}"><b>${w}</b><small>${vec(K[j])}</small></div>`));
  parts.push(`<div class="head out"><span class="sym">o</span></div>`);
  words.forEach((w, i) => {
    parts.push(`<div class="head rowhead" data-row="${i}"><b>${w}</b><small>${vec(Q[i])}</small></div>`);
    words.forEach((_, j) => parts.push(`<button type="button" class="cell" role="gridcell" data-cell="${i}:${j}" style="--w:${A[i][j].toFixed(3)}" aria-label="${w}读${words[j]}：分数 ${n(S[i][j])}，权重 ${(A[i][j] * 100).toFixed(0)}%"><b>${Math.round(A[i][j] * 100)}%</b><small>${n(S[i][j])}</small></button>`));
    parts.push(`<div class="head out" data-row="${i}"><small>${vec(O[i])}</small></div>`);
  });
  parts.push(`<div class="head rowhead vrow"><span class="sym">v</span></div>`);
  words.forEach((_, j) => parts.push(`<div class="head vrow" data-col="${j}"><small>${vec(V[j])}</small></div>`));
  grid.innerHTML = parts.join('');
}

function refresh(focus) {
  grid.querySelectorAll('.cell').forEach(cell => {
    const [i, j] = cell.dataset.cell.split(':').map(Number), on = i === row && j === col;
    cell.classList.toggle('on', on);
    cell.tabIndex = on ? 0 : -1;
    if (on && focus) cell.focus();
  });
  grid.querySelectorAll('[data-row]').forEach(el => el.classList.toggle('row-on', Number(el.dataset.row) === row));
  grid.querySelectorAll('[data-col]').forEach(el => el.classList.toggle('col-on', Number(el.dataset.col) === col));
  const q = Q[row], k = K[col], w = words[row], u = words[col];
  const dot = `<mrow><mo>(</mo>${signed(q[0], 'r')}<mo>×</mo>${signed(k[0], 'c')}<mo>+</mo>${signed(q[1], 'r')}<mo>×</mo>${signed(k[1], 'c')}<mo>)</mo></mrow>`;
  const score = math(`<mi>s</mi><mo>=</mo><mfrac>${dot}<msqrt><mn>2</mn></msqrt></mfrac><mo>=</mo>${mn(n(S[row][col]), 'ans')}`);
  const terms = S[row].map((v, j) => `<msup><mi>e</mi>${mn(n(v), j === col ? 'c' : '')}</msup>`).join('<mo>+</mo>');
  const weight = math(`<mi>w</mi><mo>=</mo><mfrac><msup><mi>e</mi>${mn(n(S[row][col]), 'c')}</msup><mrow>${terms}</mrow></mfrac><mo>=</mo>${mn(Math.round(A[row][col] * 100) + '%', 'ans')}`);
  const mix = A[row].map((a, j) => math(`${j ? '<mo>+</mo>' : ''}${mn(a.toFixed(2), j === col ? 'c' : '')}${sub('v', words[j], j === col ? 'c' : '')}`)).join('');
  detail.innerHTML =
    `<div class="line"><span><span class="r">${w}</span>读<span class="c">${u}</span></span>${score}</div>` +
    `<div class="line"><span>这一行</span>${weight}</div>` +
    `<div class="line"><span><span class="r">${w}</span>的输出</span>${math(sub('o', w, 'r') + '<mo>=</mo>')}${mix}${math(`<mo>=</mo><mtext class="ans">${vec(O[row])}</mtext>`)}</div>`;
}

grid.addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (!cell) return;
  [row, col] = cell.dataset.cell.split(':').map(Number);
  refresh(true);
});
grid.addEventListener('keydown', event => {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (!moves[event.key]) return;
  event.preventDefault();
  row = (row + moves[event.key][0] + 5) % 5;
  col = (col + moves[event.key][1] + 5) % 5;
  refresh(true);
});
build();
refresh(false);
</script>
```

表要按行读。第 3 行就是第一张图里的“他”：它读“小明”读了 57%。整张表不对称：“他”读“小明”，用的是“他”的 $q$ 和“小明”的 $k$；反过来是“小明”的 $q$ 和“他”的 $k$，四个不同的向量，分数自然不一样。

每一行各自做 softmax，加起来都是 100%。再拿这一行的权重去加权平均五个 $v$，就是这个词的输出 $o$。

这里没有任何一步需要等别的词先算完。整张表就是两次矩阵乘法，GPU 一次算完；句子有一千个词，就是一千乘一千的表，照样一次算完。RNN 那种必须排队的链条，就这样没了。代价是表的大小按词数的平方涨，句子越长越贵，这是后来很多改进的出发点。

## 多头：一个平均数装不下两件事

回到第一张图。“他”其实想知道两件事：指的是谁（小明），这人怎么了（累了）。可一组权重只能产出一个 $o$，而 $o$ 只是几个 $v$ 的加权平均。两个都要，就只能各分一部分权重，$o$ 落在两点之间，哪边都不像。

论文里就一句话带过：“With a single attention head, averaging inhibits this.”一个头只做一次平均，没法同时顾上两头。

多头的办法是多准备几套 $W^Q$、$W^K$、$W^V$。每套叫一个头，各自打分、各自分配、各自混合，最后把几个头的输出首尾拼起来，再乘一个矩阵 $W^O$：

$$
\begin{aligned}
\operatorname{head}_i&=\operatorname{Attention}(XW_i^Q,XW_i^K,XW_i^V),\\
\operatorname{MultiHead}(X)&=\operatorname{Concat}(\operatorname{head}_1,\ldots,\operatorname{head}_h)W^O.
\end{aligned}
$$

拼起来，不是平均起来。区别看这张图：

```render html title="示意：权重和向量都是编的，其他三个词分到的权重略去"
<style>
  .mh { --h2: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .mh { --h2: #95bfdc; }
  .seg { display: flex; gap: 18px; margin-bottom: 6px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .mh svg { display: block; width: 100%; height: auto; overflow: visible; }
  .word { fill: var(--muted); font-size: 16px; text-anchor: middle; dominant-baseline: central; }
  .word.me { fill: var(--text); font-weight: 650; }
  .word.h1 { fill: var(--accent-ink); }
  .word.h2 { fill: var(--h2); }
  .arc { fill: none; stroke-linecap: round; }
  .arc.h1 { stroke: var(--accent); }
  .arc.h2 { stroke: var(--h2); stroke-dasharray: 7 4; }
  .pct { font: 11px var(--font-mono); text-anchor: middle; }
  .pct.h1 { fill: var(--accent-ink); }
  .pct.h2 { fill: var(--h2); }
  .pct.tag { font: 12px var(--font-sans); text-anchor: start; }
  .heads { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 0 24px; max-width: calc(var(--n) * 290px); margin: 4px auto 0; }
  .heads p { margin: 0; color: var(--muted); font-size: 12px; text-align: center; }
  .hull { fill: color-mix(in srgb, var(--rule) 40%, transparent); stroke: var(--rule-strong); stroke-dasharray: 2 4; }
  .v { fill: var(--muted); }
  .v.h1 { fill: var(--accent); }
  .v.h2 { fill: var(--h2); }
  .vl { fill: var(--muted); font-size: 12px; dominant-baseline: central; text-anchor: middle; }
  .vl.h1 { fill: var(--accent-ink); }
  .vl.h2 { fill: var(--h2); }
  .seglink { stroke: var(--text); stroke-dasharray: 3 3; stroke-opacity: .5; }
  .o-dot { fill: var(--text); stroke: var(--bg); stroke-width: 2; }
  .o-halo { fill: none; stroke: var(--text); stroke-opacity: .35; }
  .sym { fill: var(--text); font: italic 16px KaTeX_Math, var(--font-serif); dominant-baseline: central; }
  .sym tspan { font: 11px KaTeX_Main, var(--font-serif); font-style: normal; }
  .split { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 2px 12px; align-items: center; margin-top: 10px; color: var(--muted); }
  .split[hidden] { display: none; }
  .split output { color: var(--text); font: 12px var(--font-mono); white-space: nowrap; }
  .split input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  @media (max-width: 480px) {
    .heads { gap: 0 10px; }
    .word { font-size: 14px; }
  }
</style>
<section class="mh" aria-label="一个头只能把两样东西平均在一起，两个头各取一样">
  <div class="seg" role="group" aria-label="头数">
    <button type="button" data-heads="1" aria-pressed="true">一个头</button>
    <button type="button" data-heads="2" aria-pressed="false">两个头</button>
  </div>
  <svg class="sentence" role="img"></svg>
  <div class="heads"></div>
  <label class="split"><span>“他”的权重</span><output class="to-a"></output><output class="to-b"></output><input type="range" min="0" max="100" value="50" aria-label="分给小明的权重，其余给累了"/></label>
</section>
<script>
const words = ['小明', '累了', '他', '想', '睡觉'];
const ME = 2, A = 0, B = 1;
// 每个头自己的 v 坐标；一个头时沿用第一张图那组
const layouts = {
  single: [[-1.3, 1], [1.2, 1.15], [0.05, 0.05], [1.35, -0.85], [-0.55, -1.4]],
  h1: [[-1.35, .55], [.35, -1.25], [.65, .95], [1.3, -.2], [-.5, -.95]],
  h2: [[.95, -1.05], [-1.2, 1.1], [.25, .35], [1.35, .65], [-.65, -1.3]],
};
const root = document.querySelector('.mh');
const sentence = root.querySelector('.sentence'), heads = root.querySelector('.heads');
const slider = root.querySelector('input'), split = root.querySelector('.split');
let mode = 1, width = 0;
const f = v => v.toFixed(1);

function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => list.reduce((h, pt) => {
    while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], pt) <= 0) h.pop();
    h.push(pt);
    return h;
  }, []);
  return half(p).slice(0, -1).concat(half(p.reverse()).slice(0, -1));
}

// 每个头分给五个词的权重
function weights() {
  if (mode === 1) {
    const w = Number(slider.value) / 100;
    return [{ cls: 'h1', w: [w, 1 - w, 0, 0, 0], v: layouts.single }];
  }
  return [
    { cls: 'h1', w: [.92, .02, .03, .02, .01], v: layouts.h1 },
    { cls: 'h2', w: [.04, .9, .03, .02, .01], v: layouts.h2 },
  ];
}

function drawSentence(list) {
  const LIFT = 46, mid = 18 + LIFT + 14, H = mode === 1 ? mid + 16 : mid + 14 + LIFT + 18;
  const x = j => width * (j + .5) / words.length;
  let s = '';
  list.forEach(({ cls, w }, h) => {
    const up = h === 0 ? -1 : 1;
    if (mode === 2) s += `<text class="pct tag ${cls}" x="0" y="${mid + up * 30}">头 ${h + 1}</text>`;
    w.forEach((value, j) => {
      if (j === ME || value < .05) return;
      const x1 = x(ME), x2 = x(j), lift = Math.min(LIFT, 16 + Math.abs(x2 - x1) * .2), y = mid + up * 14;
      s += `<path class="arc ${cls}" d="M${f(x1)} ${y} Q${f((x1 + x2) / 2)} ${f(y + up * lift * 2)} ${f(x2)} ${y}" stroke-width="${f(1 + 6 * value)}" stroke-opacity="${(.3 + .7 * value).toFixed(2)}"/>`;
      s += `<text class="pct ${cls}" x="${f((x1 + x2) / 2)}" y="${f(y + up * (lift + 10))}">${Math.round(value * 100)}%</text>`;
    });
  });
  words.forEach((word, j) => {
    const lit = list.find(({ w }) => w[j] >= .5);
    s += `<text class="word${j === ME ? ' me' : lit ? ' ' + lit.cls : ''}" x="${f(x(j))}" y="${mid}">${word}</text>`;
  });
  sentence.setAttribute('viewBox', `0 0 ${width} ${H}`);
  sentence.innerHTML = s;
}

function drawPlane(cls, w, v, index, size) {
  const unit = size / 2 / 2.1, px = ([a, b]) => [size / 2 + a * unit, size / 2 - b * unit];
  const o = v.reduce(([x, y], p, j) => [x + w[j] * p[0], y + w[j] * p[1]], [0, 0]);
  const [ox, oy] = px(o);
  let s = `<polygon class="hull" points="${hull(v).map(p => px(p).map(f).join(',')).join(' ')}"/>`;
  if (mode === 1) {
    const [ax, ay] = px(v[A]), [bx, by] = px(v[B]);
    s += `<line class="seglink" x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}"/>`;
  }
  v.forEach((p, j) => {
    const [x, y] = px(p), lit = mode === 1 ? j === A || j === B : w[j] >= .5;
    const r = 3 + 10 * Math.sqrt(w[j]);
    const d = Math.hypot(...p) > .3 ? p.map(c => c / Math.hypot(...p)) : [0, -1];
    s += `<circle class="v${lit ? ' ' + cls : ''}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill-opacity="${(.25 + .6 * w[j]).toFixed(2)}"/>`;
    const lx = Math.min(size - 14, Math.max(14, x + d[0] * (r + 13)));
    s += `<text class="vl${lit ? ' ' + cls : ''}" x="${f(lx)}" y="${f(y - d[1] * (r + 11))}">${words[j]}</text>`;
  });
  s += `<circle class="o-halo" cx="${f(ox)}" cy="${f(oy)}" r="10"/><circle class="o-dot" cx="${f(ox)}" cy="${f(oy)}" r="4.5"/>`;
  s += `<text class="sym" x="${f(ox + 13)}" y="${f(oy - 13)}">o${mode === 2 ? `<tspan dy="4">${index + 1}</tspan>` : ''}</text>`;
  const label = mode === 1 ? '输出落在小明和累了的连线上' : `头 ${index + 1} 的输出贴着${words[w.indexOf(Math.max(...w))]}`;
  return `<div><p>${mode === 1 ? '唯一的头' : `头 ${index + 1}`}</p><svg viewBox="0 0 ${f(size)} ${f(size)}" role="img" aria-label="${label}">${s}</svg></div>`;
}

function render() {
  const list = weights(), gap = width < 480 ? 10 : 24;
  drawSentence(list);
  heads.style.setProperty('--n', list.length);
  const size = Math.min(290, (width - (list.length - 1) * gap) / list.length);
  heads.innerHTML = list.map(({ cls, w, v }, i) => drawPlane(cls, w, v, i, size)).join('');
  split.hidden = mode === 2;
  split.querySelector('.to-a').textContent = `小明 ${slider.value}%`;
  split.querySelector('.to-b').textContent = `累了 ${100 - slider.value}%`;
  root.querySelectorAll('[data-heads]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.heads) === mode)));
}

root.querySelectorAll('[data-heads]').forEach(button => button.addEventListener('click', () => {
  mode = Number(button.dataset.heads);
  render();
}));
slider.addEventListener('input', render);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(sentence);
</script>
```

一个头的时候，滑块怎么拖，$o$ 都只能在“小明”和“累了”之间那条线上滑：多拿一点小明，就少拿一点累了。两个头各有一份加起来是 100% 的权重，还各有各的 $W^V$，同一个词在两个头里的 $v$ 也不一样。头 1 的 $o_1$ 贴着小明，头 2 的 $o_2$ 贴着累了，拼起来两样都在，后面的 $W^O$ 想怎么组合都行。

论文的 base 模型用 8 个头。输入是 512 维，每个头先投影到 64 维，在自己的小空间里算注意力，8 个 64 维的输出拼回 512 维。总计算量和一个 512 维的大头差不多，却能同时看 8 个地方。

论文做过对照：同样的计算量，只用一个头，翻译的 BLEU 分数低了 0.9；头太多（32 个，每头 16 维）也会变差。至于每个头学会看什么，没人指定，全靠训练。论文附录画过几个头，有的头会把 its 连到它指代的 Law 上，看起来就像在做指代消解。

## 位置：注意力分不清顺序

回头看第一张图，图里有“方向”，有“远近”，就是没有“谁在前、谁在后”。

把句子改成“他累了，小明想睡觉”。“小明”的 $q$、$k$、$v$ 一个数都不变，“他”也一样；每个词分给别人的权重、算出来的 $o$，全都原样不动，只是换了个座位。在注意力眼里，这两句话是同一袋词。

所以要把位置告诉它。办法很直接：给每个位置准备一个和词向量一样长的向量，加到词向量上：

$$
\text{输入}=\text{词向量}+\text{位置向量}.
$$

同一个词放在不同位置，输入就不一样了，算出来的 $q$、$k$、$v$ 也跟着变。

位置向量长什么样？论文用的是不同频率的正弦和余弦。我觉得最好懂的看法，是把它当成一排钟：每两维是一根指针，位置每往后走一格，每根指针转过一个固定的角度，越靠后的指针转得越慢。拖动位置看看：

```render html title="按论文公式算的 16 维位置编码；数字是每根指针转一圈要走的位置数"
<style>
  .pe { --neg: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .pe { --neg: #95bfdc; }
  .clocks { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 10px 6px; }
  .clock { text-align: center; }
  .clock svg { display: block; width: 100%; max-width: 76px; height: auto; margin: 0 auto; overflow: visible; }
  .clock small { display: block; color: var(--muted); font: 11px var(--font-mono); white-space: nowrap; }
  .face { fill: none; stroke: var(--rule-strong); }
  .noon { stroke: var(--muted); stroke-width: 1.5; }
  .hand { stroke: var(--accent); stroke-width: 2.4; stroke-linecap: round; }
  .tip { fill: var(--accent); }
  .hub { fill: var(--text); }
  .map { margin-top: 14px; touch-action: pan-y; cursor: ew-resize; }
  .map svg { display: block; width: 100%; height: auto; overflow: visible; }
  .pair { stroke: var(--bg); stroke-width: 1.5; }
  .cursor { fill: none; stroke: var(--text); stroke-width: 1.5; }
  .axis-label { fill: var(--faint); font: 10px var(--font-mono); }
  .legend { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; margin-top: 4px; color: var(--muted); font-size: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 28px; height: 8px; }
  .legend .scale { background: linear-gradient(90deg, var(--neg), transparent, var(--accent)); }
  .pe-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; margin-top: 12px; color: var(--muted); }
  .pe-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .pe-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  @media (max-width: 520px) {
    .clocks { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>
<section class="pe" aria-label="位置编码：转速不同的一组指针">
  <div class="clocks"></div>
  <div class="map"><svg role="img" shape-rendering="crispEdges"></svg></div>
  <div class="legend"><span>−1 <i class="scale"></i> +1</span><span>位置 →</span></div>
  <label class="pe-controls">位置<output></output><input type="range" min="0" max="100" value="10" aria-label="位置"/></label>
</section>
<script>
const D = 16, PAIRS = D / 2, LAST = 100;
const speed = i => 1 / 10000 ** (2 * i / D);
const root = document.querySelector('.pe');
const slider = root.querySelector('input'), map = root.querySelector('.map svg');
let width = 0;

const clocks = Array.from({ length: PAIRS }, (_, i) => {
  const box = document.createElement('div');
  box.className = 'clock';
  const turn = 2 * Math.PI / speed(i);
  box.innerHTML = `<svg viewBox="-40 -40 80 80" aria-hidden="true"><circle class="face" r="34"/><line class="noon" y1="-34" y2="-28"/><line class="hand" y2="-27"/><circle class="tip" r="3.2" cy="-27"/><circle class="hub" r="2.4"/></svg><small>${Math.round(turn).toLocaleString('en-US')} 步</small>`;
  root.querySelector('.clocks').append(box);
  return box.querySelectorAll('.hand, .tip');
});

function heat(value) {
  const tone = value >= 0 ? 'var(--accent)' : 'var(--neg)';
  return `fill="${tone}" fill-opacity="${Math.abs(value).toFixed(2)}"`;
}

function buildMap() {
  const rowH = width < 480 ? 7 : 8, H = D * rowH, cell = width / (LAST + 1);
  let s = '';
  for (let d = 0; d < D; d++) {
    const i = Math.floor(d / 2), fn = d % 2 ? Math.cos : Math.sin;
    for (let pos = 0; pos <= LAST; pos++) {
      s += `<rect x="${(pos * cell).toFixed(2)}" y="${d * rowH}" width="${(cell + .3).toFixed(2)}" height="${rowH}" ${heat(fn(pos * speed(i)))}/>`;
    }
  }
  for (let i = 1; i < PAIRS; i++) s += `<line class="pair" x1="0" x2="${width}" y1="${i * 2 * rowH}" y2="${i * 2 * rowH}"/>`;
  s += `<rect class="cursor" y="-2" height="${H + 4}" width="${Math.max(4, cell + 2).toFixed(1)}"/>`;
  map.setAttribute('viewBox', `0 0 ${width} ${H}`);
  map.innerHTML = s;
}

function render() {
  const pos = Number(slider.value), cell = width / (LAST + 1);
  clocks.forEach(([hand, tip], i) => {
    const angle = pos * speed(i), x = 27 * Math.sin(angle), y = -27 * Math.cos(angle);
    hand.setAttribute('x2', x.toFixed(2));
    hand.setAttribute('y2', y.toFixed(2));
    tip.setAttribute('cx', x.toFixed(2));
    tip.setAttribute('cy', y.toFixed(2));
  });
  map.querySelector('.cursor')?.setAttribute('x', (pos * cell - Math.max(0, (4 - cell) / 2) - 1).toFixed(1));
  root.querySelector('output').textContent = pos;
  map.setAttribute('aria-label', `位置 ${pos} 的 16 个数`);
}

function scrub(event) {
  const box = map.getBoundingClientRect();
  slider.value = Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * (LAST + 1) - .5);
  render();
}
let dragging = false;
map.addEventListener('pointerdown', event => { dragging = true; map.setPointerCapture(event.pointerId); scrub(event); });
map.addEventListener('pointermove', event => { if (dragging) scrub(event); });
map.addEventListener('pointerup', () => { dragging = false; });
map.addEventListener('pointercancel', () => { dragging = false; });
slider.addEventListener('input', render);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; buildMap(); render(); }
}).observe(root.querySelector('.map'));
</script>
```

最快的指针 6 步一圈，相邻两个位置一眼就能分开；最慢的要两万来步才转一圈，在一句话的范围里几乎不动，管的是离得很远的位置。就像读时间要同时看秒针、分针和时针，单看哪一根都会重复，一组指针合起来，每个位置都对应一组独一无二的读数。

它还有个好性质：从任意位置往后挪 3 步，每根指针都只是多转一个固定的角度，跟从哪儿出发无关。“往前数 3 个”就成了一个固定的旋转。论文猜这能让模型更容易学会按相对位置去找，再加上它也许能推广到比训练时更长的句子，就选了它。论文也试过直接学一组位置向量，效果几乎一样（BLEU 25.7 比 25.8）。

<details>
<summary>原论文的位置编码公式</summary>

$$
\begin{aligned}
\operatorname{PE}(pos,2i)&=\sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right),\\
\operatorname{PE}(pos,2i+1)&=\cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right).
\end{aligned}
$$

$pos$ 是从 0 开始的位置，$d_{\text{model}}$ 是向量维数，$i$ 是第几对维度，也就是第几根指针。分母里的 $10000^{2i/d_{\text{model}}}$ 决定这根指针转多慢，波长从 $2\pi$ 到 $10000\cdot2\pi$ 按等比排开。

</details>

## 编码器和解码器

论文做的是翻译。人工翻译大概是这样：先把原文通读一遍，再一边写译文，一边回头看原文。Transformer 也分成这两半：

```render svg title="每个小方阵：行是谁在读，列是被读的，涂色的格子能读"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 404" width="380" role="img" aria-label="编码器读整句原文；解码器先读自己写过的前缀，再用交叉注意力读编码器的输出">
<style>
  text { fill: var(--text); font-size: 14px; dominant-baseline: central; }
  .muted { fill: var(--muted); font-size: 12px; }
  .mid { text-anchor: middle; }
  .end { text-anchor: end; }
  .frame { fill: none; stroke: var(--rule-strong); stroke-dasharray: 4 4; }
  .block { fill: var(--bg-raised); stroke: var(--rule-strong); }
  .attn { fill: var(--accent-soft); stroke: var(--accent); }
  .flow { fill: none; stroke: var(--muted); stroke-width: 1.3; }
  .head { fill: var(--muted); }
  .kv { fill: none; stroke: var(--accent); stroke-width: 1.8; }
  .kv-head { fill: var(--accent); }
  .sym { fill: var(--accent-ink); font: italic 15px KaTeX_Math, var(--font-serif); }
  .sym.q { fill: var(--muted); }
  .on { fill: var(--accent); }
  .off { fill: var(--rule-strong); opacity: .45; }
  .code { font: 12px var(--font-mono); fill: var(--muted); }
</style>
<text class="muted mid" x="296" y="12">下一个词的概率</text>
<path class="flow" d="M296 40V24"/><path class="head" d="M292 28l4-6 4 6z"/>
<rect class="block" x="222" y="40" width="148" height="30" rx="6"/><text class="mid" x="296" y="55">线性 + softmax</text>
<path class="flow" d="M296 94V70"/><path class="head" d="M292 74l4-6 4 6z"/>
<rect class="frame" x="214" y="94" width="164" height="212" rx="10"/>
<text class="muted" x="224" y="108">解码器</text><text class="muted end" x="368" y="108">× 6</text>
<rect class="block" x="222" y="120" width="148" height="30" rx="6"/><text x="234" y="135">前馈</text>
<path class="flow" d="M296 164V150"/><path class="head" d="M292 154l4-6 4 6z"/>
<rect class="attn" x="222" y="164" width="148" height="40" rx="6"/><text x="234" y="184">交叉注意力</text>
<rect class="on" x="323" y="169" width="5" height="5"/><rect class="on" x="329" y="169" width="5" height="5"/><rect class="on" x="335" y="169" width="5" height="5"/><rect class="on" x="341" y="169" width="5" height="5"/><rect class="on" x="347" y="169" width="5" height="5"/><rect class="on" x="353" y="169" width="5" height="5"/><rect class="on" x="323" y="175" width="5" height="5"/><rect class="on" x="329" y="175" width="5" height="5"/><rect class="on" x="335" y="175" width="5" height="5"/><rect class="on" x="341" y="175" width="5" height="5"/><rect class="on" x="347" y="175" width="5" height="5"/><rect class="on" x="353" y="175" width="5" height="5"/><rect class="on" x="323" y="181" width="5" height="5"/><rect class="on" x="329" y="181" width="5" height="5"/><rect class="on" x="335" y="181" width="5" height="5"/><rect class="on" x="341" y="181" width="5" height="5"/><rect class="on" x="347" y="181" width="5" height="5"/><rect class="on" x="353" y="181" width="5" height="5"/><rect class="on" x="323" y="187" width="5" height="5"/><rect class="on" x="329" y="187" width="5" height="5"/><rect class="on" x="335" y="187" width="5" height="5"/><rect class="on" x="341" y="187" width="5" height="5"/><rect class="on" x="347" y="187" width="5" height="5"/><rect class="on" x="353" y="187" width="5" height="5"/><rect class="on" x="323" y="193" width="5" height="5"/><rect class="on" x="329" y="193" width="5" height="5"/><rect class="on" x="335" y="193" width="5" height="5"/><rect class="on" x="341" y="193" width="5" height="5"/><rect class="on" x="347" y="193" width="5" height="5"/><rect class="on" x="353" y="193" width="5" height="5"/>
<path class="flow" d="M296 224V204"/><path class="head" d="M292 208l4-6 4 6z"/><text class="sym q" x="304" y="215">q</text>
<rect class="attn" x="222" y="224" width="148" height="40" rx="6"/><text x="234" y="244">掩码自注意力</text>
<rect class="on" x="329" y="229" width="5" height="5"/><rect class="off" x="335" y="229" width="5" height="5"/><rect class="off" x="341" y="229" width="5" height="5"/><rect class="off" x="347" y="229" width="5" height="5"/><rect class="off" x="353" y="229" width="5" height="5"/><rect class="on" x="329" y="235" width="5" height="5"/><rect class="on" x="335" y="235" width="5" height="5"/><rect class="off" x="341" y="235" width="5" height="5"/><rect class="off" x="347" y="235" width="5" height="5"/><rect class="off" x="353" y="235" width="5" height="5"/><rect class="on" x="329" y="241" width="5" height="5"/><rect class="on" x="335" y="241" width="5" height="5"/><rect class="on" x="341" y="241" width="5" height="5"/><rect class="off" x="347" y="241" width="5" height="5"/><rect class="off" x="353" y="241" width="5" height="5"/><rect class="on" x="329" y="247" width="5" height="5"/><rect class="on" x="335" y="247" width="5" height="5"/><rect class="on" x="341" y="247" width="5" height="5"/><rect class="on" x="347" y="247" width="5" height="5"/><rect class="off" x="353" y="247" width="5" height="5"/><rect class="on" x="329" y="253" width="5" height="5"/><rect class="on" x="335" y="253" width="5" height="5"/><rect class="on" x="341" y="253" width="5" height="5"/><rect class="on" x="347" y="253" width="5" height="5"/><rect class="on" x="353" y="253" width="5" height="5"/>
<path class="flow" d="M296 326V264"/><path class="head" d="M292 268l4-6 4 6z"/>
<rect class="block" x="222" y="326" width="148" height="30" rx="6"/><text class="mid" x="296" y="341">词向量 + 位置</text>
<text class="code mid" x="296" y="374">&lt;bos&gt; Xiaoming is …</text>
<text class="muted mid" x="296" y="394">已经写出的译文</text>
<rect class="frame" x="2" y="150" width="164" height="156" rx="10"/>
<text class="muted" x="12" y="164">编码器</text><text class="muted end" x="156" y="164">× 6</text>
<rect class="block" x="10" y="176" width="148" height="30" rx="6"/><text x="22" y="191">前馈</text>
<path class="flow" d="M84 220V206"/><path class="head" d="M80 210l4-6 4 6z"/>
<rect class="attn" x="10" y="220" width="148" height="44" rx="6"/><text x="22" y="242">自注意力</text>
<rect class="on" x="111" y="225" width="5" height="5"/><rect class="on" x="117" y="225" width="5" height="5"/><rect class="on" x="123" y="225" width="5" height="5"/><rect class="on" x="129" y="225" width="5" height="5"/><rect class="on" x="135" y="225" width="5" height="5"/><rect class="on" x="141" y="225" width="5" height="5"/><rect class="on" x="111" y="231" width="5" height="5"/><rect class="on" x="117" y="231" width="5" height="5"/><rect class="on" x="123" y="231" width="5" height="5"/><rect class="on" x="129" y="231" width="5" height="5"/><rect class="on" x="135" y="231" width="5" height="5"/><rect class="on" x="141" y="231" width="5" height="5"/><rect class="on" x="111" y="237" width="5" height="5"/><rect class="on" x="117" y="237" width="5" height="5"/><rect class="on" x="123" y="237" width="5" height="5"/><rect class="on" x="129" y="237" width="5" height="5"/><rect class="on" x="135" y="237" width="5" height="5"/><rect class="on" x="141" y="237" width="5" height="5"/><rect class="on" x="111" y="243" width="5" height="5"/><rect class="on" x="117" y="243" width="5" height="5"/><rect class="on" x="123" y="243" width="5" height="5"/><rect class="on" x="129" y="243" width="5" height="5"/><rect class="on" x="135" y="243" width="5" height="5"/><rect class="on" x="141" y="243" width="5" height="5"/><rect class="on" x="111" y="249" width="5" height="5"/><rect class="on" x="117" y="249" width="5" height="5"/><rect class="on" x="123" y="249" width="5" height="5"/><rect class="on" x="129" y="249" width="5" height="5"/><rect class="on" x="135" y="249" width="5" height="5"/><rect class="on" x="141" y="249" width="5" height="5"/><rect class="on" x="111" y="255" width="5" height="5"/><rect class="on" x="117" y="255" width="5" height="5"/><rect class="on" x="123" y="255" width="5" height="5"/><rect class="on" x="129" y="255" width="5" height="5"/><rect class="on" x="135" y="255" width="5" height="5"/><rect class="on" x="141" y="255" width="5" height="5"/>
<path class="flow" d="M84 326V264"/><path class="head" d="M80 268l4-6 4 6z"/>
<rect class="block" x="10" y="326" width="148" height="30" rx="6"/><text class="mid" x="84" y="341">词向量 + 位置</text>
<text class="mid" x="84" y="374">小明累了，他想睡觉。</text>
<text class="muted mid" x="84" y="394">原文</text>
<path class="kv" d="M84 176V132H190V184H214"/><path class="kv-head" d="M214 179l7 5-7 5z"/>
<text class="sym mid" x="137" y="121">k, v</text>
</svg>
```

编码器负责读原文。六层叠起来，每层两步：先做一次自注意力，让每个词去读整句；再过一个前馈网络，每个位置单独做一次两层的非线性变换（512 维升到 2048 再降回来）。两步都会把输入加回到输出上（残差连接），再做一次 LayerNorm。读完，原文的每个位置都有了一个带上下文的向量。

解码器负责写译文，也是六层，每层三步。第一步是自注意力，读自己已经写出来的部分，而且只能往前看。第二步是交叉注意力：$q$ 来自解码器，$k$ 和 $v$ 来自编码器的最终输出，公式和自注意力一模一样，只是查的是原文。第三步还是前馈网络。

最后一层的输出乘上一个矩阵、再过一次 softmax，就是词表里每个词作为下一个词的概率。

## 训练一次算完，生成只能一个一个来

把“小明累了，他想睡觉。”翻译成 `Xiaoming is tired, he wants to sleep.`。

训练时，标准译文是现成的。把它整体右移一位，开头补一个 `<bos>`，当作解码器的输入；每个位置的任务，是预测下一个词。输入 `he` 的位置，要预测的是 `wants`。

可是如果每个位置都能看到整句输入，`he` 那一格往后看一眼，`wants` 就躺在下一个位置上，等于抄答案。所以解码器的自注意力要加**因果掩码**：把“往后看”的分数设成 $-\infty$，softmax 之后权重就是 0。

```render html title="示意：生成时假设每一步都猜对"
<style>
  .dec { font-size: 13px; line-height: 1.4; font-variant-ligatures: none; }
  .bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px; margin-bottom: 10px; }
  .seg { display: flex; gap: 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .keys { display: flex; gap: 8px; }
  .keys[hidden] { display: none; }
  .key { min-height: 38px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .key:disabled { cursor: default; opacity: .4; }
  .rows { display: grid; grid-template-columns: 5.4em repeat(10, minmax(9px, 20px)) 1.8em 6em; gap: 3px; align-items: center; width: fit-content; max-width: 100%; margin: 0 auto; }
  .rows > .h { color: var(--faint); font-size: 11px; }
  .rows > .h.span { grid-column: 2 / span 10; text-align: center; }
  .in, .out { overflow: hidden; font: 12.5px var(--font-mono); white-space: nowrap; text-overflow: ellipsis; }
  .in { color: var(--muted); text-align: right; padding-right: 6px; cursor: pointer; }
  .in.read { color: var(--text); }
  .in.answer { color: var(--accent-ink); font-weight: 600; text-decoration: underline 2px var(--accent); text-underline-offset: 3px; }
  .c { aspect-ratio: 1; border-radius: 2px; box-shadow: inset 0 0 0 1px var(--rule); }
  .c.ok { background: var(--rule-strong); box-shadow: none; }
  .c.ok.row-on { background: var(--accent); }
  .c.peek { background: var(--accent); box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--accent-ink); }
  .arrow { color: var(--faint); text-align: center; }
  .out { color: var(--text); }
  .out.wait { color: var(--faint); }
  .out.cheat { color: var(--accent-ink); }
  .out small { margin-left: 6px; color: var(--accent-ink); font: 11px var(--font-sans); }
  .empty { opacity: .18; }
  .row-on.in, .row-on.out { font-weight: 650; }
  .note { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; margin: 14px 0 0; color: var(--muted); }
  .note b { margin: 0 3px; color: var(--text); font: 500 18px var(--font-mono); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 460px) {
    .rows { grid-template-columns: 5.2em repeat(10, minmax(8px, 1fr)) 1.3em 6.2em; gap: 2px; width: auto; }
    .in { padding-right: 4px; }
    .out small { margin-left: 3px; }
    .in, .out { font-size: 11.5px; }
  }
</style>
<section class="dec" aria-label="解码器的因果掩码：训练时一次算完，生成时逐个算">
  <div class="bar">
    <div class="seg" role="group" aria-label="模式">
      <button type="button" data-mode="train" aria-pressed="true">训练</button>
      <button type="button" data-mode="gen" aria-pressed="false">生成</button>
    </div>
    <div class="keys train-keys"><button type="button" class="key peek-key" aria-pressed="false">去掉掩码</button></div>
    <div class="keys gen-keys" hidden><button type="button" class="key reset">重来</button><button type="button" class="key step">下一步 ›</button></div>
  </div>
  <div class="rows" role="table"></div>
  <p class="note" aria-live="polite"></p>
</section>
<script>
const inputs = ['<bos>', 'Xiaoming', 'is', 'tired', ',', 'he', 'wants', 'to', 'sleep', '.'];
const targets = [...inputs.slice(1), '<eos>'];
const N = inputs.length;
const root = document.querySelector('.dec');
const rows = root.querySelector('.rows'), note = root.querySelector('.note');
const peekKey = root.querySelector('.peek-key'), stepKey = root.querySelector('.step');
let mode = 'train', peek = false, focus = 5, done = 0;

function render() {
  const gen = mode === 'gen';
  const parts = ['<span class="h">输入</span><span class="h span">能读到的输入</span><span></span><span class="h">预测</span>'];
  for (let i = 0; i < N; i++) {
    const exists = !gen || i <= done, computed = !gen || i < done, on = !gen && i === focus;
    const rowCls = on ? ' row-on' : '';
    const cls = exists ? '' : ' empty';
    const answerHere = !gen && peek && i === focus + 1;
    parts.push(`<span class="in${rowCls}${cls}${!gen && i <= focus + (peek ? N : 0) ? ' read' : ''}${answerHere ? ' answer' : ''}" data-row="${i}" role="rowheader">${exists ? inputs[i].replace('<', '&lt;').replace('>', '&gt;') : '·'}</span>`);
    for (let j = 0; j < N; j++) {
      const ok = exists && (j <= i || (peek && !gen));
      const peekCell = on && peek && j === i + 1;
      parts.push(`<i class="c${ok ? ' ok' : ''}${peekCell ? ' peek' : ''}${rowCls}${cls}"></i>`);
    }
    const out = computed ? targets[i] : exists ? '?' : '';
    const cheat = !gen && peek;
    parts.push(`<span class="arrow${cls}">→</span><span class="out${rowCls}${cls}${computed ? '' : ' wait'}${cheat ? ' cheat' : ''}" data-row="${i}">${out.replace('<', '&lt;').replace('>', '&gt;')}${cheat && on ? '<small>抄的</small>' : ''}</span>`);
  }
  rows.innerHTML = parts.join('');
  root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  root.querySelector('.train-keys').hidden = gen;
  root.querySelector('.gen-keys').hidden = !gen;
  peekKey.setAttribute('aria-pressed', String(peek));
  peekKey.textContent = peek ? '加回掩码' : '去掉掩码';
  stepKey.disabled = gen && done >= N;
  note.innerHTML = gen
    ? `<span>前向<b>${done}</b>次</span><span>${done >= N ? '写完了' : `第 ${done + 1} 行等着上一行的结果`}</span>`
    : `<span>前向<b>1</b>次，同时得到<b>${N}</b>个预测</span><span>${peek ? '每一行都能看到下一格，也就是自己的答案' : ''}</span>`;
}

function fly() {
  const target = rows.querySelector(`.in[data-row="${done}"]`), source = rows.querySelector(`.out[data-row="${done - 1}"]`);
  if (!target || !source || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
  target.animate([
    { transform: `translate(${a.left - b.left + (a.width - b.width) / 2}px, ${a.top - b.top}px)`, color: 'var(--accent-ink)' },
    { transform: 'translate(0, 0)' },
  ], { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' });
}

root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  done = 0;
  render();
}));
peekKey.addEventListener('click', () => { peek = !peek; render(); });
stepKey.addEventListener('click', () => {
  if (done >= N) return;
  done++;
  render();
  fly();
});
root.querySelector('.reset').addEventListener('click', () => { done = 0; render(); });
rows.addEventListener('click', event => {
  const row = event.target.closest('[data-row]');
  if (!row || mode !== 'train') return;
  focus = Math.min(N - 2, Number(row.dataset.row));
  render();
});
render();
</script>
```

训练时，十个位置的输入都是现成的，掩码保证谁也看不到自己的答案，于是一次前向就能把十个位置的预测全算出来，和标准答案逐个对比。

生成时没有标准答案。一开始只有 `<bos>`，算出 `Xiaoming` 之后，要把它接到输入末尾，才能算下一个。后面的输入就是前面的输出，只能一步一步来。**能同时算很多个位置，不等于能同时知道还没写出来的词。**

今天的大模型基本只留下了解码器这一半，生成的方式和这里一样。一次回复从头到尾怎么一个 token 一个 token 地冒出来，我在[《从按下回车到最后一个字》](/posts/llm-request-lifecycle/)里跟过一遍。

## 参考资料

- Vaswani et al. [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017。第 3 节是注意力、多头、位置编码和整体结构；表 3 是头数、维数和位置编码的对照实验；附录有几张注意力的可视化。
