---
title: "傅里叶变换到底在算什么"
description: "从四个数的手算讲起，弄清楚傅里叶变换怎么把混在一起的信号拆成不同频率，再顺着看降噪、压缩、无线通信、医学成像，以及 FFT 和大整数乘法。"
pubDate: 2026-11-17
tags: ["数学", "算法", "信号处理", "C++"]
---

同时按下钢琴上的三个键，麦克风录到的只是一条上下起伏的曲线，每个时刻对应一个数值，三个音早就叠加在一起了。不过调音器依然能认出弹的是哪个音，听歌识曲能匹配到具体的歌，音乐播放器里的均衡器也可以单独拉高或压低低音。这些功能第一步做的事情都是一样的，就是把混成一条的波形拆开，找出里面包含哪些频率，以及每个频率各占多少。

完成这一步的数学工具就是**傅里叶变换**。除了处理声音，它的变体还用在 MP3 和 JPEG 压缩里，Wi-Fi 靠它收发数据，核磁共振靠它重构图像，甚至连两个一百万位大整数的快速乘法都要用到它。

平时在教材里见到傅里叶变换，上来往往就是一个带着 $e^{-i\omega t}$ 的积分公式，刚接触时很难和上面这些应用对上号。下面干脆绕开那个积分，先拿只有四个数的最小例子手算一遍，看看“拆开波形”具体是怎么算出来的，再一步步引入复数和离散傅里叶变换，接着整理它在降噪、压缩、通信和成像里的典型用法，最后写到把它加速的 FFT，并用它实现一次大整数乘法。复数的部分也会顺手从头理一遍，没学过也没关系。

## 信号是一串数

声音在物理上是空气压力随时间的变化。计算机记录声音的做法很直接，就是每隔一段固定的时间测一次气压，把测得的数值存下来，比如 CD 音质每秒记录 44100 次。这样一来，一段声音在程序里就是一串离散的数

$$
x_0,\ x_1,\ x_2,\ \dots,\ x_{n-1}
$$

这个过程叫**采样**。下面提到的“信号”指的都是这样一串数，无论是声音、图像里的一行像素、心电图，还是每天的气温记录，只要能排成一列数，都能按同样的方式处理。

最基本的信号是单个纯音，画出来是一条规律起伏的余弦曲线。确定这样一个波需要三个参数：

- **频率**：起伏的快慢。为了方便讨论，这里直接按“在这 $n$ 个采样里完整起伏了几次”来记，写作 $k$。
- **幅度**：起伏的高度。
- **相位**：波形从哪个位置开始。

如果一个波的频率是 $k$、幅度为 $1$，并且正好从最高点起步，那么它第 $j$ 个采样点的值就是

$$
\cos\frac{2\pi kj}{n}
$$

这里 $2\pi$ 对应一整圈（$360°$）的弧度，$j/n$ 表示当前走到了整段信号的几分之几。乘上 $2\pi$ 就是转过的角度，再乘上 $k$ 相当于转速加快 $k$ 倍，所以 $j$ 从 $0$ 走到 $n$ 时正好转满 $k$ 圈，余弦值也会完整起伏 $k$ 次。

顺带记一下，从最高点开始的是 $\cos$，而往后推迟四分之一圈、从 $0$ 开始往上走的是 $\sin$。

## 把几个波加起来

几个音同时响起时，空气中的压力会直接叠加，录下来的信号也就等于这几个波逐点相加。下图里三条细线分别对应在这段区间内起伏 2 次、5 次、9 次的三个波，粗线是它们叠加后的结果：

```render html
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; --s3: #109d7b; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; --s3: #207b54; }
  .ft .stage { position: relative; }
  .ft canvas { display: block; width: 100%; touch-action: pan-y; }
  .ft .tip { position: absolute; left: 0; top: 0; z-index: 1; padding: 4px 9px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--muted); font-size: 12px; line-height: 1.6; white-space: nowrap; pointer-events: none; }
  .ft .tip b { margin-right: 6px; color: var(--text); font: 600 12px var(--font-mono); }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .knobs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 20px; margin-top: 8px; }
  .ft label { display: grid; grid-template-columns: 1fr auto; align-items: center; color: var(--muted); }
  .ft output { color: var(--text); font: 13px var(--font-mono); }
  .ft input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; }
  @media (max-width: 480px) { .ft .knobs { grid-template-columns: 1fr; } }
</style>
<section class="ft" aria-label="三个不同频率的波逐点相加">
  <div class="stage"><canvas role="img" aria-label="三条细线是三个波，粗线是它们的和"></canvas></div>
  <div class="knobs">
    <label><span><i class="key" style="color: var(--s1)"></i>起伏 2 次</span><output></output><input type="range" min="0" max="100" value="100" aria-label="起伏 2 次的波的幅度" style="accent-color: var(--s1)" /></label>
    <label><span><i class="key" style="color: var(--s2)"></i>起伏 5 次</span><output></output><input type="range" min="0" max="100" value="60" aria-label="起伏 5 次的波的幅度" style="accent-color: var(--s2)" /></label>
    <label><span><i class="key" style="color: var(--s3)"></i>起伏 9 次</span><output></output><input type="range" min="0" max="100" value="40" aria-label="起伏 9 次的波的幅度" style="accent-color: var(--s3)" /></label>
  </div>
</section>
<script>
(() => {
  const root = document.querySelector('.ft'), cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const inputs = [...root.querySelectorAll('input')], outs = [...root.querySelectorAll('output')];
  const freqs = [2, 5, 9], keys = ['s1', 's2', 's3'], TAU = 2 * Math.PI, H = 220, C = {};
  let W = 0, at = null; // at：指针停在这段信号的几分之几处
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'bg', 'rule-strong', 's1', 's2', 's3']) C[key] = s.getPropertyValue('--' + key).trim();
  };
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  const parts = (t) => freqs.map((k, i) => inputs[i].value / 100 * Math.cos(TAU * k * t));
  const total = (t) => parts(t).reduce((sum, v) => sum + v, 0);
  const Y = (v) => H / 2 - v * (H / 2 - 10) / 3;
  const size = () => {
    W = cv.clientWidth;
    const r = window.devicePixelRatio || 1;
    cv.width = Math.round(W * r); cv.height = Math.round(H * r); cv.style.height = H + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0);
  };
  const rule = (x1, y1, x2, y2) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
  };
  const curve = (f, color, width) => {
    ctx.beginPath();
    for (let p = 0; p <= W; p += 2) { if (p) ctx.lineTo(p, Y(f(p / W))); else ctx.moveTo(p, Y(f(p / W))); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const dot = (x, y, color) => {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = color; ctx.fill();
  };
  const draw = () => {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    rule(0, H / 2, W, H / 2);
    freqs.forEach((_, i) => curve((t) => parts(t)[i], C[keys[i]], 1.5));
    curve(total, C.text, 2.5);
    if (at !== null) {
      rule(at * W, 0, at * W, H);
      parts(at).forEach((v, i) => dot(at * W, Y(v), C[keys[i]]));
      dot(at * W, Y(total(at)), C.text);
    }
    outs.forEach((el, i) => { el.textContent = '幅度 ' + (inputs[i].value / 100).toFixed(2); });
  };
  // 指针停在图上时，列出这一处每条线的数值
  const hover = (target, pick) => {
    const tip = target.parentElement.appendChild(Object.assign(document.createElement('div'), { className: 'tip', hidden: true }));
    const show = (event) => {
      const box = target.getBoundingClientRect(), x = event.clientX - box.left;
      tip.replaceChildren(...pick(Math.max(0, Math.min(1, x / box.width))).map(([color, value, label]) => {
        const row = document.createElement('div');
        if (color) row.appendChild(Object.assign(document.createElement('i'), { className: 'key' })).style.color = color;
        row.appendChild(document.createElement('b')).textContent = value;
        row.append(label);
        return row;
      }));
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(0, x + 14 + w > box.width ? x - 14 - w : x + 14) + 'px';
      tip.style.top = Math.max(0, Math.min(box.height - h, event.clientY - box.top - h / 2)) + 'px';
    };
    target.addEventListener('pointermove', show);
    target.addEventListener('pointerdown', show);
    target.addEventListener('pointerleave', () => { tip.hidden = true; pick(null); });
  };
  hover(cv, (f) => {
    at = f; draw();
    return f === null ? null : [...parts(f).map((v, i) => [C[keys[i]], num(v), '起伏 ' + freqs[i] + ' 次']), [C.text, num(total(f)), '它们的和']];
  });
  inputs.forEach((el) => el.addEventListener('input', draw));
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(() => { size(); draw(); }).observe(cv);
})();
</script>
```

叠加后的波形看上去挺杂乱，光盯着粗线，几乎看不出它由哪几个波拼成、各自占多大比例。傅里叶变换要解决的正是反过来的问题：只拿到这条合成后的粗线，把里面三个波各自的幅度还原出来。

## 四个数，手算一遍

先拿一个最小的例子来算，假设信号只有 4 个采样。按照上一节的式子，$\cos(2\pi kj/4)$ 化简后就是 $\cos(kj\cdot90°)$，由此可以写出下面四个基础波形：

| 名字 | 四个采样 | 含义 |
| --- | --- | --- |
| $c_0$ | $1,\ 1,\ 1,\ 1$ | 频率 0，不起伏，决定整体偏置的高低 |
| $c_1$ | $1,\ 0,\ -1,\ 0$ | 频率 1 的 $\cos$ |
| $s_1$ | $0,\ 1,\ 0,\ -1$ | 频率 1 的 $\sin$ |
| $c_2$ | $1,\ -1,\ 1,\ -1$ | 频率 2 的 $\cos$ |

频率 2 的 $\sin$ 在这四个采样点上恰好全是 $0$，起不到作用，所以四个采样点正好对应这四个波。

现在用它们组合出一段信号，比如取 2 份 $c_0$、3 份 $c_1$、1 份 $s_1$，不放 $c_2$，把对应位置相加得到

$$
x=2c_0+3c_1+1s_1=(2+3+0,\ 2+0+1,\ 2-3+0,\ 2+0-1)=(5,\ 3,\ -1,\ 1)
$$

假设我们不知道当初的配比，手里只有最终的 $(5,3,-1,1)$ 这四个数，该怎么把系数 $2,3,1,0$ 算回来？

做法很直接，拿每一个基础波和信号做一次逐项相乘再相加（也就是向量内积）：

$$
\begin{aligned}
x\cdot c_0&=5\times1+3\times1+(-1)\times1+1\times1=8\\
x\cdot c_1&=5\times1+3\times0+(-1)\times(-1)+1\times0=6\\
x\cdot s_1&=5\times0+3\times1+(-1)\times0+1\times(-1)=2\\
x\cdot c_2&=5\times1+3\times(-1)+(-1)\times1+1\times(-1)=0
\end{aligned}
$$

这里的“$\cdot$”就表示逐项相乘再求和。接着再让每个波和自己算一次同样的运算：

$$
c_0\cdot c_0=4,\qquad c_1\cdot c_1=2,\qquad s_1\cdot s_1=2,\qquad c_2\cdot c_2=4
$$

把两组结果对应相除，得到 $8/4=2$、$6/2=3$、$2/2=1$、$0/4=0$，原来的系数就全部找回来了。

之所以这么管用，是因为这四个波彼此**正交**（互不干扰），任意两个不同的波逐项相乘再相加，结果都等于 $0$：

$$
c_0\cdot c_1=1+0-1+0=0,\qquad c_1\cdot s_1=0+0+0+0=0,\qquad c_1\cdot c_2=1+0-1+0=0
$$

另外三对也是一样，动手验一下就能确认。于是当我们拿 $c_1$ 去和信号相乘求和时，把 $x$ 展开来看就会发现：

$$
x\cdot c_1=(2c_0+3c_1+1s_1)\cdot c_1=2\,\underbrace{(c_0\cdot c_1)}_{0}+3\,\underbrace{(c_1\cdot c_1)}_{2}+1\,\underbrace{(s_1\cdot c_1)}_{0}=6
$$

其他频率的分量全部自己抵消成了 $0$，只有信号里属于 $c_1$ 的那一部分被留了下来，结果正好是“系数乘以 $c_1\cdot c_1$”，再除以 $c_1\cdot c_1$ 就还原出了系数本身。

傅里叶变换的核心思路到这里差不多就讲完了。后面要展开的内容都在这个基础上延伸：把 4 个采样推广到一般的 $n$ 个，把 $\cos$ 和 $\sin$ 的两个结果合并成一个复数来记，再想办法把计算速度提上去。

## 推广到更多采样：相乘再求和

采样点变多以后，做法完全一样。想知道信号里有没有频率为 $k$ 的成分，就拿一个频率为 $k$ 的波和信号逐项相乘，再把所有乘积加起来。

