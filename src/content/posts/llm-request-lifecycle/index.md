---
title: "大模型为什么一个字一个字地回复"
description: "按下回车后，大模型的一次回复到底怎么逐个 token 算出来、再一步步推到屏幕上的。"
pubDate: 2026-10-22
updatedDate: 2026-11-11
tags: ["大语言模型", "机器学习", "计算机基础"]
---

用聊天界面和大模型对话时，回复总是一小段一小段地往外蹦，看着很像打字机特效。不过这并不是前端动画，在下一段文字出现之前，后端的模型确实还没把它算出来。这样的一小段就是 token，它是模型读取和生成的最小单位，有时是一个词，有时是一个汉字，碰上生僻字或表情符号甚至连一个字符都不到。

（有些产品会在前端把收到的字稍微匀一匀，让显示更顺滑，但逐块输出的源头还是在服务端。）

平时用大模型遇到的很多现象，都能从“每次只算一个 token”说起，比如第一个字为什么要等而后面比较匀速，为什么按 token 计费，为什么同一个问题问两遍答案会变，以及对话一长为什么就又贵又慢。

下面拿一段普通的对话做例子，从按下回车一路跟到最后一个字落在屏幕上：

```text
用户：我家刚领养了一只橘猫，特别能吃。
助手：恭喜！橘猫胃口好是出了名的，记得控制一下零食。
用户：给它起个名字吧，两个字。
```

把助手的第二句回复拆开慢放，大概是下面这样：

```render html title="慢放；候选和概率是示意"
<style>
  .loop { padding: 4px 0; font-variant-ligatures: none; font-size: 14px; line-height: 1.6; }
  .loop-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px 16px; margin-bottom: 8px; }
  .loop-count { margin: 0; color: var(--muted); font-size: 13px; }
  .loop-count b { margin: 0 4px; color: var(--text); font: 500 22px var(--font-mono); }
  .keys { display: flex; gap: 8px; }
  .key { min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .lane { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 16px; padding: 12px 0; border-top: 1px solid var(--rule); }
  .lane > span { padding-top: 2px; color: var(--muted); font-size: 12px; }
  .tok { display: inline-block; padding: 0 6px; border-bottom: 2px solid var(--accent); color: var(--accent-ink); font-size: 15px; white-space: pre; }
  .tok.context { border-color: var(--rule-strong); color: var(--muted); }
  .tok.old { border-color: var(--rule-strong); color: var(--text); }
  .read { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 4px; min-height: 28px; }
  .mono { font-family: var(--font-mono); font-size: 12px; }
  .bars { display: grid; gap: 2px; min-height: 140px; }
  .bars > p { margin: 0; color: var(--muted); font-size: 13px; }
  .bar { display: grid; grid-template-columns: 70px minmax(0, 1fr) 42px 34px; gap: 10px; align-items: center; min-height: 26px; }
  .bar > span:first-child { overflow: hidden; white-space: pre; text-overflow: ellipsis; }
  .bar .tok { padding: 0; border-color: transparent; color: var(--text); }
  .bar.pick .tok { padding: 0 6px; border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .track { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .bar i { flex: none; height: 10px; background: var(--rule-strong); }
  .bar output { color: var(--muted); font: 12px var(--font-mono); text-align: right; }
  .bar small { color: var(--accent-ink); font-size: 12px; }
  .bar.pick i { background: var(--accent); }
  .bar.rest { color: var(--muted); font-size: 12px; }
  .bar.rest i { background: repeating-linear-gradient(90deg, var(--rule-strong) 0 1px, transparent 1px 4px); }
  .bar.rest em { color: var(--faint); font-style: normal; white-space: nowrap; }
  .screen { min-height: 5.3em; font-size: 16px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
  .screen strong { font-weight: 650; }
  .caret { display: inline-block; width: 2px; height: 1.05em; margin-left: 2px; vertical-align: -.15em; background: var(--accent); }
  @media (max-width: 460px) {
    .lane { grid-template-columns: 1fr; gap: 6px; }
    .read { min-height: 62px; align-content: flex-start; }
    .bar { grid-template-columns: 58px minmax(0, 1fr) 40px 30px; gap: 8px; }
  }
</style>
<section class="loop" aria-label="每次调用只挑出一个 token，接到序列末尾，再调用下一次；整句回复一共调用 27 次">
  <div class="loop-top">
    <p class="loop-count" aria-live="polite"></p>
    <div class="keys">
      <button class="key prev" type="button" aria-label="上一次调用">‹</button>
      <button class="key next" type="button">下一次 ›</button>
      <button class="key play" type="button">播放</button>
    </div>
  </div>
  <div class="lane"><span>输入</span><div class="read"></div></div>
  <div class="lane"><span>打分</span><div class="bars"></div></div>
  <div class="lane"><span>屏幕</span><div class="screen"></div></div>
</section>
<script>
const END = '<|im_end|>';
const bytes = (...b) => ({ b });
// 每一圈的前 4 个候选；第三项为 1 的是这一圈抽中的，否则抽中第一个。
const steps = [
  [['叫', .42], ['可以', .19], ['就', .12], ['不如', .08]],
  [['它', .91], ['他', .04], ['「', .02], ['“', .01]],
  [['「', .57], ['“', .36], ['：', .03], ['小', .01]],
  [['橘', .38], ['小', .14], ['大', .10], ['胖', .10]],
  [['子', .34], ['座', .22, 1], ['宝', .18], ['仔', .08]],
  [['」', .93], ['」！', .03], ['大人', .01], ['儿', .01]],
  [['怎么样', .46], ['吧', .33], ['。', .09], ['，', .05]],
  [['？', .96], ['？\n\n', .02], ['呢', .01], ['！', .005]],
  [[bytes(0xf0, 0x9f, 0x90), .41], ['\n\n', .38], ['橘', .06], ['这', .03]],
  [[bytes(0xb1), .71], [bytes(0xbe), .14], [bytes(0x88), .09], [bytes(0xaf), .02]],
  [['\n\n', .62], ['橘', .14], [' ', .10], ['它', .04]],
  [['**', .48], ['橘', .31], ['这', .08], ['它', .04]],
  [['橘', .87], ['大', .04], ['霸', .02], ['主', .01]],
  [['座', .95], ['子', .02], ['宝', .01], ['猫', .005]],
  [['**', .92], ['」', .02], ['大人', .02], ['，', .01]],
  [['听起来', .29], ['就是', .20], ['是', .16], ['，', .10]],
  [['就', .58], ['很', .20], ['有', .10], ['像', .05]],
  [['有', .45], ['很', .25], ['像', .14], ['是', .06]],
  [['大佬', .31], ['一种', .24], ['气场', .10], ['排面', .09]],
  [['气场', .52], ['风范', .25], ['的', .13], ['范', .04]],
  [['，', .81], ['。', .12], ['！', .04], ['——', .01]],
  [['正', .27], ['和', .25], ['很', .18], ['也', .10]],
  [['配', .44], ['适合', .30], ['好', .15], ['合', .05]],
  [['它的', .61], ['得上', .20], ['它', .10], ['这', .04]],
  [['饭量', .72], ['胃口', .20], ['体型', .05], ['身材', .02]],
  [['。', .88], ['！', .08], ['～', .02], ['，', .01]],
  [[END, .86], ['\n\n', .11], ['如果', .01], ['要', .01]],
];
const root = document.querySelector('.loop');
const [prev, next, playButton] = root.querySelectorAll('button');
const encoder = new TextEncoder();
let step = 5, timer = 0;

const picked = i => (steps[i].find(c => c[2]) || steps[i][0])[0];
const label = t => t.b ? t.b.map(x => x.toString(16)).join(' ') : t.replace(/\n/g, '↵').replace(/ /g, '␣');
const isMono = t => t.b || t === END;
function chip(t, extra = '') {
  const span = document.createElement('span');
  span.className = 'tok' + (isMono(t) ? ' mono' : '') + extra;
  span.textContent = label(t);
  return span;
}
function screenText(n) {
  const decoder = new TextDecoder();
  let text = '';
  for (let i = 0; i < n; i++) {
    const t = picked(i);
    if (t !== END) text += decoder.decode(t.b ? Uint8Array.from(t.b) : encoder.encode(t), { stream: true });
  }
  return text;
}
const markdown = text => text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const percent = p => (p * 100 < 1 ? (p * 100).toFixed(1) : Math.round(p * 100)) + '%';

function render() {
  const done = step > 0 && picked(step - 1) === END;
  root.querySelector('.loop-count').innerHTML = step === 0
    ? `第<b>1</b>次调用 · 正在读入`
    : `第<b>${step}</b>次调用 · 共 ${steps.length} 次${done ? ' · 结束' : ''}`;
  // 这一次调用的输入：整段对话，加上前面每一圈抽中的 token；最后那个是上一圈刚接上的。
  const read = root.querySelector('.read');
  const written = Math.max(0, step - 1), from = Math.max(0, written - 6);
  const tape = [chip('整段对话', ' context')];
  if (from > 0) {
    const gap = document.createElement('span');
    gap.className = 'tok context';
    gap.textContent = '…';
    tape.push(gap);
  }
  for (let i = from; i < written; i++) tape.push(chip(picked(i), i === written - 1 ? '' : ' old'));
  read.replaceChildren(...tape);
  const bars = root.querySelector('.bars');
  if (step === 0) {
    const wait = document.createElement('p');
    wait.textContent = '整段对话一起算，算完才有第一张打分表';
    bars.replaceChildren(wait);
  } else {
    const list = steps[step - 1], choice = picked(step - 1);
    const rest = 1 - list.reduce((sum, c) => sum + c[1], 0);
    bars.replaceChildren(...list.map(([t, p]) => row(chip(t), p, t === choice)), row('其余', rest, false, '151,665 个候选'));
  }
  root.querySelector('.screen').innerHTML = markdown(screenText(step)) + (done ? '' : '<span class="caret"></span>');
  prev.disabled = step <= 1;
  next.disabled = step === steps.length;
}
function row(name, p, pick, note) {
  const div = document.createElement('div');
  div.className = 'bar' + (pick ? ' pick' : '') + (note ? ' rest' : '');
  const cell = document.createElement('span');
  cell.append(name);
  const track = document.createElement('span'), fill = document.createElement('i');
  track.className = 'track';
  fill.style.width = p * 100 + '%';
  track.append(fill);
  if (note) {
    const count = document.createElement('em');
    count.textContent = note;
    track.append(count);
  }
  const value = document.createElement('output');
  value.textContent = percent(p);
  const mark = document.createElement('small');
  mark.textContent = pick ? '抽中' : '';
  div.append(cell, track, value, mark);
  return div;
}
function stop() {
  clearTimeout(timer);
  timer = 0;
  playButton.textContent = '播放';
}
function advance() {
  step++;
  render();
  if (step < steps.length) timer = setTimeout(advance, 220);
  else stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (step >= steps.length) step = 0;
  playButton.textContent = '暂停';
  render();
  timer = setTimeout(advance, step === 0 ? 1100 : 220);
});
prev.addEventListener('click', () => { stop(); step = Math.max(1, step - 1); render(); });
next.addEventListener('click', () => { stop(); step = Math.min(steps.length, step + 1); render(); });
render();
</script>
```

模型每调用一次，都会给词表里的每个候选打出一个分数。采样器按这张打分表挑出一个 token，拼到输入末尾，再进入下一轮调用。上面这句回复，就是这样循环了 27 次拼出来的。

细看慢放，有两步有点反直觉。第 5 步里得分最高的是“子”，最后挑中的却是“座”；第 9 步模型明明输出了一个 token，屏幕上却什么字也没多出来。这两件事分别和后面的采样与字节解码有关。

## 发出去的是整段对话

按下回车后，前端会发出一个 HTTP 请求。各家平台的接口大同小异，按最常见的 OpenAI 格式写出来大概是这样：

```http
POST /v1/chat/completions HTTP/1.1
Authorization: Bearer sk-...
Content-Type: application/json

{
  "model": "some-chat-model",
  "stream": true,
  "messages": [
    { "role": "system", "content": "你是一个乐于助人的助手。" },
    { "role": "user", "content": "我家刚领养了一只橘猫，特别能吃。" },
    { "role": "assistant", "content": "恭喜！橘猫胃口好是出了名的，记得控制一下零食。" },
    { "role": "user", "content": "给它起个名字吧，两个字。" }
  ]
}
```

可以留意一下 `messages` 字段，上一轮的一问一答被原样又发了一遍。上面的 `stream: true` 用来让服务端算出一点就推回一点，最后再看它怎么传输。

模型本身是无状态的，内部没有“会话”概念。每次请求进来，它看到的都是一段需要从头读起的新文本，答完什么也不会留下。它知道要给一只橘猫起名，仅仅是因为第一轮对话又被塞进了这次的输入。把第一轮删掉，直接问“给它起个名字吧”，它连“它”指什么都无从判断。

历史消息可以由前端带着，也可以由服务端按会话 ID 查出来再拼好，对模型来说没有区别，最终喂进去的都是到目前为止的整段对话。所以点“新建对话”就像清了记忆，改掉前面某句话重发，则相当于从那里分出一条新的历史。

对话越长，每一轮发出去的内容就越多。假设系统提示 30 个 token，每句提问 40 个，每句回复 150 个，简单算一下各轮的数量：

```render html title="每一轮发出去的 token 数。假设系统提示 30 个，每句提问 40 个，每句回复 150 个"
<style>
  .hist { padding: 4px 0; font-size: 13px; font-variant-ligatures: none; }
  .hist-rows { display: grid; gap: 4px; }
  .hr { display: grid; grid-template-columns: 20px minmax(0, 1fr) 48px; gap: 8px; align-items: center; line-height: 1.3; }
  .hr > span { color: var(--faint); font: 11px var(--font-mono); text-align: right; }
  .hr > b { color: var(--muted); font: 400 12px var(--font-mono); text-align: right; }
  .hr.now > b { color: var(--text); font-weight: 600; }
  .hr.later { opacity: .14; }
  .hb { display: flex; height: 14px; }
  .hist i { flex: none; display: block; height: 100%; }
  .hist i.old { background: repeating-linear-gradient(135deg, var(--rule-strong) 0 1.5px, transparent 1.5px 4px); box-shadow: inset 0 0 0 1px var(--rule-strong); }
  .hist i.new { background: var(--accent); }
  .hist i.rep { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); }
  .hist-legend { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 12px 0 0; color: var(--muted); font-size: 12px; }
  .hist-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .hist-legend i { width: 14px; height: 10px; }
  .hist-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; margin-top: 12px; color: var(--muted); }
  .hist-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .hist-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .hist-sum { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 6px 0 0; color: var(--muted); }
  .hist-sum b { display: block; color: var(--text); font: 500 19px var(--font-mono); }
</style>
<section class="hist" aria-label="每一轮都把历史重发一遍：第 8 轮发出 1,400 个 token，其中新写的只有 40 个">
  <div class="hist-rows"></div>
  <div class="hist-legend">
    <span><i class="old"></i>历史</span><span><i class="new"></i>新写的</span><span><i class="rep"></i>模型的回复</span>
  </div>
  <label class="hist-controls">聊到第几轮<output></output><input type="range" min="1" max="12" value="8" aria-label="聊到第几轮" /></label>
  <div class="hist-sum" aria-live="polite"></div>
</section>
<script>
const SYS = 30, ASK = 40, REPLY = 150, ROUNDS = 12;
const root = document.querySelector('.hist');
const slider = root.querySelector('input');
const fmt = n => n.toLocaleString('en-US');
// 第 k 轮发出去的：old 是以前发过的，fresh 是这一轮新写的。
const sent = k => k === 1 ? { old: 0, fresh: SYS + ASK } : { old: SYS + (k - 1) * (ASK + REPLY), fresh: ASK };
const FULL = sent(ROUNDS).old + ASK + REPLY;
const width = v => (v / FULL * 100).toFixed(2) + '%';

function render() {
  const n = Number(slider.value);
  let total = 0, rows = '';
  for (let k = 1; k <= ROUNDS; k++) {
    const { old, fresh } = sent(k);
    if (k <= n) total += old + fresh;
    rows += `<div class="hr${k === n ? ' now' : ''}${k > n ? ' later' : ''}"><span>${k}</span>` +
      `<div class="hb"><i class="old" style="width:${width(old)}"></i><i class="new" style="width:${width(fresh)}"></i><i class="rep" style="width:${width(REPLY)}"></i></div>` +
      `<b>${fmt(old + fresh)}</b></div>`;
  }
  root.querySelector('.hist-rows').innerHTML = rows;
  const now = sent(n);
  root.querySelector('output').textContent = `第 ${n} 轮`;
  root.querySelector('.hist-sum').innerHTML =
    `<span>这一轮发出<b>${fmt(now.old + now.fresh)}</b></span><span>其中新写的<b>${fmt(now.fresh)}</b></span><span>${n} 轮累计发出<b>${fmt(total)}</b></span>`;
}
slider.addEventListener('input', render);
render();
</script>
```

