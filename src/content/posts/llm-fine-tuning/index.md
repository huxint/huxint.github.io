---
title: "一张显卡，怎么微调大模型"
description: "全量微调一个 8B 模型动辄超过 130 GB 显存，算清这笔开销后，再看看混合精度、梯度检查点、LoRA 和 QLoRA 怎么把它压进一张显卡。"
pubDate: 2026-10-23
updatedDate: 2026-11-11
tags: ["大语言模型", "机器学习"]
---

一个 8B 模型有 80 亿个参数，按 BF16（16 位浮点，每个数 2 字节）来存，权重占 16 GB，拿一张 24 GB 显存的显卡跑推理绰绰有余。但想在这张卡上接着训练它（也就是微调），显存需求一下子会涨到 130 GB 以上。

多出来的这一百多 GB 到底用在了哪？常听到的 LoRA、QLoRA，都是针对下面这笔账在压缩显存：

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

微调和预训练用的是同一套算法，只是起点换成了预训练好的权重，数据换成了自己的语料。目标依然是拉高标准答案每个 token 的预测概率，对应的损失就是交叉熵：

$$
\mathcal{L}(\theta)=-\frac{1}{T}\sum_{t=1}^{T}\log p_\theta(y_t\mid y_{<t})
$$

这里 $\theta$ 是全部参数，$T$ 是参与算损失的 token 数。一个训练步分三步：前向传播算出损失 $\mathcal{L}$，反向传播算出各参数梯度 $g=\nabla_\theta\mathcal{L}$，再沿着梯度更新参数。

更新参数几乎清一色用 AdamW，它给每个参数多维护两个状态，分别是梯度的滑动平均 $m$ 和梯度平方的滑动平均 $v$：

$$
\begin{aligned}
m&\leftarrow\beta_1m+(1-\beta_1)\,g,\\
v&\leftarrow\beta_2v+(1-\beta_2)\,g^2,\\
\theta&\leftarrow\theta-\eta\,\frac{\hat m}{\sqrt{\hat v}+\epsilon}.
\end{aligned}
$$

其中 $\hat m$、$\hat v$ 是偏差修正后的 $m$、$v$，$\eta$ 是学习率。（AdamW 每步还会做一次权重衰减，把权重按比例往 0 收缩一点，但这不额外占显存，这里略去。）更新时除以 $\sqrt{\hat v}$，等于按梯度幅度给每个参数单独归一化步长，结果无论梯度本身多大，单步更新量大体都落在 $\eta$ 左右，后面讲 LoRA 的 $\alpha$ 时还会用到这一点。

现在大模型训练普遍开混合精度，前向和反向用 16 位算，快且省内存，更新则留在 32 位上做。算下来每个参数要存四样东西：

| 存的东西 | 精度 | 字节 |
| --- | --- | --- |
| 权重（前向和反向用） | BF16 | 2 |
| 梯度 | BF16 | 2 |
| 主权重（更新用） | FP32 | 4 |
| Adam 的 $m$、$v$ | FP32 | 8 |

加起来一共 16 字节，8B 模型正好是 128 GB，开头那张图第一行的四段对应的就是这四项，推理时只需要第一行的 16 GB 权重。

（这是 ZeRO 论文里的分法。PyTorch 原生 autocast 的做法不太一样，权重和梯度常驻 FP32，16 位那份计算时现转，但合计同样是每个参数 16 字节。）

### 权重为什么存两份

这张表里最让人费解的大概是第三行，既然已经有一份 BF16 权重了，为什么还要多存一份 FP32 的？

问题出在精度间隔上。BF16 的 16 位里给了 1 位符号和 8 位指数，尾数只剩 7 位。在 0.02 附近，相邻两个可表示的数隔着 $2^{-13}\approx0.00012$。全量微调的学习率一般在 $10^{-5}$ 上下，Adam 单步更新量也就这么大，不到相邻间隔的十分之一：

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

图里上面“只有 BF16”那一行，每步加上 0.00001 后一舍入又退回原位，训多少步都没动静。下面那行则是先把微小更新累加在 FP32 主权重上（FP32 在这附近的间隔是 $2^{-29}$，不到十亿分之二），攒过相邻两格的中点，BF16 副本才跳一格。所以更新必须落在 FP32 主权重上，每步算完再转一份 BF16 去跑前向。

同样是 16 位，还有一种 FP16，现在训大模型已经很少用了：

