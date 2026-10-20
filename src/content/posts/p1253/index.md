---
title: "P1253 题解：赋值和加法标记怎样合并"
description: "用仿射变换统一区间赋值与区间加法，先看清操作顺序，再写线段树的懒标记。"
pubDate: 2024-10-25T17:54:00+08:00
updatedDate: 2026-10-20
tags: ["题解", "线段树", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/P1253)。维护一个数组，支持区间赋值、区间加和区间最大值。

这题的关键是懒标记的顺序。先看同样两步，交换顺序后的结果：

```render html
<style>.tag-order svg { display: block; width: 100%; } .tag-order { --addition: #386f9b; } :root[data-theme="dark"] .tag-order { --addition: #8ebce2; }</style>
<div class="tag-order"></div>
<script>
  const scene = document.querySelector('.tag-order');
  function draw() {
    const w = scene.clientWidth, cx = w/2, left = w*.24, right = w*.76;
    scene.innerHTML = `<svg viewBox="0 0 ${w} 304" role="img" aria-label="7 先赋值为 5 再加 3 得到 8，先加 3 再赋值为 5 得到 5">
      <defs><marker id="tag-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="var(--muted)" stroke-width="1.5"/></marker></defs>
      <text x="${cx}" y="36" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="32">7</text>
      <path d="M${cx-12} 48C${cx-12} 76 ${left} 70 ${left} 104" fill="none" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#tag-head)"/>
      <path d="M${cx+12} 48C${cx+12} 76 ${right} 70 ${right} 104" fill="none" stroke="var(--addition)" stroke-width="1.5" marker-end="url(#tag-head)"/>
      <text x="${left-12}" y="78" text-anchor="end" fill="var(--accent-ink)" font-size="14">= 5</text><text x="${right+12}" y="78" fill="var(--addition)" font-size="14">+ 3</text>
      <text x="${left}" y="136" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="28">5</text><text x="${right}" y="136" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="28">10</text>
      <path d="M${left} 148v64" stroke="var(--addition)" stroke-width="1.5" marker-end="url(#tag-head)"/><path d="M${right} 148v64" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#tag-head)"/>
      <text x="${left+12}" y="186" fill="var(--addition)" font-size="14">+ 3</text><text x="${right+12}" y="186" fill="var(--accent-ink)" font-size="14">= 5</text>
      <circle cx="${left}" cy="241" r="25" fill="var(--addition)" opacity=".1"/><circle cx="${right}" cy="241" r="25" fill="var(--accent-soft)"/>
      <text x="${left}" y="251" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="30">8</text><text x="${right}" y="251" text-anchor="middle" fill="var(--text)" font-family="var(--font-mono)" font-size="30">5</text>
      <text x="${left}" y="294" text-anchor="middle" fill="var(--muted)" font-size="13">旧值被覆盖后再加</text><text x="${right}" y="294" text-anchor="middle" fill="var(--muted)" font-size="13">前面的加法被覆盖</text>
    </svg>`;
  }
  new ResizeObserver(draw).observe(scene);
</script>
```

两种操作都可以写成 $f(v)=av+b$：加上 $x$ 对应 $(a,b)=(1,x)$，赋值为 $x$ 对应 $(0,x)$。乘上 0 抹掉旧值，正好表达“覆盖”。不修改则是 $(1,0)$。

## 标记合并就是函数复合

设旧标记为 $g(v)=a_gv+b_g$，新操作为 $f(v)=a_fv+b_f$。真正执行的顺序是先旧后新：

$$
f(g(v))=(a_fa_g)v+(a_fb_g+b_f).
$$

新赋值的 $a_f=0$，会抹掉旧标记；新加法的 $a_f=1$，只累加偏移。

也可以写成原来的行向量矩阵：

$$
(v,1)\begin{pmatrix}a&0\\b&1\end{pmatrix}=(av+b,1).
$$

**先做 $G$ 再做 $F$，行向量右边乘的是 $GF$。** 用函数复合或矩阵都能推到同一个合并式，代码不必真的存四个矩阵元素。

## 为什么只维护最大值就够

这里 $a\in\{0,1\}$，变换单调不减，最大值直接变成 $a\cdot\max+b$。若允许乘负数，就还需要维护最小值。

## 代码

下面是懒标记的核心，使用非空节点。`compose(newer, older)` 明确表示先执行旧标记，再执行新标记。节点整段被覆盖时更新 `maximum` 和 `lazy`；下传时把同一标记作用到两个孩子，再把父标记置回 `(1,0)`。

```cpp
#include <algorithm>

using i64 = long long;
struct Tag { i64 a = 1, b = 0; };
struct Node { i64 maximum; Tag lazy; };

Tag compose(Tag newer, Tag older) {
    return {newer.a * older.a, newer.a * older.b + newer.b};
}

void apply(Node& node, Tag tag) {
    node.maximum = tag.a * node.maximum + tag.b;
    node.lazy = compose(tag, node.lazy);
}

// 区间加 x：apply(node, {1, x});
// 区间赋值 x：apply(node, {0, x});
// 合并孩子：maximum = std::max(left.maximum, right.maximum);
```

线段树的建树是 $O(n)$，单次修改、查询都是 $O(\log n)$，空间 $O(n)$。
