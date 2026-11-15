---
title: "一张显卡，怎么微调大模型"
description: "全量微调一个 8B 模型要 130 GB 以上的显存。LoRA 和 QLoRA 是怎么把它压到一张卡上的。"
pubDate: 2026-10-23
updatedDate: 2026-11-11
tags: ["大语言模型", "机器学习"]
---

一个 8B 的模型有 80 亿个参数，按 BF16（16 位浮点，一个数 2 字节）存，权重 16 GB，一张 24 GB 的显卡跑推理绰绰有余。想在这张卡上接着训它，也就是微调，要 130 GB 往上。

多出来的一百多 GB 是什么？LoRA、QLoRA 这些名字，都是在压这笔账：

```render html title="8B 模型训练时的显存，激活另算"
<style>
  .mem { --blue: #356f9b; --blue-soft: #c3d5e3; --card: 18.75%; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .mem { --blue: #95bfdc; --blue-soft: #3b4f5d; }
  .row { display: grid; grid-template-columns: 4.8em minmax(0, 1fr) 4.6em; gap: 0 12px; align-items: center; padding: 6px 0; }
  .name { color: var(--text); font-weight: 600; white-space: nowrap; }
  .bar { position: relative; z-index: 0; display: flex; align-items: center; height: 28px; }
  .bar::after { content: ""; position: absolute; z-index: -1; top: -6px; bottom: -6px; left: var(--card); border-left: 1.5px dashed var(--text); }
  .bar i { display: grid; place-items: center; align-self: stretch; overflow: hidden; color: var(--text); font: 500 11.5px var(--font-sans); white-space: nowrap; box-shadow: inset -2px 0 var(--bg); }
  .bar .w { background: var(--rule-strong); }
  .bar .g { background: var(--blue); color: var(--bg); }
  .bar .m { background: var(--blue-soft); }
  .bar .o, .bar .l { background: var(--accent); color: var(--bg); }
  .bar .l { min-width: 3px; }
  .bar span { position: absolute; left: calc(var(--card) + 10px); color: var(--accent-ink); font-size: 12px; white-space: nowrap; }
  .gb { color: var(--text); font: 600 14px var(--font-mono); text-align: right; white-space: nowrap; }
  .foot { padding: 0; }
  .scale { position: relative; height: 22px; }
  .scale b { position: absolute; top: 4px; left: var(--card); transform: translateX(-50%); color: var(--text); font: 600 12px var(--font-mono); white-space: nowrap; }
  @media (max-width: 480px) {
    .row { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; }
    .bar, .scale { grid-column: 1 / -1; grid-row: 2; }
    .foot > span { display: none; }
    .scale { grid-row: 1; }
  }
</style>
<section class="mem" aria-label="8B 模型训练时的显存：全量微调 128 GB，LoRA 约 17 GB，QLoRA 约 6 GB，只有后两个低于一张 24 GB 的卡">
  <div class="row"><span class="name">全量微调</span><div class="bar"><i class="w" style="width: 12.5%">权重</i><i class="g" style="width: 12.5%">梯度</i><i class="m" style="width: 25%">主权重</i><i class="o" style="width: 50%">Adam</i></div><span class="gb">128 GB</span></div>
  <div class="row"><span class="name">LoRA</span><div class="bar"><i class="w" style="width: 12.5%"></i><i class="l" style="width: .5%"></i><span>权重 + LoRA</span></div><span class="gb">≈17 GB</span></div>
  <div class="row"><span class="name">QLoRA</span><div class="bar"><i class="w" style="width: 4.5%"></i><i class="l" style="width: .5%"></i><span>4 bit 权重 + LoRA</span></div><span class="gb">≈6 GB</span></div>
  <div class="row foot"><span></span><div class="scale"><b>24 GB 的卡</b></div><span></span></div>
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

$\hat m$、$\hat v$ 是偏差修正后的 $m$、$v$，$\eta$ 是学习率。（AdamW 每步还会把权重往 0 拉一点，叫权重衰减，不多占地方，这里略去。）除以 $\sqrt{\hat v}$ 等于给每个参数单独定步长，结果是每一步都挪 $\eta$ 左右，跟梯度本身多大关系不大。讲 LoRA 的 $\alpha$ 时会用到这一点。

现在训练基本都开混合精度：前向和反向用 16 位算，又快又省；更新在 32 位上做。这样每个参数要存四样东西：

| 存的东西 | 精度 | 字节 |
| --- | --- | --- |
| 权重，前向和反向用 | BF16 | 2 |
| 梯度 | BF16 | 2 |
| 主权重，更新用 | FP32 | 4 |
| Adam 的 $m$、$v$ | FP32 | 8 |

一共 16 字节，8B 的模型就是 128 GB，开头那张图第一行的四段就是这四行。推理只要第一行。

（这是 ZeRO 论文里的分法。PyTorch 的 autocast 记法不一样：权重和梯度都是 FP32，16 位的那份用的时候现转，合计也是 16 字节。）

### 权重为什么存两份

表里最费解的是第三行：权重已经有一份 BF16 的了，为什么还要一份 FP32 的。

BF16 的 16 位里，1 位符号，8 位指数，只剩 7 位尾数。在 0.02 附近，相邻两个能表示的数隔着 $2^{-13}\approx0.00012$。全量微调的学习率在 $10^{-5}$ 上下，Adam 一步也就挪这么多，不到间隔的十分之一：

```render html title="0.02 附近 BF16 能表示的数，相邻两个隔 0.00012；每步更新 +0.00001"
<style>
  .fp { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .fp svg { display: block; width: 100%; height: auto; overflow: visible; }
  .axis { stroke: var(--rule-strong); }
  .tick { stroke: var(--text); stroke-width: 1.4; }
  .num { fill: var(--muted); font: 11.5px var(--font-mono); text-anchor: middle; }
  .name { fill: var(--text); font-size: 13px; font-weight: 600; }
  .say { fill: var(--accent-ink); font-size: 12px; }
  .trail { stroke: var(--accent); stroke-width: 2.4; stroke-linecap: round; }
  .master { fill: var(--accent); }
  .copy { fill: var(--bg); stroke: var(--text); stroke-width: 2; }
  .ctl { display: flex; align-items: center; gap: 12px; margin-top: 4px; color: var(--muted); }
  .ctl output { flex: none; min-width: 4.4em; color: var(--text); font: 13px var(--font-mono); }
  .ctl input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .key { flex: none; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
</style>
<section class="fp" aria-label="同样走 28 步、每步加 0.00001：只存 BF16 的权重一步都没动；在 FP32 主权重上累加，BF16 副本跳了两格">
  <svg role="img"></svg>
  <div class="ctl"><output></output><input type="range" min="0" max="28" value="28" aria-label="走了多少步"/><button type="button" class="key">从头走</button></div>
</section>
<script>
// BF16 在 [1/64, 1/32) 里的间隔是 2^-13，0.02 落在第 164 格上
const ULP = 2 ** -13, BASE = 164, STEP = 1e-5 / ULP, MAX = 28;
const root = document.querySelector('.fp'), svg = root.querySelector('svg');
const slider = root.querySelector('input'), out = root.querySelector('output'), key = root.querySelector('.key');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let n = MAX, width = 0, raf = 0;

function render() {
  if (!width) return;
  const pad = 28, y1 = 44, y2 = 112;
  const x = u => pad + (u + .15) / 2.7 * (width - 2 * pad);
  const done = Math.floor(n), u = n * STEP, copy = Math.round(u);
  let s = '';
  for (let k = 0; k <= 2; k++) {
    const tx = x(k).toFixed(1);
    s += `<line class="tick" x1="${tx}" x2="${tx}" y1="${y1 - 6}" y2="${y1 + 6}"/><line class="tick" x1="${tx}" x2="${tx}" y1="${y2 - 6}" y2="${y2 + 6}"/>`;
    s += `<text class="num" x="${tx}" y="${y2 + 24}">${((BASE + k) * ULP).toFixed(5)}</text>`;
  }
  s += `<line class="axis" x1="${pad}" x2="${width - pad}" y1="${y1}" y2="${y1}"/><line class="axis" x1="${pad}" x2="${width - pad}" y1="${y2}" y2="${y2}"/>`;
  // 上：每一步算出来的和（实心点）离开格子一点点，舍入时又回到原来那一格
  const poke = n > 0 ? STEP * (n - done || 1) : 0;
  s += `<text class="name" x="0" y="14">只有 BF16</text>`;
  s += `<circle class="copy" cx="${x(0).toFixed(1)}" cy="${y1}" r="5"/><circle class="master" cx="${x(poke).toFixed(1)}" cy="${y1}" r="2.5"/>`;
  if (done) s += `<text class="say" x="${(x(0) + 14).toFixed(1)}" y="${y1 - 12}">${done} 步，全被舍掉</text>`;
  // 下：在 FP32 上累加，过了两格的中点，BF16 的副本才跳一格
  s += `<text class="name" x="0" y="${y2 - 30}">FP32 主权重 <tspan class="master">●</tspan>　BF16 副本 ○</text>`;
  s += `<line class="trail" x1="${x(0).toFixed(1)}" x2="${x(u).toFixed(1)}" y1="${y2}" y2="${y2}"/><circle class="copy" cx="${x(copy).toFixed(1)}" cy="${y2}" r="5"/><circle class="master" cx="${x(u).toFixed(1)}" cy="${y2}" r="3.5"/>`;
  svg.setAttribute('viewBox', `0 0 ${width} 144`);
  svg.innerHTML = s;
  svg.setAttribute('aria-label', `第 ${done} 步：只有 BF16 时权重还是 ${(BASE * ULP).toFixed(5)}；主权重走到 ${(BASE * ULP + done * 1e-5).toFixed(5)}，BF16 副本是 ${((BASE + copy) * ULP).toFixed(5)}`);
  out.textContent = `第 ${done} 步`;
}

function halt() { cancelAnimationFrame(raf); raf = 0; }
function play() {
  halt();
  if (reduce) { n = MAX; slider.value = MAX; render(); return; }
  const t0 = performance.now();
  const frame = now => {
    n = Math.min(MAX, (now - t0) / 160);
    slider.value = Math.floor(n);
    render();
    if (n < MAX) raf = requestAnimationFrame(frame);
  };
  n = 0; slider.value = 0; render();
  raf = requestAnimationFrame(frame);
}
key.addEventListener('click', play);
slider.addEventListener('input', () => { halt(); n = Number(slider.value); render(); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

上面那行，每一步都迈出去，一舍入又回到原来那一格，训多少步都白训。下面那行先在 FP32 上累加（FP32 在这附近的间隔是 $2^{-29}$，不到十亿分之二），攒过两格的中点，BF16 的那一份才跳一格。所以更新必须在 FP32 的主权重上做，每步算完再转一份 BF16 去跑前向。

同样是 16 位，还有一种 FP16，现在训大模型用得少了：

| 格式 | 指数位 | 尾数位 | 最大值 |
| --- | --- | --- | --- |
| FP32 | 8 | 23 | $3.4\times10^{38}$ |
| FP16 | 5 | 10 | $65504$ |
| BF16 | 8 | 7 | $3.4\times10^{38}$ |

BF16 拿精度换范围，指数位和 FP32 一样多。FP16 范围太窄，小梯度会下溢成 0，得配 loss scaling：先把损失乘一个大数再反向，更新前再除回来。BF16 不用操这个心。

### 激活：按 token 算的另一笔

16 字节是按参数算的。还有一块按 token 算：激活，也就是前向时每一层算出来的中间结果。

反向传播要用到它们。拿一个线性层 $h=Wx$ 来说，反向传到这一层的是 $\delta=\partial\mathcal{L}/\partial h$，权重的梯度是

$$
\frac{\partial\mathcal{L}}{\partial W}=\delta\,x^\top,
$$

得拿这一层前向时的输入 $x$ 来乘。反向是从最后一层往回走的，所以前向一路算下去，每一层的输入和中间结果都得留着，等反向走到那一层、用完了才能放。

这块有多大，看的是一个 batch 里一共有多少 token，跟用哪种微调方法无关，后面的 LoRA、QLoRA 都省不了它。拿 Llama-3.1-8B 粗算：隐藏维度 4096，MLP 中间是 14336 维，一层里要留的张量加起来，每个 token 十万个数上下，按 BF16 是 200 KB；32 层就是 6 MB 上下。序列长 1024、batch 取 4，激活就有二十几 GB，比权重还大。

标准的省法是梯度检查点（gradient checkpointing）：前向时每层只留输入，别的中间结果算完就扔；反向走到哪一层，先拿留下的输入把这一层重算一遍，用完再扔。

```render html title="示意：12 层；单位是一层的全部激活，一层的输入按 1/24 层算"
<style>
  .ck { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; color: var(--muted); }
  .ctl output { flex: none; min-width: 8em; color: var(--text); font-weight: 600; }
  .ctl input { flex: 1; min-width: 120px; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .key { flex: none; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .lane { margin-top: 18px; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 14px; color: var(--muted); }
  .head b { color: var(--text); font-size: 14px; font-weight: 650; }
  .head output { color: var(--text); font: 600 14px var(--font-mono); }
  .cells { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 3px; }
  .marks { height: 18px; margin-top: 4px; color: var(--accent-ink); font: 600 13px var(--font-mono); text-align: center; }
  .strip { border-bottom: 1px solid var(--rule-strong); }
  .slot { display: flex; align-items: flex-end; height: 72px; border: 1px dashed var(--rule-strong); border-bottom: 0; }
  .fill { width: 100%; height: 0; background: var(--faint); transition: height .25s ease; }
  .slot.now .fill { background: var(--accent); }
  .nums { color: var(--faint); font: 11px var(--font-mono); text-align: center; }
  @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
<section class="ck" aria-label="12 层的模型训练一步：不开检查点，前向走完时 12 层的激活全占着显存；开了以后最多同时展开 1 层，其余每层只留输入，代价是每层的前向算两遍">
  <div class="ctl"><output></output><input type="range" min="0" max="24" value="13" aria-label="这一步训练走到哪了"/><button type="button" class="key">播放</button></div>
  <div class="lane"><div class="head"><b>不开检查点</b><span>占着 <output></output>，峰值 <output></output>，整步前向 <output></output> 层</span></div></div>
  <div class="lane"><div class="head"><b>梯度检查点</b><span>占着 <output></output>，峰值 <output></output>，整步前向 <output></output> 层</span></div></div>
</section>
<script>
const L = 12, THIN = 1 / 24, TALL = 70;
const root = document.querySelector('.ck');
const slider = root.querySelector('input'), key = root.querySelector('.key'), stepName = root.querySelector('.ctl output');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (className, text = '') => Object.assign(document.createElement('div'), { className, textContent: text });
let t = 13, timer = 0;

// 正在算的那一层，从 1 数起；前向往上走，反向往回走
const current = t => (t <= L ? t : 2 * L - t + 1);
// 每层现在占多少：0，只留输入，或者全部中间结果
function held(ckpt, t) {
  const cur = current(t);
  return Array.from({ length: L }, (_, i) => {
    if (i + 1 > cur) return 0;
    if (!ckpt) return 1;
    return t > L && i + 1 === cur ? 1 : THIN;
  });
}
const total = (ckpt, t) => held(ckpt, t).reduce((a, b) => a + b, 0);

const lanes = [...root.querySelectorAll('.lane')].map((lane, ckpt) => {
  const marks = el('cells marks'), strip = el('cells strip'), nums = el('cells nums');
  const slots = [];
  for (let i = 0; i < L; i++) {
    marks.append(el(''));
    const slot = el('slot');
    slot.append(el('fill'));
    strip.append(slot);
    slots.push(slot);
    nums.append(el('', String(i + 1)));
  }
  lane.append(marks, strip, nums);
  let peak = 0;
  for (let s = 0; s <= 2 * L; s++) peak = Math.max(peak, total(ckpt === 1, s));
  return { ckpt: ckpt === 1, marks: [...marks.children], slots, outs: lane.querySelectorAll('output'), peak };
});

function show() {
  const cur = current(t), back = t > L;
  slider.value = t;
  stepName.textContent = t === 0 ? '还没开始' : `${back ? '反向' : '前向'}：第 ${cur} 层`;
  for (const lane of lanes) {
    const h = held(lane.ckpt, t);
    lane.slots.forEach((slot, i) => {
      const fill = slot.firstChild;
      fill.style.height = `${h[i] > 0 ? Math.max(3, Math.round(h[i] * TALL)) : 0}px`;
      slot.classList.toggle('now', t > 0 && i + 1 === cur);
      lane.marks[i].textContent = t > 0 && i + 1 === cur ? (back ? '←' : '→') : '';
    });
    lane.outs[0].textContent = total(lane.ckpt, t).toFixed(1);
    lane.outs[1].textContent = lane.peak.toFixed(1);
    lane.outs[2].textContent = lane.ckpt ? 2 * L : L;
  }
}

function halt() { clearInterval(timer); timer = 0; }
function play() {
  halt();
  // 关了动画就一步一步点
  if (reduce) { t = t >= 2 * L ? 0 : t + 1; show(); return; }
  t = 0; show();
  timer = setInterval(() => { t += 1; show(); if (t >= 2 * L) halt(); }, 320);
}
if (reduce) key.textContent = '下一步';
key.addEventListener('click', play);
slider.addEventListener('input', () => { halt(); t = Number(slider.value); show(); });
show();
</script>
```

不开检查点，前向走完的那一刻，12 层的激活全压在显存里。开了以后，任何时候最多只有一层是展开的，其余每层只压着一份输入：峰值从 12 降到 1.5。代价是最右边那个数：整步下来前向从 12 层变成 24 层，每层都算了两遍，训练慢两三成。

真模型有 32 层，按同样的算法是 32 降到 2.3，前面粗算的二十几 GB 剩下 2 GB 左右。

### 多卡：把账摊开

128 GB 一张卡放不下，老办法是加卡。普通的数据并行帮不上忙：每张卡都存着完整的 16 字节，卡再多，每张也不少存。DeepSpeed 的 ZeRO 把这些状态切开，每张卡只存其中一片。设参数量为 $\Phi$、卡数为 $N$：

| | 每张卡存的字节 | 8B 模型、8 张卡 |
| --- | --- | --- |
| 数据并行 | $16\Phi$ | 128 GB |
| ZeRO-1：切优化器状态 | $4\Phi+12\Phi/N$ | 44 GB |
| ZeRO-2：再切梯度 | $2\Phi+14\Phi/N$ | 30 GB |
| ZeRO-3：连权重也切 | $16\Phi/N$ | 16 GB |

这里的优化器状态是 FP32 的主权重加上 $m$、$v$，一共 12 字节。ZeRO-3 的代价是通信：每层算之前，都得先从各张卡把这一层的权重收齐。PyTorch 的 FSDP 是同一个思路。

账摊开了，总数一分没少：128 GB 还是 128 GB，只是分到了 8 张卡上。LoRA 换了个思路：大部分参数，干脆不训。

## LoRA：只训一个差值

微调前后，权重从 $W_0$ 变成 $W_0+\Delta W$，全量微调学的就是 $\Delta W$。拿注意力里的一个矩阵来说，它是 $4096\times4096$ 的，1,677 万个数，每个都能自由变。

可微调的数据常常只有几千条，用不上这么多自由度。2020 年有个实验：把 RoBERTa 的全部更新限制在一个随机的 200 维子空间里，在 MRPC 上就能拿到全量微调 90% 的效果。预训练过的模型换任务时，要动的方向其实很少。

“方向少”落到矩阵上，叫低秩。最极端的情况，整个矩阵是一列乘一行：

$$
\begin{bmatrix}1\\2\\-1\end{bmatrix}\begin{bmatrix}3&0&1\end{bmatrix}
=\begin{bmatrix}3&0&1\\6&0&2\\-3&0&-1\end{bmatrix}
$$

右边 9 个数，其实只有左边那 6 个：每一行都是 $(3,0,1)$ 乘上一个倍数。一个矩阵最少要几块这样的“一列乘一行”才拼得出来，这个块数就是它的**秩**。$r$ 块加在一起，正好能写成一个 $r$ 列的矩阵乘一个 $r$ 行的矩阵。

LoRA 假设每个权重矩阵的 $\Delta W$ 都差不多是低秩的，直接把它写成两个瘦矩阵相乘：

$$
\Delta W=BA,\qquad B\in\mathbb{R}^{d\times r},\quad A\in\mathbb{R}^{r\times k},\quad r\ll\min(d,k).
$$

$W_0$ 冻住，只训 $A$、$B$，要训的数从 $dk$ 个降到 $r(d+k)$ 个。$d=k=4096$、$r=16$ 时是 13 万个，不到原来的 1%。

下面是个 $24\times24$ 的小例子。右边的 $\Delta W$ 是构造出来的：三块大的，再加一层很弱的噪声。左边用 $r$ 块去拼它：

```render html
<style>
  .lr { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .lr { --blue: #95bfdc; }
  .lr-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 16px; }
  .seg { display: flex; gap: 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
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
  .ctl .katex { color: var(--text); font-size: 15px; }
  .ctl output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .ctl input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
</style>
<section class="lr" aria-label="用两条瘦矩阵的乘积去拼一个 24×24 的矩阵：目标低秩时 r = 3 误差就只剩 7%，目标满秩时 r = 12 还剩一半多">
  <div class="lr-top">
    <div class="seg" role="group" aria-label="目标矩阵">
      <button type="button" data-kind="low" aria-pressed="true">低秩</button>
      <button type="button" data-kind="full" aria-pressed="false">满秩</button>
    </div>
    <button type="button" class="key play">一块块叠上去</button>
  </div>
  <svg role="img" shape-rendering="crispEdges"></svg>
  <p class="stats"></p>
  <label class="ctl"><span>秩 $r$</span><output></output><input type="range" min="1" max="12" value="3" aria-label="秩 r"/></label>
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
  root.querySelector('.stats').innerHTML = `<span>两条瘦矩阵<b>${r * 2 * N}</b></span><span>整块<b>${N * N}</b></span><span>误差<b>${err.toFixed(1)}%</b></span>`;
  root.querySelector('.ctl output').textContent = r;
}

root.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  kind = button.dataset.kind;
  root.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));
// 从 r = 1 起一块块加上去；关了动画就点一下加一块
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const playKey = root.querySelector('.play');
let timer = 0;
function halt() { clearInterval(timer); timer = 0; }
function play() {
  halt();
  if (reduce) { slider.value = Number(slider.value) % RMAX + 1; render(); return; }
  slider.value = 1;
  render();
  timer = setInterval(() => {
    slider.value = Number(slider.value) + 1;
    render();
    if (Number(slider.value) >= RMAX) halt();
  }, 520);
}
if (reduce) playKey.textContent = '加一块';
playKey.addEventListener('click', play);
slider.addEventListener('input', () => { halt(); render(); });
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

右上角那排柱子是奇异值。SVD 能把任何矩阵拆成一块块“一列乘一行”，每块有个大小，叫奇异值，从大到小排好。图里的 $BA$ 取的是前 $r$ 块：Eckart–Young 定理说，秩不超过 $r$ 的矩阵里，这样取离目标最近。所以图里是秩 $r$ 能做到的最好情况。

目标低秩时，$r=3$ 把三块大的都拿到了，误差掉到 7%，再加也没多少可拿。这时两条瘦矩阵一共 144 个数，整块是 576 个。

切到满秩就没有捷径了：奇异值一个只比一个小一点，$r$ 拖到 12，两条瘦矩阵已经和整块一样大，误差还剩一半多。LoRA 好使，前提是任务要的改动本来就低秩。换说话格式、学回答风格，多半满足；灌大量新知识，就未必。2024 年的 LoRA Learns Less and Forgets Less 测过：在代码和数学上，全量微调学到的 $\Delta W$，秩比常用的 LoRA 配置高 10 到 100 倍。结果就是标题那句话：新东西 LoRA 学得少一些，原来的能力也忘得少一些。数据量不大的时候，两者基本打平。

## 一层 LoRA 怎么算

挂了 LoRA 的线性层，输出是两路相加：

$$
h=W_0x+\frac{\alpha}{r}BAx
$$

旁路先算 $Ax$，得到一个 $r$ 维的小向量，再乘 $B$ 放回 $d$ 维，全程不出现 $d\times k$ 的大矩阵。$\alpha$ 是个定死的超参数，下面说。

**初始化。** $A$ 随机，$B$ 全零。一开始 $BA=0$，挂上去的模型和原模型一模一样，训练从原模型出发。为什么不干脆两个都设成 0？记 $\delta=\partial\mathcal{L}/\partial h$：

$$
\frac{\partial\mathcal{L}}{\partial B}=\frac{\alpha}{r}\,\delta\,(Ax)^\top,\qquad
\frac{\partial\mathcal{L}}{\partial A}=\frac{\alpha}{r}\,B^\top\delta\,x^\top.
$$

$B$ 的梯度里有 $A$，$A$ 的梯度里有 $B$，两个都是 0 就永远动不了。

拿个小例子真训一遍。目标是一个秩 2 的 $12\times12$ 矩阵，$r=2$，损失取 $BA$ 和目标之差的平方和，用最普通的梯度下降走 60 步：

```render html title="玩具例子，在页面里现算；梯度那两条画的是整个矩阵梯度的大小"
<style>
  .ini { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .ini { --blue: #95bfdc; }
  .top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 16px; }
  .seg { display: flex; flex-wrap: wrap; gap: 0 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .key { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .ini svg { display: block; width: 100%; height: auto; margin-top: 8px; overflow: visible; }
  .pos { fill: var(--accent); }
  .neg { fill: var(--blue); }
  .frame { fill: none; stroke: var(--rule-strong); }
  .sym { fill: var(--text); font: italic 17px KaTeX_Math, var(--font-serif); dominant-baseline: central; }
  .zh { fill: var(--muted); font-size: 12.5px; dominant-baseline: central; text-anchor: middle; }
  .op { fill: var(--muted); font: 20px KaTeX_Main, var(--font-serif); text-anchor: middle; dominant-baseline: central; }
  .grads { display: grid; grid-template-columns: auto minmax(0, 1fr) 3em; gap: 4px 10px; align-items: center; margin-top: 8px; color: var(--muted); }
  .grads .katex { color: var(--text); font-size: 15px; }
  .meter { height: 10px; background: var(--rule); }
  .meter b { display: block; width: 0; height: 100%; background: var(--accent); }
  .grads output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .ctl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; margin-top: 8px; color: var(--muted); }
  .ctl output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .ctl input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
</style>
<section class="ini" aria-label="一个玩具 LoRA 的训练：A 随机、B 为零时，第 0 步只有 B 有梯度，B 离开零以后 A 才有梯度，BA 一步步贴上目标；A、B 都为零时两个梯度一直是零，训多少步都不动">
  <div class="top">
    <div class="seg" role="group" aria-label="初始化">
      <button type="button" data-init="std" aria-pressed="true">A 随机，B 为 0</button>
      <button type="button" data-init="zero" aria-pressed="false">都是 0</button>
    </div>
    <button type="button" class="key play">训练</button>
  </div>
  <svg role="img" shape-rendering="crispEdges"></svg>
  <div class="grads">
    <span>$B$ 的梯度</span><span class="meter"><b></b></span><output></output>
    <span>$A$ 的梯度</span><span class="meter"><b></b></span><output></output>
  </div>
  <label class="ctl"><span>训练步数</span><output></output><input type="range" min="0" max="60" value="0" aria-label="训练步数"/></label>
</section>
<script>
const N = 12, R = 2, STEPS = 60, LR = .06;
function random(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// 余弦波两两正交、长度为 1，拿来当现成的方向
const wave = f => Array.from({ length: N }, (_, i) => Math.sqrt(2 / N) * Math.cos(Math.PI * f * (i + .5) / N));
const U = [wave(2), wave(1)], V = [wave(1), wave(3)], S = [3, 1.8];
const T = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => S[0] * U[0][i] * V[0][j] + S[1] * U[1][i] * V[1][j]));
const norm = m => Math.sqrt(m.reduce((s, row) => s + row.reduce((t, v) => t + v * v, 0), 0));

// A 的初值：目标用得上的两个方向上各有一点分量，其余方向上是随机数
function randomA() {
  const rand = random(3), c = .6, phi = .7;
  const mix = [[Math.cos(phi), Math.sin(phi)], [-Math.sin(phi), Math.cos(phi)]];
  return mix.map(([p, q]) => {
    const row = V[0].map((x, j) => c * (p * x + q * V[1][j]));
    for (let f = 4; f < N; f++) {
      const k = (rand() - .5) * .5, w = wave(f);
      for (let j = 0; j < N; j++) row[j] += k * w[j];
    }
    return row;
  });
}

// 损失是 ‖BA − T‖² / 2，梯度分别是 (BA − T)Aᵀ 和 Bᵀ(BA − T)
function train(kind) {
  let A = kind === 'std' ? randomA() : Array.from({ length: R }, () => new Array(N).fill(0));
  let B = Array.from({ length: N }, () => new Array(R).fill(0));
  const frames = [];
  for (let step = 0; step <= STEPS; step++) {
    const P = B.map(b => Array.from({ length: N }, (_, j) => b.reduce((s, v, p) => s + v * A[p][j], 0)));
    const G = P.map((row, i) => row.map((v, j) => v - T[i][j]));
    const gB = G.map(g => A.map(a => g.reduce((s, v, j) => s + v * a[j], 0)));
    const gA = A.map((_, p) => Array.from({ length: N }, (_, j) => B.reduce((s, b, i) => s + b[p] * G[i][j], 0)));
    frames.push({ A, B, P, err: norm(G) / norm(T), gB: norm(gB), gA: norm(gA) });
    B = B.map((b, i) => b.map((v, p) => v - LR * gB[i][p]));
    A = A.map((a, p) => a.map((v, j) => v - LR * gA[p][j]));
  }
  return frames;
}
const runs = { std: train('std'), zero: train('zero') };
const most = pick => Math.max(...runs.std.map(pick));
const peakOf = m => Math.max(...m.flat().map(Math.abs));
const peak = { A: most(f => peakOf(f.A)), B: most(f => peakOf(f.B)), T: peakOf(T), g: most(f => Math.max(f.gA, f.gB)) };

const root = document.querySelector('.ini');
const svg = root.querySelector('svg'), slider = root.querySelector('input'), playKey = root.querySelector('.play');
const meters = [...root.querySelectorAll('.meter b')], values = [...root.querySelectorAll('.grads output')];
const stepOut = root.querySelector('.ctl output');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let kind = 'std', step = 0, width = 0, raf = 0;

function cells(x0, y0, rows, cols, value, scale, c) {
  let out = '';
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = value(i, j), a = Math.min(1, Math.abs(v) / scale);
      if (a > .03) out += `<rect class="${v > 0 ? 'pos' : 'neg'}" x="${x0 + j * c}" y="${y0 + i * c}" width="${c}" height="${c}" fill-opacity="${(a ** .8).toFixed(2)}"/>`;
    }
  }
  return out;
}

function render() {
  if (!width) return;
  const F = runs[kind][step];
  const gap = 6, mid = width < 480 ? 28 : 44;
  const c = Math.max(6, Math.min(16, Math.floor((width - gap - mid) / (R + 2 * N))));
  const x0 = Math.max(0, Math.floor((width - c * (R + 2 * N) - gap - mid) / 2));
  const xP = x0 + R * c + gap, xT = xP + N * c + mid, size = N * c, band = R * c;
  const yA = 4, yP = yA + band + gap, H = yP + size + 28;
  let s = cells(x0, yP, N, R, (i, j) => F.B[i][j], peak.B, c);
  s += cells(xP, yA, R, N, (i, j) => F.A[i][j], peak.A, c);
  s += cells(xP, yP, N, N, (i, j) => F.P[i][j], peak.T, c);
  s += cells(xT, yP, N, N, (i, j) => T[i][j], peak.T, c);
  s += [[x0, yP, band, size], [xP, yA, size, band], [xP, yP, size, size], [xT, yP, size, size]]
    .map(([x, y, w, h]) => `<rect class="frame" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');
  s += `<text class="sym" x="${xP - 10}" y="${yA + band / 2}" text-anchor="end">A</text>`;
  s += `<text class="sym" x="${x0 + band / 2}" y="${yP + size + 15}" text-anchor="middle">B</text>`;
  s += `<text class="sym" x="${xP + size / 2}" y="${yP + size + 15}" text-anchor="middle">BA</text>`;
  s += `<text class="zh" x="${xT + size / 2}" y="${yP + size + 15}">目标</text>`;
  s += `<text class="op" x="${xP + size + mid / 2}" y="${yP + size / 2}">→</text>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = s;
  const pct = (F.err * 100).toFixed(1);
  svg.setAttribute('aria-label', `第 ${step} 步：BA 和目标的相对误差 ${pct}%，B 的梯度 ${F.gB.toFixed(2)}，A 的梯度 ${F.gA.toFixed(2)}`);
  [F.gB, F.gA].forEach((g, i) => {
    meters[i].style.width = `${Math.min(100, g / peak.g * 100)}%`;
    values[i].textContent = g.toFixed(2);
  });
  stepOut.textContent = `第 ${step} 步，误差 ${pct}%`;
  slider.value = step;
}

function halt() { cancelAnimationFrame(raf); raf = 0; }
function play() {
  halt();
  // 关了动画就直接跳到训完
  if (reduce) { step = STEPS; render(); return; }
  const t0 = performance.now();
  const frame = now => {
    step = Math.min(STEPS, Math.floor((now - t0) / 60));
    render();
    if (step < STEPS) raf = requestAnimationFrame(frame);
  };
  step = 0; render();
  raf = requestAnimationFrame(frame);
}

if (reduce) playKey.textContent = '训到底';
playKey.addEventListener('click', play);
slider.addEventListener('input', () => { halt(); step = Number(slider.value); render(); });
root.querySelectorAll('[data-init]').forEach(button => button.addEventListener('click', () => {
  halt();
  kind = button.dataset.init;
  root.querySelectorAll('[data-init]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

第 0 步，$B$ 全是 0，所以 $A$ 的梯度是空的；$A$ 不是 0，$B$ 拿得到梯度。点“训练”：$B$ 先长出数来，$A$ 的梯度跟着才有，$BA$ 一步步贴上目标。换成“都是 0”，两条梯度从头到尾是空的，训多少步都停在原地。

反过来让 $A$ 为 0、$B$ 随机也能训，只是实验上前一种能用更大的学习率，效果更好。

**缩放。** $BA$ 是 $r$ 块加起来的，$r$ 翻倍，叠的项多一倍，旁路的输出也跟着变大。除以 $r$ 把这一点抵掉，换 $r$ 时学习率不用大动。

$\alpha$ 起的作用和学习率差不多。旁路整体乘了 $\alpha/r$，$A$、$B$ 的梯度也跟着乘了 $\alpha/r$；可 Adam 会把梯度的整体大小除掉，$A$、$B$ 每步还是各挪 $\eta$ 左右，于是 $\Delta W$ 每步的变化正比于 $\alpha\eta$。所以常见做法是把 $\alpha$ 定成 $r$ 或 $2r$，只调学习率。rsLoRA 认为 $1/r$ 压过了头，大秩被压得学不动，改成了 $\alpha/\sqrt r$。

**合并。** 旁路是线性的，能和主路并成一个矩阵：

$$
W_0x+\frac{\alpha}{r}BAx=\Big(W_0+\frac{\alpha}{r}BA\Big)x.
$$

训完把括号里的矩阵算出来，存成一个普通的权重，旁路就没了，推理和原模型一样快。也可以不合并，下一节说。

**省了什么。** 冻住的参数不要梯度，也就不要 Adam 状态和 FP32 主权重，每个参数从 16 字节降到 2 字节，8B 的底座回到 16 GB。要训的只剩 $A$ 和 $B$：$r=16$、每层 7 个线性层全挂上（挂哪些层后面说），32 层加起来 4,200 万个参数，是底座的 0.5%，照 16 字节算也只有 0.7 GB。

省不下的是激活。最前面那层的 LoRA 也要梯度，反向传播照样得穿过每一层，每一层的中间结果照样得留着。算力也省得不多：只少了对冻结权重求梯度那一步，一步的计算量还剩全量的三分之二左右。

## 插拔：一份底座，很多个任务

LoRA 训完只存 $A$ 和 $B$。用 Hugging Face 的 PEFT 库训，存下来就是两个文件：

```text
adapter_config.json          底座是谁、r、alpha、挂在哪些层
adapter_model.safetensors    每一层的 A 和 B
```

上面那组 4,200 万个参数，按 FP32 存是 168 MB；$r$ 小一些、挂的层少一些，就只有十几 MB。底座一个字节都不用再存。于是 LoRA 可以当插件用，底座加载一次，换任务就换一组：

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
  .rows { display: grid; grid-template-columns: auto 18px minmax(76px, 8.5em) 18px 40px 14px 1.2em; gap: 10px 6px; align-items: center; justify-content: center; margin-top: 16px; }
  .task { display: inline-flex; align-items: center; gap: 7px; color: var(--text); white-space: nowrap; }
  .task::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .task.base { color: var(--muted); }
  .task.base::before { background: none; box-shadow: inset 0 0 0 1.5px var(--muted); }
  .line { height: 0; border-top: 1.2px solid var(--muted); }
  .shared { grid-column: 3; grid-row: 1 / span 5; align-self: stretch; display: grid; place-content: center; border: 1px solid var(--rule-strong); background-color: var(--rule);
    background-image: linear-gradient(color-mix(in srgb, var(--rule-strong) 70%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--rule-strong) 70%, transparent) 1px, transparent 1px);
    background-size: 100% 20%, 25% 100%; background-position: 0 -1px, -1px 0; }
  .shared > span { padding: 0 6px; background: var(--rule); color: var(--text); font-size: 19px; line-height: 1.3; text-align: center; }
  .shared .ba { color: var(--t1); }
  .shared .katex { font-size: 1em; }
  .plus { color: var(--muted); font: 16px KaTeX_Main, var(--font-serif); text-align: center; }
  .tie { display: block; width: 40px; height: 16px; overflow: visible; }
  .tie path { fill: color-mix(in srgb, var(--c) 16%, transparent); stroke: var(--c); stroke-width: 1.3; }
  .out { color: var(--text); font-size: 15px; text-align: center; }
  .out.bad { color: var(--accent-ink); }
  .mux[data-mode="merged"] .shared { border-color: var(--t1); background-color: color-mix(in srgb, var(--t1) 14%, var(--bg)); }
  .mux[data-mode="merged"] .shared > span { background: color-mix(in srgb, var(--t1) 14%, var(--bg)); }
  .mux[data-mode="merged"] .lane { visibility: hidden; }
</style>
<section class="mux" data-mode="lanes" aria-label="同一个 batch 里五个请求要四种模型：LoRA 挂在旁路上，五个都答得对；把翻译那组并进底座，就只有要翻译的两个还对">
  <div class="seg" role="group" aria-label="LoRA 怎么挂">
    <button type="button" data-mode="lanes" aria-pressed="true">旁路挂着</button>
    <button type="button" data-mode="merged" aria-pressed="false">把翻译并进 $W_0$</button>
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
    ? '<span>$W_0$<br>$+\\;\\htmlClass{ba}{BA}$</span>'
    : '<span>$W_0$</span>';
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

一层 Transformer 有 7 个线性层：注意力的 q、k、v、o，MLP 的 gate、up、down。LoRA 原论文只挂了注意力里的 q 和 v；后来 QLoRA 和 Thinking Machines 的 LoRA Without Regret 都发现，要追平全量微调得全部挂上，MLP 最要紧，这比 $r$ 取多少重要得多。参数本来也大半在那边：Llama-3.1-8B 一层 2.18 亿个参数，1.76 亿在 MLP 里。

$r$ 常取 8 到 64，管的是容量：数据少、任务窄就用小的。它对显存影响不大，$r$ 从 16 加到 64，可训练的参数从 4,200 万涨到 1.68 亿，也只多占 2 GB。学习率要比全量微调大一个数量级，全量常用 $10^{-5}$ 上下，LoRA 常用 $10^{-4}$ 上下。

词表里加了新 token 时，embedding 和 lm_head 里的新行是随机初始化的，这两层要整个放开训（PEFT 里写进 `modules_to_save`）。代价不小：两层加起来 10 亿个参数，照前面的账，放开以后每个又回到 16 字节，多占将近 15 GB。

## QLoRA：把冻住的底座压成 4 bit

LoRA 之后，最大的一块是冻住的底座。它只被读、不被改，那就压缩着存，算到哪层解压哪层：底座存成 4 bit，LoRA 照常用 16 位训。

4 bit 只有 16 个编号，一个权重只能从 16 个值里挑，下面管这些值叫格子。一组权重是这样量化的：找出其中绝对值最大的那个数 $c$，每个数都除以 $c$，缩进 $[-1,1]$；再各自归到最近的格子 $q_j$，只存格子的编号 $j$。用的时候查出格子的值，乘回 $c$：

$$
\hat w=c\cdot q_j,\qquad j=\arg\min_i\,\Big|\,q_i-\frac{w}{c}\,\Big|.
$$

这叫 absmax 量化。拿 16 个权重走一遍，格子先等距地摆（对称着摆 15 个，空一个编号）：

```render html title="一组 16 个权重，c = 0.041；上面是原来的位置，下面是归到的格子，格子下的数是编号"
<style>
  .qz { font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  .qz svg { display: block; width: 100%; height: auto; overflow: visible; }
  .axis { stroke: var(--rule-strong); }
  .tick { stroke: var(--text); stroke-width: 1.4; }
  .tick.idle { stroke: var(--rule-strong); }
  .code { fill: var(--faint); font: 10.5px var(--font-mono); text-anchor: middle; }
  .code.used { fill: var(--text); font-weight: 600; }
  .raw { fill: var(--bg); stroke: var(--muted); stroke-width: 1.3; }
  .link { stroke: var(--accent); stroke-opacity: .45; }
  .q { fill: var(--accent); }
  .cap { fill: var(--muted); font-size: 12px; text-anchor: middle; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 16px; margin-top: 6px; }
  .codes { min-width: 0; color: var(--text); font: 13px var(--font-mono); overflow-wrap: anywhere; }
  .codes span { color: var(--muted); font-family: var(--font-sans); }
  .key { flex: none; min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
</style>
<section class="qz" aria-label="16 个权重各自归到 15 个等距格子里最近的一个，只存编号：中间的格子一格摞着两三个数，外侧的大半空着，只用上了 10 个格子">
  <svg role="img" aria-label="每个权重连到离它最近的格子"></svg>
  <div class="foot"><span class="codes"></span><button type="button" class="key">重放</button></div>
</section>
<script>
const WEIGHTS = [-41, -27, -19, -14, -11, -8, -6, -3, -1, 2, 4, 7, 9, 13, 18, 24].map(w => w / 1000);
const C = Math.max(...WEIGHTS.map(Math.abs));
const LEVELS = Array.from({ length: 15 }, (_, i) => (i - 7) / 7);
const nearest = v => LEVELS.reduce((best, l, i) => (Math.abs(l - v) < Math.abs(LEVELS[best] - v) ? i : best), 0);
const codes = WEIGHTS.map(w => nearest(w / C));
// 落进同一格的，一个摞一个
const row = codes.map((c, i) => codes.slice(0, i).filter(k => k === c).length);
const used = new Set(codes);

const root = document.querySelector('.qz'), svg = root.querySelector('svg'), key = root.querySelector('.key');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => t * t * (3 - 2 * t);
let width = 0, p = 1, raf = 0;

function render() {
  if (!width) return;
  const pad = 18, yRaw = 32, yAxis = 120;
  const x = v => pad + (v + 1) / 2 * (width - 2 * pad);
  const e = ease(p);
  let s = `<text class="cap" x="${pad}" y="13">−1</text><text class="cap" x="${width / 2}" y="13">权重 ÷ c</text><text class="cap" x="${width - pad}" y="13">1</text>`;
  s += `<line class="axis" x1="${pad}" x2="${width - pad}" y1="${yRaw}" y2="${yRaw}"/><line class="axis" x1="${pad}" x2="${width - pad}" y1="${yAxis}" y2="${yAxis}"/>`;
  LEVELS.forEach((l, i) => {
    const tx = x(l).toFixed(1), on = used.has(i);
    s += `<line class="tick${on ? '' : ' idle'}" x1="${tx}" x2="${tx}" y1="${yAxis - 5}" y2="${yAxis + 5}"/>`;
    s += `<text class="code${on ? ' used' : ''}" x="${tx}" y="${yAxis + 20}">${i}</text>`;
  });
  WEIGHTS.forEach((w, i) => {
    const x0 = x(w / C), x1 = x(LEVELS[codes[i]]), y1 = yAxis - 11 - row[i] * 11;
    const cx = (x0 + (x1 - x0) * e).toFixed(1), cy = (yRaw + (y1 - yRaw) * e).toFixed(1);
    s += `<line class="link" x1="${x0.toFixed(1)}" y1="${yRaw}" x2="${cx}" y2="${cy}"/>`;
    s += `<circle class="raw" cx="${x0.toFixed(1)}" cy="${yRaw}" r="3.5"/><circle class="q" cx="${cx}" cy="${cy}" r="4.5"/>`;
  });
  svg.setAttribute('viewBox', `0 0 ${width} 146`);
  svg.innerHTML = s;
}

function play() {
  cancelAnimationFrame(raf);
  const t0 = performance.now();
  const frame = now => {
    p = Math.min(1, (now - t0) / 1100);
    render();
    if (p < 1) raf = requestAnimationFrame(frame);
  };
  p = 0; render();
  raf = requestAnimationFrame(frame);
}

root.querySelector('.codes').innerHTML = `<span>存下来的编号：</span>${codes.join(' ')}`;
// 关了动画就只留最后一帧
if (reduce) key.hidden = true;
key.addEventListener('click', play);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; render(); }
}).observe(root);
</script>
```

16 个数原来各占 16 bit，现在每个只剩一个 4 bit 的编号，外加整组共用的一个 $c$。

毛病也在图上：中间的格子一格摞着两三个数，外侧的大半空着，15 个格子只用上 10 个。训练好的权重大致是正态分布，小的多、大的少，等距的格子把不少编号花在了没几个数的地方。

这种等距的摆法就是 INT4。QLoRA 用的 NF4 换了个摆法：按正态分布的分位数摆，中间密、两头疏，让每个格子分到的数差不多一样多。下面换成 2,000 组、每组 64 个正态分布的数，看两种摆法各自的格子用了多少：

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
<section class="q4" aria-label="同一批正态分布的权重：INT4 的格子等距，中间几格挤满、外侧几乎空着；NF4 的格子按分位数摆，每格分到的数差不多，误差也小一些">
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

同样是 4 bit 的编号，格子用得越平均，一个编号带的信息越多：NF4 平均能用出 3.9 bit，INT4 只有 3.5 bit。NF4 还特意留了一个精确的 0。

点“混进一个离群值”：$c$ 被撑大，其余的数全挤进中间几格。所以 QLoRA 每 64 个权重分一块，各算各的 $c$，离群值只祸害自己那一块。

**双重量化。** 每块一个 32 位的 $c$，摊下来每个参数多 0.5 bit。把这些 $c$ 再按 256 个一组量化成 8 bit，就降到了

$$
\frac{8}{64}+\frac{32}{64\times256}\approx0.127\ \text{bit}.
$$

**存 4 bit，算 16 bit。** 每层计算前先解压回 BF16：

$$
h=\operatorname{dequant}\big(W_0^{\text{NF4}}\big)\,x+\frac{\alpha}{r}BAx.
$$

所以 QLoRA 省显存、不省算力，每层多一次解压，比 LoRA 还慢一点。梯度穿过解压出来的权重传给 $A$、$B$，底座自己不动。

**分页优化器。** 碰上特别长的样本、显存突然冲高时，把优化器状态临时换到 CPU 内存里，不至于直接爆显存。

**量化完有多大。** 8B 的底座压完是 5.7 GB 上下，比 16 GB 的四分之一多出一截。按 bitsandbytes 的做法，量化的只有 32 层里的线性层：70 亿个参数，每个 4.127 bit，一共 3.6 GB。词嵌入和输出层各 5 亿多个参数，照旧按 16 位存，又是 2.1 GB。

论文用这一套在一张 48 GB 的卡上微调了 65B 的模型，效果追平 16 位微调。

**合并要留神。** $A$、$B$ 是对着量化后的底座学的，补的是它的差。要原样保住训练时的行为，得在解压出来的那份底座上合并，存成 16 位。合并到原始权重上，底座变了；合并完再量化一遍，又多挨一次误差。LoftQ 反过来利用这一点：量化时就挑好 $A$、$B$ 的初值，让 $BA$ 先把量化误差补上一部分。

### 拼起来：回到 24 GB 的卡

开头那笔账现在每一行都有了对策。冻住底座，梯度、主权重、Adam 那 112 GB 只剩 $A$、$B$ 的 0.7 GB；底座压成 4 bit，16 GB 变成 5.7 GB；梯度检查点把激活压到十几分之一。4 bit 只能跟 LoRA 配：16 个格子比 BF16 粗得多，直接在上面做更新，更是一步都挪不动。

```render html title="粗算：Llama-3.1-8B，r = 16 挂全部线性层；激活按每个 token 6 MB，开检查点后 0.43 MB；横条只画到 48 GB"
<style>
  .bud { --blue: #356f9b; font-size: 13px; line-height: 1.5; font-variant-ligatures: none; }
  :root[data-theme="dark"] .bud { --blue: #95bfdc; }
  .opts { display: flex; flex-wrap: wrap; gap: 8px; }
  .opts button { min-height: 38px; padding: 0 14px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--muted); font-size: 13px; cursor: pointer; }
  .opts button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  .opts button:disabled { opacity: .45; cursor: default; }
  .ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; margin-top: 10px; color: var(--muted); }
  .ctl output { color: var(--text); font: 13px var(--font-mono); }
  .ctl input { flex: 1 1 160px; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .track { position: relative; height: 34px; margin-top: 30px; }
  .bar { display: flex; height: 100%; overflow: hidden; border-bottom: 1px solid var(--rule-strong); }
  .bar i { flex: none; height: 100%; min-width: 3px; box-shadow: inset -2px 0 var(--bg); transition: width .3s ease; }
  .w { background: var(--rule-strong); }
  .t { background: var(--blue); }
  .l { background: var(--accent); }
  .a { background: repeating-linear-gradient(135deg, var(--faint) 0 2px, transparent 2px 6px); }
  .card { position: absolute; top: -22px; bottom: -6px; left: 50%; border-left: 1.5px dashed var(--text); }
  .more { position: absolute; top: 0; right: 0; bottom: 1px; display: none; align-items: center; padding: 0 6px; background: var(--bg); color: var(--text); font: 600 14px var(--font-mono); }
  .track.clip .more { display: flex; }
  .card b { position: absolute; top: -3px; left: 7px; color: var(--text); font: 600 12px var(--font-mono); white-space: nowrap; }
  .legend { display: flex; flex-wrap: wrap; gap: 2px 18px; margin-top: 14px; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .legend i { width: 12px; height: 12px; }
  .legend b { color: var(--text); font: 600 13px var(--font-mono); }
  .sum { margin: 8px 0 0; color: var(--text); }
  .sum b { font: 600 17px var(--font-mono); }
  .sum.over { color: var(--accent-ink); }
  @media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
</style>
<section class="bud" aria-label="8B 模型训练时的显存预算：LoRA、4 bit 底座、梯度检查点全开，一个 batch 4096 个 token 时约 8 GB，一张 24 GB 的卡放得下；关掉任何一招，对应的那一段就长回来">
  <div class="opts" role="group" aria-label="用哪几招">
    <button type="button" data-k="lora">LoRA</button>
    <button type="button" data-k="q4">4 bit 底座</button>
    <button type="button" data-k="ckpt">梯度检查点</button>
  </div>
  <label class="ctl"><span>一个 batch 的 token</span><output></output><input type="range" min="0" max="4" value="2" aria-label="一个 batch 里的 token 数"/></label>
  <div class="track"><div class="bar"><i></i><i></i><i></i></div><div class="card"><b>24 GB</b></div><div class="more" aria-hidden="true">→</div></div>
  <div class="legend"></div>
  <p class="sum"></p>
</section>
<script>
const TOKENS = [1024, 2048, 4096, 8192, 16384];
// 单位 GB；激活是每个 token 的
const GB = { weights: 16, weights4: 5.7, state: 112, lora: .67, act: 6e-3, actCkpt: .43e-3 };
const SCALE = 48, CARD = 24;
const root = document.querySelector('.bud');
const buttons = [...root.querySelectorAll('.opts button')];
const slider = root.querySelector('input'), tokOut = root.querySelector('.ctl output');
const segs = [...root.querySelectorAll('.bar i')], track = root.querySelector('.track');
const legend = root.querySelector('.legend'), sum = root.querySelector('.sum');
const on = { lora: true, q4: true, ckpt: true };
const fmt = v => String(Number(v.toFixed(1)));

function show() {
  // 量化过的权重改不动，4 bit 只能和 LoRA 一起用
  const q4 = on.lora && on.q4, tokens = TOKENS[Number(slider.value)];
  const parts = [
    ['w', q4 ? '4 bit 权重' : '权重', q4 ? GB.weights4 : GB.weights],
    on.lora ? ['l', 'LoRA', GB.lora] : ['t', '梯度 + 主权重 + Adam', GB.state],
    ['a', '激活', tokens * (on.ckpt ? GB.actCkpt : GB.act)],
  ];
  const total = parts.reduce((s, part) => s + part[2], 0);
  parts.forEach(([cls, , v], i) => {
    segs[i].className = cls;
    segs[i].style.width = `${Math.min(100, v / SCALE * 100)}%`;
  });
  track.classList.toggle('clip', total > SCALE);
  legend.innerHTML = parts.map(([cls, name, v]) => `<span><i class="${cls}"></i>${name}<b>${fmt(v)} GB</b></span>`).join('');
  const fits = total <= CARD;
  sum.className = fits ? 'sum' : 'sum over';
  sum.innerHTML = `合计 <b>${fmt(total)} GB</b>　${fits ? '还剩' : '超出'} ${fmt(Math.abs(CARD - total))} GB`;
  tokOut.textContent = tokens;
  buttons.forEach(b => {
    const k = b.dataset.k;
    b.disabled = k === 'q4' && !on.lora;
    b.setAttribute('aria-pressed', String(k === 'q4' ? q4 : on[k]));
  });
}

buttons.forEach(b => b.addEventListener('click', () => { on[b.dataset.k] = !on[b.dataset.k]; show(); }));
slider.addEventListener('input', show);
show();
</script>
```

三招全开、一个 batch 4096 个 token（比如 4 条 1024 长的样本），8 GB 出头。关掉“4 bit 底座”，也就是普通的 LoRA，是 18 GB，也还放得下；可 token 拖到 16384，就只剩 0.3 GB 了。关掉梯度检查点更要命：4096 个 token 的激活将近 25 GB，这一项就超过了整张卡。

这些数是按公式粗算的。真跑起来还有 CUDA 自己占的、显存碎片和临时张量，得再留一两 GB，只剩 0.3 GB 的那种配置实际跑不起来。

## 别的省法

只训一小部分参数，LoRA 不是头一个。这类方法统称参数高效微调（parameter-efficient fine-tuning，PEFT 库的名字就是它的缩写），差别在可训练的那点参数放在一层的哪里：

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
  <svg role="img"></svg>
</section>
<script>
const METHODS = { full: '全量', lora: 'LoRA', adapter: 'Adapter', prefix: 'Prefix', prompt: 'Prompt', ia3: '(IA)$^3$' };
const WHERE = {
  full: '全量微调：每个权重矩阵都训',
  lora: 'LoRA：每个权重矩阵旁边并联一条 BA 旁路',
  adapter: 'Adapter：两个子层的出口各串一个带非线性的瓶颈小网络',
  prefix: 'Prefix Tuning：每层注意力的 K、V 前面拼几列可训练的向量',
  prompt: 'Prompt Tuning：只在输入前面拼几个可训练的向量',
  ia3: '(IA)$^3$：逐元素缩放 K、V 和 MLP 的中间激活',
};
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
  svg.setAttribute('aria-label', WHERE[key]);
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

Adapter 是串在主路上的瓶颈小网络：先压到很低的维度，过一个非线性，再放大回来。推理时每个 token 都得多穿过它；中间夹着非线性，也没法并回权重。LoRA 同样是先压后放，但它和 $W_0$ 并联，中间没有非线性，所以前面那个合并的等式才成立。

Prompt Tuning 只在输入前拼几个可训练的向量；Prefix Tuning 在每层注意力的 K、V 前面都拼几列。参数极少，但占上下文，训练也不太稳，模型不够大时追不上全量微调。(IA)$^3$ 只学几个向量，逐元素缩放 K、V 和 MLP 的中间激活，同样能并回权重。

LoRA 自己也有一串变体，多数只改一处：

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

最常见的微调是 SFT（supervised fine-tuning，有监督微调）：数据是一问一答，训练时用模型自己的聊天模板拼成一篇文档，和推理时一模一样：

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

数据的质量比数量要紧。LIMA 只用 1,000 条精选的问答微调 65B 的 LLaMA，人工对比里有 43% 的回答被判为不比 GPT-4 差。他们的“表面对齐假说”认为，知识和能力几乎都来自预训练，微调教的是用什么格式和口吻说出来。

反过来，靠微调灌新知识往往不划算。2024 年有实验发现，模型原先不知道的事实学得很慢，学进去以后还更爱胡编。新知识更适合交给 RAG（先检索资料，再让模型照着答），微调管格式、风格和行为。

在窄数据上训久了，原来的能力会退化，这叫灾难性遗忘。混些通用数据、降低学习率、少训几轮，或者用 LoRA，都能缓解。轮数一般 1 到 3 轮，验证集损失开始回升就该停了。

## SFT 之后：教它分好坏

SFT 只能模仿示范。很多时候写不出标准答案，却能判断两个回答哪个更好：同一个提问 $x$，好回答 $y_w$，差回答 $y_l$。这样一组叫一个偏好对。

**RLHF。** 先拿偏好对训一个奖励模型，给回答打分，记作 $R(x,y)$（大写，免得和秩 $r$ 撞名）。按 Bradley–Terry 模型，两个回答的分差过一个 sigmoid，就是好回答胜出的概率，训练时让它尽量大：

$$
P(y_w\succ y_l\mid x)=\sigma\big(R(x,y_w)-R(x,y_l)\big).
$$

再用强化学习（常用 PPO）训模型本身，这里叫策略 $\pi$：让它生成的回答多拿奖励，同时不许离 SFT 出来的参考模型 $\pi_{\text{ref}}$ 太远：

$$
\max_{\pi}\ \mathbb{E}_{x,\,y\sim\pi(\cdot\mid x)}\big[R(x,y)\big]-\beta\,\mathbb{D}_{\mathrm{KL}}\big(\pi(\cdot\mid x)\,\big\|\,\pi_{\text{ref}}(\cdot\mid x)\big).
$$

KL 项拴着策略。没有它，策略会去钻奖励模型的空子（reward hacking）：奖励模型只在见过的那类回答上打分靠谱，离远了，分数高也不说明回答好。

这一套要同时摆四个模型：策略、参考、奖励，还有 PPO 自己要的 critic（估计当前能拿多少奖励，用来压低梯度的方差）。策略和 critic 都要训，还得一边训一边生成回答，比 SFT 重得多。

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

$Z(x)$ 是归一化常数，让概率加起来等于 1。把这个式子倒过来，用策略表示奖励：

$$
R(x,y)=\beta\log\frac{\pi^*(y\mid x)}{\pi_{\text{ref}}(y\mid x)}+\beta\log Z(x).
$$

代回 Bradley–Terry，两个回答的 $\beta\log Z(x)$ 一减就没了，奖励模型也跟着消失。把 $\pi^*$ 换成要训练的 $\pi_\theta$，就是 DPO 的损失：

$$
\mathcal{L}_{\text{DPO}}=-\log\sigma\Big(\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\text{ref}}(y_w\mid x)}-\beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\text{ref}}(y_l\mid x)}\Big).
$$

只要策略和参考两个模型，不用生成，也不用 critic，训起来和 SFT 一样是普通的前向加反向。论文标题说“你的语言模型暗地里是个奖励模型”，指的就是 $\beta\log\frac{\pi_\theta}{\pi_{\text{ref}}}$ 这一项，下面记作 $\hat R$。

求梯度时，每个偏好对带一个权重 $\sigma(\hat R_l-\hat R_w)$：好坏已经分对的几乎不学，分反的学得最用力。$\beta$ 还是 KL 约束的强度：大了保守，贴着参考模型；小了走得远，也更容易过拟合偏好数据，常用 0.1 左右。DPO 的毛病是只管拉开差距，好回答的概率也可能跟着往下掉。

**GRPO。** DeepSeekMath 提出、DeepSeek-R1 拿来训推理的方法。还是强化学习，但扔掉了 critic：同一题生成 $G$ 个回答，第 $i$ 个回答比同组的平均水平好多少，就是它的优势：

$$
\hat A_i=\frac{R_i-\operatorname{mean}(R_1,\dots,R_G)}{\operatorname{std}(R_1,\dots,R_G)}.
$$

优势为正的回答，概率往上推；为负的往下压。奖励可以直接是规则，比如答案对不对、代码能不能跑过测试。

| | 数据 | 训练时要的模型 | 边训边生成 |
| --- | --- | --- | --- |
| SFT | 标准答案 | 策略 | 不要 |
| PPO | 偏好对，先训成奖励模型 | 策略、参考、奖励、critic | 要 |
| DPO | 偏好对 | 策略、参考 | 不要 |
| GRPO | 打分规则 | 策略、参考 | 要，每题一组 |

这些方法都能和 LoRA 一起用，还能再省一份显存。DPO 要策略和参考两个模型，全量训练就是两份权重。用 LoRA 时，参考模型就是没挂 LoRA 的底座：同一份权重，关掉旁路再跑一遍前向就是它，第二个模型一个字节都不用多存。

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
- Houlsby et al. [Parameter-Efficient Transfer Learning for NLP](https://arxiv.org/abs/1902.00751), 2019；Li & Liang. [Prefix-Tuning](https://arxiv.org/abs/2101.00190), 2021；Lester et al. [Prompt Tuning](https://arxiv.org/abs/2104.08691), 2021；Liu et al. [(IA)$^3$](https://arxiv.org/abs/2205.05638), 2022。
- Kalajdzievski. [rsLoRA](https://arxiv.org/abs/2312.03732), 2023；Hayou et al. [LoRA+](https://arxiv.org/abs/2402.12354), 2024；Liu et al. [DoRA](https://arxiv.org/abs/2402.09353), 2024；Meng et al. [PiSSA](https://arxiv.org/abs/2404.02948), 2024；Zhang et al. [AdaLoRA](https://arxiv.org/abs/2303.10512), 2023；Li et al. [LoftQ](https://arxiv.org/abs/2310.08659), 2023；Kopiczko et al. [VeRA](https://arxiv.org/abs/2310.11454), 2023；Zhao et al. [GaLore](https://arxiv.org/abs/2403.03507), 2024。
- Zhou et al. [LIMA: Less Is More for Alignment](https://arxiv.org/abs/2305.11206), 2023；Gekhman et al. [Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations?](https://arxiv.org/abs/2405.05904), 2024。
- Ouyang et al. [InstructGPT](https://arxiv.org/abs/2203.02155), 2022；Rafailov et al. [Direct Preference Optimization](https://arxiv.org/abs/2305.18290), 2023；Shao et al. [DeepSeekMath](https://arxiv.org/abs/2402.03300), 2024；DeepSeek-AI. [DeepSeek-R1](https://arxiv.org/abs/2501.12948), 2025。