| 格式 | 指数位 | 尾数位 | 最大值 |
| --- | --- | --- | --- |
| FP32 | 8 | 23 | $3.4\times10^{38}$ |
| FP16 | 5 | 10 | $65504$ |
| BF16 | 8 | 7 | $3.4\times10^{38}$ |

BF16 相当于拿尾数精度换范围，指数位和 FP32 一样多。FP16 范围太窄，小梯度容易下溢成 0，不得不配 loss scaling，也就是先把损失放大再反向，更新前再除回来。用 BF16 就省了这层麻烦。

### 激活：按 token 算的另一笔账

每参数 16 字节只跟参数量有关，显存里还有一大块按 token 数算，就是激活（activation），即前向时各层算出的中间结果。

反向传播离不了它们。以线性层 $h=Wx$ 为例，传到这一层的梯度是 $\delta=\partial\mathcal{L}/\partial h$，权重的梯度为

$$
\frac{\partial\mathcal{L}}{\partial W}=\delta\,x^\top,
$$

需要乘上这一层前向时的输入 $x$。由于反向是从最后一层往回走的，前向一路算下去，每层的输入和中间结果都得留着，等反向退回该层算完梯度才能释放。

这块开销取决于单个 batch 里有多少 token，跟用全量微调还是 LoRA、QLoRA 没关系，后面的方法都省不掉它。拿 Llama-3.1-8B 粗算，隐藏维度 4096，MLP 中间层 14336，单层要留的张量加起来每个 token 约十万个数，按 BF16 算 200 KB，32 层就是 6 MB 左右。如果序列长 1024、batch 取 4，光激活就有二十几 GB，比权重本身还大。

常见省法是开梯度检查点（gradient checkpointing）：前向时每层只留最开始的输入，其余中间结果算完就扔；反向走到哪一层，再用留下的输入把这层重算一遍，用完即放。

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

不开检查点时，前向刚结束，12 层激活全压在显存里。开启后，任意时刻最多只有当前一层完全展开，其余每层只留一份输入，峰值从 12 降到 1.5。代价在最右边那个数字里——整步前向计算从 12 层变成 24 层，等于每层算两遍，训练慢两三成。

真实模型有 32 层，同样算法下峰值从 32 降到 2.3，前面粗算的二十几 GB 激活就能压到 2 GB 左右。

### 多卡：把显存摊开

128 GB 单卡放不下，常规做法是加卡。普通数据并行解决不了问题，因为每张卡依然要存满 16 字节，卡再多单卡也不少占。DeepSpeed 的 ZeRO 把这些状态切开，让每张卡只存一片。设参数量为 $\Phi$、卡数为 $N$：

| | 每张卡存的字节 | 8B 模型、8 张卡 |
| --- | --- | --- |
| 数据并行 | $16\Phi$ | 128 GB |
| ZeRO-1：切优化器状态 | $4\Phi+12\Phi/N$ | 44 GB |
| ZeRO-2：再切梯度 | $2\Phi+14\Phi/N$ | 30 GB |
| ZeRO-3：连权重也切 | $16\Phi/N$ | 16 GB |

这里的优化器状态包括 FP32 主权重加上 $m$、$v$，共 12 字节。到了 ZeRO-3 通信开销会明显上去，因为每层开算前都得先把分散在各卡上的权重收齐。PyTorch 的 FSDP 也是同样的分片思路。

但多卡只是把账摊开，总量一分没少，128 GB 只是分给了 8 张卡。如果只有一张卡，就得换个思路，能不能把绝大多数参数冻结起来不训？这就是 LoRA 的做法。

## LoRA：只学权重的差值

微调前后，权重从 $W_0$ 变成 $W_0+\Delta W$，全量微调学的是整个增量矩阵 $\Delta W$。拿注意力里一个 $4096\times4096$ 矩阵来说，里面有 1,677 万个数，每个都能自由变化。

但微调数据常常只有几千条，用不上这么多自由度。2020 年有项实验把 RoBERTa 的全部更新限制在一个随机 200 维子空间里，在 MRPC 上照样拿到全量微调 90% 的效果，说明预训练模型换任务时真正要调的方向并不多。

把“方向少”落到矩阵上就是低秩。最简单的情况是秩 1 矩阵，一列乘一行就能写出整块矩阵：

$$
\begin{bmatrix}1\\2\\-1\end{bmatrix}\begin{bmatrix}3&0&1\end{bmatrix}
=\begin{bmatrix}3&0&1\\6&0&2\\-3&0&-1\end{bmatrix}
$$