每一轮生成的回复，到下一轮都会并进历史里，所以请求长度一行比一行长。第 8 轮发出去 1,400 个 token，新写的只有那句 40 个 token 的提问。八轮累计下来，模型读了 5,880 个输入 token，而人真正写下的连系统提示算上才 350 个。单看一轮是线性增长，累计起来就是平方级开销。至于图里斜纹标出的重复历史能不能省去重算，后面讲缓存时会再回头看。

长度还有上限，模型一次能处理的 token 数是固定的，也就是常说的上下文窗口。聊超了之后，应用层只能截断或压缩早期内容。这时觉得它“忘了”最早交代过的话，多半是因为那几句压根没被发过去。

请求会先经过网关，完成鉴权、额度和限流检查，有的还要过一道内容审核，然后转发到跑着目标模型的机器上排进队列。走到这一步，还和普通的 Web 服务差不多。

## 模型看到的是一篇文档

`messages` 是给程序看的结构，模型本身不认识数组或字段，只接收一串 token。推理服务会先用这个模型对应的聊天模板，把对话展开成一段连续文本。拖动图里的竖线，可以对比界面和底层文本的样子：

```render html title="Qwen 系列使用的 ChatML 格式"
<style>
  .xray { --x: 58%; padding: 4px 0; font-variant-ligatures: none; }
  .xr-stage { position: relative; display: grid; gap: 14px; padding: 6px 0 12px; cursor: ew-resize; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  .xr-row { display: grid; }
  .xr-row > div { grid-area: 1 / 1; min-width: 0; }
  .xr-ui { display: flex; align-items: flex-start; clip-path: inset(-8px -8px -8px var(--x)); font-size: 15px; line-height: 1.7; }
  .xr-doc { clip-path: inset(-8px calc(100% - var(--x)) -8px -8px); color: var(--text); font: 12.5px/1.9 var(--font-mono); font-variant-ligatures: none; white-space: pre-wrap; overflow-wrap: anywhere; }
  .user .xr-ui { justify-content: flex-end; }
  .bubble { max-width: 78%; padding: 7px 14px; border-radius: 16px; background: var(--surface); }
  .assistant .bubble { padding-left: 0; background: none; }
  .hidden-note { padding-top: 4px; color: var(--faint); font-size: 12px; }
  .dots { color: var(--muted); font-size: 18px; letter-spacing: .25em; }
  .sp { padding: 1px 4px; border-radius: 4px; background: var(--accent-soft); color: var(--accent-ink); }
  .nl { color: var(--faint); }
  .role { color: var(--muted); }
  .cursor { display: inline-block; width: .55em; height: 1.15em; vertical-align: -.22em; background: var(--accent); opacity: .75; }
  .xr-line { position: absolute; top: 0; bottom: 0; left: clamp(7px, var(--x), calc(100% - 7px)); border-left: 1.5px solid var(--accent); pointer-events: none; }
  .xr-line::after { position: absolute; bottom: -6px; left: -7px; width: 12px; height: 12px; border: 1.5px solid var(--accent); border-radius: 50%; background: var(--bg); content: ''; }
  .xr-controls { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; margin-top: 12px; color: var(--muted); font-size: 12px; }
  .xr-controls input { width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
</style>
<section class="xray" aria-label="界面上的几个气泡，在模型那边是一篇连续的文档：每条消息夹在控制标记之间，开头写着角色，结尾停在 assistant 后面等模型续写">
  <div class="xr-stage"></div>
  <label class="xr-controls"><span>界面</span><input type="range" min="0" max="100" value="58" aria-label="分界线位置" /><span>模型读到的</span></label>
</section>
<script>
const messages = [
  ['system', '你是一个乐于助人的助手。'],
  ['user', '我家刚领养了一只橘猫，特别能吃。'],
  ['assistant', '恭喜！橘猫胃口好是出了名的，记得控制一下零食。'],
  ['user', '给它起个名字吧，两个字。'],
  ['assistant', null],
];
const root = document.querySelector('.xray');
const stage = root.querySelector('.xr-stage');
const range = root.querySelector('input');
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const newline = () => [el('span', 'nl', '↵'), document.createTextNode('\n')];
for (const [role, content] of messages) {
  const ui = el('div', 'xr-ui'), doc = el('div', 'xr-doc');
  if (role === 'system') ui.append(el('span', 'hidden-note', '系统提示，界面上不显示'));
  else if (content == null) ui.append(el('span', 'dots', '···'));
  else ui.append(el('div', 'bubble', content));
  doc.append(el('span', 'sp', '<|im_start|>'), el('span', 'role', role), ...newline());
  if (content == null) doc.append(el('span', 'cursor'));
  else doc.append(content, el('span', 'sp', '<|im_end|>'), ...newline());
  const row = el('div', 'xr-row ' + role);
  row.append(ui, doc);
  stage.append(row);
}
stage.append(el('div', 'xr-line'));

function place(percent) {
  root.style.setProperty('--x', percent + '%');
  range.value = percent;
}
function follow(event) {
  const box = stage.getBoundingClientRect();
  place(Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * 100));
}
let dragging = false;
stage.addEventListener('pointerdown', event => {
  dragging = true;
  stage.setPointerCapture(event.pointerId);
  if (event.pointerType === 'mouse') follow(event);
});
stage.addEventListener('pointermove', event => { if (dragging) follow(event); });
stage.addEventListener('pointerup', () => { dragging = false; });
stage.addEventListener('pointercancel', () => { dragging = false; });
range.addEventListener('input', () => place(Number(range.value)));
place(innerWidth < 520 ? 100 : 58);
</script>
```

展开以后，整段对话就成了一篇带标记的文档。每条消息包在 `<|im_start|>` 和 `<|im_end|>` 之间，开头写明角色，末尾停在 `assistant` 后面留出空白。接下来模型要做的，就是把这篇文档往下续写。

聊天对话是在续写的基础上“排版”出来的。预训练阶段，模型反复练的只是给任意文本预测下文；到了微调阶段，它见过大量按这种格式排好的对话，才学会读到 `assistant` 这一行就用助手口吻作答，写完补上一个 `<|im_end|>`。

`<|im_start|>` 和 `<|im_end|>` 在词表里各占一个独立位置，属于专门的控制标记。如果用户消息里出现一模一样的字符串，服务端分词时必须把它当普通字符切开，否则谁都能在对话里伪造出一段 system 指令。

不过除了这几个分隔标记，系统提示、用户输入、搜索结果和工具返回值，最后全都排在同一串 token 里。模型分辨某段话是谁说的，只能靠这些标记和训练出来的偏好，底层结构上并不存在类似权限隔离的机制。提示词注入能得逞，根子就在这里，哪怕网页正文里藏一句“忽略之前的所有指令”，送进模型以后也和别的文字没什么两样。

什么时候停，同样由模型自己写出来。一旦它生成了 `<|im_end|>`，服务端监测到就会收尾。如果调用时漏配了这个停止条件，它会顺着文档格式继续往下编，自己换行写出 `<|im_start|>user`，替你把下一句也说了。早期自己搭开源聊天程序时，这种自问自答挺常见的。

## 切成 token

模型处理的不是原始字符，而是一串整数编号。tokenizer 负责把文本切分成词表里的片段，再映射成对应的 ID。词表在训练之前就固定好了，比如 Qwen3 有 151,643 个普通 token 和 26 个控制标记，Llama 3 一共 128,256 个。

现在主流的做法是字节级 BPE。构造词表时，先把语料按 UTF-8 拆成字节，每个字节算一个基础 token，起步正好 256 个。然后在语料里反复找出相邻出现最多的那一对，合并成新 token 并记下规则。这样合并十几万次，词表就建好了。以后碰到新文本，先拆成 UTF-8 字节，再按同样的顺序重放这些合并就行。

下面这个分词器是在页面里现场训练的，语料是一千多字编出来的养猫琐事。虽然规模很小，合并几百次就学到头了，但流程和真实大模型完全一样。页面打开时是合并完的样子，点“从字节合并”可以让句子退回原始字节，再一步步重放整个合并过程，输入框里的内容也可以随便改：

```render html title="在页面里现场训练的字节级 BPE；语料约 1,200 字"
<style>
  .bpe { --blue: #356f9b; padding: 4px 0; font-size: 14px; font-variant-ligatures: none; }
  :root[data-theme="dark"] .bpe { --blue: #95bfdc; }
  .bpe-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
  .bpe-count { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
  .bpe-count label { color: var(--muted); font-size: 13px; }
  .bpe-count output { color: var(--muted); font: 13px var(--font-mono); }
  .bpe-count output b { color: var(--text); font-weight: 500; }
  .keys { display: flex; gap: 8px; }
  .key { min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .bpe-range { display: block; width: 100%; min-height: 36px; margin: 4px 0 0; accent-color: var(--accent); }
  .bpe-text { width: 100%; margin: 12px 0 0; padding: 6px 0; border: 0; border-bottom: 1px solid var(--rule-strong); border-radius: 0; background: transparent; color: var(--text); font-size: 15px; outline: none; }
  .bpe-text:focus { border-color: var(--accent); }
  .chips { display: flex; flex-wrap: wrap; gap: 12px 5px; min-height: 64px; padding: 18px 0 4px; }
  .chip { display: grid; justify-items: center; gap: 1px; }
  .chip b { padding: 0 3px 1px; border-bottom: 2px solid var(--accent); font-size: 17px; font-weight: 400; line-height: 1.55; white-space: pre; }
  .chip:nth-child(even) b { border-color: var(--blue); }
  .chip.bytes b { border-bottom-style: dashed; color: var(--muted); font: 13px/2 var(--font-mono); }
  .chip.fresh b { background: var(--accent-soft); }
  .chip small { color: var(--faint); font: 10.5px var(--font-mono); }
  .stats { margin: 10px 0 0; color: var(--muted); font-size: 13px; }
  .stats b { margin: 0 3px; color: var(--text); font: 500 15px var(--font-mono); }
  .merges { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 12px; line-height: 2; }
  .merges code { margin-right: 14px; color: var(--text); font: 12px var(--font-mono); white-space: pre; }
</style>
<section class="bpe" aria-label="字节级 BPE：从每个字节一个 token 开始，每合并一次，句子里常挨在一起的两块并成一个 token">
  <div class="bpe-top">
    <div class="bpe-count"><label for="merge-count">合并次数</label><output class="merge-out"></output></div>
    <div class="keys">
      <button class="key prev" type="button" aria-label="退回上一次改动这句话的合并">‹</button>
      <button class="key next" type="button" aria-label="前进到下一次改动这句话的合并">›</button>
      <button class="key play" type="button">从字节合并</button>
    </div>
  </div>
  <input class="bpe-range" id="merge-count" type="range" min="0" step="1" />
  <input class="bpe-text" type="text" value="我家刚领养了一只橘猫，特别能吃。" aria-label="要切分的文字" />
  <div class="chips" aria-live="polite"></div>
  <p class="stats"></p>
  <p class="merges"></p>
</section>
<script>
const corpus = `我家刚领养了一只橘猫，特别能吃。它每天早上六点准时叫我起床，不给猫粮就一直叫。都说橘猫胃口好，十只橘猫九只胖，还有一只特别胖。
朋友说，橘猫能吃是天性，记得控制一下零食，每天的猫粮最好称一称。我问朋友：给它起个名字吧，两个字就行。朋友说可以叫它橘子，也可以叫它大橘。我说大橘听起来就很能吃。
后来我们给它起了个名字，叫橘座。橘座喜欢晒太阳，也喜欢吃。每次我打开猫粮袋，它就跑过来，一边叫一边蹭我的腿。
我家的橘猫不怕人。家里来了客人，它也不躲，还会跳到客人腿上睡觉。客人问这只猫叫什么名字，我说叫橘座。客人说这个名字好，听着就有气场。
养猫以后，我每天都给它拍照片，手机里全是猫的照片。我妈说我对猫比对人还好。我说猫不会说话，人会。橘座听了，喵了一声，好像在说：给我开个罐头。
有一次我出差三天，请朋友帮忙喂猫。朋友每天给我发一张照片，照片里的橘座都在吃。回家以后，我发现它又胖了一圈。朋友说不是他喂多了，是它自己会开柜子。
后来柜子上了锁，橘座就每天坐在柜子前面叫。它叫得很有耐心，一叫就是半个小时。我只好给它买了一个自动喂食器，每天定时定量，一天三顿，一顿也不多给。
喂食器刚到家的时候，橘座很怕它。喂食器一响，它就钻到沙发底下。过了两天，它发现喂食器一响就有饭吃，于是每天守在喂食器旁边，比闹钟还准。
邻居家也养了一只猫，是一只白猫，叫小白。小白很瘦，吃得也少。邻居想不通，同样是猫，为什么我家的猫这么能吃。我说橘猫就是这样，能吃能睡，胖得很快乐。
很多人给猫起名字，喜欢用吃的：橘子、年糕、饭团、汤圆、馒头、布丁、可乐。也有人喜欢叫小橘、大橘、胖橘、咪咪。名字好不好，猫自己其实不在乎，叫它吃饭的时候它都会来。
我也问过聊天机器人，让它给猫起个名字，两个字就行。它说可以叫橘座，正配它的饭量。我说这个名字已经用了。它又说可以叫大橘，我说这个也有人用了。它想了想，说那就叫饭团吧。
猫的名字叫久了，就成了家里的一部分。现在我喊一声橘座，它就会从房间里跑出来，看看我手里有没有吃的。如果没有，它就转身回去睡觉，一点面子也不给。
冬天的时候，橘座最喜欢待在暖气片旁边。它把自己团成一个球，尾巴盖住鼻子，一睡就是一下午。我叫它，它只动一下耳朵，眼睛都不睁。
夏天就不一样了。它喜欢躺在瓷砖上，四条腿伸得直直的，肚子朝天。朋友来家里，看到它这个样子，都说这不是猫，是一块年糕。
给猫洗澡是一件大事。橘座不喜欢水，一进浴室就开始叫，叫得整栋楼都能听见。洗完以后它会生气，一整天不理我，晚上吃饭的时候才原谅我。
带猫去医院也是一件大事。医生说橘座有点胖，要减肥。我问医生怎么减，医生说少吃多动。我回家看了看橘座，它正躺在沙发上吃猫条。我觉得这件事很难。
The orange cat likes to eat. My cat is an orange cat. The cat sleeps on the sofa. Cats like to sleep in the sun.`;

// 先按规则切成“词”，BPE 只在词内部合并；和 Qwen 的切分规则基本一致，数字逐位切开。
const split = /'(?:s|t|re|ve|m|ll|d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;
const encoder = new TextEncoder();
const pair = (a, b) => a * 4096 + b;

const counts = new Map();
for (const [word] of corpus.matchAll(split)) counts.set(word, (counts.get(word) || 0) + 1);
const words = [...counts].map(([word, n]) => ({ ids: [...encoder.encode(word)], n }));
const merges = [];
const pieces = Array.from({ length: 256 }, (_, i) => [i]);
for (;;) {
  const seen = new Map();
  for (const w of words)
    for (let i = 0; i + 1 < w.ids.length; i++) {
      const key = pair(w.ids[i], w.ids[i + 1]);
      seen.set(key, (seen.get(key) || 0) + w.n);
    }
  let best = -1, top = 1;
  for (const [key, n] of seen) if (n > top || (n === top && key < best)) { best = key; top = n; }
  if (best < 0) break;
  const a = Math.floor(best / 4096), b = best % 4096, id = 256 + merges.length;
  merges.push([a, b]);
  pieces.push([...pieces[a], ...pieces[b]]);
  for (const w of words) {
    const next = [];
    for (let i = 0; i < w.ids.length; i++) {
      if (w.ids[i] === a && w.ids[i + 1] === b) { next.push(id); i++; }
      else next.push(w.ids[i]);
    }
    w.ids = next;
  }
}
const rank = new Map(merges.map(([a, b], r) => [pair(a, b), r]));

// used：顺手记下这段文字用到了第几次合并。
function encode(text, limit, used) {
  const out = [];
  for (const [word] of text.matchAll(split)) {
    let ids = [...encoder.encode(word)];
    for (;;) {
      let best = Infinity;
      for (let i = 0; i + 1 < ids.length; i++) {
        const r = rank.get(pair(ids[i], ids[i + 1]));
        if (r < limit && r < best) best = r;
      }
      if (best === Infinity) break;
      if (used) used.add(best);
      const [a, b] = merges[best], next = [];
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] === a && ids[i + 1] === b) { next.push(256 + best); i++; }
        else next.push(ids[i]);
      }
      ids = next;
    }
    out.push(...ids);
  }
  return out;
}

// 能拼成完整字符的字节显示成字，拼不成的显示成十六进制。
function view(id) {
  const b = pieces[id];
  let text = '', broken = false;
  for (let i = 0; i < b.length;) {
    const n = b[i] < 0x80 ? 1 : b[i] >= 0xf0 ? 4 : b[i] >= 0xe0 ? 3 : b[i] >= 0xc0 ? 2 : 0;
    const seq = b.slice(i, i + n);
    if (n && seq.length === n && seq.slice(1).every(x => (x & 0xc0) === 0x80)) {
      text += new TextDecoder().decode(Uint8Array.from(seq)).replace(/\n/g, '↵').replace(/ /g, '␣');
      i += n;
    } else {
      text += (text && !text.endsWith(' ') ? ' ' : '') + b[i].toString(16).padStart(2, '0') + ' ';
      broken = true;
      i++;
    }
  }
  return { text: text.trim(), broken };
}

const root = document.querySelector('.bpe');
const slider = root.querySelector('#merge-count');
const input = root.querySelector('.bpe-text');
const prev = root.querySelector('.prev'), next = root.querySelector('.next'), playButton = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer = 0;
slider.max = merges.length;
slider.value = merges.length;

// 这句话真正用到的那些合并，按学会的先后排好；合并总是从先学会的做起。
function usedRanks(text) {
  const used = new Set();
  encode(text, merges.length, used);
  return [...used].sort((a, b) => a - b);
}

function render() {
  const k = Number(slider.value), text = input.value;
  const ids = encode(text, k), used = usedRanks(text);
  const newest = used.includes(k - 1) ? 255 + k : -1;   // 刚做的那次合并造出来的 token
  prev.disabled = !used.some(r => r < k);
  next.disabled = !used.some(r => r >= k);
  root.querySelector('.merge-out').innerHTML = `<b>${k}</b> 次 · 词表 <b>${256 + k}</b>`;
  root.querySelector('.chips').replaceChildren(...ids.map(id => {
    const { text, broken } = view(id);
    const chip = document.createElement('span');
    chip.className = 'chip' + (broken ? ' bytes' : '') + (id === newest ? ' fresh' : '');
    const face = document.createElement('b'), number = document.createElement('small');
    face.textContent = text;
    number.textContent = id;
    chip.append(face, number);
    return chip;
  }));
  root.querySelector('.stats').innerHTML =
    `<b>${[...text].length}</b>个字符 → <b>${encoder.encode(text).length}</b>个字节 → <b>${ids.length}</b>个 token`;
  const recent = merges.slice(Math.max(0, k - 4), k).map(([a, b], i) => {
    const r = Math.max(0, k - 4) + i;
    return `<code>${view(a).text} + ${view(b).text} → ${view(256 + r).text}</code>`;
  });
  root.querySelector('.merges').innerHTML = k
    ? '最近学会的合并：' + recent.join('')
    : '还没有合并：每个字节各是一个 token';
}

// 往前或往后走到下一次真正改动这句话的合并。
function stepTo(direction) {
  const k = Number(slider.value), used = usedRanks(input.value);
  if (direction > 0) {
    const r = used.find(x => x >= k);
    if (r === undefined) return false;
    slider.value = r + 1;
  } else {
    const before = used.filter(x => x < k);
    if (!before.length) return false;
    slider.value = before[before.length - 1];
  }
  render();
  return true;
}
function stop() {
  clearTimeout(timer);
  timer = 0;
  playButton.textContent = '从字节合并';
}
function tick() {
  if (stepTo(1)) timer = setTimeout(tick, 140);
  else stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (reduce) { slider.value = merges.length; return render(); }
  slider.value = 0;
  render();
  playButton.textContent = '暂停';
  timer = setTimeout(tick, 600);
});
prev.addEventListener('click', () => { stop(); stepTo(-1); });
next.addEventListener('click', () => { stop(); stepTo(1); });
slider.addEventListener('input', () => { stop(); render(); });
input.addEventListener('input', () => { stop(); render(); });
render();
</script>
```

