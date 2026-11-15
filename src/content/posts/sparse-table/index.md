---
title: "ST 表：$O(1)$ 查区间最值"
description: "静态数组反复查区间最值，预处理之后，每次只要拿两段一拼。"
pubDate: 2025-02-17T22:29:00+08:00
updatedDate: 2026-10-20
tags: ["数据结构", "模板", "C++"]
---

数组不修改，只反复查询区间最值：ST 表预存长度为 $1,2,4,8,\ldots$ 的区间，每次查询只取两块。

## 先把短区间拼成长区间

用零下标，记 $\text{st}[k][i]$ 为从 $i$ 开始、长度为 $2^k$ 的区间最小值。第 0 层就是原数组；之后每一层，把前一层相邻的两块合起来：

$$
\text{st}[k][i]=\min\bigl(\text{st}[k-1][i],\text{st}[k-1][i+2^{k-1}]\bigr).
$$

每层合并相邻的两块，共 $O(\log n)$ 层，预处理的时间、空间都是 $O(n\log n)$。

## 查询为什么可以重叠

查询闭区间 $[l,r]$，先选出不超过区间长度的最大二次幂：

$$
k=\lfloor\log_2(r-l+1)\rfloor.
$$

两块长度都为 $2^k$，分别贴着左右端点。试着调整下面的区间：

```render html
<style>
  .st-lab { --left: #386f9b; --right: #36755d; padding-block: 10px; }
  :root[data-theme="dark"] .st-lab { --left: #8ebce2; --right: #8ac9ab; }
  .st-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; margin-bottom: 16px; }
  .st-controls label { display: grid; grid-template-columns: 1fr auto; align-items: center; color: var(--muted); font-size: 13px; }
  .st-controls input { grid-column: 1 / -1; width: 100%; min-height: 44px; margin: 0; cursor: pointer; accent-color: var(--left); }
  .st-controls label:last-child input { accent-color: var(--right); }
  .st-controls output { color: var(--text); font: 16px var(--font-mono); }
  @media (max-width: 420px) { .st-controls { grid-template-columns: 1fr; gap: 0; } }
  .st-drawing svg { display: block; width: 100%; }
  .st-answer { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; margin-top: 14px; font-size: 14px; }
  .st-answer strong { font: 24px var(--font-mono); }
  .st-answer > span { color: var(--muted); }
</style>
<section class="st-lab" aria-label="两块预处理区间覆盖一次查询">
  <div class="st-controls"><label><span>左端点 $l$</span><output class="st-l-value">1</output><input type="range" class="st-left" min="0" max="7" value="1" aria-label="左端点"></label><label><span>右端点 $r$</span><output class="st-r-value">6</output><input type="range" class="st-right" min="0" max="7" value="6" aria-label="右端点"></label></div>
  <div class="st-drawing"></div><output class="st-answer" aria-live="polite"></output>
</section>
<script>
  const values = [3, 1, 4, 1, 5, 9, 2, 6];
  const left = document.querySelector('.st-left'), right = document.querySelector('.st-right');
  const drawing = document.querySelector('.st-drawing');
  function draw() {
    const l = Number(left.value), r = Number(right.value), length = r - l + 1;
    const size = 2 ** Math.floor(Math.log2(length)), end = l + size - 1, start = r - size + 1;
    const w = drawing.clientWidth, step = (w - 24) / 8, x = i => 12 + i * step;
    const a = Math.min(...values.slice(l, end + 1)), b = Math.min(...values.slice(start, r + 1));
    const text = (x, y, value, fill = 'var(--text)', size = 13, anchor = 'middle') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
    const band = (from, to, y, color, label) => `<rect x="${x(from)}" y="${y}" width="${step * size}" height="18" fill="${color}" opacity=".17"/><path d="M${x(from)} ${y}v18h${step * size}v-18" fill="none" stroke="${color}" stroke-width="1.5"/>${text((x(from) + x(to + 1)) / 2, y + 39, label, color)}`;
    drawing.innerHTML = `<svg viewBox="0 0 ${w} 270" role="img" aria-label="查询 ${l} 到 ${r}，使用长度 ${size} 的两块，最小值 ${Math.min(a,b)}">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="var(--muted)" opacity=".2"/></pattern></defs>
      <path d="M${x(l)} 36v-8h${step * length}v8" fill="none" stroke="var(--text)"/>${text((x(l)+x(r+1))/2, 16, `查询 [${l}, ${r}]`)}
      <rect x="${x(l)}" y="49" width="${step * length}" height="42" fill="var(--accent)" opacity=".08"/>
      ${values.map((value,i) => `${text(x(i)+step/2,78,value,i>=l&&i<=r?'var(--text)':'var(--faint)',20)}${text(x(i)+step/2,113,i,'var(--muted)',12)}`).join('')}
      <path d="M12 94H${w-12}" stroke="var(--rule-strong)"/>
      ${band(l,end,140,'var(--left)',`[${l}, ${end}] → ${a}`)}
      ${band(start,r,210,'var(--right)',`[${start}, ${r}] → ${b}`)}
      <rect x="${x(start)}" y="140" width="${step * Math.max(0,end-start+1)}" height="88" fill="url(#hatch)"/>
    </svg>`;
    document.querySelector('.st-l-value').textContent=l;
    document.querySelector('.st-r-value').textContent=r;
    document.querySelector('.st-answer').innerHTML = `<strong>$\\min(${a}, ${b}) = ${Math.min(a,b)}$</strong><span>${size + size - length ? '斜线部分重复取最小值，结果不变' : '两块恰好覆盖查询'} · 每块长度 ${size}</span>`;
  }
  left.addEventListener('input', () => { if (+left.value > +right.value) right.value = left.value; draw(); });
  right.addEventListener('input', () => { if (+right.value < +left.value) left.value = right.value; draw(); });
  new ResizeObserver(draw).observe(drawing);
</script>
```

