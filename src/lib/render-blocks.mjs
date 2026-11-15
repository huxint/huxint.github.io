import { renderHtmlMath } from './remark-html-math.mjs';

const renderers = {
  svg: 'SVG 图示',
  html: '交互演示',
  excalidraw: 'Excalidraw 图示',
};

export function renderBlock(source, meta = '') {
  const [type, ...options] = meta.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  if (!Object.hasOwn(renderers, type))
    throw new Error(
      `未知的 render 类型「${type ?? ''}」。可用：${Object.keys(renderers).join('、')}。`,
    );
  const caption = options
    .find((option) => option.startsWith('title='))
    ?.slice('title='.length)
    .replace(/^(["'])(.*)\1$/, '$2');
  // A caption may hold formulas; the label read aloud keeps only their source.
  const label = caption?.replace(/\$/g, '') || renderers[type];
  const isSvg = type === 'svg';
  return {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['render-block'],
      dataRenderer: type,
      dataSource: isSvg ? undefined : source,
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['render-canvas'],
          ariaLabel: label,
          role: isSvg ? 'img' : undefined,
        },
        children: isSvg
          ? [
              {
                type: 'element',
                tagName: 'template',
                properties: { shadowrootmode: 'open' },
                children: [
                  {
                    type: 'element',
                    tagName: 'style',
                    properties: {},
                    children: [
                      {
                        type: 'text',
                        value:
                          'svg{display:block;max-width:100%;height:auto;margin-inline:auto}',
                      },
                    ],
                  },
                  { type: 'raw', value: source },
                ],
              },
            ]
          : [],
      },
      ...(caption
        ? [
            {
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [
                /[$\\]/.test(caption)
                  ? {
                      type: 'raw',
                      value: renderHtmlMath(
                        caption.replace(
                          /[&<>]/g,
                          (c) =>
                            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c],
                        ),
                      ),
                    }
                  : { type: 'text', value: caption },
              ],
            },
          ]
        : []),
    ],
  };
}
