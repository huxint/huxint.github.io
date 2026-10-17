---
title: "米勒–拉宾素性测试：从原理到 64 位实现"
description: "从费马小定理出发，再把平方链看一遍，就能解释 561 这种合数为什么会被抓住。"
pubDate: 2026-09-06T09:00:00+08:00
tags: ["算法", "数论", "C++"]
---

判断素数，最直接的办法是试除。数小的时候没什么问题，到了 64 位就有点顶不住了。Miller–Rabin 换了个角度：不找因子，而是试着抓住一个“素数不该有的表现”。

它从费马小定理出发。不过只看最后一步还不够，中间平方的过程也得一起看。

## 从费马小定理开始

如果 $p$ 是素数，$a$ 不是 $p$ 的倍数，那么

$$
a^{p-1}\equiv1\pmod p.
$$

所以，只要能找到一个不满足这个式子的 $a$，就能排除素数。麻烦的是，有些合数也能混过去，比如

$$
561=3\times11\times17,\qquad 2^{560}\equiv1\pmod{561}.
$$

所以只靠这个式子，还不太够。

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

先算 $x_0=a^d\bmod n$，再不断平方。若 $n$ 是素数，要么一开始就得到 $1$，要么在最后走到 $1$ 之前，出现过 $n-1$。否则，这个基底就找到了合数的证据。

拿 $561$ 试一下。$560=35\times2^4$，以 $2$ 为基底，平方链是

$$
263\longrightarrow166\longrightarrow67\longrightarrow1.
$$

![561 的平方链](./witness.svg "67 平方后模 561 得到 1，前面却没有出现 560。")

$67$ 既不是 $1$ 也不是 $560$，下一步却到了 $1$，所以 $561$ 是合数。只看费马小定理的最后一步，就会漏掉这里的问题。

## 多换几个基底

一个基底通过了，也还不能下结论。比如 $2047=23\times89$，就能通过基底 $2$ 的检查。

我平时用的模板对 `uint64_t` 选了这七个基底：

$$
\{2,325,9375,28178,450775,9780504,1795265022\}.
$$

依次检查，只要有一个不通过就直接判合数。模乘用 `__uint128_t` 先接住乘积，代码写起来比较直接。

## 代码

~~~cpp title="miller-rabin.cpp"
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
~~~

把 $561$ 的平方链自己算一遍，比盯着定义看有用得多。真正容易忘的不是七个基底，而是“平方后第一次出现 $n-1$ 就可以停”这个细节。

## 参考

- [CompetitiveProgramming / MillerRabin.hpp](https://github.com/huxint/CompetitiveProgramming/blob/dabd8d624388ac5c5d685483f11f6d55b75c83f3/Math/MillerRabin.hpp)
- [CP-Algorithms：Primality tests](https://cp-algorithms.com/algebra/primality_tests.html)
- [Miller–Rabin 基底记录](https://miller-rabin.appspot.com/)