查询式就是：

$$
\min\bigl(\text{st}[k][l],\text{st}[k][r-2^k+1]\bigr).
$$

这要求合并操作满足结合律，而且重复合并同一份信息不改变结果，也就是**幂等性**。最大值、最小值、GCD、按位与或都可以；求和会重复计算重叠元素，不能直接套这个查询式。数组若会修改，也更适合考虑线段树。

## 代码

下面只保留建表和查询。约定数组非空，查询使用合法的零下标闭区间；`bit_width(len) - 1` 就是 $\lfloor\log_2 len\rfloor$，不需要浮点运算。代码按 C++20 编译。

<details>
<summary>展开 ST 表实现与用法</summary>

```cpp
#include <algorithm>
#include <bit>
#include <vector>

template <class T, class Op>
class SparseTable {
    std::vector<std::vector<T>> st;
    Op op;

public:
    SparseTable(const std::vector<T>& a, Op combine) : op(combine) {
        int n = a.size();
        int levels = std::bit_width(static_cast<unsigned>(n));
        st.resize(levels);
        st[0] = a;
        for (int k = 1; k < levels; ++k) {
            int len = 1 << k, half = len / 2;
            st[k].resize(n - len + 1);
            for (int i = 0; i + len <= n; ++i) {
                st[k][i] = op(st[k - 1][i], st[k - 1][i + half]);
            }
        }
    }

    T query(int l, int r) const {
        unsigned len = r - l + 1;
        int k = std::bit_width(len) - 1;
        return op(st[k][l], st[k][r - (1 << k) + 1]);
    }
};

// 用法：
// std::vector<int> a{3, 1, 4, 1, 5, 9, 2, 6};
// SparseTable st(a, [](int x, int y) { return std::min(x, y); });
// st.query(1, 6) == 1;
```

</details>

按一次合并为常数计，查询 $O(1)$；GCD 的具体整数运算成本另算。
