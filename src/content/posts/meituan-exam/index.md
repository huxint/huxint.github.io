---
title: "美团笔试：两数乘积的最大因子数"
description: "10 道大模型题、1 道算法题、1 道 AI Coding。记录一下那道求两数乘积最大因子数的题。"
pubDate: 2026-10-14
updatedDate: 2026-10-20
tags: ["秋招", "面试复盘", "算法", "数论", "C++"]
---

这次美团笔试有 10 道大模型相关的题，一道算法题，还有一道 AI Coding。

算法题最后过了，但我一直觉得哪里写歪了：合并质数指数的时候多写了一些，居然也没挂。当时没来得及细想，回来补一下。

## 题意

题目给一个长度为 $n$ 的正整数数组 $a$，$n\le 1000$，$a_i\le 10^9$。选两个下标 $i,j$，求 $a_i a_j$ 的因子个数的最大值。

如果一个正整数的质因数分解为

$$
x=p_1^{e_1}p_2^{e_2}\cdots p_k^{e_k},
$$

那么它的正因子个数为

$$
d(x)=\prod_{t=1}^{k}(e_t+1).
$$

每个质因子的指数可以从 $0$ 取到 $e_t$，有 $e_t+1$ 种选法；不同质数之间互不影响，所以直接乘起来就行。

对于两个数的乘积，只需要把相同质因子的指数相加。设质数 $p$ 在两个数中的指数分别为 $\alpha_p$、$\beta_p$，没有出现时指数为 $0$，则

$$
d(a_i a_j)=\prod_{p\mid a_i a_j}(\alpha_p+\beta_p+1).
$$

## 先把每个数拆开

$n\le 1000$，枚举所有数对完全来得及。关键不是枚举，而是别每枚举一对就重新分解一次乘积。

乘积最大能到 $10^{18}$，但每个原数最多只有 $10^9$。先把每个 $a_i$ 分解好，后面只合并指数，就省掉了分解大数这一步。

按原记录允许 $i=j$，枚举 $0\le i\le j<n$；合并两份指数表，取最大计数。

以 $12\times18=2^3\times3^3$ 为例。点选表中一个因子，看它对应哪组指数：

```render html
<style>
  .divisor-lab { --two: #386f9b; --three: #36755d; padding-block: 8px; }
  :root[data-theme="dark"] .divisor-lab { --two: #8ebce2; --three: #8ac9ab; }
  .divisor-product { margin: 0 0 20px; text-align: center; font: 22px var(--font-mono); }
  .divisor-product .two { color: var(--two); } .divisor-product .three { color: var(--three); }
  .divisor-choices { display: grid; grid-template-columns: 48px repeat(4, minmax(0, 1fr)); gap: 4px; width: min(100%, 420px); margin-inline: auto; }
  .divisor-choices small { display: flex; align-items: baseline; justify-content: center; min-height: 34px; padding-top: 10px; color: var(--three); font: 13px var(--font-mono); }
  .divisor-choices .divisor-row { color: var(--two); }
  .divisor-choices sup { font-size: 12px; position: relative; top: -.35em; }
  .divisor-choices button { min-height: 44px; padding: 0; border: 0; border-bottom: 1px solid var(--rule); border-radius: 0; background: none; font: 16px var(--font-mono); cursor: pointer; }
  .divisor-choices button[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent); }
  .divisor-choice { display: block; margin-top: 22px; text-align: center; font-size: 15px; }
</style>
<section class="divisor-lab" aria-label="从质因子指数的选择枚举 216 的因子">
  <p class="divisor-product">12 × 18 = <span class="two">2³</span> × <span class="three">3³</span></p>
  <div class="divisor-choices"></div><output class="divisor-choice" aria-live="polite"></output>
</section>
<script>
  const grid=document.querySelector('.divisor-choices');
  let row=2, column=1;
  function draw() {
    grid.innerHTML='<span></span>'+[0,1,2,3].map(j=>`<small>3<sup>${j}</sup></small>`).join('')+[0,1,2,3].map(i=>`<small class="divisor-row">2<sup>${i}</sup></small>`+[0,1,2,3].map(j=>`<button type="button" data-cell="${i}:${j}" aria-pressed="${i===row&&j===column}" aria-label="2 的 ${i} 次方乘 3 的 ${j} 次方">${2**i*3**j}</button>`).join('')).join('');
    document.querySelector('output').innerHTML=`2<sup>${row}</sup> × 3<sup>${column}</sup> = ${2**row*3**column}　·　4 × 4 = 16 个因子`;
    grid.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{[row,column]=button.dataset.cell.split(':').map(Number);draw();grid.querySelector(`[data-cell="${row}:${column}"]`).focus({preventScroll:true});}));
  }
  draw();
</script>
```

分解表按质数排序，用双指针合并；相同质数的指数相加。

每个分解表其实都很短。前 $9$ 个质数乘起来是 $223092870$，再乘上 $29$ 就超过 $10^9$ 了，所以一个数最多只有 $9$ 种不同质因子。两两合并时，最多也就扫 $18$ 项。

## 代码

下面按先读入 $n$，再读入 $n$ 个正整数的格式实现，输出最大的因子个数。

<details>
<summary>展开完整实现</summary>

```cpp
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <utility>
#include <vector>

using Factors = std::vector<std::pair<int, int>>;

Factors factorize(int x) {
    Factors factors;
    for (int p = 2; p * p <= x; ++p) {
        if (x % p != 0) {
            continue;
        }
        int k = 0;
        while (x % p == 0) {
            x /= p;
            ++k;
        }
        factors.emplace_back(p, k);
    }
    if (x > 1) {
        factors.emplace_back(x, 1);
    }
    return factors;
}

int main() {
    int n;
    std::cin >> n;
    std::vector<Factors> factors(n);
    for (int i = 0; i < n; ++i) {
        int x;
        std::cin >> x;
        factors[i] = factorize(x);
    }

    auto merge = [](const Factors &lhs, const Factors &rhs) -> std::int64_t {
        std::size_t i = 0, j = 0;
        std::int64_t count = 1;
        while (i < lhs.size() && j < rhs.size()) {
            if (lhs[i].first == rhs[j].first) {
                count *= lhs[i].second + rhs[j].second + 1;
                ++i;
                ++j;
            } else if (lhs[i].first < rhs[j].first) {
                count *= lhs[i].second + 1;
                ++i;
            } else {
                count *= rhs[j].second + 1;
                ++j;
            }
        }
        while (i < lhs.size()) {
            count *= lhs[i++].second + 1;
        }
        while (j < rhs.size()) {
            count *= rhs[j++].second + 1;
        }
        return count;
    };

    std::int64_t ans = 0;
    for (int i = 0; i < n; ++i) {
        for (int j = i; j < n; ++j) {
            ans = std::max(ans, merge(factors[i], factors[j]));
        }
    }
    std::cout << ans << '\n';
}
```

</details>

试除会把较小的质因子全部除干净。循环结束后如果还剩 $x>1$，它一定是质数，记一次就行。原数为 $1$ 时分解表为空，计数从 $1$ 开始，正好符合 $d(1)=1$。

## 复杂度

设 $A=\max a_i$，每个数最多有 $k$ 种不同质因子：

- 预处理分解的时间复杂度为 $O(n\sqrt A)$。
- 枚举所有数对并合并的时间复杂度为 $O(n^2k)$。
- 保存分解结果的空间复杂度为 $O(nk)$。

在这道题的范围里，$\sqrt A\le 31623$、$k\le 9$，直接试除加双指针完全够用。
