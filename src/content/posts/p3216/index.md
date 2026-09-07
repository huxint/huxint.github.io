---
title: "P3216 题解：[HNOI2011] 数学作业"
description: "把拼接写成递推，位数相同的数放在一起，用矩阵快速幂整段处理。"
pubDate: 2024-11-11T23:47:00+08:00
tags: ["题解", "矩阵快速幂", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/P3216)

把 $1$ 到 $n$ 依次拼接，数会长得很快。不过我们只需要余数，可以边拼边取模。

记拼到 $i$ 时的结果为 $a_i$。如果 $i$ 有 $k$ 位，就有

$$
a_i=a_{i-1}\times10^k+i.
$$

## 写成矩阵

递推里用到了拼接结果和当前的 $i$，再补一个常数 $1$，就能凑成行向量：

$$
\begin{pmatrix}
a_{i-1} & i-1 & 1
\end{pmatrix}
\begin{pmatrix}
10^k & 0 & 0\\
1 & 1 & 0\\
1 & 1 & 1
\end{pmatrix}
=
\begin{pmatrix}
a_i & i & 1
\end{pmatrix}.
$$

第一项得到 $a_{i-1}\times10^k+i$，第二项从 $i-1$ 变成 $i$，正好完成一次拼接。

## 按位数分段

一位数用同一个矩阵，两位数又用同一个矩阵。所以不用一个数一个数地算，可以让矩阵做快速幂，整段一起处理。

从 $(0,0,1)$ 出发，依次处理这些分段。完整的一段 $k$ 位数有 $9\times10^{k-1}$ 个，最后一段算到 $n$ 为止。处理完后，第一维就是答案。

## 主要代码

~~~cpp title="main.cpp"
// count 是 n 的十进制位数
Matrix::Matrix<modint, 1, 3> unit = std::initializer_list<std::initializer_list<modint>>{{0, 0, 1}};
u64 pow10 = 1;
while (count --) {
    unit *= Matrix::Matrix3F<modint>{std::initializer_list<std::initializer_list<modint>>{{10 * pow10, 0, 0}, {1, 1, 0}, {1, 1, 1}}}.power(count ? 10 * pow10 - pow10 : n - pow10 + 1);
    pow10 *= 10;
}
std::cout << unit(0, 0) << "\n";
~~~