先看默认合并完的状态。“橘猫”“能吃”“特别”在语料里反复出现，各自成了一个 token；“领”只出现过一次，它的几个字节凑不成高频对子，最后还是三个分散的字节。真实词表也一样，生僻字、冷门语言和少见的表情，常常会被拆成好几块。

再点重放看看。一开始每个常用汉字都占 3 个 UTF-8 字节，整句话的 token 比字数多不少。随着合并推进，两个字节先拼成半个字，再补成整字，常连用的双字词会在更后面合到一起。滑块停在中间某些位置时，甚至能看到一个 token 横跨两个汉字的边界——BPE 只看哪两块常挨在一起，并不懂字在哪里断开。

也可以往输入框里打一句英文试试。演示语料里几乎没有英文，单词会被切得很碎。放到真实场景也是同理，分词器训练时占比低的语言，表达同样的意思要多花 token，更贵也更占上下文。

词表越大，同样的文本切出来越短，窗口能装下的内容越多。但词表不能无限制扩大，因为模型一头一尾两张权重表都和词表大小直接挂钩，多一个 token 就要多存一行参数，现在主流模型基本折中在十几万这个量级。

计费和上下文长度都按 token 算，所以同一段话换个模型，token 数可能差出一截。模型也“看不见”单个字母，问它 strawberry 里有几个 r，它拿到的是几个词表编号，字母藏在编号背后。数字怎么切也各家不同，Qwen 会把每一位数字单独切开，Llama 3 则最多三位一组，同一个数到了两个模型那里是完全不同的切法。

## 一次前向：从编号到打分

开头慢放里说的“调用一次”，在深度学习里对应一次前向传播：把整串编号从输入端送进去，顺着网络从第一层算到最后一层，在输出端得到一张打分表。

第一步是查表。embedding 矩阵里每一行对应一个 token，Qwen3-8B 的这张表有 151,936 行、4,096 列（为了对齐，行数比词表多留了两百多行空位）。拿到编号就按行号取对应的那一行，一个整数就变成了 4,096 维向量。编号本身没有大小含义，纯粹是个索引。

序列里有多少个 token，就会查出多少个向量，每个位置各占一个。它们一起流经几十层网络（Qwen3-8B 是 36 层），每一层都会在原有向量的基础上叠加两步更新：

$$
\begin{aligned}
x&\leftarrow x+\operatorname{Attention}(\operatorname{Norm}(x)),\\
x&\leftarrow x+\operatorname{MLP}(\operatorname{Norm}(x)).
\end{aligned}
$$

其中注意力让每个位置去参考别的位置，并且只允许往前看，比如第 5 个位置能看到第 1 到第 5 个，看不到第 6 个。第二轮里的“它”，就是在这里和上一轮的“橘猫”连上的，具体怎么算我在[《Transformer》](/posts/transformer/)里拆过，这里不展开。MLP 对每个位置单独做一次非线性变换，模型的大头参数都在这里；Norm 则是归一化，把向量大小拉回稳定尺度。

两步更新都不是直接覆盖，而是累加回 $x$ 上。$x$ 像一条从第一层直通最后一层的主干，每层往上面叠加一点增量，常被叫作残差流。

因为只能往前看，整条序列里唯一读完完整对话的只有最后一个位置。训练时每个位置的任务又都是猜紧跟在后面的下一个 token，最后一个位置猜的正好是还没写出来的那个。走完最后一层后，取出它的向量做一次归一化，再和词表里每个 token 的输出向量分别做点积，就能得到 151,936 个分数，也就是 logits，分数越高越可能是下一个 token。

点积衡量的是两个向量有多同向。从几何上看，挑词就是看哪个 token 的方向和当前向量对得最准，压到二维平面上大概是这样：

```render html title="二维示意：只画了 7 个候选，轨迹是编的；分数是点积，概率由分数换算，换法在下一节"
<style>
  .lens { padding: 4px 0; font-size: 14px; }
  .lens-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px 30px; align-items: center; }
  .lens-plane svg { display: block; width: 100%; height: auto; overflow: visible; }
  .ray { stroke: var(--rule-strong); stroke-width: 1; }
  .ray.top { stroke: var(--accent); stroke-width: 1.6; }
  .ray-label { fill: var(--muted); font-size: 15px; text-anchor: middle; dominant-baseline: central; }
  .ray-label.top { fill: var(--accent-ink); font-weight: 600; }
  .ring { fill: none; stroke: var(--rule); stroke-dasharray: 2 4; }
  .trail { fill: none; stroke: var(--muted); stroke-width: 1; stroke-opacity: .55; }
  .trail-dot { fill: var(--muted); fill-opacity: .5; }
  .arrow { stroke: var(--accent); stroke-width: 2.6; stroke-linecap: round; }
  .arrow-head { fill: var(--accent); }
  .foot { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 3; }
  .foot-dot { fill: var(--accent); }
  .badge { fill: var(--accent-ink); font-size: 12px; }
  .lens-bars { display: grid; gap: 4px; }
  .lb, .lens-head { display: grid; grid-template-columns: 24px minmax(0, 1fr) 44px 40px; gap: 10px; align-items: center; }
  .lens-head { color: var(--faint); font-size: 11px; }
  .lens-head span:nth-child(n + 3) { text-align: right; }
  .lb { min-height: 25px; }
  .lb i { display: block; height: 10px; background: var(--rule-strong); }
  .lb.top span { color: var(--accent-ink); font-weight: 600; }
  .lb.top i { background: var(--accent); }
  .lb output { color: var(--text); font: 12px var(--font-mono); text-align: right; }
  .lb small { color: var(--muted); font: 11px var(--font-mono); text-align: right; }
  .lens-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 10px 26px; margin-top: 16px; }
  .lens-controls label { display: grid; flex: 1 1 260px; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; color: var(--muted); font-size: 13px; }
  .lens-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .lens-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .seg { display: flex; gap: 18px; }
  .seg button { min-height: 40px; padding: 4px 0; border: 0; border-bottom: 2px solid var(--rule); border-radius: 0; background: none; color: var(--muted); font-size: 13px; cursor: pointer; }
  .seg button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); }
  .key { min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  @media (max-width: 560px) {
    .lens-body { grid-template-columns: 1fr; }
    .lens-plane { width: min(100%, 330px); margin: 0 auto; }
  }
</style>
<section class="lens" aria-label="最后一个位置的向量在每个候选方向上的投影就是分数；它被一层层推向“橘”，删掉第一轮对话就推不过去">
  <div class="lens-body">
    <div class="lens-plane"></div>
    <div>
      <div class="lens-head"><span></span><span></span><span>概率</span><span>分数</span></div>
      <div class="lens-bars"></div>
    </div>
  </div>
  <div class="lens-controls">
    <label>层<output class="layer-out"></output><input type="range" min="0" max="36" value="36" aria-label="层" /></label>
    <button class="key play" type="button">逐层播放</button>
    <div class="seg" role="group" aria-label="上下文">
      <button type="button" data-history="1" aria-pressed="true">保留第一轮</button>
      <button type="button" data-history="0" aria-pressed="false">删掉第一轮</button>
    </div>
  </div>
</section>
<script>
const LAYERS = 36, JUMP = 12, UNIT = 34;
const rays = [['橘', 22], ['大', 62], ['饭', -22], ['胖', 100], ['年', 160], ['小', 200], ['咪', 245]];
// 关键帧：[层, 方向（度）, 长度]。第 12 层之前两条路一样，之后看有没有“橘猫”可读。
const keyframes = {
  1: [[0, 190, .5], [6, 205, .65], [11, 215, .8], [12, 15, 1.1], [20, 25, 1.8], [28, 22, 2.4], [36, 22, 3]],
  0: [[0, 190, .5], [6, 205, .65], [11, 215, .8], [12, 218, .95], [20, 214, 1.2], [28, 215, 1.45], [36, 215, 1.7]],
};
function trajectory(frames) {
  const points = [];
  for (let l = 0; l <= LAYERS; l++) {
    const j = frames.findIndex(([at]) => at >= l), [l1, a1, r1] = frames[j];
    let angle = a1, length = r1;
    if (l1 !== l) {
      const [l0, a0, r0] = frames[j - 1], t = (l - l0) / (l1 - l0);
      angle = a0 + (a1 - a0) * t + 6 * Math.sin(l * 2.1) * (l < JUMP ? 1 : .4);
      length = r0 + (r1 - r0) * t + .05 * Math.sin(l * 3.3);
    }
    points.push([angle, length]);
  }
  return points;
}
const paths = { 1: trajectory(keyframes[1]), 0: trajectory(keyframes[0]) };
const rad = d => d * Math.PI / 180;
const xy = (angle, length) => [length * UNIT * Math.cos(rad(angle)), -length * UNIT * Math.sin(rad(angle))];
const scores = ([angle, length]) => rays.map(([, a]) => length * Math.cos(rad(a - angle)));
function softmax(z) {
  const top = Math.max(...z), e = z.map(v => Math.exp(v - top)), sum = e.reduce((s, v) => s + v, 0);
  return e.map(v => v / sum);
}

const root = document.querySelector('.lens');
const slider = root.querySelector('input');
let history = '1';

function render() {
  const layer = Number(slider.value), path = paths[history], h = path[layer];
  const z = scores(h), p = softmax(z), best = z.indexOf(Math.max(...z));
  const [hx, hy] = xy(...h);
  const [ux, uy] = xy(rays[best][1], 1).map(v => v / UNIT);
  const foot = (hx * ux + hy * uy);
  const f = n => n.toFixed(1);
  const head = (() => {
    const len = Math.hypot(hx, hy) || 1, dx = hx / len, dy = hy / len;
    return `${f(hx)},${f(hy)} ${f(hx - 9 * dx - 4.5 * dy)},${f(hy - 9 * dy + 4.5 * dx)} ${f(hx - 9 * dx + 4.5 * dy)},${f(hy - 9 * dy - 4.5 * dx)}`;
  })();
  const trail = path.slice(0, layer + 1).map(q => xy(...q));
  const badge = layer === JUMP ? `<text class="badge" x="${f(hx + 10)}" y="${f(hy - 12)}">${history === '1' ? '读到“橘猫”' : '没有“橘猫”可读'}</text>` : '';
  root.querySelector('.lens-plane').innerHTML = `<svg viewBox="-150 -150 300 300" role="img" aria-label="第 ${layer} 层，向量最接近“${rays[best][0]}”的方向">
    <circle class="ring" r="${UNIT * 3}"/>
    ${rays.map(([name, a], i) => {
      const [x, y] = xy(a, 3.3), [lx, ly] = xy(a, 3.75);
      return `<line class="ray${i === best ? ' top' : ''}" x2="${f(x)}" y2="${f(y)}"/><text class="ray-label${i === best ? ' top' : ''}" x="${f(lx)}" y="${f(ly)}">${name}</text>`;
    }).join('')}
    <polyline class="trail" points="${trail.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}"/>
    ${trail.map(([x, y]) => `<circle class="trail-dot" cx="${f(x)}" cy="${f(y)}" r="1.8"/>`).join('')}
    ${foot > 0 ? `<line class="foot" x1="${f(hx)}" y1="${f(hy)}" x2="${f(foot * ux)}" y2="${f(foot * uy)}"/><circle class="foot-dot" cx="${f(foot * ux)}" cy="${f(foot * uy)}" r="2.6"/>` : ''}
    <line class="arrow" x2="${f(hx)}" y2="${f(hy)}"/>
    <polygon class="arrow-head" points="${head}"/>
    ${badge}
  </svg>`;
  root.querySelector('.lens-bars').replaceChildren(...rays.map(([name], i) => {
    const row = document.createElement('div');
    row.className = 'lb' + (i === best ? ' top' : '');
    row.innerHTML = `<span>${name}</span><span><i style="width:${p[i] * 100}%"></i></span><output>${(p[i] * 100).toFixed(1)}%</output><small>${z[i].toFixed(2)}</small>`;
    return row;
  }));
  root.querySelector('.layer-out').textContent = layer === 0 ? '0 · 查表的结果' : layer === LAYERS ? `${layer} · 最后一层` : String(layer);
}
const playButton = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer = 0;
function stop() {
  clearInterval(timer);
  timer = 0;
  playButton.textContent = '逐层播放';
}
function step() {
  slider.value = Number(slider.value) + 1;
  render();
  if (Number(slider.value) >= LAYERS) stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (reduce) { slider.value = LAYERS; return render(); }
  slider.value = 0;
  render();
  playButton.textContent = '暂停';
  timer = setInterval(step, 170);
});
slider.addEventListener('input', () => { stop(); render(); });
root.querySelectorAll('[data-history]').forEach(button => button.addEventListener('click', () => {
  history = button.dataset.history;
  root.querySelectorAll('[data-history]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));
render();
</script>
```