```render html
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; }
  .ft .stage { position: relative; }
  .ft canvas { display: block; width: 100%; touch-action: pan-y; }
  .ft .tip { position: absolute; left: 0; top: 0; z-index: 1; padding: 4px 9px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--muted); font-size: 12px; line-height: 1.6; white-space: nowrap; pointer-events: none; }
  .ft .tip b { margin-right: 6px; color: var(--text); font: 600 12px var(--font-mono); }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .box { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 2px; vertical-align: -1px; }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 12px 0 4px; color: var(--muted); font-size: 12px; }
  .ft .cap:first-child { margin-top: 0; }
  .ft .pick { display: flex; align-items: center; gap: 12px; margin-top: 10px; color: var(--muted); }
  .ft .pick input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--s1); }
  .ft .pick output { min-width: 1.5em; color: var(--text); font: 15px var(--font-mono); text-align: right; }
  .ft .read { min-height: 3.2em; margin: 4px 0 0; }
</style>
<section class="ft" aria-label="拿不同频率的波去乘信号，看乘积加起来是多少">
  <p class="cap"><span><i class="key" style="border-top-width: 3px; color: var(--text)"></i>信号</span><span><i class="key" style="color: var(--muted)"></i>拿去对的波</span></p>
  <div class="stage"><canvas class="c1" role="img" aria-label="信号和拿去对的波"></canvas></div>
  <p class="cap"><span>两条线逐点相乘</span><span><i class="box" style="background: var(--s1)"></i>正的部分</span><span><i class="box" style="background: var(--s2)"></i>负的部分</span></p>
  <div class="stage"><canvas class="c2" role="img" aria-label="两条线的乘积"></canvas></div>
  <label class="pick"><span>拿去对的波的频率</span><input type="range" min="0" max="12" value="2" aria-label="拿去对的波的频率" /><output></output></label>
  <p class="read" aria-live="polite"></p>
  <p class="cap">从 0 到 12，每个频率都量一遍，得到的份量</p>
  <div class="stage"><canvas class="c3" role="img" aria-label="各个频率的份量" style="cursor: pointer"></canvas></div>
</section>
<script>
(() => {
  const root = document.querySelector('.ft');
  const [cv1, cv2, cv3] = ['.c1', '.c2', '.c3'].map((s) => root.querySelector(s));
  const slider = root.querySelector('input'), shownK = root.querySelector('output'), read = root.querySelector('.read');
  const N = 64, KMAX = 12, TAU = 2 * Math.PI, SCALE = 25, comps = [[2, 1], [5, .6], [9, .4]], C = {};
  let at = null, over = null; // at：指针在波形上的位置；over：指针指着的那根柱子
  const signal = (t) => comps.reduce((sum, [f, a]) => sum + a * Math.cos(TAU * f * t), 0);
  const wave = (t) => Math.cos(TAU * Number(slider.value) * t);
  const product = (t) => signal(t) * wave(t);
  // 64 个采样，和频率 k 的余弦波逐项相乘再相加
  const sumFor = (k) => {
    let sum = 0;
    for (let j = 0; j < N; j++) sum += signal(j / N) * Math.cos(TAU * k * j / N);
    return sum;
  };
  const share = (k) => Math.max(0, sumFor(k) / (k ? N / 2 : N));
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'muted', 'bg', 'rule', 'rule-strong', 'accent-soft', 's1', 's2']) C[key] = s.getPropertyValue('--' + key).trim();
    C.font = s.fontFamily;
  };
  const fit = (cv, h) => {
    const w = cv.clientWidth, r = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.height = h + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, h);
    return [ctx, w];
  };
  const rule = (ctx, x1, y1, x2, y2) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
  };
  const line = (ctx, w, mid, f, color, width) => {
    ctx.beginPath();
    for (let p = 0; p <= w; p += 2) { const y = mid - f(p / w) * SCALE; if (p) ctx.lineTo(p, y); else ctx.moveTo(p, y); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const dot = (ctx, x, y, color) => {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = color; ctx.fill();
  };
  const draw = () => {
    if (!cv1.clientWidth) return;
    const k = Number(slider.value);
    {
      const h = 120, [ctx, w] = fit(cv1, h);
      rule(ctx, 0, h / 2, w, h / 2);
      line(ctx, w, h / 2, wave, C.muted, 1.5); line(ctx, w, h / 2, signal, C.text, 2.5);
      if (at !== null) {
        rule(ctx, at * w, 0, at * w, h);
        dot(ctx, at * w, h / 2 - wave(at) * SCALE, C.muted); dot(ctx, at * w, h / 2 - signal(at) * SCALE, C.text);
      }
    }
    {
      const h = 120, [ctx, w] = fit(cv2, h);
      for (const [sign, color] of [[1, C.s1], [-1, C.s2]]) {
        ctx.beginPath(); ctx.moveTo(0, h / 2);
        for (let p = 0; p <= w; p += 2) ctx.lineTo(p, h / 2 - sign * Math.max(0, sign * product(p / w)) * SCALE);
        ctx.lineTo(w, h / 2); ctx.closePath();
        ctx.globalAlpha = .35; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
      }
      rule(ctx, 0, h / 2, w, h / 2); line(ctx, w, h / 2, product, C.text, 1.5);
      if (at !== null) { rule(ctx, at * w, 0, at * w, h); dot(ctx, at * w, h / 2 - product(at) * SCALE, C.text); }
    }
    {
      const h = 116, [ctx, w] = fit(cv3, h), step = w / (KMAX + 1), base = h - 24, bar = Math.min(24, step - 2), r = Math.min(4, bar / 2);
      ctx.textAlign = 'center';
      for (let q = 0; q <= KMAX; q++) {
        const x = step * (q + .5), top = share(q) * (base - 8);
        if (q === k || q === over) { ctx.fillStyle = q === k ? C['accent-soft'] : C.rule; ctx.fillRect(x - step / 2, 0, step, base); }
        if (top > .5) {
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x - bar / 2, base - top, bar, top, [r, r, 0, 0]); else ctx.rect(x - bar / 2, base - top, bar, top);
          ctx.fillStyle = C.s1; ctx.fill();
        }
        ctx.font = (q === k ? '600 ' : '') + '12px ' + C.font;
        ctx.fillStyle = q === k ? C.text : C.muted;
        ctx.fillText(String(q), x, h - 7);
      }
      rule(ctx, 0, base, w, base);
    }
    const sum = sumFor(k), unit = k ? N / 2 : N;
    shownK.textContent = k;
    read.innerHTML = '64 个采样上的乘积加起来是 <b>' + num(sum) + '</b>，除以 ' + unit + '，这个频率的份量是 <b>' + num(sum / unit) + '</b>。'
      + (Math.abs(sum) < .005 ? '正的和负的正好抵消：信号里没有这个频率。' : '波峰对着波峰，波谷对着波谷，乘积大多是正的。');
  };
  // 指针停在图上时，列出这一处的数值
  const hover = (target, pick) => {
    const tip = target.parentElement.appendChild(Object.assign(document.createElement('div'), { className: 'tip', hidden: true }));
    const show = (event) => {
      const box = target.getBoundingClientRect(), x = event.clientX - box.left;
      tip.replaceChildren(...pick(Math.max(0, Math.min(1, x / box.width))).map(([color, value, label]) => {
        const row = document.createElement('div');
        if (color) row.appendChild(Object.assign(document.createElement('i'), { className: 'key' })).style.color = color;
        row.appendChild(document.createElement('b')).textContent = value;
        row.append(label);
        return row;
      }));
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(0, x + 14 + w > box.width ? x - 14 - w : x + 14) + 'px';
      tip.style.top = Math.max(0, Math.min(box.height - h, event.clientY - box.top - h / 2)) + 'px';
    };
    target.addEventListener('pointermove', show);
    target.addEventListener('pointerdown', show);
    target.addEventListener('pointerleave', () => { tip.hidden = true; pick(null); });
  };
  const point = (f) => {
    at = f; draw();
    return f === null ? null : [[C.text, num(signal(f)), '信号'], [C.muted, num(wave(f)), '拿去对的波'], [null, num(product(f)), '两个数的乘积']];
  };
  hover(cv1, point); hover(cv2, point);
  hover(cv3, (f) => {
    over = f === null ? null : Math.min(KMAX, Math.floor(f * (KMAX + 1))); draw();
    return f === null ? null : [[null, num(share(over)), '频率 ' + over + ' 的份量']];
  });
  cv3.addEventListener('click', (event) => {
    const box = cv3.getBoundingClientRect();
    slider.value = Math.min(KMAX, Math.floor((event.clientX - box.left) / box.width * (KMAX + 1)));
    draw();
  });
  slider.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(cv1);
})();
</script>
```

这里沿用前面那三个波叠加出来的信号，幅度分别为 1、0.6、0.4，一共取了 64 个采样。拖动滑块改变图里“拿去对的波”的频率，会看到结果分成两种情况：

- 当它的频率正好命中信号里存在的成分（2、5、9）时，信号里对应的那一部分和它同起同落，波峰乘波峰得正，波谷乘波谷同样得正，累加之后就会得到一个明显的大数。至于信号里混着的其他频率，和它步调不一致，乘积正负相消，对总和没有贡献。
- 当信号里没有这个频率时，乘积正负各占一半，最后加起来刚好是 $0$。

和四个采样的例子一样，算出来的总和还要除以这个波与自身逐项相乘再求和的结果。对于一般的频率 $k$，因为 $\cos^2$ 在整周期上的平均值是 $1/2$，这个值是 $n/2$。只有 $k=0$ 和 $k=n/2$ 这两个端点例外，此时波的每一项要么是 $1$ 要么是 $-1$，平方之后全是 $1$，加起来等于 $n$（前面的 $c_0$ 和 $c_2$ 就是这种情况）。因此对中间的频率 $k$，有

$$
\text{频率 }k\text{ 的份量}=\frac{2}{n}\sum_{j=0}^{n-1}x_j\cos\frac{2\pi kj}{n}
$$

把各个频率依次算完，就得到图最下方那排柱子，在 2、5、9 三个位置上高度正好是 1、0.6、0.4，其余位置全是 0。三个波的幅度就这么从合成曲线里提取出来了，这一排柱子叫做信号的**频谱**。

## 相位：一把尺子不够

前面举的例子有个前提，三个波都是从最高点开始的，所以只用 $\cos$ 就能量准。但实际信号里的波，起点落到哪里都有可能。

```render html
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; }
  .ft .view { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 16px; align-items: end; }
  .ft canvas { display: block; width: 100%; }
  .ft .plane { touch-action: none; cursor: grab; }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 0 0 4px; color: var(--muted); font-size: 12px; }
  .ft .knobs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; margin-top: 8px; }
  .ft label { display: grid; grid-template-columns: 1fr auto; align-items: center; color: var(--muted); }
  .ft output { color: var(--text); font: 13px var(--font-mono); }
  .ft input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--s1); }
  .ft .read { min-height: 4.8em; margin: 6px 0 0; }
  @media (max-width: 520px) {
    .ft .view { grid-template-columns: 1fr; }
    .ft .plane { max-width: 190px; margin-inline: auto; }
    .ft .knobs { grid-template-columns: 1fr; }
  }
</style>
<section class="ft" aria-label="同一个波挪动起点，两个读数跟着变">
  <div class="view">
    <div>
      <p class="cap"><span><i class="key" style="border-top-width: 3px; color: var(--text)"></i>要量的波</span><span><i class="key" style="border-top-style: dashed; color: var(--muted)"></i>没挪动时的位置</span></p>
      <canvas class="wave" role="img" aria-label="要量的波；虚线是它没有挪动时的位置"></canvas>
    </div>
    <canvas class="plane" role="img" aria-label="两个读数画成平面上的一个点"></canvas>
  </div>
  <div class="knobs">
    <label><span>波的起点往后挪</span><output class="po"></output><input class="ph" type="range" min="0" max="360" step="5" value="60" aria-label="起点往后挪的角度" /></label>
    <label><span>波的幅度</span><output class="ao"></output><input class="am" type="range" min="20" max="100" step="5" value="100" aria-label="波的幅度" /></label>
  </div>
  <p class="read" aria-live="polite"></p>
</section>
<script>
(() => {
  const root = document.querySelector('.ft');
  const wave = root.querySelector('.wave'), plane = root.querySelector('.plane');
  const ph = root.querySelector('.ph'), am = root.querySelector('.am'), read = root.querySelector('.read');
  const N = 64, F = 3, TAU = 2 * Math.PI, C = {};
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'muted', 'bg', 'rule-strong', 's1', 's2']) C[key] = s.getPropertyValue('--' + key).trim();
  };
  const fit = (cv, h) => {
    const w = cv.clientWidth, r = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.height = h + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, h);
    return [ctx, w];
  };
  const seg = (ctx, x1, y1, x2, y2, color, width) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  };
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  const draw = () => {
    if (!wave.clientWidth) return;
    const shift = ph.value * Math.PI / 180, amp = am.value / 100;
    const x = (t) => amp * Math.cos(TAU * F * t - shift);
    // 两把尺子：和 cos、sin 各逐项相乘再相加，再除以 n/2
    let a = 0, b = 0;
    for (let j = 0; j < N; j++) {
      a += x(j / N) * Math.cos(TAU * F * j / N);
      b += x(j / N) * Math.sin(TAU * F * j / N);
    }
    a /= N / 2; b /= N / 2;
    {
      const h = 150, [ctx, w] = fit(wave, h), scale = h / 2 - 12;
      seg(ctx, 0, h / 2, w, h / 2, C['rule-strong'], 1);
      const path = (f, color, width, dash) => {
        ctx.beginPath();
        for (let p = 0; p <= w; p += 2) { const y = h / 2 - f(p / w) * scale; if (p) ctx.lineTo(p, y); else ctx.moveTo(p, y); }
        ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
      };
      path((t) => amp * Math.cos(TAU * F * t), C.muted, 1.5, [5, 4]);
      path(x, C.text, 2.5, []);
    }
    {
      const [ctx, w] = fit(plane, plane.clientWidth), c = w / 2, unit = w / 2 - 14;
      seg(ctx, 0, c, w, c, C['rule-strong'], 1); seg(ctx, c, 0, c, w, C['rule-strong'], 1);
      ctx.beginPath(); ctx.arc(c, c, unit * amp, 0, TAU);
      ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
      const px = c + a * unit, py = c - b * unit;
      seg(ctx, c, c, px, py, C.text, 1.5);
      seg(ctx, c, c, px, c, C.s2, 3); seg(ctx, px, c, px, py, C.s1, 3);
      ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fillStyle = C.text; ctx.fill();
    }
    root.querySelector('.po').textContent = ph.value + '°';
    root.querySelector('.ao').textContent = amp.toFixed(2);
    read.innerHTML = '<i class="key" style="color: var(--s2)"></i>$\\cos$ 的读数是 <b>' + num(a) + '</b>，<i class="key" style="color: var(--s1)"></i>$\\sin$ 的读数是 <b>' + num(b)
      + '</b>。把它们当成一个点的横、纵坐标：这个点到原点的距离是 <b>' + num(Math.hypot(a, b)) + '</b>，正是幅度；它的方向转过了 <b>' + ph.value + '°</b>，正是起点挪动的角度。';
  };
  // 平面上的点可以直接拖：方向定起点，离原点多远定幅度
  const grab = (event) => {
    if (!event.buttons && event.pointerType === 'mouse') return;
    const box = plane.getBoundingClientRect(), c = box.width / 2, unit = c - 14;
    const dx = (event.clientX - box.left - c) / unit, dy = (c - (event.clientY - box.top)) / unit;
    ph.value = (Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 5) * 5 + 360) % 360;
    am.value = Math.round(Math.hypot(dx, dy) * 20) * 5;
    draw();
  };
  plane.addEventListener('pointerdown', (event) => { plane.setPointerCapture(event.pointerId); grab(event); });
  plane.addEventListener('pointermove', (event) => { if (plane.hasPointerCapture(event.pointerId)) grab(event); });
  ph.addEventListener('input', draw); am.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(root.querySelector('.view'));
})();
</script>
```

如果把波的起点往后挪，$\cos$ 测出来的读数会跟着变小，挪到 $90°$（也就是四分之一圈）时，读数干脆掉成了 $0$，可这个波本身还在，幅度一点没少。此时它变成了 $\sin$ 波，得换用 $\sin$ 才能量出来。

因此每个频率都需要测两次，分别用 $\cos$ 和 $\sin$ 各算一遍。只要拿到这两个读数，这个波的信息就完整了，因为无论起点偏了多少，由三角函数的和角公式可知，它总能拆成一个 $\cos$ 和一个 $\sin$ 的线性组合：

$$
A\cos(\theta-\varphi)=\underbrace{A\cos\varphi}_{\cos\text{ 的读数}}\cdot\cos\theta+\underbrace{A\sin\varphi}_{\sin\text{ 的读数}}\cdot\sin\theta
$$

其中 $A$ 是幅度，$\varphi$ 是起点往后平移的角度。

图里带十字线的区域，把这两个读数画成了二维平面上的一个点，横坐标对应 $\cos$ 的读数，纵坐标对应 $\sin$ 的读数。起点挪动时，这个点会沿着圆周旋转，到原点的距离始终等于幅度；一旦幅度变化，圆的半径也会跟着伸缩。也就是说，点到原点的距离代表这个频率有多强，它所在的方向则记录了波形的起始相位。

算下来，单个频率对应的结果正好是平面上的一个点。而用一个数直接表示平面上的点，正是复数派上用场的地方。

## 复数：平面上的点

引入一个新的数 $i$，规定它满足 $i^2=-1$。形如 $a+bi$ 的数称为**复数**，其中 $a$、$b$ 是普通实数，分别叫做实部和虚部。

实数可以排在一条数轴上，复数多了一个分量 $b$，一条直线装不下，需要放到二维平面里，把 $a+bi$ 对应到坐标 $(a,b)$ 的点。普通实数全落在横轴上，$i$ 在原点正上方一格。

复数的加减乘法沿用普通多项式的展开规则就行，只需要在碰到 $i^2$ 时替换成 $-1$：

$$
\begin{aligned}
(a+bi)+(c+di)&=(a+c)+(b+d)i\\
(a+bi)(c+di)&=ac+adi+bci+bdi^2=(ac-bd)+(ad+bc)i
\end{aligned}
$$

例如 $(2+i)(4+3i)=8+6i+4i+3i^2=8+10i-3=5+10i$。

在平面上看，复数乘法有非常直观的几何意义。除了用直角坐标 $(a,b)$，一个复数也可以由另外两个量确定：它到原点的距离（**模长**，后面也直接叫长度），以及从横轴正方向逆时针转到它的**角度**。

> [!IMPORTANT]
> 两个复数相乘，结果的长度是两者长度相乘，角度是两者角度相加。

可以先拿 $i$ 验证一下。$i$ 的长度是 $1$、角度是 $90°$，按这条规则，乘以 $i$ 应该保持长度不变、逆时针旋转 $90°$。代入代数式算一下，$(a+bi)\cdot i=ai+bi^2=-b+ai$，坐标从 $(a,b)$ 变成了 $(-b,a)$，确实转了 $90°$。顺着这个思路看，$i\cdot i$ 相当于从 $1$ 出发连续转两次 $90°$，刚好转到反方向的 $-1$，于是 $i^2=-1$ 在几何上也就顺理成章了。

> [!PROOF]- 点开看一般情况的证明
> 长度为 $r$、角度为 $\theta$ 的复数，横坐标是 $r\cos\theta$，纵坐标是 $r\sin\theta$，可以写作 $r(\cos\theta+i\sin\theta)$。把两个这样的复数相乘：
>
> $$
> \begin{aligned}
> &r_1(\cos\alpha+i\sin\alpha)\cdot r_2(\cos\beta+i\sin\beta)\\
> ={}&r_1r_2\bigl[(\cos\alpha\cos\beta-\sin\alpha\sin\beta)+i(\sin\alpha\cos\beta+\cos\alpha\sin\beta)\bigr]\\
> ={}&r_1r_2\bigl[\cos(\alpha+\beta)+i\sin(\alpha+\beta)\bigr]
> \end{aligned}
> $$
>
> 最后一步用到的还是和角公式，结果的长度是 $r_1r_2$，角度是 $\alpha+\beta$。

长度为 $1$ 的复数全落在以原点为圆心、半径为 $1$ 的圆上，这个圆叫做**单位圆**。两个单位圆上的复数相乘，长度依然是 $1$，变化的只有角度，所以在单位圆上做乘法等价于旋转。

### 转圈的点