右边看着有 9 个数，自由度只有左边那 6 个，每一行不过是 $(3,0,1)$ 乘个倍数。一个矩阵最少要多少块“一列乘一行”相加才能拼出来，这个块数就是它的**秩**。反过来，$r$ 块相加正好能写成一个 $r$ 列矩阵乘一个 $r$ 行矩阵。

LoRA 假设每个权重矩阵的 $\Delta W$ 都近似低秩，直接把它写成两个瘦矩阵相乘：

$$
\Delta W=BA,\qquad B\in\mathbb{R}^{d\times r},\quad A\in\mathbb{R}^{r\times k},\quad r\ll\min(d,k).
$$

训练时冻结 $W_0$、只更新 $A$ 和 $B$，可训练参数就从 $dk$ 降到 $r(d+k)$。按 $d=k=4096$、$r=16$ 算只有 13 万个，不到原来的 1%。

下面是个 $24\times24$ 的小例子。右边目标 $\Delta W$ 默认是低秩构造的（三块主要分量加一层很弱的噪声），左边试着用秩 $r$ 的 $BA$ 去逼近它：

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

右上角那排竖条是奇异值。SVD 可以把任意矩阵拆成若干块“一列乘一行”，每块的大小就是奇异值，按从大到小排好。图里的 $BA$ 取了排在最前面的 $r$ 块——Eckart–Young 定理保证，在秩不超过 $r$ 的矩阵里这样取误差最小，所以这里展示的是秩 $r$ 理论上能达到的最好效果。

在“低秩”模式下，$r=3$ 就已经拿齐了三块主要分量，误差掉到 7%，再加秩提升也不大了。此时两条瘦矩阵一共 144 个数，整块矩阵是 576 个。

切到“满秩”就没有捷径了，奇异值衰减得很平缓，就算把 $r$ 拖到 12（两条瘦矩阵已经和整块一样大），误差仍剩一半多。LoRA 好使的前提，是任务要的改动本身接近低秩。调说话格式、改回答风格多半满足，灌大量新知识就未必了。2024 年的 LoRA Learns Less and Forgets Less 测过代码和数学任务，全量微调学出的 $\Delta W$ 秩比常用 LoRA 高 10 到 100 倍。结果正如论文标题所说，新东西 LoRA 学得少一些，原有能力忘得也少一些；数据量不大时，两者基本打平。

## 一层 LoRA 怎么算

挂上 LoRA 后，线性层的输出是主路和旁路相加：

$$
h=W_0x+\frac{\alpha}{r}BAx
$$

旁路会先算 $Ax$ 得到一个 $r$ 维向量，再乘 $B$ 投回 $d$ 维，全程不构造 $d\times k$ 的大矩阵。$\alpha$ 是一个定死的超参数，下面紧接着会说到。

先看初始化，标准做法是 $A$ 随机初始化、$B$ 全零。这样训练起步时 $BA=0$，模型和原权重完全等价，等于从原模型平滑出发。至于为什么不干脆都设为 0，记 $\delta=\partial\mathcal{L}/\partial h$ 看一眼梯度就明白了：

$$
\frac{\partial\mathcal{L}}{\partial B}=\frac{\alpha}{r}\,\delta\,(Ax)^\top,\qquad
\frac{\partial\mathcal{L}}{\partial A}=\frac{\alpha}{r}\,B^\top\delta\,x^\top.
$$

$B$ 的梯度里有 $A$，$A$ 的梯度里有 $B$，两者同时为 0 就永远启动不了更新。

拿个秩 2 的 $12\times12$ 矩阵实际训一遍看看。这里取 $r=2$，损失为 $BA$ 与目标之差的平方和，用普通梯度下降走 60 步：

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

默认的“A 随机，B 为 0”里，第 0 步 $B$ 全是 0，所以 $A$ 的梯度是空的，而 $A$ 非零让 $B$ 能拿到梯度。点击“训练”，$B$ 先更新出非零值，$A$ 跟着也有了梯度，$BA$ 一步步靠近目标。如果换成“都是 0”，两条梯度从头到尾都是空的，训再多步也停在原地。

反过来设 $A$ 为 0、$B$ 随机也能训，只是实验上前一种能承受更大的学习率，效果更好。