图里的橙色箭头代表最后一个位置的向量，它在每条候选方向上的投影长度对应着该候选的分数（假设方向向量等长），虚线标出了得分最高的那一条。

点“逐层播放”可以看到它一路的演化：前几层方向比较散，各个候选分数差不多；到了第 12 层，注意力把上文的“橘猫”带了进来，向量明显转向“橘”；后面几层继续拉长，分数的差距越拉越大，分布也越来越尖。点“删掉第一轮”重放一遍，没有上下文线索，这次转向就不会发生，箭头最后停在“小”和“咪”中间。

真实模型里的向量有几千维、候选有十几万个，但过程完全一样，每一层叠加一点修正，最后看它指向哪里。把中间层的向量直接拿来算分数，这种方法叫 logit lens，在真模型上同样能看到预测一层层清晰起来。当然，图里单层转向是我为了看得清编的，真模型通常是跨越好几层逐步完成的。

这一趟前向跑完，模型的权重参数一个也没变。聊过的内容不会写进权重，下一个请求进来，模型还是完全一样的状态。另外，前面那些位置在这一轮算出来的中间结果也没有浪费，后面逐个生成时还会反复复用。

## 掷骰子

算出来的 logits 可正可负，加起来也不是 1，没法直接拿来抽样。先要过一遍 softmax 转成概率分布：

$$
p_i=\frac{e^{z_i/T}}{\sum_j e^{z_j/T}}
$$

每个分数先取指数变成正数，再除以总和，加起来就正好是 1。取了指数之后，分数上的差会变成概率上的倍数，比如差 1 分概率就差 $e\approx2.7$ 倍，差 2 分就是 7.4 倍。

$T$ 是温度，取指数前拿它缩放分数。$T=1$ 保持模型原本的分布。把温度降到 $T=0.5$，1 分差距放大成 2 分，2.7 倍变成 7.4 倍，分布更尖；设成 $T=2$，1 分缩成半分，倍差只剩 1.6 倍，冷门 token 也有了机会。如果 $T\to0$，概率就全部集中到分数最高的那一个上，也就是贪心解码。

之后通常会再过 top-k 和 top-p 两道过滤。top-k 只留排名前 $k$ 的候选；top-p 按概率从高到低累加，凑够 $p$ 就截断，后面的全部扔掉，剩下的重新归一化。这么做主要是为了砍掉长尾。词表里十几万个候选，绝大多数单个概率极小，但数量太多，加起来并不小，万一抽中一个，句子就可能突然跑偏。Qwen3 给非思考模式的推荐配置是 $T=0.7$、top-p 0.8、top-k 20。

筛完以后，按剩下的概率随机抽一个。把开头给猫起名那一步画出来，格子宽度代表概率大小，第一行按第一个字划分，第二行再在对应区间下面按条件概率切分。一个名字的总概率，就是这一路上的概率相乘：

$$
P(\text{橘座})=P(\text{橘})\times P(\text{座}\mid\text{橘})=0.38\times0.22\approx0.084
$$

```render html title="概率是示意；只展开了名字的前两个字"
<style>
  .names { padding: 4px 0; font-size: 14px; }
  .names svg { display: block; width: 100%; overflow: visible; }
  .cell { stroke: var(--bg); stroke-width: 1.5; }
  .n1 { fill: color-mix(in srgb, var(--accent) 26%, var(--bg)); }
  .n2 { fill: color-mix(in srgb, var(--accent) 12%, var(--bg)); }
  .tail { fill: var(--rule); }
  .cell.hit { fill: color-mix(in srgb, var(--accent) 62%, var(--bg)); }
  .cell-label { fill: var(--text); font-size: 15px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  .cell-p { fill: var(--muted); font-family: var(--font-mono); font-size: 10px; text-anchor: middle; pointer-events: none; }
  .row-label { fill: var(--muted); font-size: 11px; }
  .axis { stroke: var(--rule-strong); }
  .tick { fill: var(--faint); font-family: var(--font-mono); font-size: 10px; text-anchor: middle; }
  .needle { fill: var(--accent-ink); transform-box: fill-box; transform-origin: top; }
  .needle.drop { animation: drop .16s ease-out; }
  .pin { stroke: var(--accent-ink); stroke-width: 1.2; stroke-opacity: .5; }
  @keyframes drop { from { transform: scaleY(0); } }
  @media (prefers-reduced-motion: reduce) { .needle.drop { animation: none; } }
  .names-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 12px 22px; margin-top: 10px; }
  .names-controls label { display: grid; flex: 1 1 220px; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; color: var(--muted); font-size: 13px; }
  .names-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .names-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .keys { display: flex; flex-wrap: wrap; gap: 8px; }
  .key { min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .key[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-soft); }
  .formula { margin: 14px 0 0; color: var(--muted); font: 13px var(--font-mono); }
  .formula .katex { font-size: 14px; }
  .formula .hit { color: var(--accent-ink); }
  .record { display: flex; flex-wrap: wrap; gap: 6px 8px; min-height: 30px; margin: 10px 0 0; padding: 0; list-style: none; }
  .record li { padding: 1px 8px; border-bottom: 1px solid var(--rule-strong); color: var(--text); font-size: 14px; }
  .record li.odd { border-color: var(--muted); color: var(--muted); }
  .record li:first-child { border-color: var(--accent); color: var(--accent-ink); }
</style>
<section class="names" aria-label="名字的概率树：格子的宽度就是概率，抽样就是往底边扎一针；温度调高长尾变宽，top-p 把长尾剪掉">
  <div class="plot"></div>
  <div class="names-controls">
    <label>温度<output class="t-out"></output><input class="temp" type="range" min="0" max="2" step="0.05" value="1" aria-label="温度" /></label>
    <div class="keys">
      <button class="key top-p" type="button" aria-pressed="false">top-p 0.9</button>
      <button class="key once" type="button">抽一次</button>
      <button class="key many" type="button">抽 20 次</button>
    </div>
  </div>
  <p class="formula" aria-live="polite"></p>
  <ul class="record" aria-label="抽到的名字，最新的在前"></ul>
</section>
<script>
const odd = [...'喵嘟豆毛乖妞崽虎狮福壮阿花奶布丁可乐米糖果冬瓜芋栗龘のQπ丿叁犇嗷咕嘿乂亖曰'];
// 每个节点：几个常见候选 + 一条由几十个冷门字组成的长尾。
function node(named, tailMass, seed) {
  const taken = new Set(named.map(([t]) => t));
  const pool = odd.slice(seed % odd.length).concat(odd.slice(0, seed % odd.length)).filter(t => !taken.has(t));
  const weights = pool.map((_, j) => .87 ** j), total = weights.reduce((s, w) => s + w, 0);
  return [...named.map(([t, p]) => ({ t, p })), ...pool.map((t, j) => ({ t, p: tailMass * weights[j] / total, tail: true }))];
}
const first = node([['橘', .38], ['小', .14], ['大', .10], ['胖', .10], ['饭', .06], ['年', .04], ['咪', .03], ['金', .03]], .12, 0);
const second = {
  橘: node([['子', .34], ['座', .22], ['宝', .18], ['仔', .08], ['猫', .04], ['球', .03]], .11, 3),
  小: node([['橘', .45], ['胖', .15], ['黄', .12], ['饭', .06], ['咪', .05], ['金', .04]], .13, 6),
  大: node([['橘', .62], ['胖', .10], ['黄', .08], ['福', .06], ['饭', .04]], .10, 9),
  胖: node([['橘', .40], ['胖', .15], ['虎', .12], ['墩', .10], ['球', .06]], .17, 12),
  饭: node([['团', .45], ['桶', .30], ['饭', .08], ['盆', .05]], .12, 15),
  年: node([['糕', .85], ['年', .05]], .10, 18),
  咪: node([['咪', .60], ['宝', .15], ['橘', .08]], .17, 21),
  金: node([['橘', .40], ['子', .15], ['宝', .15], ['元', .10]], .20, 24),
};
const fallback = node([], 1, 27);
const childrenOf = t => second[t] || fallback;

const root = document.querySelector('.names');
const temp = root.querySelector('.temp');
const topP = root.querySelector('.top-p');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = 0, focus = ['橘', '座'], fresh = false, lastNeedle = null, run = 0;
const record = [], pins = [];

// 温度和 top-p 作用在每个节点自己的分布上。
function shape(dist) {
  const T = Number(temp.value);
  let q;
  if (T === 0) {
    const best = dist.reduce((b, c, i) => c.p > dist[b].p ? i : b, 0);
    q = dist.map((_, i) => +(i === best));
  } else {
    const w = dist.map(c => c.p ** (1 / T)), sum = w.reduce((s, v) => s + v, 0);
    q = w.map(v => v / sum);
  }
  if (topP.getAttribute('aria-pressed') === 'true') {
    const order = q.map((v, i) => i).sort((a, b) => q[b] - q[a]);
    let acc = 0;
    const keep = new Set();
    for (const i of order) { if (acc >= .9) break; keep.add(i); acc += q[i]; }
    q = q.map((v, i) => keep.has(i) ? v / acc : 0);
  }
  return dist.map((c, i) => ({ ...c, q: q[i] }));
}
function pick(dist, u) {
  let acc = 0;
  for (const c of dist) { acc += c.q; if (u < acc) return [c, (u - (acc - c.q)) / c.q]; }
  const last = dist.filter(c => c.q > 0).at(-1);
  return [last, .999];
}
// 一个随机数决定整条路径：先落在第一个字的区间里，再按区间内的相对位置挑第二个字。
function sample() {
  const u = Math.random();
  const [a, rest] = pick(shape(first), u);
  const [b] = pick(shape(childrenOf(a.t)), rest);
  return { u, name: [a.t, b.t], odd: a.tail || b.tail };
}
function prob(path) {
  const a = shape(first).find(c => c.t === path[0]);
  const b = shape(childrenOf(path[0])).find(c => c.t === path[1]);
  return [a.q, b.q];
}

function draw(needle) {
  const W = width, f = n => n.toFixed(1);
  const row1 = shape(first);
  let x = 0, cells = '', labels = '';
  const groups = [];
  for (const c of row1) {
    if (c.q === 0) continue;
    const w = c.q * W;
    const last = groups.at(-1);
    if (c.tail && last && last.tail) { last.w += w; last.q += c.q; last.items.push(c); }
    else groups.push({ ...c, x, w, items: [c] });
    x += w;
  }
  for (const g of groups) {
    const hit = !g.tail && focus[0] === g.t;
    cells += `<rect class="cell ${g.tail ? 'tail' : 'n1'}${hit ? ' hit' : ''}" x="${f(g.x)}" y="18" width="${f(Math.max(0, g.w))}" height="44"/>`;
    if (!g.tail && g.w >= 18) labels += `<text class="cell-label" x="${f(g.x + g.w / 2)}" y="${g.w >= 44 ? 34 : 40}">${g.t}</text>`;
    if (!g.tail && g.w >= 44) labels += `<text class="cell-p" x="${f(g.x + g.w / 2)}" y="53">${(g.q * 100).toFixed(1)}%</text>`;
    if (g.tail && g.w >= 22) labels += `<text class="cell-label" x="${f(g.x + g.w / 2)}" y="40" style="fill:var(--muted);font-size:13px">${g.w >= 40 ? '其他' : '…'}</text>`;
    if (g.tail) {
      cells += `<rect class="cell tail" x="${f(g.x)}" y="92" width="${f(Math.max(0, g.w))}" height="44"/>`;
      continue;
    }
    let cx = g.x, tailStart = null, tailW = 0;
    for (const c of shape(childrenOf(g.t))) {
      if (c.q === 0) continue;
      const w = c.q * g.w;
      if (c.tail) { if (tailStart === null) tailStart = cx; tailW += w; cx += w; continue; }
      const on = hit && focus[1] === c.t;
      cells += `<rect class="cell n2${on ? ' hit' : ''}" x="${f(cx)}" y="92" width="${f(w)}" height="44"/>`;
      if (w >= 18) labels += `<text class="cell-label" x="${f(cx + w / 2)}" y="${w >= 44 ? 108 : 114}" style="font-size:14px">${c.t}</text>`;
      if (w >= 44) labels += `<text class="cell-p" x="${f(cx + w / 2)}" y="127">${(g.q * c.q * 100).toFixed(1)}%</text>`;
      cx += w;
    }
    if (tailW > 0) cells += `<rect class="cell tail" x="${f(tailStart)}" y="92" width="${f(tailW)}" height="44"/>`;
  }
  const ticks = [0, .25, .5, .75, 1].map(t => `<line class="axis" x1="${f(t * W)}" x2="${f(t * W)}" y1="148" y2="153"/><text class="tick" x="${f(Math.min(W - 12, Math.max(12, t * W)))}" y="166">${t * 100}%</text>`).join('');
  const marks = pins.map(u => `<line class="pin" x1="${f(u * W)}" x2="${f(u * W)}" y1="139" y2="147"/>`).join('');
  const pin = needle == null ? '' : `<rect class="needle${fresh ? ' drop' : ''}" x="${f(needle * W - .75)}" y="10" width="1.5" height="138"/>`;
  root.querySelector('.plot').innerHTML = `<svg viewBox="0 0 ${W} 172" height="172" role="img" aria-label="第一个字和第二个字的概率分区">
    <text class="row-label" x="0" y="10">第 1 个字</text><text class="row-label" x="0" y="84">第 2 个字</text>
    ${cells}${labels}<line class="axis" x1="0" x2="${W}" y1="148" y2="148"/>${ticks}${marks}${pin}</svg>`;
  fresh = false;
  const [pa, pb] = prob(focus);
  root.querySelector('.formula').innerHTML = pa * pb > 0
    ? `${focus[0]} $\\times$ ${focus[1]} $= ${(pa * 100).toFixed(1)}\\% \\times ${(pb * 100).toFixed(1)}\\% = \\htmlClass{hit}{${(pa * pb * 100).toFixed(2)}\\%}$`
    : `${focus.join('')}：这个设置下已经抽不到了`;
  const T = Number(temp.value);
  root.querySelector('.t-out').textContent = T === 0 ? '$T = 0$ · 贪心' : `$T = ${T.toFixed(2)}$`;
  root.querySelector('.record').replaceChildren(...record.map(r => {
    const li = document.createElement('li');
    li.textContent = r.name.join('');
    if (r.odd) li.className = 'odd';
    return li;
  }));
}
// 扎一针：记下名字，在底边留一道短线。
function drawOne() {
  const s = sample();
  record.unshift(s);
  record.splice(24);
  pins.push(s.u);
  if (pins.length > 80) pins.shift();
  focus = s.name;
  lastNeedle = s.u;
  fresh = true;
  draw(lastNeedle);
}
function stopRun() {
  clearInterval(run);
  run = 0;
}
function drawMany(times) {
  stopRun();
  if (reduce) { for (let i = 0; i < times; i++) drawOne(); return; }
  let left = times - 1;
  drawOne();
  run = setInterval(() => {
    drawOne();
    left--;
    if (left <= 0) stopRun();
  }, 200);
}
// 温度或 top-p 一变，格子的位置都变了，以前的针脚不再对得上。
function reshape() {
  stopRun();
  pins.length = 0;
  lastNeedle = null;
  draw(null);
}
root.querySelector('.once').addEventListener('click', () => { stopRun(); drawOne(); });
root.querySelector('.many').addEventListener('click', () => drawMany(20));
temp.addEventListener('input', reshape);
topP.addEventListener('click', () => {
  topP.setAttribute('aria-pressed', String(topP.getAttribute('aria-pressed') !== 'true'));
  reshape();
});
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(lastNeedle); }
}).observe(root.querySelector('.plot'));
</script>
```

