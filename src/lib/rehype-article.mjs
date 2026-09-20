import { visit } from 'unist-util-visit';

export function rehypeArticle() {
  return (tree, file) => {
    const mathError = file.messages.find(
      (message) => message.source === 'rehype-katex',
    );
    if (mathError) file.fail(mathError.reason, mathError.place);

    visit(tree, 'element', (node, index, parent) => {
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
