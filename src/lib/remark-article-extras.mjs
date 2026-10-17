/**
 * Small, deliberate extensions to plain Markdown:
 * - ==text== becomes a semantic <mark>
 * - ++text++ becomes <u>
 * Everything else stays standard Markdown. Code blocks and math are untouched.
 */
const RICH_TEXT = /==([^=\n]+?)==|\+\+([^+\n]+?)\+\+|\*\*([^*\n]+?)\*\*/g;

function splitRichText(value) {
  const nodes = [];
  let cursor = 0;
  for (const match of value.matchAll(RICH_TEXT)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, start) });
    }
    const isMark = match[1] !== undefined;
    const isUnderline = match[2] !== undefined;
    const content = match[1] ?? match[2] ?? match[3];
    nodes.push({
      type: 'strong',
      data:
        isMark || isUnderline
          ? {
              hName: isMark ? 'mark' : 'u',
              hProperties: {
                className: [isMark ? 'highlight' : 'underline'],
              },
            }
          : undefined,
      children: [{ type: 'text', value: content }],
    });
    cursor = start + match[0].length;
  }
  if (cursor < value.length) {
    nodes.push({ type: 'text', value: value.slice(cursor) });
  }
  return nodes;
}

function transformChildren(parent) {
  if (!Array.isArray(parent.children)) return;
  const next = [];
  for (const child of parent.children) {
    if (child.type === 'text') {
      const split = splitRichText(child.value);
      next.push(...split);
    } else {
      transformChildren(child);
      next.push(child);
    }
  }
  parent.children = next;
}

export function remarkArticleExtras() {
  return (tree) => transformChildren(tree);
}