点“抽一次”相当于往底边随机投一个点，落在哪一格就选哪个名字；点“抽 20 次”可以看到 20 次落点在底边留下的短线。随机点大致均匀分布，格子越宽，命中的次数自然越多。开头第 5 步选中 22% 概率的“座”，就是采样恰好落在了这一段里。图里的概率数字是我按常识编的，背后的采样规则是真的。

实际推理时这个过程分两步完成，先抽第一个字并喂回去，重新前向拿到第二个字的打分表，再抽第二个字。图里把两次合并成了一点，先看它落进第一行的哪一格，再看它在这格内部的左右位置。两种抽法对每个名字给出的命中几率完全等价。

把“温度”滑块往右拉，灰色的长尾区域会越来越宽，“龘Q”这类怪名字冒出来的几率随之变大；开启“top-p 0.9”，凑够 90% 之后的长尾就会被直接裁掉。温度拖到 0，整张图只剩一条固定路径，每次抽出来都是“橘子”。

所以点“重新生成”会得到不同回复，并不是模型每次算出了不同的分数。只要输入和权重没变，神经网络作为确定性函数给出的打分表就是一模一样的，随机性都在采样这一步。

## 写一个，喂回去

抽出来的 token 接到序列末尾，整段序列再送进模型算下一个。这种把前面输出拼回输入继续预测的做法叫自回归：

$$
P(y_1,\dots,y_m\mid c)=\prod_{t=1}^{m}P(y_t\mid c,y_{<t})
$$

$c$ 是发进来的整段对话，$y_t$ 是写出来的第 $t$ 个 token。每个新 token 都以前面的全部内容为条件，包括模型自己刚写下的部分。这也意味着它没法回头修改已经输出的内容，前面写了什么，后面就只能顺着这个前提往下接。第 5 步一旦挑中了“座”，后文就只能顺着“橘座”往下圆。

如果照着公式直接实现，每多生成一个 token 就得把整段序列从头重算一遍。但前面提过，注意力只允许往前看。新 token 接在末尾，前面所有旧位置能看到的上下文完全没变，它们在每一层算出来的结果也和上一轮一模一样，从头再算纯属做无用功。

而且新位置做注意力计算时，并不需要前面位置的全部信息。在每一层注意力里，每个位置都会由自己的向量算出三个向量：Q 表示它想找什么，K 表示它这里有什么特征，V 表示匹配上之后实际读走的内容。新位置只需要拿自己的 Q 去和前面所有位置的 K 比对，再按权重汇总对应的 V，前面位置的 Q 它用不着。

因此只需要把每个位置、每一层的 K 和 V 存下来就行，每次生成新 token 时只算这一个新位置的 Q、K、V，再去读缓存好的历史 K、V。这就是 KV cache：

```render html title="示意：提示词 10 个 token，生成 8 个"
<style>
  .kv { padding: 4px 0; font-size: 13px; }
  .kv-grids { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 30px; }
  .kv-title { margin: 0 0 10px; color: var(--text); font-size: 13px; }
  .kv-grid { display: grid; grid-template-columns: 16px repeat(17, minmax(0, 1fr)) 64px; gap: 2px; align-items: center; }
  .kv-prompt { grid-column: 2 / span 10; padding-bottom: 2px; border-bottom: 1px solid var(--rule-strong); color: var(--muted); font-size: 11px; text-align: center; }
  .kv-col { overflow: hidden; color: var(--muted); font-size: 11px; text-align: center; white-space: nowrap; }
  .c { aspect-ratio: 1; border-radius: 2px; }
  .c.new { background: var(--accent); }
  .c.again { background: color-mix(in srgb, var(--text) 42%, transparent); }
  .c.cached { background: repeating-linear-gradient(135deg, var(--rule-strong) 0 1px, transparent 1px 3.5px); box-shadow: inset 0 0 0 1px var(--rule-strong); }
  .kv-no { color: var(--faint); font: 10px var(--font-mono); text-align: right; }
  .kv-out { padding-left: 4px; color: var(--accent-ink); font-size: 12px; white-space: nowrap; }
  .kv-grid .later { opacity: .12; }
  .kv-sum { margin: 10px 0 0; color: var(--muted); font-size: 12px; }
  .kv-sum b { margin: 0 3px; color: var(--text); font: 500 16px var(--font-mono); }
  .kv-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 18px 0 0; color: var(--muted); font-size: 12px; }
  .kv-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .kv-legend .c { width: 12px; }
  .kv-bar { display: flex; align-items: end; gap: 14px; margin-top: 14px; }
  .key { flex: none; min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .kv-controls { display: grid; flex: 1; min-width: 0; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; color: var(--muted); font-size: 13px; }
  .kv-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .kv-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .kv-memory { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  @media (max-width: 620px) { .kv-grids { grid-template-columns: 1fr; } }
</style>
<section class="kv" aria-label="不用缓存，每次调用都把前面所有位置重算一遍，8 次调用共算 108 个位置；有 KV cache，每次只算一个新位置，共 17 个">
  <div class="kv-grids">
    <div><p class="kv-title">每次从头算</p><div class="kv-grid" data-mode="full"></div><p class="kv-sum" data-sum="full"></p></div>
    <div><p class="kv-title">有 KV cache</p><div class="kv-grid" data-mode="cache"></div><p class="kv-sum" data-sum="cache"></p></div>
  </div>
  <div class="kv-legend">
    <span><i class="c new"></i>新算</span><span><i class="c again"></i>重算</span><span><i class="c cached"></i>读缓存</span>
  </div>
  <div class="kv-bar">
    <label class="kv-controls">调用次数<output></output><input type="range" min="1" max="8" value="8" aria-label="调用次数" /></label>
    <button class="key play" type="button">播放</button>
  </div>
  <p class="kv-memory"></p>
</section>
<script>
const P = 10, outputs = ['叫', '它', '「', '橘', '座', '」', '怎么样', '？'];
const COLS = P + outputs.length - 1;
const root = document.querySelector('.kv');
const slider = root.querySelector('input');
function cellKind(mode, call, pos) {
  const last = P + call - 2;               // 这次调用新读入的位置
  if (call === 1) return pos < P ? 'new' : '';
  if (pos > last) return '';
  if (pos === last) return 'new';
  return mode === 'full' ? 'again' : 'cached';
}
function build(grid) {
  const mode = grid.dataset.mode, current = Number(slider.value);
  const parts = ['<span></span><span class="kv-prompt">提示词</span>'];
  for (let j = 0; j < outputs.length - 1; j++) parts.push(`<span class="kv-col" title="${outputs[j]}">${outputs[j][0]}</span>`);
  parts.push('<span></span>');
  for (let call = 1; call <= outputs.length; call++) {
    const later = call > current ? ' later' : '';
    parts.push(`<span class="kv-no${later}">${call}</span>`);
    for (let pos = 0; pos < COLS; pos++) parts.push(`<i class="c ${cellKind(mode, call, pos)}${later}"></i>`);
    parts.push(`<span class="kv-out${later}">→ ${outputs[call - 1]}</span>`);
  }
  grid.innerHTML = parts.join('');
}
function render() {
  const k = Number(slider.value);
  root.querySelectorAll('.kv-grid').forEach(build);
  let full = 0;
  for (let call = 1; call <= k; call++) full += P + call - 1;
  const cached = P + k - 1;
  root.querySelector('[data-sum="full"]').innerHTML = `累计算了<b>${full}</b>个位置`;
  root.querySelector('[data-sum="cache"]').innerHTML = `累计算了<b>${cached}</b>个位置`;
  root.querySelector('.kv-controls output').textContent = `${k} / ${outputs.length}`;
  root.querySelector('.kv-memory').textContent =
    `缓存里存着 ${cached} 个位置的 K、V；按 Llama-3.1-8B 算，每个位置 128 KiB，共 ${(cached * 128 / 1024).toFixed(2)} MiB`;
}
const playButton = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer = 0;
function stop() {
  clearInterval(timer);
  timer = 0;
  playButton.textContent = '播放';
}
function tick() {
  slider.value = Number(slider.value) + 1;
  render();
  if (Number(slider.value) >= outputs.length) stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (reduce) { slider.value = outputs.length; return render(); }
  slider.value = 1;
  render();
  playButton.textContent = '暂停';
  timer = setInterval(tick, 650);
});
slider.addEventListener('input', () => { stop(); render(); });
render();
</script>
```

看图里左右两边，不带缓存时每一行都要从头算起，总计算量按平方涨；开了 KV cache 以后，除了第一行要把提示词完整算一遍，后面每步只算当前这一个新位置，历史部分直接读缓存。哪怕只生成 8 个 token，差距就已经是 108 比 17，要是生成几千个，差距就会拉到上千倍。

读缓存同样要花时间，新位置在每一层仍要把前面所有位置的 K、V 过一遍，只是比重算便宜得多。更大的代价在显存上，每个位置、每一层都要常驻一份 K 和一份 V。以 Llama-3.1-8B 为例，它有 32 层，每层 8 组 KV 头（多头注意力把计算拆到多个头里各自进行），每头 128 维，BF16 下每个数占 2 字节，单个 token 的缓存就是

$$
2\times32\times8\times128\times2\ \text{B}=128\ \text{KiB}.
$$

8,192 个 token 的对话，光缓存就正好占掉 1 GiB 显存，而且只属于这一个请求。这还是省过的结果——Llama 3 用了 GQA（Grouped-Query Attention），让 32 个查询头共享 8 组 K 和 V，要是按标准多头注意力每个头各存一份，还得再乘 4。（这里换 Llama 举例是因为数字凑整。Qwen3-8B 多 4 层，同样算下来是 144 KiB。）

这个循环在遇到下面任一情况时停下：抽中结束标记 `<|im_end|>`，写满 `max_tokens`，碰到调用方设的停止字符串，或者用户点了“停止生成”、前端断开连接后服务端中止请求。

## 读得快，写得慢

到这里就可以回答开头那个问题了，为什么第一个字总要等一会儿，后面反倒走得比较匀速？

把一次请求的耗时沿时间轴展开。第一次前向要把整段输入一次性算完，才能产出第一个 token；从那以后，每次前向都只多算一个：