单位圆上角度为 $\theta$ 的点写作 $\cos\theta+i\sin\theta$。让 $\theta$ 匀速增大，这个点就会沿着圆周匀速旋转，它在横轴上的投影画出 $\cos$ 波，在纵轴上的投影画出 $\sin$ 波。$\cos$ 和 $\sin$ 两条曲线，正是同一个圆周运动在两个坐标轴上的投影。

接下来把圆周平均分成 $n$ 等份，从 $1$ 出发逆时针数的第一个等分点记作 $\omega$（希腊字母 omega）：

$$
\omega=\cos\frac{2\pi}{n}+i\sin\frac{2\pi}{n}
$$

因为复数相乘等于角度相加，$\omega^2$ 就是第二个点，$\omega^k$ 是第 $k$ 个点，转到 $\omega^n$ 时刚好绕满一圈回到 $1$。下图是 $n=8$ 时的分布：

```render svg title="$n=8$：圆上均匀排开的八个点，相邻两个隔 $45°$。虚线和实心的点，讲 FFT 时要用"
<svg viewBox="0 0 360 296" width="360" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="var(--rule-strong)" stroke-width="1.5">
    <circle cx="180" cy="148" r="96" />
    <path d="M276 148L84 148M247.9 80.1L112.1 215.9M180 52L180 244M112.1 80.1L247.9 215.9" stroke-dasharray="4 5" />
  </g>
  <path d="M208 148A28 28 0 0 0 199.8 128.2" fill="none" stroke="var(--muted)" stroke-width="1.5" />
  <text x="214" y="140" fill="var(--muted)" font-size="12">45°</text>
  <g fill="var(--bg)" stroke="currentColor" stroke-width="2">
    <circle cx="247.9" cy="80.1" r="6" />
    <circle cx="112.1" cy="80.1" r="6" />
    <circle cx="112.1" cy="215.9" r="6" />
    <circle cx="247.9" cy="215.9" r="6" />
  </g>
  <g fill="currentColor" stroke="currentColor" stroke-width="2">
    <circle cx="276" cy="148" r="6" />
    <circle cx="180" cy="52" r="6" />
    <circle cx="84" cy="148" r="6" />
    <circle cx="180" cy="244" r="6" />
  </g>
  <g fill="currentColor" font-size="15">
    <text x="288" y="153">ω<tspan dy="-6" font-size="11">0</tspan><tspan dy="6"> = 1</tspan></text>
    <text x="259" y="74">ω<tspan dy="-6" font-size="11">1</tspan></text>
    <text x="180" y="36" text-anchor="middle">ω<tspan dy="-6" font-size="11">2</tspan><tspan dy="6"> = i</tspan></text>
    <text x="101" y="74" text-anchor="end">ω<tspan dy="-6" font-size="11">3</tspan></text>
    <text x="72" y="153" text-anchor="end">ω<tspan dy="-6" font-size="11">4</tspan><tspan dy="6"> = −1</tspan></text>
    <text x="101" y="234" text-anchor="end">ω<tspan dy="-6" font-size="11">5</tspan></text>
    <text x="180" y="272" text-anchor="middle">ω<tspan dy="-6" font-size="11">6</tspan><tspan dy="6"> = −i</tspan></text>
    <text x="259" y="234">ω<tspan dy="-6" font-size="11">7</tspan></text>
  </g>
</svg>
```

这 $n$ 个点的 $n$ 次方都等于 $1$，因此叫做 **$n$ 次单位根**。它们的指数是按圆周循环的，满足 $\omega^{k+n}=\omega^k$，反方向顺时针转的 $\omega^{-k}$ 也等价于 $\omega^{n-k}$。

有了这个记号，前面的波形可以写得紧凑很多。$\omega^{jk}$ 的角度是 $jk$ 份 $2\pi/n$，展开就是

$$
\omega^{jk}=\cos\frac{2\pi kj}{n}+i\sin\frac{2\pi kj}{n}
$$

固定频率 $k$，让 $j$ 从 $0$ 递增到 $n-1$，这个点每步向前走 $k$ 格，走完全程刚好绕圆 $k$ 圈。它的横坐标正好是频率 $k$ 的 $\cos$ 波，纵坐标则是频率 $k$ 的 $\sin$ 波，前面用来测量的两把尺子就都包进这一个式子里了。

> [!NOTE]
> 很多资料里会把 $\cos\theta+i\sin\theta$ 简记成 $e^{i\theta}$，也就是欧拉公式。读这篇笔记时不需要深究它的推导，把它当成“单位圆上角度为 $\theta$ 的点”的记号就够用了。

## 离散傅里叶变换

现在把 $\cos$ 和 $\sin$ 两个读数合进同一个复数里，实部放 $\cos$ 的结果，虚部放 $\sin$ 的结果并添上一个负号：

$$
X_k=\sum_{j=0}^{n-1}x_j\cos\frac{2\pi kj}{n}-i\sum_{j=0}^{n-1}x_j\sin\frac{2\pi kj}{n}
=\sum_{j=0}^{n-1}x_j\,\omega^{-jk}
$$

这就是**离散傅里叶变换**（Discrete Fourier Transform，简称 DFT）。输入 $n$ 个采样 $x_0,\dots,x_{n-1}$，算出来是 $n$ 个复数 $X_0,\dots,X_{n-1}$，其中第 $k$ 个复数 $X_k$ 记录了信号里频率为 $k$ 的成分。

式子里的负号是因为相乘用的是顺时针旋转的点 $\omega^{-jk}$，为什么要取顺时针，看完下面的例子和拆解就明白了。另外这里暂时没有除以 $n/2$ 或 $n$，惯例是把归一化留到逆变换的时候统一处理。

### 手算一遍

接着用前面那组 $x=(5,3,-1,1)$ 来验算。当 $n=4$ 时，$\omega=i$，$\omega^{-1}=-i$，它的各次幂依次是 $1,-i,-1,i$，之后每四项循环一次。把每个采样 $x_j$ 乘以 $(\omega^{-k})^j$ 再求和：

$$
\begin{aligned}
X_0&=5+3+(-1)+1=8\\
X_1&=5\cdot1+3\cdot(-i)+(-1)\cdot(-1)+1\cdot i=6-2i\\
X_2&=5\cdot1+3\cdot(-1)+(-1)\cdot1+1\cdot(-1)=0\\
X_3&=5\cdot1+3\cdot i+(-1)\cdot(-1)+1\cdot(-i)=6+2i
\end{aligned}
$$

和前面拆开算的实数结果对照一下，$X_0=8$ 就是 $x\cdot c_0$，$X_1=6-2i$ 的实部 $6$ 对应 $x\cdot c_1$，虚部 $-2$ 去掉符号正好是 $x\cdot s_1$，$X_2=0$ 对应 $x\cdot c_2$。算出来的还是同一批数，只是打包进了复数的实部和虚部里。

### 把各项当成箭头首尾相加

求和式里的每一项 $x_j\,\omega^{-jk}$ 都可以看成复平面上的一个向量（箭头）。它的方向由 $\omega^{-jk}$ 决定，从横轴正方向开始顺时针转，每往后走一个采样就多转 $k$ 格；长度则是 $x_j$，如果采样值为负，方向就反向 $180°$。最终的 $X_k$ 就是把这 $n$ 个箭头首尾相接后停下的终点位置。

下图里的信号共有 32 个采样，由两个波叠加而成：一个频率为 3、幅度为 1、起点往后挪了 $60°$，另一个频率为 7、幅度为 0.6。为了方便和原始幅度直接对比，图里把每个箭头都缩小到了原来的 $1/16$（也就是先除以了 $n/2$）：

```render html
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; }
  .ft .view { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 16px; align-items: end; }
  .ft canvas { display: block; width: 100%; }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 0 0 4px; color: var(--muted); font-size: 12px; }
  .ft .knobs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; margin-top: 8px; }
  .ft label { display: grid; grid-template-columns: 1fr auto; align-items: center; color: var(--muted); }
  .ft output { color: var(--text); font: 13px var(--font-mono); }
  .ft input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--s1); }
  .ft .foot { display: flex; flex-wrap: wrap; align-items: start; gap: 4px 20px; margin-top: 6px; }
  .ft .read { flex: 1; min-width: 220px; min-height: 4.8em; margin: 0; }
  .ft button { min-height: 36px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule-strong); background: none; color: var(--accent-ink); font-size: 14px; cursor: pointer; }
  @media (max-width: 520px) {
    .ft .view { grid-template-columns: 1fr; }
    .ft .plane { max-width: 210px; margin-inline: auto; }
    .ft .knobs { grid-template-columns: 1fr; }
  }
</style>
<section class="ft" aria-label="把每个采样转过一个角度，再首尾相接地加起来">
  <div class="view">
    <div>
      <p class="cap"><span><i class="key" style="color: var(--s1)"></i>已经加进去的采样</span><span><i class="key" style="border-top-width: 3px; color: var(--text)"></i>刚加的一个</span></p>
      <canvas class="wave" role="img" aria-label="32 个采样"></canvas>
    </div>
    <canvas class="plane" role="img" aria-label="每个采样变成一个箭头，首尾相接；圆的半径是 1"></canvas>
  </div>
  <div class="knobs">
    <label><span>要量的频率 $k$</span><output class="ko"></output><input class="k" type="range" min="0" max="16" value="3" aria-label="要量的频率" /></label>
    <label><span>加到第几个采样</span><output class="mo"></output><input class="m" type="range" min="1" max="32" value="32" aria-label="加到第几个采样" /></label>
  </div>
  <div class="foot">
    <p class="read" aria-live="polite"></p>
    <button type="button">从第一个采样加起</button>
  </div>
</section>
<script>
(() => {
  const root = document.querySelector('.ft');
  const wave = root.querySelector('.wave'), plane = root.querySelector('.plane');
  const kIn = root.querySelector('.k'), mIn = root.querySelector('.m'), read = root.querySelector('.read');
  const N = 32, TAU = 2 * Math.PI, C = {};
  // 两个波的和：频率 3、幅度 1、起点往后挪 60°；频率 7、幅度 0.6
  const signal = (t) => Math.cos(TAU * 3 * t - Math.PI / 3) + .6 * Math.cos(TAU * 7 * t);
  const x = Array.from({ length: N }, (_, j) => signal(j / N));
  let timer = 0;
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'muted', 'bg', 'rule-strong', 's1']) C[key] = s.getPropertyValue('--' + key).trim();
  };
  const fit = (cv, h) => {
    const w = cv.clientWidth, r = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.height = h + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, h);
    return [ctx, w];
  };
  const seg = (ctx, x1, y1, x2, y2, color, width) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  };
  const disc = (ctx, px, py, r, color) => { ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fillStyle = color; ctx.fill(); };
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  const complex = (re, im) => Math.abs(im) < .005 ? num(re) : num(re) + (im < 0 ? ' − ' : ' + ') + num(Math.abs(im)) + 'i';
  const draw = () => {
    if (!wave.clientWidth) return;
    const k = Number(kIn.value), m = Number(mIn.value);
    // 前 m 个箭头首尾相接：第 j 个是 x_j·ω^(-jk)，画的时候缩小到 1/16
    const pts = [[0, 0]];
    for (let j = 0; j < m; j++) {
      const turn = -TAU * j * k / N;
      pts.push([pts[j][0] + x[j] * Math.cos(turn) / (N / 2), pts[j][1] + x[j] * Math.sin(turn) / (N / 2)]);
    }
    {
      const h = 170, [ctx, w] = fit(wave, h), scale = (h / 2 - 10) / 1.6, X = (j) => (j + .5) / N * w;
      seg(ctx, 0, h / 2, w, h / 2, C['rule-strong'], 1);
      ctx.beginPath();
      for (let p = 0; p <= w; p += 2) { const y = h / 2 - signal(p / w - .5 / N) * scale; if (p) ctx.lineTo(p, y); else ctx.moveTo(p, y); }
      ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
      for (let j = 0; j < N; j++) {
        const last = j === m - 1, color = last ? C.text : j < m ? C.s1 : C['rule-strong'], y = h / 2 - x[j] * scale;
        seg(ctx, X(j), h / 2, X(j), y, color, last ? 3 : 1.5);
        disc(ctx, X(j), y, last ? 4 : 2.5, color);
      }
    }
    {
      const [ctx, w] = fit(plane, plane.clientWidth), c = w / 2, unit = (c - 10) / 1.25;
      const P = ([re, im]) => [c + re * unit, c - im * unit];
      seg(ctx, 0, c, w, c, C['rule-strong'], 1); seg(ctx, c, 0, c, w, C['rule-strong'], 1);
      ctx.beginPath(); ctx.arc(c, c, unit, 0, TAU); ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      pts.forEach((p, j) => { const [px, py] = P(p); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
      pts.forEach((p) => disc(ctx, ...P(p), 1.75, C.s1));
      seg(ctx, ...P(pts[m - 1]), ...P(pts[m]), C.text, 3);
      disc(ctx, ...P(pts[m]), 7, C.bg); disc(ctx, ...P(pts[m]), 5, C.text);
    }
    const re = pts[m][0] * N / 2, im = pts[m][1] * N / 2, size = Math.hypot(re, im);
    const angle = Math.round(Math.atan2(im, re) * 180 / Math.PI);
    root.querySelector('.ko').textContent = k;
    root.querySelector('.mo').textContent = m;
    read.innerHTML = m < N
      ? '前 ' + m + ' 个采样加起来，走到了 <b>' + complex(re, im) + '</b>。'
      : size < .005
        ? '32 个箭头绕回了原点，$X_{' + k + '}$ 是 <b>0</b>：信号里没有这个频率。'
        : '32 个箭头的终点是 $X_{' + k + '}$，等于 <b>' + complex(re, im) + '</b>，长度 <b>' + num(size) + '</b>。除以 16，幅度是 <b>' + num(size / 16) + '</b>；方向'
          + (angle ? '在横轴' + (angle < 0 ? '下方' : '上方') + ' <b>' + Math.abs(angle) + '°</b>。' : '正好沿着横轴。');
  };
  root.querySelector('button').addEventListener('click', () => {
    clearInterval(timer);
    mIn.value = 1; draw();
    timer = setInterval(() => {
      if (Number(mIn.value) >= N) return clearInterval(timer);
      mIn.value = Number(mIn.value) + 1; draw();
    }, 80);
  });
  kIn.addEventListener('input', draw);
  mIn.addEventListener('input', () => { clearInterval(timer); draw(); });
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(root.querySelector('.view'));
})();
</script>
```

把频率调到 3 时，箭头虽然一路小幅摆动，但总体始终朝着同一个方向前进，最后停在半径为 1 的圆上、横轴下方 $60°$ 的位置，幅度和相位一下就读出来了。调到频率 7 时，终点正好落在横轴上距原点 0.6 的地方。而选其他频率时，箭头绕了一大圈又回到了原点。

背后的原因从 $\cos$ 的复数表达式里一眼就能看出来。一个逆时针转的点和一个顺时针转的点，纵坐标正好相反、横坐标完全相同，两者相加除以 2 后虚部抵消，只留下横坐标：

$$
\cos\frac{2\pi kj}{n}=\frac{\omega^{jk}+\omega^{-jk}}{2}
$$

也就是说，一条 $\cos$ 波可以拆成两个反向旋转的点各占一半。当我们乘上 $\omega^{-jk}$ 时，逆时针转的那一半 $\omega^{jk}$ 刚好被抵消掉转速（$\omega^{jk}\cdot\omega^{-jk}=1$），每一步都稳定指向同一个方向，累加 $n$ 步后正好攒出 $n/2$ 倍的幅度；顺时针的那一半则变成了 $\omega^{-2jk}$，转得更急，绕满整圈后彼此抵消。至于信号里别的频率，两半都在不停旋转，最后也全部抵消为 $0$。

定义式里加这个负号，就是为了用顺时针旋转把目标频率的逆时针分量“转停”，让它原地累加起来。而换算幅度时要除以 $n/2$ 而不是 $n$，是因为 $X_k$ 只截住了这个余弦波的一半，另一半落在对称位置 $X_{n-k}$ 上。

### 怎么解读结果

- $X_k$ 的**长度**表示对应频率有多强，**角度**记录了这个波的起始相位。比如前面算出的 $X_1=6-2i$，长度是 $\sqrt{6^2+2^2}\approx6.32$。
- 还原实际幅度需要除以 $n/2$，即 $6.32\div2=3.16$。对照原始配方，频率 1 由 3 份 $\cos$ 和 1 份 $\sin$ 合成，幅度刚好是 $\sqrt{3^2+1^2}\approx3.16$。
- 零频项 $X_0$ 除以 $n$ 是整段信号的平均值，这里 $8\div4=2$。
- **后半段是前半段的共轭镜像**。前面算出来的 $X_3=6+2i$ 和 $X_1=6-2i$ 只有虚部符号相反，因为 $\omega^{-3}=\omega^{1}$，在只有 4 个采样时，“顺时针每次走 3 格”和“逆时针每次走 1 格”踩在完全相同的点上，根本区分不开。只要原始信号是实数，$X_{n-k}$ 总是 $X_k$ 关于横轴对称的复共轭，真正包含独立信息的只有 $X_0$ 到 $X_{n/2}$ 这一半。
- 由此也能看出，$n$ 个采样最高只能分辨到频率 $n/2$，一次完整的起伏至少要采到两个点，才看得出它在波动。

