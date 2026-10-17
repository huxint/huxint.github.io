---
title: "CF1114F 题解：Please, another Queries on Array?"
description: "欧拉函数只关心区间里出现过哪些质因子。把它们压成位掩码，剩下的交给线段树。"
pubDate: 2024-10-28T20:30:00+08:00
tags: ["题解", "线段树", "数论", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/CF1114F)

这题要维护区间乘，还要查询区间积的欧拉函数。刚看到 $\varphi$ 的时候有点懵，后来把公式拆开，才知道线段树该存什么。

## 乘积和质因子分开存

记区间积为 $P$，它的不同质因子为 $p_1,p_2,\ldots,p_k$，那么

$$
\varphi(P)=P\prod_{i=1}^{k}\frac{p_i-1}{p_i}.
$$

这样一来，除了乘积，只要知道区间里出现过哪些质因子就行了。具体出现了几次，反而不用记。

题目的初始值和乘数都不超过 $300$，质数一共只有 $62$ 个。把它们编个号，一个 `long long` 正好塞得下；合并两个区间时，质因子集合直接按位或。

每个节点再存一个区间长度。整段乘上 $x$ 时，乘积要乘上 $x^{\text{count}}$，顺手把 $x$ 的质因子并进去。

## 代码

先把质数编好号，顺便算出 $\dfrac{p_i-1}{p_i}$。这里的除法用模逆元处理。

~~~cpp title="preprocess.cpp"
for (int i{}; const auto & x : sieve.all()) {
    euler[i] = 1 - modint(1) / sieve.kth(i);
    index[x] = i ++;
}
~~~

对一个数试除，把出现过的质因子标到对应的位上：

~~~cpp title="get.cpp"
auto get = [&](int x) -> i64 {
    i64 data = 0;
    for (int i = 2; i * i <= x; ++ i) {
        for (; x % i == 0; x /= i) {
            data |= 1LL << index[i];
        }
    }
    if (x != 1) {
        data |= 1LL << index[x];
    }
    return data;
};
~~~

`Info` 存乘积、质因子掩码和区间长度，懒标记存乘数及其掩码。合并时，乘积相乘，掩码按位或，长度相加。

~~~cpp title="segtree.cpp"
using Info = std::tuple<modint, i64, int>;
// 区间积、质因子掩码、区间长度
using Function = std::pair<modint, i64>;
auto mapping = [&](Function f, Info x) -> Info {
    auto &[res, data, count] = x;
    res *= f.first.power(count);
    for (int i = 0; i < 62; ++ i) {
        data |= f.second & (1LL << i);
    }
    return x;
};
auto composition = [&](Function f, Function g) -> Function {
    f.first *= g.first;
    for (int i = 0; i < 62; ++ i) {
        f.second |= g.second & (1LL << i);
    }
    return f;
};
auto op = [&](Info lhs, Info rhs) -> Info {
    auto &[res1, data1, count1] = lhs;
    auto &[res2, data2, count2] = rhs;
    res1 *= res2;
    count1 += count2;
    for (int i = 0; i < 62; ++ i) {
        data1 |= data2 & (1LL << i);
    }
    return lhs;
};
auto e = [&]() -> Info {
    return Info{1, 0, 0};
};
auto id = [&]() -> Function {
    return Function{1, 0};
};
SegmentTree::LazySegTree<Info, Function, mapping, composition, op, e, id> seg(n, [&](auto ...) {
    int x;
    std::cin >> x;
    return Info{x, get(x), 1};
});
~~~

查询的时候，把区间积和质因子掩码一起拿出来，再补乘每个质因子对应的系数：

~~~cpp title="query.cpp"
const auto &[res, data, count] = seg.prod(l, r);
modint ans = res;
for (int i = 0; i < 62; ++ i) {
    if ((data >> i & 1) == 0) {
        continue;
    }
    ans *= euler[i];
}
std::cout << ans << "\n";
~~~

修改就把乘数和它的质因子掩码一起下传：

~~~cpp title="apply.cpp"
int x;
std::cin >> x;
seg.apply(l, r, Function{x, get(x)});
~~~

这题挺有意思。欧拉函数只关心质因子有没有出现过，正好能塞进位运算里。写起来不算长，关键是别把乘积和质因子混在一起维护。