```render html title="理想化估算：H100、8B 模型、BF16，一个请求独占整张卡，不算排队和网络"
<style>
  .ttft { padding: 4px 0; font-size: 13px; font-variant-ligatures: none; }
  .ttft svg { display: block; width: 100%; overflow: visible; }
  .pre { fill: color-mix(in srgb, var(--text) 62%, transparent); }
  .dec { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1; }
  .dec.done { fill: var(--accent); }
  .axis { stroke: var(--rule-strong); }
  .tick { fill: var(--faint); font-family: var(--font-mono); font-size: 10px; }
  .head { stroke: var(--text); stroke-width: 1.5; }
  .ttft-legend { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .ttft-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .ttft-legend i { width: 14px; height: 10px; }
  .ttft-legend .pre-i { background: color-mix(in srgb, var(--text) 62%, transparent); }
  .ttft-legend .dec-i { background: var(--accent); }
  .ttft-screen { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid var(--rule); font-size: 16px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
  .ttft-screen .rest { visibility: hidden; }
  .caret { display: inline-block; width: 2px; height: 1.05em; vertical-align: -.15em; background: var(--accent); }
  .ttft-bar { display: flex; align-items: end; gap: 14px; margin-top: 10px; }
  .ttft-controls { display: grid; flex: 1; min-width: 0; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; color: var(--muted); }
  .ttft-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .ttft-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .key { flex: none; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
  .ttft-read { display: flex; flex-wrap: wrap; gap: 6px 26px; margin: 12px 0 0; color: var(--muted); }
  .ttft-read b { display: block; color: var(--text); font: 500 19px var(--font-mono); }
  .ttft-read .accent { color: var(--accent-ink); }
</style>
<section class="ttft" aria-label="一个请求的时间线：先用一次前向读完整段对话，读完才有第一个 token；之后每次前向写一个，间隔相同。提示词越长，首字越晚，后面的间隔不变">
  <div class="chart"></div>
  <div class="ttft-legend">
    <span><i class="pre-i"></i>读整段对话，一次前向</span><span><i class="dec-i"></i>写，每格一次前向、1 个 token</span>
  </div>
  <div class="ttft-screen" aria-hidden="true"></div>
  <div class="ttft-bar">
    <label class="ttft-controls">提示词长度<output></output><input type="range" min="0" max="6" value="4" aria-label="提示词长度" /></label>
    <button class="key play" type="button">慢放 20 倍</button>
  </div>
  <div class="ttft-read" aria-live="polite"></div>
</section>
<script>
const MEM = 16.06e9 / 3.35e12 * 1e3;      // 读一遍权重：毫秒
const PER = 2 * 8.03e9 / 989e12 * 1e3;    // 每个 token 的矩阵乘法：毫秒
const SLOW = 20, AXIS = 280;
const sizes = [128, 256, 512, 1024, 2048, 4096, 8192];
// 27 次前向各写出的字。空的四个：猫的前半个字符、两处 Markdown 星号、结束标记。
const pieces = ['叫', '它', '「', '橘', '座', '」', '怎么样', '？', '', '🐱', '\n\n', '', '橘', '座', '', '听起来', '就', '有', '大佬', '气场', '，', '正', '配', '它的', '饭量', '。', ''];
const root = document.querySelector('.ttft');
const slider = root.querySelector('input');
const playButton = root.querySelector('.play');
const page = root.querySelector('.ttft-screen');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = 0, clock = Infinity, raf = 0, began = 0;   // clock：慢放到第几毫秒；Infinity 是放完了

const prefill = () => Math.max(MEM, sizes[Number(slider.value)] * PER);
const arrive = k => prefill() + k * MEM;      // 第 k 个 token 出来的时刻，k 从 0 数
const fmt = v => v >= 100 ? v.toFixed(0) : v.toFixed(1);
const span = (className, text) => Object.assign(document.createElement('span'), { className, textContent: text });

function draw() {
  const W = width, f = v => v.toFixed(1);
  const X = ms => ms / AXIS * W;
  const n = sizes[Number(slider.value)], tp = prefill(), end = arrive(pieces.length - 1);
  const playing = clock !== Infinity, t = Math.min(clock, end);
  let svg = `<rect class="pre" x="0" y="8" width="${f(X(tp))}" height="32"/>`;
  for (let k = 1; k < pieces.length; k++) {
    const x0 = X(arrive(k - 1)), x1 = X(arrive(k));
    svg += `<rect class="dec${arrive(k) <= t ? ' done' : ''}" x="${f(x0 + 1)}" y="8.5" width="${f(Math.max(1, x1 - x0 - 2))}" height="31"/>`;
  }
  svg += `<line class="axis" x1="0" x2="${W}" y1="48" y2="48"/>`;
  for (const ms of W < 420 ? [0, 100, 200] : [0, 50, 100, 150, 200, 250]) {
    svg += `<line class="axis" x1="${f(X(ms))}" x2="${f(X(ms))}" y1="48" y2="53"/>`;
    svg += `<text class="tick" x="${f(X(ms))}" y="66" text-anchor="${ms ? 'middle' : 'start'}">${ms}${ms ? '' : ' ms'}</text>`;
  }
  if (playing) svg += `<line class="head" x1="${f(X(t))}" x2="${f(X(t))}" y1="2" y2="48"/>`;
  root.querySelector('.chart').innerHTML = `<svg viewBox="0 0 ${W} 70" height="70" role="img" aria-label="读 ${n} 个 token 用 ${fmt(tp)} 毫秒，之后每 ${fmt(MEM)} 毫秒写出一个">${svg}</svg>`;

  // 还没写出来的字也占着位置，只是看不见，这样播放时高度不跳。
  let shown = '', hidden = '';
  pieces.forEach((piece, k) => { if (arrive(k) <= t) shown += piece; else hidden += piece; });
  page.replaceChildren(span('', shown), ...(playing ? [span('caret', '')] : []), span('rest', hidden));

  root.querySelector('output').textContent = n.toLocaleString('en-US') + ' token';
  root.querySelector('.ttft-read').innerHTML =
    `<span>读 ${n.toLocaleString('en-US')} 个，首字<b>${fmt(tp)} ms</b></span>` +
    `<span>之后每写 1 个<b class="accent">${fmt(MEM)} ms</b></span>` +
    `<span>${pieces.length} 个写完<b>${fmt(end)} ms</b></span>`;
}

function finish() {
  cancelAnimationFrame(raf);
  raf = 0;
  clock = Infinity;
  playButton.textContent = '慢放 20 倍';
  draw();
}
function frame(ts) {
  if (!began) began = ts;
  clock = (ts - began) / SLOW;
  if (clock >= arrive(pieces.length - 1) + 12) return finish();
  draw();
  raf = requestAnimationFrame(frame);
}
playButton.addEventListener('click', () => {
  if (raf || reduce) return finish();
  began = 0;
  clock = 0;
  playButton.textContent = '停';
  draw();
  raf = requestAnimationFrame(frame);
});
slider.addEventListener('input', finish);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(root.querySelector('.chart'));
</script>
```

首字等的是前面那一整块，这一段叫 prefill；后面一格一个 token、每格基本一样宽的阶段叫 decode。平时常说的首字延迟（TTFT）量的是前一段，每秒输出多少 token 量的是后一段。线上的真实首字延迟会比图里长得多，因为还得算上网络、排队和同卡其他请求的影响。

把“提示词长度”滑块拖长，前面那块跟着拉长，后面 decode 的格子几乎没变宽。（严格说会宽一点，因为上下文越长，每步要读的缓存也越多，这笔账放下一节细算。）更有意思的是两段的比例，读 2,048 个 token 一共才花 33 ms，写 1 个却要 4.8 ms。同一个模型、同一套层，为什么写一个的时间差不多顶得上读三百个？

prefill 阶段的几千个 token 都是已知的，可以并排拼进同一次前向。网络每一层的核心运算都是拿权重矩阵去乘特征向量：权重从显存读出来一遍，就能顺带和并排的几千个向量一起做矩阵乘法。读一遍权重换来大量乘加运算，这正好是 GPU 最擅长的活，算力能跑满。

decode 时每次前向只有一个新位置，权重却还得完整读一遍，因为做矩阵乘向量时矩阵里的每个数都要用到，一个也跳不过。8B 模型在 BF16 下有 16 GB，为了算出这一个 token，GPU 得把 16 GB 权重从显存完整搬一趟，搬完却只做了很少的乘加。这一段死死卡在显存带宽上，算力大半闲着。

把一次前向处理的 token 数放横轴、单步耗时放纵轴，就能看出两段的转折：

```render html title="按 H100 SXM（3.35 TB/s，BF16 稠密 989 TFLOPS）和 8B 模型估算的理想上限，不含注意力和其他开销"
<style>
  .roof { --blue: #356f9b; padding: 4px 0; font-size: 13px; }
  :root[data-theme="dark"] .roof { --blue: #95bfdc; }
  .roof svg { display: block; width: 100%; overflow: visible; }
  .grid-line { stroke: var(--rule); }
  .tick { fill: var(--faint); font-family: var(--font-mono); font-size: 10px; }
  .axis-title { fill: var(--muted); font-size: 11px; }
  .zone { fill: var(--muted); font-size: 12px; }
  .zone-bg { fill: var(--surface); opacity: .55; }
  .knee { stroke: var(--rule-strong); stroke-dasharray: 3 4; }
  .pass { fill: none; stroke: var(--accent); stroke-width: 2.4; }
  .per { fill: none; stroke: var(--blue); stroke-width: 2; stroke-dasharray: 6 4; }
  .curve-label { font-size: 12px; }
  .mark { fill: var(--bg); stroke: var(--text); stroke-width: 1.4; }
  .mark-label { fill: var(--text); font-size: 11.5px; }
  .now { stroke: var(--accent-ink); stroke-width: 1; }
  .dot-pass { fill: var(--accent); }
  .dot-per { fill: var(--blue); }
  .roof-read { display: flex; flex-wrap: wrap; gap: 6px 26px; margin: 12px 0 0; color: var(--muted); }
  .roof-read b { display: block; color: var(--text); font: 500 19px var(--font-mono); }
  .roof-read .accent { color: var(--accent-ink); }
  .roof-read .blue { color: var(--blue); }
  .roof-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; margin-top: 12px; color: var(--muted); }
  .roof-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .roof-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
</style>
<section class="roof" aria-label="一次前向的耗时：塞 1 个 token 和塞 200 个都要约 4.8 毫秒，因为都得把 16 GB 权重读一遍；超过约 300 个，耗时才随 token 数增长">
  <div class="chart"></div>
  <label class="roof-controls">一次前向里的 token 数<output></output><input type="range" min="0" max="1300" step="1" value="600" aria-label="一次前向里的 token 数" /></label>
  <div class="roof-read" aria-live="polite"></div>
</section>
<script>
const MEM = 16.06e9 / 3.35e12 * 1e3;        // 读一遍权重：毫秒
const PER = 2 * 8.03e9 / 989e12 * 1e3;      // 每个 token 的矩阵乘法：毫秒
const KNEE = MEM / PER;
const pass = n => Math.max(MEM, n * PER);
const root = document.querySelector('.roof');
const slider = root.querySelector('input');
let width = 0;
const tokens = () => Math.round(2 ** (Number(slider.value) / 100));
const fmt = v => v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= .1 ? v.toFixed(3) : v.toFixed(4);

function draw() {
  const W = width, narrow = W < 480, H = narrow ? 230 : 260;
  const left = 40, right = narrow ? 8 : 16, top = 26, bottom = 30, plotW = W - left - right, plotH = H - top - bottom;
  const X = n => left + Math.log2(n) / 13 * plotW;
  const Y = ms => top + (2.5 - Math.log10(ms)) / 4.5 * plotH;
  const f = v => v.toFixed(1);
  const n = tokens(), current = pass(n);
  let svg = `<rect class="zone-bg" x="${f(X(KNEE))}" y="${top}" width="${f(X(8192) - X(KNEE))}" height="${plotH}"/>`;
  for (const ms of [.01, .1, 1, 10, 100]) svg += `<line class="grid-line" x1="${left}" x2="${W - right}" y1="${f(Y(ms))}" y2="${f(Y(ms))}"/><text class="tick" x="${left - 6}" y="${f(Y(ms) + 3)}" text-anchor="end">${ms}</text>`;
  for (const t of narrow ? [1, 16, 256, 4096] : [1, 4, 16, 64, 256, 1024, 4096]) svg += `<text class="tick" x="${f(X(t))}" y="${H - 12}" text-anchor="middle">${t}</text>`;
  svg += `<text class="axis-title" x="${left - 6}" y="12" text-anchor="end">ms</text>`;
  svg += `<text class="zone" x="${left + 6}" y="${top + 16}">带宽受限</text><text class="zone" x="${W - right - 6}" y="${top + 16}" text-anchor="end">算力受限</text>`;
  svg += `<line class="knee" x1="${f(X(KNEE))}" x2="${f(X(KNEE))}" y1="${top}" y2="${top + plotH}"/><text class="tick" x="${f(X(KNEE) + 5)}" y="${f(Y(.25))}">≈${Math.round(KNEE)}</text>`;
  const samples = Array.from({ length: 131 }, (_, i) => 2 ** (i / 10));
  svg += `<polyline class="pass" points="${samples.map(s => f(X(s)) + ',' + f(Y(pass(s)))).join(' ')}"/>`;
  svg += `<polyline class="per" points="${samples.map(s => f(X(s)) + ',' + f(Y(pass(s) / s))).join(' ')}"/>`;
  if (W >= 400) svg += `<text class="curve-label" x="${f(X(narrow ? 8 : 6))}" y="${f(Y(MEM) - 9)}" fill="var(--accent-ink)">一次前向</text>`;
  svg += `<text class="curve-label" x="${f(X(1.15))}" y="${f(Y(.03))}" fill="var(--blue)">摊到每个 token</text>`;
  const marks = [[1, 'decode', 'start', -10], [64, '64 人一批', 'start', -10],
    narrow ? [2000, 'prefill', 'start', 4] : [2000, 'prefill 2,000', 'end', -10]];
  for (const [m, name, anchor, dy] of marks) {
    svg += `<circle class="mark" cx="${f(X(m))}" cy="${f(Y(pass(m)))}" r="3.5"/><text class="mark-label" x="${f(X(m) + (anchor === 'end' ? -6 : 7))}" y="${f(Y(pass(m)) + dy)}" text-anchor="${anchor}">${name}</text>`;
  }
  svg += `<line class="now" x1="${f(X(n))}" x2="${f(X(n))}" y1="${top}" y2="${top + plotH}"/>`;
  svg += `<circle class="dot-pass" cx="${f(X(n))}" cy="${f(Y(current))}" r="4.5"/><circle class="dot-per" cx="${f(X(n))}" cy="${f(Y(current / n))}" r="4"/>`;
  root.querySelector('.chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="塞 ${n} 个 token 时，一次前向约 ${fmt(current)} 毫秒">${svg}</svg>`;
  root.querySelector('output').textContent = n.toLocaleString('en-US');
  root.querySelector('.roof-read').innerHTML =
    `<span>一次前向<b class="accent">${fmt(current)} ms</b></span>` +
    `<span>摊到每个 token<b class="blue">${fmt(current / n)} ms</b></span>` +
    `<span>算力用上了<b>${Math.round(n * PER / current * 100)}%</b></span>`;
}
slider.addEventListener('input', draw);
new ResizeObserver(([entry]) => {
  const w = Math.floor(entry.contentRect.width);
  if (w !== width) { width = w; draw(); }
}).observe(root.querySelector('.chart'));
</script>
```

左半段几乎是平的，塞 1 个 token 和塞 100 个都得先把 16 GB 权重读一遍，耗时都在 4.8 ms 左右。直到越过拐点（大约 300 个 token），计算时间超过搬运时间，算力成为瓶颈，耗时才开始随数量往上涨。

摊到每个 token 上，读平均不到 0.02 ms，写却要 4.8 ms，差了将近 300 倍。各家 API 的输出单价普遍是输入的好几倍，背后的成本结构就在这里。至于定价倍数远没有 300 那么大，主要因为服务端可以通过批处理让很多人共同分摊 decode 阶段的权重读取成本。

单个请求的生成速度也因此有个硬上限。一张 H100 跑 BF16 的 8B 模型，理论极限大概每秒 200 来个 token，量化到 8 位让权重小一半，上限才能翻倍。想再快，要么把模型切到多张卡上并行读权重，要么用投机解码，先让一个小模型往后猜几个 token，再交给大模型做一次前向一起验算——几个 token 并排验证同样落在曲线平坦段，几乎不多花时间就一次过完了。

## 一块显卡，很多人

上面那张图的左半边同时也藏着个好消息：既然塞 1 个 token 和塞 64 个耗时差不多，那就把 64 个用户各自的下一个 token 拼进同一次前向。权重依然只读一遍，64 个人却能同时往前走一步，这就是推理服务的批处理。

不过回复有长有短。如果凑齐一批、等最长的那个写完再换下一批，短请求早早结束，槽位就只能空在那里陪跑。所以现代推理框架普遍改成了按步调度，每走完一步，只要有请求写完离开，腾出来的槽位下一步就立刻补进排队的新请求。同一张卡开 4 个槽位处理 10 个长短不一的请求，两种排法可以对比看看：

```render html title="示意：一列是一次前向，在场的请求各写 1 个 token；新请求进场时的 prefill 没画"
<style>
  .cb { padding: 4px 0; font-size: 13px; font-variant-ligatures: none; }
  .cb-panel + .cb-panel { margin-top: 18px; }
  .cb-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 12px; margin-bottom: 6px; color: var(--muted); }
  .cb-head > b { color: var(--text); font-size: 14px; font-weight: 650; }
  .cb-head span b, .cb-sum b { color: var(--text); font: 600 14px var(--font-mono); }
  .cb-grid { display: grid; grid-template-columns: repeat(25, minmax(0, 1fr)); grid-template-rows: repeat(4, 20px) auto; row-gap: 3px; }
  .req { min-width: 0; margin: 0 1px; padding-left: 3px; overflow: hidden; border-radius: 3px; background: var(--accent); color: var(--bg); font: 600 11px/20px var(--font-mono); }
  .idle { margin: 0 1px; background: repeating-linear-gradient(135deg, var(--rule-strong) 0 1px, transparent 1px 4px); box-shadow: inset 0 0 0 1px var(--rule); }
  .curtain { grid-row: 1 / span 4; background: var(--bg); opacity: .88; }
  .cb-grid small { grid-row: 5; justify-self: end; color: var(--faint); font: 10px var(--font-mono); white-space: nowrap; }
  .cb-sum { margin: 2px 0 0; color: var(--muted); font-size: 12.5px; }
  .cb-legend { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 14px 0 0; color: var(--muted); font-size: 12px; }
  .cb-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .cb-legend i { width: 14px; height: 10px; margin: 0; }
  .cb-legend .req-i { border-radius: 2px; background: var(--accent); }
  .cb-bar { display: flex; align-items: end; gap: 14px; margin-top: 10px; }
  .cb-controls { display: grid; flex: 1; min-width: 0; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; color: var(--muted); }
  .cb-controls output { color: var(--text); font: 13px var(--font-mono); text-align: right; }
  .cb-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .key { flex: none; min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover { border-color: var(--text); }
</style>
<section class="cb" aria-label="4 个位置、10 个长短不一的请求：整批写完再换要 25 步，空转 46 格；按步调度只要 15 步，空转 6 格">
  <div class="cb-panel" data-plan="batch">
    <div class="cb-head"><b>整批写完再换</b><span class="cb-now"></span></div>
    <div class="cb-grid"></div>
    <p class="cb-sum"></p>
  </div>
  <div class="cb-panel" data-plan="step">
    <div class="cb-head"><b>按步调度</b><span class="cb-now"></span></div>
    <div class="cb-grid"></div>
    <p class="cb-sum"></p>
  </div>
  <div class="cb-legend"><span><i class="req-i"></i>在写</span><span><i class="idle"></i>位置空着</span></div>
  <div class="cb-bar">
    <label class="cb-controls">走到第几步<output></output><input type="range" min="0" max="25" value="25" aria-label="走到第几步" /></label>
    <button class="key play" type="button">播放</button>
  </div>
</section>
<script>
const SLOTS = 4, COLS = 25;
// 请求按到达顺序排队，数字是回复有多少个 token。
const reqs = [['A', 3], ['B', 9], ['C', 5], ['D', 2], ['E', 7], ['F', 4], ['G', 10], ['H', 3], ['I', 6], ['J', 5]];

// 整批：4 个一批，最长的那个写完才换下一批。
function batchPlan() {
  const out = [];
  let start = 0;
  for (let i = 0; i < reqs.length; i += SLOTS) {
    const batch = reqs.slice(i, i + SLOTS);
    batch.forEach(([name, len], slot) => out.push({ name, slot, start, len }));
    start += Math.max(...batch.map(([, len]) => len));
  }
  return out;
}
// 按步：哪个位置最先空出来，排在最前面的请求就进哪个。
function stepPlan() {
  const out = [], free = Array(SLOTS).fill(0);
  for (const [name, len] of reqs) {
    let slot = 0;
    for (let s = 1; s < SLOTS; s++) if (free[s] < free[slot]) slot = s;
    out.push({ name, slot, start: free[slot], len });
    free[slot] += len;
  }
  return out;
}
const plans = { batch: batchPlan(), step: stepPlan() };
const root = document.querySelector('.cb');
const slider = root.querySelector('input');
const playButton = root.querySelector('.play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer = 0;

function build(panel) {
  const plan = plans[panel.dataset.plan], t = Number(slider.value);
  const total = Math.max(...plan.map(r => r.start + r.len));
  const parts = [];
  for (let slot = 0; slot < SLOTS; slot++)
    for (let c = 0; c < total; c++)
      if (!plan.some(r => r.slot === slot && c >= r.start && c < r.start + r.len))
        parts.push(`<i class="idle" style="grid-row:${slot + 1};grid-column:${c + 1}"></i>`);
  for (const r of plan)
    parts.push(`<span class="req" style="grid-row:${r.slot + 1};grid-column:${r.start + 1} / span ${r.len}">${r.name}</span>`);
  for (let c = 5; c <= COLS; c += 5) parts.push(`<small style="grid-column:${c}">${c}</small>`);
  if (t < COLS) parts.push(`<i class="curtain" style="grid-column:${t + 1} / -1"></i>`);
  panel.querySelector('.cb-grid').innerHTML = parts.join('');
  const done = plan.filter(r => r.start + r.len <= t).length, waiting = plan.filter(r => r.start > t).length;
  const used = plan.reduce((sum, r) => sum + r.len, 0);
  panel.querySelector('.cb-now').innerHTML = `写完 <b>${done}</b> / ${plan.length} · 排队 <b>${waiting}</b>`;
  panel.querySelector('.cb-sum').innerHTML = `共 <b>${total}</b> 步，空转 <b>${SLOTS * total - used}</b> 格`;
}
function render() {
  root.querySelectorAll('.cb-panel').forEach(build);
  root.querySelector('.cb-controls output').textContent = `${slider.value} / ${COLS}`;
}
function stop() {
  clearInterval(timer);
  timer = 0;
  playButton.textContent = '播放';
}
function tick() {
  slider.value = Number(slider.value) + 1;
  render();
  if (Number(slider.value) >= COLS) stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (reduce) { slider.value = COLS; return render(); }
  slider.value = 0;
  render();
  playButton.textContent = '暂停';
  timer = setInterval(tick, 260);
});
slider.addEventListener('input', () => { stop(); render(); });
render();
</script>
```

静态批处理那一行，D 写了 2 个 token 就完事，它的槽位却得干等 7 步，直到同批最长的 B 写完，整整 25 步里空转了 46 格。换成按步调度后，D 一走 E 就顶进来，全部写完只要 15 步，空槽只剩最后收尾那 6 格。在线上使用时，你的请求多半一直和一群陌生人挤在同一个批次里，每前进一步，同批成员都在动态进出。

同批里塞了多少请求，有时甚至会影响你拿到的回复。哪怕把温度设成 0，线上 API 也未必每次一字不差。原因在于浮点加法不满足结合律，求和顺序一变，尾数就可能出现微小差异，而批次大小的变化恰恰会改变 GPU 算子的切分和求和顺序——Thinking Machines 在 2025 年专门写文分析过这件事。分数差出那么一点点，碰上两个候选本来就很接近，就够让排第一的换人。

批次能开多大，主要受限于显存。每个在跑的请求都占着自己的 KV cache，而且每走一步，除了读权重，还得把同批各自的缓存也全读一遍。可以动一下滑块看看这笔显存账：

```render html title="H100 80 GB 跑 Llama-3.1-8B（BF16）的理想化估算；权重之外另留 6 GB 给激活和运行时"
<style>
  .ledger { --blue: #356f9b; --blue-soft: #d7e4ee; padding: 4px 0; font-size: 13px; }
  :root[data-theme="dark"] .ledger { --blue: #95bfdc; --blue-soft: #263540; }
  .ledger-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 30px; }
  .ledger-controls label { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; align-items: center; color: var(--muted); }
  .ledger-controls output { color: var(--text); font: 14px var(--font-mono); text-align: right; }
  .ledger-controls input { grid-column: 1 / -1; width: 100%; min-height: 36px; margin: 0; accent-color: var(--accent); }
  .meter { margin-top: 18px; }
  .meter-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; color: var(--muted); }
  .meter-head b { color: var(--accent-ink); font-weight: 500; }
  .track { display: flex; height: 26px; overflow: hidden; border-radius: 3px; box-shadow: inset 0 0 0 1px var(--rule-strong); }
  .track > i { flex: none; height: 100%; }
  .w { background: color-mix(in srgb, var(--text) 70%, transparent); }
  .o { background: repeating-linear-gradient(135deg, var(--rule-strong) 0 1px, transparent 1px 4px); }
  .k { background: var(--blue); box-shadow: inset -1px 0 0 var(--bg); }
  .k.solid { box-shadow: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 7px; color: var(--muted); font-size: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 10px; height: 10px; border-radius: 2px; }
  .legend b { color: var(--text); font: 500 12px var(--font-mono); }
  .speeds { display: flex; flex-wrap: wrap; gap: 8px 32px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--rule); color: var(--muted); }
  .speeds b { display: block; color: var(--text); font: 500 22px var(--font-mono); }
  .speeds b.accent { color: var(--accent-ink); }
  @media (max-width: 520px) { .ledger-controls { grid-template-columns: 1fr; } }
