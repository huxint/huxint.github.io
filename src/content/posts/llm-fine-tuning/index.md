---
title: "一张显卡，怎么微调大模型"
description: "全量微调一个 8B 模型要 130 GB 以上的显存。LoRA 和 QLoRA 是怎么把它压到一张卡上的。"
pubDate: 2026-10-23
tags: ["大语言模型", "机器学习", "面试"]
---

一个 8B 的模型，按 BF16 存，权重 16 GB，一张 24 GB 的显卡跑推理绰绰有余。想在这张卡上接着训它，也就是微调，要 130 GB 往上。

多出来的一百多 GB 是什么？LoRA、QLoRA 这些名字，都是在压这笔账：

```render html title="每个参数占几个字节，激活另算"
<style>
  .mem { --blue: #356f9b; --blue-soft: #c3d5e3; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .mem { --blue: #95bfdc; --blue-soft: #3b4f5d; }
  .row { display: grid; grid-template-columns: 4.8em minmax(0, 1fr) 2.8em; gap: 0 12px; align-items: center; padding: 6px 0; }
  .name { color: var(--text); font-weight: 600; white-space: nowrap; }
  .bar { display: flex; align-items: center; height: 28px; }
  .bar i { display: grid; place-items: center; align-self: stretch; overflow: hidden; color: var(--text); font: 500 11.5px var(--font-sans); white-space: nowrap; box-shadow: inset -2px 0 var(--bg); }
  .bar .w { background: var(--rule-strong); }
  .bar .g { background: var(--blue); color: var(--bg); }
  .bar .m { background: var(--blue-soft); }
  .bar .o, .bar .l { background: var(--accent); color: var(--bg); }
  .bar .l { min-width: 3px; }
  .bar span { margin-left: 8px; color: var(--accent-ink); font-size: 12px; white-space: nowrap; }
  .bytes { color: var(--text); font: 600 15px var(--font-mono); text-align: right; }
  @media (max-width: 480px) {
    .row { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; }
    .bar { grid-column: 1 / -1; grid-row: 2; }
  }
</style>
<section class="mem" aria-label="全量微调、LoRA、QLoRA 每个参数各占几个字节">
  <div class="row"><span class="name">全量微调</span><div class="bar"><i class="w" style="width: 12.5%">权重</i><i class="g" style="width: 12.5%">梯度</i><i class="m" style="width: 25%">主权重</i><i class="o" style="width: 50%">Adam</i></div><span class="bytes">16</span></div>
  <div class="row"><span class="name">LoRA</span><div class="bar"><i class="w" style="width: 12.5%">权重</i><i class="l" style="width: .6%"></i><span>LoRA</span></div><span class="bytes">≈2</span></div>
  <div class="row"><span class="name">QLoRA</span><div class="bar"><i class="w" style="width: 3.3%"></i><i class="l" style="width: .6%"></i><span>4 bit 权重 + LoRA</span></div><span class="bytes">≈0.5</span></div>
</section>
```

## 训练一步，要存什么

微调和预训练是同一套算法，只是起点换成了训练好的权重，数据换成了自己的。目标是让标准答案每个 token 的概率尽量高，写成损失就是交叉熵：

$$
\mathcal{L}(\theta)=-\frac{1}{T}\sum_{t=1}^{T}\log p_\theta(y_t\mid y_{<t})
$$

$\theta$ 是全部参数，$T$ 是算损失的 token 数。训练一步分三段：前向算出 $\mathcal{L}$，反向算出每个参数的梯度 $g=\nabla_\theta\mathcal{L}$，再顺着梯度把参数挪一点。

挪法几乎都是 AdamW。它给每个参数多记两个数，梯度的滑动平均 $m$ 和梯度平方的滑动平均 $v$：

$$
\begin{aligned}
m&\leftarrow\beta_1m+(1-\beta_1)\,g,\\
v&\leftarrow\beta_2v+(1-\beta_2)\,g^2,\\
\theta&\leftarrow\theta-\eta\,\frac{\hat m}{\sqrt{\hat v}+\epsilon}.
\end{aligned}
$$

$\hat m$、$\hat v$ 是偏差修正后的 $m$、$v$，$\eta$ 是学习率。除以 $\sqrt{\hat v}$ 等于给每个参数单独定步长，结果是每一步都挪 $\eta$ 左右，跟梯度本身多大关系不大。讲 LoRA 的 $\alpha$ 时会用到这一点。

混合精度训练时，每个参数要存这些：

| 存的东西 | 精度 | 字节 |
| --- | --- | --- |
| 权重，前向和反向用 | BF16 | 2 |
| 梯度 | BF16 | 2 |
| 主权重，更新用 | FP32 | 4 |
| Adam 的 $m$、$v$ | FP32 | 8 |

一共 16 字节，8B 的模型就是 128 GB。推理只要第一行。

**为什么要一份 FP32 的主权重？** BF16 的有效精度只有 8 个二进制位。一个 0.02 左右的权重，离它最近的可表示的数要差 0.0001 量级；Adam 一步大约挪 $10^{-5}$，加上去一舍入，原样退了回来。更新只能在 FP32 上累加，算完再转一份 BF16 去做前向。

**为什么是 BF16，不是 FP16？**

| 格式 | 指数位 | 尾数位 | 最大值 |
| --- | --- | --- | --- |
| FP32 | 8 | 23 | $3.4\times10^{38}$ |
| FP16 | 5 | 10 | $65504$ |
| BF16 | 8 | 7 | $3.4\times10^{38}$ |

BF16 拿精度换范围，指数位和 FP32 一样多。FP16 范围太窄，小梯度会下溢成 0，得配 loss scaling：先把损失乘一个大数再反向，更新前再除回来。BF16 不用操这个心。

**激活。** 反向传播要用到前向每一层的中间结果，前向时就得先存着。这块跟 batch 大小乘序列长度成正比，跟用哪种微调方法无关。标准的省法是梯度检查点：前向只留每层的输入，反向时把这一层重算一遍，多花一次前向的算力，换掉大半激活。

**多卡。** 普通的数据并行，每张卡都存完整的 16 字节，卡再多也不省。DeepSpeed 的 ZeRO 把这些状态切开分给各张卡，设参数量为 $\Phi$、卡数为 $N$：

| | 每张卡存的字节 |
| --- | --- |
| 数据并行 | $16\Phi$ |
| ZeRO-1：切优化器状态 | $4\Phi+12\Phi/N$ |
| ZeRO-2：再切梯度 | $2\Phi+14\Phi/N$ |
| ZeRO-3：连权重也切 | $16\Phi/N$ |

ZeRO-3 的代价是通信：每层算之前，都得先从各张卡把权重收齐。PyTorch 的 FSDP 是同一个思路。

不过这只是把账摊开，总数一分没少。LoRA 换了个思路：大部分参数，干脆不训。

## LoRA：只训一个差值

微调前后，权重从 $W_0$ 变成 $W_0+\Delta W$。全量微调学的就是 $\Delta W$：一个 $4096\times4096$ 的矩阵，1,677 万个自由参数。

可微调的数据常常只有几千条，用不上这么多自由度。2020 年有个实验：把 RoBERTa 的全部更新限制在一个随机的 200 维子空间里，在 MRPC 上就能拿到全量微调 90% 的效果。预训练过的模型换任务时，要动的方向其实很少。

LoRA 假设每个矩阵的 $\Delta W$ 都是低秩的，直接写成两个瘦矩阵相乘：

$$
\Delta W=BA,\qquad B\in\mathbb{R}^{d\times r},\quad A\in\mathbb{R}^{r\times k},\quad r\ll\min(d,k).
$$

