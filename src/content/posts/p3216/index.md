---
title: "P3216 题解：数字拼接也能用矩阵快速幂"
description: "把 1 到 $n$ 拼起来再取模。$n$ 太大，就按位数分段用矩阵快速幂。"
pubDate: 2024-11-11T23:47:00+08:00
updatedDate: 2026-10-20
tags: ["题解", "矩阵快速幂", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/P3216)。把 $1,2,\ldots,n$ 依次拼起来，求这个大整数模 $m$ 的余数。

拼上一个 $k$ 位数，就是原结果乘 $10^k$ 再加它，全程可以取模。$n$ 很大时，再用矩阵快速幂跳过逐个拼接。

## 状态里为什么还要放当前数字

记拼到 $i$ 的结果为 $a_i$，若 $i$ 有 $k$ 位，则

$$
a_i=10^k a_{i-1}+i.
$$

只有 $a_i$ 还不够，因为加上的 $i$ 每次也在变化。把当前数字一起放进状态，再补一个常数 $1$，就能表达“加一”：

$$
\begin{pmatrix}a_{i-1}&i-1&1\end{pmatrix}
\underbrace{\begin{pmatrix}
10^k&0&0\\
1&1&0\\
1&1&1
\end{pmatrix}}_{T_k}
=\begin{pmatrix}a_i&i&1\end{pmatrix}.
$$

```render html
<style>
  .concat-lab { --selected: #386f9b; padding-block: 8px; }
  :root[data-theme="dark"] .concat-lab { --selected: #8ebce2; }
  .concat-instruction { margin: 0 0 22px; color: var(--muted); font-size: 13px; }
  .concat-product { display: grid; grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1.1fr) 20px minmax(0, 1fr); gap: 10px; align-items: center; }
  .concat-vector { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 3px; text-align: center; }
  .concat-vector small { color: var(--muted); font-size: 12px; }
  .concat-vector b { display: grid; place-items: center; min-height: 44px; border-block: 1px solid var(--rule-strong); font: 15px var(--font-mono); }
  .concat-matrix { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-inline: 1px solid var(--rule-strong); padding-inline: 4px; }
  .concat-matrix span { display: grid; place-items: center; min-height: 40px; font: 15px var(--font-mono); }
  .concat-matrix .on { background: color-mix(in srgb, var(--selected) 12%, transparent); color: var(--selected); }
  .concat-result button { min-height: 44px; border: 0; border-bottom: 2px solid transparent; border-top: 1px solid var(--rule-strong); border-radius: 0; padding: 0; background: none; font: 15px var(--font-mono); cursor: pointer; }
  .concat-result button[aria-pressed="true"] { color: var(--selected); border-bottom-color: var(--selected); }
  .concat-operator { text-align: center; color: var(--muted); font-size: 20px; }
  .concat-equation { display: block; margin-top: 26px; text-align: center; font-size: 16px; line-height: 1.9; }
  .concat-equation small { display: block; color: var(--muted); font-size: 13px; }
  @media(max-width:600px) {
    .concat-product { grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr); gap: 10px 6px; }
    .concat-result { grid-column: 1 / -1; width: min(280px, 100%); justify-self: center; }
    .concat-equals { grid-column: 1 / -1; }
    .concat-vector { grid-template-columns: 1.3fr 1fr 1fr; }
    .concat-vector b, .concat-matrix span, .concat-result button { font-size: 14px; }
  }
</style>
<section class="concat-lab" aria-label="点选结果项，查看矩阵对应列怎样计算状态">
  <p class="concat-instruction">123 后拼上 4。点选结果项，查看对应的矩阵列。</p>
  <div class="concat-product"><div class="concat-vector concat-input"></div><span class="concat-operator">$\times$</span><div class="concat-matrix"></div><span class="concat-operator concat-equals">$=$</span><div class="concat-vector concat-result"></div></div>
  <output class="concat-equation" aria-live="polite"></output>
</section>
<script>
  const input = document.querySelector('.concat-input'), matrix = document.querySelector('.concat-matrix'), result = document.querySelector('.concat-result');
  let column = 0;
  const next = 4;
  function draw() {
    const shift = 10, previous = 3, output=[123*shift+next,next,1];
    const entries=[[shift,0,0],[1,1,0],[1,1,1]];
    input.innerHTML=['$a$','$i$','$1$'].map(label=>`<small>${label}</small>`).join('')+[123,previous,1].map(value=>`<b>${value}</b>`).join('');
    matrix.innerHTML=entries.map(row=>row.map((value,j)=>`<span class="${j===column?'on':''}">${value}</span>`).join('')).join('');
    result.innerHTML=['新 $a$','新 $i$','$1$'].map(label=>`<small>${label}</small>`).join('')+output.map((value,j)=>`<button type="button" data-column="${j}" aria-pressed="${j===column}" aria-label="查看${['新拼接值','下一个数字','常数项'][j]}的计算">${value}</button>`).join('');
    const equations=[`$123 \\times ${shift} + ${previous} \\times 1 + 1 \\times 1 = ${output[0]}$`,`$${previous} \\times 1 + 1 \\times 1 = ${next}$`,'$1 \\times 1 = 1$'];
    const notes=['先腾出位数，再加上 $i + 1$','把 $i$ 也放进状态，下一次才知道该拼哪个数','保留常数 $1$，才能表达“加一”'];
    document.querySelector('output').innerHTML=`${equations[column]}<small>${notes[column]}</small>`;
    result.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{column=Number(button.dataset.column);draw();result.querySelector(`[data-column="${column}"]`).focus({preventScroll:true});}));
  }
  draw();
</script>
```

