---
title: "9 月秋招总结"
description: "明天就是国庆节了，9 月秋招基本没有收获。1 个小厂面试，2 个笔试，其他基本全是测评。"
pubDate: 2026-09-30
tags: ["秋招", "面试复盘", "并查集", "模拟"]
---

明天就是国庆节了，9 月秋招基本没有收获，1 个小厂面试，2 个笔试，其他基本全是测评。

总结一下面试拷打。

## 面试

一个是我实习公司的实际业务，我是如何提升检索效率的，如何优化项目的性能，这个回答的还不是很流畅。

## 并查集

一个笔试是并查集的算法题，题意大概是：给定三角形的索引数组，如果两个三角形共享一条边，就归到同一个集合里，求最大的一个集合。

这个写的应该很慢，做出来了，但是并查集写的很模糊，不够熟练了。

### 解题思路

把每个三角形看成并查集中的一个节点，共边时合并，集合大小就是其中三角形的数量。A 和 B 共边、B 和 C 共边，即使 A 和 C 没有直接共边，也属于同一个集合。只共享一个顶点则不算。

用一个映射记录每条边第一次出现在哪个三角形中。对于三角形 `(a, b, c)`，依次处理 `(a, b)`、`(b, c)`、`(c, a)` 三条边：

1. 把边的两个端点按大小排序，统一 `(a, b)` 和 `(b, a)` 的表示。
2. 如果这条边第一次出现，就记录当前三角形编号。
3. 否则，把当前三角形与记录的三角形合并，更新集合大小。

一条边即使被多个三角形共享，也只需要都和第一次记录的三角形合并。

例如，四个三角形分别为 `(0, 1, 2)`、`(2, 1, 3)`、`(2, 3, 4)`、`(5, 6, 7)`。前两个共享边 `(1, 2)`，中间两个共享边 `(2, 3)`，所以前三个属于同一个集合，答案为 `3`。

### 参考代码

示例代码先读入三角形数量 `n`，再读入 `n` 行，每行三个顶点索引。

```cpp title="triangle_groups.cpp"
#include <bits/stdc++.h>
#include <array>

std::vector<int> fa, sz;

int find(int x) {
    return fa[x] == x ? x : fa[x] = find(fa[x]);
}

void merge(int x, int y) {
    x = find(x);
    y = find(y);
    if (x == y) return;
    if (sz[x] < sz[y]) std::swap(x, y);
    fa[y] = x;
    sz[x] += sz[y];
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    fa.resize(n + 1);
    std::iota(fa.begin(), fa.end(), 0);
    sz.assign(n + 1, 1);

    std::map<std::pair<int, int>, int> owner;
    for (int i = 1; i <= n; ++i) {
        std::array<int, 3> a;
        std::cin >> a[0] >> a[1] >> a[2];
        for (int k = 0; k < 3; ++k) {
            int u = a[k], v = a[(k + 1) % 3];
            if (u > v) std::swap(u, v);

            auto it = owner.find({u, v});
            if (it == owner.end()) {
                owner[{u, v}] = i;
            } else {
                merge(i, it->second);
            }
        }
    }

    int ans = 0;
    for (int i = 1; i <= n; ++i) {
        if (fa[i] == i) ans = std::max(ans, sz[i]);
    }
    std::cout << ans << '\n';
}
```

设三角形数量为 $N$。这份代码用 `std::map` 存边，时间复杂度为 $O(N\log N)$，空间复杂度为 $O(N)$。如果改用哈希表，配合路径压缩和按大小合并，期望时间复杂度可以做到 $O(N\alpha(N))$。

## 模拟题

一个笔试是单纯的模拟题，没写出来，卡住了思路。

### 题意总结

- 有 `m` 台设备，每台设备有一个类型（`0/1/2` 三种之一）。
- 有 `n` 个任务，每个任务包含：
  - `t`：到达时间
  - `c`：所需设备类型
  - `d`：执行所需时长
  - `p`：优先级（数值越小优先级越高）
  - `idx`：输入顺序编号
- 任务只能分配到对应类型的设备上执行，且不可抢占。
- 调度规则：
  - 当某台设备空闲时，从**所有已到达但尚未开始执行**的同类型任务中，选择**优先级最高**（`p` 最小）的任务执行。
  - 若优先级相同，选择**到达时间最早**（`t` 最小）的任务。
  - 若到达时间也相同，选择**输入顺序最靠前**（`idx` 最小）的任务。
- 设备空闲时，若没有已到达的同类型待执行任务，则空闲等待；任务到达后立即参与竞争。
- 要求输出每个任务的**开始时间**和**结束时间**。

### 我写错的原因

“把任务按某个顺序排好，然后依次分配给机器”，这是错的理解，因为应该是会有已经到达很多个任务，但是都还没执行的。

### 调度例子

只有一台 `0` 型设备，三个任务都需要这种设备：

