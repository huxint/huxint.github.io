---
title: "C++ 的变量都住在哪"
description: "局部变量、`new` 出来的对象和全局变量，分别放在内存哪里，又是什么时候没的。"
pubDate: 2026-09-09T10:00:00+08:00
updatedDate: 2026-10-23
tags: ["C++", "操作系统", "计算机基础"]
---

```cpp
std::vector<int> values(1'000'000, 7);
std::printf("%zu\n", sizeof(values));
```

输出 `24`。

一百万个 `int` 是 400 万字节，`sizeof` 只算了 24。这 24 字节是三个指针：元素从哪开始、用到哪、分配的空间到哪为止。那 400 万字节在别处。

所以“`values` 在栈上还是堆上”，问的其实是两样东西：`values` 这个对象在栈上，它管着的元素在另一块动态分配的内存里。两句话同时成立。

C++ 标准里其实没有“栈”和“堆”，它讲的是**存储期**，也就是一个对象从什么时候活到什么时候：

| 存储期 | 谁 | 活多久 | Linux 上通常在 |
| --- | --- | --- | --- |
| 自动 | 局部变量、函数参数 | 到所在作用域结束 | 栈 |
| 静态 | 全局变量、`static` 局部变量 | 整个程序 | `.data`、`.bss` |
| 动态 | `new` 出来的对象 | 直到 `delete` | 堆，大块单独映射 |
| 线程 | `thread_local` 变量 | 所在线程 | 每个线程一份 |

最右边一列是实现，不是规定。编译器可以把局部变量放进寄存器，甚至整个优化掉。下面说的都是真要占内存的情况，环境是 Linux x86-64、glibc 2.44，编译器是 GCC 16 和 Clang 23。

## 一次运行，各自住在哪

写个小程序，把各种东西的地址打出来，再读一遍 `/proc/self/maps`，看这些地址各落在哪块映射里：

```cpp
int counter = 7;  // 有初值的全局变量
int zeroed;       // 没写初值的全局变量

void work() {
    int count = 3;
    static int calls = 0;
    ++calls;
    std::vector<int> values(1'000'000, 7);
    int* one = new int(42);
    const char* text = "hello";
    // 打印 &count、values.data()、one、text、&work 等地址，
    // 再把 /proc/self/maps 整个打出来
    delete one;
}
```

按地址从高到低排：

```render html title="一次真实运行的地址；每次运行高位都会变"
<style>
  .amap { --dyn: #356f9b; position: relative; font-size: 13px; line-height: 1.45; font-variant-ligatures: none; }
  :root[data-theme="dark"] .amap { --dyn: #95bfdc; }
  .edge { margin: 0 0 6px; color: var(--faint); font-size: 11px; }
  .edge:last-of-type { margin: 6px 0 0; }
  .band { display: grid; grid-template-columns: 8.4em minmax(0, 1fr); gap: 4px 14px; align-items: start; margin-right: 46px; padding: 9px 12px; border-left: 3px solid var(--tone); background: color-mix(in srgb, var(--tone) 7%, transparent); }
  .band + .band { margin-top: 3px; }
  .band.auto { --tone: var(--muted); }
  .band.dyn { --tone: var(--dyn); }
  .band.static { --tone: var(--accent); }
  .band.lib { --tone: var(--rule-strong); }
  .who b { display: block; color: var(--text); font: 600 13px var(--font-mono); }
  .who span { color: var(--muted); font: 11px var(--font-mono); }
  .items { display: flex; flex-direction: column; gap: 3px; }
  .item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 10px; width: fit-content; }
  .item b { color: var(--text); font: 600 13px var(--font-mono); }
  .item code { color: var(--faint); font: 11.5px var(--font-mono); }
  .item code i { color: var(--text); font-style: normal; }
  .item small { color: var(--muted); font-size: 11.5px; }
  .note { color: var(--muted); font-size: 12px; }
  .gap { display: flex; align-items: center; gap: 10px; height: 34px; padding-left: 13px; color: var(--muted); font-size: 12px; }
  .gap::before { content: ''; align-self: stretch; border-left: 2px dotted var(--rule-strong); }
  .gap b { color: var(--text); font: 500 13px var(--font-mono); }
  .links { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
  .link { fill: none; stroke-width: 1.6; }
  .link.dyn { stroke: var(--dyn); }
  .link.static { stroke: var(--accent); }
  .tip.dyn { fill: var(--dyn); }
  .tip.static { fill: var(--accent); }
  .dot { fill: var(--text); }
  @media (max-width: 480px) {
    .band { grid-template-columns: 1fr; margin-right: 40px; padding: 8px 10px; }
    .who { display: flex; gap: 10px; align-items: baseline; }
    .who b { display: inline; }
  }
</style>
<section class="amap" aria-label="一次运行中各个变量的地址和所在映射"></section>
<script>
const KIB = 1024, MIB = KIB * KIB;
// 一次运行 /proc/self/maps 和打印出来的地址
const map = [
  { kind: 'auto', name: '[stack]', perm: 'rw-', size: 0x7fff946a4000 - 0x7fff94683000, items: [
    ['values', 0x7fff946a1090, '24 字节'], ['text', 0x7fff946a1078], ['one', 0x7fff946a1070], ['count', 0x7fff946a106c, '= 3'],
  ] },
  { gap: 0x7fff94683000 - 0x7ff70859e000 },
  { kind: 'lib', name: '共享库', perm: 'r-x…', size: 0x7ff70859e000 - 0x7ff707e00000, note: 'libc、libstdc++、ld-linux 等' },
  { kind: 'dyn', name: '匿名映射', perm: 'rw-', size: 0x7ff707e00000 - 0x7ff707a2f000, items: [['values 的元素', 0x7ff707a2f010, '400 万字节']] },
  { gap: 0x7ff707a2f000 - 0x55768ce18000 },
  { kind: 'dyn', name: '[heap]', perm: 'rw-', size: 0x55768ce18000 - 0x55768cde5000, items: [['*one', 0x55768cdf7020, '= 42']] },
  { gap: 0x55768cde5000 - 0x5576506a2000 },
  { kind: 'static', name: '.data .bss', perm: 'rw-', size: 4 * KIB, items: [['calls', 0x5576506a1088, '.bss'], ['zeroed', 0x5576506a1084, '.bss'], ['counter', 0x5576506a1068, '.data']] },
  { kind: 'static', name: '.rodata', perm: 'r--', size: 4 * KIB, items: [['"hello"', 0x55765069f008]] },
  { kind: 'static', name: '.text', perm: 'r-x', size: 4 * KIB, items: [['work', 0x55765069e1d9, '函数的机器码']] },
];
const links = [['values', 'values 的元素', 'dyn'], ['one', '*one', 'dyn'], ['text', '"hello"', 'static']];

const root = document.querySelector('.amap');
const size = n => n >= 2 ** 40 ? `${(n / 2 ** 40).toFixed(1)} TiB` : n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(1)} GiB` : n >= MIB ? `${(n / MIB).toFixed(1)} MiB` : `${Math.round(n / KIB)} KiB`;
const address = n => {
  const hex = n.toString(16);
  return `<code>0x${hex.slice(0, -4)}<i>${hex.slice(-4)}</i></code>`;
};