$W_0$ 冻住，只训 $A$、$B$，参数从 $dk$ 降到 $r(d+k)$。$d=k=4096$、$r=16$ 时，不到原来的 1%。

秩为 1 的矩阵就是一列乘一行，像一块格子布；秩为 $r$，就是 $r$ 块叠起来。下面的 $\Delta W$ 是构造的，三个主方向加一点噪声：

```render html
<style>
  .lr { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .lr { --blue: #95bfdc; }
  .lr-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 16px; }
  .seg { display: flex; gap: 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .lr svg { display: block; width: 100%; height: auto; margin-top: 4px; overflow: visible; }
  .pos { fill: var(--accent); }
  .neg { fill: var(--blue); }
  .frame { fill: none; stroke: var(--rule-strong); }
  .ghost { fill: none; stroke: var(--rule-strong); stroke-dasharray: 2 3; }
  .lbl { dominant-baseline: central; }
  .lbl .sym { fill: var(--text); font: italic 17px KaTeX_Math, var(--font-serif); }
  .lbl .up { font: 17px KaTeX_Main, var(--font-serif); }
  .op { fill: var(--muted); font: 20px KaTeX_Main, var(--font-serif); text-anchor: middle; dominant-baseline: central; }
  .sv { fill: var(--rule-strong); }
  .sv.on { fill: var(--accent); }
  .cut { stroke: var(--text); stroke-dasharray: 3 3; stroke-opacity: .5; }
  .cap { fill: var(--muted); font-size: 12px; }
  .stats { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 18px; margin: 8px 0 0; color: var(--muted); }
  .stats b { margin-left: 5px; color: var(--text); font: 500 17px var(--font-mono); }
  .ctl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; margin-top: 6px; color: var(--muted); }
  .ctl i { color: var(--text); font: italic 15px KaTeX_Math, var(--font-serif); }
  .ctl output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .ctl input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
</style>
<section class="lr" aria-label="用两条瘦矩阵的乘积逼近一个 24×24 的矩阵">
  <div class="lr-top">
    <div class="seg" role="group" aria-label="目标矩阵">
      <button type="button" data-kind="low" aria-pressed="true">低秩</button>
      <button type="button" data-kind="full" aria-pressed="false">满秩</button>
    </div>
  </div>
  <svg role="img" shape-rendering="crispEdges"></svg>
  <p class="stats"></p>
  <label class="ctl"><span>秩 <i>r</i></span><output></output><input type="range" min="1" max="12" value="3" aria-label="秩 r"/></label>
</section>
<script>
const N = 24, RMAX = 12;
function random(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rand) {
  let u = 0;
  while (!u) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
// 先放几个平滑的主方向，再补随机向量，按顺序正交化
function basis(rand, waves) {
  const cols = waves.map(([f, p]) => Array.from({ length: N }, (_, i) => Math.cos(Math.PI * f * (i + .5) / N + p)));
  while (cols.length < N) cols.push(Array.from({ length: N }, () => gauss(rand)));
  const out = [];
  for (const v of cols) {
    for (const u of out) {
      const d = v.reduce((s, x, i) => s + x * u[i], 0);
      v.forEach((_, i) => { v[i] -= d * u[i]; });
    }
    const n = Math.hypot(...v);
    out.push(v.map(x => x / n));
  }
  return out;
}
const energy = s => s.reduce((a, v) => a + v * v, 0);
const LOW = Array.from({ length: N }, (_, i) => [6, 4.2, 2.8][i] ?? .16 * (1 - .5 * (i - 3) / 20));
const FLAT = Array.from({ length: N }, (_, i) => 1 - .55 * i / (N - 1));
const FULL = FLAT.map(v => v * Math.sqrt(energy(LOW) / energy(FLAT)));

function build(kind) {
  const low = kind === 'low', rand = random(low ? 7 : 11), s = low ? LOW : FULL;
  const U = basis(rand, low ? [[1, .6], [2, 2.1], [3, 4.4]] : []);
  const V = basis(rand, low ? [[1, 1.9], [3, .3], [2, 3.7]] : []);
  // 只留前 r 个奇异值
  const part = r => Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => {
    let v = 0;
    for (let t = 0; t < r; t++) v += s[t] * U[t][i] * V[t][j];
    return v;
  }));
  const M = part(N);
  const B = U.slice(0, RMAX).map((u, t) => u.map(x => x * Math.sqrt(s[t])));
  const A = V.slice(0, RMAX).map((v, t) => v.map(x => x * Math.sqrt(s[t])));
  const peak = m => Math.max(...m.flat().map(Math.abs));
  return { s, part, M, B, A, peak: { M: peak(M), B: peak(B), A: peak(A) } };
}
const targets = { low: build('low'), full: build('full') };

const root = document.querySelector('.lr');
const svg = root.querySelector('svg'), slider = root.querySelector('input');
let kind = 'low', width = 0;

function cells(x0, y0, rows, cols, value, peak, c) {
  let out = '';
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = value(i, j), a = Math.min(1, Math.abs(v) / peak);
      if (a > .03) out += `<rect class="${v > 0 ? 'pos' : 'neg'}" x="${x0 + j * c}" y="${y0 + i * c}" width="${c}" height="${c}" fill-opacity="${(a ** .8).toFixed(2)}"/>`;
    }
  }
  return out;
}

function render() {
  const r = Number(slider.value), T = targets[kind];
  const gap = 6, mid = width < 480 ? 28 : 44;
  const c = Math.max(4, Math.floor((width - gap - mid) / (RMAX + 2 * N)));
  const x0 = Math.floor((width - c * (RMAX + 2 * N) - gap - mid) / 2);
  const xP = x0 + RMAX * c + gap, xT = xP + N * c + mid, size = N * c, band = RMAX * c;
  const yA = 22, yP = yA + band + gap, H = yP + size + 30;
  const P = T.part(r);
  // 虚线框是 r = 12 的位置：两条瘦矩阵和整块一样大
  let s = `<rect class="ghost" x="${x0}" y="${yP}" width="${band}" height="${size}"/><rect class="ghost" x="${xP}" y="${yA}" width="${size}" height="${band}"/>`;
  // 第 t 个分量是 B 的第 t 列配 A 的第 t 行，离乘积一样远
  s += cells(xP - gap - r * c, yP, N, r, (i, j) => T.B[r - 1 - j][i], T.peak.B, c);
  s += cells(xP, yA + band - r * c, r, N, (i, j) => T.A[r - 1 - i][j], T.peak.A, c);
  s += cells(xP, yP, N, N, (i, j) => P[i][j], T.peak.M, c);
  s += cells(xT, yP, N, N, (i, j) => T.M[i][j], T.peak.M, c);
  s += [[xP - gap - r * c, yP, r * c, size], [xP, yA + band - r * c, size, r * c], [xP, yP, size, size], [xT, yP, size, size]]
    .map(([x, y, w, h]) => `<rect class="frame" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');
  s += `<text class="lbl" x="${xP - 10}" y="${yA + band - r * c / 2}" text-anchor="end"><tspan class="sym">A</tspan></text>`;
  s += `<text class="lbl" x="${xP - gap}" y="${yP + size + 16}" text-anchor="end"><tspan class="sym">B</tspan></text>`;
  s += `<text class="lbl" x="${xP + size / 2}" y="${yP + size + 16}" text-anchor="middle"><tspan class="sym">BA</tspan></text>`;
  s += `<text class="lbl" x="${xT + size / 2}" y="${yP + size + 16}" text-anchor="middle"><tspan class="sym"><tspan class="up">Δ</tspan>W</tspan></text>`;
  s += `<text class="op" x="${xP + size + mid / 2}" y="${yP + size / 2}">≈</text>`;
  T.s.forEach((v, t) => {
    const h = Math.max(1, v / T.s[0] * (band - 6));
    s += `<rect class="sv${t < r ? ' on' : ''}" x="${xT + t * c + (c > 5 ? 1 : 0)}" y="${yA + band - h}" width="${c > 5 ? c - 2 : c - 1}" height="${h}"/>`;
  });
  s += `<line class="cut" x1="${xT + r * c}" x2="${xT + r * c}" y1="${yA}" y2="${yA + band}"/>`;
  s += `<text class="cap" x="${xT}" y="${yA - 8}">奇异值</text>`;
  const err = Math.sqrt(energy(T.s.slice(r)) / energy(T.s)) * 100;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', `秩 ${r}：两条瘦矩阵共 ${r * 2 * N} 个数，整块 ${N * N} 个，相对误差 ${err.toFixed(1)}%`);
  root.querySelector('.stats').innerHTML = `<span>误差<b>${err.toFixed(1)}%</b></span>`;
  root.querySelector('.ctl output').textContent = r;
}

