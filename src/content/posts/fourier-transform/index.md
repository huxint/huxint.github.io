---
title: "傅里叶变换到底在算什么"
description: "一段声音里混着哪几个音，傅里叶变换是怎么一个个量出来的。从四个数的手算讲起，再看它怎么用来降噪、压缩、传数据和乘大整数，以及让它变快的 FFT。"
pubDate: 2026-11-17
tags: ["数学", "算法", "信号处理", "C++"]
---

同时按下钢琴上的三个键，麦克风录到的不是三样东西，而是一条上下抖动的曲线：每个时刻一个数，三个音早就加在了一起。可调音器知道你弹的是哪个音，听歌识曲认得出是哪首歌，播放器上的均衡器能只把低音调大。它们做的第一件事都一样：把这条混在一起的曲线拆开，算出里面有哪些频率、每个频率各有多少。

这件事叫**傅里叶变换**。MP3 和 JPEG 靠它的近亲压缩，Wi-Fi 靠它收发数据，核磁共振靠它成像。连两个一百万位的整数相乘，最快的办法也是它。

名气这么大，课本上的定义却常常是一个带 $e^{-i\omega t}$ 的积分，看完更糊涂。这篇不从那个式子讲起。先拿四个数手算一遍，看清楚“拆”到底是怎么拆的；再看复数为什么会冒出来；然后看它都被拿去做什么：降噪、压缩、Wi-Fi、核磁共振；最后是让它变快的 FFT，和用它乘大整数的办法。复数从头讲，不需要学过。

## 信号是一串数

声音是空气压力随时间的变化。电脑存声音的办法很朴素：每隔一小段固定的时间量一次，把量到的数记下来。CD 一秒钟量 44100 次。于是一段声音就是一串数

$$
x_0,\ x_1,\ x_2,\ \dots,\ x_{n-1}
$$

这叫**采样**。后面说的“信号”都指这样一串数。图片的一行像素、心电图、每天的气温，只要能排成一串数，都算。

最简单的信号是一个纯音，画出来是一条均匀起伏的波浪线，也就是余弦曲线。描述一个波要三个量：

- **频率**：起伏得多快。这里用“在这 $n$ 个采样里完整起伏了几次”来数，记作 $k$。
- **幅度**：起伏得多高。
- **相位**：从波的哪个位置开始。

频率为 $k$、幅度为 $1$、从最高点开始的波，第 $j$ 个采样是

$$
\cos\frac{2\pi kj}{n}
$$

$2\pi$ 是一整圈（$360°$）的弧度。$j/n$ 是走到了这段信号的几分之几，乘上 $2\pi$ 是转过了多少角度，再乘 $k$ 就是转得快 $k$ 倍：$j$ 从 $0$ 走到 $n$，一共转了 $k$ 圈，余弦值也就起伏了 $k$ 次。

从最高点开始的是 $\cos$。晚四分之一圈、从 $0$ 开始往上走的是 $\sin$。

## 把几个波加起来

几个音同时响，空气的压力是各自压力的和。录下来的信号，就是几个波逐点相加。下面三条细线是三个波，在这一段里分别起伏 2 次、5 次、9 次；粗线是它们的和：

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

和画出来乱糟糟的。光看粗线，很难说出它是哪几个波、各有多少。**傅里叶变换做的是反过来的事：只给你那条粗线，把三个波各自的幅度找回来。**

## 四个数，手算一遍

先看最小的例子，信号只有 4 个采样。按上一节的式子，$\cos(2\pi kj/4)$ 就是 $\cos(kj\cdot90°)$，能写出这样四个波：

| 名字 | 四个采样 | 是什么 |
| --- | --- | --- |
| $c_0$ | $1,\ 1,\ 1,\ 1$ | 频率 0，不起伏，管整体的高低 |
| $c_1$ | $1,\ 0,\ -1,\ 0$ | 频率 1 的 $\cos$ |
| $s_1$ | $0,\ 1,\ 0,\ -1$ | 频率 1 的 $\sin$ |
| $c_2$ | $1,\ -1,\ 1,\ -1$ | 频率 2 的 $\cos$ |

（频率 2 的 $\sin$ 在这四个采样点上全是 $0$，用不上。四个采样正好配四个波。）

用它们配一段信号：2 份 $c_0$，3 份 $c_1$，1 份 $s_1$，$c_2$ 不放。逐项相加：

$$
x=2c_0+3c_1+1s_1=(2+3+0,\ 2+0+1,\ 2-3+0,\ 2+0-1)=(5,\ 3,\ -1,\ 1)
$$

现在假装忘了配方，手里只有 $(5,3,-1,1)$ 这四个数。怎么把 $2,3,1,0$ 找回来？

办法只有一招：**拿每个波去和信号对一对，对应位置相乘，再加起来。**

$$
\begin{aligned}
x\cdot c_0&=5\times1+3\times1+(-1)\times1+1\times1=8\\
x\cdot c_1&=5\times1+3\times0+(-1)\times(-1)+1\times0=6\\
x\cdot s_1&=5\times0+3\times1+(-1)\times0+1\times(-1)=2\\
x\cdot c_2&=5\times1+3\times(-1)+(-1)\times1+1\times(-1)=0
\end{aligned}
$$

这里的“$\cdot$”表示逐项相乘再相加。再让每个波和自己对一次：

$$
c_0\cdot c_0=4,\qquad c_1\cdot c_1=2,\qquad s_1\cdot s_1=2,\qquad c_2\cdot c_2=4
$$

两组数一除：$8/4=2$，$6/2=3$，$2/2=1$，$0/4=0$。配方回来了。

为什么这么巧？因为这四个波**互不干扰**：任意两个不同的波对一对，结果都是 $0$。

$$
c_0\cdot c_1=1+0-1+0=0,\qquad c_1\cdot s_1=0+0+0+0=0,\qquad c_1\cdot c_2=1+0-1+0=0
$$

另外三对也一样，可以自己验一下。于是拿 $c_1$ 去对信号的时候：

$$
x\cdot c_1=(2c_0+3c_1+1s_1)\cdot c_1=2\,\underbrace{(c_0\cdot c_1)}_{0}+3\,\underbrace{(c_1\cdot c_1)}_{2}+1\,\underbrace{(s_1\cdot c_1)}_{0}=6
$$

别的波全都自己抵消了，只有信号里 $c_1$ 的那一份留了下来，留下的正好是“份数乘 $c_1\cdot c_1$”。除掉 $c_1\cdot c_1$，就是份数。

**傅里叶变换的全部想法就是这一招。** 后面要做的只有三件事：把 4 个采样换成 $n$ 个；把 $\cos$ 和 $\sin$ 两个读数装进一个复数；把计算变快。

## 拿一个波去对：相乘，再加起来

