---
title: "P6327 题解：区间加法怎样更新 sin 和"
description: "把正弦和与余弦和一起维护，从单位圆的旋转理解区间加法，再推到线段树更新公式。"
pubDate: 2024-10-25T17:34:00+08:00
updatedDate: 2026-10-20
tags: ["题解", "线段树", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/P6327)。每次给一段数都加上 $d$，或者查询这一段的 $\sum\sin a_i$，角度按弧度计算。

只存正弦和无法更新：$\sin(a+d)$ 还依赖 $\cos a$，所以节点要把两者一起存。

## 把区间加法看成旋转

每个角度对应向量 $(\cos a,\sin a)$。加上 $d$，由两角和公式：

$$
\begin{aligned}
\sin(a+d)&=\sin a\cos d+\cos a\sin d,\\
\cos(a+d)&=\cos a\cos d-\sin a\sin d.
\end{aligned}
$$

对整个区间求和，记 $S=\sum\sin a_i$、$C=\sum\cos a_i$，就得到合向量的旋转：

$$
\begin{aligned}
S'&=S\cos d+C\sin d,\\
C'&=C\cos d-S\sin d.
\end{aligned}
$$

```render html
<style>
  .rotation-lab { --cosine: #386f9b; --sine: #36755d; padding-block: 8px; }
  :root[data-theme="dark"] .rotation-lab { --cosine: #8ebce2; --sine: #8ac9ab; }
  .rotation-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 28px; align-items: center; }
  .rotation-drawing svg { display: block; width: 100%; }
  .rotation-readout { display: grid; gap: 22px; }
  .rotation-readout p { margin: 0; font-size: 14px; line-height: 1.9; }
  .rotation-readout strong { display: block; margin-bottom: 3px; font: 29px var(--font-mono); }
  .rotation-c { color: var(--cosine); }
  .rotation-s { color: var(--sine); }
  .rotation-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; font-size: 14px; }
  .rotation-controls input { flex: 1; min-width: 130px; min-height: 44px; accent-color: var(--accent); }
  .rotation-controls output { min-width: 70px; text-align: right; font: 14px var(--font-mono); }
  @media (max-width: 520px) { .rotation-layout { grid-template-columns: 1fr; gap: 8px; } .rotation-readout { grid-template-columns: 1fr 1fr; gap: 12px; } .rotation-readout strong { font-size: 24px; } .rotation-readout p { font-size: 12px; } }
</style>
<section class="rotation-lab" aria-label="合向量旋转及其正弦、余弦投影">
  <div class="rotation-layout"><div class="rotation-drawing"></div><div class="rotation-readout" aria-live="polite"><p class="rotation-c">C′<strong></strong></p><p class="rotation-s">S′<strong></strong></p></div></div>
  <label class="rotation-controls">旋转 d <input type="range" min="-180" max="180" value="60" aria-label="旋转角度"><output></output></label>
</section>
<script>
  const input = document.querySelector('input'), drawing = document.querySelector('.rotation-drawing');
  function draw() {
    const w = drawing.clientWidth, cx = w/2, cy = 144, radius = Math.min(116,(w-64)/2);
    const original = Math.atan2(.4,1.2), d = Number(input.value)*Math.PI/180, angle = original+d;
    const c = 1.2*Math.cos(d)-.4*Math.sin(d), s = .4*Math.cos(d)+1.2*Math.sin(d);
    const scale = radius/Math.hypot(1.2,.4), x = cx+c*scale, y = cy-s*scale;
    const oldX = cx+1.2*scale, oldY = cy-.4*scale, r = radius*.55;
    const arc = `M${cx+r*Math.cos(original)} ${cy-r*Math.sin(original)} A${r} ${r} 0 ${Math.abs(d)>Math.PI?1:0} ${d<0?1:0} ${cx+r*Math.cos(angle)} ${cy-r*Math.sin(angle)}`;
    drawing.innerHTML = `<svg viewBox="0 0 ${w} 290" role="img" aria-label="原合向量旋转 ${d.toFixed(2)} 弧度后，C 为 ${c.toFixed(3)}，S 为 ${s.toFixed(3)}">
      <defs><marker id="rotation-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker></defs>
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="var(--rule)"/>
      <path d="M12 ${cy}H${w-12}M${cx} 12V276" stroke="var(--rule-strong)"/>
      <text x="${w-12}" y="${cy+22}" text-anchor="end" fill="var(--cosine)" font-size="13">C</text><text x="${cx+12}" y="20" fill="var(--sine)" font-size="13">S</text>
      <path d="M${cx} ${cy}L${oldX} ${oldY}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4"/>
      <path d="M${x} ${cy}V${y}H${cx}" fill="none" stroke="var(--rule-strong)" stroke-dasharray="3 4"/>
      <path d="M${cx} ${cy}H${x}" stroke="var(--cosine)" stroke-width="3"/><path d="M${cx} ${cy}V${y}" stroke="var(--sine)" stroke-width="3"/>
      <path d="${arc}" fill="none" stroke="var(--accent)" stroke-width="1.2" marker-end="url(#rotation-head)"/>
      <path d="M${cx} ${cy}L${x} ${y}" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#rotation-head)"/>
      <circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/>
      <text x="${cx+Math.cos(original+d/2)*(r+14)}" y="${cy-Math.sin(original+d/2)*(r+14)+4}" fill="var(--accent-ink)" font-size="14">d</text>
      <text x="${(cx+x)/2}" y="${cy+20}" text-anchor="middle" fill="var(--cosine)" font-size="13">C′</text><text x="${cx-10}" y="${(cy+y)/2}" text-anchor="end" fill="var(--sine)" font-size="13">S′</text>
    </svg>`;
    document.querySelector('.rotation-c strong').textContent = c.toFixed(3);
    document.querySelector('.rotation-s strong').textContent = s.toFixed(3);
    document.querySelector('output').textContent = `${d.toFixed(2)} rad`;
  }
  input.addEventListener('input',draw);
  new ResizeObserver(draw).observe(drawing);
</script>
```

合并孩子时，$S$、$C$ 分别相加，不需要区间长度。

## 懒标记只记角度增量

连续旋转 $d_1$、$d_2$，等于旋转 $d_1+d_2$，标记直接相加。下传给两个孩子后，清空父标记。

## 代码

```cpp
#include <cmath>

struct Node {
    double s = 0, c = 0;
    long long lazy = 0;
};

void apply(Node& node, long long d) {
    double sn = std::sin(d), cs = std::cos(d);
    double s = node.s, c = node.c;
    node.s = s * cs + c * sn;
    node.c = c * cs - s * sn;
    node.lazy += d;
}

Node merge(Node left, Node right) {
    return {left.s + right.s, left.c + right.c, 0};
}
```

更新两项时都要使用**旧的 $S$、$C$**，不能先覆盖 `node.s`，再拿新值算 `node.c`。查询输出按题目要求保留一位小数；累计角度用 `long long`，和与三角函数使用 `double`。

建树 $O(n)$，单次修改、查询 $O(\log n)$，空间 $O(n)$。

本文原发表于[洛谷专栏](https://www.luogu.com.cn/article/e0a4pppn)。
