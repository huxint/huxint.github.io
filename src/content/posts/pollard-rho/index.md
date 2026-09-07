---
title: "Pollard–Rho 质因数分解模板"
description: "用 Pollard–Rho 找因子，配合 Miller–Rabin 完成分解，再顺便枚举因子、求欧拉函数。"
pubDate: 2024-08-28T18:36:00+08:00
tags: ["算法", "数论", "模板", "C++"]
---

试除法很好写，但遇到大数就有些慢了。Pollard–Rho 换了个思路：先找一个因子，把数拆成两部分，再分别处理。

拆到质数就停下，这一步交给 [Miller–Rabin](/posts/miller-rabin/) 判断。

## 找因子的思路

从一个起点出发，反复计算

$$
x_{i+1}=(x_i^2+c)\bmod n.
$$

假设 $p$ 是 $n$ 的一个质因子。模 $p$ 时只有 $p$ 种余数，序列可能先在这里碰到重复。这时两个状态的差就是 $p$ 的倍数，于是试着计算

$$
d=\gcd(|x_i-x_j|,n).
$$

$1<d<n$ 时就找到了因子。得到 $1$ 就继续找，得到 $n$ 就回退检查，或者换个起点重来。整个过程并不需要提前知道 $p$ 是多少。

## 少做几次 GCD

每次迭代都算 GCD 有些浪费。可以先把一批差值乘起来，最后一起算；如果得到的是 $n$，再回到这一批里逐个检查。

模板里同时跑两条序列，找不到合适的因子就换起点再试。

## 模板代码

~~~cpp title="pollard-rho.hpp"
#include <algorithm>
#include <bit>
#include <concepts>
#include <initializer_list>
#include <limits>
#include <type_traits>
#include <utility>
#include <vector>

