---
title: "Transformer：理解 Attention Is All You Need"
description: "从注意力怎样汇总信息讲起，用可操作的图理解多头、位置编码，以及解码器为什么不能偷看答案。"
pubDate: 2026-09-06T10:00:00+08:00
updatedDate: 2026-10-21
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

它们的**每一行都对应一个词**，没有把整句话压成一个向量。用“小明累了，他想睡觉”举例，“他”指的是“小明”。

为方便演示，拆成“小明 / 累了 / 他 / 想 / 睡觉”五个位置，每个位置的 $Q$、$K$、$V$ 都留四个数，所以三个矩阵都是 $5\times4$。数值是手工设定的，只看计算过程。

### 先算“谁读谁”的分数

拿“他”的查询向量，和“小明”的键向量做点积，就得到一个匹配分数。想让每个词都看一遍整句，就要把每个 $Q$ 和每个 $K$ 都算一次。

矩阵乘法刚好能完成这件事。把 $K$ 转置成 $K^\top$，原来每个词占一行的键向量，就变成了每个词占一列。这样，$Q$ 的一行乘 $K^\top$ 的一列，恰好就是一个查询和一个键的点积：

$$
S=\frac{QK^\top}{\sqrt{d_k}}.
$$

```render html
<style>
  .matrix-lab { --row: #376d9b; --column: #39765d; --cell-height: 42px; --key-width: 40px; padding: 12px 0 4px; }
  :root[data-theme="dark"] .matrix-lab { --row: #91bce6; --column: #8cc9ac; }
  .matrix-product { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) 28px minmax(0, 5fr); grid-template-rows: 38px 28px calc(var(--positions) * var(--cell-height)); column-gap: 14px; }
  .matrix-panel { display: grid; grid-row: 1 / 4; grid-template-rows: subgrid; min-width: 0; }
  .matrix-left { grid-column: 1; }
  .matrix-right { grid-column: 2; }
  .matrix-result { grid-column: 4; }
  .matrix-title { display: flex; grid-row: 1; justify-content: center; align-items: baseline; gap: 10px; margin: 0; padding-left: var(--key-width); font-size: 22px; line-height: 1; }
  .matrix-title small { color: var(--muted); font-size: 12px; }
  .matrix-table { font-family: KaTeX_Main, var(--font-sans); }
  .matrix-table, .matrix-table tr { display: contents; }
  .matrix-table thead, .matrix-table tbody { display: grid; grid-template-columns: var(--key-width) repeat(var(--columns), minmax(0, 1fr)); padding-right: 6px; }
  .matrix-table thead { grid-row: 2; }
  .matrix-table tbody { position: relative; grid-row: 3; grid-auto-rows: var(--cell-height); align-self: center; }
  .matrix-table tbody::before, .matrix-table tbody::after { position: absolute; inset-block: 0; width: 6px; border-block: 1px solid var(--muted); content: ''; pointer-events: none; }
  .matrix-table tbody::before { left: var(--key-width); border-left: 1px solid var(--muted); }
  .matrix-table tbody::after { right: 0; border-right: 1px solid var(--muted); }
  .matrix-key, .matrix-cell { display: flex; justify-content: center; align-items: center; min-width: 0; padding: 0; border: 0; }
  .matrix-key { color: var(--muted); font-size: 12px; font-weight: 400; }
  tbody .matrix-key { justify-content: flex-start; }
  .matrix-cell { position: relative; color: var(--text); font: 400 15px/1 KaTeX_Main, var(--font-serif); font-variant-numeric: tabular-nums; }
  .matrix-cell button { width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .matrix-cell button:focus-visible { outline-offset: -4px; }
  .matrix-cell.row-on { background: color-mix(in srgb, var(--row) 10%, transparent); }
  .matrix-cell.column-on { background: color-mix(in srgb, var(--column) 10%, transparent); }
  .row-on, .matrix-from-row { color: var(--row); }
  .column-on, .matrix-from-column { color: var(--column); }
  .matrix-key.row-on, .matrix-key.column-on { font-weight: 650; }
  .matrix-cell.chosen { border-radius: 4px; background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent-ink); }
  .matrix-cell:has(button:hover):not(.chosen) { background: color-mix(in srgb, var(--accent) 9%, transparent); }
  .matrix-cell.row-on[data-weight]::after { position: absolute; bottom: 7px; left: 12%; width: calc(var(--weight) * 76%); height: 2px; border-radius: 1px; background: currentColor; opacity: 0.4; content: ''; pointer-events: none; }
  .matrix-flow { display: grid; grid-column: 3; grid-row: 3; place-items: center; color: var(--muted); font-size: 25px; }
  .matrix-arrow-vertical { display: none; }
  .matrix-detail { margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--rule); }
  .matrix-selection { margin: 0 0 12px; color: var(--muted); font-size: 13px; line-height: 1.6; text-align: center; }
  .matrix-calculation { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 7px; min-height: 48px; font-size: 19px; }
  .matrix-calculation math { flex: 0 0 auto; }
  .matrix-answer { color: var(--accent-ink); }
  .matrix-hint { margin: 14px 0 0; color: var(--muted); font-size: 12px; line-height: 1.7; text-align: center; }
  .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr); }
  .matrix-lab[data-phase="1"] .matrix-flow { grid-column: 2; }
  .matrix-lab[data-phase="1"] .matrix-result { grid-column: 3; }
  .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) 28px minmax(0, 4fr); }
  @media (max-width: 680px) {
    .matrix-lab { --cell-height: 44px; }
    .matrix-product, .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 4fr) minmax(0, 5fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); column-gap: 20px; }
    .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); }
    .matrix-title { font-size: 21px; gap: 7px; }
    .matrix-result { grid-column: 1 / -1; grid-row: 5 / 8; width: min(420px, 100%); justify-self: center; }
    .matrix-flow { grid-column: 1 / -1; grid-row: 4; }
    .matrix-arrow-horizontal { display: none; }
    .matrix-arrow-vertical { display: block; }
    .matrix-detail { margin-top: 22px; }
    .matrix-calculation { font-size: 18px; }
    .matrix-calculation .matrix-variable { flex-basis: 100%; }
    .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); }
    .matrix-lab[data-phase="1"] .matrix-left { width: min(420px, 100%); justify-self: center; }
    .matrix-lab[data-phase="1"] .matrix-flow { grid-column: 1; }
    .matrix-lab[data-phase="1"] .matrix-result { grid-column: 1; }
  }
  @media (max-width: 320px) {
    .matrix-lab[data-phase="1"] .matrix-calculation { font-size: 16px; }
  }
  @media (max-width: 420px) {
    .matrix-lab[data-phase="0"] .matrix-product, .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 1fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 22px 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); }
    .matrix-right { grid-column: 1; grid-row: 5 / 8; }
    .matrix-lab[data-phase="0"] .matrix-flow, .matrix-lab[data-phase="2"] .matrix-flow { grid-row: 8; }
    .matrix-lab[data-phase="0"] .matrix-result, .matrix-lab[data-phase="2"] .matrix-result { grid-row: 9 / 12; }
  }
</style>
<section class="matrix-lab" data-phase="0" aria-label="Q 与 K 的转置相乘，再缩放为匹配分数">
  <div class="matrix-workspace"></div>
  <div class="matrix-detail">
    <p class="matrix-selection"></p>
    <output class="matrix-calculation" aria-live="polite"></output>
  </div>
  <p class="matrix-hint">点选 S 中的数，查看对应的行、列和计算。</p>
</section>
<script>
const words = ['小明', '累了', '他', '想', '睡觉'];
const features = ['1', '2', '3', '4'];
const Q = [[1, 0, 1, 0], [0, 1, 1, 0], [2, 0, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]];
const K = [[2, 0, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1], [0, 0, 1, 1], [1, 0, 1, 1]];
const V = [[3, 1, 0, 1], [0, 2, 1, 0], [1, 1, 1, 0], [0, 1, 0, 2], [2, 0, 1, 3]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const transpose = (matrix) =>
  matrix[0].map((_, j) => matrix.map((row) => row[j]));
const KT = transpose(K);
const S = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(features.length)));
const A = S.map((row) => {
  const exp = row.map((value) => Math.exp(value - Math.max(...row)));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
});
const O = A.map((row) => transpose(V).map((column) => dot(row, column)));

const lab = document.querySelector('.matrix-lab');
const workspace = lab.querySelector('.matrix-workspace');
const calculation = lab.querySelector('.matrix-calculation');
const selection = lab.querySelector('.matrix-selection');
const phase = Number(lab.dataset.phase);
lab.style.setProperty('--positions', words.length);
let row = 2;
let column = 0;

const math = (content, className = '') =>
  `<math class="${className}" displaystyle="true">${content}</math>`;
const number = (value, className) => `<mn class="${className}">${value}</mn>`;
const fromRow = (value) => number(value, 'matrix-from-row');
const fromColumn = (value) => number(value, 'matrix-from-column');
const scale = `<msqrt><mn>${features.length}</mn></msqrt>`;
const exponential = (value) =>
  `<msup><mi>e</mi>${fromRow(value.toFixed(3))}</msup>`;
const variable = (name, index) =>
  math(
    `<msub><mi>${name}</mi><mtext>${words[row]},${index}</mtext></msub><mo>=</mo>`,
    'matrix-variable',
  );
const answer = (value) =>
  math(`<mo>≈</mo><mn>${value.toFixed(3)}</mn>`, 'matrix-answer');

function matrix(
  name,
  data,
  rowNames,
  columnNames,
  place,
  highlight,
  decimals,
  interactive = false,
) {
  const cols = data[0].length;
  const symbol =
    name === 'K' ? '<msup><mi>K</mi><mo>⊤</mo></msup>' : `<mi>${name}</mi>`;
  const headings = columnNames
    .map(
      (label, j) =>
        `<th scope="col" class="matrix-key${highlight === 'column' && j === column ? ' column-on' : ''}">${label}</th>`,
    )
    .join('');
  const rows = data
    .map(
      (values, i) => `<tr>
    <th scope="row" class="matrix-key${highlight === 'row' && i === row ? ' row-on' : ''}">${rowNames[i]}</th>
    ${values
      .map((value, j) => {
        const chosen = interactive && i === row && j === column;
        const classes = ['matrix-cell'];
        if (highlight === 'row' && i === row) classes.push('row-on');
        if (highlight === 'column' && j === column) classes.push('column-on');
        if (chosen) classes.push('chosen');
        const text = decimals ? value.toFixed(decimals) : String(value);
        const weight =
          phase === 1 && interactive
            ? ` data-weight style="--weight:${value}"`
            : '';
        const content = interactive
          ? `<button type="button" data-cell="${i}:${j}" aria-pressed="${chosen}" aria-label="${name}：${rowNames[i]}行，${columnNames[j]}列，${text}">${text}</button>`
          : text;
        return `<td class="${classes.join(' ')}"${weight}>${content}</td>`;
      })
      .join('')}
  </tr>`,
    )
    .join('');
  return `<div class="matrix-panel matrix-${place}" style="--columns:${cols}">
    <p class="matrix-title">${math(symbol)}<small>${math(`<mn>${data.length}</mn><mo>×</mo><mn>${cols}</mn>`)}</small></p>
    <table class="matrix-table" aria-label="${name === 'K' ? 'K 的转置' : name}，${data.length}行${cols}列">
      <thead><tr><td></td>${headings}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}