采样多起来，做法一模一样：想知道信号里有没有频率 $k$ 的波，就拿频率 $k$ 的波去乘它，再把乘积全加起来。

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
  <div class="stage"><canvas class="c3" role="img" aria-label="各个频率的份量"></canvas></div>
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
  slider.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(cv1);
})();
</script>
```

信号还是那三个波的和，幅度分别是 1、0.6、0.4，取了 64 个采样。拿去对的波换成不同的频率，结果只有两种：

- 它的频率正好是信号里有的（2、5、9）：信号里的那一份和它同起同落，波峰乘波峰是正的，波谷乘波谷也是正的，乘积加起来是一个大数。信号里别的波照样在，但和它对不上，贡献的乘积正负各半，自己抵消了。
- 它的频率信号里没有：乘积一半正一半负，加起来是 $0$。

和四个数的时候一样，还要除以“波和自己对一次”的结果。对频率为 $k$ 的余弦波，这个数是 $n/2$（$\cos^2$ 的平均值是 $1/2$）。只有 $k=0$ 和 $k=n/2$ 这两头例外：这时波的每一项不是 $1$ 就是 $-1$，平方全是 $1$，加起来是 $n$，前面的 $c_0$ 和 $c_2$ 就是这样。所以对中间的那些 $k$

$$
\text{频率 }k\text{ 的份量}=\frac{2}{n}\sum_{j=0}^{n-1}x_j\cos\frac{2\pi kj}{n}
$$

把每个频率都量一遍，得到最下面那排柱子：在 2、5、9 的位置上，高度是 1、0.6、0.4，别处都是 0。三个波的幅度，就这样从那条粗线里读了出来。这排柱子叫信号的**频谱**。

## 相位：一把尺子不够

上面的信号是特意挑的：三个波都从最高点开始，所以拿 $\cos$ 一量就准。真实的信号里，波从哪开始都有可能。

```render html
<style>
  .ft { --s1: #b85a31; --s2: #125d8e; font-size: 13px; line-height: 1.5; }
  :root[data-theme="dark"] .ft { --s1: #d57935; --s2: #409dd5; }
  .ft .view { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 16px; align-items: end; }
  .ft canvas { display: block; width: 100%; }
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
  ph.addEventListener('input', draw); am.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(root.querySelector('.view'));
})();
</script>
```

把波的起点往后挪，$\cos$ 的读数就开始变小；挪到 $90°$（四分之一圈）时，读数是 $0$，可波明明还在，幅度一点没变。这时候它成了一个 $\sin$ 波，要拿 $\sin$ 去量才量得出来。

所以每个频率要量两次，一次用 $\cos$，一次用 $\sin$。两个读数合起来才是完整的答案，因为不管起点挪了多少，这个波总能拆成一份 $\cos$ 加一份 $\sin$。这是三角函数的和角公式：

$$
A\cos(\theta-\varphi)=\underbrace{A\cos\varphi}_{\cos\text{ 的读数}}\cdot\cos\theta+\underbrace{A\sin\varphi}_{\sin\text{ 的读数}}\cdot\sin\theta
$$

$A$ 是幅度，$\varphi$ 是起点往后挪的角度。

图里带十字线的那一块，把两个读数画成了平面上的一个点：横坐标是 $\cos$ 的读数，纵坐标是 $\sin$ 的读数。起点挪得越多，这个点绕着圆转得越远，到原点的距离始终等于幅度；幅度变了，圆跟着变大变小。**点离原点多远，是这个频率有多强；点在哪个方向，是这个波从哪开始。**

一个频率的答案，是平面上的一个点。用一个数来记平面上的一个点，这正是复数的用处。

## 复数：平面上的点

规定一个新的数 $i$，它满足 $i^2=-1$。形如 $a+bi$ 的数叫**复数**，$a$、$b$ 是普通的实数，分别叫实部和虚部。

实数排在一条数轴上。复数多了一个 $b$，一条线放不下，要用平面：$a+bi$ 画在横坐标 $a$、纵坐标 $b$ 的位置。实数都在横轴上，$i$ 在原点正上方一格。

运算规则没有新东西，就当 $i$ 是个字母，按多项式那样算，碰到 $i^2$ 就换成 $-1$：

$$
\begin{aligned}
(a+bi)+(c+di)&=(a+c)+(b+d)i\\
(a+bi)(c+di)&=ac+adi+bci+bdi^2=(ac-bd)+(ad+bc)i
\end{aligned}
$$

比如 $(2+i)(4+3i)=8+6i+4i+3i^2=8+10i-3=5+10i$。

乘法在平面上有一个很直观的意思。每个复数除了用 $a$、$b$ 表示，还可以用另外两个量表示：它到原点的距离，叫**长度**；从横轴正方向逆时针转到它的**角度**。

> [!IMPORTANT]
> 两个复数相乘：长度相乘，角度相加。

先拿 $i$ 验一下。$i$ 的长度是 $1$，角度是 $90°$，所以乘 $i$ 应该是长度不变、逆时针转 $90°$。算一下：$(a+bi)\cdot i=ai+bi^2=-b+ai$，点 $(a,b)$ 变成了 $(-b,a)$，确实是转了 $90°$。$i\cdot i$ 是从 $1$ 出发转两次 $90°$，掉了个头，到了 $-1$。$i^2=-1$ 这条规定，放到平面上看一点也不怪。

> [!PROOF]- 点开看一般情况的证明
> 长度为 $r$、角度为 $\theta$ 的复数，横坐标是 $r\cos\theta$，纵坐标是 $r\sin\theta$，也就是 $r(\cos\theta+i\sin\theta)$。两个这样的数相乘：
>
> $$
> \begin{aligned}
> &r_1(\cos\alpha+i\sin\alpha)\cdot r_2(\cos\beta+i\sin\beta)\\
> ={}&r_1r_2\bigl[(\cos\alpha\cos\beta-\sin\alpha\sin\beta)+i(\sin\alpha\cos\beta+\cos\alpha\sin\beta)\bigr]\\
> ={}&r_1r_2\bigl[\cos(\alpha+\beta)+i\sin(\alpha+\beta)\bigr]
> \end{aligned}
> $$
>
> 最后一步还是和角公式。结果的长度是 $r_1r_2$，角度是 $\alpha+\beta$。

长度为 $1$ 的复数都在以原点为圆心、半径为 $1$ 的圆上，这个圆叫**单位圆**。长度是 $1$ 的数相乘，长度还是 $1$，只有角度在加。**在单位圆上，乘法就是转动。**

### 转圈的点

单位圆上角度为 $\theta$ 的点是 $\cos\theta+i\sin\theta$。让 $\theta$ 均匀地变大，这个点就在圆上匀速转圈；它的横坐标画出来是一条 $\cos$ 波，纵坐标是一条 $\sin$ 波。**$\cos$ 波和 $\sin$ 波，是同一个转圈的点的两个影子。**

把一圈分成 $n$ 等份。从 $1$ 出发逆时针数，第一个点记作 $\omega$（希腊字母 omega）：

$$
\omega=\cos\frac{2\pi}{n}+i\sin\frac{2\pi}{n}
$$

乘法是角度相加，所以 $\omega^2$ 是第二个点，$\omega^k$ 是第 $k$ 个点，$\omega^n$ 转满一圈回到 $1$。$n=8$ 时：

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

这 $n$ 个点每一个的 $n$ 次方都等于 $1$，所以叫 **$n$ 次单位根**。指数是绕着圈数的：$\omega^{k+n}=\omega^k$；倒着转的 $\omega^{-k}$ 就是 $\omega^{n-k}$。

有了它，前面的波可以写得很短。$\omega^{jk}$ 的角度是 $jk$ 份 $2\pi/n$，所以

$$
\omega^{jk}=\cos\frac{2\pi kj}{n}+i\sin\frac{2\pi kj}{n}
$$

固定 $k$，让 $j$ 从 $0$ 走到 $n-1$：这个点每次前进 $k$ 格，走完正好绕了 $k$ 圈。它的横坐标是频率 $k$ 的 $\cos$ 波，纵坐标是频率 $k$ 的 $\sin$ 波。两把尺子都在它里面了。

> [!NOTE]
> 别处常把 $\cos\theta+i\sin\theta$ 写成 $e^{i\theta}$，这是欧拉公式。在这篇文章里，把 $e^{i\theta}$ 当成“单位圆上角度为 $\theta$ 的那个点”的一个记号就够了。

## 离散傅里叶变换

把两把尺子的读数装进一个复数：$\cos$ 的读数放实部，$\sin$ 的读数放虚部，再添一个负号。

$$
X_k=\sum_{j=0}^{n-1}x_j\cos\frac{2\pi kj}{n}-i\sum_{j=0}^{n-1}x_j\sin\frac{2\pi kj}{n}
=\sum_{j=0}^{n-1}x_j\,\omega^{-jk}
$$

这就是**离散傅里叶变换**（Discrete Fourier Transform，DFT）：$n$ 个采样 $x_0,\dots,x_{n-1}$ 进去，$n$ 个复数 $X_0,\dots,X_{n-1}$ 出来。$X_k$ 说的是信号里频率 $k$ 的那一份。

那个负号是约定：拿去对的是一个**顺时针**转的点 $\omega^{-jk}$。用正号也能把两个读数装进去，只是大家都这么约定；这样一来，下一节变回去的时候正好是正号。另外，这里没有除以 $n/2$ 或 $n$，习惯上把除法留到变回去的时候一起做。

### 手算一遍

还是 $x=(5,3,-1,1)$。$n=4$ 时 $\omega=i$，$\omega^{-1}=-i$，它的各次幂是 $1,-i,-1,i$，然后循环。第 $j$ 个采样要乘 $(\omega^{-k})^j$：

$$
\begin{aligned}
X_0&=5+3+(-1)+1=8\\
X_1&=5\cdot1+3\cdot(-i)+(-1)\cdot(-1)+1\cdot i=6-2i\\
X_2&=5\cdot1+3\cdot(-1)+(-1)\cdot1+1\cdot(-1)=0\\
X_3&=5\cdot1+3\cdot i+(-1)\cdot(-1)+1\cdot(-i)=6+2i
\end{aligned}
$$

和前面的实数算法对一下：$X_0=8$ 是 $x\cdot c_0$；$X_1=6-2i$，实部的 $6$ 是 $x\cdot c_1$，虚部 $-2$ 里的那个 $2$ 是 $x\cdot s_1$；$X_2=0$ 是 $x\cdot c_2$。同样的数，换了个装法。

### 怎么读

- **$X_k$ 的长度**是这个频率有多强，**角度**是这个波从哪开始。$X_1=6-2i$ 的长度是 $\sqrt{6^2+2^2}\approx6.32$。
- 换算回幅度要除以 $n/2$：$6.32\div2=3.16$。信号里频率 1 的那部分是 3 份 $\cos$ 加 1 份 $\sin$，幅度正是 $\sqrt{3^2+1^2}\approx3.16$。
- $X_0$ 除以 $n$ 是整段信号的平均值：$8\div4=2$。
- **后一半是前一半的镜像。** $X_3=6+2i$ 和 $X_1=6-2i$ 只差虚部的符号。原因是 $\omega^{-3}=\omega^{1}$：只有 4 个采样的时候，“顺时针每次走 3 格”和“逆时针每次走 1 格”落在同样的点上，分不出来。只要信号是实数，$X_{n-k}$ 总是 $X_k$ 上下翻过来的样子。真正有内容的是 $X_0$ 到 $X_{n/2}$。
- 这也说明 $n$ 个采样最高只能分辨到频率 $n/2$：一次起伏里至少得有两个采样，才看得出它在起伏。

如果信号是每秒采 $f_s$ 次得到的，这 $n$ 个采样一共是 $n/f_s$ 秒。在这段时间里起伏 $k$ 次，就是每秒起伏 $k\cdot f_s/n$ 次。所以 $X_k$ 对应的频率是 $k\cdot f_s/n$ 赫兹。

## 逆变换：把波加回去

知道了每个频率各有多少，把它们加回去就是原来的信号：

$$
x_j=\frac1n\sum_{k=0}^{n-1}X_k\,\omega^{jk}
$$

$\omega^{jk}$ 是频率 $k$ 的转圈波，$X_k$ 是它的份量。每个波乘上自己的份量，全加起来，再除以 $n$。这叫**逆变换**。它和正变换几乎是同一个式子，只是 $\omega^{-1}$ 换成了 $\omega$（转的方向反过来），再多一次除法。

验一个。$x_1$ 要乘的是 $\omega^{k}=i^k$，也就是 $1,i,-1,-i$：

$$
x_1=\frac14\bigl[8\cdot1+(6-2i)\cdot i+0\cdot(-1)+(6+2i)\cdot(-i)\bigr]
=\frac14\bigl[8+(2+6i)+0+(2-6i)\bigr]=3
$$

另外三个照着算，得到 $5$、$-1$、$1$。虚部全都消掉了，四个数原样回来。

### 为什么一定能变回来

把正变换的式子代进逆变换的求和里（正变换里求和的字母换成 $m$，免得和 $j$ 撞上），再交换求和的顺序：

$$
\sum_{k=0}^{n-1}X_k\,\omega^{jk}
=\sum_{k=0}^{n-1}\sum_{m=0}^{n-1}x_m\,\omega^{-mk}\,\omega^{jk}
=\sum_{m=0}^{n-1}x_m\underbrace{\sum_{k=0}^{n-1}\omega^{k(j-m)}}_{S}
$$

关键是大括号里的 $S$。记 $r=\omega^{j-m}$，那么 $S=1+r+r^2+\dots+r^{n-1}$。分两种情况。

$m=j$ 时 $r=1$，每一项都是 $1$，所以 $S=n$。

$m\ne j$ 时，$j-m$ 不是 $n$ 的倍数，$r\ne1$。给 $S$ 乘上 $r$：

$$
rS=r+r^2+\dots+r^{n-1}+r^n
$$

而 $r^n=(\omega^n)^{j-m}=1$。所以 $rS$ 和 $S$ 是同样的 $n$ 项，只是换了个顺序：$rS=S$，也就是 $(r-1)S=0$。$r\ne1$，只能是 $S=0$。

画面上更好懂。$1,r,r^2,\dots,r^{n-1}$ 是单位圆上的一组点。乘 $r$ 是把它们一起转一个角度，每个点正好落到下一个点的位置上，整组点没变，它们的和也就没变。一个数转过一个不是整圈的角度还等于自己，这个数只能是 $0$：均匀排在圆上的一圈点，加起来互相抵消了。

回到上面的求和。所有 $m\ne j$ 的项都乘了 $0$，只有 $m=j$ 那一项留下来，乘的是 $n$。总和是 $n\,x_j$，除以 $n$ 就是 $x_j$。

这也是前面一直在用的那句话的证明：**不同频率的波互不干扰。** 两个不同频率的转圈波对一对，得到的正是这样一圈互相抵消的点。

## 拿它做什么

一段信号现在有了两副样子：一副是“每个时刻是多少”，一副是“每个频率有多少”，两边还能来回换。很多事情在这一边难办，换到那一边就简单了。用处大致有六类：看、改、省、传、照、算。

### 看：信号里有什么

最直接的用法，是把频谱画出来看。

- **调音器。** 对着麦克风弹一个音，做一次变换，找最高的那根柱子。标准音 A 是 440 赫兹；每秒采 44100 次、取 4096 个采样的话，相邻两格差 $44100/4096\approx10.8$ 赫兹，最高的柱子会落在第 41 格附近。
- **声谱图。** 一首歌里的频率一直在变。对整首歌做一次变换，只能知道“出现过哪些音”，不知道各在什么时候。所以实际的做法是切成几十毫秒一小段，每段做一次变换，再按时间排起来：横轴是时间，纵轴是频率，颜色深浅是份量。这张图叫声谱图。听歌识曲把图上最亮的那些点记下来当指纹去比对；语音识别的模型吃进去的，通常也是这张图，而不是原始的波形。
- **找周期。** 一串看着乱糟糟的记录，只要里面藏着周期，变换之后就会在对应的频率上冒出一根柱子。射电望远镜靠这个从噪声里找脉冲星；工厂靠它盯机器，轴承磨损了，振动的频谱上会多出特定的峰；脑电图里说的 α 波，指的是 8 到 13 赫兹这一段特别强。
- **潮汐表。** 海面的涨落，是月亮、太阳引起的若干个周期叠在一起。把一个港口多年的水位记录拆开，量出这些周期各有多少，再原样往后推，就是未来的潮汐表。19 世纪没有电脑，人们专门造了机械的潮汐预报机来做这件加法。

### 改：滤波

想去掉信号里的某一部分，只要它和其余部分在频率上是分开的，就很好办：变换过去，把不要的频率清零或者调小，再变换回来。这叫**滤波**。

最常见的是降噪。要的信号变化得慢，集中在低频；噪声忽上忽下，每个频率上都摊了一点。把高频全部清零，噪声的大头就没了，信号几乎没动：

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
  slider.addEventListener('input', draw);
  window.addEventListener('themechange', () => { theme(); draw(); });
  theme();
  new ResizeObserver(draw).observe(cv1);
})();
</script>
```