关于前后镜像这件事，用图看会更直观。下面取 8 个采样点，对比频率 $k$ 和频率 $8-k$ 两条 $\cos$ 曲线：

```render html
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; }
  .ft canvas { display: block; width: 100%; }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--text); }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 0 0 4px; color: var(--muted); font-size: 12px; }
  .ft .pick { display: flex; align-items: center; gap: 12px; margin-top: 8px; color: var(--muted); }
  .ft .pick input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--s1); }
  .ft .pick output { min-width: 1.5em; color: var(--text); font: 15px var(--font-mono); text-align: right; }
  .ft .read { min-height: 3.2em; margin: 4px 0 0; }
  .ft .read span { font-family: var(--font-mono); }
</style>
<section class="ft" aria-label="两个不同频率的波经过同样的八个采样点">
  <p class="cap"><span><i class="key" style="color: var(--s1)"></i>频率 <b class="a"></b></span><span><i class="key" style="border-top-style: dashed; color: var(--s2)"></i>频率 <b class="b"></b></span><span><i class="dot"></i>8 个采样</span></p>
  <canvas role="img" aria-label="两条余弦曲线和它们共同经过的八个采样点"></canvas>
  <label class="pick"><span>频率 $k$</span><input type="range" min="0" max="4" value="3" aria-label="频率 k" /><output></output></label>
  <p class="read" aria-live="polite"></p>
</section>
<script>
(() => {
  const root = document.querySelector('.ft'), cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const slider = root.querySelector('input'), read = root.querySelector('.read');
  const N = 8, TAU = 2 * Math.PI, H = 150, C = {};
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'bg', 'rule-strong', 's1', 's2']) C[key] = s.getPropertyValue('--' + key).trim();
  };
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  const draw = () => {
    const w = cv.clientWidth, r = window.devicePixelRatio || 1;
    if (!w) return;
    cv.width = Math.round(w * r); cv.height = Math.round(H * r); cv.style.height = H + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, H);
    const k = Number(slider.value), pad = 8, X = (t) => pad + t * (w - 2 * pad), Y = (v) => H / 2 - v * (H / 2 - 12);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(w, H / 2); ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
    const curve = (f, color, width, dash) => {
      ctx.beginPath();
      for (let p = 0; p <= 400; p++) { const t = p / 400; if (p) ctx.lineTo(X(t), Y(Math.cos(TAU * f * t))); else ctx.moveTo(X(t), Y(1)); }
      ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]);
    };
    curve(N - k, C.s2, 1.5, [5, 4]); curve(k, C.s1, 2.5, []);
    const values = Array.from({ length: N }, (_, j) => Math.cos(TAU * k * j / N));
    values.forEach((v, j) => {
      ctx.beginPath(); ctx.arc(X(j / N), Y(v), 7, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
      ctx.beginPath(); ctx.arc(X(j / N), Y(v), 5, 0, TAU); ctx.fillStyle = C.text; ctx.fill();
    });
    root.querySelector('output').textContent = k;
    root.querySelector('.a').textContent = k;
    root.querySelector('.b').textContent = N - k;
    read.innerHTML = (k === N / 2 ? '两条线重合，采样点上的值是：' : '两个波在 8 个采样点上的值相同：') + '<span>' + values.map(num).join('，') + '</span>。';
  };
  slider.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(cv);
})();
</script>
```

两条曲线在采样点之间的走势截然不同，但落到这 8 个采样位置上却一模一样。计算机拿到的只有离散采样点，没法分辨原始信号到底是哪一条。$\sin$ 波同理，只是两条曲线在采样点上差一个负号，$X_{n-k}$ 的虚部反号正是这么来的。频率 0 和频率 8 也构成一对，一个起伏频率和采样频率完全相同的波，每次采样都刚好打在波峰上，看采样结果就和一条水平直线没有区别。实际录音前通常会先用低通滤波器把高于采样率一半的频率滤掉，就是为了防止高频信号混叠成低频混进来。

如果信号是按每秒 $f_s$ 次的采样率录制的，那么 $n$ 个采样对应的时长是 $n/f_s$ 秒。在这段时间内起伏 $k$ 次，折合每秒起伏 $k\cdot f_s/n$ 次，因此 $X_k$ 对应的实际物理频率就是 $k\cdot f_s/n$ 赫兹。

## 逆变换：把波形拼回去

既然已经算出每个频率的分量，把它们按权重重新叠加起来，就能还原出原始信号：

$$
x_j=\frac1n\sum_{k=0}^{n-1}X_k\,\omega^{jk}
$$

这里 $\omega^{jk}$ 代表频率为 $k$ 的旋转波，$X_k$ 是它的权重，把各项相乘后全部相加，最后统一除以 $n$，这就是**逆变换**。它和正变换的写法几乎完全对称，区别仅仅在于旋转方向从 $\omega^{-1}$ 换回 $\omega$，再多了一步除以 $n$。

拿前面的结果验算一下 $x_1$。此时需要乘的系数是 $\omega^{k}=i^k$，依次为 $1,i,-1,-i$：

$$
x_1=\frac14\bigl[8\cdot1+(6-2i)\cdot i+0\cdot(-1)+(6+2i)\cdot(-i)\bigr]
=\frac14\bigl[8+(2+6i)+0+(2-6i)\bigr]=3
$$

照同样的方法算完其余三个，结果分别是 $5$、$-1$、$1$，所有的虚部都自动消掉了，原来的四个采样分毫不差地回来了。

### 为什么一定能准确还原

把正变换的表达式直接代入逆变换的求和式（为了避免和外层的 $j$ 冲突，正变换里的下标改写成 $m$），再交换两层求和的顺序：

$$
\sum_{k=0}^{n-1}X_k\,\omega^{jk}
=\sum_{k=0}^{n-1}\sum_{m=0}^{n-1}x_m\,\omega^{-mk}\,\omega^{jk}
=\sum_{m=0}^{n-1}x_m\underbrace{\sum_{k=0}^{n-1}\omega^{k(j-m)}}_{S}
$$

关键在于下方花括号里的和式 $S$。不妨记 $r=\omega^{j-m}$，那么 $S=1+r+r^2+\dots+r^{n-1}$，分两种情况来看。

当 $m=j$ 时，$r=1$，求和里的 $n$ 项全都是 $1$，所以 $S=n$。

当 $m\ne j$ 时，$j-m$ 不可能是 $n$ 的倍数，于是 $r\ne1$。把 $S$ 整体乘上 $r$：

$$
rS=r+r^2+\dots+r^{n-1}+r^n
$$

由于 $r^n=(\omega^n)^{j-m}=1$，$rS$ 展开后和 $S$ 包含了完全相同的 $n$ 项，只是排列顺序错了一位。这就得到 $rS=S$，移项后是 $(r-1)S=0$，而 $r\ne1$，所以必然有 $S=0$。

放到单位圆上理解更直观，$1,r,r^2,\dots,r^{n-1}$ 均匀分布在圆周上。乘上 $r$ 相当于把整组点一起旋转一个固定角度，每个点正好挪到下一个点的位置，点集本身没变，向量和自然也不会变。在平面上，一个向量转过非整圈的角度后还等于自己，只有零向量满足这个条件，因此均匀排在圆周上的一圈点加起来必然互相抵消。

回到外层求和式，所有 $m\ne j$ 的项都被乘上了 $0$，只有 $m=j$ 那一项留下来且系数为 $n$。总和等于 $n\,x_j$，除以 $n$ 正好还原出 $x_j$。

这段推导同时也证明了前面一直在用的正交性：任意两个不同频率的旋转波逐项相乘再求和，得到的正是这样一圈互相抵消的单位根，彼此互不干扰。

## 拿它做什么

到这里，一段信号有了两种等价的表示方式：按时间记录每个时刻的取值（时域），或按频率记录各频率的分量（频域），两边可以靠正逆变换随时切换。很多在时域里不好处理的问题，换到频域后会直观得多。常见应用大致分成下面几类。

### 频谱分析：看信号里有什么

最直接的用途是把频谱算出来，看清里面的频率成分。

- **调音器**：对着麦克风弹一个音，做一次变换，找到最高的那根柱子就行。标准音 A 是 440 赫兹，按每秒 44100 次采样、一次取 4096 个点来算，相邻两格间隔约 $44100/4096\approx10.8$ 赫兹，最高的柱子落在第 41 格附近。
- **声谱图**：一首歌的旋律一直在变，直接对整首歌做变换只能知道出现过哪些频率，看不出分别在什么时候响起。常见做法是把音频切成几十毫秒一小段，每段单独做变换，再按时间拼成二维图，横轴是时间，纵轴是频率，颜色深浅表示强弱，这就是声谱图。听歌识曲通常提取图上最亮的峰值点当音频指纹去检索，不少语音识别模型的输入特征也是声谱图，而不是原始波形。
- **寻找隐含周期**：一串看着杂乱的数据，只要里面混有周期规律，变换后就会在对应频率上冒出尖峰。射电望远镜借此从噪声里搜寻脉冲星，工厂用它监测设备状态（轴承磨损时，振动频谱里会出现特定频率的峰），脑电图里常提的 α 波指的也是 8 到 13 赫兹这一段能量特别突出。
- **潮汐预报**：海水涨落是月球和太阳引力引起的多个周期叠加的结果。把港口多年的水位记录拆成各个周期，量出幅度和相位再往后推，就能算出未来的潮汐表。19 世纪还没有电子计算机，人们专门造了机械结构的潮汐预报机来算这组波形叠加。

### 滤波：按频率做删改

如果想从信号里剔除某一部分干扰，只要它和有效信号占据的频段不重合，处理起来就非常顺手：先变换到频域，把不需要的频率清零或衰减，再做一次逆变换还原回去。这个操作叫做**滤波**。

最典型的例子是降噪。有效信号往往变化较平缓，能量集中在低频；随机噪声则剧烈抖动，均匀铺在整个频段上。把高频部分全部清零后，噪声的大半能量就被截掉了，而原信号基本保持原样：

```render html
<style>
  .ft { --s1: #b85a31; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; }
  .ft .stage { position: relative; }
  .ft canvas { display: block; width: 100%; touch-action: pan-y; }
  .ft .tip { position: absolute; left: 0; top: 0; z-index: 1; padding: 4px 9px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--muted); font-size: 12px; line-height: 1.6; white-space: nowrap; pointer-events: none; }
  .ft .tip b { margin-right: 6px; color: var(--text); font: 600 12px var(--font-mono); }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .box { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 2px; vertical-align: -1px; }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 12px 0 4px; color: var(--muted); font-size: 12px; }
  .ft .cap:first-child { margin-top: 0; }
  .ft .pick { display: flex; align-items: center; gap: 12px; margin-top: 10px; color: var(--muted); }
  .ft .pick input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--s1); }
  .ft .pick output { min-width: 1.5em; color: var(--text); font: 15px var(--font-mono); text-align: right; }
  .ft .read { min-height: 3.2em; margin: 4px 0 0; }
</style>
<section class="ft" aria-label="把高频清零来去掉噪声">
  <p class="cap"><span><i class="key" style="color: var(--muted)"></i>带噪声的信号</span><span><i class="key" style="border-top-width: 3px; color: var(--text)"></i>滤完以后</span></p>
  <div class="stage"><canvas class="c1" role="img" aria-label="滤波前后的信号"></canvas></div>
  <label class="pick"><span>最高留到哪个频率</span><input type="range" min="1" max="64" value="8" aria-label="留下的最高频率" /><output></output></label>
  <p class="read" aria-live="polite"></p>
  <p class="cap"><span>每个频率的份量</span><span><i class="box" style="background: var(--s1)"></i>留下</span><span><i class="box" style="background: var(--rule-strong)"></i>清零</span></p>
  <div class="stage"><canvas class="c2" role="img" aria-label="信号的频谱" style="cursor: pointer"></canvas></div>
</section>
<script>
(() => {
  const root = document.querySelector('.ft');
  const cv1 = root.querySelector('.c1'), cv2 = root.querySelector('.c2');
  const slider = root.querySelector('input'), shown = root.querySelector('output'), read = root.querySelector('.read');
  const N = 128, HALF = N / 2, TAU = 2 * Math.PI, C = {};
  // 快速傅里叶变换：re、im 是实部和虚部，原地改写
  const fft = (re, im, inverse) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const turn = (inverse ? 2 : -2) * Math.PI / len;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < len / 2; k++) {
          const wr = Math.cos(turn * k), wi = Math.sin(turn * k), p = start + k, q = p + len / 2;
          const tr = re[q] * wr - im[q] * wi, ti = re[q] * wi + im[q] * wr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };
  // 干净的信号是两个慢的波；噪声是固定种子的伪随机数，每次打开都一样
  const clean = Array.from({ length: N }, (_, j) => Math.sin(TAU * 2 * j / N) + .5 * Math.sin(TAU * 5 * j / N + 1));
  let seed = 7;
  const noisy = clean.map((v) => { seed = seed * 16807 % 2147483647; return v + (seed / 2147483647 - .5) * 1.2; });
  const re0 = Float64Array.from(noisy), im0 = new Float64Array(N);
  fft(re0, im0, false);
  const strength = Array.from({ length: HALF + 1 }, (_, k) => Math.hypot(re0[k], im0[k]) / (k && k < HALF ? HALF : N));
  const peak = Math.max(...strength);
  const gap = (a, b) => Math.sqrt(a.reduce((sum, v, j) => sum + (v - b[j]) ** 2, 0) / N);
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  let cut = 8, result = noisy, at = null, over = null; // at：指针指着的采样；over：指针指着的柱子
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'muted', 'bg', 'rule', 'rule-strong', 's1']) C[key] = s.getPropertyValue('--' + key).trim();
  };
  const fit = (cv, h) => {
    const w = cv.clientWidth, r = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.height = h + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, h);
    return [ctx, w];
  };
  const rule = (ctx, x1, y1, x2, y2) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
  };
  const dot = (ctx, x, y, color) => {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = color; ctx.fill();
  };
  const draw = () => {
    if (!cv1.clientWidth) return;
    cut = Number(slider.value);
    const re = Float64Array.from(re0), im = Float64Array.from(im0);
    for (let k = 0; k < N; k++) if (Math.min(k, N - k) > cut) { re[k] = 0; im[k] = 0; }
    fft(re, im, true);
    result = re;
    {
      const h = 180, [ctx, w] = fit(cv1, h), scale = (h / 2 - 8) / 2.2, X = (j) => j / (N - 1) * w, Y = (v) => h / 2 - v * scale;
      const plot = (values, color, width) => {
        ctx.beginPath();
        for (let j = 0; j < N; j++) { if (j) ctx.lineTo(X(j), Y(values[j])); else ctx.moveTo(X(j), Y(values[j])); }
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
      };
      rule(ctx, 0, h / 2, w, h / 2); plot(noisy, C.muted, 1); plot(result, C.text, 2.5);
      if (at !== null) { rule(ctx, X(at), 0, X(at), h); dot(ctx, X(at), Y(noisy[at]), C.muted); dot(ctx, X(at), Y(result[at]), C.text); }
    }
    {
      const h = 96, [ctx, w] = fit(cv2, h), step = w / (HALF + 1), base = h - 6, bar = Math.max(1, step - 2), r = Math.min(4, bar / 2);
      for (let k = 0; k <= HALF; k++) {
        const x = k * step + (step - bar) / 2, top = Math.max(1, strength[k] / peak * (base - 6));
        if (k === over) { ctx.fillStyle = C.rule; ctx.fillRect(k * step, 0, step, base); }
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, base - top, bar, top, [r, r, 0, 0]); else ctx.rect(x, base - top, bar, top);
        ctx.fillStyle = k <= cut ? C.s1 : C['rule-strong']; ctx.fill();
      }
      rule(ctx, 0, base, w, base);
    }
    shown.textContent = cut;
    read.innerHTML = '留下频率 0 到 ' + cut + '，其余 ' + (HALF - cut) + ' 个清零。和没加噪声时的信号比，平均偏差从 <b>' + gap(noisy, clean).toFixed(2) + '</b> 变成了 <b>' + gap(result, clean).toFixed(2) + '</b>。';
  };
  // 指针停在图上时，列出这一处的数值
  const hover = (target, pick) => {
    const tip = target.parentElement.appendChild(Object.assign(document.createElement('div'), { className: 'tip', hidden: true }));
    const show = (event) => {
      const box = target.getBoundingClientRect(), x = event.clientX - box.left;
      tip.replaceChildren(...pick(Math.max(0, Math.min(1, x / box.width))).map(([color, value, label]) => {
        const row = document.createElement('div');
        if (color) row.appendChild(Object.assign(document.createElement('i'), { className: 'key' })).style.color = color;
        row.appendChild(document.createElement('b')).textContent = value;
        row.append(label);
        return row;
      }));
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(0, x + 14 + w > box.width ? x - 14 - w : x + 14) + 'px';
      tip.style.top = Math.max(0, Math.min(box.height - h, event.clientY - box.top - h / 2)) + 'px';
    };
    target.addEventListener('pointermove', show);
    target.addEventListener('pointerdown', show);
    target.addEventListener('pointerleave', () => { tip.hidden = true; pick(null); });
  };
  hover(cv1, (f) => {
    at = f === null ? null : Math.round(f * (N - 1)); draw();
    return f === null ? null : [[C.muted, num(noisy[at]), '带噪声'], [C.text, num(result[at]), '滤完以后']];
  });
  hover(cv2, (f) => {
    over = f === null ? null : Math.min(HALF, Math.floor(f * (HALF + 1))); draw();
    return f === null ? null : [[null, num(strength[over]), '频率 ' + over + (over <= cut ? '，留下' : '，清零')]];
  });
  cv2.addEventListener('click', (event) => {
    const box = cv2.getBoundingClientRect();
    slider.value = Math.max(1, Math.min(HALF, Math.floor((event.clientX - box.left) / box.width * (HALF + 1))));
    draw();
  });
  slider.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(cv1);
})();
</script>
```