namespace MillerRabin {
    template <std::unsigned_integral size_type>
    constexpr auto prime(size_type value) -> bool {
        constexpr auto size_type_digits = std::numeric_limits<size_type>::digits;
        using long_size_type = std::conditional_t<(size_type_digits < 63), unsigned long long, unsigned __int128>;
        if (value < 64) {
            return 0x28208a20a08a28ac >> value & 1;
        }
        if (value % 2 == 0 or value % 3 == 0 or value % 5 == 0 or value % 7 == 0 or value % 11 == 0) {
            return false;
        }
        const unsigned t = std::countr_zero(value - 1);
        const size_type u = (value - 1) >> t;
        size_type inverse = size_type(2) - value;
        for (unsigned i{size_type_digits < 63}; i < 5; ++ i) {
            inverse *= size_type(2) - value * inverse;
        }
        const auto multiply = [&value, &inverse](size_type lhs, size_type rhs) -> size_type {
            const auto res = long_size_type(lhs) * rhs;
            return value + size_type(res >> size_type_digits) - size_type((long_size_type(size_type(res) * inverse) * value) >> size_type_digits);
        };
        const size_type value_inverse = -long_size_type(value) % value;
        const size_type one = -value % value, value_reduce_one = value - one;
        const auto MillerRabin_test = [&](const std::initializer_list<size_type> &MillerRabinBase) -> bool {
            return std::all_of(MillerRabinBase.begin(), MillerRabinBase.end(), [&](auto base) -> bool {
                if (base >= value) {
                    return true;
                }
                size_type res = one;
                base = multiply(base, value_inverse);
                for (size_type ep = u; ep != 0; ep >>= 1) {
                    if (ep & 1) {
                        res = multiply(res, base);
                    }
                    base = multiply(base, base);
                }
                res = std::min(res, res - value);
                if (res == one or res == value_reduce_one) {
                    return true;
                }
                for (unsigned i{}; i + 1 < t; ++ i) {
                    res = multiply(res, res);
                    const auto check = std::min(res, res - value);
                    if (check == one) {
                        return false;
                    }
                    if (check == value_reduce_one) {
                        return true;
                    }
                }
                return false;
            });
        };
        if (value < 4759123141) {
            return MillerRabin_test({2, 7, 61});
        } else if (value < 75792980677) {
            return MillerRabin_test({2, 379215, 457083754});
        } else if (value < 21652684502221) {
            return MillerRabin_test({2, 1215, 34862, 574237825});
        } else {
            return MillerRabin_test({2, 325, 9375, 28178, 450775, 9780504, 1795265022});
        }
    }
}
namespace PollardRho {
    static constexpr unsigned long long C1 = 1;
    static constexpr unsigned long long C2 = 2;
    static constexpr unsigned long long M = 512;
    namespace gcd_impl {
        constexpr auto gcd_stein_impl(std::unsigned_integral auto x, std::unsigned_integral auto y) -> decltype(auto) {
            if (x == y) {
                return x;
            }
            const auto a = y - x;
            const auto b = x - y;
            const auto s = x < y ? a : b;
            const auto t = x < y ? x : y;
            const unsigned n = std::countr_zero(b);
            return gcd_stein_impl(s >> n, t);
        }
        constexpr auto gcd_stein(std::unsigned_integral auto x, std::unsigned_integral auto y) -> decltype(auto) {
            if (x == 0 or y == 0) {
                return x | y;
            }
            const unsigned n = std::countr_zero(x);
            const unsigned m = std::countr_zero(y);
            return gcd_stein_impl(x >> n, y >> m) << (n < m ? n : m);
        }
    }
    template <std::unsigned_integral size_type>
    constexpr auto PollardRho(size_type value) -> size_type {
        if (~ value & 1) {
            return 2;
        }
        constexpr auto size_type_digits = std::numeric_limits<size_type>::digits;
        using long_size_type = std::conditional_t<(size_type_digits < 63), unsigned long long, unsigned __int128>;
        size_type inverse = size_type(2) - value;
        for (unsigned i{size_type_digits < 63}; i < 5; ++ i) {
            inverse *= size_type(2) - value * inverse;
        }
        const auto multiply = [&value, &inverse](size_type lhs, size_type rhs) -> size_type {
            const auto res = long_size_type(lhs) * rhs;
            return value + size_type(res >> size_type_digits) - size_type((long_size_type(size_type(res) * inverse) * value) >> size_type_digits);
        };
        size_type Z1 = 1, Z2 = 2, res{};
        const auto get = [&]() -> void {
            size_type z1 = Z1, z2 = Z2;
            for (unsigned long long i = M;; i *= 2) {
                size_type x1 = z1 + value, x2 = z2 + value;
                for (unsigned long long j = 0; j < i; j += M) {
                    size_type y1 = z1, y2 = z2, q1 = 1, q2 = 2;
                    z1 = multiply(z1, z1) + C1;
                    z2 = multiply(z2, z2) + C2;
                    for (unsigned long long k = 0; k < M; ++ k) {
                        size_type t1 = x1 - z1, t2 = x2 - z2;
                        q1 = multiply(q1, t1);
                        q2 = multiply(q2, t2);
                        z1 = multiply(z1, z1) + C1;
                        z2 = multiply(z2, z2) + C2;
                    }
                    q1 = multiply(q1, x1 - z1);
                    q2 = multiply(q2, x2 - z2);
                    const size_type q3 = multiply(q1, q2);
                    const size_type g3 = gcd_impl::gcd_stein(value, q3);
                    if (g3 == 1) {
                        continue;
                    }
                    if (g3 != value) {
                        res = g3;
                        return;
                    }
                    const size_type g1 = gcd_impl::gcd_stein(value, q1);
                    const size_type g2 = gcd_impl::gcd_stein(value, q2);
                    const size_type C = g1 != 1 ? C1 : C2;
                    const size_type x = g1 != 1 ? x1 : x2;
                    size_type z = g1 != 1 ? y1 : y2;
                    size_type g = g1 != 1 ? g1 : g2;
                    if (g == value) {
                        do {
                            z = multiply(z, z) + C;
                            g = gcd_impl::gcd_stein(value, x - z);
                        } while (g == 1);
                    }
                    if (g != value) {
                        res = g;
                        return;
                    }
                    Z1 += 2;
                    Z2 += 2;
                    return;
                }
            }
        };
        while (res == 0) {
            get();
        }
        return res;
    }
    template <std::unsigned_integral size_type, typename CallBack>
    constexpr auto enumerate_prime_factors(const size_type &value, CallBack &&call) -> void {
        if (MillerRabin::prime(value)) {
            call(value);
            return;
        }
        const auto _factor{PollardRho(value)};
        enumerate_prime_factors(_factor, call);
        enumerate_prime_factors(value / _factor, call);
    }
    template <std::unsigned_integral size_type>
    constexpr auto factorize(size_type value) -> auto {
        std::vector<std::pair<size_type, unsigned>> res;
        if (~ value & 1) {
            const unsigned bit_zero = std::countr_zero(value);
            res.emplace_back(2, bit_zero);
            value >>= bit_zero;
        }
        if (value > 1) {
            enumerate_prime_factors(value, [&](const auto &x) -> void {
                auto find = std::find_if(res.begin(), res.end(), [&](const auto &element) {
                    return element.first == x;
                });
                if (find == res.end()) {
                    res.emplace_back(x, 1);
                } else {
                    ++ find -> second;
                }
            });
        }
        std::sort(res.begin(), res.end());
        return res;
    }
    template <std::unsigned_integral size_type, typename CallBack>
    constexpr auto enumerate_factors(const size_type &value, CallBack &&call) -> void {
        const auto &factorizer = factorize(value);
        auto dfs = [&](auto &&self, unsigned index, size_type prod) -> void {
            if (index == factorizer.size()) {
                call(prod);
                return;
            }
            self(self, index + 1, prod);
            for (auto [prime, count] {factorizer[index]}; count --;) {
                self(self, index + 1, prod *= prime);
            }
        };
        dfs(dfs, 0, 1);
    }
    template <std::unsigned_integral size_type>
    constexpr auto euler_phi(size_type value) -> size_type {
        for (const auto &[prime, _] : factorize(value)) {
            value = value / prime * (prime - 1);
        }
        return value;
    }
}
~~~

## 简单用法

`factorize` 最省事，会把质因子和次数整理好：

```cpp
const auto factors = PollardRho::factorize(360ULL);
// factors 为 {{2, 3}, {3, 2}, {5, 1}}。
```

只想先拆开一个合数，可以取一个因子：

```cpp
const auto value = 91ULL;
const auto divisor = PollardRho::PollardRho(value);
// divisor 为 7 或 13，value / divisor 是另一部分。
```

想对每个质因子单独做点事，就用回调。重复的质因子也会多次传进来：

```cpp
PollardRho::enumerate_prime_factors(360ULL, [](const auto &prime) {
    std::cout << prime << '\n';
});
```

枚举所有因子时，对每个质因子选择一个指数，再用 DFS 组合起来：

```cpp
PollardRho::enumerate_factors(360ULL, [](const auto &divisor) {
    std::cout << divisor << '\n';
});
```

有了质因数分解，欧拉函数直接按公式计算：

$$
\varphi(n)=n\prod_{p\mid n}\left(1-\frac1p\right).
$$

```cpp
const auto phi = PollardRho::euler_phi(360ULL);
// phi == 96。
```