留下的频率太少，信号自己的起伏也被削掉了；留得太多，噪声又被放回来。分界定在哪，就是滤波这门手艺。

同样的办法还有很多：

- 播放器上的**均衡器**，是给每一段频率各乘一个倍数。
- 录音里固定 50 赫兹的电流嗡嗡声，只把那一格清零就行，别的声音不受影响。
- 收音机**调台**也是滤波：许多电台的信号同时叠在空气里，各占一段频率，只留下其中一段，就只剩一个台。

图片也能变换。图片是二维的：先对每一行做一次变换，再对每一列做一次，得到的是“横向、纵向每个频率各有多少”。低频是大块的明暗，高频是边缘和细节：

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

只留低频，图就糊了，下面那片细条纹最先变成一片灰：条纹又细又密，全在高频上。只留高频，大块的明暗没了，剩下的是轮廓和条纹。修图软件里的模糊和锐化，调的就是这两部分的比例。

### 省：压缩

多数信号变换之后，份量集中在少数几个频率上，剩下的都很小。只把大的那几个存下来，就能把信号差不多拼回去：

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

那几个平滑的起伏，三四个频率就拼出来了。中间那个方方正正的台阶最费劲：棱角要靠一大堆高频才凑得出来，留得不够时，台阶边上会有一圈小波纹。

