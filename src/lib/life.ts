import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { posix } from 'node:path';
import { formatDate } from './posts';
import { joinLines } from './text';
import { stickerText } from './stickers/catalog.mjs';

export type Moment = CollectionEntry<'life'>;

export async function getMoments(): Promise<Moment[]> {
  const moments = await getCollection(
    'life',
    ({ data }) => import.meta.env.DEV || !data.draft,
  );
  return moments.sort(
    (left, right) =>
      right.data.date.valueOf() - left.data.date.valueOf() ||
      left.id.localeCompare(right.id),
  );
}

const weekdays = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  weekday: 'short',
});

export function momentWeekday(moment: Moment): string {
  return weekdays.format(moment.data.date);
}

const stills = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/life/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);
const videoFile = /\.(?:mp4|webm|mov)$/i;
const posters = new Map(
  Object.entries(stills).map(([path, image]) => [
    path.replace(/\.[^.]+$/, ''),
    image.default,
  ]),
);

export function momentMedia(moment: Moment) {
  const directory = posix.join('/', posix.dirname(moment.filePath ?? ''));
  const urls = [...(moment.body ?? '').matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map(
    ([, url]) => posix.join(directory, decodeURI(url)),
  );
  const images: ImageMetadata[] = [];
  let videos = 0;
  for (const path of urls) {
    const isVideo = videoFile.test(path);
    if (isVideo) videos++;
    const image = isVideo
      ? posters.get(path.replace(videoFile, ''))
      : stills[path]?.default;
    if (image) images.push(image);
  }
  return { images, photos: urls.length - videos, videos };
}

export function momentCover(moment: Moment): ImageMetadata | undefined {
  return momentMedia(moment).images[0];
}

export function momentExcerpt(moment: Moment, limit = 60): string {
  const text = joinLines(
    stickerText(moment.body ?? '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~]/g, ''),
  );
  if (!text) return `${formatDate(moment.data.date)} 的记录`;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
