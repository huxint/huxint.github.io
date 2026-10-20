---
title: "Pollard–Rho：从模意义下的碰撞找到因子"
description: "用 91 的小例子理解余数碰撞、GCD 和快慢指针，再组合 Miller–Rabin 完成 64 位质因数分解。"
pubDate: 2024-08-28T18:36:00+08:00
updatedDate: 2026-10-20
tags: ["算法", "数论", "模板", "C++"]
---

Pollard–Rho 先找任意非平凡因子，再递归拆分两半；素数由 [Miller–Rabin](/posts/miller-rabin/) 判断。这样不用试除到平方根。

## 不知道因子，怎么找到它

先生成一个不断取模的序列：

$$
x_{i+1}=(x_i^2+c)\bmod n.
$$

若两个状态模某个质因子 $p$ 相等，它们的差就是 $p$ 的倍数。我们不知道 $p$，但可以用 GCD 提取共有因子：

$$
g=\gcd(|x_i-x_j|,n).
$$

例如 $n=91$、$c=1$，从 $2$ 出发。下排只用于解释，算法不需要提前知道 $7$：

```render html
<style>.rho-scene svg { display: block; width: 100%; } .rho-scene { --factor: #386f9b; } :root[data-theme="dark"] .rho-scene { --factor: #8ebce2; }</style>
<div class="rho-scene"></div>
<script>
  const scene=document.querySelector('.rho-scene');
  function draw() {
    const w=scene.clientWidth, points=[w*.15,w*.5,w*.85];
    scene.innerHTML=`<svg viewBox="0 0 ${w} 268" role="img" aria-label="序列 2、5、26。5 与 26 模 7 相等，差 21 与 91 的最大公约数是 7">
      <defs><marker id="rho-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--muted)" stroke-width="1.5"/></marker></defs>
      ${points.map((x,i)=>`<text x="${x}" y="47" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="30">${[2,5,26][i]}</text><path d="M${x} 66v45" stroke="var(--rule-strong)" stroke-dasharray="3 4" marker-end="url(#rho-head)"/>${i?`<circle cx="${x}" cy="146" r="24" fill="var(--factor)" opacity=".12"/>`:''}<text x="${x}" y="155" text-anchor="middle" fill="${i?'var(--factor)':'var(--muted)'}" font-family="var(--font-mono)" font-size="26">${[2,5,5][i]}</text>`).join('')}
      ${points.slice(1).map((x,i)=>`<path d="M${points[i]+28} 36H${x-28}" stroke="var(--rule-strong)" marker-end="url(#rho-head)"/>`).join('')}
      <text x="${points[0]}" y="196" text-anchor="middle" fill="var(--muted)" font-size="13">模 7</text><path d="M${points[1]} 183v12H${points[2]}v-12" fill="none" stroke="var(--factor)"/>
      <text x="${(points[1]+points[2])/2}" y="219" text-anchor="middle" fill="var(--factor)" font-size="13">余数碰撞</text>
      <text x="${w/2}" y="262" text-anchor="middle" fill="var(--text)" font-size="18">gcd(26 − 5, 91) = 7</text>
    </svg>`;
  }
  new ResizeObserver(draw).observe(scene);
</script>
```

**不必等模 $n$ 的序列重复，模某个因子的余数可以先碰撞。**

## 为什么用快慢指针

慢指针走一步、快指针走两步，每轮检查差值的 GCD。模某个因子看，序列最终成环，快慢指针便有机会相遇。

GCD 的结果对应三种情况：

| 结果 | 含义 | 下一步 |
| --- | --- | --- |
| $g=1$ | 这次差值没有暴露因子 | 继续走 |
| $1<g<n$ | 找到了真正的因子 | 分别处理 $g$ 和 $n/g$ |
| $g=n$ | 两边重合得太彻底，没拆开 | 换起点和 $c$，重新尝试 |