拖动滑块就能看出里面的取舍。截止频率设得太低，原信号自身的起伏也会被削平；设得太高，噪声又会漏回来。怎么定这个分界点，就是滤波设计里最常权衡的事。

按同一套思路还能做不少事情：

- 音乐播放器里的**均衡器**，做法就是给不同频段乘上不同的增益系数。
- 录音里常混进 50 赫兹的工频交流电嗡嗡声，在频域里精准把那一格清零，其余声音基本不受影响。
- 收音机**调台**同样依赖滤波。各个电台的无线电信号都叠加在空气中，彼此占据不同频段，电路只放行其中一段，就能单独收听对应的频道。

这套方法放到图像上也完全成立。图像是二维数据，可以先对每一行做一维变换，再对每一列做一维变换，得到水平和竖直两个方向上的频率分布。在图像里，低频对应大块的明暗过渡，高频则对应锐利的边缘和细密纹理：

```render html
<style>
  .ft { font-size: 13px; line-height: 1.5; }
  .ft .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-width: 440px; margin-inline: auto; }
  .ft figure { margin: 0; }
  .ft canvas { display: block; width: 100%; image-rendering: pixelated; border: 1px solid var(--rule-strong); }
  .ft figcaption { margin-top: 4px; color: var(--muted); font-size: 12px; text-align: center; }
  .ft .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; margin-top: 10px; }
  .ft .seg { display: flex; gap: 0 16px; }
  .ft .seg button { min-height: 36px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .ft .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .ft .pick { display: flex; flex: 1; align-items: center; gap: 12px; min-width: 200px; color: var(--muted); }
  .ft .pick input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .ft .pick output { min-width: 1.5em; color: var(--text); font: 15px var(--font-mono); text-align: right; }
  .ft .read { min-height: 1.6em; margin: 4px 0 0; }
</style>
<section class="ft" aria-label="对一张图片只留低频或只留高频">
  <div class="pair">
    <figure><canvas class="src" width="64" height="64" role="img" aria-label="原图：明暗起伏的底上有一个亮的圆、一个暗的方块和一片细条纹"></canvas><figcaption>原图</figcaption></figure>
    <figure><canvas class="out" width="64" height="64" role="img" aria-label="处理后的图"></canvas><figcaption class="what"></figcaption></figure>
  </div>
  <div class="bar">
    <div class="seg" role="group" aria-label="留下哪一部分">
      <button type="button" data-mode="low" aria-pressed="true">只留低频</button>
      <button type="button" data-mode="high" aria-pressed="false">只留高频</button>
    </div>
    <label class="pick"><span>分界的频率</span><input type="range" min="1" max="32" value="6" aria-label="分界的频率" /><output></output></label>
  </div>
  <p class="read" aria-live="polite"></p>
</section>
<script>
(() => {
  const root = document.querySelector('.ft');
  const src = root.querySelector('.src').getContext('2d'), out = root.querySelector('.out').getContext('2d');
  const slider = root.querySelector('input'), shown = root.querySelector('output');
  const read = root.querySelector('.read'), what = root.querySelector('.what');
  const buttons = [...root.querySelectorAll('button')];
  const S = 64, TAU = 2 * Math.PI;
  let mode = 'low';
  // 快速傅里叶变换：re、im 是实部和虚部，原地改写
  const fft = (re, im, inverse) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const turn = (inverse ? 2 : -2) * Math.PI / len;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < len / 2; k++) {
          const wr = Math.cos(turn * k), wi = Math.sin(turn * k), p = start + k, q = p + len / 2;
          const tr = re[q] * wr - im[q] * wi, ti = re[q] * wi + im[q] * wr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };
  // 一张 64×64 的灰度图：明暗起伏的底、一个亮的圆、一个暗的方块、一片细条纹
  const pixel = (x, y) => {
    if (Math.hypot(x - 20, y - 22) < 11) return .95;
    if (x >= 36 && x < 56 && y >= 8 && y < 28) return .12;
    if (x >= 8 && x < 56 && y >= 40 && y < 56) return (x + y) % 4 < 2 ? .9 : .2;
    return .45 + .15 * Math.cos(TAU * x / S);
  };
  const image = new Float64Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) image[y * S + x] = pixel(x, y);
  // 二维变换：先变换每一行，再变换每一列
  const transform = (re, im, inverse) => {
    const r = new Float64Array(S), i = new Float64Array(S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) { r[x] = re[y * S + x]; i[x] = im[y * S + x]; }
      fft(r, i, inverse);
      for (let x = 0; x < S; x++) { re[y * S + x] = r[x]; im[y * S + x] = i[x]; }
    }
    for (let x = 0; x < S; x++) {
      for (let y = 0; y < S; y++) { r[y] = re[y * S + x]; i[y] = im[y * S + x]; }
      fft(r, i, inverse);
      for (let y = 0; y < S; y++) { re[y * S + x] = r[y]; im[y * S + x] = i[y]; }
    }
  };
  const re0 = Float64Array.from(image), im0 = new Float64Array(S * S);
  transform(re0, im0, false);
  const paint = (ctx, values, lift) => {
    const data = ctx.createImageData(S, S);
    for (let p = 0; p < S * S; p++) {
      const v = Math.max(0, Math.min(255, Math.round((values[p] + lift) * 255)));
      data.data[4 * p] = data.data[4 * p + 1] = data.data[4 * p + 2] = v;
      data.data[4 * p + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  };
  const draw = () => {
    const cut = Number(slider.value), re = Float64Array.from(re0), im = Float64Array.from(im0);
    let kept = 0;
    for (let v = 0; v < S; v++) {
      for (let u = 0; u < S; u++) {
        const low = Math.hypot(Math.min(u, S - u), Math.min(v, S - v)) <= cut;
        if (low === (mode === 'low')) kept++; else { re[v * S + u] = 0; im[v * S + u] = 0; }
      }
    }
    transform(re, im, true);
    // 只留高频时平均亮度也被去掉了，垫上一层中灰才看得见
    paint(out, re, mode === 'low' ? 0 : .5);
    shown.textContent = cut;
    what.textContent = mode === 'low' ? '只留低频' : '只留高频';
    read.textContent = '4096 个频率里留下了 ' + kept + ' 个，占 ' + (kept / 40.96).toFixed(1) + '%。';
  };
  buttons.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    draw();
  }));
  slider.addEventListener('input', draw);
  paint(src, image, 0);
  draw();
})();
</script>
```

切换到“只留低频”，整张图会变得模糊，下面那片细条纹最先糊成一片灰，因为又细又密的条纹能量全落在高频区域。换成“只留高频”，大块的明暗背景消失了，留下的主要是物体轮廓和条纹。修图软件里的模糊和锐化，调节的也就是低频和高频成分的比例。

### 压缩：只留重要的频率

现实中大部分自然信号变到频域后，主要能量都集中在少数几个频率上，其余大量频率的系数非常接近于 0。只把最大的那几个存下来，逆变换回去就能把原信号还原得八九不离十：

```render html
<style>
  .ft { --s1: #b85a31; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; }
  .ft .stage { position: relative; }
  .ft canvas { display: block; width: 100%; touch-action: pan-y; }
  .ft .tip { position: absolute; left: 0; top: 0; z-index: 1; padding: 4px 9px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--muted); font-size: 12px; line-height: 1.6; white-space: nowrap; pointer-events: none; }
  .ft .tip b { margin-right: 6px; color: var(--text); font: 600 12px var(--font-mono); }
  .ft .key { display: inline-block; width: 14px; margin-right: 6px; border-top: 2px solid; vertical-align: middle; }
  .ft .box { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 2px; vertical-align: -1px; }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 12px 0 4px; color: var(--muted); font-size: 12px; }
  .ft .cap:first-child { margin-top: 0; }
  .ft .pick { display: flex; align-items: center; gap: 12px; margin-top: 10px; color: var(--muted); }
  .ft .pick input { flex: 1; min-width: 0; min-height: 36px; margin: 0; accent-color: var(--s1); }
  .ft .pick output { min-width: 1.5em; color: var(--text); font: 15px var(--font-mono); text-align: right; }
  .ft .read { min-height: 3.2em; margin: 4px 0 0; }
</style>
<section class="ft" aria-label="只留下最强的几个频率，再把信号拼回去">
  <p class="cap"><span><i class="key" style="color: var(--muted)"></i>原来的信号</span><span><i class="key" style="border-top-width: 3px; color: var(--text)"></i>只用留下的频率拼回来的</span></p>
  <div class="stage"><canvas class="c1" role="img" aria-label="原信号和拼回来的信号"></canvas></div>
  <label class="pick"><span>留下最强的几个频率</span><input type="range" min="1" max="40" value="4" aria-label="留下几个频率" /><output></output></label>
  <p class="read" aria-live="polite"></p>
  <p class="cap"><span>每个频率的份量</span><span><i class="box" style="background: var(--s1)"></i>留下</span><span><i class="box" style="background: var(--rule-strong)"></i>丢掉</span></p>
  <div class="stage"><canvas class="c2" role="img" aria-label="信号的频谱"></canvas></div>
</section>
<script>
(() => {
  const root = document.querySelector('.ft');
  const cv1 = root.querySelector('.c1'), cv2 = root.querySelector('.c2');
  const slider = root.querySelector('input'), shown = root.querySelector('output'), read = root.querySelector('.read');
  const N = 128, HALF = N / 2, TAU = 2 * Math.PI, C = {};
  // 快速傅里叶变换：re、im 是实部和虚部，原地改写
  const fft = (re, im, inverse) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const turn = (inverse ? 2 : -2) * Math.PI / len;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < len / 2; k++) {
          const wr = Math.cos(turn * k), wi = Math.sin(turn * k), p = start + k, q = p + len / 2;
          const tr = re[q] * wr - im[q] * wi, ti = re[q] * wi + im[q] * wr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };
  // 三个平滑的波，加一个方方正正的台阶
  const signal = Array.from({ length: N }, (_, j) => {
    const t = j / N;
    return .8 * Math.sin(TAU * t) + .5 * Math.sin(TAU * 3 * t + .6) + .35 * Math.sin(TAU * 7 * t + 2) + (t > .45 && t < .6 ? .6 : 0);
  });
  const re0 = Float64Array.from(signal), im0 = new Float64Array(N);
  fft(re0, im0, false);
  const strength = Array.from({ length: HALF + 1 }, (_, k) => Math.hypot(re0[k], im0[k]) / (k && k < HALF ? HALF : N));
  const peak = Math.max(...strength);
  // 按份量从大到小排好的频率
  const order = strength.map((_, k) => k).sort((p, q) => strength[q] - strength[p]);
  const gap = (a, b) => Math.sqrt(a.reduce((sum, v, j) => sum + (v - b[j]) ** 2, 0) / N);
  const num = (v) => (Math.abs(v) < .005 ? 0 : v).toFixed(2).replace('-', '−');
  let keep = new Set(), result = signal, at = null, over = null; // at：指针指着的采样；over：指针指着的柱子
  const theme = () => {
    const s = getComputedStyle(root);
    for (const key of ['text', 'muted', 'bg', 'rule', 'rule-strong', 's1']) C[key] = s.getPropertyValue('--' + key).trim();
  };
  const fit = (cv, h) => {
    const w = cv.clientWidth, r = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.height = h + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, h);
    return [ctx, w];
  };
  const rule = (ctx, x1, y1, x2, y2) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = C['rule-strong']; ctx.lineWidth = 1; ctx.stroke();
  };
  const dot = (ctx, x, y, color) => {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fillStyle = C.bg; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = color; ctx.fill();
  };
  const draw = () => {
    if (!cv1.clientWidth) return;
    const count = Number(slider.value);
    keep = new Set(order.slice(0, count));
    const re = Float64Array.from(re0), im = Float64Array.from(im0);
    for (let k = 0; k < N; k++) if (!keep.has(Math.min(k, N - k))) { re[k] = 0; im[k] = 0; }
    fft(re, im, true);
    result = re;
    {
      const h = 180, [ctx, w] = fit(cv1, h), scale = (h / 2 - 8) / 2.3, X = (j) => j / (N - 1) * w, Y = (v) => h / 2 - v * scale;
      const plot = (values, color, width) => {
        ctx.beginPath();
        for (let j = 0; j < N; j++) { if (j) ctx.lineTo(X(j), Y(values[j])); else ctx.moveTo(X(j), Y(values[j])); }
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
      };
      rule(ctx, 0, h / 2, w, h / 2); plot(signal, C.muted, 1.5); plot(result, C.text, 2.5);
      if (at !== null) { rule(ctx, X(at), 0, X(at), h); dot(ctx, X(at), Y(signal[at]), C.muted); dot(ctx, X(at), Y(result[at]), C.text); }
    }
    {
      const h = 96, [ctx, w] = fit(cv2, h), step = w / (HALF + 1), base = h - 6, bar = Math.max(1, step - 2), r = Math.min(4, bar / 2);
      for (let k = 0; k <= HALF; k++) {
        const x = k * step + (step - bar) / 2, top = Math.max(1, strength[k] / peak * (base - 6));
        if (k === over) { ctx.fillStyle = C.rule; ctx.fillRect(k * step, 0, step, base); }
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, base - top, bar, top, [r, r, 0, 0]); else ctx.rect(x, base - top, bar, top);
        ctx.fillStyle = keep.has(k) ? C.s1 : C['rule-strong']; ctx.fill();
      }
      rule(ctx, 0, base, w, base);
    }
    shown.textContent = count;
    read.innerHTML = '65 个频率里留下最强的 ' + count + ' 个，其余的丢掉。拼回来的曲线和原来的平均偏差是 <b>' + gap(result, signal).toFixed(2) + '</b>。';
  };
  // 指针停在图上时，列出这一处的数值
  const hover = (target, pick) => {
    const tip = target.parentElement.appendChild(Object.assign(document.createElement('div'), { className: 'tip', hidden: true }));
    const show = (event) => {
      const box = target.getBoundingClientRect(), x = event.clientX - box.left;
      tip.replaceChildren(...pick(Math.max(0, Math.min(1, x / box.width))).map(([color, value, label]) => {
        const row = document.createElement('div');
        if (color) row.appendChild(Object.assign(document.createElement('i'), { className: 'key' })).style.color = color;
        row.appendChild(document.createElement('b')).textContent = value;
        row.append(label);
        return row;
      }));
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(0, x + 14 + w > box.width ? x - 14 - w : x + 14) + 'px';
      tip.style.top = Math.max(0, Math.min(box.height - h, event.clientY - box.top - h / 2)) + 'px';
    };
    target.addEventListener('pointermove', show);
    target.addEventListener('pointerdown', show);
    target.addEventListener('pointerleave', () => { tip.hidden = true; pick(null); });
  };
  hover(cv1, (f) => {
    at = f === null ? null : Math.round(f * (N - 1)); draw();
    return f === null ? null : [[C.muted, num(signal[at]), '原来'], [C.text, num(result[at]), '拼回来']];
  });
  hover(cv2, (f) => {
    over = f === null ? null : Math.min(HALF, Math.floor(f * (HALF + 1))); draw();
    return f === null ? null : [[null, num(strength[over]), '频率 ' + over + (keep.has(over) ? '，留下' : '，丢掉')]];
  });
  slider.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(cv1);
})();
</script>
```