root.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  kind = button.dataset.kind;
  root.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));
slider.addEventListener('input', render);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

图里的 $BA$ 是对目标做 SVD、只留前 $r$ 个奇异值得到的。Eckart–Young 定理说，秩不超过 $r$ 的矩阵里它离目标最近，所以这是 LoRA 的上限。

切到满秩就没有捷径了：$r$ 拖到 12，两条瘦矩阵已经和整块一样大，误差还剩一半。LoRA 好使，前提是任务要的改动本来就低秩。换说话格式、学回答风格，多半满足；灌大量新知识，就未必。2024 年的 LoRA Learns Less and Forgets Less 测过：在代码和数学上，全量微调学到的 $\Delta W$，秩要高出 10 到 100 倍。LoRA 学得少，忘得也少。

## 一层 LoRA 怎么算

$$
h=W_0x+\frac{\alpha}{r}BAx
$$

先算 $Ax$，得到一个 $r$ 维的小向量，再乘 $B$，全程不出现 $d\times k$ 的大矩阵。

**初始化。** $A$ 随机，$B$ 全零。一开始 $BA=0$，模型和原模型一模一样。为什么不两个都设成 0？记 $\delta=\partial\mathcal{L}/\partial h$：

$$
\frac{\partial\mathcal{L}}{\partial B}=\frac{\alpha}{r}\,\delta\,(Ax)^\top,\qquad
\frac{\partial\mathcal{L}}{\partial A}=\frac{\alpha}{r}\,B^\top\delta\,x^\top.
$$

$B$ 的梯度里有 $A$，$A$ 的梯度里有 $B$，两个都是 0 就永远动不了。$B$ 为 0、$A$ 随机时，$B$ 先拿到梯度，离开 0 以后 $A$ 再跟上。反过来让 $A$ 为 0 也行，只是实验上前一种能用更大的学习率，效果更好。

**缩放。** $r$ 翻倍，$BA$ 叠的项多一倍，$\alpha/r$ 正好减半，换 $r$ 时学习率不用大动。又因为 Adam 会把梯度的整体大小除掉，调 $\alpha$ 约等于调学习率，所以常见做法是把 $\alpha$ 定成 $r$ 或 $2r$，只调学习率。rsLoRA 认为 $1/r$ 压过了头，大秩被压得学不动，改成了 $\alpha/\sqrt r$。

**合并。** 训完把 $W_0+\frac{\alpha}{r}BA$ 算出来存成普通矩阵，推理和原模型一样快。训练时是两条旁路，部署时什么都不剩，这是 LoRA 最漂亮的一笔。也可以不合并，下一节说。

**省了什么。** 冻住的参数不要梯度，也不要 Adam 状态和 FP32 主权重，16 字节降到 2 字节。省不下的是激活：最前面那层的 LoRA 也要梯度，反向传播照样得穿过每一层。算力也只省了对冻结权重求梯度那一份，大约是全量的三分之二。

## 插拔：一份底座，很多个任务

LoRA 训完只存 $A$ 和 $B$。用 PEFT 训，就是两个文件：

```text
adapter_config.json          底座是谁、r、alpha、挂在哪些层
adapter_model.safetensors    每一层的 A 和 B
```

通常几十 MB，底座一个字节都不用再存。于是 LoRA 像插件，底座加载一次，换任务就换一组：

```python
from peft import PeftModel

model = PeftModel.from_pretrained(base, "lora/support", adapter_name="support")
model.load_adapter("lora/translate", adapter_name="translate")

model.set_adapter("translate")   # 换成翻译那一组
with model.disable_adapter():    # 临时拔掉，跑原模型
    ...
```

线上服务更进一步：同一个 batch 里，这个请求要客服、那个要翻译、第三个只要原模型。这时就不能合并了，一份合并后的权重只装得下一个任务：

```render html
<style>
  .mux { --t0: var(--accent); --t1: #356f9b; --t2: #3a7a5c; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .mux { --t1: #95bfdc; --t2: #8cc9ac; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .tex { font-family: KaTeX_Main, var(--font-serif); font-weight: 400; }
  .tex i { font-family: KaTeX_Math, var(--font-serif); }
  .tex sub { font-size: .7em; }
  .rows { display: grid; grid-template-columns: auto 18px minmax(76px, 8.5em) 18px 40px 14px 1.2em; gap: 10px 6px; align-items: center; justify-content: center; margin-top: 16px; }
  .task { display: inline-flex; align-items: center; gap: 7px; color: var(--text); white-space: nowrap; }
  .task::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .task.base { color: var(--muted); }
  .task.base::before { background: none; box-shadow: inset 0 0 0 1.5px var(--muted); }
  .line { height: 0; border-top: 1.2px solid var(--muted); }
  .shared { grid-column: 3; grid-row: 1 / span 5; align-self: stretch; display: grid; place-content: center; border: 1px solid var(--rule-strong); background-color: var(--rule);
    background-image: linear-gradient(color-mix(in srgb, var(--rule-strong) 70%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--rule-strong) 70%, transparent) 1px, transparent 1px);
    background-size: 100% 20%, 25% 100%; background-position: 0 -1px, -1px 0; }
  .shared span { padding: 0 6px; background: var(--rule); color: var(--text); font-size: 19px; line-height: 1.3; text-align: center; }
  .shared .ba { color: var(--t1); }
  .plus { color: var(--muted); font: 16px KaTeX_Main, var(--font-serif); text-align: center; }
  .tie { display: block; width: 40px; height: 16px; overflow: visible; }
  .tie path { fill: color-mix(in srgb, var(--c) 16%, transparent); stroke: var(--c); stroke-width: 1.3; }
  .out { color: var(--text); font-size: 15px; text-align: center; }
  .out.bad { color: var(--accent-ink); }
  .mux[data-mode="merged"] .shared { border-color: var(--t1); background-color: color-mix(in srgb, var(--t1) 14%, var(--bg)); }
  .mux[data-mode="merged"] .shared span { background: color-mix(in srgb, var(--t1) 14%, var(--bg)); }
  .mux[data-mode="merged"] .lane { visibility: hidden; }
</style>
<section class="mux" data-mode="lanes" aria-label="同一个 batch 里的请求各挂各的 LoRA">
  <div class="seg" role="group" aria-label="LoRA 怎么挂">
    <button type="button" data-mode="lanes" aria-pressed="true">旁路挂着</button>
    <button type="button" data-mode="merged" aria-pressed="false">把翻译并进 <span class="tex"><i>W</i><sub>0</sub></span></button>
  </div>
  <div class="rows"></div>
</section>
<script>
// 请求要的任务和对应的颜色编号；原模型不挂 LoRA
const REQUESTS = [['客服', 0], ['翻译', 1], ['SQL', 2], ['原模型', -1], ['翻译', 1]];
const MERGED = 1;
const TIE = '<svg class="tie" viewBox="0 0 40 16" aria-hidden="true"><path d="M1 1.5L20 7L39 1.5V14.5L20 9L1 14.5Z"/></svg>';
const root = document.querySelector('.mux'), rows = root.querySelector('.rows');

rows.innerHTML = '<div class="shared"></div>' + REQUESTS.map(([task, t]) => {
  const color = t < 0 ? '' : ` style="--c: var(--t${t})"`;
  return `<span class="task${t < 0 ? ' base' : ''}"${color}>${task}</span><span class="line"></span>` +
    (t < 0 ? '<span></span><span></span>' : `<span class="plus lane">+</span><span class="lane"${color}>${TIE}</span>`) +
    '<span class="line"></span><span class="out"></span>';
}).join('');

function show(mode) {
  const merged = mode === 'merged';
  root.dataset.mode = mode;
  root.querySelector('.shared').innerHTML = merged
    ? '<span class="tex"><i>W</i><sub>0</sub><br>+ <i class="ba">BA</i></span>'
    : '<span class="tex"><i>W</i><sub>0</sub></span>';
  const ok = REQUESTS.map(([, t]) => !merged || t === MERGED);
  root.querySelectorAll('.out').forEach((out, i) => {
    out.textContent = ok[i] ? '✓' : '✗';
    out.classList.toggle('bad', !ok[i]);
  });
  root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

root.querySelectorAll('button[data-mode]').forEach(b => b.addEventListener('click', () => show(b.dataset.mode)));
show('lanes');
</script>
```

