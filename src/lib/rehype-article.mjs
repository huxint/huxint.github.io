import { visit } from 'unist-util-visit';

const CALLOUTS = new Map([
  ['note', { type: 'note', label: '说明', symbol: 'i' }],
  ['说明', { type: 'note', label: '说明', symbol: 'i' }],
  ['tip', { type: 'tip', label: '建议', symbol: '✦' }],
  ['建议', { type: 'tip', label: '建议', symbol: '✦' }],
  ['important', { type: 'important', label: '重点', symbol: '!' }],
  ['重点', { type: 'important', label: '重点', symbol: '!' }],
  ['warning', { type: 'warning', label: '警告', symbol: '△' }],
  ['警告', { type: 'warning', label: '警告', symbol: '△' }],
  ['caution', { type: 'caution', label: '注意', symbol: '✳' }],
  ['注意', { type: 'caution', label: '注意', symbol: '✳' }],
]);

function classesOf(node) {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function addClasses(node, classes) {
  node.properties = {
    ...(node.properties ?? {}),
    className: [...new Set([...classesOf(node), ...classes])],
  };
}

function textContent(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textContent).join('');
}

function calloutTitle(callout) {
  return {
    type: 'element',
    tagName: 'p',
    properties: { className: ['callout-title'] },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['callout-symbol'],
          'aria-hidden': 'true',
        },
        children: [{ type: 'text', value: callout.symbol }],
      },
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['callout-label'] },
        children: [{ type: 'text', value: callout.label }],
      },
    ],
  };
}

function transformCallout(node) {
  const firstIndex = node.children?.findIndex(
    (child) => child.type === 'element' && child.tagName === 'p',
  );
  if (firstIndex === undefined || firstIndex < 0) return;
  const first = node.children[firstIndex];
  const marker = first.children?.find(
    (child) => child.type === 'text' && /^\s*\[!/.test(child.value),
  );
  if (!marker) return;

  const match = marker.value.match(/^\s*\[!([^\]]+)\]\s*/);
  if (!match) return;
  const callout = CALLOUTS.get(match[1].trim().toLowerCase());
  if (!callout) return;

  marker.value = marker.value.slice(match[0].length);
  if (!marker.value) first.children.splice(first.children.indexOf(marker), 1);
  if (first.children.length === 0) node.children.splice(firstIndex, 1);

  addClasses(node, ['callout', `callout--${callout.type}`]);
  node.properties = {
    ...node.properties,
    'data-callout': callout.type,
    'data-callout-label': callout.label,
  };
  node.children.unshift(calloutTitle(callout));
}

function mermaidFigure(source) {
  return {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['mermaid-figure'],
      'data-mermaid-figure': '',
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['mermaid-toolbar'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['mermaid-kicker'] },
            children: [{ type: 'text', value: 'MERMAID' }],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['mermaid-title'] },
            children: [{ type: 'text', value: '图表' }],
          },
        ],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid-canvas'],
          'data-mermaid-target': '',
        },
        children: [],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid-source'],
          'data-mermaid-source': '',
        },
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-mermaid'] },
            children: [{ type: 'text', value: source.replace(/\n$/, '') }],
          },
        ],
      },
    ],
  };
}

export function rehypeArticle() {
  return (tree, file) => {
    const mathError = file.messages.find(
      (message) => message.source === 'rehype-katex',
    );
    if (mathError) file.fail(mathError.reason, mathError.place);

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'blockquote') {
        transformCallout(node);
        return;
      }

      if (node.tagName === 'pre' && parent && typeof index === 'number') {
        const code = node.children?.find(
          (child) => child.type === 'element' && child.tagName === 'code',
        );
        if (code && classesOf(code).includes('language-mermaid')) {
          parent.children[index] = mermaidFigure(textContent(code));
          return;
        }
      }

      if (
        node.tagName === 'span' &&
        Array.isArray(node.properties?.className) &&
        node.properties.className.includes('katex') &&
        parent &&
        !(
          parent.type === 'element' &&
          Array.isArray(parent.properties?.className) &&
          parent.properties.className.includes('katex-display')
        )
      ) {
        parent.children[index] = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['math-inline'] },
          children: [node],
        };
        return;
      }

      if (node.tagName !== 'p' || node.children.length !== 1) return;

      const image = node.children[0];
      if (image.type !== 'element' || image.tagName !== 'img') return;

      const caption = image.properties.title;
      delete image.properties.title;
      image.properties.loading = 'lazy';
      image.properties.decoding = 'async';
      node.tagName = 'figure';
      node.properties = { className: ['article-image'] };

      if (caption) {
        node.children.push({
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [{ type: 'text', value: String(caption) }],
        });
      }
    });
  };
}