调小保留数量会发现，那几个平缓的起伏只要三四个频率就能还原得很像，最费频率的是中间那个方方正正的台阶，因为尖锐的直角需要大量高频成分凑出来，保留太少时，台阶边缘就会冒出一圈小波纹。

- **JPEG**：先把图片分成 8×8 的小块，每块做一次离散余弦变换（只用余弦项的傅里叶变换近亲）。人眼对高频细节不敏感，编码时会把高频系数粗略量化，很多直接归零。一张照片压到原来十分之一大小，肉眼依然不太容易察觉差异；压得太狠时出现的小方块感和边缘波纹，就来源于高频截断。
- **MP3、AAC**：同样先变到频域，再结合人耳的听觉掩蔽效应，大音量会盖住相邻频率上的弱音，被掩蔽的部分可以直接丢掉。
- **视频编码**：H.264、H.265、AV1 这些格式，对画面分块后做的也是同类频域变换。

### 无线通信：OFDM

Wi-Fi、4G 和 5G 底层都用了叫做 OFDM 的调制方式。它的思路是把待发送的数据拆开，分配到几十甚至上千个不同频率的子载波上，每个频率的幅度和相位编码几个比特，然后把所有波叠成一路信号同时发出去。

发送端干的正好是一次**逆变换**，也就是根据各个频率上放的复数数据合成时域波形；接收端收到波形后再做一次**正变换**，就能把每个子载波携带的数据分别读回来。由于不同频率的波彼此正交（前面刚证过），哪怕在空中叠成一团，接收端也能把它们干净地分开。

早期 Wi-Fi 标准一次变换的长度是 64，其中实际用来传数据的有 52 个子载波；现代蜂窝网络里的子载波数量已经达到上千个。每发一小段数据帧就要做一次变换，一部手机每秒钟背后要跑成千上万次。

### 医学成像与晶体学

还有一些领域比较有意思，仪器直接测到的数据本来就是频域里的傅里叶变换，人眼看到的图像反而是靠逆变换算出来的。

- **核磁共振（MRI）**：设备每次采集到的信号值，对应人体断面图像二维傅里叶变换里的一个采样点。把整个频域平面采满之后，做一次二维逆变换，屏幕上才出现熟悉的解剖切片图。
- **X 射线晶体学**：X 射线穿过晶体后在底片上打出一片衍射斑点，每个斑点的亮度对应晶体内部电子密度分布做傅里叶变换后在该处的模长。历史上 DNA 双螺旋和大量蛋白质的三维结构，都是靠这些衍射图样反推出来的。麻烦的地方在于底片只记录了亮度（幅度），丢掉了相位信息，所以反演计算很有难度。
- **CT**：从某一个角度拍摄得到的一维投影，做完一维傅里叶变换后，恰好等于人体断面图像二维傅里叶变换里穿过中心的一条切片线。绕着人体把各个角度的投影拍齐、拼满频域平面，就能通过逆变换把断面重建出来。

### 化简数学运算

还有一些运算在原空间里做起来很绕，换到频域就简化成了简单的乘法。

- **求导变成乘法**：旋转波 $\cos ct+i\sin ct$（$c$ 控制旋转快慢）对时间 $t$ 求导后还是它本身，只是前面多乘了一个常数因子 $ic$。把函数分解成这类波以后，原本棘手的微分方程就降级成了普通的代数方程。傅里叶当年研究热传导方程时提出这套方法，正是因为把温度分布拆成不同频率的波后，每个频率只需按各自的速率指数衰减，越细碎的波动衰减得越快。如今许多全球数值天气预报模式也沿用了类似思想，把大气状态拆成球面上的各阶波动来推进演化。
- **卷积变成逐点相乘**：给图片做模糊时，每个像素的新值等于它和周围邻居按固定权重加权求和。这种“每个位置都拿同一套权重和邻域加权求和”的运算叫做**卷积**，给音频加混响、求两个独立随机变量之和的概率分布，做的也是同一种运算。一旦变到频域，卷积就直接退化成对应位置逐点相乘。两个大整数相乘也可以写成卷积，而且最容易直观体会速度差距，等讲完 FFT 后会专门拿它练手。
- **量子力学**：粒子的位置波函数和动量波函数互为傅里叶变换。一段信号不可能同时做到时间极短且频率极纯，对应到量子力学里就是海森堡不确定性原理。量子计算里用于分解大整数的 Shor 算法，最核心的一步也是用量子傅里叶变换去提取周期。

## FFT：把 n² 降到 n log n

上面提到的这些场景全都有实时性要求。如果直接按定义硬算，求每个 $X_k$ 都要做 $n$ 次乘法，全部 $n$ 个合起来就是 $n^2$ 次。一秒钟的 CD 音频有 44100 个采样，$n^2$ 将近 20 亿；要是碰上一百万个采样，计算量就会飙到 $10^{12}$。

**快速傅里叶变换**（Fast Fourier Transform，简称 FFT）算出来的依然是完全相同的 $X_k$，但步骤降到了 $n\log_2n$ 左右。它利用了 $n$ 次单位根的两条对称性质，对着前面那张 $n=8$ 的单位圆图看会非常直观：

1. **正对面的两个点互为相反数**。多转半圈相当于乘 $-1$，即 $\omega^{k+n/2}=-\omega^k$，图里每条虚线的两端正好构成这样一对。
2. **平方之后，$n$ 个点缩减成 $n/2$ 个**。平方意味着角度翻倍，即 $(\omega^k)^2=\omega^{2k}$，正对面的两个点平方后重合到了一起。剩下的 $\omega^0,\omega^2,\omega^4,\dots$（图上实心的点）依然均匀分布在圆周上，正好组成了 $n/2$ 次单位根，规模缩了一半，结构却完全一样。

### 按奇偶拆成两半

把 DFT 定义里的求和按采样下标 $j$ 的奇偶拆成两部分，偶数项记作 $j=2m$，奇数项记作 $j=2m+1$：

$$
X_k=\underbrace{\sum_{m=0}^{n/2-1}x_{2m}\,(\omega^2)^{-mk}}_{E_k}+\omega^{-k}\underbrace{\sum_{m=0}^{n/2-1}x_{2m+1}\,(\omega^2)^{-mk}}_{O_k}
$$

在奇数项那边，指数里的 $\omega^{-(2m+1)k}$ 被拆成了 $\omega^{-k}$ 和 $(\omega^2)^{-mk}$，前者和求和下标 $m$ 无关，直接提到了求和号外边。

仔细看 $E_k$，由性质 2 可知 $\omega^2$ 正好是 $n/2$ 次单位根里的第一个点，所以 $E_k$ 恰好就是“所有偶数位置上的 $n/2$ 个采样”的 DFT；同理，$O_k$ 是所有奇数位置采样的 DFT。这样一来，一个长度为 $n$ 的变换就拆成了两个长度为 $n/2$ 的同类子问题：

$$
X_k=E_k+\omega^{-k}O_k
$$

不过两个子变换各自只有 $n/2$ 个输出，而外层的 $k$ 要从 $0$ 走到 $n-1$。后半段怎么算呢？把 $k$ 换成 $k+n/2$ 代入原式试一下：$(\omega^2)^{-m(k+n/2)}=(\omega^2)^{-mk}\cdot\omega^{-mn}$，由于 $\omega^n=1$，两个求和项的值压根没变，还是原来的 $E_k$ 和 $O_k$；只有前面提出来的因子 $\omega^{-(k+n/2)}$ 按性质 1 变成了 $-\omega^{-k}$。因此直接得到

$$
X_{k+n/2}=E_k-\omega^{-k}O_k
$$

算出一对 $E_k$ 和 $O_k$ 之后，一个相加、一个相减，顺手就把前半段和后半段两个输出都拿到了。这一步合并操作叫做**蝶形运算**，得名于数据流图画出来的交叉形状，后面写完代码会贴出来看。

梳理下来，整个递归算法就四步：

1. 把当前采样数组按位置的奇偶分成两组；
2. 对这两组各自递归做一次长度为 $n/2$ 的变换；
3. 对每个 $k=0,1,\dots,n/2-1$，做一次蝶形运算合并结果；
4. 递归到只剩 1 个采样时直接返回它自己。

为了能一路对半分到底，通常要求 $n$ 是 $2$ 的幂；如果原始采样数不是 $2$ 的幂，一般直接在末尾补 $0$ 对齐。

### 用 FFT 再算一遍

依然拿 $x=(5,3,-1,1)$ 走一遍流程。按位置奇偶拆分后，偶数位置是 $(5,-1)$，奇数位置是 $(3,1)$。

长度为 2 的变换一眼就能算出来：当 $n=2$ 时 $\omega=-1$，任意两个数 $(p,q)$ 变换后就是 $(p+q,\ p-q)$。由此算出

$$
E=(5+(-1),\ 5-(-1))=(4,\ 6),\qquad O=(3+1,\ 3-1)=(4,\ 2)
$$

接着做蝶形合并。此时 $n=4$，对应的因子是 $\omega^{-0}=1$ 和 $\omega^{-1}=-i$：

$$
\begin{aligned}
X_0&=E_0+1\cdot O_0=4+4=8, & X_2&=E_0-1\cdot O_0=4-4=0\\
X_1&=E_1+(-i)\cdot O_1=6-2i, & X_3&=E_1-(-i)\cdot O_1=6+2i
\end{aligned}
$$

结果和前面按定义硬算出来的完全一致。

### 复杂度为什么降下来了

设长度为 $n$ 的变换耗时 $T(n)$。拆分与合并加起来是 $n$ 次级别的操作，中间递归调用了两次规模减半的变换，满足递推式

$$
T(n)=2\,T(n/2)+n
$$

按递归树展开来看：第 1 层是一个规模为 $n$ 的问题，第 2 层是两个规模为 $n/2$ 的问题，第 3 层是四个规模为 $n/4$ 的问题……每一层所有子问题的拆分和合并加起来，工作量都是 $n$ 左右。由于规模每往下走一层就减半，总共只有 $\log_2n$ 层，合起来大约是 $n\log_2n$ 步。

拿一百万个采样来估算，向上取 2 的幂是 $n=2^{20}=1048576$，一共 20 层，每层做 $n/2$ 次蝶形运算，总计大概一千万次，和按定义直接算的 $10^{12}$ 次完全不在一个量级上。

## 写成代码

### 先写一个递归版

直接把上面的四步翻译成 C++，代码很短：

```cpp
#include <complex>
#include <numbers>
#include <vector>

using Complex = std::complex<double>;

// 输入 n 个采样（n 是 2 的幂），返回它们的离散傅里叶变换
// inverse 为 true 时转的方向反过来，用于逆变换（除以 n 留给调用的地方做）
std::vector<Complex> fft(const std::vector<Complex>& x, bool inverse) {
    const std::size_t n = x.size();
    if (n == 1) return x;  // 一个采样的变换就是它自己

    // 按位置的奇偶分成两组
    std::vector<Complex> even(n / 2), odd(n / 2);
    for (std::size_t m = 0; m < n / 2; ++m) {
        even[m] = x[2 * m];
        odd[m] = x[2 * m + 1];
    }

    // 两个一半长的变换
    const std::vector<Complex> e = fft(even, inverse);
    const std::vector<Complex> o = fft(odd, inverse);

    // 蝶形运算：正变换用顺时针的 ω^(-k)，逆变换用逆时针的 ω^k
    const double turn = (inverse ? 2 : -2) * std::numbers::pi / static_cast<double>(n);
    std::vector<Complex> result(n);
    for (std::size_t k = 0; k < n / 2; ++k) {
        const Complex w = std::polar(1.0, turn * static_cast<double>(k));
        result[k] = e[k] + w * o[k];
        result[k + n / 2] = e[k] - w * o[k];
    }
    return result;
}
```

这里的 `std::polar(1.0, θ)` 会返回单位圆上角度为 `θ` 的复数，`e[k]` 和 `o[k]` 分别对应公式里的 $E_k$ 与 $O_k$。

这段实现逻辑清晰，复杂度也确实是 $O(n\log n)$，但问题在于每一层递归都要重新分配 `vector` 并来回拷贝数据，内存开销和常数都偏大。工程和竞赛里通常都会把递归改成迭代。

### 改成迭代：采样最后落在哪

想要自底向上直接合并，得先弄清递归一路拆到最底层时，这批采样被分到了什么位置。以 8 个采样为例，把拆分过程画出来：

```text
第 0 层   x0  x1  x2  x3  x4  x5  x6  x7
第 1 层   x0  x2  x4  x6 | x1  x3  x5  x7
第 2 层   x0  x4 | x2  x6 | x1  x5 | x3  x7
第 3 层   x0 | x4 | x2 | x6 | x1 | x5 | x3 | x7
```

最底下一排的下标顺序是 $0,4,2,6,1,5,3,7$，乍看有点乱，但如果把数组位置和采样下标都写成二进制，规律立马就显出来了：

| 位置 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 位置的二进制 | 000 | 001 | 010 | 011 | 100 | 101 | 110 | 111 |
| 倒过来读 | 000 | 100 | 010 | 110 | 001 | 101 | 011 | 111 |
| 这一格放的采样 | x0 | x4 | x2 | x6 | x1 | x5 | x3 | x7 |

每个位置放的采样，正好是把这个位置的二进制位反过来读得到的下标。原因也很好想：第一轮拆奇偶看的是下标的最低位（0 去左半边，1 去右半边），第二轮看次低位，最后一轮才看最高位。原下标的最低位决定了它落在最终位置的最高位，最高位反而决定了最细一层的左右归属，高位和低位刚好完全颠倒。这种重排顺序叫做**位逆序**（bit-reversal）。

弄清最终位置后，就能彻底摆脱递归了：

1. 先把数组按位逆序重排，此时每一格都可以看成长度为 1 的子段，它本身就是这段的变换结果；
2. 接着自底向上合并，先把相邻两格合成长度为 2 的段，再把相邻两段合成长度为 4 的段，一路翻倍合并到长度 $n$，每一轮做的都是批量蝶形运算。

而且合并完全可以在原数组上原地完成。对当前正在合并的区间来说，左半边存着 $E$，右半边存着 $O$，每次蝶形运算读取左半边第 $k$ 格和右半边第 $k$ 格，算出来的两个新值正好写回这两个位置，不会覆盖后面还需要用到的数据。下面拿 $n=8$、采样为 $5,3,-1,1,0,2,4,2$ 的例子把整个过程展开看一遍（图里的 $\omega_m$ 表示 $m$ 次单位根中的第一个点，每轮合并到多长的段，就用对应次数的单位根）：

