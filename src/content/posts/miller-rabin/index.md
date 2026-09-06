---
title: "米勒–拉宾素性测试：从原理到 64 位实现"
description: "从费马小定理与非平凡平方根出发，理解强伪素数测试、确定性基底，以及实现中最容易忽略的模乘边界。"
pubDate: 2026-09-06T09:00:00+08:00
tags: ["算法", "数论", "C++"]
---

判断一个整数是否为素数，最直接的方法是枚举不超过 $\sqrt n$ 的可能因子。但对接近 $2^{64}$ 的数，试除的次数仍然太多。

Miller–Rabin 素性测试从另一端入手：利用素数必须满足的模运算性质，寻找能够证明一个数是合数的证据。在固定的 64 位整数范围内，使用已验证的基底集合，可以得到确定性的判定。

本文的实现思路参考 [CompetitiveProgramming 中的 MillerRabin.hpp](https://github.com/huxint/CompetitiveProgramming/blob/dabd8d624388ac5c5d685483f11f6d55b75c83f3/Math/MillerRabin.hpp)。先展开判定原理与模乘，再回到模板里的分段基底和 Montgomery 优化。

## 费马小定理提供的第一道检查

如果 $p$ 是素数，且 $a$ 与 $p$ 互素，那么

$$
a^{p-1}\equiv 1\pmod p.
$$

所以，给定一个待测奇数 $n$，一旦找到某个与 $n$ 互素的 $a$ 满足

$$
a^{n-1}\not\equiv 1\pmod n,
$$

就能确定 $n$ 是合数。这里的 $a$ 可以称为一个见证。

但通过这个检查还不足以证明素性。有些合数会在特定基底下满足等式；更特别的是，Carmichael 数会对所有与它互素的基底满足费马同余。例如

$$
561=3\times11\times17,\qquad
2^{560}\equiv1\pmod{561}.
$$

Miller–Rabin 保留了快速模幂的思路，并检查从较小幂次到最终结果的平方链。

## 素数模下，1 的平方根只有两个

在素数模 $p$ 下，若

$$
x^2\equiv1\pmod p,
$$

则

$$
(x-1)(x+1)\equiv0\pmod p.
$$

素数整除一个乘积，必然整除至少一个因子，因此

$$
x\equiv1\pmod p
\quad\text{或}\quad
x\equiv-1\pmod p.
$$

如果在模 $n$ 下找到一个既不等于 $1$、也不等于 $n-1$，平方后却等于 $1$ 的数，就发现了 **1 的非平凡平方根**。这足以证明 $n$ 是合数。

Miller–Rabin 的平方链，正是在寻找这种矛盾，或发现费马条件本身不成立。

## 把指数拆成奇数乘以二的幂

对奇数 $n>2$，将

$$
n-1=d\,2^s,\qquad d\text{ 为奇数},\ s\ge1.
$$

选定一个有效基底 $a$，先计算

$$
x_0=a^d\bmod n,
$$

再逐次平方：

$$
x_{r+1}=x_r^2\bmod n.
$$

如果 $n$ 是素数，费马小定理保证 $x_s=1$。这条链必须满足以下条件之一：

1. 一开始就有 $x_0=1$。
2. 在 $x_0,x_1,\ldots,x_{s-1}$ 中，至少出现一次 $n-1$。

第二个条件来自平方根的性质：如果链不是从 $1$ 开始，那么第一次走到 $1$ 之前的那个值，在素数模下只能是 $-1$。

因此，一个基底对应的测试可以写成

$$
\operatorname{pass}(n,a)=
\begin{cases}
\text{true}, & a^d\equiv1\pmod n,\\
\text{true}, & \exists r\in[0,s-1],\
a^{d2^r}\equiv-1\pmod n,\\
\text{false}, & \text{其他情况}.
\end{cases}
$$

通过测试意味着当前基底没有找到合数证据。若 $n$ 本身是合数，却通过了该基底的测试，就称它为这个基底下的强伪素数。

## 用 561 走一遍平方链

对 $n=561$，有

$$
560=35\times2^4.
$$

以 $a=2$ 为基底，从 $2^{35}$ 开始计算，得到

$$
263\longrightarrow166\longrightarrow67\longrightarrow1.
$$

![以基底 2 检查 561，平方链依次为 263、166、67、1；67 是模 561 下 1 的非平凡平方根](./witness.svg "每条箭头表示平方后模 561。到达 1 之前没有出现 560，因此基底 2 已经证明 561 是合数。")

链上没有出现 $560$，却从 $67$ 平方得到 $1$。这正是非平凡平方根的证据。费马检查只看到最终的 $1$，Miller–Rabin 还检查了通往这个结果的过程。

另一个值得记住的数是 $2047=23\times89$。它能通过基底 $2$ 的强伪素数测试，因此单测一个基底仍然不够。

## 随机测试与固定范围的确定性

对于固定的奇合数，能够骗过强伪素数测试的基底只占有限比例。独立、均匀地随机选择基底时，每轮漏判合数的概率至多为 $\tfrac14$，做 $k$ 轮后的上界为

$$
\Pr(\text{合数通过全部测试})\le4^{-k}.
$$

这个概率描述的是：**数 $n$ 已经固定为合数，对基底的随机选择发生漏判的概率。** 它不是在说“通过检查后，这个数有 $4^{-k}$ 的概率是合数”。

如果输入限定在一个有限范围，还可以使用经过验证的固定基底集合。对

$$
0\le n<2^{64},
$$

常用的七个基底是

$$
\{2,\ 325,\ 9375,\ 28178,\ 450775,\ 9780504,\ 1795265022\}.
$$

正确处理小数、偶数和基底取模后，这组基底可以覆盖整个无符号 64 位范围。这个有限范围的结论来自基底集合的验证，不能由随机误判概率直接推出，也不能原样推广到任意精度整数。

基底不要求都是素数。某个基底大于 $n$ 时，先计算 $a\bmod n$；如果结果为 $0$，这一基底不提供有效信息，应当跳过。例如测试素数 $5$ 时，基底 $325$ 就会发生这种情况。

## 可运行的 C++20 实现

下面的程序读取一组无符号 64 位十进制整数，每行输出 `Prime` 或 `Composite`。它使用 GCC / Clang 支持的 `__uint128_t` 扩展保存乘积，再对 $n$ 取模。[^integer]

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

代码中先把 `lhs` 转成 128 位，再执行乘法。这一点决定了中间乘积是否完整。如果先让两个 64 位数相乘，再把已经溢出的结果转成 128 位，丢失的高位不会恢复。

对 `uint64_t` 的两个操作数，其完整乘积可以由 128 位无符号整数容纳。因此，即使 $n$ 接近 $2^{64}$，取模前也不会因为乘积位数不足而改变结果。

平方链从 $x_0$ 开始。如果初始值没有通过检查，只需要再平方 $s-1$ 次；如果途中回到 $1$ 却没先遇到 $n-1$，即可提前判为合数。

## 回到仓库模板中的优化

[仓库中的实现](https://github.com/huxint/CompetitiveProgramming/blob/dabd8d624388ac5c5d685483f11f6d55b75c83f3/Math/MillerRabin.hpp) 在相同判定流程上做了几层优化。

### 小数位图与分段基底

对小于 $64$ 的输入，模板用常量 `0x28208a20a08a28ac` 的第 $n$ 位直接表示素性，再过滤一批小素数的倍数。

随后，它按范围选用不同的基底组：

| 待测数的严格上界 | 模板选用的基底 |
| --- | --- |
| $4\,759\,123\,141$ | $2,7,61$ |
| $75\,792\,980\,677$ | $2,379215,457083754$ |
| $21\,652\,684\,502\,221$ | $2,1215,34862,574237825$ |
| 更大范围 | 上文的通用七基底 |

这样，小范围输入可以少做几次模幂。教学实现统一使用七个基底，使完整的判定流程更容易检查。

### Montgomery 模乘的表示变化

当模数 $n$ 为奇数时，可以取 $R=2^w$，因为 $\gcd(R,n)=1$，$R$ 在模 $n$ 下存在逆元。把普通数 $x$ 表示为

$$
\widetilde{x}=xR\bmod n,
$$

就进入了 Montgomery 表示。相应的乘法希望计算

$$
\operatorname{MontMul}(\widetilde{x},\widetilde{y})
=\widetilde{x}\widetilde{y}R^{-1}\bmod n
=xyR\bmod n.
$$

结果仍然留在同一种表示中，因此一次模幂的大量乘法可以连续完成，减少通用除法的使用。

在这种表示中，普通的 $1$ 对应 $R\bmod n$，普通的 $-1$ 对应 $-R\bmod n$。这解释了模板为什么先计算 `one` 和 `value_reduce_one`，再用它们比较平方链。

模板还使用 Newton 迭代求奇数 $n$ 在模 $2^w$ 下的逆：

$$
z_{\text{next}}=z(2-nz)\pmod{2^w}.
$$

若 $nz=1+e$，更新后有 $nz_{\text{next}}=1-e^2$，误差中的二因子个数翻倍。因此，可以用少量迭代逐步得到整个机器字宽上的逆元。

**模乘的数值范围必须单独检查。** Montgomery reduction 的中间结果可能使用冗余表示，涉及额外的进位或范围约束。基底集合覆盖 64 位，并不能自动保证某个优化模乘实现也覆盖这个范围。上面的程序采用双宽乘积直接取模，使这一边界可以直接从类型宽度判断。

## 验证时需要包含的数

只测试几个小素数，很容易漏掉强伪素数和模乘溢出的问题。至少应该包含以下几类：

| 输入 | 期望 | 检查目的 |
| --- | --- | --- |
| $0,1$ | Composite（不是素数） | 素数定义的边界 |
| $2,3,5$ | Prime | 最小素数、基底取模为零 |
| $64$ | Composite | 偶数 |
| $561$ | Composite | Carmichael 数 |
| $2047$ | Composite | 基底 2 的强伪素数 |
| $341550071728321$ | Composite | 能骗过多组小基底的合数 |
| $3825123056546413051$ | Composite | 更大范围的强伪素数 |
| $9223372036854775783$ | Prime | 靠近有符号 64 位上界的素数 |
| $18446744073709551557$ | Prime | 接近 $2^{64}$ 的素数 |
| $18446744073709551615$ | Composite | 无符号 64 位最大值 |

这里 `Composite` 表示程序回答“不是素数”；$0$ 和 $1$ 在数学分类上既不是素数，也不是合数。

实现还可以与筛法交叉验证：先在一个可承受的连续区间内独立筛出素数，再逐个比较 Miller–Rabin 的输出。边界样例负责触及大整数范围，筛法负责检查大量小数上的判定行为。

## 复杂度与适用范围

每个基底需要 $O(\log n)$ 次模乘，$k$ 个基底共需 $O(k\log n)$ 次模乘。在固定机器字宽、把一次模乘视为常数操作时，这就是常用的时间复杂度描述，额外空间为 $O(1)$。

若按整数的位数计费，模乘本身也有成本。使用朴素大整数运算时，常见的位复杂度描述为 $O(k\log^3 n)$。这两种写法采用了不同的运算成本模型。

在本文的输入范围内，七个固定基底与正确的模运算共同给出确定性结果。扩展到任意精度整数时，需要重新选择测试方案，并明确随机基底及轮数带来的保证。

## 参考资料

1. [CompetitiveProgramming / Math / MillerRabin.hpp](https://github.com/huxint/CompetitiveProgramming/blob/dabd8d624388ac5c5d685483f11f6d55b75c83f3/Math/MillerRabin.hpp)：本文对照的源码版本，包含分段基底与 Montgomery 模乘。
2. [CP-Algorithms：Primality tests](https://cp-algorithms.com/algebra/primality_tests.html)：强伪素数测试与 64 位确定性基底。
3. [Deterministic variants of the Miller–Rabin primality test](https://miller-rabin.appspot.com/)：不同数值范围的基底记录。

[^integer]: `__uint128_t` 是编译器扩展，不能仅凭选择 C++20 标准就假定所有编译器都支持。没有双宽整数类型的平台，需要提供同样不会溢出的模乘实现。