function refresh() {
  let left,
    right = '',
    result;
  if (phase === 0) {
    left = matrix('Q', Q, words, features, 'left', 'row', false);
    right = matrix('K', KT, features, words, 'right', 'column', false);
    result = matrix('S', S, words, words, 'result', '', 1, true);
    const numerator = Q[row]
      .map(
        (value, i) =>
          `${i ? '<mo>+</mo>' : ''}${fromRow(value)}<mo>×</mo>${fromColumn(K[column][i])}`,
      )
      .join('');
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>读取<span class="matrix-from-column">“${words[column]}”</span>`;
    calculation.innerHTML =
      variable('S', words[column]) +
      math(`<mfrac><mrow>${numerator}</mrow>${scale}</mfrac>`) +
      answer(S[row][column]);
  } else if (phase === 1) {
    left = matrix('S', S, words, words, 'left', 'row', 1);
    result = matrix('A', A, words, words, 'result', 'row', 2, true);
    const denominator = S[row]
      .map((value, i) => `${i ? '<mo>+</mo>' : ''}${exponential(value)}`)
      .join('');
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>分给“${words[column]}”的权重`;
    calculation.innerHTML =
      variable('A', words[column]) +
      math(
        `<mfrac>${exponential(S[row][column])}<mrow>${denominator}</mrow></mfrac>`,
      ) +
      answer(A[row][column]);
  } else {
    left = matrix('A', A, words, words, 'left', 'row', 2);
    right = matrix('V', V, words, features, 'right', 'column', false);
    result = matrix('O', O, words, features, 'result', '', 2, true);
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>的新表示，第<span class="matrix-from-column"> ${column + 1} </span>个分量`;
    calculation.innerHTML =
      variable('O', column + 1) +
      A[row]
        .map((value, i) =>
          math(
            `${i ? '<mo>+</mo>' : ''}${fromRow(value.toFixed(3))}<mo>×</mo>${fromColumn(V[i][column])}`,
          ),
        )
        .join('') +
      answer(O[row][column]);
  }
  workspace.innerHTML = `<div class="matrix-product">
    ${left}
    ${right}
    <div class="matrix-flow" aria-hidden="true">
      ${math('<mo stretchy="false">→</mo>', 'matrix-arrow-horizontal')}
      ${math('<mo stretchy="false">↓</mo>', 'matrix-arrow-vertical')}
    </div>
    ${result}
  </div>`;
}

workspace.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cell]');
  if (!button) return;
  [row, column] = button.dataset.cell.split(':').map(Number);
  refresh();
  workspace
    .querySelector(`[data-cell="${row}:${column}"]`)
    .focus({ preventScroll: true });
});

refresh();
</script>
```

$5\times4$ 乘 $4\times5$，得到了 $5\times5$ 的 $S$。它的行表示“谁在查询”，列表示“正在看谁”：比如“他”行、“小明”列，就是“他”读取“小明”的分数。查询和键用了不同的投影，所以这张表也不要求对称。

$d_k$ 是每个查询和键的维数，例子里就是 $4$。维数增大时，点积的波动通常也会变大；除以 $\sqrt{d_k}$ 是为了控制分数尺度，避免下一步的 softmax 过早接近“一个位置占满全部权重”，让训练更容易进行。

### 每一行各自分配权重

分数还不能直接拿来混合信息。softmax 先把分数 $s$ 换成 $e^s$，再除以这一行所有 $e^s$ 的和，变成非负、加起来为 $1$ 的一组权重：

$$
A=\operatorname{softmax}_{\text{逐行}}(S).
$$

```render html
<style>
  .matrix-lab { --row: #376d9b; --column: #39765d; --cell-height: 42px; --key-width: 40px; padding: 12px 0 4px; }
  :root[data-theme="dark"] .matrix-lab { --row: #91bce6; --column: #8cc9ac; }
  .matrix-product { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) 28px minmax(0, 5fr); grid-template-rows: 38px 28px calc(var(--positions) * var(--cell-height)); column-gap: 14px; }
  .matrix-panel { display: grid; grid-row: 1 / 4; grid-template-rows: subgrid; min-width: 0; }
  .matrix-left { grid-column: 1; }
  .matrix-right { grid-column: 2; }
  .matrix-result { grid-column: 4; }
  .matrix-title { display: flex; grid-row: 1; justify-content: center; align-items: baseline; gap: 10px; margin: 0; padding-left: var(--key-width); font-size: 22px; line-height: 1; }
  .matrix-title small { color: var(--muted); font-size: 12px; }
  .matrix-table { font-family: KaTeX_Main, var(--font-sans); }
  .matrix-table, .matrix-table tr { display: contents; }
  .matrix-table thead, .matrix-table tbody { display: grid; grid-template-columns: var(--key-width) repeat(var(--columns), minmax(0, 1fr)); padding-right: 6px; }
  .matrix-table thead { grid-row: 2; }
  .matrix-table tbody { position: relative; grid-row: 3; grid-auto-rows: var(--cell-height); align-self: center; }
  .matrix-table tbody::before, .matrix-table tbody::after { position: absolute; inset-block: 0; width: 6px; border-block: 1px solid var(--muted); content: ''; pointer-events: none; }
  .matrix-table tbody::before { left: var(--key-width); border-left: 1px solid var(--muted); }
  .matrix-table tbody::after { right: 0; border-right: 1px solid var(--muted); }
  .matrix-key, .matrix-cell { display: flex; justify-content: center; align-items: center; min-width: 0; padding: 0; border: 0; }
  .matrix-key { color: var(--muted); font-size: 12px; font-weight: 400; }
  tbody .matrix-key { justify-content: flex-start; }
  .matrix-cell { position: relative; color: var(--text); font: 400 15px/1 KaTeX_Main, var(--font-serif); font-variant-numeric: tabular-nums; }
  .matrix-cell button { width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .matrix-cell button:focus-visible { outline-offset: -4px; }
  .matrix-cell.row-on { background: color-mix(in srgb, var(--row) 10%, transparent); }
  .matrix-cell.column-on { background: color-mix(in srgb, var(--column) 10%, transparent); }
  .row-on, .matrix-from-row { color: var(--row); }
  .column-on, .matrix-from-column { color: var(--column); }
  .matrix-key.row-on, .matrix-key.column-on { font-weight: 650; }
  .matrix-cell.chosen { border-radius: 4px; background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent-ink); }
  .matrix-cell:has(button:hover):not(.chosen) { background: color-mix(in srgb, var(--accent) 9%, transparent); }
  .matrix-cell.row-on[data-weight]::after { position: absolute; bottom: 7px; left: 12%; width: calc(var(--weight) * 76%); height: 2px; border-radius: 1px; background: currentColor; opacity: 0.4; content: ''; pointer-events: none; }
  .matrix-flow { display: grid; grid-column: 3; grid-row: 3; place-items: center; color: var(--muted); font-size: 25px; }
  .matrix-arrow-vertical { display: none; }
  .matrix-detail { margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--rule); }
  .matrix-selection { margin: 0 0 12px; color: var(--muted); font-size: 13px; line-height: 1.6; text-align: center; }
  .matrix-calculation { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 7px; min-height: 48px; font-size: 19px; }
  .matrix-calculation math { flex: 0 0 auto; }
  .matrix-answer { color: var(--accent-ink); }
  .matrix-hint { margin: 14px 0 0; color: var(--muted); font-size: 12px; line-height: 1.7; text-align: center; }
  .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr); }
  .matrix-lab[data-phase="1"] .matrix-flow { grid-column: 2; }
  .matrix-lab[data-phase="1"] .matrix-result { grid-column: 3; }
  .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) 28px minmax(0, 4fr); }
  @media (max-width: 680px) {
    .matrix-lab { --cell-height: 44px; }
    .matrix-product, .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 4fr) minmax(0, 5fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); column-gap: 20px; }
    .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); }
    .matrix-title { font-size: 21px; gap: 7px; }
    .matrix-result { grid-column: 1 / -1; grid-row: 5 / 8; width: min(420px, 100%); justify-self: center; }
    .matrix-flow { grid-column: 1 / -1; grid-row: 4; }
    .matrix-arrow-horizontal { display: none; }
    .matrix-arrow-vertical { display: block; }
    .matrix-detail { margin-top: 22px; }
    .matrix-calculation { font-size: 18px; }
    .matrix-calculation .matrix-variable { flex-basis: 100%; }
    .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); }
    .matrix-lab[data-phase="1"] .matrix-left { width: min(420px, 100%); justify-self: center; }
    .matrix-lab[data-phase="1"] .matrix-flow { grid-column: 1; }
    .matrix-lab[data-phase="1"] .matrix-result { grid-column: 1; }
  }
  @media (max-width: 320px) {
    .matrix-lab[data-phase="1"] .matrix-calculation { font-size: 16px; }
  }
  @media (max-width: 420px) {
    .matrix-lab[data-phase="0"] .matrix-product, .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 1fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 22px 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); }
    .matrix-right { grid-column: 1; grid-row: 5 / 8; }
    .matrix-lab[data-phase="0"] .matrix-flow, .matrix-lab[data-phase="2"] .matrix-flow { grid-row: 8; }
    .matrix-lab[data-phase="0"] .matrix-result, .matrix-lab[data-phase="2"] .matrix-result { grid-row: 9 / 12; }
  }
</style>
<section class="matrix-lab" data-phase="1" aria-label="每一行单独做 softmax，得到注意力权重">
  <div class="matrix-workspace"></div>
  <div class="matrix-detail">
    <p class="matrix-selection"></p>
    <output class="matrix-calculation" aria-live="polite"></output>
  </div>
  <p class="matrix-hint">点选 A 中的权重，查看这一行怎样归一化。</p>
</section>
<script>
const words = ['小明', '累了', '他', '想', '睡觉'];
const features = ['1', '2', '3', '4'];
const Q = [[1, 0, 1, 0], [0, 1, 1, 0], [2, 0, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]];
const K = [[2, 0, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1], [0, 0, 1, 1], [1, 0, 1, 1]];
const V = [[3, 1, 0, 1], [0, 2, 1, 0], [1, 1, 1, 0], [0, 1, 0, 2], [2, 0, 1, 3]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const transpose = (matrix) =>
  matrix[0].map((_, j) => matrix.map((row) => row[j]));
const KT = transpose(K);
const S = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(features.length)));
const A = S.map((row) => {
  const exp = row.map((value) => Math.exp(value - Math.max(...row)));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
});
const O = A.map((row) => transpose(V).map((column) => dot(row, column)));

const lab = document.querySelector('.matrix-lab');
const workspace = lab.querySelector('.matrix-workspace');
const calculation = lab.querySelector('.matrix-calculation');
const selection = lab.querySelector('.matrix-selection');
const phase = Number(lab.dataset.phase);
lab.style.setProperty('--positions', words.length);
let row = 2;
let column = 0;

const math = (content, className = '') =>
  `<math class="${className}" displaystyle="true">${content}</math>`;
const number = (value, className) => `<mn class="${className}">${value}</mn>`;
const fromRow = (value) => number(value, 'matrix-from-row');
const fromColumn = (value) => number(value, 'matrix-from-column');
const scale = `<msqrt><mn>${features.length}</mn></msqrt>`;
const exponential = (value) =>
  `<msup><mi>e</mi>${fromRow(value.toFixed(3))}</msup>`;
const variable = (name, index) =>
  math(
    `<msub><mi>${name}</mi><mtext>${words[row]},${index}</mtext></msub><mo>=</mo>`,
    'matrix-variable',
  );
const answer = (value) =>
  math(`<mo>≈</mo><mn>${value.toFixed(3)}</mn>`, 'matrix-answer');

function matrix(
  name,
  data,
  rowNames,
  columnNames,
  place,
  highlight,
  decimals,
  interactive = false,
) {
  const cols = data[0].length;
  const symbol =
    name === 'K' ? '<msup><mi>K</mi><mo>⊤</mo></msup>' : `<mi>${name}</mi>`;
  const headings = columnNames
    .map(
      (label, j) =>
        `<th scope="col" class="matrix-key${highlight === 'column' && j === column ? ' column-on' : ''}">${label}</th>`,
    )
    .join('');
  const rows = data
    .map(
      (values, i) => `<tr>
    <th scope="row" class="matrix-key${highlight === 'row' && i === row ? ' row-on' : ''}">${rowNames[i]}</th>
    ${values
      .map((value, j) => {
        const chosen = interactive && i === row && j === column;
        const classes = ['matrix-cell'];
        if (highlight === 'row' && i === row) classes.push('row-on');
        if (highlight === 'column' && j === column) classes.push('column-on');
        if (chosen) classes.push('chosen');
        const text = decimals ? value.toFixed(decimals) : String(value);
        const weight =
          phase === 1 && interactive
            ? ` data-weight style="--weight:${value}"`
            : '';
        const content = interactive
          ? `<button type="button" data-cell="${i}:${j}" aria-pressed="${chosen}" aria-label="${name}：${rowNames[i]}行，${columnNames[j]}列，${text}">${text}</button>`
          : text;
        return `<td class="${classes.join(' ')}"${weight}>${content}</td>`;
      })
      .join('')}
  </tr>`,
    )
    .join('');
  return `<div class="matrix-panel matrix-${place}" style="--columns:${cols}">
    <p class="matrix-title">${math(symbol)}<small>${math(`<mn>${data.length}</mn><mo>×</mo><mn>${cols}</mn>`)}</small></p>
    <table class="matrix-table" aria-label="${name === 'K' ? 'K 的转置' : name}，${data.length}行${cols}列">
      <thead><tr><td></td>${headings}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}


function refresh() {
  let left,
    right = '',
    result;
  if (phase === 0) {
    left = matrix('Q', Q, words, features, 'left', 'row', false);
    right = matrix('K', KT, features, words, 'right', 'column', false);
    result = matrix('S', S, words, words, 'result', '', 1, true);
    const numerator = Q[row]
      .map(
        (value, i) =>
          `${i ? '<mo>+</mo>' : ''}${fromRow(value)}<mo>×</mo>${fromColumn(K[column][i])}`,
      )
      .join('');
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>读取<span class="matrix-from-column">“${words[column]}”</span>`;
    calculation.innerHTML =
      variable('S', words[column]) +
      math(`<mfrac><mrow>${numerator}</mrow>${scale}</mfrac>`) +
      answer(S[row][column]);
  } else if (phase === 1) {
    left = matrix('S', S, words, words, 'left', 'row', 1);
    result = matrix('A', A, words, words, 'result', 'row', 2, true);
    const denominator = S[row]
      .map((value, i) => `${i ? '<mo>+</mo>' : ''}${exponential(value)}`)
      .join('');
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>分给“${words[column]}”的权重`;
    calculation.innerHTML =
      variable('A', words[column]) +
      math(
        `<mfrac>${exponential(S[row][column])}<mrow>${denominator}</mrow></mfrac>`,
      ) +
      answer(A[row][column]);
  } else {
    left = matrix('A', A, words, words, 'left', 'row', 2);
    right = matrix('V', V, words, features, 'right', 'column', false);
    result = matrix('O', O, words, features, 'result', '', 2, true);
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>的新表示，第<span class="matrix-from-column"> ${column + 1} </span>个分量`;
    calculation.innerHTML =
      variable('O', column + 1) +
      A[row]
        .map((value, i) =>
          math(
            `${i ? '<mo>+</mo>' : ''}${fromRow(value.toFixed(3))}<mo>×</mo>${fromColumn(V[i][column])}`,
          ),
        )
        .join('') +
      answer(O[row][column]);
  }
  workspace.innerHTML = `<div class="matrix-product">
    ${left}
    ${right}
    <div class="matrix-flow" aria-hidden="true">
      ${math('<mo stretchy="false">→</mo>', 'matrix-arrow-horizontal')}
      ${math('<mo stretchy="false">↓</mo>', 'matrix-arrow-vertical')}
    </div>
    ${result}
  </div>`;
}

workspace.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cell]');
  if (!button) return;
  [row, column] = button.dataset.cell.split(':').map(Number);
  refresh();
  workspace
    .querySelector(`[data-cell="${row}:${column}"]`)
    .focus({ preventScroll: true });
});

refresh();
</script>
```

$A$ 仍是 $5\times5$，每个位置都有自己的一行权重。“他”的这行表示它怎样在五个位置之间分配注意力；“小明”的那行则是小明自己的分配方式。所以要**逐行**计算，不能把整张矩阵一起归一化。图中小数经过了四舍五入，实际计算中每一行的权重和为 $1$。

到这里，模型只决定了混合比例，还没有把内容取过来，$V$ 也还没有参与这两步。

### 用权重把 V 汇总成新表示

拿 $A$ 的“他”这一行，分别乘上 $V$ 里五个位置的整行向量，再加起来，就得到“他”的新表示。这又可以写成矩阵乘法：

$$
O=AV.
$$

```render html
<style>
  .matrix-lab { --row: #376d9b; --column: #39765d; --cell-height: 42px; --key-width: 40px; padding: 12px 0 4px; }
  :root[data-theme="dark"] .matrix-lab { --row: #91bce6; --column: #8cc9ac; }
  .matrix-product { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) 28px minmax(0, 5fr); grid-template-rows: 38px 28px calc(var(--positions) * var(--cell-height)); column-gap: 14px; }
  .matrix-panel { display: grid; grid-row: 1 / 4; grid-template-rows: subgrid; min-width: 0; }
  .matrix-left { grid-column: 1; }
  .matrix-right { grid-column: 2; }
  .matrix-result { grid-column: 4; }
  .matrix-title { display: flex; grid-row: 1; justify-content: center; align-items: baseline; gap: 10px; margin: 0; padding-left: var(--key-width); font-size: 22px; line-height: 1; }
  .matrix-title small { color: var(--muted); font-size: 12px; }
  .matrix-table { font-family: KaTeX_Main, var(--font-sans); }
  .matrix-table, .matrix-table tr { display: contents; }
  .matrix-table thead, .matrix-table tbody { display: grid; grid-template-columns: var(--key-width) repeat(var(--columns), minmax(0, 1fr)); padding-right: 6px; }
  .matrix-table thead { grid-row: 2; }
  .matrix-table tbody { position: relative; grid-row: 3; grid-auto-rows: var(--cell-height); align-self: center; }
  .matrix-table tbody::before, .matrix-table tbody::after { position: absolute; inset-block: 0; width: 6px; border-block: 1px solid var(--muted); content: ''; pointer-events: none; }
  .matrix-table tbody::before { left: var(--key-width); border-left: 1px solid var(--muted); }
  .matrix-table tbody::after { right: 0; border-right: 1px solid var(--muted); }
  .matrix-key, .matrix-cell { display: flex; justify-content: center; align-items: center; min-width: 0; padding: 0; border: 0; }
  .matrix-key { color: var(--muted); font-size: 12px; font-weight: 400; }
  tbody .matrix-key { justify-content: flex-start; }
  .matrix-cell { position: relative; color: var(--text); font: 400 15px/1 KaTeX_Main, var(--font-serif); font-variant-numeric: tabular-nums; }
  .matrix-cell button { width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .matrix-cell button:focus-visible { outline-offset: -4px; }
  .matrix-cell.row-on { background: color-mix(in srgb, var(--row) 10%, transparent); }
  .matrix-cell.column-on { background: color-mix(in srgb, var(--column) 10%, transparent); }
  .row-on, .matrix-from-row { color: var(--row); }
  .column-on, .matrix-from-column { color: var(--column); }
  .matrix-key.row-on, .matrix-key.column-on { font-weight: 650; }
  .matrix-cell.chosen { border-radius: 4px; background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent-ink); }
  .matrix-cell:has(button:hover):not(.chosen) { background: color-mix(in srgb, var(--accent) 9%, transparent); }
  .matrix-cell.row-on[data-weight]::after { position: absolute; bottom: 7px; left: 12%; width: calc(var(--weight) * 76%); height: 2px; border-radius: 1px; background: currentColor; opacity: 0.4; content: ''; pointer-events: none; }
  .matrix-flow { display: grid; grid-column: 3; grid-row: 3; place-items: center; color: var(--muted); font-size: 25px; }
  .matrix-arrow-vertical { display: none; }
  .matrix-detail { margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--rule); }
  .matrix-selection { margin: 0 0 12px; color: var(--muted); font-size: 13px; line-height: 1.6; text-align: center; }
  .matrix-calculation { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 7px; min-height: 48px; font-size: 19px; }
  .matrix-calculation math { flex: 0 0 auto; }
  .matrix-answer { color: var(--accent-ink); }
  .matrix-hint { margin: 14px 0 0; color: var(--muted); font-size: 12px; line-height: 1.7; text-align: center; }
  .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr); }
  .matrix-lab[data-phase="1"] .matrix-flow { grid-column: 2; }
  .matrix-lab[data-phase="1"] .matrix-result { grid-column: 3; }
  .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) 28px minmax(0, 4fr); }
  @media (max-width: 680px) {
    .matrix-lab { --cell-height: 44px; }
    .matrix-product, .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 4fr) minmax(0, 5fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); column-gap: 20px; }
    .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); }
    .matrix-title { font-size: 21px; gap: 7px; }
    .matrix-result { grid-column: 1 / -1; grid-row: 5 / 8; width: min(420px, 100%); justify-self: center; }
    .matrix-flow { grid-column: 1 / -1; grid-row: 4; }
    .matrix-arrow-horizontal { display: none; }
    .matrix-arrow-vertical { display: block; }
    .matrix-detail { margin-top: 22px; }
    .matrix-calculation { font-size: 18px; }
    .matrix-calculation .matrix-variable { flex-basis: 100%; }
    .matrix-lab[data-phase="1"] .matrix-product { grid-template-columns: minmax(0, 1fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); }
    .matrix-lab[data-phase="1"] .matrix-left { width: min(420px, 100%); justify-self: center; }
    .matrix-lab[data-phase="1"] .matrix-flow { grid-column: 1; }
    .matrix-lab[data-phase="1"] .matrix-result { grid-column: 1; }
  }
  @media (max-width: 320px) {
    .matrix-lab[data-phase="1"] .matrix-calculation { font-size: 16px; }
  }
  @media (max-width: 420px) {
    .matrix-lab[data-phase="0"] .matrix-product, .matrix-lab[data-phase="2"] .matrix-product { grid-template-columns: minmax(0, 1fr); grid-template-rows: 34px 26px calc(var(--positions) * var(--cell-height)) 22px 34px 26px calc(var(--positions) * var(--cell-height)) 46px 34px 26px calc(var(--positions) * var(--cell-height)); }
    .matrix-right { grid-column: 1; grid-row: 5 / 8; }
    .matrix-lab[data-phase="0"] .matrix-flow, .matrix-lab[data-phase="2"] .matrix-flow { grid-row: 8; }
    .matrix-lab[data-phase="0"] .matrix-result, .matrix-lab[data-phase="2"] .matrix-result { grid-row: 9 / 12; }
  }
</style>
<section class="matrix-lab" data-phase="2" aria-label="注意力权重乘以 V，得到各个词的新表示">
  <div class="matrix-workspace"></div>
  <div class="matrix-detail">
    <p class="matrix-selection"></p>
    <output class="matrix-calculation" aria-live="polite"></output>
  </div>
  <p class="matrix-hint">点选 O 中的数，查看对应的行、列和加权求和。</p>
</section>
<script>
const words = ['小明', '累了', '他', '想', '睡觉'];
const features = ['1', '2', '3', '4'];
const Q = [[1, 0, 1, 0], [0, 1, 1, 0], [2, 0, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]];
const K = [[2, 0, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1], [0, 0, 1, 1], [1, 0, 1, 1]];
const V = [[3, 1, 0, 1], [0, 2, 1, 0], [1, 1, 1, 0], [0, 1, 0, 2], [2, 0, 1, 3]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const transpose = (matrix) =>
  matrix[0].map((_, j) => matrix.map((row) => row[j]));
const KT = transpose(K);
const S = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(features.length)));
const A = S.map((row) => {
  const exp = row.map((value) => Math.exp(value - Math.max(...row)));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
});
const O = A.map((row) => transpose(V).map((column) => dot(row, column)));

const lab = document.querySelector('.matrix-lab');
const workspace = lab.querySelector('.matrix-workspace');
const calculation = lab.querySelector('.matrix-calculation');
const selection = lab.querySelector('.matrix-selection');
const phase = Number(lab.dataset.phase);
lab.style.setProperty('--positions', words.length);
let row = 2;
let column = 0;

const math = (content, className = '') =>
  `<math class="${className}" displaystyle="true">${content}</math>`;
const number = (value, className) => `<mn class="${className}">${value}</mn>`;
const fromRow = (value) => number(value, 'matrix-from-row');
const fromColumn = (value) => number(value, 'matrix-from-column');
const scale = `<msqrt><mn>${features.length}</mn></msqrt>`;
const exponential = (value) =>
  `<msup><mi>e</mi>${fromRow(value.toFixed(3))}</msup>`;
const variable = (name, index) =>
  math(
    `<msub><mi>${name}</mi><mtext>${words[row]},${index}</mtext></msub><mo>=</mo>`,
    'matrix-variable',
  );
const answer = (value) =>
  math(`<mo>≈</mo><mn>${value.toFixed(3)}</mn>`, 'matrix-answer');

function matrix(
  name,
  data,
  rowNames,
  columnNames,
  place,
  highlight,
  decimals,
  interactive = false,
) {
  const cols = data[0].length;
  const symbol =
    name === 'K' ? '<msup><mi>K</mi><mo>⊤</mo></msup>' : `<mi>${name}</mi>`;
  const headings = columnNames
    .map(
      (label, j) =>
        `<th scope="col" class="matrix-key${highlight === 'column' && j === column ? ' column-on' : ''}">${label}</th>`,
    )
    .join('');
  const rows = data
    .map(
      (values, i) => `<tr>
    <th scope="row" class="matrix-key${highlight === 'row' && i === row ? ' row-on' : ''}">${rowNames[i]}</th>
    ${values
      .map((value, j) => {
        const chosen = interactive && i === row && j === column;
        const classes = ['matrix-cell'];
        if (highlight === 'row' && i === row) classes.push('row-on');
        if (highlight === 'column' && j === column) classes.push('column-on');
        if (chosen) classes.push('chosen');
        const text = decimals ? value.toFixed(decimals) : String(value);
        const weight =
          phase === 1 && interactive
            ? ` data-weight style="--weight:${value}"`
            : '';
        const content = interactive
          ? `<button type="button" data-cell="${i}:${j}" aria-pressed="${chosen}" aria-label="${name}：${rowNames[i]}行，${columnNames[j]}列，${text}">${text}</button>`
          : text;
        return `<td class="${classes.join(' ')}"${weight}>${content}</td>`;
      })
      .join('')}
  </tr>`,
    )
    .join('');
  return `<div class="matrix-panel matrix-${place}" style="--columns:${cols}">
    <p class="matrix-title">${math(symbol)}<small>${math(`<mn>${data.length}</mn><mo>×</mo><mn>${cols}</mn>`)}</small></p>
    <table class="matrix-table" aria-label="${name === 'K' ? 'K 的转置' : name}，${data.length}行${cols}列">
      <thead><tr><td></td>${headings}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}


function refresh() {
  let left,
    right = '',
    result;
  if (phase === 0) {
    left = matrix('Q', Q, words, features, 'left', 'row', false);
    right = matrix('K', KT, features, words, 'right', 'column', false);
    result = matrix('S', S, words, words, 'result', '', 1, true);
    const numerator = Q[row]
      .map(
        (value, i) =>
          `${i ? '<mo>+</mo>' : ''}${fromRow(value)}<mo>×</mo>${fromColumn(K[column][i])}`,
      )
      .join('');
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>读取<span class="matrix-from-column">“${words[column]}”</span>`;
    calculation.innerHTML =
      variable('S', words[column]) +
      math(`<mfrac><mrow>${numerator}</mrow>${scale}</mfrac>`) +
      answer(S[row][column]);
  } else if (phase === 1) {
    left = matrix('S', S, words, words, 'left', 'row', 1);
    result = matrix('A', A, words, words, 'result', 'row', 2, true);
    const denominator = S[row]
      .map((value, i) => `${i ? '<mo>+</mo>' : ''}${exponential(value)}`)
      .join('');
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>分给“${words[column]}”的权重`;
    calculation.innerHTML =
      variable('A', words[column]) +
      math(
        `<mfrac>${exponential(S[row][column])}<mrow>${denominator}</mrow></mfrac>`,
      ) +
      answer(A[row][column]);
  } else {
    left = matrix('A', A, words, words, 'left', 'row', 2);
    right = matrix('V', V, words, features, 'right', 'column', false);
    result = matrix('O', O, words, features, 'result', '', 2, true);
    selection.innerHTML = `<span class="matrix-from-row">“${words[row]}”</span>的新表示，第<span class="matrix-from-column"> ${column + 1} </span>个分量`;
    calculation.innerHTML =
      variable('O', column + 1) +
      A[row]
        .map((value, i) =>
          math(
            `${i ? '<mo>+</mo>' : ''}${fromRow(value.toFixed(3))}<mo>×</mo>${fromColumn(V[i][column])}`,
          ),
        )
        .join('') +
      answer(O[row][column]);
  }
  workspace.innerHTML = `<div class="matrix-product">
    ${left}
    ${right}
    <div class="matrix-flow" aria-hidden="true">
      ${math('<mo stretchy="false">→</mo>', 'matrix-arrow-horizontal')}
      ${math('<mo stretchy="false">↓</mo>', 'matrix-arrow-vertical')}
    </div>
    ${result}
  </div>`;
}

workspace.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cell]');
  if (!button) return;
  [row, column] = button.dataset.cell.split(':').map(Number);
  refresh();
  workspace
    .querySelector(`[data-cell="${row}:${column}"]`)
    .focus({ preventScroll: true });
});