- **JPEG。** 把图片切成 8×8 的小块，每块做一次余弦变换（傅里叶变换的近亲，只用 $\cos$）。人眼对高频不敏感，所以高频的份量存得很粗，很多直接成了 $0$。一张照片压到原来的十分之一左右，肉眼很难看出差别。压得太狠时冒出来的小方块，和边缘上的那圈波纹，就是这么来的。
- **MP3、AAC。** 同样变换到频率上，再多用一条听觉上的规律：一个大的声音会盖住它附近频率上小的声音，被盖住的可以不存。
- **视频。** H.264、H.265、AV1 这些编码，对画面上每个小块做的也是这一类变换。

### 传：无线通信

Wi-Fi、4G、5G 用的是同一个办法，叫 OFDM：把要发的数据分到几十个到几千个不同频率的波上，每个波的幅度和相位带几个比特，全部叠在一起同时发出去。

发送端做的正是一次**逆变换**：给定每个频率放多少，合成出一段波形。接收端做一次**正变换**，把每个频率上的数读回来。不同频率的波互不干扰，前面证过，所以叠在一起也分得开。

早期 Wi-Fi 的一次变换长度是 64，实际用了其中 52 个波；手机网络里多到上千个。每发一小段数据就要做一次变换，一部手机每秒要做成千上万次。

### 照：核磁共振和晶体

有些仪器直接量到的就是傅里叶变换，图像反而是算出来的。

- **核磁共振。** 机器采集到的每一个数，是人体断面这张“图片”的二维傅里叶变换里的一个点。把这些点采满，做一次逆变换，才是屏幕上的那张图。
- **X 射线晶体学。** X 射线穿过晶体，在底片上留下一片斑点。每个斑点有多亮，对应着晶体里电子分布的傅里叶变换在那一处有多强。DNA 的双螺旋、蛋白质的形状，都是从这种图样倒推出来的。底片只记下了强弱，没记下相位，所以倒推并不容易。
- **CT。** 从一个角度拍到的投影，做一次变换，得到的正是断面图像的二维变换里穿过中心的一条线。各个角度都拍一遍，把这些线凑齐，就能把断面算回来。

### 算：把麻烦的运算变简单

有些运算在这一边很麻烦，换到频率那一边却只是乘一下。

- **求导变成乘法。** 转圈的波 $\cos ct+i\sin ct$（$c$ 是转的快慢）对 $t$ 求导，得到的还是它自己，只多乘了一个 $ic$。所以把函数拆成这些波以后，微分方程就成了普通的代数方程。傅里叶当年就是为了解热传导的方程才想出这个办法的：把温度的分布拆成不同频率的起伏，每一种起伏各自按自己的速度衰减，越细碎的衰减得越快。今天的一些全球天气预报模式用的也是这个思路，把大气的状态拆成球面上大大小小的波来算。
- **卷积变成逐点相乘。** 模糊一张图片，是把每个像素换成它和周围像素按固定权重加起来的和。这种“每个位置都和邻居按同一套权重加一遍”的运算叫**卷积**，给声音加混响、算两个独立随机量之和的分布，做的也是它。变换过去，卷积只是对应位置相乘。两个整数相乘也是卷积，这个例子最能看出快慢，等讲完 FFT 再回来细说。
- **量子力学。** 一个粒子“在哪”和“动量是多少”，是同一个波函数的两副样子，互为傅里叶变换。一段信号不可能既很短、频率又很纯，搬到粒子上，就是不确定性原理。量子计算机分解大整数的 Shor 算法，核心也是一次量子版的傅里叶变换，用来找周期。