再看缩放系数 $\alpha/r$。因为 $BA$ 是 $r$ 块相加，$r$ 翻倍后叠加项多了一倍，旁路输出也会放大。除以 $r$ 就是把这层缩放抵掉，调 $r$ 时不用大改学习率。

至于 $\alpha$，它起的作用和学习率差不多。旁路整体乘了 $\alpha/r$，$A$、$B$ 的梯度也跟着缩放了 $\alpha/r$，但 Adam 会把梯度整体大小除掉，让 $A$、$B$ 每步依然各走 $\eta$ 左右，于是 $\Delta W$ 单步变化正比于 $\alpha\eta$。常见做法是把 $\alpha$ 固定成 $r$ 或 $2r$，只调学习率。后来 rsLoRA 认为 $1/r$ 在大秩下压得太狠、容易学不动，改成了 $\alpha/\sqrt r$。

训完以后，因为旁路是纯线性的，可以直接合并回主权重：

$$
W_0x+\frac{\alpha}{r}BAx=\Big(W_0+\frac{\alpha}{r}BA\Big)x.
$$

把括号里的结果算出来存成普通权重，推理时旁路就没了，速度和原模型完全一样。也可以故意不合并，下一节接着看。

那 LoRA 到底省了什么？冻结的底座不要梯度，也就不要 FP32 主权重和 Adam 状态，单个参数从 16 字节回到 2 字节，8B 底座降回 16 GB。要按 16 字节训的只剩 $A$、$B$。按 $r=16$、每层 7 个线性层全挂来算（挂哪些层后面细说），32 层共 4,200 万个参数，占底座的 0.5%，全套状态也只要 0.7 GB。

但激活和算力省不下多少。最前面那层的 LoRA 也要梯度，反向照样得穿过每一层，中间结果依然要留着；计算上只省掉了对冻结权重求梯度那一步，单步计算量大概还剩全量的三分之二。

## 插拔：一份底座，很多个任务

LoRA 训完只存 $A$ 和 $B$。用 Hugging Face 的 PEFT 库训完，保存下来的就只有两个文件：

```text
adapter_config.json          底座是谁、r、alpha、挂在哪些层
adapter_model.safetensors    每一层的 A 和 B
```

前面那组 4,200 万参数，按 FP32 存也就 168 MB；如果 $r$ 小一些或者少挂几层，甚至只有十几 MB，底座一个字节都不用多拷。这样 LoRA 就能当外挂插件用，底座加载一次，换任务只切适配器就行：

```python
from peft import PeftModel

model = PeftModel.from_pretrained(base, "lora/support", adapter_name="support")
model.load_adapter("lora/translate", adapter_name="translate")

model.set_adapter("translate")   # 换成翻译那一组
with model.disable_adapter():    # 临时拔掉，跑原模型
    ...
```

线上服务还可以更进一步。如果同一个 batch 里同时进来几条请求，分别要客服、翻译和原模型，这时候就不能合并进主权重了，因为一份合并后的权重只能装下一个任务：

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

保持“旁路挂着”时，整批先一起乘底座 $W_0$，再分组乘各自的 $A$、$B$ 加回去。多出来的计算很少，难点在于这些小矩阵乘法又小又碎。Punica 和 S-LoRA 专门写了定制 kernel，把它们攒成一次批处理算完；S-LoRA 还把暂时不用的适配器放在内存里，按需换进显存，一张卡就能挂上千个。vLLM 的 `--enable-lora` 也是这套思路。

插件还可以叠加，写成 $W_0+\Delta W_1+\Delta W_2$，比如一组管风格、一组管格式，只是叠在一起有时会互相干扰。另外适配器跟底座是绑定的，$A$ 和 $B$ 学的是相对某个 $W_0$ 的差值，换了底座就对不上了。

## 加在哪，秩取多少

一层 Transformer 有 7 个线性层，包括注意力的 q、k、v、o 和 MLP 的 gate、up、down。LoRA 原论文只挂了注意力的 q 和 v，但后来的 QLoRA 和 Thinking Machines 的 LoRA Without Regret 都发现，想追平全量微调最好全部挂上，尤其是 MLP 最要紧，这比纠结 $r$ 取多少重要得多。参数本来也大半在 MLP 里，比如 Llama-3.1-8B 单层 2.18 亿个参数，就有 1.76 亿在 MLP。