不合并时，整批先一起乘 $W_0$，再分组乘各自的 $A$、$B$ 加回去。多出的计算很少，麻烦在于又小又碎。Punica、S-LoRA 专门写了 kernel，把它们攒成一次算完；S-LoRA 还把暂时不用的 LoRA 放在内存里，按需搬进显存，一张卡能挂上千个。vLLM 的 `--enable-lora` 也是这么干的。

插件还能叠：$W_0+\Delta W_1+\Delta W_2$，一组管风格，一组管格式，只是叠在一起可能互相打架。另外插件认底座：$A$、$B$ 学的是相对某个 $W_0$ 的差，换了底座就对不上了。

## 加在哪，秩取多少

一层 Transformer 有 7 个线性层：注意力的 q、k、v、o，MLP 的 gate、up、down。LoRA 原论文只挂了注意力；后来 QLoRA 和 Thinking Machines 的 LoRA Without Regret 都发现，要追平全量微调得全部挂上，MLP 最要紧，这比 $r$ 取多少重要得多。

$r$ 常取 8 到 64。它对显存几乎没影响，管的是容量：数据少、任务窄就用小的。学习率要比全量微调大一个数量级，全量常用 $10^{-5}$ 上下，LoRA 常用 $10^{-4}$ 上下。

词表里加了新 token 时，embedding 和 lm_head 里的新行是随机初始化的，这两层要整个放开训（PEFT 里写进 `modules_to_save`）。

## QLoRA：把冻住的底座压成 4 bit

LoRA 之后，最大的一块是冻住的底座。它只被读、不被改，那就压缩着存，算到哪层解压哪层：底座存成 4 bit，LoRA 照常用 16 位训。

4 bit 只有 16 个格子。absmax 量化先把一组数除以其中绝对值最大的 $c$，缩到 $[-1,1]$，再归到最近的格子，只存编号：

$$
\hat w=c\cdot q_j,\qquad j=\arg\min_i\,\Big|\,q_i-\frac{w}{c}\,\Big|.
$$

格子怎么摆是关键。INT4 等距地摆；NF4 按正态分布的分位数摆，因为训练好的权重大致就是正态分布，这样每个格子分到的数差不多一样多：