## FFT：把 n² 降到 n log n

上面这些用处，哪一个都等不起。照定义算，每个 $X_k$ 要 $n$ 次乘法，$n$ 个就是 $n^2$ 次。一秒钟的 CD 音质是 44100 个采样，$n^2$ 将近 20 亿；一百万个采样就是 $10^{12}$。

**快速傅里叶变换**（Fast Fourier Transform，FFT）算的是同样的 $X_k$，只要 $n\log_2n$ 步左右。它靠的是单位根的两条性质，回到那张圆的图上看：

1. **正对面的两个点互为相反数。** 多转半圈就是乘 $-1$：$\omega^{k+n/2}=-\omega^k$。图上每条虚线的两头就是这样的一对。
2. **平方之后，$n$ 个点只剩 $n/2$ 个。** 平方是角度翻倍，$(\omega^k)^2=\omega^{2k}$，正对面的两个点平方相同。剩下的 $\omega^0,\omega^2,\omega^4,\dots$（图上实心的点）仍然均匀排满一圈，它们恰好是 $n/2$ 次单位根。同样的结构，小了一号。

### 拆成两半

把定义里的求和按 $j$ 的奇偶分成两堆。偶数的 $j$ 写成 $2m$，奇数的写成 $2m+1$：

$$
X_k=\underbrace{\sum_{m=0}^{n/2-1}x_{2m}\,(\omega^2)^{-mk}}_{E_k}+\omega^{-k}\underbrace{\sum_{m=0}^{n/2-1}x_{2m+1}\,(\omega^2)^{-mk}}_{O_k}
$$

奇数那一堆里，$\omega^{-(2m+1)k}$ 拆成了 $\omega^{-k}$ 和 $(\omega^2)^{-mk}$，前者和 $m$ 无关，提到了求和号外面。

看 $E_k$。按性质 2，$\omega^2$ 是 $n/2$ 次单位根里的第一个点，所以 $E_k$ 正是“偶数位置上那 $n/2$ 个采样”的 DFT。$O_k$ 同理，是奇数位置上那 $n/2$ 个采样的 DFT。**一个长度 $n$ 的变换，拆成了两个长度 $n/2$ 的变换：**

$$
X_k=E_k+\omega^{-k}O_k
$$

长度 $n/2$ 的变换只有 $n/2$ 个输出，$k$ 却要从 $0$ 走到 $n-1$。后一半怎么办？把 $k$ 换成 $k+n/2$ 看看。$(\omega^2)^{-m(k+n/2)}=(\omega^2)^{-mk}\cdot\omega^{-mn}$，而 $\omega^n=1$，所以两个求和的值都没变；前面的 $\omega^{-(k+n/2)}$ 按性质 1 等于 $-\omega^{-k}$。于是

$$
X_{k+n/2}=E_k-\omega^{-k}O_k
$$

同样的 $E_k$ 和 $O_k$，一个相加，一个相减，一次得到两个输出。这一小步叫**蝶形运算**，名字来自它画出来的样子，后面有图。

整个算法就是：

1. 把采样按位置的奇偶分成两组；
2. 两组各做一次长度 $n/2$ 的变换。这是同一个问题，规模小一半，照同样的办法接着拆；
3. 对 $k=0,1,\dots,n/2-1$，各做一次蝶形运算；
4. 拆到只剩一个采样时，它的变换就是它自己。

要一路对半分到底，$n$ 得是 $2$ 的幂。采样数不是的话，常见的做法是在后面补 $0$。

### 用 FFT 再算一遍

$x=(5,3,-1,1)$。偶数位置是 $(5,-1)$，奇数位置是 $(3,1)$。

长度 2 的变换最简单：$n=2$ 时 $\omega=-1$，两个采样 $(p,q)$ 变成 $(p+q,\ p-q)$。所以

$$
E=(5+(-1),\ 5-(-1))=(4,\ 6),\qquad O=(3+1,\ 3-1)=(4,\ 2)
$$

合起来。$n=4$，$\omega^{-0}=1$，$\omega^{-1}=-i$：

$$
\begin{aligned}
X_0&=E_0+1\cdot O_0=4+4=8, & X_2&=E_0-1\cdot O_0=4-4=0\\
X_1&=E_1+(-i)\cdot O_1=6-2i, & X_3&=E_1-(-i)\cdot O_1=6+2i
\end{aligned}
$$

和直接按定义算的一模一样。

### 为什么快

设长度 $n$ 的变换要 $T(n)$ 步。拆和合都是 $n$ 步左右，中间是两个一半长的变换：

$$
T(n)=2\,T(n/2)+n
$$

第一层是一个长度 $n$ 的问题，第二层是两个 $n/2$，第三层是四个 $n/4$……每一层加起来都是 $n$ 步左右。长度每层减半，一共 $\log_2n$ 层，总共大约 $n\log_2n$ 步。

一百万个采样，$n$ 取 $2^{20}=1048576$：20 层，每层 $n/2$ 次蝶形运算，合计一千万次左右。照定义算是 $10^{12}$ 次。

## 写成代码

### 先照着递归写

把上面的四步原样翻译成 C++：

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

`std::polar(1.0, θ)` 给出单位圆上角度为 `θ` 的那个点。`e[k]`、`o[k]` 就是上面的 $E_k$、$O_k$。

这段代码是对的，也确实是 $n\log n$。只是每一层都要新开数组、把采样来回拷贝，实际用的写法会把递归去掉。

### 不递归：采样最后落在哪

看一下递归一路拆下去，8 个采样各自被分到了哪：

```text
第 0 层   x0  x1  x2  x3  x4  x5  x6  x7
第 1 层   x0  x2  x4  x6 | x1  x3  x5  x7
第 2 层   x0  x4 | x2  x6 | x1  x5 | x3  x7
第 3 层   x0 | x4 | x2 | x6 | x1 | x5 | x3 | x7
```

最底下一排的顺序是 $0,4,2,6,1,5,3,7$，看着没规律。把位置和下标都写成二进制：

| 位置 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 位置的二进制 | 000 | 001 | 010 | 011 | 100 | 101 | 110 | 111 |
| 倒过来读 | 000 | 100 | 010 | 110 | 001 | 101 | 011 | 111 |
| 这一格放的采样 | x0 | x4 | x2 | x6 | x1 | x5 | x3 | x7 |

**每个位置上放的，是把位置的二进制倒过来读得到的那个下标。** 道理不难：第一次拆看的是下标的最低位（偶数去左半边，奇数去右半边），第二次拆看次低位，第三次看最高位。下标的最低位决定了它在大的哪一半，最高位只决定最后一步往左还是往右，一头一尾正好反过来。这个顺序叫**位逆序**。

于是可以不递归：

1. 先把数组按位逆序重排。这时每一格是一段“长度为 1 的信号”，它的变换就是它自己。
2. 相邻的两格合成长度 2 的段，相邻的两段再合成长度 4 的段，一直合到长度 $n$。每次合并就是一批蝶形运算。