秩 $r$ 常取 8 到 64，用来控制容量，数据少、任务窄就选小一点。它对显存影响不大，$r$ 从 16 提到 64，可训练参数从 4,200 万涨到 1.68 亿，也只多占 2 GB 左右。学习率则要比全量微调大一个数量级，全量常用 $10^{-5}$ 上下，LoRA 常用 $10^{-4}$ 上下。

如果往词表里加了新 token，embedding 和 lm_head 新增的行是随机初始化的，这两层通常得整个放开训（PEFT 里写进 `modules_to_save`）。代价不小，两层加起来约 10 亿个参数，放开后每个又回到 16 字节，会多占将近 15 GB 显存。

## QLoRA：把冻结的底座压成 4 bit

用上 LoRA 后，显存里最大头就剩冻结的底座了。既然它只读不改，干脆压缩着存、算到哪层解压哪层，也就是底座存成 4 bit，LoRA 照常用 16 位训。

4 bit 只有 16 个编号，每个权重只能从 16 个离散值里挑，下面把这些值叫做“格子”。对一组权重做量化时，先找出绝对值最大的数 $c$，整组同除以 $c$ 缩进 $[-1,1]$，各自归到最近的格子 $q_j$，只存编号 $j$。用的时候再查表取出 $q_j$ 乘回 $c$：

$$
\hat w=c\cdot q_j,\qquad j=\arg\min_i\,\Big|\,q_i-\frac{w}{c}\,\Big|.
$$

这叫 absmax 量化。先拿 16 个权重走一遍，格子在 $[-1,1]$ 上等距排布（对称摆 15 个，空出一个编号）：

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

原来 16 个数各占 16 bit，量化后每个只剩 4 bit 编号，外加整组共用的一个缩放常数 $c$。

但等距划分的缺陷在图上很明显，中间几格摞着两三个数，外侧大半空着，15 个格子只用上 10 个。训练好的权重大致服从正态分布，小的密集、大的稀少，等距切分等于把不少编号浪费在了没几个数的地方。

这种等距方案就是 INT4。QLoRA 用的 **NF4** 换了排法，按正态分布的分位数定格子，中间密、两头疏，让每格分到的数差不多一样多。下面换成 2,000 组、每组 64 个正态分布的数，对比两种摆法各自的格子利用率：

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

同样是 4 bit 编号，格子用得越平均，单个编号携带的信息越多。统计下来 NF4 平均能用出 3.9 bit，INT4 只有 3.5 bit，而且 NF4 还特意留了一个精确的 0。

点一下图里的“混进一个离群值”就能看到另一个问题：组里只要混进一个大异常值，$c$ 就会被撑大，其余正常的数全被挤进中间几格。所以 QLoRA 每 64 个权重分一块各自算 $c$，让离群值只影响自己那一块。

分块这么细，每块一个 32 位的 $c$ 摊下来每个参数要多占 0.5 bit。QLoRA 又套了一层**双重量化**，把这些 $c$ 每 256 个编成一组量化成 8 bit，均摊开销立刻降到

$$
\frac{8}{64}+\frac{32}{64\times256}\approx0.127\ \text{bit}.
$$

算的时候还是按 16 位算，每层开算前先把 NF4 权重反量化回 BF16：

$$
h=\operatorname{dequant}\big(W_0^{\text{NF4}}\big)\,x+\frac{\alpha}{r}BAx.
$$

所以 QLoRA 省的是显存而不是算力，每层多一次反量化，比普通 LoRA 还慢一点。反向时梯度穿过解压后的权重传给 $A$、$B$，底座自己不动。

另外论文还配了**分页优化器**，遇到特别长的样本导致显存突然冲高时，把优化器状态临时换到 CPU 内存里，不至于直接爆显存。

压完后 8B 底座大概占 5.7 GB，比 16 GB 的四分之一多出一截。按 bitsandbytes 的做法，量化的只有 32 层里的线性层，约 70 亿参数按每个 4.127 bit 算共 3.6 GB；词嵌入和输出层各 5 亿多参数仍保留 16 位存储，又占了 2.1 GB。靠这套组合，论文在一张 48 GB 的卡上微调了 65B 模型，效果追平 16 位微调。

合并时有个细节要留神。$A$、$B$ 是对着量化后的底座学的，补的是量化底座的差。想原样保住训练时的行为，得先把 4 bit 底座反量化回 16 位再合并保存。直接合到原始权重上，底座变了；合完再重新量化一遍，又多吃一次误差。LoftQ 则反过来利用这一点，量化初始化时就挑好 $A$、$B$ 初值，让 $BA$ 先把一部分量化误差补上。