```render html
<style>
  .q4 { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .q4 { --blue: #95bfdc; }
  .key { min-height: 38px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .q4 svg { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; }
  .name { fill: var(--text); font-size: 14px; font-weight: 600; }
  .note { fill: var(--muted); font-size: 12px; font-weight: 400; }
  .err { fill: var(--text); font: 500 14px var(--font-mono); text-anchor: end; }
  .err tspan { fill: var(--muted); font: 12px var(--font-sans); }
  .use { fill: var(--accent); }
  .axis { stroke: var(--rule-strong); }
  .lv { stroke: var(--text); stroke-width: 1.4; }
  .bell { fill: var(--blue); fill-opacity: .16; stroke: var(--blue); stroke-opacity: .7; }
  .spike { fill: var(--accent-ink); }
  .out-label { fill: var(--accent-ink); font-size: 12px; text-anchor: end; dominant-baseline: central; }
</style>
<section class="q4" aria-label="同样的权重，INT4 和 NF4 的格子各分到多少">
  <button type="button" class="key" aria-pressed="false">混进一个离群值</button>
  <svg role="img"></svg>
</section>
<script>
const NF4 = [-1, -.6962, -.5251, -.3949, -.2844, -.1848, -.0911, 0, .0796, .1609, .2461, .3379, .4407, .5626, .723, 1];
const INT4 = Array.from({ length: 15 }, (_, i) => (i - 7) / 7);
const ROWS = [['INT4', '等距', INT4], ['NF4', '按正态分位数', NF4]];
const BLOCKS = 2000, SIZE = 64, BINS = 80;
function random(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = random(5);
const gauss = () => {
  let u = 0;
  while (!u) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};
const data = Array.from({ length: BLOCKS }, () => Array.from({ length: SIZE }, gauss));

function measure(outlier) {
  const rows = ROWS.map(([name, note, levels]) => ({ name, note, levels, use: levels.map(() => 0), err: 0 }));
  const hist = new Array(BINS).fill(0);
  for (const block of data) {
    // 离群值顶替每块的第一个数
    const w = outlier ? [7, ...block.slice(1)] : block;
    const c = Math.max(...w.map(Math.abs));
    w.forEach(x => {
      const v = x / c;
      // 决定缩放的那个数总落在 ±1 上，不画进分布
      if (Math.abs(v) < 1) hist[Math.floor((v + 1) / 2 * BINS)]++;
      for (const row of rows) {
        let k = 0;
        for (let j = 1; j < row.levels.length; j++) if (Math.abs(row.levels[j] - v) < Math.abs(row.levels[k] - v)) k = j;
        row.use[k]++;
        row.err += Math.abs(x - row.levels[k] * c);
      }
    });
  }
  rows.forEach(row => {
    row.use = row.use.map(u => u / (BLOCKS * SIZE));
    row.err /= BLOCKS * SIZE;
  });
  return { rows, hist };
}
const states = [measure(false), measure(true)];
const root = document.querySelector('.q4'), svg = root.querySelector('svg'), key = root.querySelector('.key');
let outlier = false, width = 0;

function render() {
  const { rows, hist } = states[Number(outlier)];
  const narrow = width < 480, pad = 12;
  const barH = narrow ? 56 : 76, bw = narrow ? 6 : 10, bellH = narrow ? 30 : 38;
  const x = v => pad + (v + 1) / 2 * (width - 2 * pad);
  const top = Math.max(...rows.flatMap(row => row.use));
  const ax1 = 34 + barH, mid = ax1 + 12 + bellH, ax2 = mid + bellH + 12, H = ax2 + barH + 38;
  // 相邻三格做一次加权平均，抹掉抽样的毛刺
  const smooth = hist.map((h, i) => ((hist[i - 1] ?? h) + 2 * h + (hist[i + 1] ?? h)) / 4);
  const peak = Math.max(...smooth);
  const pts = smooth.map((h, i) => [x(-1 + (i + .5) / BINS * 2).toFixed(1), h / peak * bellH]);
  let s = `<polygon class="bell" points="${x(-1)},${mid} ${pts.map(([px, h]) => `${px},${(mid - h).toFixed(1)}`).join(' ')} ${x(1)},${mid} ${pts.reverse().map(([px, h]) => `${px},${(mid + h).toFixed(1)}`).join(' ')}"/>`;
  if (outlier) s += `<circle class="spike" cx="${x(1)}" cy="${mid}" r="4"/><text class="out-label" x="${x(1) - 10}" y="${mid}">离群值</text>`;
  rows.forEach((row, k) => {
    const up = k === 0, ax = up ? ax1 : ax2, textY = up ? 12 : H - 6;
    s += `<text class="name" x="0" y="${textY}">${row.name}<tspan class="note" dx="8">${row.note}</tspan></text>`;
    s += `<text class="err" x="${width}" y="${textY}"><tspan>误差 </tspan>${row.err.toFixed(3)}</text>`;
    s += `<line class="axis" x1="${pad}" x2="${width - pad}" y1="${ax}" y2="${ax}"/>`;
    row.levels.forEach((l, i) => {
      const lx = x(l), h = row.use[i] / top * barH;
      s += `<line class="lv" x1="${lx.toFixed(1)}" x2="${lx.toFixed(1)}" y1="${ax - 4}" y2="${ax + 4}"/>`;
      if (h > .5) s += `<rect class="use" x="${(lx - bw / 2).toFixed(1)}" y="${(up ? ax - 6 - h : ax + 6).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}"/>`;
    });
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', `误差：INT4 ${rows[0].err.toFixed(3)}，NF4 ${rows[1].err.toFixed(3)}`);
  key.setAttribute('aria-pressed', String(outlier));
}

key.addEventListener('click', () => { outlier = !outlier; render(); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

同样是 4 bit 的编号，NF4 平均能用出 3.9 bit 的信息量，INT4 只有 3.5 bit。

点“混进一个离群值”：$c$ 被撑大，其余的数全挤进中间几格。所以 QLoRA 每 64 个权重分一块，各算各的 $c$，离群值只祸害自己那一块。

**双重量化。** 每块一个 32 位的 $c$，摊下来每个参数多 0.5 bit。把这些 $c$ 再按 256 个一组量化成 8 bit，就降到了

$$
\frac{8}{64}+\frac{32}{64\times256}\approx0.127\ \text{bit}.
$$

**分页优化器。** 长样本让显存突然冲高时，把优化器状态换页到 CPU 内存，免得 OOM。

**存 4 bit，算 16 bit。** 每层计算前先解压回 BF16：

$$
h=\operatorname{dequant}\big(W_0^{\text{NF4}}\big)\,x+\frac{\alpha}{r}BAx.
$$

所以 QLoRA 省显存、不省算力，还比 LoRA 慢一点。论文用它在一张 48 GB 的卡上微调了 65B 的模型，效果追平 16 位微调。

合并有个坑：LoRA 补的是量化后底座的差。合并到原始权重上，底座变了；合并后再量化，又多挨一次误差。LoftQ 的办法是量化时就让 $BA$ 先补上量化误差。

## 别的省法

LoRA 不是第一个省参数的。几种方法的可训练部分，分别放在一层的哪里：

```render html
<style>
  .peft { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 16px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .peft svg { display: block; width: 100%; height: auto; margin-top: 14px; overflow: visible; }
  .spine { fill: none; stroke: var(--muted); stroke-width: 2; }
  .wire { fill: none; stroke: var(--muted); stroke-width: 1.2; }
  .tip, .dot { fill: var(--muted); }
  .add { fill: var(--bg); stroke: var(--muted); stroke-width: 1.2; }
  .mat { fill: var(--rule); stroke: var(--rule-strong); }
  .cell { stroke: var(--rule-strong); stroke-width: .7; }
  .split { stroke: var(--rule-strong); stroke-width: 1.3; }
  .op { fill: var(--text); font-size: 12.5px; text-anchor: middle; dominant-baseline: central; }
  .op.quiet { fill: var(--muted); font-size: 11.5px; }
  .w { fill: var(--text); font: italic 13px KaTeX_Math, var(--font-serif); text-anchor: middle; }
  .w .sub { font-size: 9.5px; }
  .w .rm { font-family: KaTeX_Main, var(--font-serif); font-style: normal; }
  .note { fill: var(--muted); font-size: 11.5px; }
  .tok { fill: var(--rule-strong); }
  .hot { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.2; }
  .hot-wire { fill: none; stroke: var(--accent); stroke-width: 1.3; }
  .hot-fill { fill: var(--accent); }
  .ba { fill: var(--accent-ink); font: italic 11.5px KaTeX_Math, var(--font-serif); text-anchor: middle; }
  .peft[data-m="full"] .mat { fill: var(--accent-soft); stroke: var(--accent); }
  .peft[data-m="full"] .cell, .peft[data-m="full"] .split { stroke: var(--accent); stroke-opacity: .55; }
  .peft[data-m="full"] .norm { fill: var(--accent-ink); }
</style>
<section class="peft" data-m="lora" aria-label="几种微调方法的可训练参数放在一层 Transformer 的哪里">
  <div class="seg" role="group" aria-label="方法"></div>
  <svg role="img" aria-label="一层 Transformer：残差流上挂着注意力和 MLP 两个子层"></svg>
</section>
<script>
const METHODS = { full: '全量', lora: 'LoRA', adapter: 'Adapter', prefix: 'Prefix', prompt: 'Prompt', ia3: '(IA)³' };
// 两个子层从左到右的节点：种类、宽度、矩阵名或文字。下标是一个字母的用斜体，单词用正体
const ROWS = [
  [['norm', 50], ['mats', 66, ['q', 'k', 'v']], ['op', 40, '注意力'], ['mats', 22, ['o']], ['slot', 26]],
  [['norm', 50], ['mats', 64, ['gate', 'up']], ['op', 32, 'SiLU'], ['mats', 32, ['down']], ['slot', 26]],
];
// 注意力子层在下，MLP 子层在上；add 是写回残差流的位置，lane 是 LoRA 旁路
const LEVELS = [{ add: 148, base: 182, lane: 210 }, { add: 42, base: 76, lane: 104 }];
const S = 14, TOP = 10, TOK = 248, H = 266;
const root = document.querySelector('.peft'), svg = root.querySelector('svg'), seg = root.querySelector('.seg');
let mode = 'lora', width = 0;

const tipUp = (x, y) => `<path class="tip" d="M${x} ${y}l-3.5 6h7z"/>`;
const tipLeft = (x, y) => `<path class="tip" d="M${x} ${y}l6-3.5v7z"/>`;
const plus = (x, y, r, hot) => `<circle class="${hot ? 'hot' : 'add'}" cx="${x}" cy="${y}" r="${r}"/><path class="${hot ? 'hot-wire' : 'wire'}" d="M${x - r + 2.5} ${y}h${2 * r - 5}M${x} ${y - r + 2.5}v${2 * r - 5}"/>`;

// 先收窄到 r（或瓶颈维度），再放宽回去；中间的点代表非线性
function bottleneck(cx, cy, w, h, nonlinear) {
  const l = cx - w / 2, r = cx + w / 2;
  return `<path class="hot" d="M${l} ${cy - h / 2}L${cx} ${cy - 1.5}L${r} ${cy - h / 2}V${cy + h / 2}L${cx} ${cy + 1.5}L${l} ${cy + h / 2}Z"/>` +
    (nonlinear ? `<circle class="hot-fill" cx="${cx}" cy="${cy}" r="2.4"/>` : '');
}

// 一个格子块代表一组权重矩阵，粗线分开各个矩阵
function block(x, y, w, names) {
  const h = 20, part = w / names.length, top = y - h / 2;
  let s = `<rect class="mat" x="${x}" y="${top}" width="${w}" height="${h}" rx="2"/>`;
  names.forEach((name, i) => {
    const px = x + i * part;
    s += `<path class="cell" d="M${px + part / 3} ${top}v${h}M${px + 2 * part / 3} ${top}v${h}M${px} ${y - h / 6}h${part}M${px} ${y + h / 6}h${part}"/>`;
    if (i) s += `<path class="split" d="M${px} ${top}v${h}"/>`;
    s += `<text class="w" x="${px + part / 2}" y="${top - 6}">W<tspan class="sub${name.length > 1 ? ' rm' : ''}" dy="3">${name}</tspan></text>`;
  });
  return s;
}

function render() {
  const x0 = S + 16, used = Math.max(...ROWS.map(row => row.reduce((sum, [, w]) => sum + w, 0)));
  const gap = Math.max(8, Math.min(64, (width - x0 - 12 - used) / 5)), riser = x0 + used + 5 * gap;
  let s = `<path class="wire" d="M${S} ${TOK}H${S + 62}"/>`;
  if (mode === 'prompt') for (let i = 0; i < 3; i++) s += `<rect class="hot-fill" x="${S + 12 + i * 16}" y="${TOK - 6}" width="12" height="12" rx="2"/>`;
  for (let i = 0; i < 5; i++) s += `<rect class="tok" x="${S + 64 + i * 16}" y="${TOK - 6}" width="12" height="12" rx="2"/>`;
  s += `<text class="note" x="${S + 148}" y="${TOK + 4}">输入</text>`;
  s += `<path class="spine" d="M${S} ${TOK}V${TOP + 6}"/>${tipUp(S, TOP)}<text class="note" x="${S + 10}" y="${TOP + 9}">输出</text>`;
  ROWS.forEach((row, r) => {
    const { add, base, lane } = LEVELS[r];
    let x = x0, wire = `M${S} ${base}`;
    const nodes = row.map(([kind, w, arg]) => {
      const node = { kind, w, arg, x, cx: x + w / 2 };
      x += w + gap;
      return node;
    });
    // 主路在每个节点处断开；Adapter 不在时，空位直接连过去
    nodes.forEach(n => { if (n.kind !== 'slot' || mode === 'adapter') wire += `H${n.x}M${n.x + n.w} ${base}`; });
    s += `<path class="wire" d="${wire}H${riser}V${add}H${S + 9}"/>${tipLeft(S + 9, add)}<circle class="dot" cx="${S}" cy="${base}" r="2.5"/>${plus(S, add, 7, false)}`;
    nodes.forEach(n => {
      if (n.kind === 'norm') s += `<text class="op quiet norm" x="${n.cx}" y="${base}">RMSNorm</text>`;
      if (n.kind === 'op') s += `<text class="op${r ? ' quiet' : ''}" x="${n.cx}" y="${base}">${n.arg}</text>`;
      if (n.kind === 'slot' && mode === 'adapter') s += bottleneck(n.cx, base, 24, 18, true);
      if (n.kind !== 'mats') return;
      s += block(n.x, base, n.w, n.arg);
      if (mode !== 'lora') return;
      const fork = n.x - gap / 2, merge = n.x + n.w + gap / 2;
      s += `<path class="hot-wire" d="M${fork} ${base}V${lane}H${merge}V${base + 4.5}"/><circle class="hot-fill" cx="${fork}" cy="${base}" r="2.2"/>`;
      s += bottleneck(n.cx, lane, Math.min(n.w + 4, 40), 12, false) + `<text class="ba" x="${n.cx}" y="${lane + 19}">BA</text>${plus(merge, base, 4.5, true)}`;
    });
    if (mode === 'ia3') {
      // 逐元素缩放 K、V 和 MLP 中间的激活
      const mx = nodes[r ? 2 : 1].x + nodes[r ? 2 : 1].w + gap / 2;
      s += `<circle class="hot" cx="${mx}" cy="${base}" r="6.5"/><text class="ba" x="${mx}" y="${base + 3.5}">l</text>`;
    }
    if (mode === 'prefix' && !r) {
      const cx = nodes[2].cx, left = cx - 31;
      s += `<path class="hot-wire" d="M${cx} ${base + 9}V${lane - 5}"/>`;
      for (let i = 0; i < 8; i++) s += `<rect class="${i < 3 ? 'hot-fill' : 'tok'}" x="${left + i * 8}" y="${lane - 3}" width="6" height="6" rx="1"/>`;
      s += `<text class="note" x="${left - 6}" y="${lane + 4}" text-anchor="end">K、V</text>`;
    }
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
}

function show(key) {
  mode = key;
  root.dataset.m = key;
  seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === key)));
  if (width) render();
}