## 同一位数的数字，用同一个矩阵

同一位数段内 $T_k$ 不变，连续拼接 $t$ 个数，就右乘 $T_k^t$。例如拼到 $13$：

$$
(0,0,1)\,T_1^9\,T_2^4.
$$

从状态 $(0,0,1)$ 出发，按顺序处理每一段。一般地，$k$ 位数这一段从 $10^{k-1}$ 到 $\min(n,10^k-1)$，两端都包含，所以次数是“右端点 − 左端点 + 1”。

处理完后，状态第一项就是答案。

## 代码

下面给出独立实现，按题目的 $n\le10^{18}$、$m\le10^9$ 使用 64 位整数。`lo * 10` 用无符号 64 位保存，避免在最后一组计算 $10^{19}$ 时超出有符号范围。

<details>
<summary>展开完整实现（输入 n 和 m）</summary>

```cpp
#include <algorithm>
#include <array>
#include <iostream>

using u64 = unsigned long long;
using Mat = std::array<std::array<long long, 3>, 3>;
long long mod;

Mat multiply(const Mat& a, const Mat& b) {
    Mat c{};
    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 3; ++j)
            for (int k = 0; k < 3; ++k)
                c[i][j] = (c[i][j] + a[i][k] * b[k][j]) % mod;
    return c;
}

Mat power(Mat a, u64 e) {
    Mat result{};
    for (int i = 0; i < 3; ++i) result[i][i] = 1;
    while (e) {
        if (e & 1) result = multiply(result, a);
        a = multiply(a, a);
        e >>= 1;
    }
    return result;
}

int main() {
    u64 n;
    std::cin >> n >> mod;
    Mat state{};
    state[0][2] = 1;
    for (u64 lo = 1; lo <= n; lo *= 10) {
        u64 hi = std::min(n, lo * 10 - 1);
        Mat t{{{{static_cast<long long>(lo * 10 % mod), 0, 0}},
               {{1, 1, 0}}, {{1, 1, 1}}}};
        state = multiply(state, power(t, hi - lo + 1));
    }
    std::cout << state[0][0] << '\n';
}
```

</details>

每段对固定的 $3\times3$ 矩阵做快速幂，保守计总时间 $O(\log^2 n)$、额外空间 $O(1)$。可以用 $n=9,10,13$ 对照逐个拼接，检查跨位数边界和最后一段的长度。