合并可以直接在原数组上做。一段的左半边放着 $E$，右半边放着 $O$；一次蝶形运算读左半边第 $k$ 格和右半边第 $k$ 格，算出来的两个数正好该写回这两格。$n=8$ 时，整个过程画出来是这样：

```render svg title="$n=8$ 的蝶形网络。左边是按位逆序排好的采样，每过一列，段长翻一倍；加粗的四条线是一次蝶形运算"
<svg viewBox="0 0 360 312" width="360" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="var(--rule-strong)" stroke-width="1.5">
    <path d="M64 40H304M64 76H304M64 112H304M64 148H304M64 184H304M64 220H304M64 256H304M64 292H304" />
    <path d="M64 40L144 76M64 76L144 40M64 112L144 148M64 148L144 112M64 184L144 220M64 220L144 184M64 256L144 292M64 292L144 256" />
    <path d="M144 40L224 112M144 112L224 40M144 76L224 148M144 148L224 76M144 184L224 256M144 256L224 184M144 220L224 292M144 292L224 220" />
    <path d="M224 40L304 184M224 184L304 40M224 76L304 220M224 220L304 76M224 112L304 256M224 256L304 112M224 148L304 292M224 292L304 148" />
  </g>
  <path d="M224 40H304M224 184H304M224 40L304 184M224 184L304 40" fill="none" stroke="currentColor" stroke-width="3" />
  <path d="M64 40h.01M144 40h.01M224 40h.01M304 40h.01M64 76h.01M144 76h.01M224 76h.01M304 76h.01M64 112h.01M144 112h.01M224 112h.01M304 112h.01M64 148h.01M144 148h.01M224 148h.01M304 148h.01M64 184h.01M144 184h.01M224 184h.01M304 184h.01M64 220h.01M144 220h.01M224 220h.01M304 220h.01M64 256h.01M144 256h.01M224 256h.01M304 256h.01M64 292h.01M144 292h.01M224 292h.01M304 292h.01" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
  <g fill="var(--muted)" font-size="12" text-anchor="middle">
    <text x="104" y="18">合成 2 格</text>
    <text x="184" y="18">合成 4 格</text>
    <text x="264" y="18">合成 8 格</text>
  </g>
  <g fill="currentColor" font-size="15" text-anchor="end">
    <text x="50" y="45">x<tspan dy="4" font-size="11">0</tspan></text>
    <text x="50" y="81">x<tspan dy="4" font-size="11">4</tspan></text>
    <text x="50" y="117">x<tspan dy="4" font-size="11">2</tspan></text>
    <text x="50" y="153">x<tspan dy="4" font-size="11">6</tspan></text>
    <text x="50" y="189">x<tspan dy="4" font-size="11">1</tspan></text>
    <text x="50" y="225">x<tspan dy="4" font-size="11">5</tspan></text>
    <text x="50" y="261">x<tspan dy="4" font-size="11">3</tspan></text>
    <text x="50" y="297">x<tspan dy="4" font-size="11">7</tspan></text>
  </g>
  <g fill="currentColor" font-size="15">
    <text x="318" y="45">X<tspan dy="4" font-size="11">0</tspan></text>
    <text x="318" y="81">X<tspan dy="4" font-size="11">1</tspan></text>
    <text x="318" y="117">X<tspan dy="4" font-size="11">2</tspan></text>
    <text x="318" y="153">X<tspan dy="4" font-size="11">3</tspan></text>
    <text x="318" y="189">X<tspan dy="4" font-size="11">4</tspan></text>
    <text x="318" y="225">X<tspan dy="4" font-size="11">5</tspan></text>
    <text x="318" y="261">X<tspan dy="4" font-size="11">6</tspan></text>
    <text x="318" y="297">X<tspan dy="4" font-size="11">7</tspan></text>
  </g>
</svg>
```

每一列有 $n/2$ 只“蝴蝶”，一共 $\log_2n$ 列。加粗的那一只读的是第 0 格和第 4 格，写回的也是第 0 格和第 4 格。

### 就地做的版本

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

标了号的四段，逐段说：

**第 1 段，位逆序。** `reversed[i]` 是 `i` 的二进制倒过来读的结果，靠已经算好的 `reversed[i >> 1]` 推出来：`i` 去掉最低位是 `i >> 1`，它的逆序已经有了；把这个逆序右移一位，腾出最高位，再把 `i` 的最低位放上去。比如 3 位二进制下 `i = 6`（110）：`i >> 1` 是 3（011），它的逆序是 6（110），右移一位得 011，`i` 的最低位是 0，所以结果是 011，也就是 3。110 倒过来确实是 011。`if (i < reversed[i])` 保证每一对只交换一次。

**第 2 段，单位根表。** `root[k]` 是 $\omega^{-k}$：角度为 $k$ 份 $2\pi/n$ 的那个点，虚部取负，就成了顺时针方向的。逆变换要的是 $\omega^{k}$，虚部不取负。只存前一半，因为后一半是前一半的相反数，蝶形运算里用减法代替了。每个根都直接用 `cos`、`sin` 算，没有写成“上一个再乘一次 $\omega$”：连乘一百万次，舍入误差会一路攒下来。

**第 3 段，合并。** 最外层的 `len` 是这一轮合并出来的段长，`start` 是每一段的开头，`k` 是段内的位置。长度为 `len` 的段要用的是 `len` 次单位根，它的间隔是 $n$ 次单位根间隔的 `n / len` 倍，所以每隔 `stride = n / len` 个取一个：`root[k * stride]`。里面四行就是那两条公式：`even` 是 $E_k$，`odd` 是 $\omega^{-k}O_k$，一加一减，写回原位。

**第 4 段，除以 $n$。** 只有逆变换要做。

`fft(a, false)` 是正变换，`fft(a, true)` 是逆变换。把 $(5,3,-1,1)$ 放进去做一次正变换，出来是 $(8,\ 6-2i,\ 0,\ 6+2i)$。

## 用 FFT 乘两个大整数

前面说过，两个整数相乘是卷积，可以绕到频率那边去算。现在有了 `fft`，把这件事做完。两个一百万位的整数相乘，列竖式要做 $10^{12}$ 次一位数乘法，在我的笔记本上跑了 5 分钟；用上面那个 `fft`，半秒。

### 竖式其实是卷积

先列一遍 $12\times34$ 的竖式，但做一处改动：**每一列先不进位**，是多少就写多少。

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

第三行是 $4\times12$，第四行是 $3\times12$，往左错一位。最后一行把每一列加起来：个位那一列是 $8$，十位那一列是 $4+6=10$，百位是 $3$。十位上写了个 $10$，不合规矩，但意思没错：$3\times100+10\times10+8=408$。全部算完再从右往左进位，$10$ 留 $0$ 进 $1$，百位变成 $4$，结果是 $408$。

哪些乘积会落进同一列？把数位从右往左编号，个位是第 $0$ 位，十位是第 $1$ 位。$12$ 的各位是 $a_0=2$、$a_1=1$，$34$ 的各位是 $b_0=4$、$b_1=3$。第 $i$ 位的数字乘第 $j$ 位的数字，落在第 $i+j$ 列，所以第 $k$ 列收下的是所有下标加起来等于 $k$ 的那几对：