Object.entries(METHODS).forEach(([key, label]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.m = key;
  button.textContent = label;
  button.addEventListener('click', () => show(key));
  seg.append(button);
});
show('lora');
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(svg);
</script>
```

Adapter 是串在主路上的瓶颈小网络，每个 token 都得多穿过它，中间还夹着非线性，没法并回权重。LoRA 也是瓶颈，但它是并联的、线性的：$W_0x+BAx=(W_0+BA)x$，所以能并回去。

Prompt Tuning 只在输入前拼几个可训练的向量；Prefix Tuning 在每层注意力的 K、V 前面都拼几列。参数极少，但占上下文，训练也不太稳，模型不够大时追不上全量微调。(IA)³ 只学几个向量，逐元素缩放 K、V 和 MLP 的中间激活，同样能并回权重。

LoRA 的常见变体：

| 变体 | 改了什么 |
| --- | --- |
| rsLoRA | 缩放从 $\alpha/r$ 换成 $\alpha/\sqrt r$ |
| LoRA+ | $B$ 的学习率设成 $A$ 的十几倍 |
| DoRA | 把权重拆成长度和方向，方向交给 LoRA |
| PiSSA | 用 $W_0$ 最大的几个奇异方向初始化 $A$、$B$ |
| AdaLoRA | 按重要性在不同矩阵之间分配秩 |
| LoftQ | 量化时初始化 $A$、$B$，补上量化误差 |
| VeRA | 各层共用冻住的随机矩阵，只训缩放向量 |
| GaLore | 全参数训练，把梯度投影到低秩空间来省优化器状态 |

## 喂什么数据

SFT 的数据是一问一答，训练时要用模型自己的聊天模板拼成文档，和推理时一模一样：

```text
<|im_start|>user
给我的橘猫起个名字，两个字。<|im_end|>
<|im_start|>assistant
橘座<|im_end|>
```

损失只算回答。提问部分的标签设成 `-100`，PyTorch 的交叉熵会跳过它：

```python
prompt = tok.apply_chat_template(messages[:-1], add_generation_prompt=True)
full = tok.apply_chat_template(messages)
labels = [-100] * len(prompt) + full[len(prompt):]
```

回答末尾的 `<|im_end|>` 一定要算进去，它是“说完了”的信号；漏掉它，模型学会了答，却学不会停。常见的坑是 pad token 和结束符设成同一个，mask pad 的时候把结束符也一起 mask 掉了。

几条短样本可以拼进同一条序列（packing），但要用块对角的注意力掩码，别让后一条看见前一条。

数据贵在质量。LIMA 只用 1,000 条精选数据微调 65B 的 LLaMA，效果就很能打。他们的“表面对齐假说”认为，知识和能力几乎都来自预训练，微调教的是用什么格式和口吻说出来。反过来，靠微调灌新知识效果往往不好：新事实学得慢，学进去以后模型还更爱胡编。新知识交给 RAG，微调管格式、风格和行为。

在窄数据上训久了，原来的能力会退化，这叫灾难性遗忘。混些通用数据、降低学习率、少训几轮，或者用 LoRA，都能缓解。轮数一般 1 到 3 轮，验证集损失开始回升就该停了。

## SFT 之后：教它分好坏

SFT 只能模仿示范。很多时候写不出标准答案，却能判断两个回答哪个更好：同一个提问 $x$，好回答 $y_w$，差回答 $y_l$。

**RLHF。** 先训奖励模型。为了不和秩 $r$ 撞名，奖励记作 $R(x,y)$。按 Bradley–Terry 模型：

$$
P(y_w\succ y_l\mid x)=\sigma\big(R(x,y_w)-R(x,y_l)\big).
$$

再用 PPO 让模型多拿奖励，同时不许离 SFT 模型 $\pi_{\text{ref}}$ 太远：

$$
\max_{\pi}\ \mathbb{E}_{x,\,y\sim\pi(\cdot\mid x)}\big[R(x,y)\big]-\beta\,\mathbb{D}_{\mathrm{KL}}\big(\pi(\cdot\mid x)\,\big\|\,\pi_{\text{ref}}(\cdot\mid x)\big).
$$

KL 项是缰绳，防止模型钻奖励模型的空子，也就是 reward hacking。这一套要同时摆四个模型：策略、参考、奖励、critic。

**DPO。** 上面这个目标的最优解可以直接写出来：

$$
\pi^*(y\mid x)=\frac{1}{Z(x)}\,\pi_{\text{ref}}(y\mid x)\exp\Big(\frac{R(x,y)}{\beta}\Big).
$$

<details>
<summary>为什么最优解长这样</summary>

第三行用到了 $\pi^*$ 的定义：

$$
\begin{aligned}
&\mathbb{E}_{y\sim\pi}\big[R(x,y)\big]-\beta\,\mathbb{D}_{\mathrm{KL}}(\pi\,\|\,\pi_{\text{ref}})\\
&=-\beta\,\mathbb{E}_{y\sim\pi}\Big[\log\frac{\pi(y\mid x)}{\pi_{\text{ref}}(y\mid x)}-\frac{R(x,y)}{\beta}\Big]\\
&=-\beta\,\mathbb{E}_{y\sim\pi}\Big[\log\frac{\pi(y\mid x)}{\pi^*(y\mid x)}\Big]+\beta\log Z(x)\\
&=-\beta\,\mathbb{D}_{\mathrm{KL}}(\pi\,\|\,\pi^*)+\beta\log Z(x).
\end{aligned}
$$

$Z(x)$ 跟 $\pi$ 无关，KL 散度最小是 0，当且仅当 $\pi=\pi^*$。

</details>

倒过来，用策略表示奖励：

$$
R(x,y)=\beta\log\frac{\pi^*(y\mid x)}{\pi_{\text{ref}}(y\mid x)}+\beta\log Z(x).
$$

代回 Bradley–Terry，$\beta\log Z(x)$ 一减就没了，奖励模型也跟着消失。把 $\pi^*$ 换成要训练的 $\pi_\theta$，就是 DPO 的损失：

$$
\mathcal{L}_{\text{DPO}}=-\log\sigma\Big(\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\text{ref}}(y_w\mid x)}-\beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\text{ref}}(y_l\mid x)}\Big).
$$

只要策略和参考两个模型，不用采样，也不用 critic。$\beta\log\frac{\pi_\theta}{\pi_{\text{ref}}}$ 就是论文标题里说的隐式奖励。求梯度时，每条样本带一个权重 $\sigma(\hat R_l-\hat R_w)$：好坏已经分对的几乎不学，分反的学得最用力。它的毛病是只管拉开差距，好回答的概率也可能跟着往下掉。

**GRPO。** DeepSeekMath 提出、DeepSeek-R1 拿来训推理的方法。还是强化学习，但扔掉了 critic：同一题采样 $G$ 个回答，用组内奖励的均值和标准差当基线：

$$
\hat A_i=\frac{R_i-\operatorname{mean}(R_1,\dots,R_G)}{\operatorname{std}(R_1,\dots,R_G)}.
$$

奖励可以直接是规则，比如答案对不对、代码能不能跑过测试。

| | 数据 | 训练时要的模型 | 在线采样 |
| --- | --- | --- | --- |
| SFT | 标准答案 | 策略 | 不要 |
| PPO | 偏好对，先训成奖励模型 | 策略、参考、奖励、critic | 要 |
| DPO | 偏好对 | 策略、参考 | 不要 |
| GRPO | 打分规则 | 策略、参考 | 要，每题一组 |

这些方法都能和 LoRA 一起用。DPO 的参考模型就是没挂 LoRA 的底座，关掉 LoRA 跑一遍就有，又省一份显存。

## 面试常问

<details>
<summary>全量微调一个 7B 模型，大概要多少显存？</summary>

混合精度加 Adam，每个参数 16 字节：BF16 的权重和梯度各 2，FP32 的主权重、$m$、$v$ 各 4。7B 约 112 GB，激活另算；推理只要 14 GB。

</details>

<details>
<summary>混合精度训练为什么要留一份 FP32 的主权重？</summary>

BF16 精度太低，$10^{-5}$ 量级的更新加上去会被舍入掉，只能在 FP32 上累加。

</details>

<details>
<summary>BF16 和 FP16 有什么区别？</summary>

BF16 是 8 位指数、7 位尾数，范围和 FP32 一样；FP16 是 5 位指数、10 位尾数，范围窄，小梯度会下溢，要配 loss scaling。

</details>

<details>
<summary>梯度检查点是什么？</summary>

前向只存每层的输入，反向时重算这一层。多花一次前向的算力，换掉大部分激活显存。

</details>

<details>
<summary>ZeRO-1、2、3 分别切了什么？</summary>

依次切优化器状态、梯度、参数，每张卡分别存 $4\Phi+12\Phi/N$、$2\Phi+14\Phi/N$、$16\Phi/N$ 字节。ZeRO-3 通信最多，FSDP 的 FULL_SHARD 对应它。

</details>

<details>
<summary>LoRA 的原理是什么？为什么有效？</summary>

冻住 $W_0$，把更新写成 $\Delta W=BA$，参数从 $dk$ 降到 $r(d+k)$。有效的前提是微调需要的更新本身是低秩的。

</details>

<details>
<summary>A 和 B 怎么初始化？为什么不能都是 0？</summary>

$A$ 随机、$B$ 为 0，起点就是原模型。都为 0 时，两者的梯度互相依赖，全是 0，训不动。

</details>

<details>
<summary>alpha 和 r 是什么关系？</summary>

LoRA 的输出乘 $\alpha/r$，换 $r$ 时不用重调学习率；用 Adam 时，调 $\alpha$ 约等于调学习率。常设 $\alpha=r$ 或 $2r$；rsLoRA 改用 $\alpha/\sqrt r$。

</details>

<details>
<summary>LoRA 推理时有额外延迟吗？</summary>

合并后没有。不合并时每层多两次小矩阵乘法，换来随时插拔。

</details>

<details>
<summary>多个任务的 LoRA 怎么部署？为什么线上一般不合并？</summary>

底座常驻显存，每个任务只存自己的 $A$、$B$。同一批请求挂着不同的 LoRA，合并后的权重只装得下一个任务，所以整批先乘 $W_0$，再分组乘各自的 $A$、$B$。

</details>

<details>
<summary>一组 LoRA 能换个底座用吗？</summary>

不能。它学的是相对某一个 $W_0$ 的差，换了底座就对不上了。

</details>

<details>
<summary>LoRA 一般加在哪些层？</summary>

现在一般加全部线性层，MLP 最重要。原论文只加了 q、v。

</details>

<details>
<summary>秩 r 怎么选？</summary>

常见 8 到 64。它对显存影响很小，管的是容量；挂在哪些层比 $r$ 更重要。

</details>

<details>
<summary>LoRA 省了什么，没省什么？</summary>

省了冻结参数的梯度、优化器状态和 FP32 主权重。激活一点没省，算力只省了大约三分之一。

</details>

<details>
<summary>LoRA 和全量微调效果差多少？</summary>

中小规模的 SFT 基本打平。数据量很大、要学很多新东西时，LoRA 会落后，但原来的能力忘得少。

</details>

<details>
<summary>LoRA 的学习率该怎么设？</summary>

比全量微调大一个数量级：全量 $10^{-5}$ 量级，LoRA $10^{-4}$ 量级。

</details>

<details>
<summary>QLoRA 做了哪几件事？</summary>

NF4 存底座、双重量化、分页优化器。计算时把权重解压回 BF16，LoRA 照常训练。

</details>

<details>
<summary>NF4 为什么比 INT4 好？</summary>

权重近似正态分布。NF4 按分位数放格子，每格分到的数差不多，4 bit 的信息量用得足，误差也小；它还保留了一个精确的 0。

</details>

<details>
<summary>为什么要分块量化？</summary>

缩放系数由最大值决定，一个离群值会把整组数挤进中间几格。分块以后，离群值只影响自己那一块；QLoRA 每 64 个一块。

</details>

<details>
<summary>双重量化省了多少？</summary>

缩放系数从每个参数 0.5 bit 降到约 0.127 bit。

</details>

<details>
<summary>QLoRA 比 LoRA 训练快吗？</summary>

更慢，每层计算前都要多一次解压。它省的是显存。

</details>

<details>
<summary>QLoRA 训完的 LoRA 怎么合并？</summary>

把底座解压回 BF16 再合并。LoRA 补的是量化底座的差，合并到原始权重、或者合并后再量化，都会有偏差。

</details>

<details>
<summary>Adapter、Prefix Tuning、Prompt Tuning 和 LoRA 有什么区别？</summary>

Adapter 串联在主路上，有延迟，不能合并；Prefix、Prompt 改的是输入，占上下文；LoRA 并联、线性，可以合并。

</details>

<details>
<summary>SFT 的损失怎么算？</summary>

提问部分的标签设为 `-100`，不算损失；回答末尾的结束符必须算，不然模型学不会停。

</details>

<details>
<summary>微调能让模型学会新知识吗？</summary>

很难。新知识学得慢，学进去以后还更容易胡编。新知识交给 RAG。

</details>

<details>
<summary>SFT 数据要多少？</summary>

质量比数量重要。LIMA 用一千条精选数据就有不错的效果。

</details>

<details>
<summary>灾难性遗忘怎么缓解？</summary>

混入通用数据、降低学习率、少训几轮，或者用 LoRA。

</details>

<details>
<summary>有了 SFT，为什么还要 RLHF？</summary>

SFT 只能模仿示范。偏好数据更容易拿到，还能告诉模型什么不该说。

</details>

<details>
<summary>PPO 训练要几个模型？KL 项有什么用？</summary>

策略、参考、奖励、critic 四个，其中策略和 critic 要训练。KL 项防止策略离参考模型太远，去钻奖励模型的空子。

</details>

<details>
<summary>DPO 的原理是什么？比 PPO 好在哪？</summary>

KL 约束下的最优策略有闭式解。用它把奖励写成策略和参考模型的对数概率比，代入 Bradley–Terry 后归一化常数抵消，得到只依赖偏好对的损失。只要两个模型，不用采样，也不用 critic。

</details>

<details>
<summary>DPO 里的 beta 起什么作用？</summary>

它是 KL 约束的强度。大了保守，离参考模型近；小了走得远，也更容易过拟合偏好数据。常用 0.1 左右。

</details>

<details>
<summary>GRPO 和 PPO 有什么不同？</summary>

GRPO 不要 critic，用同一题一组回答的奖励均值和标准差当基线，适合答案能自动判对错的任务。

</details>

## 参考资料

- Hu et al. [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685), 2021。
- Dettmers et al. [QLoRA: Efficient Finetuning of Quantized LLMs](https://arxiv.org/abs/2305.14314), 2023。
- Aghajanyan et al. [Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning](https://arxiv.org/abs/2012.13255), 2020。
- Rajbhandari et al. [ZeRO: Memory Optimizations Toward Training Trillion Parameter Models](https://arxiv.org/abs/1910.02054), 2019。
- Micikevicius et al. [Mixed Precision Training](https://arxiv.org/abs/1710.03740), 2017。
- Chen et al. [Training Deep Nets with Sublinear Memory Cost](https://arxiv.org/abs/1604.06174), 2016。
- Biderman et al. [LoRA Learns Less and Forgets Less](https://arxiv.org/abs/2405.09673), 2024。
- Thinking Machines Lab. [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/), 2025。
- Hayou et al. [The Impact of Initialization on LoRA Finetuning Dynamics](https://arxiv.org/abs/2406.08447), 2024。
- Chen et al. [Punica](https://arxiv.org/abs/2310.18547), 2023；Sheng et al. [S-LoRA](https://arxiv.org/abs/2311.03285), 2023。
- Houlsby et al. [Parameter-Efficient Transfer Learning for NLP](https://arxiv.org/abs/1902.00751), 2019；Li & Liang. [Prefix-Tuning](https://arxiv.org/abs/2101.00190), 2021；Lester et al. [Prompt Tuning](https://arxiv.org/abs/2104.08691), 2021；Liu et al. [(IA)³](https://arxiv.org/abs/2205.05638), 2022。
- Kalajdzievski. [rsLoRA](https://arxiv.org/abs/2312.03732), 2023；Hayou et al. [LoRA+](https://arxiv.org/abs/2402.12354), 2024；Liu et al. [DoRA](https://arxiv.org/abs/2402.09353), 2024；Meng et al. [PiSSA](https://arxiv.org/abs/2404.02948), 2024；Zhang et al. [AdaLoRA](https://arxiv.org/abs/2303.10512), 2023；Li et al. [LoftQ](https://arxiv.org/abs/2310.08659), 2023；Kopiczko et al. [VeRA](https://arxiv.org/abs/2310.11454), 2023；Zhao et al. [GaLore](https://arxiv.org/abs/2403.03507), 2024。
- Zhou et al. [LIMA: Less Is More for Alignment](https://arxiv.org/abs/2305.11206), 2023；Gekhman et al. [Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations?](https://arxiv.org/abs/2405.05904), 2024。
- Ouyang et al. [InstructGPT](https://arxiv.org/abs/2203.02155), 2022；Rafailov et al. [Direct Preference Optimization](https://arxiv.org/abs/2305.18290), 2023；Shao et al. [DeepSeekMath](https://arxiv.org/abs/2402.03300), 2024；DeepSeek-AI. [DeepSeek-R1](https://arxiv.org/abs/2501.12948), 2025。
