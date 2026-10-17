import { visit } from 'unist-util-visit';

const CALLOUTS = new Map([
  ['note', { type: 'note', label: '说明' }],
  ['说明', { type: 'note', label: '说明' }],
  ['tip', { type: 'tip', label: '建议' }],
  ['建议', { type: 'tip', label: '建议' }],
  ['important', { type: 'important', label: '重点' }],
  ['重点', { type: 'important', label: '重点' }],
  ['warning', { type: 'warning', label: '警告' }],
  ['警告', { type: 'warning', label: '警告' }],
  ['caution', { type: 'caution', label: '注意' }],
  ['注意', { type: 'caution', label: '注意' }],
]);

const CALLOUT_SYMBOLS = {
  note: {
    outline: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    detail: 'M10 9v5.5',
    dot: [10, 5.8],
  },
  tip: {
    outline:
      'M7 16h6M8 18.5h4M6.2 11.7a5.8 5.8 0 1 1 7.6 0c-.8.7-1 1.5-1 2.3H7.2c0-.8-.2-1.6-1-2.3',
    detail: 'M8 8h4M10 8v5',
  },
  important: {
    outline: 'm10 1.5 8.5 8.5-8.5 8.5L1.5 10Z',
    detail: 'M10 5v6',
    dot: [10, 14.5],
  },
  warning: {
    outline: 'M10 2 19 18H1Z',
    detail: 'M10 7v5',
    dot: [10, 15.1],
  },
  caution: {
    outline: 'M6 1.5h8L18.5 6v8L14 18.5H6L1.5 14V6Z',
    detail: 'm7 7 6 6M13 7l-6 6',
  },
};

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
  const symbol = CALLOUT_SYMBOLS[callout.type];
  return {
    type: 'element',
    tagName: 'p',
    properties: { className: ['callout-title'] },
    children: [
      {
        type: 'element',
        tagName: 'svg',
        properties: {
          className: ['callout-symbol'],
          width: 16,
          height: 16,
          viewBox: '0 0 20 20',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        children: [
          {
            type: 'element',
            tagName: 'path',
            properties: { d: symbol.outline },
            children: [],
          },
          {
            type: 'element',
            tagName: 'path',
            properties: { d: symbol.detail, strokeWidth: 1.9 },
            children: [],
          },
          ...(symbol.dot
            ? [
                {
                  type: 'element',
                  tagName: 'circle',
                  properties: {
                    cx: symbol.dot[0],
                    cy: symbol.dot[1],
                    r: 1,
                    fill: 'currentColor',
                    stroke: 'none',
                  },
                  children: [],
                },
              ]
            : []),
        ],
      },
      {
        type: 'element',
        tagName: 'span',
        properties: {},
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
  node.children.unshift(calloutTitle(callout));
}

function mermaidFigure(source) {
  const label = source.match(/^\s*accTitle:\s*(.+)$/m)?.[1] ?? '图示';
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: ['mermaid-figure'] },
    children: [
      {
        type: 'element',
        tagName: 'figcaption',
        properties: { className: ['mermaid-title'] },
        children: [{ type: 'text', value: label }],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid-canvas'],
          role: 'img',
          ariaLabel: label,
        },
        children: [],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['mermaid-source'] },
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
      if (
        node.tagName === 'a' &&
        node.properties.dataFootnoteBackref !== undefined
      ) {
        addClasses(node, ['footnote-backref']);
        node.children = [
          {
            type: 'element',
            tagName: 'svg',
            properties: {
              width: 15,
              height: 15,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.7,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
            children: [
              {
                type: 'element',
                tagName: 'path',
                properties: { d: 'm9 6-5 5 5 5M4 11h10a6 6 0 0 1 6 6v2' },
                children: [],
              },
            ],
          },
          ...node.children.filter((child) => child.type !== 'text'),
        ];
      }

      if (node.tagName === 'blockquote') {
        transformCallout(node);
        return;
      }

      if (
        node.tagName === 'span' &&
        classesOf(node).includes('katex-display')
      ) {
        const katex = node.children.find((child) =>
          classesOf(child).includes('katex'),
        );
        const html = katex.children.find((child) =>
          classesOf(child).includes('katex-html'),
        );
        const tag = html.children.find((child) =>
          classesOf(child).includes('tag'),
        );
        if (tag) {
          addClasses(node, ['math-numbered']);
          html.children = [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['math-body'] },
              children: html.children.filter((child) => child !== tag),
            },
            tag,
          ];
        }
      }

      if (node.tagName === 'table' && parent) {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['table-scroll'],
            role: 'region',
            'aria-label': '表格',
            tabIndex: 0,
          },
          children: [node],
        };
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