</style>
<section class="ledger" aria-label="一张 80 GB 的卡：32 个请求、每个 4K 上下文时，每一步要读 16 GB 权重加 17 GB 缓存，约 10 毫秒；上下文拉到 128K，只放得下 3 个请求">
  <div class="ledger-controls">
    <label>同时生成的请求<output class="b-out"></output><input class="b" type="range" min="0" max="9" value="5" aria-label="同时生成的请求数" /></label>
    <label>每个请求的上下文<output class="c-out"></output><input class="c" type="range" min="0" max="7" value="2" aria-label="每个请求的上下文长度" /></label>
  </div>
  <div class="meter">
    <div class="meter-head"><span>显存 80 GB</span><span class="fit"></span></div>
    <div class="track memory"></div>
    <div class="legend memory-legend"></div>
  </div>
  <div class="meter">
    <div class="meter-head"><span>每走一步要读的数据，按 3.35 TB/s 折成时间</span></div>
    <div class="track time"></div>
    <div class="legend time-legend"></div>
  </div>
  <div class="speeds" aria-live="polite"></div>
</section>
<script>
const GB = 1e9, BW = 3.35e12, FLOPS = 989e12, PARAMS = 8.03e9;
const WEIGHTS = PARAMS * 2, OTHER = 6 * GB, TOTAL = 80 * GB, KV = 131072;
const BUDGET = TOTAL - WEIGHTS - OTHER;
const batches = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const contexts = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];
const root = document.querySelector('.ledger');
const [bInput, cInput] = root.querySelectorAll('input');
const seg = (cls, value, total, title) => `<i class="${cls}" style="width:${value / total * 100}%" title="${title}"></i>`;
const num = v => v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 1 : 0 });

function render() {
  const B = batches[bInput.value], c = contexts[cInput.value];
  const perRequest = c * KV, active = Math.min(B, Math.floor(BUDGET / perRequest)), waiting = B - active;
  const kv = active * perRequest;
  const readWeights = WEIGHTS / BW * 1e3, readCache = kv / BW * 1e3, compute = 2 * PARAMS * active / FLOPS * 1e3;
  const step = Math.max(readWeights + readCache, compute);
  root.querySelector('.b-out').textContent = B;
  root.querySelector('.c-out').textContent = c >= 1024 ? c / 1024 + 'K' : c;
  root.querySelector('.fit').innerHTML = waiting ? `只放得下 <b>${active}</b> 个，<b>${waiting}</b> 个排队` : '';
  const kvCells = active <= 64
    ? Array.from({ length: active }, () => seg('k', perRequest, TOTAL, '一个请求的 KV cache')).join('')
    : seg('k solid', kv, TOTAL, 'KV cache');
  root.querySelector('.memory').innerHTML = seg('w', WEIGHTS, TOTAL, '权重') + seg('o', OTHER, TOTAL, '其他') + kvCells;
  root.querySelector('.memory-legend').innerHTML =
    `<span><i class="w"></i>权重 <b>${num(WEIGHTS / GB)} GB</b></span><span><i class="o"></i>其他 <b>6 GB</b></span>` +
    `<span><i class="k"></i>KV cache <b>${num(kv / GB)} GB</b></span><span>空闲 <b>${num((TOTAL - WEIGHTS - OTHER - kv) / GB)} GB</b></span>`;
  const scale = 24;
  root.querySelector('.time').innerHTML = seg('w', readWeights, scale, '读权重') + seg('k solid', readCache, scale, '读缓存');
  root.querySelector('.time-legend').innerHTML =
    `<span><i class="w"></i>读权重 <b>${readWeights.toFixed(1)} ms</b></span><span><i class="k"></i>读缓存 <b>${readCache.toFixed(1)} ms</b></span>` +
    `<span>真正的乘加只要 <b>${compute.toFixed(compute < 1 ? 2 : 1)} ms</b></span>`;
  root.querySelector('.speeds').innerHTML =
    `<span>每个人<b class="accent">${num(1000 / step)} token/s</b></span>` +
    `<span>整张卡<b>${num(active * 1000 / step)} token/s</b></span>` +
    `<span>每一步<b>${step.toFixed(1)} ms</b></span>`;
}
bInput.addEventListener('input', render);
cInput.addEventListener('input', render);
render();
</script>
```

默认是 32 个并发请求、每个 4K 上下文。每走一步要读 16 GB 权重加 17 GB 缓存，约 10 ms，单用户每秒 100 个 token，整张卡总吞吐能到每秒 3,200 多个。把“同时生成的请求”拖到 1，单用户确实快了一倍，但整张卡闲得只剩每秒 200 个——这就是推理服务一定要拼批次的原因。

再把“每个请求的上下文”拖到 128K，光是一个请求的缓存就要占 17 GB，80 GB 的显卡最多只放得下 3 个人，其余全在排队，而且每步大半时间都耗在搬运缓存上，算力几乎派不上用场。高峰期变慢，通常是同批人数变多、单步要读的缓存跟着涨；长上下文更贵，则是因为一个请求就占掉了原本能给几十个人用的显存空间。

推理框架针对这笔显存账想了不少办法。vLLM 的 PagedAttention 借鉴了操作系统的内存分页思路，把 KV cache 切成固定大小的块按需分配，不再需要提前预留一大段连续显存，内存碎片少了，同一张卡就能多塞不少请求。

另一个实用办法是前缀缓存。单向注意力决定了某个位置的 K、V 只取决于它自己和前面的 token，所以两个请求只要开头相同，那一段的 K、V 就一模一样，算过一遍就能直接复用。像高频共用的系统提示词、或者同一段多轮对话历史，都很适合这么做。

回到第一节那张多轮增长图，每一轮发出去的斜纹部分，正好就是上一轮的输入接上一轮的回复。这些位置的 K、V 上一轮都已经算过，服务端只要还留着，新一轮 prefill 就只需要算新发的那 40 个 token。现在不少 API 给“缓存命中的输入”单独定了低价，省下来的正是这部分重算。

前面的格子图没画 prefill，实际调度时的麻烦恰恰出在它身上：新请求的 prefill 和老请求的 decode 抢同一张卡。一个几万 token 的长 prefill 插进来，同批所有人等下一个字时都会跟着卡一下。针对这种干扰，有的系统把长 prefill 切成小块穿插在 decode 之间做，也有的干脆把 prefill 和 decode 拆到不同的机器上跑。

## 思考和工具：同一个循环多转几圈

现在很多模型在回答之前会先“思考”。这并没有什么特殊的底层算法，依然是同一个自回归循环，只是先让模型写一段内部草稿。Qwen3 用 `<think>` 和 `</think>` 把草稿包起来，界面再把这段折叠或隐藏。

打草稿之所以管用，根源还是自回归。只有写进上下文里的中间步骤，后面的注意力层才读得到；不写出来的话，一整步复杂推理就只能硬挤在单次前向的几十层里做完。

所以思考模型让人觉得首字慢，多半不是慢在 prefill，而是慢在 decode：在你看到正文第一个字之前，它已经在后台写了几百上千个隐藏 token，而且这些草稿一样按输出计费。反过来，Qwen3 关闭思考的办法也很直白，聊天模板直接在 `assistant` 后面替它填好了一段空的思考标签：

```text
<|im_start|>assistant
<think>