refresh();
</script>
```

具体到一个数：这行权重与 $V$ 的第一列相乘，算出新向量的第一个数；与第二列相乘，算出第二个数。所以 $5\times5$ 的 $A$ 乘 $5\times4$ 的 $V$，输出 $O$ 是 $5\times4$。每个词仍占一行，但内容已经混入了上下文；所有行可以放进同一次矩阵运算中处理。

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

还是“小明累了，他想睡觉”。读到“他”时，我们知道“小明”出现在它前面。可刚才的注意力计算里，有哪一步用到了前后顺序？

如果不加位置信息，第一层里每个词的 $Q$、$K$、$V$ 都只来自它的词向量。把“小明”和“他”换个位置，变成“他累了，小明想睡觉”，每个词的这三条向量都没变，只是换了摆放位置。

假设“他”分给“小明”和自己的权重分别是 $a,b$，其余三个位置的加权和记作 $r$。交换词序后，权重会跟着对应的词一起换位置，于是“他”的两次汇总是

$$
\begin{aligned}
o_{\text{他}}^{(1)}&=a v_{\text{小明}}+b v_{\text{他}}+r,\\
o_{\text{他}}^{(2)}&=b v_{\text{他}}+a v_{\text{小明}}+r.
\end{aligned}
$$

加法换个顺序，结果没有变。**它读到了“小明”，却不知道“小明”在“他”前面还是后面。** 权重就算不相等，这个问题也一样存在。

准确地说，整句的输出向量会跟着输入重排，并不是两个输出数组逐项完全相同；但对应到同一个词，它拿到的表示仍然一样。再叠几层自注意力和逐位置变换，也不会凭空产生顺序信息。

位置编码补上的就是这个信号。每个位置对应一条与词向量同维的向量，逐维相加：

$$
\text{输入表示}=\text{词向量}+\text{位置向量}.
$$

现在，同一个“小明”放在第一个位置和第三个位置，得到的输入就不同了。后面的 $Q$、$K$、$V$ 都从这份输入计算，因此匹配和汇总也能受到位置影响。

下面仍用“小明 / 累了 / 他 / 想 / 睡觉”这五个位置，从 $0$ 开始编号。词向量是四维示意数值，位置向量则按原论文的正弦、余弦公式计算。点选一个词，再交换“小明”和“他”，看同一个词怎样取到新位置的编码。

```render html
<style>
  .position-lab { --word: #376d9b; padding-block: 8px; }
  :root[data-theme="dark"] .position-lab { --word: #91bce6; }
  .position-controls { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
  .position-controls button { min-height: 44px; padding: 6px 12px; border: 1px solid var(--rule-strong); border-radius: 4px; background: transparent; font-size: 15px; cursor: pointer; }
  .position-controls button:hover { border-color: var(--accent); }
  .position-controls small { color: var(--muted); font-size: 12px; }
  .position-sentence { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .position-station { min-width: 0; text-align: center; }
  .position-index { display: block; color: var(--muted); font: 13px/1.5 KaTeX_Main, var(--font-serif); }
  .position-station button { width: 100%; min-height: 48px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: transparent; color: var(--text); font-size: 19px; cursor: pointer; }
  .position-station button:hover { background: color-mix(in srgb, var(--word) 5%, transparent); }
  .position-station button[aria-pressed="true"] { border-color: var(--word); background: color-mix(in srgb, var(--word) 8%, transparent); color: var(--word); font-weight: 650; }
  .position-station button:focus-visible { outline-offset: -3px; }
  .position-word { display: inline-block; }
  .position-wave-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px; margin-top: 24px; color: var(--accent-ink); font-size: 13px; }
  .position-legend { display: flex; gap: 16px; color: var(--muted); font-size: 12px; }
  .position-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .position-legend span::before { width: 18px; border-top: 2px solid var(--accent); content: ''; }
  .position-legend .cos::before { border-top-style: dashed; }
  .position-waveforms { display: block; width: 100%; }
  .position-waveforms text { fill: var(--muted); font-family: var(--font-sans); font-size: 12px; }
  .position-waveforms .tick { font-family: KaTeX_Main, var(--font-serif); font-size: 11px; }
  .position-waveforms .guide { fill: none; stroke: var(--rule); stroke-width: 0.8; }
  .position-waveforms .wave { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
  .position-waveforms .cos-wave { stroke-dasharray: 5 5; }
  .position-vectors { width: 100%; margin-top: 12px; border-collapse: collapse; table-layout: fixed; }
  .position-vectors th, .position-vectors td { padding: 10px 4px; text-align: center; }
  .position-vectors thead th { color: var(--muted); font-size: 12px; font-weight: 400; }
  .position-vectors thead td { width: 128px; }
  .position-vectors tbody th { position: relative; padding-left: 24px; text-align: left; font-size: 13px; font-weight: 400; }
  .position-vectors tbody th small { display: block; color: var(--muted); font-size: 12px; }
  .position-vectors td { font: 16px/1.5 KaTeX_Main, var(--font-serif); font-variant-numeric: tabular-nums; }
  .position-sign { position: absolute; left: 0; top: 50%; transform: translateY(-50%); color: var(--muted); font: 20px/1 KaTeX_Main, var(--font-serif); }
  .position-word-vector { color: var(--word); }
  .position-encoding { color: var(--accent-ink); }
  .position-input { border-top: 1px solid var(--rule-strong); color: var(--text); }
  .position-input td { font-size: 18px; }
  @media (max-width: 460px) {
    .position-controls { margin-bottom: 16px; }
    .position-station button { font-size: 17px; }
    .position-wave-head { margin-top: 20px; }
    .position-legend { gap: 12px; }
    .position-vectors, .position-vectors thead, .position-vectors tbody { display: block; }
    .position-vectors tr { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .position-vectors thead td { display: none; }
    .position-vectors tbody th { grid-column: 1 / -1; padding-block: 8px 0; }
    .position-vectors tbody th small { display: inline; margin-left: 8px; }
    .position-vectors td { padding: 6px 0 12px; }
    .position-vectors th { padding-inline: 0; }
    .position-input td { font-size: 16px; }
  }
</style>
<section class="position-lab" aria-label="从正弦与余弦曲线取出位置向量">
  <div class="position-controls">
    <button type="button" class="position-swap">交换小明和他</button>
    <small>点词查看 · 位置从 0 开始</small>
  </div>
  <div class="position-sentence" role="group" aria-label="选择要观察的词"></div>
  <div class="position-wave-head">
    <span>位置向量 PE</span>
    <div class="position-legend"><span class="sin">sin</span><span class="cos">cos</span></div>
  </div>
  <svg class="position-waveforms" role="img"></svg>
  <table class="position-vectors" aria-label="词向量与位置向量逐维相加">
    <thead><tr><td></td><th scope="col">第 1 维</th><th scope="col">第 2 维</th><th scope="col">第 3 维</th><th scope="col">第 4 维</th></tr></thead>
    <tbody>
      <tr class="position-word-vector"><th scope="row">词向量<small></small></th></tr>
      <tr class="position-encoding"><th scope="row"><span class="position-sign" aria-hidden="true">+</span>位置向量<small></small></th></tr>
      <tr class="position-input"><th scope="row"><span class="position-sign" aria-hidden="true">=</span>输入表示</th></tr>
    </tbody>
  </table>
</section>
<script>
  const embeddings = {
    '小明': [0.6, -0.4, 0.8, -0.2],
    '累了': [-0.3, 0.7, 0.2, 0.5],
    '他': [0.2, -0.5, 0.6, 0.1],
    '想': [0.4, 0.1, -0.2, 0.7],
    '睡觉': [-0.1, 0.6, 0.3, 0.4],
  };
  const encoding = pos => [Math.sin(pos), Math.cos(pos), Math.sin(pos / 100), Math.cos(pos / 100)];
  const sentence = document.querySelector('.position-sentence');
  const svg = document.querySelector('.position-waveforms');
  const wordRow = document.querySelector('.position-word-vector');
  const encodingRow = document.querySelector('.position-encoding');
  const inputRow = document.querySelector('.position-input');
  const format = (value, digits = 4) => value.toFixed(digits).replace('-', '−');
  let order = ['小明', '累了', '他', '想', '睡觉'];
  let focused = '他';

  const stations = order.map((_, i) => {
    const station = document.createElement('div');
    station.className = 'position-station';
    station.innerHTML = `<span class="position-index">${i}</span><button type="button"><span class="position-word"></span></button>`;
    const button = station.querySelector('button');
    button.addEventListener('click', () => { focused = order[i]; refresh(); });
    sentence.append(station);
    return button;
  });
  const vectorCells = [wordRow, encodingRow, inputRow].map(row =>
    [0, 1, 2, 3].map(() => row.appendChild(document.createElement('td'))),
  );

  function draw() {
    const width = svg.getBoundingClientRect().width;
    const cell = width / order.length;
    const x = pos => (pos + 0.5) * cell;
    const current = order.indexOf(focused);
    const sampleX = x(current);
    const text = (px, py, value, cls = '') => `<text x="${px}" y="${py}" class="${cls}">${value}</text>`;
    svg.setAttribute('viewBox', `0 0 ${width} 224`);
    svg.innerHTML = [1, 100].map((divisor, row) => {
      const offset = row * 112;
      const center = offset + 69;
      const y = value => center - value * 24;
      const curve = fn => Array.from({length: 121}, (_, i) => {
        const pos = i / 120 * (order.length - 1);
        return `${i ? 'L' : 'M'}${x(pos).toFixed(2)} ${y(fn(pos / divisor)).toFixed(2)}`;
      }).join(' ');
      const sinY = y(Math.sin(current / divisor));
      const cosY = y(Math.cos(current / divisor));
      return `
        ${text(0, offset + 18, row === 0 ? '第 1、2 维 · 变化快' : '第 3、4 维 · 变化慢')}
        <rect x="${current * cell + 2}" y="${offset + 30}" width="${cell - 4}" height="76" rx="3" fill="var(--accent)" opacity="0.06"/>
        ${[-1, 0, 1].map(value => `<path class="guide" d="M${x(0)} ${y(value)} H${x(order.length - 1)}"/>${text(2, y(value) + 4, value > 0 ? '+1' : value < 0 ? '−1' : '0', 'tick')}`).join('')}
        ${order.map((_, i) => `<path class="guide" d="M${x(i)} ${offset + 37} V${offset + 101}"/>`).join('')}
        <path class="wave" d="${curve(Math.sin)}"/>
        <path class="wave cos-wave" d="${curve(Math.cos)}"/>
        <path d="M${sampleX} ${offset + 30} V${offset + 106}" stroke="var(--accent)" stroke-width="1.3" stroke-dasharray="2 3"/>
        <circle cx="${sampleX}" cy="${sinY}" r="4" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.5"/>
        <rect x="${sampleX - 3.5}" y="${cosY - 3.5}" width="7" height="7" fill="var(--bg)" stroke="var(--accent)" stroke-width="1.7"/>`;
    }).join('');
    svg.setAttribute('aria-label', `${focused}，位置 ${current}；实线为正弦，虚线为余弦；四维位置向量为 ${encoding(current).map(value => format(value)).join('、')}`);
  }

  function refresh() {
    const current = order.indexOf(focused);
    stations.forEach((button, i) => {
      button.querySelector('.position-word').textContent = order[i];
      button.dataset.word = order[i];
      button.setAttribute('aria-label', `${order[i]}，位置 ${i}`);
      button.setAttribute('aria-pressed', String(order[i] === focused));
    });
    wordRow.querySelector('small').textContent = focused;
    encodingRow.querySelector('small').textContent = `位置 ${current}`;
    const word = embeddings[focused];
    const pe = encoding(current);
    const input = word.map((value, i) => value + pe[i]);
    [word, pe, input].forEach((vector, row) => vector.forEach((value, i) => {
      vectorCells[row][i].textContent = format(value, row === 0 ? 1 : 4);
    }));
    draw();
  }

  document.querySelector('.position-swap').addEventListener('click', () => {
    const previous = new Map(stations.map(button => [button.dataset.word, button.querySelector('.position-word').getBoundingClientRect().left]));
    [order[0], order[2]] = [order[2], order[0]];
    refresh();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stations.forEach(button => {
        const word = button.querySelector('.position-word');
        const distance = previous.get(button.dataset.word) - word.getBoundingClientRect().left;
        if (distance) word.animate([
          {transform: `translateX(${distance}px)`},
          {transform: 'translateX(0)'},
        ], {duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)'});
      });
    }
  });
  new ResizeObserver(draw).observe(svg);
  refresh();
</script>
```

图中前两维变化快，后两维变化慢，它们共同组成四维位置向量。加到词向量时，对应维度各自相加，向量维度不变；首尾拼接则会增加维度。

位置编码只负责提供位置信号，模型怎样利用前后文判断“他”指向谁，仍然要靠训练去学。

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

把“小明累了，他想睡觉”翻译成 `Xiaoming is tired; he wants to sleep.`。训练时，目标句子已经知道，但不能直接把正在预测的词交给模型。于是先右移一位：

- 解码器输入：`<bos> Xiaoming is tired; he wants to sleep.`
- 对应的预测：`Xiaoming is tired; he wants to sleep. <eos>`

`<bos>` 表示开始，`<eos>` 表示结束。比如输入 `he` 的位置，要预测的是 `wants`。所以解码器自注意力可以看**当前位置**：这里放的是上一个目标词，不是当前要猜的答案。

但只右移还不够。如果能看右边，预测 `wants` 时，就能直接读到后一个位置输入里的 `wants`。所以要给自注意力加**因果掩码**：先把未来位置的分数设为 $-\infty$，再做 softmax，这些位置的权重就变成 $0$，其余位置重新归一化。交叉注意力仍然可以读取整句原文，因为翻译开始时原文就已经完整给出。

```render html
<style>
  .decoder-lab { --read: #376d9b; --predict: #39765d; padding-block: 8px; }
  :root[data-theme="dark"] .decoder-lab { --read: #91bce6; --predict: #8cc9ac; }
  .decoder-toolbar, .decoder-modes { display: flex; align-items: center; gap: 24px; }
  .decoder-toolbar { justify-content: space-between; border-bottom: 1px solid var(--rule); }
  .decoder-modes button { min-height: 48px; padding: 4px 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; }
  .decoder-modes button[aria-pressed="true"] { color: var(--read); border-color: var(--read); font-weight: 650; }
  .decoder-status { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .decoder-source { margin-block: 20px 26px; }
  .decoder-label { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0 0 8px; color: var(--muted); font-size: 13px; line-height: 1.6; }
  .decoder-label small { font-size: 12px; }
  .decoder-source p:last-child { margin: 0; padding-bottom: 12px; border-bottom: 2px solid var(--predict); color: var(--text); font-size: 21px; line-height: 1.6; }
  .decoder-source .decoder-label small { color: var(--predict); }
  .decoder-tape { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 3fr); align-items: stretch; gap: 18px; }
  .decoder-tape[data-complete="true"] { grid-template-columns: minmax(0, 1fr); }
  .decoder-readable, .decoder-future { display: flex; flex-direction: column; min-width: 0; }
  .decoder-future[hidden] { display: none; }
  .decoder-readable .decoder-label { color: var(--read); }
  .decoder-future .decoder-label { justify-content: flex-start; gap: 6px; }
  .decoder-lock { width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; }
  .decoder-zone { display: flex; flex: 1; flex-wrap: wrap; align-content: center; align-items: center; gap: 6px 10px; min-height: 76px; padding: 12px 14px; font-size: 18px; line-height: 1.7; }
  .decoder-prefix { border-bottom: 2px solid var(--read); background: color-mix(in srgb, var(--read) 6%, transparent); }
  .decoder-token { display: inline-block; position: relative; white-space: nowrap; }
  .decoder-token.special { color: var(--muted); font-size: 14px; }
  .decoder-token.current { margin-right: 6px; color: var(--read); font-weight: 650; }
  .decoder-token.current::after { position: absolute; top: 0.2em; right: -7px; width: 2px; height: 1.3em; background: var(--read); content: ''; }
  .decoder-masked { border: 1px dashed var(--rule-strong); background: repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--muted) 7%, transparent) 7px 8px); color: var(--muted); }
  .decoder-masked .decoder-token { text-decoration: line-through; text-decoration-color: var(--rule-strong); }
  .decoder-future[data-state="unknown"] .decoder-token { padding-inline: 4px; text-decoration: none; }
  .decoder-prediction { display: grid; justify-items: center; gap: 4px; padding-block: 14px 24px; }
  .decoder-prediction::before { color: var(--read); font-size: 25px; line-height: 1.2; content: '↓'; }
  .decoder-result-label { color: var(--muted); font-size: 13px; }
  .decoder-prediction strong { color: var(--predict); font-size: 34px; font-weight: 650; line-height: 1.4; }
  .decoder-prediction[data-waiting="true"] strong { color: var(--muted); }
  .decoder-parallel { padding-top: 14px; border-top: 1px solid var(--rule); }
  .decoder-choices { display: flex; flex-wrap: wrap; gap: 8px; }
  .decoder-choices button, .decoder-actions button { min-height: 44px; padding: 5px 12px; border: 1px solid var(--rule-strong); border-radius: 4px; background: transparent; font-size: 16px; cursor: pointer; }
  .decoder-choices button[aria-pressed="true"] { border-color: var(--predict); background: color-mix(in srgb, var(--predict) 10%, transparent); color: var(--predict); font-weight: 650; }
  .decoder-choices button:hover { border-color: var(--predict); }
  .decoder-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
  .decoder-actions .next { border-color: var(--predict); background: color-mix(in srgb, var(--predict) 8%, transparent); color: var(--predict); }
  .decoder-actions button:disabled { border-color: var(--rule); background: transparent; color: var(--muted); cursor: default; }
  .decoder-parallel[hidden], .decoder-actions[hidden] { display: none; }
  @media (max-width: 460px) {
    .decoder-toolbar, .decoder-modes { gap: 18px; }
    .decoder-tape { grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .decoder-zone { min-height: 62px; }
    .decoder-source { margin-bottom: 20px; }
    .decoder-source p:last-child { font-size: 20px; }
    .decoder-prediction { padding-bottom: 20px; }
  }
</style>
<section class="decoder-lab" aria-label="因果掩码与逐词生成">
  <div class="decoder-toolbar">
    <div class="decoder-modes" role="group" aria-label="选择训练或生成">
      <button type="button" data-mode="training" aria-pressed="true">并行训练</button>
      <button type="button" data-mode="generation" aria-pressed="false">逐词生成</button>
    </div>
    <span class="decoder-status"></span>
  </div>
  <div class="decoder-source">
    <p class="decoder-label"><span>原文</span><small>交叉注意力 · 全句可读</small></p>
    <p>小明累了，他想睡觉。</p>
  </div>
  <div class="decoder-tape">
    <div class="decoder-readable">
      <p class="decoder-label">可读的译文前缀</p>
      <div class="decoder-zone decoder-prefix" aria-label="本步可读前缀"></div>
    </div>
    <div class="decoder-future">
      <p class="decoder-label">
        <svg class="decoder-lock" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2"/><path d="M6.5 8V5a3.5 3.5 0 0 1 7 0v3"/></svg>
        <span class="decoder-future-label"></span>
      </p>
      <div class="decoder-zone decoder-masked" aria-label="本步不可读的未来输入"></div>
    </div>
  </div>
  <output class="decoder-prediction" aria-live="polite" aria-atomic="true">
    <span class="decoder-result-label"></span>
    <strong></strong>
  </output>
  <div class="decoder-parallel">
    <p class="decoder-label"><span>同时预测 · 8 个位置</span><small>点选查看</small></p>
    <div class="decoder-choices" role="group" aria-label="选择预测位置"></div>
  </div>
  <div class="decoder-actions" hidden>
    <button type="button" class="next">生成下一个词</button>
    <button type="button" class="reset">重新开始</button>
  </div>
</section>
<script>
  const translation = ['Xiaoming', 'is', 'tired;', 'he', 'wants', 'to', 'sleep.'];
  const inputs = ['<bos>', ...translation];
  const predictions = [...translation, '<eos>'];
  const modes = [...document.querySelectorAll('[data-mode]')];
  const status = document.querySelector('.decoder-status');
  const tape = document.querySelector('.decoder-tape');
  const prefix = document.querySelector('.decoder-prefix');
  const future = document.querySelector('.decoder-future');
  const futureLabel = document.querySelector('.decoder-future-label');
  const masked = document.querySelector('.decoder-masked');
  const result = document.querySelector('.decoder-prediction');
  const resultLabel = document.querySelector('.decoder-result-label');
  const predictedWord = result.querySelector('strong');
  const parallel = document.querySelector('.decoder-parallel');
  const choices = document.querySelector('.decoder-choices');
  const actions = document.querySelector('.decoder-actions');
  const next = document.querySelector('.next');
  const reset = document.querySelector('.reset');
  let mode = 'training', position = 4, generated = -1;

  function token(word, current = false) {
    const span = document.createElement('span');
    span.className = `decoder-token${word.startsWith('<') ? ' special' : ''}${current ? ' current' : ''}`;
    span.textContent = word;
    return span;
  }

  const positions = predictions.map((word, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = word;
    button.dataset.position = i;
    button.setAttribute('aria-label', `位置 ${i + 1}，预测 ${word}`);
    button.addEventListener('click', () => { position = i; refresh(); });
    choices.append(button);
    return button;
  });

  function refresh() {
    const generating = mode === 'generation';
    const waiting = generating && generated === -1;
    const current = generating ? (waiting ? 0 : generated) : position;
    const finished = generating && generated === predictions.length - 1;
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    status.textContent = generating ? (finished ? '生成结束' : waiting ? '尚未开始' : `第 ${generated + 1} 步`) : `位置 ${position + 1} / ${inputs.length}`;
    prefix.replaceChildren(...inputs.slice(0, current + 1).map((word, i) => token(word, i === current)));
    future.hidden = generating ? finished : current === inputs.length - 1;
    future.dataset.state = generating ? 'unknown' : 'masked';
    futureLabel.textContent = generating ? '未来输入 · 尚未生成' : '未来输入 · 因果掩码';
    masked.replaceChildren(...(generating ? ['?', '?', '?'] : inputs.slice(current + 1)).map(word => token(word)));
    tape.dataset.complete = future.hidden;
    result.dataset.waiting = waiting;
    resultLabel.textContent = waiting ? '下一个词' : predictions[current] === '<eos>' ? '结束标记' : '本步预测';
    predictedWord.textContent = waiting ? '?' : predictions[current];
    positions.forEach((button, i) => button.setAttribute('aria-pressed', String(i === position)));
    parallel.hidden = generating;
    actions.hidden = !generating;
    next.disabled = finished;
    next.textContent = finished ? '生成结束' : '生成下一个词';
  }

  modes.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    generated = -1;
    refresh();
  }));
  next.addEventListener('click', () => {
    const previous = predictedWord.getBoundingClientRect();
    generated += 1;
    refresh();
    if (generated > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const current = prefix.lastElementChild;
      const bounds = current.getBoundingClientRect();
      current.animate([
        { transform: `translate(${previous.left - bounds.left}px, ${previous.top - bounds.top}px)`, opacity: 0.35 },
        { transform: 'translate(0, 0)', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  });
  reset.addEventListener('click', () => { generated = -1; refresh(); });
  refresh();
</script>
```

训练时，右移后的输入整句都已经准备好了。各位置虽然只读取自己的前缀，但算这一层所需的向量都在，因此可以一次矩阵运算同时处理。层与层还是依次计算，只是不需要沿着句子等上一个位置先算完。

生成时只有 `<bos>`。模型先预测 `Xiaoming`，再把它接回输入，才能继续预测 `is`。后面的输入依赖前面实际生成的结果，所以仍要逐词生成。**能同时算多个位置的表示，不等于能同时知道尚未生成的词。**

## 参考资料

- Vaswani et al. [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017。
- [论文 PDF](https://arxiv.org/pdf/1706.03762)，第 3 节介绍注意力、位置编码以及编码器和解码器。
