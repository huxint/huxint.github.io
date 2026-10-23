/**
 * Small extensions to Markdown: ==highlight== and ++underline++.
 * Wrap inline nodes as well as text, so links, emphasis and math can nest.
 * Code and math source remain untouched.
 */
const DELIMITERS = new Map([
  ['==', { name: 'mark' }],
  ['++', { name: 'u' }],
  // CommonMark leaves some emphasis next to Chinese punctuation as text.
  ['**', { name: 'strong' }],
]);

// As with CommonMark emphasis, a delimiter opens only before text and closes
// only after it. It also never opens right after a Latin letter or digit, so
// the pluses in C++20 and the equals in a==b stay as typed.
function canOpen(nodes, index) {
  const before = nodes[index - 1];
  const after = nodes[index + 1];
  return (
    after !== undefined &&
    !(after.type === 'text' && /^\s/.test(after.value)) &&
    !(before?.type === 'text' && /[A-Za-z0-9]$/.test(before.value))
  );
}

function canClose(nodes, index) {
  const before = nodes[index - 1];
  return !(before.type === 'text' && /\s$/.test(before.value));
}

function wrapInline(nodes) {
  const result = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const format = node.type === 'text' && DELIMITERS.get(node.value);
    if (!format || !canOpen(nodes, index)) {
      result.push(node);
      continue;
    }

    const end = nodes.findIndex(
      (candidate, at) =>
        at > index &&
        candidate.type === 'text' &&
        candidate.value === node.value &&
        canClose(nodes, at),
    );
    const content = nodes.slice(index + 1, end);
    if (
      end <= index + 1 ||
      content.some(
        (child) => child.type === 'text' && child.value.includes('\n'),
      )
    ) {
      result.push(node);
      continue;
    }

    result.push({
      type: 'strong',
      data: { hName: format.name },
      children: wrapInline(content),
    });
    index = end;
  }
  return result;
}

function transformChildren(parent) {
  if (!parent.children) return;
  const nodes = parent.children.flatMap((child) => {
    if (child.type === 'text') {
      return child.value
        .split(/(==|\+\+|\*\*)/g)
        .filter(Boolean)
        .map((value) => ({ type: 'text', value }));
    }
    // GFM recognises bare URLs but includes trailing Chinese punctuation.
    // Explicit Markdown links keep the destination the author supplied.
    let punctuation = '';
    if (
      child.type === 'link' &&
      child.children.length === 1 &&
      child.children[0].type === 'text' &&
      child.position.end.offset - child.position.start.offset ===
        child.children[0].value.length
    ) {
      const label = child.children[0];
      punctuation =
        label.value.match(/[，。；：！？、…）》」』】〉]+$/u)?.[0] ?? '';
      if (punctuation) {
        child.url = child.url.slice(0, -punctuation.length);
        label.value = label.value.slice(0, -punctuation.length);
      }
    }
    transformChildren(child);
    return punctuation
      ? [child, { type: 'text', value: punctuation }]
      : [child];
  });
  parent.children = wrapInline(nodes);
}

export function remarkArticleExtras() {
  return (tree) => {
    transformChildren(tree);
  };
}