root.innerHTML = '<p class="edge">高地址</p>' + map.map(region => {
  if (region.gap) return `<div class="gap"><span><b>${size(region.gap)}</b> 没有映射</span></div>`;
  const items = region.items
    ? `<div class="items">${region.items.map(([name, at, note]) => `<div class="item" data-name="${name.replaceAll('"', '&quot;')}"><b>${name}</b>${address(at)}${note ? `<small>${note}</small>` : ''}</div>`).join('')}</div>`
    : `<div class="note">${region.note}</div>`;
  return `<div class="band ${region.kind}"><div class="who"><b>${region.name}</b><span>${region.perm} · ${size(region.size)}</span></div>${items}</div>`;
}).join('') + '<p class="edge">低地址</p><svg class="links" aria-hidden="true"></svg>';

const svg = root.querySelector('.links');
function draw() {
  const box = root.getBoundingClientRect(), W = box.width;
  svg.setAttribute('width', W);
  svg.setAttribute('height', box.height);
  svg.innerHTML = links.map(([from, to, kind], lane) => {
    // 横线从整条的右端出发，竖直位置对准名字那一行
    const end = name => root.querySelector(`[data-name="${CSS.escape(name)}"]`);
    const a = end(from).getBoundingClientRect(), an = end(from).querySelector('b').getBoundingClientRect();
    const b = end(to).getBoundingClientRect(), bn = end(to).querySelector('b').getBoundingClientRect();
    const x = W - 34 + lane * 12, y1 = an.top - box.top + an.height / 2, y2 = bn.top - box.top + bn.height / 2;
    const x1 = a.right - box.left + 8, x2 = b.right - box.left + 8, r = 6;
    return `<circle class="dot" cx="${x1}" cy="${y1}" r="2.5"/>` +
      `<path class="link ${kind}" d="M${x1} ${y1}H${x - r}q${r} 0 ${r} ${r}V${y2 - r}q0 ${r} ${-r} ${r}H${x2 + 6}"/>` +
      `<path class="tip ${kind}" d="M${x2} ${y2}l7 -4v8z"/>`;
  }).join('');
}
new ResizeObserver(draw).observe(root);
document.fonts.ready.then(draw);
</script>
```

地址最高的是栈。`count`、`values`、`one`、`text` 四个局部变量挤在一起，前后只差几十个字节。后三个其实都是“把手”：`values` 管着的 400 万字节在下面的匿名映射里，`one` 指向堆上的那个 `int`，`text` 指向只读段里的 `"hello"`。

`values` 的元素没进 `[heap]`，而是单独占了一块匿名映射。glibc 的 `malloc` 默认碰到超过 128 KiB 的请求，就直接向内核要一块独立的内存（`mmap`），释放时也直接还回去；小块才从 `[heap]` 里切。

地址最低的是程序本身，按权限分段：`r-x` 是代码，能读能执行；`r--` 是只读数据，字符串字面量在这儿；`rw-` 是能读写的全局数据。`calls` 写在函数里，却和全局变量住在一起，因为它是静态存储期。`counter` 在 `.data`，`zeroed` 和 `calls` 在 `.bss`，区别后面说。

还有那几段空着的：堆和程序之间隔了快 1 GiB，堆和匿名映射之间隔了 42 TiB。这些都是虚拟地址，只是编号，没映射就不占物理内存。x86-64 上一个进程有 128 TiB 的用户地址空间，这个程序映射出来的加起来才 11 MiB。每次运行，地址的高位都不一样，这是 ASLR 在随机化布局，各段的先后顺序不变。

## 跟着两次调用走一遍

把 `work` 改小一点，调用两次，一步一步看：

```render html title="地址来自一次真实运行（GCC -O0）"
<style>
  .run { --dyn: #356f9b; font-size: 13px; line-height: 1.45; font-variant-ligatures: none; }
  :root[data-theme="dark"] .run { --dyn: #95bfdc; }
  .run-body { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 16px 22px; }
  .code { min-width: 0; margin: 0; padding: 8px 0; overflow-x: auto; border-radius: 6px; background: var(--bg-sunken); font: 12.5px/1.75 var(--font-mono); }
  .code div { display: flex; padding-right: 8px; border-left: 3px solid transparent; white-space: pre; }
  .code div::before { content: attr(data-n); flex: none; width: 2.4em; padding-right: 10px; color: var(--faint); text-align: right; }
  .code div.now { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .code { --indent: 4ch; }
  .code div > span { padding-left: calc(var(--i) * var(--indent)); }
  .code .kw { color: var(--muted); }
  .mem { position: relative; display: grid; gap: 10px; align-content: start; }
  .area h4 { margin: 0 0 4px; color: var(--muted); font-size: 12px; font-weight: 400; }
  .frame { margin-bottom: 4px; padding: 4px 8px 6px; border-left: 3px solid var(--muted); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .frame > b { display: block; color: var(--muted); font: 500 12px var(--font-mono); }
  .slot { display: grid; grid-template-columns: 4.6em 3.2em minmax(0, 1fr); gap: 8px; align-items: center; min-height: 26px; }
  .slot span { font: 600 12.5px var(--font-mono); }
  .slot output { display: grid; place-items: center; height: 22px; border: 1px solid var(--rule-strong); border-radius: 3px; background: var(--bg); font: 12.5px var(--font-mono); }
  .slot output.unknown { color: var(--faint); }
  .slot output.ptr::after { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--dyn); }
  .slot output.dead { color: var(--faint); border-style: dashed; font-size: 11px; }
  .slot code { overflow: hidden; color: var(--faint); font: 11px var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
  .sp { display: flex; align-items: center; gap: 8px; color: var(--accent-ink); font-size: 11px; }
  .sp::before { content: ''; flex: 1; border-top: 1.5px solid var(--accent); }
  .empty { color: var(--faint); font-size: 12px; }
  .block { display: inline-flex; align-items: center; gap: 8px; padding: 4px 8px; border-left: 3px solid var(--dyn); background: color-mix(in srgb, var(--dyn) 8%, transparent); }
  .block i { display: grid; place-items: center; width: 26px; height: 22px; border: 1px solid var(--dyn); background: var(--bg); color: var(--text); font: normal 12.5px var(--font-mono); }
  .block code { color: var(--faint); font: 11px var(--font-mono); }
  .block.freed { border-left-style: dashed; background: none; }
  .block.freed i { border-style: dashed; border-color: var(--rule-strong); }
  .block small { color: var(--muted); font-size: 11px; }
  .static .slot { padding: 4px 8px; border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .hot { animation: hot .9s ease-out; }
  @keyframes hot { from { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent); } to { box-shadow: 0 0 0 3px transparent; } }
  @media (prefers-reduced-motion: reduce) { .hot { animation: none; } }
  .wire { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
  .wire path { fill: none; stroke: var(--dyn); stroke-width: 1.6; }
  .wire .tip { fill: var(--dyn); stroke: none; }
  .foot { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; margin-top: 12px; }
  .key { min-width: 44px; min-height: 38px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:disabled { cursor: default; opacity: .4; }
  .say { grid-column: 1 / -1; min-height: 1.45em; margin: 0; color: var(--text); }
  .say small { margin-right: 8px; color: var(--faint); font: 11px var(--font-mono); }
  .foot input { width: 100%; min-height: 30px; margin: 0; accent-color: var(--accent); }
  @media (max-width: 600px) {
    .run-body { grid-template-columns: 1fr; }
    .code { --indent: 2ch; font-size: 11.5px; }
    .code div::before { width: 2em; padding-right: 8px; }
  }
  @media (max-width: 300px) {
    .code { --indent: 1.5ch; font-size: 11px; }
    .code div { padding-right: 2px; }
    .code div::before { width: 1.8em; padding-right: 6px; }
  }
</style>
<section class="run" aria-label="单步执行两次 work 调用，观察栈帧、堆块和静态变量">
  <div class="run-body">
    <div class="code"></div>
    <div class="mem">
      <div class="area"><h4>栈</h4><div class="frames"></div></div>
      <div class="area"><h4>堆</h4><div class="heap"></div></div>
      <div class="area static"><h4>静态区</h4><div class="statics"></div></div>
      <svg class="wire" aria-hidden="true"></svg>
    </div>
  </div>
  <div class="foot">
    <p class="say" aria-live="polite"></p>
    <button class="key prev" type="button" aria-label="上一步">‹</button>
    <input type="range" min="0" value="0" aria-label="执行到第几步"/>
    <button class="key next" type="button" aria-label="下一步">›</button>
  </div>
</section>
<script>
const source = [
  'void work() {', '    int count = 3;', '    static int calls = 0;', '    ++calls;',
  '    std::vector<int> values(count, 7);', '}', '', 'int main() {', '    work();', '    work();', '}',
];
const ADDR = { count: '0x7fff127907b0', values: '0x7fff127907c0', block: '0x55c4ce598020', calls: '0x55c48fb8805c' };
// 每一步：执行的行号、这一步做了什么、做完之后的状态
const steps = [
  [8, '程序开始，calls 已经是 0', { work: false, calls: 0 }],
  [9, '调用 work：栈顶下移，整个栈帧一次划好', { work: true, count: '?', values: '?', calls: 0, hot: 'frame' }],
  [2, 'count = 3', { work: true, count: '3', values: '?', calls: 0, hot: 'count' }],
  [3, '什么也不做：calls 启动前就初始化好了', { work: true, count: '3', values: '?', calls: 0, hot: 'calls' }],
  [4, 'calls 加一', { work: true, count: '3', values: '?', calls: 1, hot: 'calls' }],
  [5, '构造 values：向分配器要 12 字节，放进 3 个 7', { work: true, count: '3', values: 'ptr', calls: 1, block: 'live', hot: 'block' }],
  [6, '析构 values：元素还给分配器', { work: true, count: '3', values: 'dead', calls: 1, block: 'freed', hot: 'block' }],
  [6, 'work 返回：栈顶移回去，栈帧作废', { work: false, calls: 1, block: 'freed', hot: 'sp' }],
  [10, '再调用 work：栈帧落在同一个位置', { work: true, count: '?', values: '?', calls: 1, block: 'freed', hot: 'frame' }],
  [2, 'count = 3', { work: true, count: '3', values: '?', calls: 1, block: 'freed', hot: 'count' }],
  [3, '还是什么也不做', { work: true, count: '3', values: '?', calls: 1, block: 'freed', hot: 'calls' }],
  [4, 'calls 加一，变成 2', { work: true, count: '3', values: '?', calls: 2, block: 'freed', hot: 'calls' }],
  [5, '分配器把刚收回的那块又给了 values', { work: true, count: '3', values: 'ptr', calls: 2, block: 'live', hot: 'block' }],
  [6, '析构 values：元素还给分配器', { work: true, count: '3', values: 'dead', calls: 2, block: 'freed', hot: 'block' }],
  [6, 'work 返回', { work: false, calls: 2, block: 'freed', hot: 'sp' }],
  [11, 'main 返回，程序结束；calls 一直活到最后', { work: false, main: false, calls: 2, block: 'freed' }],
];

const root = document.querySelector('.run');
const code = root.querySelector('.code'), wire = root.querySelector('.wire'), mem = root.querySelector('.mem');
const slider = root.querySelector('input'), prev = root.querySelector('.prev'), next = root.querySelector('.next');
let step = 0;
slider.max = steps.length - 1;

// 缩进用 padding 表示，窄屏可以收紧
code.innerHTML = source.map((text, i) => `<div data-n="${i + 1}"><span style="--i:${text.search(/\S|$/) / 4}">${text.trim()
  .replace(/</g, '&lt;')
  .replace(/\b(void|int|static)\b/g, '<span class="kw">$1</span>') || ' '}</span></div>`).join('');

function slot(name, value, cls = '') {
  const shown = value === 'ptr' ? '' : value === 'dead' ? '已析构' : value;
  const kind = value === '?' ? 'unknown' : value === 'ptr' ? 'ptr' : value === 'dead' ? 'dead' : '';
  return `<div class="slot ${cls}" data-slot="${name}"><span>${name}</span><output class="${kind}">${shown}</output><code>${ADDR[name]}</code></div>`;
}

function render(animate) {
  const [line, say, state] = steps[step];
  code.querySelectorAll('div').forEach((el, i) => el.classList.toggle('now', i + 1 === line));
  const frames = state.main === false ? '<p class="empty">空</p>' :
    `<div class="frame"><b>main</b></div>` +
    (state.work ? `<div class="frame" data-slot="frame"><b>work</b>${slot('count', state.count)}${slot('values', state.values)}</div>` : '') +
    `<div class="sp" data-slot="sp">栈顶</div>`;
  root.querySelector('.frames').innerHTML = frames;
  root.querySelector('.heap').innerHTML = state.block
    ? `<div class="block ${state.block}" data-slot="block">${state.block === 'live' ? '<i>7</i><i>7</i><i>7</i>' : '<i></i><i></i><i></i>'}<code>${ADDR.block}</code>${state.block === 'freed' ? '<small>已释放</small>' : ''}</div>`
    : '<p class="empty">空</p>';
  root.querySelector('.statics').innerHTML = slot('calls', String(state.calls));
  root.querySelector('.say').innerHTML = `<small>${step + 1}/${steps.length}</small>${say}`;
  if (animate && state.hot) root.querySelector(`[data-slot="${state.hot}"]`)?.classList.add('hot');
  slider.value = step;
  prev.disabled = step === 0;
  next.disabled = step === steps.length - 1;
  drawWire();
}

function drawWire() {
  const box = mem.getBoundingClientRect();
  wire.setAttribute('width', box.width);
  wire.setAttribute('height', box.height);
  const from = mem.querySelector('.ptr'), to = mem.querySelector('.block.live');
  if (!from || !to) return wire.innerHTML = '';
  // 从指针那个点往下，落到元素块的上沿
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const x1 = a.left - box.left + a.width / 2, y1 = a.top - box.top + a.height / 2 + 4;
  const x2 = Math.min(Math.max(x1, b.left - box.left + 14), b.right - box.left - 14), y2 = b.top - box.top - 1;
  const mid = (y1 + y2) / 2;
  wire.innerHTML = `<path d="M${x1} ${y1}V${mid}H${x2}V${y2 - 7}"/><path class="tip" d="M${x2} ${y2}l-4.5 -8h9z"/>`;
}

function go(to) {
  step = Math.max(0, Math.min(steps.length - 1, to));
  render(true);
}
prev.addEventListener('click', () => go(step - 1));
next.addEventListener('click', () => go(step + 1));
slider.addEventListener('input', () => go(Number(slider.value)));
new ResizeObserver(drawWire).observe(mem);
render(false);
</script>
```

调用 `work` 时，整个栈帧是一次划出来的：栈顶往下一挪，`count` 和 `values` 的位置就都有了，只是里面的值还说不准。分配就是挪一下指针，所以快。

`static int calls = 0;` 这一行执行到时什么也不做。`calls` 在程序启动前就已经是 0 了，所以它能跨调用累加。

`values` 自己在栈帧里，元素在堆上。函数结束时，`values` 先析构，把元素还给分配器，然后栈帧才弹出。这就是 **RAII**：资源跟着拥有它的对象走，对象一死，资源跟着释放。中途抛异常、栈展开时也一样。

第二次调用，栈帧和元素块落在了一模一样的地址上。这不是巧合：栈本来就是同一段内存反复用，分配器也会把刚收回的块先给下一个请求。

## 栈：快，但小

栈的代价是只能后进先出，而且总量有限。Linux 主线程的栈默认 8 MiB（`ulimit -s` 是 8192），新线程默认也是 8 MiB。放一个 300 万个 `int` 的局部数组，12 MB，直接段错误：

```cpp
int main() {
    int a[3'000'000];
    for (int i = 0; i < 3'000'000; ++i) a[i] = i;
    std::printf("%d\n", a[2'999'999]);
}
```

GCC、Clang，开不开优化都一样崩。换成 `std::vector<int> a(3'000'000);` 就没事：栈上只剩 24 字节的把手，元素在动态存储里。

动态存储管的就是栈管不了的三种情况：太大；大小到运行时才知道；寿命和调用顺序对不上，比如 A、B、C 依次创建，却按 B、A、C 的顺序销毁，或者要比创建它的函数活得更久。

反过来，“堆”不等于“手动释放”，`std::vector`、`std::unique_ptr` 都会在析构时替你释放；“栈”也不等于“读写更快”，分配好以后，访问速度主要看缓存。

## 字节还在，对象已经没了

```cpp
int* bad() {
    int value = 42;
    return &value;
}

int main() {
    int* p = bad();
    std::printf("%d\n", *p);
    std::printf("%d\n", *p);
}
```

`value` 在 `bad` 返回时就死了，`p` 成了悬空指针，读 `*p` 是未定义行为。实际跑一下：

| 编译 | 输出 |
| --- | --- |
| GCC，-O0 或 -O2 | 段错误 |
| Clang -O0 | `42`，然后是 `32571`，每次运行第二个数都不一样 |
| Clang -O2 | 两个看不出规律的大数，比如 `1460311720`、`1460310976` |

Clang -O0 那一行最有意思：第一次居然读到了 42。单步看它是怎么来的：

```render html title="Clang -O0 的一次真实运行；为了拿到地址，程序末尾多打印了一行"
<style>
  .dang { --bad: #a0524c; font-size: 13px; line-height: 1.45; font-variant-ligatures: none; }
  :root[data-theme="dark"] .dang { --bad: #d7948e; }
  .dang-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px 22px; }
  .code { --indent: 4ch; min-width: 0; margin: 0; padding: 8px 0; overflow-x: auto; border-radius: 6px; background: var(--bg-sunken); font: 12.5px/1.75 var(--font-mono); }
  .code div { display: flex; padding-right: 8px; border-left: 3px solid transparent; white-space: pre; }
  .code div::before { content: attr(data-n); flex: none; width: 2.4em; padding-right: 10px; color: var(--faint); text-align: right; }
  .code div > span { padding-left: calc(var(--i) * var(--indent)); }
  .code div.now { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .code .kw { color: var(--muted); }
  .mem { position: relative; display: grid; gap: 4px; align-content: start; }
  .mem h4 { margin: 0 0 2px; color: var(--muted); font-size: 12px; font-weight: 400; }
  .frame { padding: 4px 8px 6px; border-left: 3px solid var(--muted); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .frame > b { display: block; color: var(--muted); font: 500 12px var(--font-mono); }
  .frame.ghost { border-left-style: dashed; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--rule-strong) 35%, transparent) 6px 7px); }
  .frame.ghost > b { color: var(--faint); }
  .frame.other { border-left-color: var(--rule-strong); }
  .frame.idle { border-left-color: transparent; background: none; }
  .slot { display: grid; grid-template-columns: 3.4em auto; gap: 0 8px; align-items: center; justify-content: start; padding-top: 2px; }
  .slot span { font: 600 12.5px var(--font-mono); }
  .slot output { display: grid; place-items: center; min-width: 7.6em; height: 24px; padding: 0 8px; border: 1px solid var(--rule-strong); border-radius: 3px; background: var(--bg); font: 12.5px var(--font-mono); white-space: nowrap; }
  .slot output.unknown, .ghost .slot output, .idle .slot output { color: var(--faint); }
  .ghost .slot output { border-style: dashed; }
  .slot output.read { color: var(--bad); border-color: var(--bad); }
  .slot code { grid-column: 2; padding-left: 2px; color: var(--faint); font: 10.5px/1.6 var(--font-mono); }
  .sp { display: flex; align-items: center; gap: 8px; color: var(--accent-ink); font-size: 11px; }
  .sp::before { content: ''; flex: 1; border-top: 1.5px solid var(--accent); }
  .out { margin-top: 10px; }
  .out pre { min-height: 3.6em; margin: 0; padding: 6px 10px; border-radius: 6px; background: var(--bg-sunken); color: var(--text); font: 12.5px/1.6 var(--font-mono); }
  .wire { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
  .wire path { fill: none; stroke: var(--bad); stroke-width: 1.6; stroke-dasharray: 5 3; }
  .wire .tip { fill: var(--bad); stroke: none; stroke-dasharray: none; }
  .hot { animation: hot .9s ease-out; }
  @keyframes hot { from { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent); } to { box-shadow: 0 0 0 3px transparent; } }
  @media (prefers-reduced-motion: reduce) { .hot { animation: none; } }
  .foot { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; margin-top: 12px; }
  .say { grid-column: 1 / -1; min-height: 1.45em; margin: 0; color: var(--text); }
  .say small { margin-right: 8px; color: var(--faint); font: 11px var(--font-mono); }
  .key { min-width: 44px; min-height: 38px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:disabled { cursor: default; opacity: .4; }
  .foot input { width: 100%; min-height: 30px; margin: 0; accent-color: var(--accent); }
  @media (max-width: 600px) {
    .dang-body { grid-template-columns: 1fr; }
    .code { --indent: 2ch; font-size: 11.5px; }
    .code div::before { width: 2em; padding-right: 8px; }
  }
</style>
<section class="dang" aria-label="单步执行：悬空指针先读到旧值，再读到被 printf 覆盖的值">
  <div class="dang-body">
    <div class="code"></div>
    <div class="mem">
      <h4>栈</h4>
      <div class="frames"></div>
      <div class="out"><h4>输出</h4><pre></pre></div>
      <svg class="wire" aria-hidden="true"></svg>
    </div>
  </div>
  <div class="foot">
    <p class="say" aria-live="polite"></p>
    <button class="key prev" type="button" aria-label="上一步">‹</button>
    <input type="range" min="0" value="0" aria-label="执行到第几步"/>
    <button class="key next" type="button" aria-label="下一步">›</button>
  </div>
</section>
<script>
const source = [
  'int* bad() {', '    int value = 42;', '    return &value;', '}', '',
  'int main() {', '    int* p = bad();', '    std::printf("%d\\n", *p);', '    std::printf("%d\\n", *p);', '}',
];
const P_AT = '0x7ffc5741c0c0', V_AT = '0x7ffc5741c08c';
// below：main 下面那片栈的主人；slot：value 那 4 个字节里是什么
const steps = [
  [6, 'main 开始', { p: '?', below: 'idle', slot: '—' }],
  [7, '调用 bad：栈顶下移，划出 bad 的栈帧', { p: '?', below: 'bad', slot: '?', hot: 'below' }],
  [2, 'value = 42', { p: '?', below: 'bad', slot: '42', hot: 'slot' }],
  [3, '返回 value 的地址', { p: '?', below: 'bad', slot: '42', hot: 'slot' }],
  [7, 'bad 返回：栈顶移回，p 拿到的地址指向一块作废的栈', { p: V_AT, below: 'ghost', slot: '42', hot: 'p' }],
  [8, '调用 printf 之前先读 *p：42 还在', { p: V_AT, below: 'ghost', slot: '42', read: true, hot: 'slot' }],
  [8, 'printf 在同一片栈上建栈帧，盖掉了这 4 个字节', { p: V_AT, below: 'printf', slot: '0x00007f1d', hot: 'slot' }],
  [8, 'printf 打印 42，返回', { p: V_AT, below: 'ghost2', slot: '0x00007f1d', out: ['42'] }],
  [9, '再读 *p：0x7f1d，也就是 32541', { p: V_AT, below: 'ghost2', slot: '32541', read: true, out: ['42'], hot: 'slot' }],
  [9, 'printf 打印 32541', { p: V_AT, below: 'ghost2', slot: '32541', out: ['42', '32541'] }],
];
const owners = { idle: ['idle', '还没用到'], bad: ['', 'bad'], ghost: ['ghost', '已出栈的 bad'], printf: ['other', 'printf 和它调用的函数'], ghost2: ['ghost', '已出栈的 printf'] };

const root = document.querySelector('.dang');
const code = root.querySelector('.code'), mem = root.querySelector('.mem'), wire = root.querySelector('.wire');
const slider = root.querySelector('input'), prev = root.querySelector('.prev'), next = root.querySelector('.next');
let step = 0;
slider.max = steps.length - 1;

code.innerHTML = source.map((text, i) => `<div data-n="${i + 1}"><span style="--i:${text.search(/\S|$/) / 4}">${text.trim()
  .replace(/</g, '&lt;')
  .replace(/\b(int|return)\b/g, '<span class="kw">$1</span>') || ' '}</span></div>`).join('');

function render(animate) {
  const [line, say, state] = steps[step];
  code.querySelectorAll('div').forEach((el, i) => el.classList.toggle('now', i + 1 === line));
  const [cls, title] = owners[state.below];
  const name = state.below === 'bad' ? 'value' : state.p === '?' ? '' : '*p';
  root.querySelector('.frames').innerHTML =
    `<div class="frame"><b>main</b><div class="slot" data-slot="p"><span>p</span><output class="${state.p === '?' ? 'unknown' : ''}">${state.p}</output><code>${P_AT}</code></div></div>` +
    (state.below === 'bad' ? '' : '<div class="sp">栈顶</div>') +
    `<div class="frame ${cls}" data-slot="below"><b>${title}</b><div class="slot"><span>${name}</span><output class="${state.read ? 'read' : state.slot === '?' ? 'unknown' : ''}" data-slot="slot">${state.slot}</output><code>${V_AT}</code></div></div>` +
    (state.below === 'bad' ? '<div class="sp">栈顶</div>' : '');
  root.querySelector('pre').textContent = (state.out || []).join('\n');
  root.querySelector('.say').innerHTML = `<small>${step + 1}/${steps.length}</small>${say}`;
  if (animate && state.hot) root.querySelector(`[data-slot="${state.hot}"]`)?.classList.add('hot');
  slider.value = step;
  prev.disabled = step === 0;
  next.disabled = step === steps.length - 1;
  drawWire(state);
}

function drawWire(state = steps[step][2]) {
  const box = mem.getBoundingClientRect();
  wire.setAttribute('width', box.width);
  wire.setAttribute('height', box.height);
  if (state.p === '?') return wire.innerHTML = '';
  const a = mem.querySelector('[data-slot="p"] output').getBoundingClientRect();
  const b = mem.querySelector('[data-slot="slot"]').getBoundingClientRect();
  const x = Math.max(a.right, b.right) - box.left + 22, y1 = a.top - box.top + a.height / 2, y2 = b.top - box.top + b.height / 2, x2 = b.right - box.left + 2;
  wire.innerHTML = `<path d="M${a.right - box.left} ${y1}H${x - 8}q8 0 8 8V${y2 - 8}q0 8 -8 8H${x2 + 7}"/><path class="tip" d="M${x2} ${y2}l8 -4.5v9z"/>`;
}

function go(to) {
  step = Math.max(0, Math.min(steps.length - 1, to));
  render(true);
}
prev.addEventListener('click', () => go(step - 1));
next.addEventListener('click', () => go(step + 1));
slider.addEventListener('input', () => go(Number(slider.value)));
new ResizeObserver(() => drawWire()).observe(mem);
render(false);
</script>
```

`bad` 返回后，栈顶移了回去，可 `value` 那 4 个字节没人清，42 还在。第一次 `printf` 的参数 `*p` 在调用之前就读好了，读到的是旧值。可 `printf` 一进来，就在同一片栈上建自己的栈帧，正好把那几个字节盖掉。第二次再读，读到的是 `printf` 留在那儿的一个指针的高半截。

GCC 更干脆：它在编译时就看出你返回了局部变量的地址，给个警告，然后把返回值直接换成空指针，第一次读就崩。这反而是最好的结果。

三种结果都“合法”。未定义行为的意思是标准不管了，编译器怎么处理都行。偶尔读到 42，只说明那块内存还没被别人用上。

## static 和 const 管的不是一回事

`static` 管的是存储期。函数里的 `static int calls` 名字只在函数里能用，存储却从程序开始活到结束。需要运行构造函数的局部 `static` 对象，在第一次执行到声明那行时才构造，之后不再重来；`calls = 0` 这种常量初始化，启动前就做完了。

`.data` 和 `.bss` 的区别，看文件大小就知道：

```cpp
int a[25'000'000];        // 没写初值，进 .bss
int b[25'000'000] = {1};  // 有初值，进 .data
```

两种写法各编译一个程序，可执行文件一个 15,808 字节，一个 100,015,824 字节。`.data` 要把 1 亿字节的初值原样写进文件；`.bss` 只记一句“要 1 亿字节，全是 0”，装载时由内核给一片清零的页。标准规定静态存储期的对象先清零，全局的 `int n;` 一定是 0，`.bss` 就是这条规定的落地方式；函数里的 `int n;` 可没有这待遇，它的值说不准。

`const` 管的是能不能改，不决定住在哪。函数里的 `const int x = 3;` 照样是栈上的自动变量。字符串字面量是另一回事，它本身是静态存储期，放在只读段里：

```cpp
const char* p = "hello";        // p 在栈上，"hello" 在只读段
char a[] = "hello";             // a 在栈上，是一份 6 字节的副本
a[0] = 'H';                     // 改的是副本，没问题
const_cast<char*>(p)[0] = 'H';  // 写只读页，段错误
```

最后一行编译能过，强转把 `const` 去掉了；运行时往 `r--` 的页上写，内核直接发段错误。

## delete 之后，RSS 为什么不降

`delete` 完再看 `top` 的 RES 列（也就是 RSS，进程实际占着的物理内存），常常纹丝不动。这不一定是泄漏。

中间隔着一层分配器。`delete` 只是把块还给 glibc 的 `malloc`；分配器再往内核还，得按页来（一页 4 KiB），而且要一整页都空了才还得掉。

实测：`new` 一百万个 100 字节的块，全部写一遍，再用不同的顺序释放其中一半。

```render html title="示意：一页画了 8 个块（实际一页能放 36 个）；RSS 按实测值换算"
<style>
  .heap { --dyn: #356f9b; font-size: 13px; line-height: 1.45; font-variant-ligatures: none; }
  :root[data-theme="dark"] .heap { --dyn: #95bfdc; }
  .ops { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-bottom: 14px; }
  .seg { display: flex; align-items: center; gap: 16px; }
  .seg > span { color: var(--muted); font-size: 12px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .keys { display: flex; gap: 8px; margin-left: auto; }
  .key { min-height: 38px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font: 12.5px var(--font-mono); cursor: pointer; }
  .key.plain { font-family: var(--font-sans); }
  .key:disabled { cursor: default; opacity: .4; }
  .strip { position: relative; display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 3px; padding-top: 22px; }
  .page { display: grid; gap: 2px; padding: 2px; border: 1px solid var(--rule-strong); border-radius: 2px; transition: opacity .3s, border-color .3s; }
  .page i { height: 11px; border-radius: 1px; background: var(--dyn); transition: background .25s, box-shadow .25s; }
  .page i.free { background: none; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dyn) 55%, transparent); }
  .page.gone { border-style: dashed; opacity: .35; }
  .page.gone i { box-shadow: none; }
  .top { position: absolute; top: 0; bottom: -6px; width: 0; border-left: 2px solid var(--accent); transition: left .4s ease; }
  .top span { position: absolute; top: 0; left: 4px; color: var(--accent-ink); font-size: 11px; white-space: nowrap; }
  .top.left span { right: 4px; left: auto; }
  .axis { display: flex; justify-content: space-between; margin-top: 4px; color: var(--faint); font-size: 11px; }
  .meter { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 14px; align-items: center; margin-top: 16px; }
  .meter b { color: var(--text); font: 500 20px var(--font-mono); white-space: nowrap; }
  .meter b small { margin-left: 4px; color: var(--muted); font: 12px var(--font-sans); }
  .bar { display: flex; height: 14px; background: color-mix(in srgb, var(--rule) 50%, transparent); }
  .bar i { flex: none; height: 100%; transition: width .35s ease; }
  .bar .other { background: var(--rule-strong); }
  .bar .live { background: var(--dyn); }
  .bar .idle { background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--dyn) 55%, transparent) 0 2px, transparent 2px 5px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dyn) 55%, transparent); }
  .legend { grid-column: 2; display: flex; flex-wrap: wrap; gap: 2px 16px; color: var(--muted); font-size: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 14px; height: 10px; }
  .legend .live { background: var(--dyn); }
  .legend .idle { background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--dyn) 55%, transparent) 0 2px, transparent 2px 5px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dyn) 55%, transparent); }
  .legend .other { background: var(--rule-strong); }
  @media (max-width: 520px) {
    .strip { gap: 2px; }
    .page { padding: 1px; gap: 1px; }
    .page i { height: 9px; }
    .keys { margin-left: 0; }
    .meter { grid-template-columns: 1fr; }
    .legend { grid-column: 1; }
  }