| 任务 | `idx` | 到达时间 `t` | 执行时长 `d` | 优先级 `p` |
| --- | --- | --- | --- | --- |
| A | 0 | 0 | 5 | 3 |
| B | 1 | 1 | 2 | 2 |
| C | 2 | 2 | 1 | 1 |

时刻 `0` 只有 A 到达，立即执行，到 `5` 结束。B 和 C 到达时，设备正在执行 A，不能抢占，只能进入等待队列。

时刻 `5`，B 和 C 都已经到达，要先执行优先级更高的 C，再执行 B。按输入顺序输出的结果是：

| 任务 | 开始时间 | 结束时间 |
| --- | --- | --- |
| A | 0 | 5 |
| B | 6 | 8 |
| C | 5 | 6 |

按到达时间直接分配，会错误地让 B 先于 C 执行；把所有任务直接按优先级排序，又会把尚未到达的任务算进去。优先级比较的范围必须是当前已经到达、尚未开始执行的同类型任务。

### 解题思路

三种类型的任务不会争用设备，可以分开模拟。对于每种类型，维护：

- 按到达时间排序的任务数组和一个指针，用来把任务加入等待队列。
- 按 `(p, t, idx)` 排序的等待队列，用小根堆取出当前最优先的任务。
- 设备下一次可用时间的小根堆，初始时每台设备的可用时间都是 `0`。
- 当前时间 `now`，只向前推进。

每次分配一个任务：

1. 把 `now` 推进到不早于最早可用设备的时间。
2. 如果等待队列为空，再把 `now` 推进到不早于下一个任务的到达时间。
3. 将所有 `t <= now`、还没入队的任务加入等待队列。
4. 从队列取出最优先的任务，交给最早可用的设备。开始时间为 `now`，结束时间为 `now + d`。
5. 将该设备的可用时间更新为任务结束时间，继续处理。

同一时刻到达的任务必须全部入队后再选择。如果还有空闲设备，就继续在当前时刻分配。设备堆里可能保留着早于 `now` 的时间，这只表示设备已经空闲，不能让当前时间倒退。

这种写法直接跳到可以分配任务的时刻。设备忙碌期间到达的任务，会在设备空闲时一次性加入等待队列，再比较优先级。

### 参考代码

示例代码先读入 `m n`，再读入 `m` 个设备类型，最后读入 `n` 行 `t c d p`。任务编号按输入顺序记录，最后按这个顺序输出开始时间和结束时间。

```cpp title="task_schedule.cpp"
#include <bits/stdc++.h>
#include <array>
#include <cstdint>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int m, n;
    std::cin >> m >> n;
    std::array<int, 3> cnt{};
    for (int i = 0; i < m; ++i) {
        int c;
        std::cin >> c;
        ++cnt[c];
    }

    std::vector<std::int64_t> t(n), d(n), start(n), finish(n);
    std::vector<int> p(n);
    std::array<std::vector<int>, 3> jobs;
    for (int i = 0; i < n; ++i) {
        int c;
        std::cin >> t[i] >> c >> d[i] >> p[i];
        jobs[c].push_back(i);
    }

    for (int c = 0; c < 3; ++c) {
        auto& order = jobs[c];
        std::sort(order.begin(), order.end(), [&](int a, int b) {
            return std::tie(t[a], a) < std::tie(t[b], b);
        });

        std::priority_queue<std::int64_t, std::vector<std::int64_t>,
                            std::greater<std::int64_t>> freeAt(
            std::greater<std::int64_t>{}, std::vector<std::int64_t>(cnt[c], 0)
        );

        using Waiting = std::tuple<int, std::int64_t, int>; // p, t, idx
        std::priority_queue<Waiting, std::vector<Waiting>, std::greater<Waiting>> waiting;

        int next = 0, len = order.size();
        std::int64_t now = 0;
        while (next < len || !waiting.empty()) {
            now = std::max(now, freeAt.top());
            if (waiting.empty()) now = std::max(now, t[order[next]]);

            while (next < len && t[order[next]] <= now) {
                int idx = order[next++];
                waiting.emplace(p[idx], t[idx], idx);
            }

            int idx = std::get<2>(waiting.top());
            waiting.pop();
            freeAt.pop();
            start[idx] = now;
            finish[idx] = now + d[idx];
            freeAt.push(finish[idx]);
        }
    }

    for (int i = 0; i < n; ++i) {
        std::cout << start[i] << ' ' << finish[i] << '\n';
    }
}
```

设任务总数为 $n$、设备总数为 $m$，排序和等待队列需要 $O(n\log n)$ 时间，设备堆的初始化和更新需要 $O(m+n\log(m+1))$ 时间，总空间复杂度为 $O(n+m)$。时间使用 `std::int64_t`，避免连续执行多个任务时超出 `int` 的范围。
