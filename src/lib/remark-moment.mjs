import { existsSync } from 'node:fs';
import { basename, dirname, extname, posix, resolve } from 'node:path';
import sharp from 'sharp';
import { visit } from 'unist-util-visit';

const VIDEO_EXTENSIONS = withUpperCase(['.mp4', '.webm', '.mov']);
const STILL_EXTENSIONS = withUpperCase([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
]);
const LIVE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.6 2.4"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>';
const PLAY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';

// Keep in step with life.css: the media column width, the tallest a row may
// grow, and the combined aspect ratio a row aims for (about 260px tall).
const COLUMN_WIDTH = 860;
const MAX_ROW_HEIGHT = 540;
const ROW_ASPECT = 3.2;

// In a life record, a paragraph made only of images becomes a block of media
// laid out in justified rows. A still whose sibling video shares its name is a
// Live Photo; a video whose sibling image shares its name gets it as the poster.
export function remarkMoment() {
  return async (tree, file) => {
    if (
      typeof file.path !== 'string' ||
      !/(?:^|[\\/])src[\\/]content[\\/]life[\\/]/.test(file.path)
    )
      return;
    const directory = dirname(file.path);
    const id = basename(directory);
    const blocks = [];
    visit(tree, 'paragraph', (node, index, parent) => {
      const items = node.children.filter(
        (child) => !(child.type === 'text' && !child.value.trim()),
      );
      if (items.length && items.every((child) => child.type === 'image'))
        blocks.push({ index, parent, items });
    });
    for (const { index, parent, items } of blocks) {
      const media = await Promise.all(
        items.map((image) => inspect(image, { directory, id })),
      );
      parent.children[index] = element(
        'div',
        { className: ['moment-media'] },
        partition(media).map(row),
      );
    }
  };
}

function withUpperCase(extensions) {
  return extensions.flatMap((extension) => [
    extension,
    extension.toUpperCase(),
  ]);
}

function element(hName, hProperties, children = []) {
  return { type: 'momentElement', data: { hName, hProperties }, children };
}

function html(value) {
  return { type: 'html', value };
}

function text(value) {
  return { type: 'text', value };
}

async function inspect(image, { directory, id }) {
  const url = decodeURI(image.url);
  const local = !URL.canParse(url) && !url.startsWith('/');
  const extension = extname(url);
  const stem = url.slice(0, url.length - extension.length);
  const sibling = (extensions) =>
    local
      ? extensions
          .map((candidate) => stem + candidate)
          .find((candidate) => existsSync(resolve(directory, candidate)))
      : undefined;
  image.title = null;

  if (VIDEO_EXTENSIONS.includes(extension)) {
    const poster = sibling(STILL_EXTENSIONS);
    return {
      kind: 'video',
      image,
      id,
      url,
      poster,
      ratio: poster
        ? await ratioOf(resolve(directory, poster), id, poster)
        : 16 / 9,
    };
  }
  const live = sibling(VIDEO_EXTENSIONS);
  return {
    kind: live ? 'live' : 'image',
    image,
    id,
    url,
    live,
    ratio: local ? await ratioOf(resolve(directory, url), id, url) : undefined,
  };
}

// Splits media into rows whose combined aspect ratio stays close to
// ROW_ASPECT, so rows share a similar height. Media of unknown size sit alone.
function partition(media) {
  const rows = [];
  let run = [];
  for (const item of media) {
    if (item.ratio) {
      run.push(item);
      continue;
    }
    rows.push(...balance(run), [item]);
    run = [];
  }
  rows.push(...balance(run));
  return rows;
}

function balance(items) {
  const cost = [0];
  const start = [0];
  for (let end = 1; end <= items.length; end += 1) {
    cost[end] = Infinity;
    let sum = 0;
    for (let first = end - 1; first >= 0; first -= 1) {
      sum += items[first].ratio;
      const total = cost[first] + Math.log(sum / ROW_ASPECT) ** 2;
      if (total < cost[end]) {
        cost[end] = total;
        start[end] = first;
      }
    }
  }
  const rows = [];
  for (let end = items.length; end > 0; end = start[end])
    rows.unshift(items.slice(start[end], end));
  return rows;
}

function row(items) {
  const sum = items.reduce((total, item) => total + (item.ratio ?? 0), 0);
  if (!sum)
    return element('div', { className: ['moment-row', 'is-unsized'] }, [
      cell(items[0], 1),
    ]);
  return element(
    'div',
    {
      className: ['moment-row'],
      style: `--sum: ${sum.toFixed(4)}; --count: ${items.length}`,
    },
    items.map((item) => cell(item, item.ratio / sum, sum)),
  );
}

// share: the fraction of the row's width this cell takes.
function cell(item, share, sum) {
  const { kind, image, id, url, ratio } = item;
  const alt = image.alt ?? '';
  const width = sum
    ? Math.min(COLUMN_WIDTH, sum * MAX_ROW_HEIGHT) * share
    : COLUMN_WIDTH;
  const properties = {
    className: ['moment-cell', `is-${kind}`],
    style: ratio ? `--ratio: ${ratio.toFixed(4)}` : undefined,
  };

  if (kind === 'video') {
    return element('div', properties, [
      element(
        'button',
        { className: ['moment-play'], type: 'button', ariaLabel: '播放视频' },
        [
          ...(item.poster
            ? [still({ ...image, url: item.poster, alt }, share, width)]
            : []),
          element('span', { className: ['play-glyph'] }, [html(PLAY_ICON)]),
          element('span', { className: ['video-duration'] }),
        ],
      ),
      element('video', {
        src: mediaUrl(id, url),
        controls: true,
        preload: 'metadata',
        playsInline: true,
        ariaLabel: alt || undefined,
      }),
    ]);
  }

  const children = [
    element(
      'button',
      {
        className: ['moment-open'],
        type: 'button',
        ariaLabel: alt ? `放大图片：${alt}` : '放大图片',
      },
      [still(image, share, width)],
    ),
  ];
  if (kind === 'live') {
    children.push(
      element('video', {
        src: mediaUrl(id, item.live),
        muted: true,
        playsInline: true,
        preload: 'none',
        ariaHidden: 'true',
        tabIndex: -1,
      }),
      element(
        'button',
        {
          className: ['live-badge'],
          type: 'button',
          dataLiveToggle: '',
          ariaPressed: 'false',
          ariaLabel: '播放实况',
        },
        [html(LIVE_ICON), element('span', {}, [text('实况')])],
      ),
    );
  }
  return element(
    'div',
    { ...properties, ...(kind === 'live' ? { dataLivePhoto: '' } : {}) },
    children,
  );
}

// Astro resolves and optimises the image later; these become its options.
// The largest width also serves the lightbox.
function still(image, share, width) {
  image.data = {
    hProperties: {
      loading: 'lazy',
      decoding: 'async',
      width: 1920,
      widths: [320, 640, 960, 1440, 1920],
      sizes: `(max-width: 640px) calc((100vw - 40px) * ${share.toFixed(3)}), ${Math.round(width)}px`,
      format: 'webp',
    },
  };
  return image;
}

function mediaUrl(id, url) {
  return encodeURI(posix.join('/life', id, url));
}

async function ratioOf(path, id, url) {
  let metadata;
  try {
    metadata = await sharp(path).metadata();
  } catch (error) {
    throw new Error(`生活记录「${id}」的图片无法读取：${url}`, {
      cause: error,
    });
  }
  const { width, height, orientation = 1 } = metadata;
  return orientation >= 5 ? height / width : width / height;
}