</style>
<section class="heap" aria-label="按页看堆：释放的位置决定页能不能还给内核">
  <div class="ops">
    <div class="seg" role="group" aria-label="释放哪一半">
      <span>释放</span>
      <button type="button" data-free="odd" aria-pressed="false">隔一个</button>
      <button type="button" data-free="front" aria-pressed="false">前一半</button>
      <button type="button" data-free="back" aria-pressed="false">后一半</button>
    </div>
    <div class="keys"><button type="button" class="key trim">malloc_trim(0)</button><button type="button" class="key plain reset">重来</button></div>
  </div>
  <div class="strip"></div>
  <div class="axis"><span>低地址</span><span>高地址</span></div>
  <div class="meter" aria-live="polite">
    <b class="rss"></b><div class="bar"><i class="other"></i><i class="live"></i><i class="idle"></i></div>
    <div class="legend"><span><i class="live"></i>在用</span><span><i class="idle"></i>空着但还占着</span><span><i class="other"></i>其他</span></div>
  </div>
</section>
<script>
const PAGES = 24, PER = 8, N = PAGES * PER;
// 按实测换算：一百万个块写满后 RSS 从 11.3 MiB 涨到 118.4 MiB
const BASE = 11.3, HEAP = 107.1, SCALE = 120;
const root = document.querySelector('.heap');
const strip = root.querySelector('.strip');
let live, resident, brk, pattern;