```render html title="$n=8$ 的蝶形网络。最左一列是按位逆序排好的采样，每过一列，段长翻一倍"
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; --gap: 44px; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; }
  .ft .cap { display: flex; flex-wrap: wrap; gap: 0 16px; margin: 0 0 4px; color: var(--muted); font-size: 12px; }
  .ft .box { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border: 2px solid; border-radius: 3px; vertical-align: -1px; }
  .ft .net { display: grid; grid-template-columns: minmax(0, 1fr) var(--gap) minmax(0, 1fr) var(--gap) minmax(0, 1fr) var(--gap) minmax(0, 1fr) auto; grid-auto-rows: 30px; align-items: center; }
  .ft .head { color: var(--muted); font-size: 12px; text-align: center; white-space: nowrap; }
  .ft .cell { height: 26px; padding: 0 2px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); color: var(--text); font: 12px var(--font-mono); white-space: nowrap; overflow: hidden; cursor: pointer; }
  .ft .cell:focus-visible { outline-offset: 1px; }
  .ft .cell.src { border-color: var(--s2); box-shadow: inset 0 0 0 1px var(--s2); }
  .ft .cell.dst { border-color: var(--s1); box-shadow: inset 0 0 0 1px var(--s1); }
  .ft .wire { grid-row: 2 / span 8; width: 100%; height: 240px; }
  .ft .wire line { stroke: var(--rule-strong); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .ft .wire line.on { stroke: var(--text); stroke-width: 2.5; }
  .ft .name { padding-left: 8px; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .ft .read { min-height: 6.4em; margin: 8px 0 0; }
  @media (max-width: 480px) {
    .ft { --gap: 18px; }
    .ft .cell { font-size: 11px; }
    .ft .name { padding-left: 4px; }
  }
</style>
<section class="ft" aria-label="八个采样的蝶形网络，每一格都是算出来的数">
  <p class="cap"><span><i class="box" style="color: var(--s2)"></i>读这两格</span><span><i class="box" style="color: var(--s1)"></i>算出这两格</span></p>
  <div class="net" role="group" aria-label="四列数：位逆序之后，以及每一轮合并之后"></div>
  <p class="read" aria-live="polite"></p>
</section>
<script>
(() => {
  const root = document.querySelector('.ft'), net = root.querySelector('.net'), read = root.querySelector('.read');
  const N = 8, x = [5, 3, -1, 1, 0, 2, 4, 2], TAU = 2 * Math.PI;
  const reverse = (i) => (i & 1) << 2 | (i & 2) | (i >> 2);
  // cols[0] 是位逆序后的采样，cols[s] 是合并成段长 2^s 之后的数；每个数是 [实部, 虚部]
  const cols = [Array.from({ length: N }, (_, i) => [x[reverse(i)], 0])];
  const root8 = (len, k) => [Math.cos(TAU * k / len), -Math.sin(TAU * k / len)];
  const mul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
  for (let s = 1; s <= 3; s++) {
    const len = 1 << s, prev = cols[s - 1], next = [];
    for (let start = 0; start < N; start += len) {
      for (let k = 0; k < len / 2; k++) {
        const even = prev[start + k], odd = mul(prev[start + k + len / 2], root8(len, k));
        next[start + k] = [even[0] + odd[0], even[1] + odd[1]];
        next[start + k + len / 2] = [even[0] - odd[0], even[1] - odd[1]];
      }
    }
    cols.push(next);
  }
  const part = (v) => String(Number(v.toFixed(2)) || 0);
  const show = ([re, im]) => {
    const a = part(re), b = part(im);
    if (b === '0') return a;
    const bi = (b === '1' ? '' : b === '-1' ? '-' : b) + 'i';
    return a === '0' ? bi : a + (bi[0] === '-' ? '' : '+') + bi;
  };
  const wrap = (text) => /^[\d.]+$/.test(text) ? text : '(' + text + ')';
  const minus = (text) => text.replaceAll('-', '−');
  // 第 s 列第 r 格属于哪只蝴蝶：上面一格、下面一格、段长、段内第几格
  const wing = (s, r) => {
    const len = 1 << s, half = len / 2, k = r % half, top = r - r % len + k;
    return { len, k, top, bottom: top + half };
  };
  ['位逆序', '段长 2', '段长 4', '段长 8'].forEach((text, s) => {
    const head = net.appendChild(Object.assign(document.createElement('span'), { className: 'head', textContent: text }));
    head.style.gridArea = '1 / ' + (2 * s + 1);
  });
  const cells = cols.map((col, s) => col.map((value, r) => {
    const cell = net.appendChild(Object.assign(document.createElement('button'), { type: 'button', className: 'cell', tabIndex: -1 }));
    cell.innerHTML = s ? minus(show(value)) : 'x<sub>' + reverse(r) + '</sub> = ' + minus(show(value));
    cell.style.gridArea = (r + 2) + ' / ' + (2 * s + 1);
    cell.addEventListener('pointerenter', () => select(s, r));
    cell.addEventListener('focus', () => select(s, r));
    cell.addEventListener('click', () => select(s, r));
    return cell;
  }));
  const wires = [0, 1, 2].map((s) => {
    const svg = net.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    svg.setAttribute('class', 'wire'); svg.setAttribute('viewBox', '0 0 10 80'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.style.gridColumn = 2 * s + 2;
    return svg;
  });
  for (let r = 0; r < N; r++) {
    const name = net.appendChild(Object.assign(document.createElement('span'), { className: 'name' }));
    name.innerHTML = 'X<sub>' + r + '</sub>';
    name.style.gridArea = (r + 2) + ' / 8';
  }
  let at = [3, 0];
  const select = (s, r) => {
    cells[at[0]][at[1]].tabIndex = -1;
    at = [s, r];
    cells[s][r].tabIndex = 0;
    const pair = s ? wing(s, r) : null;
    cells.forEach((col, cs) => col.forEach((cell, cr) => {
      const hit = pair && (cr === pair.top || cr === pair.bottom);
      cell.classList.toggle('src', Boolean(hit && cs === s - 1));
      cell.classList.toggle('dst', s ? Boolean(hit && cs === s) : cs === 0 && cr === r);
    }));
    wires.forEach((svg, ws) => {
      let plain = '', bold = '';
      for (let row = 0; row < N; row++) {
        const { top, bottom } = wing(ws + 1, row), other = row === top ? bottom : top;
        for (const to of [row, other]) {
          const line = '<line x1="0" y1="' + (10 * row + 5) + '" x2="10" y2="' + (10 * to + 5) + '"';
          if (pair && ws === s - 1 && (row === pair.top || row === pair.bottom)) bold += line + ' class="on" />'; else plain += line + ' />';
        }
      }
      svg.innerHTML = plain + bold;
    });
    if (!pair) {
      const bits = r.toString(2).padStart(3, '0');
      read.innerHTML = '第 ' + r + ' 格放的是 $x_{' + reverse(r) + '}$：' + r + ' 写成二进制是 <code>' + bits + '</code>，倒过来读是 <code>' + [...bits].reverse().join('') + '</code>，也就是 ' + reverse(r) + '。';
      return;
    }
    const E = show(cols[s - 1][pair.top]), O = show(cols[s - 1][pair.bottom]), w = show(root8(pair.len, pair.k));
    read.innerHTML = '这一段长 ' + pair.len + '，蝴蝶在段内第 ' + pair.k + ' 格，要乘的单位根是 $\\omega_{' + pair.len + '}^{' + (pair.k ? -pair.k : 0) + '}=' + w + '$。'
      + '<br>第 ' + pair.top + ' 格：$' + wrap(E) + '+' + wrap(w) + '\\cdot' + wrap(O) + '=' + show(cols[s][pair.top]) + '$'
      + '<br>第 ' + pair.bottom + ' 格：$' + wrap(E) + '-' + wrap(w) + '\\cdot' + wrap(O) + '=' + show(cols[s][pair.bottom]) + '$';
  };
  net.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step) return;
    event.preventDefault();
    cells[Math.max(0, Math.min(3, at[0] + step[0]))][Math.max(0, Math.min(N - 1, at[1] + step[1]))].focus();
  });
  select(3, 0);
})();
</script>
```

每一列包含 $n/2$ 组交叉的“蝴蝶”，总共 $\log_2n$ 列。因为每一组只读写同一行的那两格，图上画出来的四列完全可以复用同一个数组。往右推进时，同一组蝴蝶跨过的距离逐轮翻倍：段长为 2 时两格紧挨着，到段长为 8 时中间隔了 4 格。

### 原地迭代版本

```cpp title="fft.cpp"
#include <algorithm>
#include <bit>
#include <cmath>
#include <complex>
#include <iostream>
#include <numbers>
#include <string>
#include <vector>

using Complex = std::complex<double>;

// 就地变换，a 的长度必须是 2 的幂。inverse 为 false 是正变换，为 true 是逆变换
void fft(std::vector<Complex>& a, bool inverse) {
    const int n = static_cast<int>(a.size());
    const int levels = std::countr_zero(static_cast<unsigned>(n));

    // 1. 位逆序：把每个采样先放到“拆到底”时它所在的位置
    std::vector<int> reversed(n);
    for (int i = 1; i < n; ++i) {
        reversed[i] = (reversed[i >> 1] >> 1) | ((i & 1) << (levels - 1));
        if (i < reversed[i]) std::swap(a[i], a[reversed[i]]);
    }

    // 2. 单位根表：正变换存 ω^(-k)，逆变换存 ω^k，只要前一半
    std::vector<Complex> root(n / 2);
    for (int k = 0; k < n / 2; ++k) {
        const double angle = 2 * std::numbers::pi * k / n;
        root[k] = Complex(std::cos(angle), inverse ? std::sin(angle) : -std::sin(angle));
    }

    // 3. 自底向上合并：长度 1 的段两两合成 2，再合成 4……
    for (int len = 2; len <= n; len <<= 1) {
        const int half = len / 2, stride = n / len;
        for (int start = 0; start < n; start += len) {
            for (int k = 0; k < half; ++k) {
                const Complex even = a[start + k];
                const Complex odd = a[start + k + half] * root[k * stride];
                a[start + k] = even + odd;
                a[start + k + half] = even - odd;
            }
        }
    }

    // 4. 逆变换最后除以 n
    if (inverse) {
        for (Complex& value : a) value /= n;
    }
}
```

对照代码里的四段注释，逐块解释一下细节：

- **第 1 段，位逆序置换**：`reversed[i]` 存的是 `i` 的二进制反转结果，可以借助前面已经算出的 `reversed[i >> 1]` 递推出来。把 `i` 右移一位去掉最低位后，它的逆序结果再右移一位就能空出最高位，最后把 `i` 原来的最低位补到最高位上即可。拿 3 位二进制下的 `i = 6`（`110`）验一下：`i >> 1` 是 3（`011`），其逆序是 6（`110`），右移一位得到 `011`，`i` 的最低位是 `0`，拼完结果是 `011`（即 3），和 `110` 倒过来完全吻合。判断 `if (i < reversed[i])` 是为了防止同一对元素被交换两次又换回去。
- **第 2 段，预处理单位根表**：`root[k]` 存的是 $\omega^{-k}$，也就是角度为 $k \cdot 2\pi/n$ 且虚部取负（顺时针方向）的单位根；逆变换需要逆时针的 $\omega^{k}$，虚部保持正号。表里只存了前一半，因为后一半恰好是前一半的相反数，在蝶形运算里直接用减法就能替代。这里每个点都老老实实用 `cos` 和 `sin` 现算，没有写成拿前一项不断乘 $\omega$ 的递推，否则连乘上百万次后浮点舍入误差会越滚越大。
- **第 3 段，自底向上合并**：外层 `len` 是本轮合并后的段长，`start` 指向当前段的起点，`k` 遍历段内的前一半偏移。段长为 `len` 时需要的是 `len` 次单位根，它相邻两点的角度步长是 $n$ 次单位根的 `n / len` 倍，因此直接按步长 `stride = n / len` 从预处理的表里跳着取 `root[k * stride]` 就行。最内层四行严格对应蝶形公式：`even` 是 $E_k$，`odd` 是 $\omega^{-k}O_k$，一加一减后原地写回。
- **第 4 段，归一化**：逆变换最后统一除以 $n$，正变换跳过这一步。

调用时，`fft(a, false)` 做正变换，`fft(a, true)` 做逆变换。把 $(5,3,-1,1)$ 传进正变换，输出正是前面手算的 $(8,\ 6-2i,\ 0,\ 6+2i)$。

## 用 FFT 乘两个大整数

前面提到两个整数相乘可以写成卷积，借助频域来加速。现在手里已经有了写好的 `fft`，正好拿它把大整数乘法跑通。算两个一百万位整数的乘积，列竖式要做 $10^{12}$ 次一位数乘法，在我的笔记本上跑了整整 5 分钟，而用上面那几十行 `fft` 只要半秒左右。

### 竖式乘法就是卷积

先列一遍小学学过的 $12\times34$ 竖式，只改一处规则，**每一列先不进位**，算出来是多少就写多少：

$$
\begin{array}{rrrr}
 & & 1 & 2 \\
\times & & 3 & 4 \\
\hline
 & & 4 & 8 \\
 & 3 & 6 & \\
\hline
 & 3 & 10 & 8
\end{array}
$$

第三行是 $4\times12$，第四行是 $3\times12$ 并往左错了一位，最后把每一列直接累加：个位是 $8$，十位是 $4+6=10$，百位是 $3$。十位上摆个 $10$ 虽然不合平时书写习惯，数值上完全没错，因为 $3\times100+10\times10+8=408$。全部列都算完后再统一从右往左处理进位，$10$ 留 $0$ 进 $1$，百位加 $1$ 变成 $4$，照样得到 $408$。

看看哪些数位的乘积会落到同一列。把数字从右往左从 $0$ 开始编号，个位是第 $0$ 位，十位是第 $1$ 位：$12$ 对应 $a_0=2$、$a_1=1$，$34$ 对应 $b_0=4$、$b_1=3$。第 $i$ 位与第 $j$ 位相乘会落在第 $i+j$ 列，因此第 $k$ 列收集的就是所有下标之和等于 $k$ 的乘积项：

$$
c_k=\sum_{i+j=k}a_ib_j
\qquad\qquad
\begin{aligned}
c_0&=a_0b_0=8\\
c_1&=a_0b_1+a_1b_0=6+4=10\\
c_2&=a_1b_1=3
\end{aligned}
$$

这种按“下标之和相同”分组累加的运算，正是前面说的**卷积**，相当于把 $34$ 的各位数字当成权重，逐列和 $12$ 的各位做加权求和。两个 $n$ 位数共有 $n^2$ 对数字，每一对都要相乘，竖式慢就慢在这一步，而进位只需要从低位往高位线性扫一遍。所以大整数乘法可以拆成两步：先算两串数字的卷积，再做一次进位。

### 为什么卷积在频域变成逐点相乘

如果把一串数字看成多项式的系数：

$$
A(x)=a_0+a_1x+a_2x^2+\cdots
$$

那么 $12$ 对应的多项式就是 $A(x)=2+x$，代回 $x=10$ 就得到 $12$ 本身。把两个这样的多项式相乘时，由于 $x^i\cdot x^j=x^{i+j}$，合并同类项的规则恰好也是把下标之和相同的系数乘积归到一起：

$$
(2+x)(4+3x)=8+6x+4x+3x^2=8+10x+3x^2
$$

多项式相乘对系数做的正是卷积。

回头看一眼 DFT 的定义式，如果把 $\omega^{-k}$ 当成自变量 $x$ 代入多项式，会发现：

$$
X_k=\sum_{j}a_j\,\omega^{-jk}=\sum_{j}a_j\,(\omega^{-k})^j=A(\omega^{-k})
$$

对一串数字做 DFT，等价于求这个多项式在 $n$ 个单位根处的点值。而两个多项式相乘 $C(x)=A(x)B(x)$，在任意给定点 $x$ 上的函数值只需要各自取值再相乘就行，所以对每个单位根 $\omega^{-k}$ 都有

$$
\underbrace{C(\omega^{-k})}_{\text{卷积的变换}}=\underbrace{A(\omega^{-k})}_{a\text{ 的变换}}\cdot\underbrace{B(\omega^{-k})}_{b\text{ 的变换}}
$$

这就是**卷积定理**：两串数先卷积再做 DFT，等于各自做完 DFT 后对应位置逐点相乘。于是算卷积就有了一条更快的路线：

1. 先对两串数各自做一次 FFT，求出它们在单位根上的点值；
2. 把两个点值数组对应位置逐项相乘，只需 $n$ 次乘法；
3. 再做一次逆 FFT，把点值插值回系数，得到卷积结果。

三次变换各自只需 $O(n\log n)$ 步，中间逐点乘只有 $O(n)$ 步，原来 $O(n^2)$ 的瓶颈就这么绕过去了。

### 手动走一遍 12 × 34

乘积最多有 $2+2-1=3$ 个系数，向上取 2 的幂选 $n=4$，在两串数字后面补 $0$ 对齐。四个求值点 $\omega^{-k}$ 依次为 $1,-i,-1,i$：

| 步骤 | 操作 | 结果 |
| --- | --- | --- |
| 1 | 数字从低位排起，补 $0$ 到 4 格 | $(2,1,0,0)$ 和 $(4,3,0,0)$ |
| 2 | 各做一次 FFT | $(3,\,2-i,\,1,\,2+i)$ 和 $(7,\,4-3i,\,1,\,4+3i)$ |
| 3 | 对应位置相乘 | $(21,\,5-10i,\,1,\,5+10i)$ |
| 4 | 做一次逆 FFT | $(8,10,3,0)$ |
| 5 | 从低位到高位进位 | $8$；$10$ 留 $0$ 进 $1$；$3+1=4$，读出 $408$ |

第 2 步相当于把 $1,-i,-1,i$ 分别代入 $2+x$ 和 $4+3x$ 求值。第 3 步里算了一下 $(2-i)(4-3i)=8-6i-4i+3i^2=5-10i$。第 4 步拿 $c_1$ 验算，逆变换乘的系数是 $i^k$，即 $1,i,-1,-i$：

$$
c_1=\frac14\bigl[21\cdot1+(5-10i)\cdot i+1\cdot(-1)+(5+10i)\cdot(-i)\bigr]
=\frac14\bigl[21+(10+5i)-1+(10-5i)\bigr]=10
$$

挺奇妙的是，明明是在算两个整数相乘，中间却专门绕了一圈复平面，最后所有虚部又刚好抵消干净，落回准确的整数上。

### 完整代码

把下面这段接在前面的 `fft` 后面，就是一个完整的大整数乘法程序，读入两个十进制整数并输出乘积（按 C++20 编译）：