这是一种随机化分解方法。把模最小质因子 $p$ 的序列近似看成随机映射时，生日悖论提示大约 $\sqrt p$ 量级就可能碰撞；这是理解速度的启发，不是每次运行的步数保证。代码中的重试对应第三种结果。

## 拼成完整的质因数分解

素数直接记录；合数用 Rho 拆开后递归；到 $1$ 停止。拆出的因子不保证是质数。最后排序，重复次数就是指数。

下面保留常规模乘、快慢指针和递归。Miller–Rabin 的七个基底用于整个 `uint64_t` 范围；代码需要支持 `__uint128_t` 的 GCC / Clang，按 C++20 编译，输入约定为正整数。

<details>
<summary>展开完整实现：逐行输入整数，输出它的质因子（含重复）</summary>

```cpp
#include <array>
#include <bit>
#include <cstdint>
#include <algorithm>
#include <iostream>
#include <numeric>
#include <random>
#include <vector>

using u64 = std::uint64_t;
using u128 = __uint128_t;

u64 multiplyMod(u64 lhs, u64 rhs, u64 modulus) {
    return static_cast<u64>(static_cast<u128>(lhs) * rhs % modulus);
}

u64 powerMod(u64 base, u64 exponent, u64 modulus) {
    u64 result = 1;
    while (exponent != 0) {
        if (exponent & 1) {
            result = multiplyMod(result, base, modulus);
        }
        base = multiplyMod(base, base, modulus);
        exponent >>= 1;
    }
    return result;
}

bool isPrime(u64 n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;

    const int s = std::countr_zero(n - 1);
    const u64 d = (n - 1) >> s;
    constexpr std::array<u64, 7> bases{
        2, 325, 9375, 28178, 450775, 9780504, 1795265022
    };

    for (u64 base : bases) {
        base %= n;
        if (base == 0) continue;

        u64 x = powerMod(base, d, n);
        if (x == 1 || x == n - 1) continue;

        bool passed = false;
        for (int r = 1; r < s; ++r) {
            x = multiplyMod(x, x, n);
            if (x == n - 1) {
                passed = true;
                break;
            }
            if (x == 1) return false;
        }
        if (!passed) return false;
    }
    return true;
}

std::mt19937_64 rng(std::random_device{}());

u64 rho(u64 n) { // n 是合数
    if (n % 2 == 0) return 2;
    std::uniform_int_distribution<u64> pick(1, n - 1);
    while (true) {
        u64 c = pick(rng), x = pick(rng), y = x, g = 1;
        auto next = [&](u64 v) -> u64 {
            return (static_cast<u128>(v) * v + c) % n;
        };
        while (g == 1) {
            x = next(x);
            y = next(next(y));
            g = std::gcd(x > y ? x - y : y - x, n);
        }
        if (g != n) return g;
    }
}

void split(u64 n, std::vector<u64>& factors) {
    if (n == 1) return;
    if (isPrime(n)) {
        factors.push_back(n);
        return;
    }
    u64 g = rho(n);
    split(g, factors);
    split(n / g, factors);
}

int main() {
    for (u64 n; std::cin >> n;) {
        std::vector<u64> factors;
        split(n, factors);
        std::sort(factors.begin(), factors.end());
        for (u64 p : factors) std::cout << p << ' ';
        std::cout << '\n';
    }
}
```

</details>

例如输入 `360`，输出 `2 2 2 3 3 5`，对应 $360=2^3\times3^2\times5$。有了这份分解，因子个数和欧拉函数再按各自公式计算即可，不需要把它们都塞进分解模板。

注意 `next` 中连加法一起放在 128 位里计算。如果只让乘法先取模，再用 64 位执行 `+ c`，接近上界时仍可能溢出。

## 参考

- [CP-Algorithms：Integer factorization](https://cp-algorithms.com/algebra/factorization.html#pollards-rho-algorithm)
- [Miller–Rabin 素性测试](/posts/miller-rabin/)