const pages = Array.from({ length: PAGES }, () => {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = '<i></i>'.repeat(PER);
  strip.append(page);
  return page;
});
const marker = document.createElement('div');
marker.className = 'top';
marker.innerHTML = '<span>堆顶</span>';
strip.append(marker);

const empty = p => live.slice(p * PER, (p + 1) * PER).every(x => !x);

function reset() {
  live = Array(N).fill(true);
  resident = Array(PAGES).fill(true);
  brk = PAGES;
  pattern = null;
}

function free(kind) {
  reset();
  pattern = kind;
  live = live.map((_, i) => kind === 'odd' ? i % 2 === 0 : kind === 'front' ? i >= N / 2 : i < N / 2);
  // free 只会顺手收缩堆顶
  while (brk > 0 && empty(brk - 1)) resident[--brk] = false;
}

function trim() {
  for (let p = 0; p < brk; p++) if (empty(p)) resident[p] = false;
}

function render() {
  pages.forEach((page, p) => {
    page.classList.toggle('gone', !resident[p]);
    page.querySelectorAll('i').forEach((cell, k) => cell.classList.toggle('free', !live[p * PER + k]));
  });
  const first = pages[0].getBoundingClientRect(), box = strip.getBoundingClientRect();
  const edge = brk === 0 ? first.left - box.left : Math.min(box.width - 2, pages[brk - 1].getBoundingClientRect().right - box.left + 1);
  marker.style.left = `${edge}px`;
  marker.classList.toggle('left', brk > PAGES * .8);
  const used = live.filter(Boolean).length * HEAP / N;
  const kept = pages.reduce((sum, _, p) => sum + (resident[p] ? live.slice(p * PER, (p + 1) * PER).filter(x => !x).length : 0), 0) * HEAP / N;
  const rss = BASE + used + kept;
  root.querySelector('.rss').innerHTML = `${Math.round(rss)}<small>MiB RSS</small>`;
  const [other, liveBar, idle] = root.querySelectorAll('.bar i');
  other.style.width = `${BASE / SCALE * 100}%`;
  liveBar.style.width = `${used / SCALE * 100}%`;
  idle.style.width = `${kept / SCALE * 100}%`;
  root.querySelectorAll('[data-free]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.free === pattern)));
  root.querySelector('.trim').disabled = !pattern;
  strip.setAttribute('aria-label', `${resident.filter(Boolean).length} 页还占着物理内存，RSS 约 ${Math.round(rss)} MiB`);
}

root.querySelectorAll('[data-free]').forEach(button => button.addEventListener('click', () => { free(button.dataset.free); render(); }));
root.querySelector('.trim').addEventListener('click', () => { trim(); render(); });
root.querySelector('.reset').addEventListener('click', () => { reset(); render(); });
new ResizeObserver(render).observe(strip);
free('odd');
render();
</script>
```

| 释放哪一半 | 释放后 RSS | 再调 `malloc_trim(0)` |
| --- | --- | --- |
| 隔一个释放一个 | 118 MiB | 118 MiB |
| 前一半 | 118 MiB | 65 MiB |
| 后一半 | 65 MiB | 65 MiB |

释放前是 118 MiB。三种释放还回去的字节数一模一样，都是 53.5 MiB，结果却差了一截。

隔一个释放，每一页上都还留着活着的块，一页也还不回去，`malloc_trim` 也没辙。释放前一半，页是空出来了，可它们在堆的底部；`free` 只会顺手收缩堆顶，中间的空页得等 `malloc_trim` 一页页去还。释放后一半，空出来的正好是堆顶，堆当场就缩回去了。

大块走的是另一条路。`new char[100'000'000]` 单独占一块 `mmap`，`delete` 时直接 `munmap`：实测 RSS 从 3.7 MiB 涨到 99.3 MiB，释放后马上回到 3.9 MiB。

所以 RSS 没降，先分清两个问题：对象是不是已经销毁了，物理内存是不是已经还给系统了。前者要去找谁还拿着数据，后者要看分配器能不能还、愿不愿意还。

## 写代码时，先问谁拥有它

| 需求 | 先选 | 存储关系 |
| --- | --- | --- |
| 作用域内的小对象 | 普通局部变量、`std::array` | 数据就在对象里，随作用域结束 |
| 很大，或者运行时才知道大小 | `std::vector` | 对象管着另一块存储，析构时释放 |
| 单个对象要独立存活、转交所有权 | `std::unique_ptr` | 拥有者可以移动，负责销毁 |
| 多次调用之间保留状态 | 全局变量或局部 `static` | 存储一直在，多线程下要考虑共享 |

先想清楚谁拥有这份数据、它要活多久，放哪儿自然就定了。放对了地方，也挡不住悬空指针：`vector` 扩容时会把元素整体搬到新地方，之前拿到的 `data()` 指针照样悬空。

## 参考资料

- C++ 工作草案：[存储期](https://eel.is/c++draft/basic.stc)、[对象生命周期](https://eel.is/c++draft/basic.life)、[局部变量与初始化](https://eel.is/c++draft/stmt.dcl)。对象能活多久，以及作用域退出时发生什么；本文示例按 C++20 理解。
- C++ 工作草案：[new 表达式](https://eel.is/c++draft/expr.new)、[delete 表达式](https://eel.is/c++draft/expr.delete)、[vector 的容量与数据访问](https://eel.is/c++draft/vector.capacity)。区分对象自身和它管理的存储。
- ELF gABI：[程序装载](https://gabi.xinuos.com/elf/07-pheader.html)。文件里的数据怎样进入进程，零初始化的空间为什么不占文件体积。
- Linux 文档：[/proc 文件系统](https://docs.kernel.org/filesystems/proc.html)、[malloc_trim(3)](https://man7.org/linux/man-pages/man3/malloc_trim.3.html)、[mallopt(3)](https://man7.org/linux/man-pages/man3/mallopt.3.html)。进程的内存映射，分配器什么时候归还空闲页，`mmap` 的阈值。
