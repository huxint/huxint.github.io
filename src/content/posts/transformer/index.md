---
title: "Transformer：理解 Attention Is All You Need"
description: "从注意力怎样汇总信息讲起，用可操作的图理解多头、位置编码，以及解码器为什么不能偷看答案。"
pubDate: 2026-09-06T10:00:00+08:00
updatedDate: 2026-10-19
tags: ["机器学习", "论文笔记"]
---

第一次读[《Attention Is All You Need》](https://arxiv.org/abs/1706.03762)时，公式不算多，但概念一堆。后来发现先别管编码器和解码器，直接抓住注意力会容易很多：一个词更新自己的表示时，到底该看句子里哪些词。

RNN 沿着句子逐步传递状态，自注意力则让每个位置直接读取其他位置的信息。先把这次“读取”弄清楚，再看多头、位置编码和整套结构，会顺很多。下面沿用原论文的翻译场景；文中说的“词”，实际计算时是 token，可能是一个子词。

## 注意力到底算出了什么

一个词进入模型后，先变成向量，也就是一串数字。把各个位置的向量按行排起来，记作 $X$，再通过三组可学习的线性变换：

$$
Q=XW^Q,\qquad K=XW^K,\qquad V=XW^V.
$$

三个名字对应三种用途：

- **Q（Query）**：我现在需要查找什么信息。
- **K（Key）**：我有什么特征，可以被别的位置匹配到。
- **V（Value）**：如果读到我，实际取走什么内容。

它们的**每一行都对应一个词**，没有把整句话压成一个向量。下面用“猫 / 追 / 狗”三个位置举例，给每个词的 $Q$、$K$、$V$ 都只留两个数，所以三个矩阵都是 $3\times2$。数值是手工设定的，只看计算过程。

### 先算“谁读谁”的分数

拿“追”的查询向量，和“狗”的键向量做点积，就得到一个匹配分数。想让每个词都看一遍整句，就要把每个 $Q$ 和每个 $K$ 都算一次。

矩阵乘法刚好能完成这件事。把 $K$ 转置成 $K^\top$，原来每个词占一行的键向量，就变成了每个词占一列。这样，$Q$ 的一行乘 $K^\top$ 的一列，恰好就是一个查询和一个键的点积：

$$
S=\frac{QK^\top}{\sqrt{d_k}}.
$$

```render html title="点选结果格，查看对应的行、列和算式。"
<style>
  .matrix-lab { --row: #376d9b; --column: #39765d; padding-block: 8px; }
  :root[data-theme="dark"] .matrix-lab { --row: #91bce6; --column: #8cc9ac; }
  .matrix-product { display: grid; grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr); grid-template-areas: "left multiply right equals result"; gap: 12px; align-items: center; }
  .matrix-left { grid-area: left; }
  .matrix-right { grid-area: right; }
  .matrix-result { grid-area: result; }
  .matrix-multiply { grid-area: multiply; }
  .matrix-equals { grid-area: equals; }
  .matrix-operator { text-align: center; color: var(--muted); font-size: 24px; }
  .matrix-scale { display: block; position: relative; left: 50%; width: max-content; transform: translateX(-50%); font-size: 12px; white-space: nowrap; }
  .matrix-title { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; font-size: 17px; font-weight: 600; }
  .matrix-title small { font-size: 12px; color: var(--muted); font-weight: 400; }
  .matrix-grid { position: relative; display: grid; padding-right: 4px; }
  .matrix-grid::before, .matrix-grid::after { position: absolute; top: 22px; bottom: 0; width: 5px; border-block: 1.5px solid var(--muted); content: ''; pointer-events: none; }
  .matrix-grid::before { left: 20px; border-left: 1.5px solid var(--muted); }
  .matrix-grid::after { right: 0; border-right: 1.5px solid var(--muted); }
  .matrix-key, .matrix-cell { display: flex; justify-content: center; align-items: center; min-width: 0; padding: 0; }
  .matrix-key { color: var(--muted); font-size: 13px; }
  .matrix-cell { min-height: 44px; border: 0; border-radius: 0; background: transparent; font: 14px var(--font-mono); font-variant-numeric: tabular-nums; }
  button.matrix-cell { cursor: pointer; }
  .matrix-cell.row-on { color: var(--row); background: color-mix(in srgb, var(--row) 12%, transparent); }
  .matrix-cell.column-on { color: var(--column); background: color-mix(in srgb, var(--column) 12%, transparent); }
  .matrix-key.row-on { color: var(--row); font-weight: 650; }
  .matrix-key.column-on { color: var(--column); font-weight: 650; }
  .matrix-cell.chosen { box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-soft); color: var(--text); border-radius: 3px; }
  button.matrix-cell:hover { background: var(--accent-soft); }
  .matrix-calculation { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 2px 8px; min-height: 3.6em; margin-top: 24px; font-size: 14px; line-height: 1.8; font-variant-numeric: tabular-nums; }
  .matrix-calculation > span { white-space: nowrap; }
  .matrix-calculation sub { font-size: 11px; }
  .matrix-calculation sup { font-size: 11px; }
  .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr); grid-template-areas: "left equals result"; }
  @media (max-width: 600px) {
    .matrix-product { grid-template-columns: minmax(0, 2fr) 16px minmax(0, 3fr); grid-template-areas: "left multiply right" ". equals ." "result result result"; gap: 12px 4px; }
    .matrix-result { width: min(240px, 100%); justify-self: center; }
    .matrix-cell { font-size: 12.5px; }
    .matrix-result .matrix-cell { font-size: 14px; }
    .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 3fr) 16px minmax(0, 2fr); }
    .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: 1fr; grid-template-areas: "left" "equals" "result"; }
    .matrix-lab[data-phase="1"] .matrix-left { width: min(240px, 100%); justify-self: center; }
    .matrix-lab[data-phase="1"] .matrix-equals { transform: rotate(90deg); }
  }
</style>
<section class="matrix-lab" data-phase="0" aria-label="QK转置相乘，计算匹配分数">
  <div class="matrix-workspace"></div>
  <output class="matrix-calculation" aria-live="polite"></output>
</section>
<script>
  const words = ['猫', '追', '狗'], features = ['1', '2'];
  const Q = [[1, 0], [1, 1], [0, 1]];
  const K = [[1, 0], [0, 1], [1, 1]];
  const V = [[1, 0], [0, 2], [3, 1]];
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const transpose = matrix => matrix[0].map((_, j) => matrix.map(row => row[j]));
  const KT = transpose(K);
  const S = Q.map(q => K.map(k => dot(q, k) / Math.sqrt(2)));
  const A = S.map(row => {
    const exp = row.map(s => Math.exp(s - Math.max(...row)));
    const total = exp.reduce((sum, x) => sum + x, 0);
    return exp.map(x => x / total);
  });
  const O = A.map(row => transpose(V).map(column => dot(row, column)));
  const lab = document.querySelector('.matrix-lab');
  const workspace = document.querySelector('.matrix-workspace');
  const calculation = document.querySelector('output');
  const phase = Number(lab.dataset.phase);
  let row = 1, column = phase === 2 ? 0 : 2;

  function matrix(name, data, rowNames, columnNames, place, highlight, decimals, interactive = false) {
    const cols = data[0].length;
    const keys = `<span></span>${columnNames.map((name, j) => `<span class="matrix-key${highlight === 'column' && j === column ? ' column-on' : ''}">${name}</span>`).join('')}`;
    const cells = data.map((values, i) => `
      <span class="matrix-key${highlight === 'row' && i === row ? ' row-on' : ''}">${rowNames[i]}</span>
      ${values.map((value, j) => {
        const chosen = interactive && i === row && j === column;
        const cls = `matrix-cell${highlight === 'row' && i === row ? ' row-on' : ''}${highlight === 'column' && j === column ? ' column-on' : ''}${chosen ? ' chosen' : ''}`;
        const number = decimals ? value.toFixed(3) : String(value);
        return interactive
          ? `<button type="button" class="${cls}" data-cell="${i}:${j}" aria-pressed="${chosen}" aria-label="${name}：${rowNames[i]}行，${columnNames[j]}列，${number}">${number}</button>`
          : `<span class="${cls}">${number}</span>`;
      }).join('')}
    `).join('');
    return `<div class="matrix-${place}"><p class="matrix-title">${name}<small>${data.length} × ${cols}</small></p><div class="matrix-grid" style="grid-template-columns:20px repeat(${cols},minmax(0,1fr));grid-template-rows:22px repeat(${data.length},44px)">${keys}${cells}</div></div>`;
  }

  function refresh() {
    let left, right = '', result, operator;
    if (phase === 0) {
      left = matrix('Q', Q, words, features, 'left', 'row', false);
      right = matrix('Kᵀ', KT, features, words, 'right', 'column', false);
      result = matrix('S', S, words, words, 'result', '', true, true);
      operator = '<span class="matrix-scale">÷√2</span>=';
      calculation.innerHTML = `<span>S<sub>${words[row]},${words[column]}</sub> =</span><span>(${Q[row][0]} × ${K[column][0]} + ${Q[row][1]} × ${K[column][1]}) / √2</span><span>≈ ${S[row][column].toFixed(3)}</span>`;
    } else if (phase === 1) {
      left = matrix('S', S, words, words, 'left', 'row', true);
      result = matrix('A', A, words, words, 'result', 'row', true, true);
      operator = '→';
      calculation.innerHTML = `<span>A<sub>${words[row]},${words[column]}</sub> =</span><span>e<sup>${S[row][column].toFixed(3)}</sup> /</span><span>(${S[row].map(s => `e<sup>${s.toFixed(3)}</sup>`).join(' + ')})</span><span>≈ ${A[row][column].toFixed(3)}</span>`;
    } else {
      left = matrix('A', A, words, words, 'left', 'row', true);
      right = matrix('V', V, words, features, 'right', 'column', false);
      result = matrix('O', O, words, features, 'result', '', true, true);
      operator = '=';
      calculation.innerHTML = `<span>O<sub>${words[row]},${column + 1}</sub> =</span>${A[row].map((a, j) => `<span>${j ? '+ ' : ''}${a.toFixed(3)} × ${V[j][column]}</span>`).join('')}<span>≈ ${O[row][column].toFixed(3)}</span>`;
    }
    workspace.innerHTML = `<div class="matrix-product">${left}${right ? '<span class="matrix-operator matrix-multiply">×</span>' : ''}${right}<span class="matrix-operator matrix-equals">${operator}</span>${result}</div>`;
    workspace.querySelectorAll('[data-cell]').forEach(button => button.addEventListener('click', () => {
      [row, column] = button.dataset.cell.split(':').map(Number); refresh();
      workspace.querySelector(`[data-cell="${row}:${column}"]`).focus({ preventScroll: true });
    }));
  }
  refresh();
</script>
```

$3\times2$ 乘 $2\times3$，得到了 $3\times3$ 的 $S$。它的行表示“谁在查询”，列表示“正在看谁”：比如“追”行、“狗”列，就是“追”读取“狗”的分数。查询和键用了不同的投影，所以这张表也不要求对称。

$d_k$ 是每个查询和键的维数，例子里就是 $2$。维数增大时，点积的波动通常也会变大；除以 $\sqrt{d_k}$ 是为了控制分数尺度，避免下一步的 softmax 过早接近“一个位置占满全部权重”，让训练更容易进行。

### 每一行各自分配权重

分数还不能直接拿来混合信息。softmax 先把分数 $s$ 换成 $e^s$，再除以这一行所有 $e^s$ 的和，变成非负、加起来为 $1$ 的一组权重：

$$
A=\operatorname{softmax}_{\text{逐行}}(S).
$$

```render html
<style>
  .matrix-lab { --row: #376d9b; --column: #39765d; padding-block: 8px; }
  :root[data-theme="dark"] .matrix-lab { --row: #91bce6; --column: #8cc9ac; }
  .matrix-product { display: grid; grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr); grid-template-areas: "left multiply right equals result"; gap: 12px; align-items: center; }
  .matrix-left { grid-area: left; }
  .matrix-right { grid-area: right; }
  .matrix-result { grid-area: result; }
  .matrix-multiply { grid-area: multiply; }
  .matrix-equals { grid-area: equals; }
  .matrix-operator { text-align: center; color: var(--muted); font-size: 24px; }
  .matrix-scale { display: block; position: relative; left: 50%; width: max-content; transform: translateX(-50%); font-size: 12px; white-space: nowrap; }
  .matrix-title { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; font-size: 17px; font-weight: 600; }
  .matrix-title small { font-size: 12px; color: var(--muted); font-weight: 400; }
  .matrix-grid { position: relative; display: grid; padding-right: 4px; }
  .matrix-grid::before, .matrix-grid::after { position: absolute; top: 22px; bottom: 0; width: 5px; border-block: 1.5px solid var(--muted); content: ''; pointer-events: none; }
  .matrix-grid::before { left: 20px; border-left: 1.5px solid var(--muted); }
  .matrix-grid::after { right: 0; border-right: 1.5px solid var(--muted); }
  .matrix-key, .matrix-cell { display: flex; justify-content: center; align-items: center; min-width: 0; padding: 0; }
  .matrix-key { color: var(--muted); font-size: 13px; }
  .matrix-cell { min-height: 44px; border: 0; border-radius: 0; background: transparent; font: 14px var(--font-mono); font-variant-numeric: tabular-nums; }
  button.matrix-cell { cursor: pointer; }
  .matrix-cell.row-on { color: var(--row); background: color-mix(in srgb, var(--row) 12%, transparent); }
  .matrix-cell.column-on { color: var(--column); background: color-mix(in srgb, var(--column) 12%, transparent); }
  .matrix-key.row-on { color: var(--row); font-weight: 650; }
  .matrix-key.column-on { color: var(--column); font-weight: 650; }
  .matrix-cell.chosen { box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-soft); color: var(--text); border-radius: 3px; }
  button.matrix-cell:hover { background: var(--accent-soft); }
  .matrix-calculation { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 2px 8px; min-height: 3.6em; margin-top: 24px; font-size: 14px; line-height: 1.8; font-variant-numeric: tabular-nums; }
  .matrix-calculation > span { white-space: nowrap; }
  .matrix-calculation sub { font-size: 11px; }
  .matrix-calculation sup { font-size: 11px; }
  .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr); grid-template-areas: "left equals result"; }
  @media (max-width: 600px) {
    .matrix-product { grid-template-columns: minmax(0, 2fr) 16px minmax(0, 3fr); grid-template-areas: "left multiply right" ". equals ." "result result result"; gap: 12px 4px; }
    .matrix-result { width: min(240px, 100%); justify-self: center; }
    .matrix-cell { font-size: 12.5px; }
    .matrix-result .matrix-cell { font-size: 14px; }
    .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 3fr) 16px minmax(0, 2fr); }
    .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: 1fr; grid-template-areas: "left" "equals" "result"; }
    .matrix-lab[data-phase="1"] .matrix-left { width: min(240px, 100%); justify-self: center; }
    .matrix-lab[data-phase="1"] .matrix-equals { transform: rotate(90deg); }
  }
</style>
<section class="matrix-lab" data-phase="1" aria-label="每一行单独做softmax，得到注意力权重">
  <div class="matrix-workspace"></div>
  <output class="matrix-calculation" aria-live="polite"></output>
</section>
<script>
  const words = ['猫', '追', '狗'], features = ['1', '2'];
  const Q = [[1, 0], [1, 1], [0, 1]];
  const K = [[1, 0], [0, 1], [1, 1]];
  const V = [[1, 0], [0, 2], [3, 1]];
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const transpose = matrix => matrix[0].map((_, j) => matrix.map(row => row[j]));
  const KT = transpose(K);
  const S = Q.map(q => K.map(k => dot(q, k) / Math.sqrt(2)));
  const A = S.map(row => {
    const exp = row.map(s => Math.exp(s - Math.max(...row)));
    const total = exp.reduce((sum, x) => sum + x, 0);
    return exp.map(x => x / total);
  });
  const O = A.map(row => transpose(V).map(column => dot(row, column)));
  const lab = document.querySelector('.matrix-lab');
  const workspace = document.querySelector('.matrix-workspace');
  const calculation = document.querySelector('output');
  const phase = Number(lab.dataset.phase);
  let row = 1, column = phase === 2 ? 0 : 2;

  function matrix(name, data, rowNames, columnNames, place, highlight, decimals, interactive = false) {
    const cols = data[0].length;
    const keys = `<span></span>${columnNames.map((name, j) => `<span class="matrix-key${highlight === 'column' && j === column ? ' column-on' : ''}">${name}</span>`).join('')}`;
    const cells = data.map((values, i) => `
      <span class="matrix-key${highlight === 'row' && i === row ? ' row-on' : ''}">${rowNames[i]}</span>
      ${values.map((value, j) => {
        const chosen = interactive && i === row && j === column;
        const cls = `matrix-cell${highlight === 'row' && i === row ? ' row-on' : ''}${highlight === 'column' && j === column ? ' column-on' : ''}${chosen ? ' chosen' : ''}`;
        const number = decimals ? value.toFixed(3) : String(value);
        return interactive
          ? `<button type="button" class="${cls}" data-cell="${i}:${j}" aria-pressed="${chosen}" aria-label="${name}：${rowNames[i]}行，${columnNames[j]}列，${number}">${number}</button>`
          : `<span class="${cls}">${number}</span>`;
      }).join('')}
    `).join('');
    return `<div class="matrix-${place}"><p class="matrix-title">${name}<small>${data.length} × ${cols}</small></p><div class="matrix-grid" style="grid-template-columns:20px repeat(${cols},minmax(0,1fr));grid-template-rows:22px repeat(${data.length},44px)">${keys}${cells}</div></div>`;
  }

  function refresh() {
    let left, right = '', result, operator;
    if (phase === 0) {
      left = matrix('Q', Q, words, features, 'left', 'row', false);
      right = matrix('Kᵀ', KT, features, words, 'right', 'column', false);
      result = matrix('S', S, words, words, 'result', '', true, true);
      operator = '<span class="matrix-scale">÷√2</span>=';
      calculation.innerHTML = `<span>S<sub>${words[row]},${words[column]}</sub> =</span><span>(${Q[row][0]} × ${K[column][0]} + ${Q[row][1]} × ${K[column][1]}) / √2</span><span>≈ ${S[row][column].toFixed(3)}</span>`;
    } else if (phase === 1) {
      left = matrix('S', S, words, words, 'left', 'row', true);
      result = matrix('A', A, words, words, 'result', 'row', true, true);
      operator = '→';
      calculation.innerHTML = `<span>A<sub>${words[row]},${words[column]}</sub> =</span><span>e<sup>${S[row][column].toFixed(3)}</sup> /</span><span>(${S[row].map(s => `e<sup>${s.toFixed(3)}</sup>`).join(' + ')})</span><span>≈ ${A[row][column].toFixed(3)}</span>`;
    } else {
      left = matrix('A', A, words, words, 'left', 'row', true);
      right = matrix('V', V, words, features, 'right', 'column', false);
      result = matrix('O', O, words, features, 'result', '', true, true);
      operator = '=';
      calculation.innerHTML = `<span>O<sub>${words[row]},${column + 1}</sub> =</span>${A[row].map((a, j) => `<span>${j ? '+ ' : ''}${a.toFixed(3)} × ${V[j][column]}</span>`).join('')}<span>≈ ${O[row][column].toFixed(3)}</span>`;
    }
    workspace.innerHTML = `<div class="matrix-product">${left}${right ? '<span class="matrix-operator matrix-multiply">×</span>' : ''}${right}<span class="matrix-operator matrix-equals">${operator}</span>${result}</div>`;
    workspace.querySelectorAll('[data-cell]').forEach(button => button.addEventListener('click', () => {
      [row, column] = button.dataset.cell.split(':').map(Number); refresh();
      workspace.querySelector(`[data-cell="${row}:${column}"]`).focus({ preventScroll: true });
    }));
  }
  refresh();
</script>
```

$A$ 仍是 $3\times3$，每个词都有自己的一行权重。“追”的这行表示它怎样在猫、追、狗之间分配注意力；“猫”的那行则是猫自己的分配方式。所以要**逐行**计算，不能把整张矩阵一起归一化。图中小数经过了四舍五入，实际计算中每一行的权重和为 $1$。

到这里，模型只决定了混合比例，还没有把内容取过来，$V$ 也还没有参与这两步。

### 用权重把 V 汇总成新表示

拿 $A$ 的“追”这一行，分别乘上 $V$ 里猫、追、狗的整行向量，再加起来，就得到“追”的新表示。这又可以写成矩阵乘法：

$$
O=AV.
$$

```render html
<style>
  .matrix-lab { --row: #376d9b; --column: #39765d; padding-block: 8px; }
  :root[data-theme="dark"] .matrix-lab { --row: #91bce6; --column: #8cc9ac; }
  .matrix-product { display: grid; grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr); grid-template-areas: "left multiply right equals result"; gap: 12px; align-items: center; }
  .matrix-left { grid-area: left; }
  .matrix-right { grid-area: right; }
  .matrix-result { grid-area: result; }
  .matrix-multiply { grid-area: multiply; }
  .matrix-equals { grid-area: equals; }
  .matrix-operator { text-align: center; color: var(--muted); font-size: 24px; }
  .matrix-scale { display: block; position: relative; left: 50%; width: max-content; transform: translateX(-50%); font-size: 12px; white-space: nowrap; }
  .matrix-title { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; font-size: 17px; font-weight: 600; }
  .matrix-title small { font-size: 12px; color: var(--muted); font-weight: 400; }
  .matrix-grid { position: relative; display: grid; padding-right: 4px; }
  .matrix-grid::before, .matrix-grid::after { position: absolute; top: 22px; bottom: 0; width: 5px; border-block: 1.5px solid var(--muted); content: ''; pointer-events: none; }
  .matrix-grid::before { left: 20px; border-left: 1.5px solid var(--muted); }
  .matrix-grid::after { right: 0; border-right: 1.5px solid var(--muted); }
  .matrix-key, .matrix-cell { display: flex; justify-content: center; align-items: center; min-width: 0; padding: 0; }
  .matrix-key { color: var(--muted); font-size: 13px; }
  .matrix-cell { min-height: 44px; border: 0; border-radius: 0; background: transparent; font: 14px var(--font-mono); font-variant-numeric: tabular-nums; }
  button.matrix-cell { cursor: pointer; }
  .matrix-cell.row-on { color: var(--row); background: color-mix(in srgb, var(--row) 12%, transparent); }
  .matrix-cell.column-on { color: var(--column); background: color-mix(in srgb, var(--column) 12%, transparent); }
  .matrix-key.row-on { color: var(--row); font-weight: 650; }
  .matrix-key.column-on { color: var(--column); font-weight: 650; }
  .matrix-cell.chosen { box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-soft); color: var(--text); border-radius: 3px; }
  button.matrix-cell:hover { background: var(--accent-soft); }
  .matrix-calculation { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 2px 8px; min-height: 3.6em; margin-top: 24px; font-size: 14px; line-height: 1.8; font-variant-numeric: tabular-nums; }
  .matrix-calculation > span { white-space: nowrap; }
  .matrix-calculation sub { font-size: 11px; }
  .matrix-calculation sup { font-size: 11px; }
  .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr); grid-template-areas: "left equals result"; }
  @media (max-width: 600px) {
    .matrix-product { grid-template-columns: minmax(0, 2fr) 16px minmax(0, 3fr); grid-template-areas: "left multiply right" ". equals ." "result result result"; gap: 12px 4px; }
    .matrix-result { width: min(240px, 100%); justify-self: center; }
    .matrix-cell { font-size: 12.5px; }
    .matrix-result .matrix-cell { font-size: 14px; }
    .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 3fr) 16px minmax(0, 2fr); }
    .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: 1fr; grid-template-areas: "left" "equals" "result"; }
    .matrix-lab[data-phase="1"] .matrix-left { width: min(240px, 100%); justify-self: center; }
    .matrix-lab[data-phase="1"] .matrix-equals { transform: rotate(90deg); }
  }
</style>
<section class="matrix-lab" data-phase="2" aria-label="注意力权重乘以V，得到各个词的新表示">
  <div class="matrix-workspace"></div>
  <output class="matrix-calculation" aria-live="polite"></output>
</section>
<script>
  const words = ['猫', '追', '狗'], features = ['1', '2'];
  const Q = [[1, 0], [1, 1], [0, 1]];
  const K = [[1, 0], [0, 1], [1, 1]];
  const V = [[1, 0], [0, 2], [3, 1]];
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const transpose = matrix => matrix[0].map((_, j) => matrix.map(row => row[j]));
  const KT = transpose(K);
  const S = Q.map(q => K.map(k => dot(q, k) / Math.sqrt(2)));
  const A = S.map(row => {
    const exp = row.map(s => Math.exp(s - Math.max(...row)));
    const total = exp.reduce((sum, x) => sum + x, 0);
    return exp.map(x => x / total);
  });
  const O = A.map(row => transpose(V).map(column => dot(row, column)));
  const lab = document.querySelector('.matrix-lab');
  const workspace = document.querySelector('.matrix-workspace');
  const calculation = document.querySelector('output');
  const phase = Number(lab.dataset.phase);
  let row = 1, column = phase === 2 ? 0 : 2;

  function matrix(name, data, rowNames, columnNames, place, highlight, decimals, interactive = false) {
    const cols = data[0].length;
    const keys = `<span></span>${columnNames.map((name, j) => `<span class="matrix-key${highlight === 'column' && j === column ? ' column-on' : ''}">${name}</span>`).join('')}`;
    const cells = data.map((values, i) => `
      <span class="matrix-key${highlight === 'row' && i === row ? ' row-on' : ''}">${rowNames[i]}</span>
      ${values.map((value, j) => {
        const chosen = interactive && i === row && j === column;
        const cls = `matrix-cell${highlight === 'row' && i === row ? ' row-on' : ''}${highlight === 'column' && j === column ? ' column-on' : ''}${chosen ? ' chosen' : ''}`;
        const number = decimals ? value.toFixed(3) : String(value);
        return interactive
          ? `<button type="button" class="${cls}" data-cell="${i}:${j}" aria-pressed="${chosen}" aria-label="${name}：${rowNames[i]}行，${columnNames[j]}列，${number}">${number}</button>`
          : `<span class="${cls}">${number}</span>`;
      }).join('')}
    `).join('');
    return `<div class="matrix-${place}"><p class="matrix-title">${name}<small>${data.length} × ${cols}</small></p><div class="matrix-grid" style="grid-template-columns:20px repeat(${cols},minmax(0,1fr));grid-template-rows:22px repeat(${data.length},44px)">${keys}${cells}</div></div>`;
  }

  function refresh() {
    let left, right = '', result, operator;
    if (phase === 0) {
      left = matrix('Q', Q, words, features, 'left', 'row', false);
      right = matrix('Kᵀ', KT, features, words, 'right', 'column', false);
      result = matrix('S', S, words, words, 'result', '', true, true);
      operator = '<span class="matrix-scale">÷√2</span>=';
      calculation.innerHTML = `<span>S<sub>${words[row]},${words[column]}</sub> =</span><span>(${Q[row][0]} × ${K[column][0]} + ${Q[row][1]} × ${K[column][1]}) / √2</span><span>≈ ${S[row][column].toFixed(3)}</span>`;
    } else if (phase === 1) {
      left = matrix('S', S, words, words, 'left', 'row', true);
      result = matrix('A', A, words, words, 'result', 'row', true, true);
      operator = '→';
      calculation.innerHTML = `<span>A<sub>${words[row]},${words[column]}</sub> =</span><span>e<sup>${S[row][column].toFixed(3)}</sup> /</span><span>(${S[row].map(s => `e<sup>${s.toFixed(3)}</sup>`).join(' + ')})</span><span>≈ ${A[row][column].toFixed(3)}</span>`;
    } else {
      left = matrix('A', A, words, words, 'left', 'row', true);
      right = matrix('V', V, words, features, 'right', 'column', false);
      result = matrix('O', O, words, features, 'result', '', true, true);
      operator = '=';
      calculation.innerHTML = `<span>O<sub>${words[row]},${column + 1}</sub> =</span>${A[row].map((a, j) => `<span>${j ? '+ ' : ''}${a.toFixed(3)} × ${V[j][column]}</span>`).join('')}<span>≈ ${O[row][column].toFixed(3)}</span>`;
    }
    workspace.innerHTML = `<div class="matrix-product">${left}${right ? '<span class="matrix-operator matrix-multiply">×</span>' : ''}${right}<span class="matrix-operator matrix-equals">${operator}</span>${result}</div>`;
    workspace.querySelectorAll('[data-cell]').forEach(button => button.addEventListener('click', () => {
      [row, column] = button.dataset.cell.split(':').map(Number); refresh();
      workspace.querySelector(`[data-cell="${row}:${column}"]`).focus({ preventScroll: true });
    }));
  }
  refresh();
</script>
```

具体到一个数：这行权重与 $V$ 的第一列相乘，算出新向量的第一个数；与第二列相乘，算出第二个数。所以 $3\times3$ 的 $A$ 乘 $3\times2$ 的 $V$，输出 $O$ 是 $3\times2$。每个词仍占一行，但内容已经混入了上下文；所有行可以放进同一次矩阵运算中处理。

**Q 和 K 决定混合比例，真正相加的是 V；A 是权重，O 才是新的表示。** 这些权重不是词表中下一个词的概率。把三步连起来，就是论文里的注意力公式：

$$
\operatorname{Attention}(Q,K,V)
=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V.
$$


## 多头为什么不只是多算几遍

一次注意力只给出一组混合比例。有的信息需要从前面取，有的需要从后面取，全挤进一次加权平均，可能就混在一起了。多头让模型先用几组不同的投影，分别计算注意力、分别汇总，最后把结果拼起来，再经过线性变换。

每个头都读取完整的输入，但使用自己学习到的 $W_i^Q$、$W_i^K$、$W_i^V$。原论文的 base 模型把 512 维输入分别投影到八组 64 维空间，八个头的输出拼接后，仍是 512 维。

所以，“分头”分的是投影后的表示空间，不是把原句切成八段，也不是直接把原向量的前 64 维分给第一个头。各头具体关注什么，由训练决定，并没有预先指定谁找主语、谁找宾语。

## 为什么一定要告诉它词的位置

看两句话：**猫追狗**，和**狗追猫**。用到的词一样，意思却反过来了。我们能读出差别，是因为知道哪个词在“追”的前面，哪个在后面。刚才的注意力计算里，有哪一步用到了前后顺序？

如果不加位置信息，第一层里每个词的 $Q$、$K$、$V$ 都只来自它的词向量。两句话中的“追”得到同一个 $Q$；“猫”和“狗”各自的 $K$、$V$ 也没变，只是换了摆放位置。

假设“追”分给猫、追、狗的权重分别是 $a,b,c$。交换词序之后，这些权重会跟着对应的词一起换位置，于是两次汇总是

$$
\begin{aligned}
o_{\text{追}}^{(1)}&=a v_{\text{猫}}+b v_{\text{追}}+c v_{\text{狗}},\\
o_{\text{追}}^{(2)}&=c v_{\text{狗}}+b v_{\text{追}}+a v_{\text{猫}}.
\end{aligned}
$$

加法换个顺序，结果没有变。**它知道读到了猫和狗，却没有读到“谁在追前面，谁在追后面”。** 权重就算不相等，这个问题也一样存在。

准确地说，整句的输出向量会跟着输入重排，并不是两个输出数组逐项完全相同；但对应到同一个词，它拿到的表示仍然一样。再叠几层自注意力和逐位置变换，也不会凭空产生顺序信息。

位置编码补上的就是这个信号。每个位置对应一条与词向量同维的向量，逐维相加：

$$
\text{输入表示}=\text{词向量}+\text{位置向量}.
$$

现在，同一个“猫”放在第一个位置和第三个位置，得到的输入就不同了。后面的 $Q$、$K$、$V$ 都从这份输入计算，因此匹配和汇总也能受到位置影响。

下面用两摞方块表示一个二维向量，数字是手工示例。蓝色是词向量，橙色是位置向量；输入在同一维上把两部分叠起来。交换猫和狗，观察词向量随词移动，位置向量留在原处。

```render html
<style>
  .position-lab { --word: #4d7b9f; padding-block: 8px; }
  :root[data-theme="dark"] .position-lab { --word: #91bce6; }
  .position-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin-bottom: 16px; }
  .position-controls button { min-height: 44px; padding: 4px 10px; border: 1px solid var(--rule-strong); border-radius: 4px; background: transparent; font-size: 16px; cursor: pointer; }
  .position-controls label { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 16px; }
  .position-controls input { width: 20px; height: 20px; margin: 0; accent-color: var(--accent); }
  .position-blocks { display: block; width: 100%; }
  .position-blocks text { font-family: var(--font-sans); fill: var(--text); }
  .position-blocks .heading { text-anchor: middle; font-size: 14px; font-weight: 600; }
  .position-blocks .word-heading { fill: var(--word); }
  .position-blocks .position-heading { fill: var(--accent-ink); }
  .position-blocks .word { font-size: 20px; font-weight: 600; }
  .position-blocks .index { fill: var(--muted); font-size: 12px; }
  .position-blocks .value { text-anchor: middle; font: 13px var(--font-mono); }
  .position-blocks .dimension { text-anchor: middle; fill: var(--muted); font-size: 12px; }
  .position-blocks .operator { text-anchor: middle; fill: var(--muted); font-size: 22px; }
</style>
<section class="position-lab" aria-label="词向量与位置编码逐维相加">
  <div class="position-controls">
    <button type="button" class="swap">交换猫和狗</button>
    <label><input type="checkbox" checked />加入位置编码</label>
  </div>
  <svg class="position-blocks" role="img" aria-live="polite"></svg>
</section>
<script>
  const embeddings = { '猫': [1, 0], '追': [1, 1], '狗': [0, 2] };
  const positions = [[0, 0], [1, 0], [0, 1]];
  const svg = document.querySelector('svg');
  const checkbox = document.querySelector('input');
  const swap = document.querySelector('.swap');
  let order = ['猫', '追', '狗'];
  const text = (x, y, value, cls = '') => `<text x="${x}" y="${y}" class="${cls}">${value}</text>`;

  function draw() {
    const width = svg.getBoundingClientRect().width;
    const narrow = width < 560, label = narrow ? 34 : 64, gap = narrow ? 26 : 36;
    const vectorWidth = (width - label - 8 - gap * 2) / 3;
    const depth = narrow ? 5 : 7, space = narrow ? 6 : 12, unit = narrow ? 16 : 18;
    const cell = Math.min(narrow ? 25 : 46, (vectorWidth - depth - space) / 2);
    const columns = [0, 1, 2].map(i => label + i * (vectorWidth + gap));
    const inset = (vectorWidth - cell * 2 - space - depth) / 2;

    function cube(x, baseline, value, color, cap = true) {
      if (value === 0) return '';
      const top = baseline - value * unit;
      return `<path d="M${x} ${top} h${cell} V${baseline} h${-cell} Z" fill="${color}"/>
        <path d="M${x + cell} ${top} l${depth} ${-depth / 2} V${baseline - depth / 2} l${-depth} ${depth / 2} Z" fill="color-mix(in srgb, ${color} 72%, var(--bg))"/>
        ${cap ? `<path d="M${x} ${top} l${depth} ${-depth / 2} h${cell} l${-depth} ${depth / 2} Z" fill="color-mix(in srgb, ${color} 50%, var(--bg))"/>` : ''}`;
    }
    function vector(column, baseline, word, position) {
      return [0, 1].map(d => {
        const x = columns[column] + inset + d * (cell + space);
        const total = word[d] + position[d];
        return `<path d="M${x} ${baseline} l${depth} ${-depth / 2} h${cell} l${-depth} ${depth / 2} Z" fill="var(--rule)"/>
          ${cube(x, baseline, word[d], 'var(--word)', position[d] === 0)}
          ${cube(x, baseline - word[d] * unit, position[d], 'var(--accent)')}
          ${text(x + (cell + depth) / 2, baseline - total * unit - depth / 2 - 8, total, 'value')}
          ${text(x + (cell + depth) / 2, baseline + 22, `维${d + 1}`, 'dimension')}`;
      }).join('');
    }
    svg.setAttribute('viewBox', `0 0 ${width} 360`);
    svg.innerHTML = `
      ${text(columns[0] + vectorWidth / 2, 24, '词向量', 'heading word-heading')}
      ${text(columns[1] + vectorWidth / 2, 24, '位置向量', 'heading position-heading')}
      ${text(columns[2] + vectorWidth / 2, 24, '输入', 'heading')}
      ${order.map((word, i) => {
        const baseline = 98 + i * 112;
        const position = checkbox.checked ? positions[i] : [0, 0];
        return `<g class="word-part" data-word="${word}">
            ${text(0, baseline - 12, word, 'word')}
            ${vector(0, baseline, embeddings[word], [0, 0])}
          </g>
          ${text(0, baseline + 22, `位置${i + 1}`, 'index')}
          ${text(columns[0] + vectorWidth + gap / 2, baseline - 12, '+', 'operator')}
          ${vector(1, baseline, [0, 0], position)}
          ${text(columns[1] + vectorWidth + gap / 2, baseline - 12, '=', 'operator')}
          ${vector(2, baseline, embeddings[word], position)}`;
      }).join('')}
    `;
    const inputs = order.map((word, i) => `[${embeddings[word].map((x, d) => x + (checkbox.checked ? positions[i][d] : 0)).join(',')}]`);
    svg.setAttribute('aria-label', `${order.join('')}；${checkbox.checked ? '加入' : '未加入'}位置编码；三个位置的输入为 ${inputs.join('、')}`);
  }
  swap.addEventListener('click', () => {
    const previous = [...order];
    order.reverse(); draw();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.querySelectorAll('.word-part').forEach(part => {
        const distance = (previous.indexOf(part.dataset.word) - order.indexOf(part.dataset.word)) * 112;
        part.animate([{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], { duration: 400, easing: 'ease-in-out' });
      });
    }
  });
  checkbox.addEventListener('change', draw);
  new ResizeObserver(draw).observe(svg);
  draw();
</script>
```

这里是同一维上的相加，向量的维度保持不变；把两条向量首尾拼接则会增加维度。位置编码只负责提供位置信号，“前面的名词可能是施事，后面的名词可能是受事”这样的关系，仍然要靠训练去学。

原论文用不同频率的正弦和余弦生成位置向量。理解这里，先抓住“同一个词在不同位置会有不同的输入”就够了；正弦和余弦是生成这条位置向量的具体办法。

<details>
<summary>原论文的位置编码公式</summary>

$$
\begin{aligned}
\operatorname{PE}(pos,2i)
&=\sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right),\\
\operatorname{PE}(pos,2i+1)
&=\cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right).
\end{aligned}
$$