$$
c_k=\sum_{i+j=k}a_ib_j
\qquad\qquad
\begin{aligned}
c_0&=a_0b_0=8\\
c_1&=a_0b_1+a_1b_0=6+4=10\\
c_2&=a_1b_1=3
\end{aligned}
$$

这种“下标之和相同的凑成一组”的运算，就是前面说的**卷积**：把 $34$ 的各位当成一套权重，每一列都是 $12$ 的几位数字按这套权重加起来的和。两个 $n$ 位数有 $n^2$ 对数字，每一对都要乘一次，竖式慢在这里；进位只是从低位到高位扫一遍。**大整数乘法，就是两串数字的卷积，再加一次进位。**

### 卷积变换过去，是逐点相乘

把一串数字当成一个多项式的系数：

$$
A(x)=a_0+a_1x+a_2x^2+\cdots
$$

$12$ 对应 $A(x)=2+x$，把 $x=10$ 代进去就是 $12$ 本身。两个这样的多项式相乘，$x^i\cdot x^j=x^{i+j}$，系数正好是按“下标之和相同的凑一组”合并的：

$$
(2+x)(4+3x)=8+6x+4x+3x^2=8+10x+3x^2
$$

**多项式相乘，系数做的就是卷积。**

再看 DFT 的定义，把 $\omega^{-k}$ 当成一个整体：

$$
X_k=\sum_{j}a_j\,\omega^{-jk}=\sum_{j}a_j\,(\omega^{-k})^j=A(\omega^{-k})
$$

**对一串数字做 DFT，就是求这个多项式在 $n$ 个单位根上的值。** 而多项式相乘的时候，每个位置上的值是各算各的：$C(x)=A(x)B(x)$，在任何一个 $x$ 上，$C$ 的值都是 $A$ 的值乘 $B$ 的值。所以

$$
\underbrace{C(\omega^{-k})}_{\text{卷积的变换}}=\underbrace{A(\omega^{-k})}_{a\text{ 的变换}}\cdot\underbrace{B(\omega^{-k})}_{b\text{ 的变换}}
$$

两串数的卷积，变换之后等于它们各自的变换逐点相乘。这叫**卷积定理**。于是卷积可以绕路来算：

1. 两串数各做一次 FFT；
2. 对应位置相乘，一共 $n$ 次乘法；
3. 做一次逆 FFT，得到卷积。

三次变换各是 $n\log n$ 步，中间 $n$ 步。原来的 $n^2$ 没有了。

### 把 12 × 34 走一遍

结果有 $2+2-1=3$ 个系数，$n$ 取 $4$，两串数字在后面补 $0$。四个位置 $\omega^{-k}$ 依次是 $1,-i,-1,i$：

| 步骤 | 做什么 | 结果 |
| --- | --- | --- |
| 1 | 数字从低位排起，补 $0$ 到 4 格 | $(2,1,0,0)$ 和 $(4,3,0,0)$ |
| 2 | 各做一次 FFT | $(3,\,2-i,\,1,\,2+i)$ 和 $(7,\,4-3i,\,1,\,4+3i)$ |
| 3 | 对应位置相乘 | $(21,\,5-10i,\,1,\,5+10i)$ |
| 4 | 做一次逆 FFT | $(8,10,3,0)$ |
| 5 | 从低位到高位进位 | $8$；$10$ 留 $0$ 进 $1$；$3+1=4$。读出来是 $408$ |

第 2 步就是把四个位置代进 $2+x$ 和 $4+3x$。第 3 步里，$(2-i)(4-3i)=8-6i-4i+3i^2=5-10i$。第 4 步拿 $c_1$ 验一下，逆变换要乘的是 $i^k$，也就是 $1,i,-1,-i$：

$$
c_1=\frac14\bigl[21\cdot1+(5-10i)\cdot i+1\cdot(-1)+(5+10i)\cdot(-i)\bigr]
=\frac14\bigl[21+(10+5i)-1+(10-5i)\bigr]=10
$$

两个整数相乘，中间绕到了复数上，最后虚部全消掉，回到整数。

### 代码

接在前面的 `fft` 后面，合起来是一个完整的程序：读入两个十进制整数，输出它们的积。按 C++20 编译。

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

`multiply` 就是上面那张表。`n` 取不小于两个数位数之和的 $2$ 的幂，比系数的个数多出来的一格，正好留给最高位的进位。逆变换出来的是带一点误差的小数，比如 `7.999999999` 或 `8.000000001`，`std::llround` 把它取到最近的整数；虚部应该是 $0$，直接丢掉。

和竖式比一下。两个随机数，都是一位数字占一格，`g++ -O2`：

| 位数 | 竖式 | FFT |
| --- | --- | --- |
| 1 万 | 0.027 秒 | 0.005 秒 |
| 10 万 | 2.8 秒 | 0.05 秒 |
| 100 万 | 308 秒 | 0.55 秒 |

位数每多 10 倍，竖式慢 100 倍，FFT 只慢 10 倍多一点。

### 两个要当心的地方

**$n$ 不能取小。** 取小了不会报错，只会算错。比如硬用 $n=2$ 算 $12\times34$，两个位置是 $1$ 和 $-1$：$C(1)=3\times7=21$，$C(-1)=1\times1=1$，变回去是 $c_0=(21+1)/2=11$，$c_1=(21-1)/2=10$。真正的系数是 $8,10,3$：最高的那个 $3$ 叠到了 $c_0$ 上，$8+3=11$。原因是在这两个位置上 $x^2$ 都等于 $1$，这组点分不清 $x^2$ 和常数项。一般地，$n$ 个单位根都满足 $x^n=1$，放不下的高次项会绕回来叠在低位上，这叫循环卷积。

**浮点数有误差。** `cos`、`sin` 算出来的是小数，每一次加减乘都有一点舍入误差。程序最后靠四舍五入把误差抹掉，这只在误差小于 $0.5$ 的时候才对。`double` 大约能记住 15 到 16 位十进制有效数字。一位数字占一格时，卷积出来的数最大是 $81$ 乘以位数（每一列最多有“位数”那么多个 $9\times9$），两个一百万位的数是八千万，占 8 位，还剩七八位留给误差，很宽裕。

想更快，可以一格多放几位数字，数组短了，但每个数变大了，留给误差的位数就少了。同样两个一百万位、每一位都是 9 的数：

| 每格放几位 | 变换长度 | 卷积里最大的数 | 离整数最远偏了多少 |
| --- | --- | --- | --- |
| 1 | $2^{21}$ | $8.1\times10^{7}$ | $5\times10^{-8}$ |
| 2 | $2^{20}$ | $4.9\times10^{9}$ | $3\times10^{-6}$ |
| 3 | $2^{20}$ | $3.3\times10^{11}$ | $3\times10^{-4}$ |
| 4 | $2^{19}$ | $2.5\times10^{13}$ | $0.02$ |
| 5 | $2^{19}$ | $2.0\times10^{15}$ | $0.5$，结果错了 |

每格 4 位还行，5 位就错了，而且错的时候同样不报任何错。用浮点 FFT 做乘法，得先算清楚数最大能到多少，留足余量。

