---
title: "CF1114F 题解：把欧拉函数拆成两半来维护"
description: '区间乘，求区间乘积的欧拉函数。$\varphi$ 不能直接合并，得把公式拆开来维护。'
pubDate: 2024-10-28T20:30:00+08:00
updatedDate: 2026-10-20
tags: ["题解", "线段树", "数论", "C++"]
---

[题目链接](https://www.luogu.com.cn/problem/CF1114F)。数组支持区间乘 $x$，查询一段乘积的欧拉函数，答案模 $M=10^9+7$。

一般情况下，$\varphi(ab)\ne\varphi(a)\varphi(b)$。把公式拆开，才能找到可合并的信息。

## 乘积记数值，质因子只记有没有

设区间真实乘积为 $P$，不同质因子的集合为 $S$，则

$$
\varphi(P)=P\prod_{p\in S}\frac{p-1}{p}.
$$

保存 $P\bmod M$ 和取模前的质因子集合。同一个质数的修正系数只乘一次：

```render html
<style>
  .mask-lab { --bit: #386f9b; padding-block: 8px; }
  :root[data-theme="dark"] .mask-lab { --bit: #8ebce2; }
  .mask-heading { margin: 0 0 20px; font: 22px var(--font-mono); }
  .mask-grid { display: grid; grid-template-columns: 72px repeat(4, minmax(0, 1fr)); gap: 8px; align-items: center; text-align: center; }
  .mask-grid span { font: 17px var(--font-mono); padding-block: 12px; }
  .mask-grid .mask-prime { color: var(--muted); font-size: 13px; }
  .mask-grid .mask-label { text-align: left; color: var(--muted); font-size: 13px; }
  .mask-grid .on { color: var(--bit); background: color-mix(in srgb, var(--bit) 10%, transparent); border-bottom: 2px solid var(--bit); }
  .mask-grid .off { color: var(--faint); border-bottom: 1px solid var(--rule); }
  .mask-grid .mask-union { border-top: 1px solid var(--rule-strong); margin-top: 8px; }
  .mask-answer { display: block; margin-top: 22px; font-size: 17px; line-height: 1.8; }
  .mask-answer .kept { color: var(--bit); }
  .mask-controls { display: flex; gap: 24px; margin-top: 14px; }
  .mask-controls button { min-height: 44px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; padding: 4px 0; background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .mask-controls button[aria-pressed="true"] { border-color: var(--accent); color: var(--text); }
</style>
<section class="mask-lab" aria-label="质因子掩码按位或，不重复修正同一质因子">
  <p class="mask-heading"></p><div class="mask-grid"></div><output class="mask-answer" aria-live="polite"></output>
  <div class="mask-controls"><button type="button" data-b="18" aria-pressed="true">$12 \times 18$</button><button type="button" data-b="35" aria-pressed="false">$12 \times 35$</button></div>
</section>
<script>
  let b=18;
  const primes=[2,3,5,7], grid=document.querySelector('.mask-grid');
  function draw() {
    const first=primes.map(p=>12%p===0), second=primes.map(p=>b%p===0), union=first.map((x,i)=>x||second[i]);
    const row=(label,bits,isUnion=false)=>`<span class="mask-label ${isUnion?'mask-union':''}">${label}</span>`+bits.map(on=>`<span class="${on?'on':'off'} ${isUnion?'mask-union':''}">${on?1:0}</span>`).join('');
    grid.innerHTML='<span class="mask-prime">质数</span>'+primes.map(p=>`<span class="mask-prime">${p}</span>`).join('')+row('12',first)+row(String(b),second)+row('按位或',union,true);
    document.querySelector('.mask-heading').textContent=`$P = 12 \\times ${b} = ${12*b}$`;
    const factors=primes.filter((_,i)=>union[i]);
    const phi=factors.reduce((value,p)=>value/p*(p-1),12*b);
    document.querySelector('output').innerHTML=`$\\varphi(P) = ${12*b}${factors.map(p=>` \\times \\htmlClass{kept}{\\frac{${p-1}}{${p}}}`).join('')} = ${phi}$`;
  }
  document.querySelectorAll('[data-b]').forEach(button=>button.addEventListener('click',()=>{b=Number(button.dataset.b);document.querySelectorAll('[data-b]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));draw();}));
  draw();
</script>
```

初始值和乘数都不超过 $300$，可能出现的质数只有 $62$ 个，一个 `uint64_t` 就能保存集合。

合并时乘积相乘、掩码取或。**不能重新分解取模后的乘积来恢复集合**。

## 整段乘 x 时，两个部分分别怎样变

如果区间长度为 $L$，每个元素都乘 $x$，那么区间乘积需要乘 $x^L$，集合则并入 $x$ 的所有质因子。所以节点保存 `(product, mask, length)`，懒标记保存 `(multiplier, mask)`。

两个懒标记合并：乘数相乘，集合取或。这里没有赋值，操作顺序也不影响结果。

查询得到节点后，枚举掩码中存在的质数，补乘 $(p-1)\cdot p^{-1}\bmod M$。这里每个 $p<M$，与质数模数 $M$ 互质，逆元存在。

## 代码

下面只列节点操作；`power` 是普通的模快速幂。预处理出 62 个质数、每个 $x\le300$ 的掩码，以及每个质数的修正系数后，线段树递归部分就不再需要分解整数。

```cpp
#include <cstdint>

using u64 = std::uint64_t;
const long long MOD = 1'000'000'007;
long long power(long long x, int e); // 模 MOD 的快速幂

struct Info {
    long long product = 1;
    u64 mask = 0;
    int length = 0;
};
struct Tag { long long multiplier = 1; u64 mask = 0; };

Info merge(Info a, Info b) {
    return {a.product * b.product % MOD,
            a.mask | b.mask, a.length + b.length};
}

void apply(Info& node, Tag tag) {
    node.product = node.product * power(tag.multiplier, node.length) % MOD;
    node.mask |= tag.mask;
}

Tag compose(Tag a, Tag b) {
    return {a.multiplier * b.multiplier % MOD, a.mask | b.mask};
}
```

位运算 `a.mask | b.mask` 一次就能合并整个集合，无需再循环 62 次。叶子用 `(a_i, mask[a_i], 1)` 初始化，空查询结果是 `(1,0,0)`，无修改标记是 `(1,0)`。

这份写法在每次节点更新时计算 $x^L$，因此一次区间修改上界为 $O(\log^2 n)$；查询加上枚举质因子的修正为 $O(\log n+62)$，空间 $O(n)$。位掩码把集合操作变得很便宜，但不会省掉快速幂的开销。