</think>

```

模型读到已经闭合的思考区块，就会直接开始回答。程序能预先替模型写好开头，靠的还是同一件事：模型眼里只有一篇文档，程序停在哪里，它就从哪里往下续写。

工具调用也是同一套路子。问它“深圳今天要带伞吗”，模型自己联不了网，只能按约定格式写出一段调用指令。下面是整篇文档跑完后的样子，左侧的竖条按颜色区分了每一段分别来自程序、用户、模型还是天气接口，点“重放”可以从第一次请求一步步看：

```render html title="Qwen 系列的工具调用格式，系统提示有删节"
<style>
  .tools { --blue: #356f9b; padding: 4px 0; font-size: 13px; font-variant-ligatures: none; }
  :root[data-theme="dark"] .tools { --blue: #95bfdc; }
  .tools-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px 16px; margin-bottom: 12px; }
  .tools-state { margin: 0; color: var(--text); font-size: 14px; }
  .tools-state span { margin-right: 8px; color: var(--muted); font: 13px var(--font-mono); }
  .keys { display: flex; gap: 8px; }
  .key { min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .who { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 12px; color: var(--muted); font-size: 12px; }
  .who span { display: inline-flex; align-items: center; gap: 6px; }
  .who i { width: 3px; height: 14px; }
  .doc { display: grid; gap: 4px; }
  .block { position: relative; padding: 4px 0 4px 14px; border-left: 3px solid; color: var(--text); font: 12.5px/1.75 var(--font-mono); font-variant-ligatures: none; white-space: pre-wrap; overflow-wrap: anywhere; }
  .block.app { border-color: var(--rule-strong); color: var(--muted); }
  .block.user { border-color: var(--text); }
  .block.model { border-color: var(--accent); color: var(--accent-ink); }
  .block.tool { border-color: var(--blue); color: var(--blue); }
  .block.fresh { background: color-mix(in srgb, var(--accent-soft) 70%, transparent); }
  .app-i { background: var(--rule-strong); } .user-i { background: var(--text); } .model-i { background: var(--accent); } .tool-i { background: var(--blue); }
</style>
<section class="tools" aria-label="一次工具调用的整篇文档：模型只写了那段调用和最后的回答，工具说明、查到的天气和每一段的开头都是程序接上去的">
  <div class="tools-top">
    <p class="tools-state" aria-live="polite"></p>
    <div class="keys">
      <button class="key prev" type="button" aria-label="上一步">‹</button>
      <button class="key next" type="button" aria-label="下一步">›</button>
      <button class="key play" type="button">重放</button>
    </div>
  </div>
  <p class="who"><span><i class="app-i"></i>程序</span><span><i class="user-i"></i>用户</span><span><i class="model-i"></i>模型</span><span><i class="tool-i"></i>天气接口</span></p>
  <div class="doc"></div>
</section>
<script>
const blocks = [
  [0, 'app', `<|im_start|>system
# Tools
…
<tools>
{"type": "function", "function": {"name": "get_weather", "description": "查询城市当天的天气", …}}
</tools>
…<|im_end|>`],
  [0, 'user', `<|im_start|>user
深圳今天要带伞吗？<|im_end|>`],
  [0, 'app', `<|im_start|>assistant`],
  [1, 'model', `<tool_call>
{"name": "get_weather", "arguments": {"city": "深圳"}}
</tool_call><|im_end|>`],
  [2, 'app', `<|im_start|>user
<tool_response>`],
  [2, 'tool', `{"city": "深圳", "weather": "雷阵雨", "rain_probability": 0.8}`],
  [2, 'app', `</tool_response><|im_end|>
<|im_start|>assistant`],
  [3, 'model', `要带。深圳今天有雷阵雨，降雨概率 80%，出门记得拿伞。<|im_end|>`],
];
const states = ['程序发出第 1 次请求', '模型写出一段调用，停下', '程序去查天气，把结果接上', '程序发出第 2 次请求，模型作答'];
const root = document.querySelector('.tools');
const [prev, next, playButton] = root.querySelectorAll('button');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LAST = states.length - 1;
let state = LAST, timer = 0;
function render() {
  root.querySelector('.tools-state').innerHTML = `<span>${state + 1} / ${states.length}</span>${states[state]}`;
  root.querySelector('.doc').replaceChildren(...blocks.filter(([at]) => at <= state).map(([at, who, text]) => {
    const div = document.createElement('div');
    div.className = `block ${who}${at === state && state > 0 ? ' fresh' : ''}`;
    div.textContent = text;
    return div;
  }));
  prev.disabled = state === 0;
  next.disabled = state === LAST;
}
function stop() {
  clearTimeout(timer);
  timer = 0;
  playButton.textContent = '重放';
}
function advance() {
  state++;
  render();
  if (state < LAST) timer = setTimeout(advance, 1600);
  else stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (reduce) { state = LAST; return render(); }
  state = 0;
  render();
  playButton.textContent = '暂停';
  timer = setTimeout(advance, 1600);
});
prev.addEventListener('click', () => { stop(); state--; render(); });
next.addEventListener('click', () => { stop(); state++; render(); });
render();
</script>
```

模型知道有哪些工具可用、调用该怎么写，是因为程序提前把工具说明写进了最上面的系统提示里。

等它写完 `</tool_call>` 和 `<|im_end|>`，第一次请求就结束了。真去查天气的是外部程序，它解析出函数名和参数去调天气接口，拿到结果后包进 `<tool_response>` 拼到文档末尾，再发起下一次请求。对模型来说这又是一整趟 prefill 和 decode，只是前面大半段都能命中前缀缓存。

整篇文档里，真正由模型写出来的只有橙色标出的那两段。大家常说的 Agent，就是把这个“模型写调用、程序执行、结果拼回去再请求”的循环一直转下去，直到模型决定不再调工具而直接作答。

## 回到屏幕

每抽完一个 token，服务端就要把它解码回文字。字节级 BPE 词表里存的是原始字节串，按 UTF-8 拼起来才是字符，麻烦在于单个 token 未必对应完整的字。生僻字和不少表情在词表里没被完整合并过，会被拆成连续几个 token。只收到前一半字节时，解码器没法直接转成合法字符，只能先暂存着，等后续 token 把剩余字节补齐再一起输出。

开头慢放里第 9 步就是这么回事。那个 token 只包含 🐱 的前三个 UTF-8 字节，所以屏幕上什么也没多出来；直到第 10 步的 `b1` 到了，才完整显示出这只猫。

```render html title="假设 🐱 在词表里被拆成了两个 token；字节解码用的是浏览器自带的 TextDecoder"
<style>
  .stream { --blue: #356f9b; padding: 4px 0; font-size: 13px; font-variant-ligatures: none; }
  :root[data-theme="dark"] .stream { --blue: #95bfdc; }
  .stream-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px 16px; margin-bottom: 8px; }
  .stream-count { margin: 0; color: var(--muted); }
  .stream-count b { margin: 0 4px; color: var(--text); font: 500 20px var(--font-mono); }
  .keys { display: flex; gap: 8px; }
  .key { min-width: 44px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--bg-raised); box-shadow: 0 2px 0 var(--rule); color: var(--text); font-size: 13px; cursor: pointer; }
  .key:hover:not(:disabled) { border-color: var(--text); }
  .key:disabled { cursor: default; opacity: .4; }
  .lane { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 14px; padding: 11px 0; border-top: 1px solid var(--rule); }
  .lane > span { padding-top: 2px; color: var(--muted); font-size: 12px; }
  .bytes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 28px; }
  .byte { padding: 2px 6px; border: 1px solid var(--rule-strong); border-radius: 4px; font: 12px var(--font-mono); }
  .byte.held { border-style: dashed; border-color: var(--accent); color: var(--accent-ink); }
  .bytes .note { color: var(--muted); }
  .bytes .tokname { margin-right: 6px; padding: 0 6px; border-bottom: 2px solid var(--accent); color: var(--accent-ink); font-size: 15px; white-space: pre; }
  .bytes .tokname.mono { font: 12px var(--font-mono); font-variant-ligatures: none; }
  .frames { display: grid; gap: 2px; min-height: 66px; font: 12px/1.7 var(--font-mono); overflow-wrap: anywhere; }
  .frames div { color: var(--faint); }
  .frames div:last-child { color: var(--blue); }
  .frames div.skip { color: var(--muted); font-family: var(--font-sans); }
  .screen { min-height: 3.5em; font-size: 16px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
  .screen strong { font-weight: 650; }
  .caret { display: inline-block; width: 2px; height: 1.05em; margin-left: 2px; vertical-align: -.15em; background: var(--accent); }
  @media (max-width: 460px) { .lane { grid-template-columns: 1fr; gap: 6px; } }
</style>
<section class="stream" aria-label="每个 token 先变成字节，凑成完整的字才发一个事件；猫的表情被拆成两个 token，前三个字节到了以后解码器先攒着，这一步什么也不发">
  <div class="stream-top">
    <p class="stream-count" aria-live="polite"></p>
    <div class="keys">
      <button class="key prev" type="button" aria-label="上一个 token">‹</button>
      <button class="key next" type="button">下一个 ›</button>
      <button class="key play" type="button">播放</button>
    </div>
  </div>
  <div class="lane"><span>token</span><div class="bytes now"></div></div>
  <div class="lane"><span>解码器</span><div class="bytes held-out"></div></div>
  <div class="lane"><span>SSE</span><div class="frames"></div></div>
  <div class="lane"><span>屏幕</span><div class="screen"></div></div>
</section>
<script>
const END = '<|im_end|>';
const tokens = ['叫', '它', '「', '橘', '座', '」', '怎么样', '？', [0xf0, 0x9f, 0x90], [0xb1], '\n\n', '**', '橘', '座', '**',
  '听起来', '就', '有', '大佬', '气场', '，', '正', '配', '它的', '饭量', '。', END];
const encoder = new TextEncoder();
const bytesOf = t => Array.isArray(t) ? t : t === END ? [] : [...encoder.encode(t)];
const hex = b => b.toString(16).padStart(2, '0');
const root = document.querySelector('.stream');
const [prev, next, playButton] = root.querySelectorAll('button');
let step = 9, timer = 0;

// 从头重放到第 step 个 token：记下每一步解码器吐出的文字，以及还压在缓冲里的字节。
function replay(n) {
  const decoder = new TextDecoder();
  const frames = [];
  let text = '', pending = [];
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t === END) {
      frames.push('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}', 'data: [DONE]');
      continue;
    }
    const b = bytesOf(t), out = decoder.decode(Uint8Array.from(b), { stream: true });
    pending = out ? [] : pending.concat(b);
    if (out) {
      text += out;
      frames.push('data: ' + JSON.stringify({ choices: [{ delta: { content: out } }] }));
    } else frames.push(null);
  }
  return { text, frames, pending };
}
const markdown = text => text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function render() {
  const t = tokens[step - 1], done = t === END;
  const { text, frames, pending } = replay(step);
  root.querySelector('.stream-count').innerHTML = `第<b>${step}</b>个 token · 共 ${tokens.length} 个`;
  const now = root.querySelector('.now');
  const boxes = bytesOf(t).map(b => `<span class="byte">${hex(b)}</span>`).join('');
  if (done) now.innerHTML = `<span class="tokname mono"></span><span class="note">结束标记，不对应任何字节</span>`;
  else if (Array.isArray(t)) now.innerHTML = boxes + '<span class="note">这个 token 只是几个字节</span>';
  else now.innerHTML = `<span class="tokname"></span>${boxes}`;
  const name = now.querySelector('.tokname');
  if (name) name.textContent = done ? END : t.replace(/\n/g, '↵');
  root.querySelector('.held-out').innerHTML = pending.length
    ? pending.map(b => `<span class="byte held">${hex(b)}</span>`).join('') + '<span class="note">不是完整的字，先攒着</span>'
    : '<span class="note">空</span>';
  const shown = frames.slice(-3).map(f => f === null ? '<div class="skip">（这一步不发）</div>' : `<div></div>`);
  const box = root.querySelector('.frames');
  box.innerHTML = shown.join('');
  frames.slice(-3).forEach((f, i) => { if (f !== null) box.children[i].textContent = f; });
  root.querySelector('.screen').innerHTML = markdown(text) + (done ? '' : '<span class="caret"></span>');
  prev.disabled = step === 1;
  next.disabled = step === tokens.length;
}
function stop() {
  clearTimeout(timer);
  timer = 0;
  playButton.textContent = '播放';
}
function advance() {
  step++;
  render();
  if (step < tokens.length) timer = setTimeout(advance, 420);
  else stop();
}
playButton.addEventListener('click', () => {
  if (timer) return stop();
  if (step >= tokens.length) { step = 1; render(); }
  playButton.textContent = '暂停';
  timer = setTimeout(advance, 420);
});
prev.addEventListener('click', () => { stop(); step--; render(); });
next.addEventListener('click', () => { stop(); step++; render(); });
render();
</script>
```

解码出的增量文字通过 SSE（Server-Sent Events）推回浏览器。HTTP 响应连接保持不断开，服务端每攒出一点新文字，就往里写一段 `data: …` 并以空行分隔，一段就是一个事件。开头请求里的 `stream: true` 要的就是这个开关。不开启它的话，服务端会等整条回复写完再一次发回，模型那头照样是一个 token 一个 token 算的，只是前端看不到过程。

浏览器原生的 `EventSource` 只支持发 GET，而聊天接口需要 POST 一大段 JSON，所以前端一般直接用 `fetch` 读响应流，自己按空行切出事件。

拿到增量后，前端把它拼到已有文本末尾，再重新渲染一遍 Markdown。这一步也有边角坑，比如 `**橘座` 刚到、后面的 `**` 还没来，按标准语法它只能先画成两个星号加两个字。很多聊天界面里星号一闪随后变成粗体，原因就在这儿。

最后一步，模型抽中了 `<|im_end|>`。这个标记不会出现在屏幕上，服务端也不必再调一次模型，只需往流里补发一个 `finish_reason` 为 `stop` 的事件，再写一行 `data: [DONE]` 收尾。请求在批处理里占的槽位随即空出来分给后面排队的人，而它的 KV cache 往往还会多留一会儿，等你的下一轮对话来命中缓存。

## 资料

- [Qwen3-8B 模型卡](https://huggingface.co/Qwen/Qwen3-8B)：层数和注意力头、思考模式的开关、推荐的采样参数。聊天模板和工具调用格式在同一仓库的 `tokenizer_config.json` 里。
- [Llama 3.1 8B](https://huggingface.co/meta-llama/Llama-3.1-8B)：层数、KV 头数和词表大小，用来算 KV cache 和显存。
- [Hugging Face：Chat templates](https://huggingface.co/docs/transformers/en/chat_templating)：消息怎样变成模型读到的文本。
- [Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909)：把 BPE 用于分词的论文。
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)：注意力和 Transformer。
- [interpreting GPT: the logit lens](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens)：拿中间层的向量直接解码。
- [Orca](https://www.usenix.org/conference/osdi22/presentation/yu)：按步调度的批处理。
- [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)：vLLM 的分页 KV cache。
- [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)：投机解码。
- [Sarathi-Serve](https://arxiv.org/abs/2403.02310)、[DistServe](https://arxiv.org/abs/2401.09670)：把长 prefill 切块穿插，或者让 prefill 和 decode 分开跑。
- [Defeating Nondeterminism in LLM Inference](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)：温度为 0 时结果为什么还会变。
- [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/)：显存带宽和算力。
- [MDN：Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)：事件流的格式。
