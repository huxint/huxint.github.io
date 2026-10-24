import {
  stickerAt,
  stickerAttributes,
  stickerClasses,
} from './stickers/catalog.mjs';

/**
 * Turns :id: into the sticker it names. A paragraph holding nothing but
 * stickers shows them large, the way chat apps do.
 */
function sticker(sticker) {
  return {
    type: 'sticker',
    data: {
      hName: 'img',
      hProperties: {
        ...stickerAttributes(sticker),
        className: stickerClasses(sticker),
      },
    },
  };
}

function split(value) {
  const nodes = [];
  let from = 0;
  for (
    let at = value.indexOf(':');
    at !== -1;
    at = value.indexOf(':', at + 1)
  ) {
    const hit = stickerAt(value, at);
    if (!hit) continue;
    if (at > from) nodes.push({ type: 'text', value: value.slice(from, at) });
    nodes.push(sticker(hit.sticker));
    from = hit.end;
    at = hit.end - 1;
  }
  if (from < value.length)
    nodes.push({ type: 'text', value: value.slice(from) });
  return nodes;
}

function transformChildren(parent) {
  parent.children = parent.children.flatMap((child) => {
    if (child.type === 'text') return split(child.value);
    if (child.children) transformChildren(child);
    return [child];
  });
  if (
    parent.type === 'paragraph' &&
    parent.children.some((child) => child.type === 'sticker') &&
    parent.children.every(
      (child) =>
        child.type === 'sticker' ||
        (child.type === 'text' && !child.value.trim()),
    )
  ) {
    parent.data = { hProperties: { className: ['sticker-row'] } };
    for (const child of parent.children)
      if (child.type === 'sticker')
        child.data.hProperties.className.push('is-large');
  }
}

export function remarkStickers() {
  return (tree) => {
    transformChildren(tree);
  };
}
