import { visit } from 'unist-util-visit';
import { renderBlock } from './render-blocks.mjs';

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
  ['definition', { type: 'definition', label: '定义' }],
  ['定义', { type: 'definition', label: '定义' }],
  ['theorem', { type: 'theorem', label: '定理' }],
  ['定理', { type: 'theorem', label: '定理' }],
  ['lemma', { type: 'theorem', label: '引理' }],
  ['引理', { type: 'theorem', label: '引理' }],
  ['proof', { type: 'proof', label: '证明' }],
  ['证明', { type: 'proof', label: '证明' }],
  ['example', { type: 'example', label: '例' }],
  ['例', { type: 'example', label: '例' }],
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
  definition: {
    outline: 'M4 2.5h8.5L16 6v11.5H4Z',
    detail: 'M7 9.5h6M7 13h4',
  },
  theorem: {
    outline: 'M3 3h14v14H3Z',
    detail: 'M7 7.5h6M10 7.5V14',
  },
  proof: {
    outline: 'M3 3h14v14H3Z',
    detail: 'm6.5 10.3 2.5 2.5 4.5-5.3',
  },
  example: {
    outline: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    detail: 'M8.4 6.8v6.4l5-3.2Z',
  },
};

function classesOf(node) {
  return node.properties?.className ?? [];
}

function addClasses(node, classes) {
  node.properties.className = [...new Set([...classesOf(node), ...classes])];
}

function textContent(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textContent).join('');
}

function calloutTitle(callout, title, fold) {
  const symbol = CALLOUT_SYMBOLS[callout.type];
  return {
    type: 'element',
    tagName: fold ? 'summary' : 'p',
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
      ...(title.length
        ? [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['callout-name'] },
              children: title,
            },
          ]
        : []),
    ],
  };
}

// Reads `[!TYPE]`, an optional - or + to fold, and an optional title on the
// same line from the start of a quote. The marker and title leave the quote.
function takeMarker(node) {
  const firstIndex = node.children.findIndex(
    (child) => child.type === 'element' && child.tagName === 'p',
  );
  if (firstIndex < 0) return;
  const first = node.children[firstIndex];
  const marker = first.children[0];
  if (marker?.type !== 'text') return;
  const match = marker.value.match(/^\s*\[!([^\]]+)\]([-+]?)[^\S\n]*/);
  if (!match) return;
  const type = match[1].trim().toLowerCase();
  if (type !== 'tab' && !CALLOUTS.has(type)) return;

  marker.value = marker.value.slice(match[0].length);
  const title = [];
  while (first.children.length) {
    const child = first.children[0];
    const line = child.type === 'text' ? child.value.indexOf('\n') : -1;
    if (line < 0) {
      title.push(first.children.shift());
      continue;
    }
    if (line > 0)
      title.push({ type: 'text', value: child.value.slice(0, line) });
    child.value = child.value.slice(line + 1);
    if (!child.value) first.children.shift();
    break;
  }
  if (title[0]?.type === 'text' && !title[0].value) title.shift();
  if (first.children.length === 0) node.children.splice(firstIndex, 1);
  return { type, fold: match[2], title };
}

function isTab(node) {
  if (node.type !== 'element' || node.tagName !== 'blockquote') return false;
  const first = node.children.find((child) => child.type === 'element');
  const marker = first?.tagName === 'p' && first.children[0];
  return marker?.type === 'text' && /^\s*\[!tab\]/i.test(marker.value);
}

// Consecutive `> [!TAB] 名字` quotes become one tab group.
function groupTabs(parent, state) {
  if (!parent.children) return;
  const result = [];
  let group;
  for (const child of parent.children) {
    if (isTab(child)) {
      if (!group) {
        group = [];
        result.push(group);
      }
      group.push(child);
      continue;
    }
    // Only the line breaks between quotes may sit inside a group.
    if (!(child.type === 'text' && !child.value.trim())) group = undefined;
    groupTabs(child, state);
    result.push(child);
  }
  parent.children = result.map((item) => {
    if (!Array.isArray(item)) return item;
    const id = `tabs-${(state.count += 1)}`;
    const tabs = item.map((quote, index) => {
      const { title } = takeMarker(quote);
      groupTabs(quote, state);
      return {
        label: title.length
          ? title
          : [{ type: 'text', value: `选项 ${index + 1}` }],
        children: quote.children,
      };
    });
    return {
      type: 'element',
      tagName: 'div',
      properties: { className: ['tabs'] },
      children: [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['tabs-list'], role: 'tablist' },
          children: tabs.map((tab, index) => ({
            type: 'element',
            tagName: 'button',
            properties: {
              type: 'button',
              role: 'tab',
              id: `${id}-tab-${index + 1}`,
              ariaControls: `${id}-panel-${index + 1}`,
              ariaSelected: String(index === 0),
              tabIndex: index === 0 ? 0 : -1,
            },
            children: tab.label,
          })),
        },
        ...tabs.map((tab, index) => ({
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['tabs-panel'],
            role: 'tabpanel',
            id: `${id}-panel-${index + 1}`,
            ariaLabelledBy: `${id}-tab-${index + 1}`,
            hidden: index !== 0,
          },
          children: tab.children,
        })),
      ],
    };
  });
}

function transformCallout(node) {
  const marker = takeMarker(node);
  if (!marker) return;
  const callout = CALLOUTS.get(marker.type);
  addClasses(node, ['callout', `callout--${callout.type}`]);
  if (marker.fold) {
    node.tagName = 'details';
    node.properties.open = marker.fold === '+';
  }
  node.children.unshift(
    calloutTitle(callout, marker.title, Boolean(marker.fold)),
  );
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

    groupTabs(tree, { count: 0 });

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

      if (node.tagName === 'table') {
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

      if (node.tagName === 'pre') {
        const code = node.children.find(
          (child) => child.type === 'element' && child.tagName === 'code',
        );
        if (code && classesOf(code).includes('language-mermaid')) {
          parent.children[index] = mermaidFigure(textContent(code));
          return;
        }
        if (code && classesOf(code).includes('language-render')) {
          parent.children[index] = renderBlock(
            textContent(code),
            code.data?.meta,
          );
          return;
        }
      }

      if (
        node.tagName === 'span' &&
        classesOf(node).includes('katex') &&
        !classesOf(parent).includes('katex-display')
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
      if (
        image.type !== 'element' ||
        image.tagName !== 'img' ||
        classesOf(image).includes('sticker')
      )
        return;

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
