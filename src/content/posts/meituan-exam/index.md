---
title: "美团笔试：两数乘积的最大因子数"
description: "10 道大模型相关题目、一道算法题和一道 AI Coding 题，分享一下求两数乘积最大因子数的算法题。"
pubDate: 2026-10-14
tags: ["秋招", "面试复盘", "算法", "数论", "C++"]
---

这次美团笔试有 10 道大模型相关的题目，一道算法题，还有一道 AI Coding 题。
算法题是过了 但是感觉写错了 合并质数的指数写过了 但是过了 当时也就没多想

## 题意

给定一个长度为 $n$ 的正整数数组 $a$，其中 $n\le 1000$，$a_i\le 10^9$。选择两个下标 $i,j$，求 $a_i a_j$ 的因子个数的最大值。

如果一个正整数的质因数分解为

$$
x=p_1^{e_1}p_2^{e_2}\cdots p_k^{e_k},
$$

那么它的正因子个数为

$$
d(x)=\prod_{t=1}^{k}(e_t+1).
$$

因为一个因子中，$p_t$ 的指数可以从 $0$ 取到 $e_t$，一共有 $e_t+1$ 种选择，不同质数的指数可以独立选择。

对于两个数的乘积，只需要把相同质因子的指数相加。设质数 $p$ 在两个数中的指数分别为 $\alpha_p$、$\beta_p$，没有出现时指数为 $0$，则

$$
d(a_i a_j)=\prod_{p\mid a_i a_j}(\alpha_p+\beta_p+1).
$$

## 先分解每个数，再枚举组合

$n\le 1000$，枚举所有数对的开销可以接受。关键是不要每枚举一对，就重新分解一次乘积。

乘积最大可以达到 $10^{18}$，但每个原数最多只有 $10^9$。提前把每个 $a_i$ 分解一次，后面只合并指数，就不需要分解大数了。

具体做法：

1. 对每个 $a_i$ 用试除法做质因数分解，保存按质数递增排列的 `(质数, 指数)` 列表。
2. 枚举所有 $i,j$，两个循环都从 $0$ 到 $n-1$，自然包含 $i=j$。
3. 用双指针合并两份列表。
4. 取所有组合中因子个数的最大值。

比如 $12$ 和 $18$ 的分解列表分别是 `[(2, 2), (3, 1)]`、`[(2, 1), (3, 2)]`。合并后，质数 $2$ 的指数是 $3$，质数 $3$ 的指数也是 $3$，所以得到 $(3+1)(3+1)=16$。

列表其实很短。前 $9$ 个质数的乘积是 $223092870$，再乘上下一个质数 $29$ 就超过了 $10^9$，所以每个数最多只有 $9$ 种不同质因子。每对数合并时，最多处理两份列表中的 $18$ 项。

## 参考代码

下面按先读入 $n$，再读入 $n$ 个正整数的格式实现，输出最大的因子个数。

```cpp title="meituan_divisors.cpp"
#include <algorithm>
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

    auto merge = [&](const Factors &lhs, const Factors &rhs) -> std::int64_t {
        int i = 0, j = 0;
        std::int64_t count = 1;
        while (i < n && j < m) {
            if (a[i].first == b[j].first) {
                count *= a[i].second + b[j].second + 1;
                ++i;
                ++j;
            } else if (a[i].first < b[j].first) {
                count *= a[i].second + 1;
                ++i;
            } else {
                count *= b[j].second + 1;
                ++j;
            }
        }
        while (i < n) {
            count *= a[i++].second + 1;
        }
        while (j < m) {
            count *= b[j++].second + 1;
        }
        return count;
    };

    std::int64_t ans = 0;
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            ans = std::max(ans,  merge(factors[i], factors[j]));
        }
    }
    std::cout << ans << '\n';
}
```

试除时已经除尽了所有较小的质因子，所以循环结束后，如果剩余的 $x>1$，它一定是一个质数，记录一次即可。原数为 $1$ 时，分解列表为空；计数从 $1$ 开始，也正好符合 $d(1)=1$。

## 复杂度

设 $A=\max a_i$，每个数最多有 $k$ 种不同质因子：

- 预处理分解的时间复杂度为 $O(n\sqrt A)$。
- 枚举所有数对并合并的时间复杂度为 $O(n^2k)$。
- 保存分解结果的空间复杂度为 $O(nk)$。

在这道题的范围内，$\sqrt A\le 31623$、$k\le 9$，直接试除加双指针合并就够用了。