### 拼在一起：回到 24 GB 的卡

把前面几招拼起来，开头那笔账每一行就都有了对策。冻结底座加 LoRA，让梯度、主权重和 Adam 那 112 GB 只剩 $A$、$B$ 的 0.7 GB；底座压成 4 bit，16 GB 缩到 5.7 GB；梯度检查点再把激活压到十几分之一。也能顺带看出为什么 4 bit 只能跟 LoRA 配——16 个格子比 BF16 粗得多，直接在上面更新权重根本走不动。

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

三招全开、一个 batch 4096 个 token（比如 4 条 1024 长的样本）时，总共只要 8 GB 出头。关掉“4 bit 底座”退回普通 LoRA 是 18 GB，在 24 GB 卡上还放得下，但 token 拉到 16384 就只剩 0.3 GB 了。关掉“梯度检查点”更直接，4096 个 token 的激活就将近 25 GB，单这一项便超了整张卡。

这些数是按公式粗算的。真跑起来还有 CUDA 自身占用、显存碎片和临时张量，得再留一两 GB，只剩 0.3 GB 的配置实际往往跑不起来。

## 其他参数高效微调方法

只训一小部分参数，LoRA 并不是头一个。这类方法统称为参数高效微调（parameter-efficient fine-tuning，PEFT 库的名字就是它的缩写），区别在于把可训练参数安在一层的什么位置：

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

早期的 Adapter 是串在主路上的瓶颈小网络，先降到很低维度、过一层非线性，再放大回来。推理时每个 token 都得多穿过它，而且中间夹着非线性，没法并回原权重。LoRA 虽然也是先压后放，但改成了和 $W_0$ 并联且去掉非线性，所以前面那个合并等式才成立。

Prompt Tuning 只在输入最前面拼几个可训练向量，Prefix Tuning 则在每层注意力的 K、V 前都拼几列。它们参数极少，但会占掉上下文长度，训练也不太稳，模型不够大时很难追上全量微调。(IA)$^3$ 只学几个向量来逐元素缩放 K、V 和 MLP 的中间激活，因为全是线性操作，同样能并回权重。

围绕 LoRA 自己也衍生出一串变体，大多只改一处：

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

## 数据准备与 SFT

最常见的微调方式是 SFT（supervised fine-tuning，有监督微调）。数据是一问一答，训练时套用模型自己的聊天模板拼成一条文本，和推理时保持一模一样：

```text
<|im_start|>user
给我的橘猫起个名字，两个字。<|im_end|>
<|im_start|>assistant
橘座<|im_end|>
```

损失一般只算回答部分，把提问对应的标签设成 `-100`，PyTorch 的交叉熵会自动跳过它：

```python
prompt = tok.apply_chat_template(messages[:-1], add_generation_prompt=True)
full = tok.apply_chat_template(messages)
labels = [-100] * len(prompt) + full[len(prompt):]
```

回答末尾的 `<|im_end|>` 一定要算进去，它是告诉模型“说完了”的信号，漏掉它模型往往学会了答却学不会停。常见踩坑是把 pad token 和结束符设成同一个，做 padding mask 时不小心把结束符也一起屏蔽掉了。

多条短样本可以拼进同一条序列（packing）以减少浪费，但要配块对角注意力掩码，别让后一条看见前一条。

微调数据的质量比数量要紧得多。LIMA 只挑了 1,000 条精选问答去微调 65B 的 LLaMA，人工盲测里有 43% 的回答被判不比 GPT-4 差。他们的“表面对齐假说”认为，知识和能力几乎都来自预训练，微调教的是用什么格式和口吻说出来。

反过来，靠微调往里灌新知识往往不划算。2024 年有实验发现，模型原先不知道的事实不仅学得很慢，训进去后还更容易胡编。新知识更适合交给 RAG（先检索资料，再让模型照着答），微调专心管格式、风格和行为。

在窄数据上训久了，原有通用能力容易退化，这就是**灾难性遗忘**。混入一部分通用数据、调低学习率、少训几轮或换用 LoRA 都能缓解。轮数一般 1 到 3 轮就够，验证集损失开始回升就该停了。

## SFT 之后：让模型学会分好坏

SFT 只能模仿示范。很多场景写不出唯一标准答案，却很容易判断两个回答哪个更好，于是数据就成了偏好对：同一个提问 $x$，配一个好回答 $y_w$ 和一个差回答 $y_l$。