```cpp title="fft.cpp（续）"
// 十进制字符串相乘，一位数字占一格
std::string multiply(const std::string& x, const std::string& y) {
    const std::size_t need = x.size() + y.size();
    const std::size_t n = std::bit_ceil(need);

    // 数字倒着放：第 0 格是个位
    std::vector<Complex> a(n), b(n);
    for (std::size_t i = 0; i < x.size(); ++i) a[i] = x[x.size() - 1 - i] - '0';
    for (std::size_t i = 0; i < y.size(); ++i) b[i] = y[y.size() - 1 - i] - '0';

    fft(a, false);
    fft(b, false);
    for (std::size_t i = 0; i < n; ++i) a[i] *= b[i];
    fft(a, true);

    // 取整，再从低位到高位进位
    std::string digits(need, '0');
    long long carry = 0;
    for (std::size_t i = 0; i < need; ++i) {
        carry += std::llround(a[i].real());
        digits[need - 1 - i] = static_cast<char>('0' + carry % 10);
        carry /= 10;
    }
    const std::size_t first = digits.find_first_not_of('0');
    return first == std::string::npos ? "0" : digits.substr(first);
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    std::string x, y;
    std::cin >> x >> y;
    std::cout << multiply(x, y) << '\n';
}
```

`multiply` 的逻辑和上面那张表完全对应。长度 `n` 取不小于两数位数之和的最小 $2$ 的幂，比卷积系数的个数多留出一格，刚好用来承接最高位可能产生的进位。逆变换算出来的结果会带一点浮点误差，比如 `7.999999999` 或 `8.000000001`，用 `std::llround` 四舍五入到最近的整数，而理论上应为 $0$ 的虚部直接丢掉即可。

实际测一组速度和竖式对比一下（两个随机大整数，均按一位数字占一格，编译选项 `g++ -O2`）：

| 位数 | 竖式 | FFT |
| --- | --- | --- |
| 1 万 | 0.027 秒 | 0.005 秒 |
| 10 万 | 2.8 秒 | 0.05 秒 |
| 100 万 | 308 秒 | 0.55 秒 |

位数每扩大 10 倍，竖式的耗时大约翻 100 倍，而 FFT 只慢了 10 倍多一点。

### 两个容易踩坑的细节

第一是**变换长度 $n$ 不能取小**。数组开小了程序不会报错，只会悄悄算错。比如硬用 $n=2$ 去算 $12\times34$，两个求值点只有 $1$ 和 $-1$，算出来 $C(1)=3\times7=21$、$C(-1)=1\times1=1$，逆变换回去得到 $c_0=(21+1)/2=11$、$c_1=(21-1)/2=10$。而真实的卷积系数是 $8,10,3$，最高次项的 $3$ 绕回来叠到了 $c_0$ 上（$8+3=11$）。这是因为在这两个点上 $x^2$ 恒等于 $1$，靠它们根本区分不开 $x^2$ 和常数项。推广到一般情况，所有 $n$ 次单位根都满足 $x^n=1$，超出长度的高次项就会折返叠加到低位上，这就是所谓的循环卷积。

第二是**浮点数精度误差**。`cos`、`sin` 都是浮点近似值，每一步加减乘也会累积舍入误差。最后靠 `llround` 把误差抹平，但前提是总误差必须严格小于 $0.5$。`double` 大概有 15 到 16 位十进制有效数字。按一位数字占一格算，卷积结果中单个系数的上界是 $81$ 乘以位数（同一列最多叠加“位数”个 $9\times9$），对两个一百万位的数大约是八千万，只占 8 位有效数字，留给误差的余量还有七八位，非常安全。

如果想把数组缩短一点来进一步提速，可以每格多压几位数字，但代价是卷积系数迅速变大，精度余量会跟着缩水。还是拿两个一百万位、全由 9 组成的数来实测一下：

| 每格放几位 | 变换长度 | 卷积里最大的数 | 离整数最远偏了多少 |
| --- | --- | --- | --- |
| 1 | $2^{21}$ | $8.1\times10^{7}$ | $5\times10^{-8}$ |
| 2 | $2^{20}$ | $4.9\times10^{9}$ | $3\times10^{-6}$ |
| 3 | $2^{20}$ | $3.3\times10^{11}$ | $3\times10^{-4}$ |
| 4 | $2^{19}$ | $2.5\times10^{13}$ | $0.02$ |
| 5 | $2^{19}$ | $2.0\times10^{15}$ | $0.5$，结果错了 |

每格压 4 位还能稳住，压到 5 位误差就撞上 $0.5$ 导致结果算错，而且程序同样不会抛出任何异常。因此用浮点 FFT 做精确整数乘法时，动手前一定要先估算系数的最大值，把安全余量留够。

### 彻底避开浮点数：NTT

回头看 `fft` 的推导过程，我们究竟用到了 $\omega$ 的哪些性质？无非是 $\omega^n=1$、$\omega^{n/2}=-1$，以及支持加、减、乘和最后除以 $n$。这些条件里没有任何一条强制要求 $\omega$ 必须是复数。在**模质数 $p$ 的整数集合**里，同样能找到具备全套性质的数。

在模 $p$ 算术里，所有数都落在 $0,1,\dots,p-1$ 之间，每次加、减、乘完都对 $p$ 取余；至于“除以 $n$”，则等价于乘上 $n$ 的模逆元（即与 $n$ 相乘模 $p$ 余 $1$ 的那个数），由费马小定理可知它等于 $n^{p-2}\bmod p$。

以质数 $p=17$ 为例，把 $3$ 的各次幂模 $17$ 依次列出来：

| $k$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| $3^k \bmod 17$ | 1 | 3 | 9 | 10 | 13 | 5 | 15 | 11 | 16 | 14 | 8 | 7 | 4 | 12 | 2 | 6 | 1 |

从 $1$ 出发，每乘一次 $3$ 就往前跳一格，走满 16 步刚好回到 $1$，中途不重不漏地遍历了 $1$ 到 $16$ 的每一个数。这 16 个数就像圆周上均匀排开的 16 个点，乘以 $3$ 就相当于往前转一格，走到半圈（$k=8$）时正好落在 $16$ 上，也就是模 $17$ 意义下的 $-1$。像 $3$ 这样各次幂能把 $1$ 到 $p-1$ 全部遍历一遍的数，叫做质数 $p$ 的一个**原根**。

现在如果要选 4 个点，只要在这圈 16 格里每隔 4 格取一个，即 $3^0,3^4,3^8,3^{12}$，对应的数就是 $1,13,16,4$。其中的 $13$ 扮演的正是 4 次单位根的角色：$13^2=169=9\times17+16\equiv -1\pmod{17}$，而 $13^4\equiv 1\pmod{17}$。

用这组数把 $12\times34$ 再算一遍，全程都在模 $17$ 下进行：

| 位置 $x$ | $1$ | $13$ | $16$ | $4$ |
| --- | --- | --- | --- | --- |
| $A(x)=2+x$ | $3$ | $15$ | $1$ | $6$ |
| $B(x)=4+3x$ | $7$ | $9$ | $1$ | $16$ |
| $C(x)=A(x)B(x)$ | $4$ | $16$ | $1$ | $11$ |

比如 $B(13)=4+39=43$，减去 $2\times17$ 余 $9$；$C(13)=15\times9=135$，减去 $7\times17$ 余 $16$。

做逆变换往回转时，把 $13$ 换成它的逆元 $4$（因为 $13\times4=52=3\times17+1$），各次幂依次为 $1,4,16,13$；最后一步“除以 4”则是乘以 $4$ 的逆元，碰巧又是 $13$。拿 $c_1$ 验算一下：

$$
c_1=13\times(4\times1+16\times4+1\times16+11\times13)=13\times227\equiv10\pmod{17}
$$

四个系数算完依然是 $(8,10,3,0)$。这一回从头到尾都是纯整数运算，完全不需要四舍五入，也就彻底消灭了浮点误差。这种在模质数域上做的离散傅里叶变换叫做**数论变换**（Number Theoretic Transform，简称 NTT）。

不过模数 $p$ 不能随便选，必须同时满足两条限制：

- **循环长度能被 $n$ 整除**：原根生成的一圈共有 $p-1$ 个数，要每隔 $(p-1)/n$ 格取点，就要求 $n$ 整除 $p-1$。由于 $n$ 是 2 的幂，$p-1$ 的质因数分解里必须包含足够多的因子 $2$。
- **卷积结果的每个系数都小于 $p$**：NTT 算出来的是真实结果对 $p$ 取余后的值，只有真实值本身严格小于 $p$，余数才等于原值。前面例子里的 $8,10,3$ 都小于 $17$，所以没出问题。

算法竞赛和工程里最常用的 NTT 模数是 $998244353=119\times2^{23}+1$。它既是质数，原根又刚好是 $3$，支持的最大变换长度能达到 $2^{23}=8388608$。按一位数字占一格算，卷积结果的最大值不超过 $81$ 乘以较短那个数的位数，只要两数总位数不超过八百多万位，离 $998244353$ 的上限还远得很。

具体写代码时，NTT 和前面那份 FFT 几乎逐行对应，只需要改三处：把单位根换成 $3^{(p-1)/n}$ 的各次幂，把加减乘全部加上取模，再把最后的除以 $n$ 换成乘以 $n$ 的模逆元，结尾也不再需要 `llround` 取整。

<details>
<summary>展开 NTT 版的完整程序</summary>

```cpp title="ntt.cpp"
#include <algorithm>
#include <bit>
#include <cstdint>
#include <iostream>
#include <string>
#include <vector>

using u32 = std::uint32_t;
using u64 = std::uint64_t;

constexpr u32 MOD = 998244353;  // 119 * 2^23 + 1
constexpr u32 G = 3;            // 它的一个原根

u32 power(u32 base, u32 exponent) {
    u64 result = 1, b = base;
    for (; exponent != 0; exponent >>= 1, b = b * b % MOD) {
        if (exponent & 1) result = result * b % MOD;
    }
    return static_cast<u32>(result);
}

// 就地变换。inverse 为 false 是正变换，为 true 是逆变换
void ntt(std::vector<u32>& a, bool inverse) {
    const int n = static_cast<int>(a.size());
    const int levels = std::countr_zero(static_cast<unsigned>(n));

    std::vector<int> reversed(n);
    for (int i = 1; i < n; ++i) {
        reversed[i] = (reversed[i >> 1] >> 1) | ((i & 1) << (levels - 1));
        if (i < reversed[i]) std::swap(a[i], a[reversed[i]]);
    }

    // n 次单位根：omega = g^((p-1)/n)，逆变换用它的逆元
    u32 omega = power(G, (MOD - 1) / n);
    if (inverse) omega = power(omega, MOD - 2);
    std::vector<u32> root(n / 2);
    root[0] = 1;
    for (int k = 1; k < n / 2; ++k) root[k] = static_cast<u32>(static_cast<u64>(root[k - 1]) * omega % MOD);

    for (int len = 2; len <= n; len <<= 1) {
        const int half = len / 2, stride = n / len;
        for (int start = 0; start < n; start += len) {
            for (int k = 0; k < half; ++k) {
                const u32 even = a[start + k];
                const u32 odd = static_cast<u32>(static_cast<u64>(a[start + k + half]) * root[k * stride] % MOD);
                a[start + k] = even + odd >= MOD ? even + odd - MOD : even + odd;
                a[start + k + half] = even >= odd ? even - odd : even + MOD - odd;
            }
        }
    }

    if (inverse) {
        const u64 inverseN = power(static_cast<u32>(n), MOD - 2);
        for (u32& value : a) value = static_cast<u32>(value * inverseN % MOD);
    }
}

std::string multiply(const std::string& x, const std::string& y) {
    const std::size_t need = x.size() + y.size();
    const std::size_t n = std::bit_ceil(need);

    std::vector<u32> a(n), b(n);
    for (std::size_t i = 0; i < x.size(); ++i) a[i] = x[x.size() - 1 - i] - '0';
    for (std::size_t i = 0; i < y.size(); ++i) b[i] = y[y.size() - 1 - i] - '0';

    ntt(a, false);
    ntt(b, false);
    for (std::size_t i = 0; i < n; ++i) a[i] = static_cast<u32>(static_cast<u64>(a[i]) * b[i] % MOD);
    ntt(a, true);

    std::string digits(need, '0');
    u64 carry = 0;
    for (std::size_t i = 0; i < need; ++i) {
        carry += a[i];
        digits[need - 1 - i] = static_cast<char>('0' + carry % 10);
        carry /= 10;
    }
    const std::size_t first = digits.find_first_not_of('0');
    return first == std::string::npos ? "0" : digits.substr(first);
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    std::string x, y;
    std::cin >> x >> y;
    std::cout << multiply(x, y) << '\n';
}
```

</details>

注意这份代码里的单位根表是直接连乘递推出来的，因为整数取模不存在舍入误差，连乘多少次都是精确的。而且它的速度也比复数版本更快，一次整数乘法加取模的开销明显低于复数乘法。还是前面测试表里的那三组随机大整数，NTT 版的耗时分别降到了 0.0014 秒、0.015 秒和 0.19 秒。

### 实际大整数库里的选择

FFT 并不是对所有规模的整数都占优势。它的单步常数比竖式高得多，数字不够大时反而不划算。像 GMP 这样成熟的大整数库，内部通常会按位数分层切换算法：小规模直接跑竖式乘法，中等规模切到 Karatsuba 算法（1960 年提出，把两个数各劈成两半，用三次减半乘法代替四次，复杂度约 $O(n^{1.585})$）以及它的高阶推广，只有当位数大到足够高时才启用基于 FFT 的乘法。

在理论复杂度方面，Schönhage 和 Strassen 在 1971 年给出了第一个基于 FFT 的大整数乘法算法，复杂度达到 $O(n\log n\log\log n)$。到了 2019 年，Harvey 和 van der Hoeven 进一步把它推进到了 $O(n\log n)$，不过这个算法的常数门槛极高，只有在位数大到天文数字时才能超过旧算法，实际工程里并不会拿它来算。

## 回到开头那个连续积分

看到这里，文章开头提到过、教材里常见的那个连续傅里叶变换积分公式，就很容易认出来了。如果把采样间隔取得越来越密、采样时长拉得越来越长，离散求和就过渡成了积分，一格一格的离散频率 $k$ 也变成了可以连续取值的角频率 $\omega$（这里 $\omega$ 表示每秒转过的弧度，和前面记单位根的符号只是恰好重名）：

$$
F(\omega)=\int_{-\infty}^{+\infty}f(t)\,e^{-i\omega t}\,\mathrm{d}t
$$

把它和前面的 DFT 逐项对上号就能看明白：$f(t)$ 对应离散信号 $x_j$，$e^{-i\omega t}=\cos\omega t-i\sin\omega t$ 就是顺时针旋转的点，对应 $\omega^{-jk}$，而积分号扮演的依然是“全部累加”的角色。整个式子表达的还是同一件事——拿一个逆向旋转的复数波去乘信号，再把结果全部累加，看看这个频率的分量还剩多少。

1807 年，傅里叶在研究金属内部的热传导问题时，大胆提出任意函数都可以拆成一系列正弦和余弦波的和。这个论断在当时遭到了不少数学家的质疑，直到之后的一百多年里才被一步步补齐严格证明并不断推广，最终成了现代信号分析最基础的骨架。

不过计算机里能处理的永远只是有限个离散采样点，所以真正在无数设备里每秒运行成千上万次的，正是上面讲的离散傅里叶变换以及把它变快的 FFT。FFT 是在 Cooley 和 Tukey 于 1965 年发表论文后才彻底流行起来的，后来人们整理历史文献时才发现，高斯早在 1805 年前后的手稿里就已经写出了同样的分治思路，只是当时没有正式发表。

## 延伸阅读

- 3Blue1Brown 的视频 *But what is the Fourier Transform? A visual introduction*，把信号“绕到单位圆上求质心”的几何直觉讲得非常精彩。
- Reducible 的视频 *The Fast Fourier Transform (FFT): Most Ingenious Algorithm Ever?*，从多项式求值与插值的视角切入讲解 FFT，动画很直观。
- [CP-Algorithms：Fast Fourier transform](https://cp-algorithms.com/algebra/fft.html)，整理了实现细节、NTT 以及各种精度优化技巧。
- [OI Wiki：快速傅里叶变换](https://oi-wiki.org/math/poly/fft/)，中文资料，偏向算法竞赛视角。
- 《算法导论》第 30 章“多项式与快速傅里叶变换”，数学推导和证明写得很完整。
- Steven W. Smith，*The Scientist and Engineer's Guide to Digital Signal Processing*，偏信号处理工程实践的经典入门书，网上有免费在线版。