$pos$ 是从 $0$ 开始的位置，$d_{\text{model}}$ 是词向量的维数，$i$ 表示第几对维度。同一对维度共用频率，一个用正弦，一个用余弦；不同的维度对使用不同频率。

</details>

## 编码器和解码器各读什么

编码器读原句。每层先通过自注意力交换位置之间的信息，再让每个位置经过前馈网络。处理完以后，原句的每个位置都有了一份带上下文的表示，供解码器读取。

解码器负责生成译文。每层先用自注意力读取目标端已有的前缀，再通过**交叉注意力**读取原句，最后经过前馈网络。两种注意力的公式相同，区别在来源：自注意力的 $Q$、$K$、$V$ 来自同一份序列表示；交叉注意力的 $Q$ 来自解码器，$K$ 和 $V$ 来自编码器最终的输出。

前馈网络对每个位置做相同的非线性变换，不负责跨位置取信息。每个子层还会把输入加回来，保留一条直接的输入通路，再沿该位置的特征维做 LayerNorm，让数值尺度更稳定；这就是原论文图里的 Add & Norm。编码器和解码器各叠六层，层间参数分别学习。

最后，解码器输出的向量经过线性投影和 softmax，才变成词表中每个候选词的概率。

## 为什么能并行训练，却要逐词生成

