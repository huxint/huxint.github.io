---
title: "SparseTable 模板教程"
description: "先把长度为二的幂的区间算好，查询时取两块合并，就能很快得到区间最值。"
pubDate: 2025-02-17T22:29:00+08:00
tags: ["数据结构", "模板", "C++"]
---

数组不再修改，只需要反复查询区间最值，就可以考虑 ST 表。预处理时多做一点，后面每次查询就只剩下两块区间的合并。

## 提前算好每一层

记 `table[k][i]` 为从 $i$ 开始、长度为 $2^k$ 的区间信息。把相邻的两小块合起来，就能得到上一层的大块：

$$
\text{table}[k][i]
=\operatorname{op}\left(
\text{table}[k-1][i],
\text{table}[k-1][i+2^{k-1}]
\right).
$$

查询时，一块贴着左端点，一块贴着右端点，让它们一起覆盖整个区间。两块可能重叠，但求最大值、最小值、GCD、按位与或按位或时，重复算一遍不会改变结果。

这就是合并操作要满足结合律和幂等性的原因。求和会把重叠部分多算一次，不能直接套这个查询方法。

常见的这些合并操作都是常数时间，所以预处理需要 $O(n\log n)$，普通查询只需要 $O(1)$。

## 模板代码

~~~cpp title="SparseTable.hpp"
template <typename T, auto op, std::size_t level = 25>
class SparseTable {
    using size_type = unsigned;
public:
    constexpr SparseTable(std::integral auto n) : SparseTable(n, [](auto x) {
        return T{};
    }) {}

    constexpr SparseTable(const std::ranges::range auto &container) : SparseTable(container.begin(), container.end()) {}

    template <typename Iterator>
    constexpr SparseTable(Iterator begin, Iterator end) : SparseTable(end - begin, [&](const auto &index) {
        return *(begin + index);
    }) {}

    constexpr SparseTable(std::integral auto n, auto &&mapping) : max_range(n) {
        if (max_range == 0) {
            return;
        }
        size_type log_size = max_range == 1 ? 1 : std::bit_width(max_range - 1);
        for (size_type i = 0; i < log_size; ++ i) {
            table[i].resize(max_range - (1 << i) + 1);
        }
        auto &value = table[0];
        for (size_type i = 0; i < max_range; ++ i) {
            value[i] = mapping(i);
        }
        for (size_type i = 1; i < log_size; ++ i) {
            auto &current = table[i];
            auto &previous = table[i - 1];
            size_type _ = max_range - (1 << i) + 1;
            for (size_type start = 0, end = 1 << (i - 1); start < _; ++ start, ++ end) {
                current[start] = op(previous[start], previous[end]);
            }
        }
    }

    constexpr auto size() const -> size_type {
        return max_range;
    }

    constexpr auto query_all() const -> T {
        return query(0, max_range - 1);
    }

    constexpr auto query(size_type index) const -> T {
        return table[0][index];
    }

    constexpr auto query(size_type left, size_type right) const -> T {
        size_type depth = std::bit_width((right - left) >> 1);
        return op(table[depth][left], table[depth][right - (1 << depth) + 1]);
    }

    constexpr auto min_left(size_type right, auto &&check) -> size_type {
        if (right < 0 or right >= max_range or not check(query(right))) {
            return -1;
        }
        return right == 0 ? right : binary_search(right, -1, [&](auto left) {
            return check(query(left, right));
        });
    }

    constexpr auto max_right(size_type left, auto &&check) -> size_type {
        if (left < 0 or left >= max_range or not check(query(left))) {
            return -1;
        }
        return left == max_range - 1 ? left : binary_search(left, max_range, [&](auto right) {
            return check(query(left, right));
        });
    }

    template <typename Ostream>
    friend constexpr auto operator <<(Ostream &ostream, const SparseTable &value) -> Ostream & {
        for (size_type i = 0; i < value.size(); ++ i) {
            ostream << value.query(i) << ' ';
        }
        return ostream;
    }

private:
    size_type max_range;
    std::array<std::vector<T>, level> table;
    constexpr auto binary_search(int ok, int ng, auto &&check) -> size_type {
        while (std::abs(ok - ng) > 1) {
            auto x = ok + (ng - ok) / 2;
            (check(x) ? ok : ng) = x;
        }
        return ok;
    }
};
~~~

## 简单用法

直接传入容器，再指定合并操作：

```cpp
std::vector<int> nums = {3, 1, 4, 1, 5};
SparseTable<int, std::ranges::min> st(nums);

int value = st.query(2);       // 下标 2 的值。
int result = st.query(1, 3);   // 闭区间 [1, 3] 的最小值。
int all = st.query_all();     // 整个数组的最小值。
```

也可以传迭代器，或者用映射函数生成初始值。比如边读入边建表，就不用再存一份数组：

```cpp
SparseTable<int, std::ranges::max> st(n, [](auto ...) {
    int x;
    std::cin >> x;
    return x;
});
```

合并操作也可以自己写：

```cpp
constexpr auto op = [](auto a, auto b) {
    return std::gcd(a, b);
};
SparseTable<int, op> st(nums);
```

## 顺便二分边界

`max_right` 固定左端点向右找，`min_left` 固定右端点向左找。比如想找一段最大值不超过 $10$ 的区间：

```cpp
std::vector<int> nums = {3, 1, 4, 9, 12};
SparseTable<int, std::ranges::max> st(nums);
auto right = st.max_right(2, [](int x) {
    return x <= 10;
});
// right == 3，对应区间 [2, 3]。
```

这里能二分，是因为区间扩大后，最大值只会变大或不变。一旦超过 $10$，继续扩大也不会重新满足条件。这两个接口会做 $O(\log n)$ 次查询。
