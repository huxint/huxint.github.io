// Each language owns its renderer; Markdown only supplies the source and caption.
/** @type {Record<string, {label: string, load: () => Promise<{render: (target: HTMLElement, source: string) => void | Promise<void>}>}>} */
export const renderers = {
  svg: {
    label: 'SVG 图示',
    load: () => import('../scripts/renderers/svg.ts'),
  },
  html: {
    label: '交互演示',
    load: () => import('../scripts/renderers/html.ts'),
  },
  excalidraw: {
    label: 'Excalidraw 图示',
    load: () => import('../scripts/renderers/excalidraw.ts'),
  },
};

export function renderBlock(source, meta = '') {
  const [type, ...options] = meta.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  if (!Object.hasOwn(renderers, type))
    throw new Error(
      `未知的 render 类型「${type ?? ''}」。可用：${Object.keys(renderers).join('、')}。`,
    );
  const renderer = renderers[type];

  const caption = options
    .find((option) => option.startsWith('title='))
    ?.slice('title='.length)
    .replace(/^(["'])(.*)\1$/, '$2');
  const label = caption || renderer.label;
  return {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['render-block'],
      dataRenderer: type,
      dataSource: source,
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['render-canvas'], ariaLabel: label },
        children: [],
      },
      ...(caption
        ? [
            {
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [{ type: 'text', value: caption }],
            },
          ]
        : []),
    ],
  };
}