最经典的是 **RLHF**。先拿偏好对训一个奖励模型给回答打分，记作 $R(x,y)$（用大写，免得和秩 $r$ 重名）。按 Bradley–Terry 模型，两个回答的分差过一个 sigmoid 就是好回答胜出的概率，训练时让它尽量大：

$$
P(y_w\succ y_l\mid x)=\sigma\big(R(x,y_w)-R(x,y_l)\big).
$$

接着用强化学习（常用 PPO）训语言模型本身，这里叫策略 $\pi$，让它多拿高分的同时别离 SFT 训出的参考模型 $\pi_{\text{ref}}$ 太远：

$$
\max_{\pi}\ \mathbb{E}_{x,\,y\sim\pi(\cdot\mid x)}\big[R(x,y)\big]-\beta\,\mathbb{D}_{\mathrm{KL}}\big(\pi(\cdot\mid x)\,\big\|\,\pi_{\text{ref}}(\cdot\mid x)\big).
$$

KL 项用来约束策略。少了它，策略很容易钻奖励模型的漏洞刷分（reward hacking），因为奖励模型只在见过的分布附近打分靠谱，偏远了拿高分也不代表回答好。

整套 PPO 要同时摆四个模型：策略、参考、奖励，外加 PPO 用来估计基线收益、压低梯度方差的 critic。策略和 critic 都要更新，还得边训边在线生成回答，比 SFT 重得多。

**DPO** 绕开了这套重流程。上面带 KL 约束的目标可以直接写出最优解：

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

$Z(x)$ 是归一化常数，让所有回答的概率加起来等于 1。把式子反解一下，就能用策略表示奖励：

$$
R(x,y)=\beta\log\frac{\pi^*(y\mid x)}{\pi_{\text{ref}}(y\mid x)}+\beta\log Z(x).
$$

代回 Bradley–Terry，两个回答的 $\beta\log Z(x)$ 一减刚好抵消，奖励模型也跟着省掉了。把 $\pi^*$ 换成待训的 $\pi_\theta$，就得到 DPO 的损失：

$$
\mathcal{L}_{\text{DPO}}=-\log\sigma\Big(\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\text{ref}}(y_w\mid x)}-\beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\text{ref}}(y_l\mid x)}\Big).
$$

这样只需要策略和参考两个模型，不用采样也不用 critic，跑起来和 SFT 一样只是普通的前向加反向。论文标题说“你的语言模型暗地里是个奖励模型”，指的正是 $\beta\log\frac{\pi_\theta}{\pi_{\text{ref}}}$ 这一项（下面记作 $\hat R$）。

求梯度时，每个偏好对带一个权重 $\sigma(\hat R_l-\hat R_w)$，已经分对的几乎不更新，分反的学得最用力。$\beta$ 依然控制 KL 约束强度，调大了保守、贴近参考模型，调小了走得远但也更容易过拟合偏好数据，常用 0.1 左右。DPO 的已知毛病是只管拉大相对差距，好回答本身的概率有时也会跟着往下掉。

DeepSeekMath 提出、DeepSeek-R1 拿来训推理的 **GRPO** 又回到了强化学习，但省掉了 critic。同一道题一次生成 $G$ 个回答，把第 $i$ 个回答的得分在同组内做标准化，就是它的优势估计：

$$
\hat A_i=\frac{R_i-\operatorname{mean}(R_1,\dots,R_G)}{\operatorname{std}(R_1,\dots,R_G)}.
$$

优势为正的提高概率，为负的压低概率。奖励也不一定非要靠奖励模型，完全可以直接用规则来算，比如答案对不对、代码能不能跑过测试。

| | 数据 | 训练时要的模型 | 边训边生成 |
| --- | --- | --- | --- |
| SFT | 标准答案 | 策略 | 不要 |
| PPO | 偏好对，先训成奖励模型 | 策略、参考、奖励、critic | 要 |
| DPO | 偏好对 | 策略、参考 | 不要 |
| GRPO | 打分规则 | 策略、参考 | 要，每题一组 |

这些方法都能和 LoRA 一起用，还能顺带省下一份模型显存。比如 DPO 需要策略和参考两个模型，全量训练就是两份权重；用 LoRA 时，参考模型就是卸掉旁路后的原始底座，算参考概率只要临时关掉适配器、拿同一份权重再跑一遍前向即可，第二个模型一个字节都不用多存。

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
