---
title: "P6327 题解：区间加区间 sin 和"
description: "只存正弦和不够，就再把余弦和一起存下来；区间加就能用两角和公式直接更新。"
pubDate: 2024-10-25T17:34:00+08:00
tags: ["题解", "线段树", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/P6327)

这题我一开始只想着维护正弦和，写到要下传加法标记的时候才发现更新不了。后来才反应过来，余弦和也得一起存。

## 用两角和公式更新

给一个数 $a$ 加上 $d$，有

$$
\begin{aligned}
\sin(a+d)&=\sin a\cos d+\cos a\sin d,\\
\cos(a+d)&=\cos a\cos d-\sin a\sin d.
\end{aligned}
$$

区间里的每个数都加上同一个 $d$，所以 $\sin d$ 和 $\cos d$ 可以从求和里提出来。记

$$
S=\sum_{i=l}^{r}\sin a_i,\qquad
C=\sum_{i=l}^{r}\cos a_i,
$$

更新以后就是

$$
\begin{aligned}
S'&=S\cos d+C\sin d,\\
C'&=C\cos d-S\sin d.
\end{aligned}
$$

这样，节点只存 $S$ 和 $C$ 就够了，用不到区间长度。合并节点时分别相加，懒标记也直接累加。

## 代码

~~~cpp title="main.cpp"
using Info = std::array<double, 2>;
// 区间正弦和、余弦和
using Function = i64;
auto mapping = [&](Function f, Info x) -> Info {
    return Info{x[0] * std::cos(f) + x[1] * std::sin(f), x[1] * std::cos(f) - x[0] * std::sin(f)};
};
auto composition = [&](Function f, Function g) -> Function {
    return f + g;
};
auto op = [&](Info lhs, Info rhs) -> Info {
    return Info{lhs[0] + rhs[0], lhs[1] + rhs[1]};
};
auto e = [&]() -> Info {
    return Info{0, 0};
};
auto id = [&]() -> Function {
    return Function{0};
};
unsigned n;
std::cin >> n;
SegmentTree::LazySegTree<Info, Function, mapping, composition, op, e, id> seg(n, [&](auto ...) {
    Info x;
    int a;
    std::cin >> a;
    x[0] = std::sin(a);
    x[1] = std::cos(a);
    return x;
});
~~~

这题的关键不是线段树，而是看到 $\sin(a+d)$ 里还带着 $\cos a$。想到这一点，剩下的就顺了。

本文原发表于[洛谷专栏](https://www.luogu.com.cn/article/e0a4pppn)。