把“猫追狗”翻译成 `Cats chase dogs`。训练时，目标句子已经知道，但不能直接把正在预测的词交给模型。于是先右移一位：

- 解码器输入：`<bos> Cats chase dogs`
- 对应的预测：`Cats chase dogs <eos>`

`<bos>` 表示开始，`<eos>` 表示结束。比如输入 `Cats` 的位置，要预测的是 `chase`。所以解码器自注意力可以看**当前位置**：这里放的是上一个目标词，不是当前要猜的答案。

但只右移还不够。如果能看右边，预测 `chase` 时，就能直接读到后一个位置输入里的 `chase`。所以要给自注意力加**因果掩码**：先把未来位置的分数设为 $-\infty$，再做 softmax，这些位置的权重就变成 $0$，其余位置重新归一化。交叉注意力仍然可以读取整句原文，因为翻译开始时原文就已经完整给出。

```render html title="训练时可点选目标位置。"
<style>
  .decoder-lab { --query: #376d9b; --value: #39765d; --blocked: #a15360; padding-block: 8px; }
  :root[data-theme="dark"] .decoder-lab { --query: #91bce6; --value: #8cc9ac; --blocked: #dea1aa; }
  .decoder-modes { display: flex; gap: 24px; border-bottom: 1px solid var(--rule); }
  .decoder-modes button { min-height: 48px; padding: 4px 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; }
  .decoder-modes button[aria-pressed="true"] { color: var(--query); border-color: var(--query); font-weight: 600; }
  .decoder-scene { position: relative; margin-top: 20px; }
  .decoder-scene svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
  .decoder-label { position: relative; width: fit-content; margin: 0 0 8px; padding-right: 6px; background: var(--bg); font-size: 13px; color: var(--muted); }
  .source-words, .target-words { position: relative; display: grid; gap: 12px; }
  .source-words { grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 2px solid var(--value); }
  .source-words span { min-height: 48px; padding: 4px 0; text-align: center; font-size: 22px; }
  .target-words { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .target-words button { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; min-height: 66px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--query); background: transparent; cursor: pointer; }
  .target-words button:disabled { cursor: default; opacity: 1; }
  .target-words .token { font-size: 17px; }
  .target-words small { font-size: 12px; color: var(--query); }
  .target-words .current { color: var(--query); background: color-mix(in srgb, var(--query) 8%, transparent); font-weight: 650; }
  .target-words .future { border-color: var(--rule-strong); border-bottom-style: dashed; color: var(--muted); }
  .target-words .future small { color: var(--blocked); }
  .target-words .fresh .token { animation: new-word 280ms ease-out 1; }
  .cross-space, .self-space { position: relative; }
  .cross-space { height: 80px; }
  .self-space { height: 64px; }
  .lane-label { position: absolute; left: 50%; transform: translateX(-50%); padding: 0 6px; background: var(--bg); color: var(--muted); font-size: 13px; white-space: nowrap; }
  .cross-space .lane-label { top: 26px; }
  .self-space .lane-label { bottom: 0; }
  .decoder-prediction { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; margin-top: 20px; }
  .decoder-prefix { color: var(--muted); font-size: 15px; overflow-wrap: anywhere; }
  .prediction-line { font-size: 17px; }
  .prediction-line strong { margin-left: 12px; color: var(--value); font-size: 23px; font-weight: 650; }
  .generation-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
  .generation-controls[hidden] { display: none; }
  .generation-controls button { min-height: 44px; padding: 6px 16px; border: 1px solid var(--rule-strong); border-radius: 4px; background: transparent; font-size: 16px; cursor: pointer; }
  .generation-controls .next { border-color: var(--value); color: var(--value); }
  .generation-controls button:disabled { color: var(--muted); border-color: var(--rule); cursor: default; }
  @keyframes new-word { from { opacity: 0.2; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .target-words .fresh .token { animation: none; } }
</style>
<section class="decoder-lab" aria-label="解码器能读取哪些信息">
  <div class="decoder-modes" role="group" aria-label="选择训练或生成">
    <button type="button" data-mode="training" aria-pressed="true">训练时</button>
    <button type="button" data-mode="generation" aria-pressed="false">生成时</button>
  </div>
  <div class="decoder-scene">
    <svg role="img" aria-label="当前目标位置可读取整句原文，以及目标端当前位置和之前的位置"></svg>
    <p class="decoder-label">编码器输出 K、V</p>
    <div class="source-words"><span>猫</span><span>追</span><span>狗</span></div>
    <div class="cross-space"><span class="lane-label">交叉注意力</span></div>
    <p class="decoder-label">目标输入（当前 Q）</p>
    <div class="target-words" role="group" aria-label="选择目标端位置">
      <button type="button" data-target="0"><span class="token"></span><small></small></button>
      <button type="button" data-target="1"><span class="token"></span><small></small></button>
      <button type="button" data-target="2"><span class="token"></span><small></small></button>
      <button type="button" data-target="3"><span class="token"></span><small></small></button>
    </div>
    <div class="self-space"><span class="lane-label">自注意力</span></div>
  </div>
  <output class="decoder-prediction" aria-live="polite">
    <span class="decoder-prefix"></span>
    <span class="prediction-line"><span class="prediction-label"></span><strong></strong></span>
  </output>
  <div class="generation-controls" hidden>
    <button type="button" class="next"></button>
    <button type="button" class="reset">重来</button>
  </div>
</section>
<script>
  const inputs = ['<bos>', 'Cats', 'chase', 'dogs'];
  const predictions = ['Cats', 'chase', 'dogs', '<eos>'];
  const modes = [...document.querySelectorAll('[data-mode]')];
  const targets = [...document.querySelectorAll('[data-target]')];
  const source = document.querySelector('.source-words');
  const selfLabel = document.querySelector('.self-space .lane-label');
  const scene = document.querySelector('.decoder-scene');
  const svg = document.querySelector('svg');
  const prefix = document.querySelector('.decoder-prefix');
  const predictionLabel = document.querySelector('.prediction-label');
  const predictedWord = document.querySelector('.prediction-line strong');
  const controls = document.querySelector('.generation-controls');
  const next = document.querySelector('.next');
  const reset = document.querySelector('.reset');
  let mode = 'training', position = 1, finished = false;

  function draw() {
    const bounds = scene.getBoundingClientRect();
    const point = (element, edge) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - bounds.left, y: rect[edge] - bounds.top };
    };
    const top = point(targets[position], 'top'), bottom = point(targets[position], 'bottom');
    const memory = point(source, 'bottom');
    const first = targets[0].getBoundingClientRect(), current = targets[position].getBoundingClientRect();
    const left = first.left - bounds.left + 6, right = current.right - bounds.left - 6;
    selfLabel.style.left = `${(left + right) / 2}px`;
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    svg.innerHTML = `
      <defs>
        <marker id="source-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 8 4 0 8" fill="var(--value)"/></marker>
      </defs>
      <path d="M${top.x} ${top.y - 4} C${top.x} ${top.y - 48} ${memory.x} ${memory.y + 36} ${memory.x} ${memory.y + 5}" fill="none" stroke="var(--value)" stroke-width="1.8" marker-end="url(#source-arrow)"/>
      <path d="M${left} ${bottom.y + 14} v12 H${right} v-12" fill="none" stroke="var(--query)" stroke-width="1.8"/>
      <circle cx="${top.x}" cy="${top.y - 4}" r="3" fill="var(--query)"/>
    `;
  }

  function refresh(newWord = false) {
    const generating = mode === 'generation';
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    targets.forEach((button, j) => {
      const future = j > position;
      button.disabled = generating;
      button.classList.toggle('current', j === position);
      button.classList.toggle('future', future);
      button.classList.toggle('fresh', newWord && j === position);
      button.setAttribute('aria-pressed', String(j === position));
      button.setAttribute('aria-label', `位置 ${j + 1}：${generating && future ? '未生成' : inputs[j]}`);
      button.querySelector('.token').textContent = generating && future ? '?' : inputs[j];
      button.querySelector('small').textContent = future ? (generating ? '未生成' : '屏蔽') : (j === position ? '当前' : '可读');
    });
    prefix.textContent = finished ? 'Cats chase dogs' : inputs.slice(0, position + 1).join(' ');
    predictionLabel.textContent = '→';
    predictedWord.textContent = predictions[position];
    controls.hidden = !generating;
    next.disabled = finished;
    next.textContent = finished ? '已完成' : `生成 ${predictions[position]}`;
    draw();
  }
  modes.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode; position = mode === 'training' ? 1 : 0; finished = false; refresh();
  }));
  targets.forEach((button, j) => button.addEventListener('click', () => { position = j; refresh(); }));
  next.addEventListener('click', () => {
    if (position < inputs.length - 1) position += 1; else finished = true;
    refresh(true);
  });
  reset.addEventListener('click', () => { position = 0; finished = false; refresh(); });
  new ResizeObserver(draw).observe(scene);
  refresh();
</script>
```

训练时，右移后的输入整句都已经准备好了。各位置虽然只读取自己的前缀，但算这一层所需的向量都在，因此可以一次矩阵运算同时处理。层与层还是依次计算，只是不需要沿着句子等上一个位置先算完。

生成时只有 `<bos>`。模型先预测 `Cats`，再把它接回输入，才能继续预测 `chase`。后面的输入依赖前面实际生成的结果，所以仍要逐词进行。**能同时算多个位置的表示，不等于能同时知道尚未生成的词。**

## 参考资料

- Vaswani et al. [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017。
- [论文 PDF](https://arxiv.org/pdf/1706.03762)，第 3 节介绍注意力、位置编码以及编码器和解码器。
