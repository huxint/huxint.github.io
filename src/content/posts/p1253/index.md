---
title: "P1253 题解：[yLOI2018] 扶苏的问题"
description: "把区间加和区间赋值都写成矩阵乘法，懒标记怎么合、谁先谁后就都清楚了。"
pubDate: 2024-10-25T17:54:00+08:00
tags: ["题解", "线段树", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/P1253)

这题要同时处理区间赋值、区间加和区间最大值。写的时候我一直在纠结两种修改怎么合，后来看到有人用矩阵推，才把顺序理清。

## 把修改写成矩阵

把值 $v$ 写成 $(v,1)$。加上 $x$，就是

$$
\begin{pmatrix}v&1\end{pmatrix}
\begin{pmatrix}1&0\\x&1\end{pmatrix}
=
\begin{pmatrix}v+x&1\end{pmatrix}.
$$

赋值为 $x$，就是

$$
\begin{pmatrix}v&1\end{pmatrix}
\begin{pmatrix}0&0\\x&1\end{pmatrix}
=
\begin{pmatrix}x&1\end{pmatrix}.
$$

区间最大值也能这样更新：所有数加上 $x$，最大值跟着加；所有数都变成 $x$，最大值也变成 $x$。因此节点记录 $(\max a_i,1)$，合并时取较大值就行。

这里用的是行向量，修改要右乘矩阵。先做 $G$ 再做 $F$，合起来就是 $GF$，顺序别反了。代码里的 `composition(f, g)` 表示先执行 `g`、再执行 `f`，对应的也是 $GF$。

## 代码

~~~cpp title="main.cpp"
using Info = std::array<i64, 2>;
using Function = std::array<i64, 4>;
auto mapping = [&](Function f, Info x) -> Info {
    return Info{x[0] * f[0] + x[1] * f[2], x[0] * f[1] + x[1] * f[3]};
};
auto composition = [&](Function f, Function g) -> Function {
    return Function{g[0] * f[0] + g[1] * f[2], g[0] * f[1] + g[1] * f[3], g[2] * f[0] + g[3] * f[2], g[2] * f[1] + g[3] * f[3]};
};
auto op = [&](Info lhs, Info rhs) -> Info {
    return Info{std::max(lhs[0], rhs[0]), 1};
};
auto e = [&]() -> Info {
    return Info{-inf64, 0};
};
auto id = [&]() -> Function {
    return Function{1, 0, 0, 1};
};
int n, q;
std::cin >> n >> q;
SegmentTree::LazySegTree<Info, Function, mapping, composition, op, e, id> seg(n, [&](auto ...) {
    Info x;
    std::cin >> x[0];
    x[1] = 1;
    return x;
});
~~~

矩阵写法第一眼有点绕，但把两种修改统一成乘法之后，合并顺序就只剩矩阵乘法了。