### 不用浮点数的版本：NTT

回头看，`fft` 用了 $\omega$ 的哪些性质？$\omega^n=1$；$\omega^{n/2}=-1$；能做加、减、乘，最后还能除以 $n$。没有哪一条要求它是复数。**模一个质数的整数**里，也找得到这样的数。

在模 $p$ 的世界里，数只有 $0,1,\dots,p-1$，加、减、乘之后都除以 $p$ 取余数。除以 $n$ 是乘上 $n$ 的逆元，也就是那个和 $n$ 相乘余 $1$ 的数；按费马小定理，它等于 $n^{p-2}$。

拿 $p=17$ 看看。把 $3$ 的各次幂模 $17$ 列出来：

| $k$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| $3^k \bmod 17$ | 1 | 3 | 9 | 10 | 13 | 5 | 15 | 11 | 16 | 14 | 8 | 7 | 4 | 12 | 2 | 6 | 1 |

从 $1$ 出发，每乘一次 $3$ 走一格，走 16 格回到 $1$，中间把 $1$ 到 $16$ 每个数恰好经过一次。这 16 个数就像圆上均匀排开的 16 个点，**乘 $3$ 就是往前转一格**。走到一半（$k=8$）是 $16$，也就是 $-1$。像 $3$ 这样，各次幂能把 $1$ 到 $p-1$ 走遍的数，叫 $p$ 的一个**原根**。

要 4 个点，就在这一圈 16 格里每隔 4 格取一个：$3^0,3^4,3^8,3^{12}$，也就是 $1,13,16,4$。$13$ 在这里扮演的就是单位根：$13^2=169=9\times17+16$，余 $16$，是 $-1$；$13^4$ 余 $1$。

用它把 $12\times34$ 再算一遍，所有运算都模 $17$：

| 位置 $x$ | $1$ | $13$ | $16$ | $4$ |
| --- | --- | --- | --- | --- |
| $A(x)=2+x$ | $3$ | $15$ | $1$ | $6$ |
| $B(x)=4+3x$ | $7$ | $9$ | $1$ | $16$ |
| $C(x)=A(x)B(x)$ | $4$ | $16$ | $1$ | $11$ |

比如 $B(13)=4+39=43$，$43-2\times17=9$；$C(13)=15\times9=135$，$135-7\times17=16$。

逆变换往回转，用 $13$ 的逆元 $4$（$13\times4=52=3\times17+1$），它的各次幂是 $1,4,16,13$；最后“除以 4”是乘 $4$ 的逆元，碰巧又是 $13$。拿 $c_1$ 来说：

$$
c_1=13\times(4\times1+16\times4+1\times16+11\times13)=13\times227\equiv10\pmod{17}
$$

四个都算出来还是 $(8,10,3,0)$。这一次从头到尾都是整数，没有四舍五入，也就没有误差。这种在模质数下做的变换叫**数论变换**（Number Theoretic Transform，NTT）。

模数不能随便挑，有两个条件：

- **圈长要能被 $n$ 整除。** 那一圈有 $p-1$ 个数，要每隔 $(p-1)/n$ 格取一个，$n$ 得整除 $p-1$。$n$ 是 2 的幂，所以 $p-1$ 里要有足够多的因子 $2$。
- **卷积出来的数要小于 $p$。** 算出来的只是除以 $p$ 的余数；数本身不到 $p$，余数才等于它。上面的 $8,10,3$ 都小于 $17$，所以对了。

最常用的模数是 $998244353=119\times2^{23}+1$。它是质数，$3$ 是它的一个原根，$n$ 最大可以取到 $2^{23}=8388608$。一位数字占一格时，卷积出来的数最大是 $81$ 乘以较短那个数的位数，两个数加起来不超过八百多万位的话，离它还远。

代码和 FFT 版几乎逐行对应，只换了三处：单位根改成 $3^{(p-1)/n}$ 的各次幂；加、减、乘都取模；除以 $n$ 改成乘 $n$ 的逆元。最后也不用取整了。

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

这里的单位根表是连乘出来的：整数取模没有舍入，乘多少次都是准的。它也更快，整数乘一次再取模，比复数乘法便宜。上面那张表里的三组数据，NTT 版分别是 0.0014 秒、0.015 秒和 0.19 秒。

### 实际的大整数库

FFT 不是什么时候都最快。它每一步都比竖式的一步贵，数不够大的时候不划算。GMP 这样的大整数库是按位数分档的：小的数用竖式；中等的用 Karatsuba 算法（1960 年提出，把两个数各切成两半，用三次一半长的乘法代替四次，大约 $n^{1.585}$ 步）和它的推广；足够大才换成基于 FFT 的算法。

用 FFT 做整数乘法，是 Schönhage 和 Strassen 在 1971 年做成的，复杂度是 $n\log n\log\log n$。2019 年，Harvey 和 van der Hoeven 把它降到了 $n\log n$，不过那个算法要在位数大到天文数字时才占优，没有人真的拿它来算。

## 连续的那个式子

开头说的那个积分，现在可以认出来了。采样取得越来越密、信号取得越来越长，求和就变成积分，一格一格的频率 $k$ 变成可以取任何值的 $\omega$。这里的 $\omega$ 表示每秒转过多少弧度，和前面的单位根只是恰好用了同一个字母：

$$
F(\omega)=\int_{-\infty}^{+\infty}f(t)\,e^{-i\omega t}\,\mathrm{d}t
$$

和 DFT 逐项对照：$f(t)$ 是信号，对应 $x_j$；$e^{-i\omega t}=\cos\omega t-i\sin\omega t$ 是顺时针转圈的点，对应 $\omega^{-jk}$；积分是“全部加起来”。说的还是那句话：**拿一个转圈的波去乘信号，再全部加起来，看还剩多少。**

1807 年，傅里叶在研究热怎么在金属里传导时提出，任何函数都能拆成一堆正弦和余弦的和。当时不少数学家不信；后来的一百多年里，这个想法被一步步证明、推广，成了分析信号的基本工具。

电脑里处理的永远是有限个采样，所以真正被算了无数遍的，是这篇文章讲的离散版本，和把它算快的 FFT。FFT 是 Cooley 和 Tukey 在 1965 年发表之后才广为人知的；后来人们发现，高斯 1805 年前后的手稿里已经有了同样的办法，只是没有发表。

## 延伸阅读

- 3Blue1Brown 的视频 *But what is the Fourier Transform? A visual introduction*。把信号“绕到圆上”的画面讲得最好。
- Reducible 的视频 *The Fast Fourier Transform (FFT): Most Ingenious Algorithm Ever?*。从多项式乘法出发讲 FFT。
- [CP-Algorithms：Fast Fourier transform](https://cp-algorithms.com/algebra/fft.html)。实现细节、NTT 和各种精度技巧都有。
- [OI Wiki：快速傅里叶变换](https://oi-wiki.org/math/poly/fft/)。中文，偏竞赛。
- 《算法导论》第 30 章“多项式与快速傅里叶变换”。证明写得最完整。
- Steven W. Smith，*The Scientist and Engineer's Guide to Digital Signal Processing*。信号处理那一边的入门书，网上可以免费读。
