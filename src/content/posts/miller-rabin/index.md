---
title: "米勒–拉宾素性测试：从原理到 64 位实现"
description: "从费马小定理出发，再把平方链看一遍，就能解释 561 这种合数为什么会被抓住。"
pubDate: 2026-09-06T09:00:00+08:00
updatedDate: 2026-10-20
tags: ["算法", "数论", "C++"]
---

Miller–Rabin 通过幂运算寻找“素数不该有的表现”。它能快速判断 64 位整数是否为素数，不需要先找到因子。

## 从费马小定理开始

如果 $p$ 是素数，$a$ 不是 $p$ 的倍数，那么

$$
a^{p-1}\equiv1\pmod p.
$$

不满足就能判合数，但满足不一定是素数：

$$
561=3\times11\times17,\qquad 2^{560}\equiv1\pmod{561}.
$$

## 看看平方是怎么走到 1 的

素数模下，$x^2\equiv1\pmod p$ 可以拆成

$$
(x-1)(x+1)\equiv0\pmod p.
$$

$p$ 是素数，所以它至少整除其中一个因子，也就是 $x\equiv1$ 或 $x\equiv-1$。如果一个数既不是 $1$，也不是 $-1$，平方以后却变成了 $1$，模数就一定是合数。

对待测奇数 $n$，把指数里的因子 $2$ 全部提出来：

$$
n-1=d\,2^s,\qquad d\text{ 为奇数}.
$$

先算 $a^d\bmod n$，再最多平方 $s-1$ 次。素数必须满足：起点为 $1$，或途中出现 $n-1$（即 $-1$）。否则判合数。

点选下面三个数，对照一次检查：

```render html
<style>
  .mr-lab { padding-block: 8px; }
  .mr-cases { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
  .mr-cases button { min-height: 44px; padding: 6px 0; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); font: 16px var(--font-mono); cursor: pointer; }
  .mr-cases button[aria-pressed="true"] { border-color: var(--accent); color: var(--text); }
  .mr-cases small { margin-left: auto; color: var(--muted); font-size: 12px; }
  .mr-setup { margin: 22px 0 0; color: var(--muted); font: 13px var(--font-mono); }
  .mr-drawing svg { display: block; width: 100%; }
  .mr-result { display: block; font-size: 15px; line-height: 1.8; }
  .mr-result strong { margin-right: 12px; color: var(--accent-ink); font-weight: 600; }
</style>
<section class="mr-lab" aria-label="Miller–Rabin 平方链">
  <div class="mr-cases"><button type="button" data-n="561" aria-pressed="true">561</button><button type="button" data-n="17" aria-pressed="false">17</button><button type="button" data-n="2047" aria-pressed="false">2047</button><small>基底 a = 2</small></div>
  <p class="mr-setup"></p><div class="mr-drawing"></div><output class="mr-result" aria-live="polite"></output>
</section>
<script>
  let n = 561;
  const drawing = document.querySelector('.mr-drawing');
  function draw() {
    let d = n - 1, s = 0;
    while (d % 2 === 0) { d /= 2; s += 1; }
    let x = 1;
    for (let i = 0; i < d; i += 1) x = x * 2 % n;
    const chain = [x];
    for (let i = 1; i < s && x !== 1 && x !== n - 1; i += 1) { x = x * x % n; chain.push(x); }
    const w = drawing.clientWidth, folded = w < 420 && chain.length === 4;
    const points = chain.map((_, i) => folded ? [{x:w*.23,y:64},{x:w*.77,y:64},{x:w*.77,y:196},{x:w*.23,y:196}][i] : {x:w*(i+.5)/chain.length,y:85});
    const h = folded ? 260 : 158;
    const edges = points.slice(1).map((to, i) => {
      const from = points[i], dx = to.x-from.x, dy = to.y-from.y, len = Math.hypot(dx,dy);
      const a = {x:from.x+dx/len*36,y:from.y+dy/len*(dy?64:36)}, b = {x:to.x-dx/len*36,y:to.y-dy/len*36};
      return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="var(--rule-strong)" stroke-width="1.5" marker-end="url(#mr-arrow)"/>`;
    }).join('');
    drawing.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${n} 的平方链：${chain.join('，')}。每次平方并模 ${n}">
      <defs><marker id="mr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--muted)" stroke-width="1.5"/></marker></defs>
      ${edges}${points.map((p,i) => `${i===chain.length-1?`<circle cx="${p.x}" cy="${p.y}" r="32" fill="var(--accent-soft)"/>`:''}<text x="${p.x}" y="${p.y+10}" text-anchor="middle" fill="${i===chain.length-1?'var(--accent-ink)':'var(--text)'}" font-family="var(--font-mono)" font-size="${w<420?28:34}">${chain[i]}</text><text x="${p.x}" y="${p.y+52}" text-anchor="middle" fill="var(--muted)" font-size="12">2<tspan dy="-5" font-size="12">${d*2**i}</tspan></text>`).join('')}
    </svg>`;
    document.querySelector('.mr-setup').textContent = `${n} − 1 = ${d} × 2^${s}　·　沿箭头平方取模`;
    document.querySelector('output').innerHTML = n===561 ? '<strong>发现合数</strong>67 ≠ ±1，平方却得到 1。' : n===17 ? '<strong>本轮通过</strong>出现 −1 ≡ 16，即可停下。' : '<strong>本轮通过，但仍是合数</strong>起点为 1；2047 = 23 × 89。';
  }
  document.querySelectorAll('[data-n]').forEach(button => button.addEventListener('click', () => {
    n = Number(button.dataset.n);
    document.querySelectorAll('[data-n]').forEach(item => item.setAttribute('aria-pressed', String(item===button)));
    draw();
  }));
  new ResizeObserver(draw).observe(drawing);
</script>
```

## 多换几个基底

通过一个基底还不能下结论。对 `uint64_t`，依次检查这七个基底：

$$
\{2,325,9375,28178,450775,9780504,1795265022\}.
$$

在 $0\le n<2^{64}$ 范围内，这组固定基底足以做确定性判定；不能把这个结论直接推广到任意大整数。模乘用 `__uint128_t` 先接住两个 64 位数的乘积，避免取模前就溢出；这是 GCC / Clang 常见的扩展类型。

## 代码

<details>
<summary>展开可直接编译的 C++20 实现</summary>

```cpp
#include <array>
#include <bit>
#include <cstdint>
#include <iostream>

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

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    for (u64 n; std::cin >> n;) {
        std::cout << (isPrime(n) ? "Prime" : "Composite") << '\n';
    }
}
```

</details>

每个基底只需要一次快速幂和少量平方；七个基底固定，按一次模乘为常数计，时间是 $O(\log n)$，额外空间 $O(1)$。

## 参考

- [CompetitiveProgramming / MillerRabin.hpp](https://github.com/huxint/CompetitiveProgramming/blob/dabd8d624388ac5c5d685483f11f6d55b75c83f3/Math/MillerRabin.hpp)
- [CP-Algorithms：Primality tests](https://cp-algorithms.com/algebra/primality_tests.html)
- [Miller–Rabin 基底记录](https://miller-rabin.appspot.com/)
