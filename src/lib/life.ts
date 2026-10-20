import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { posix } from 'node:path';
import { formatDate } from './posts';

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

const dateParts = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});
const MONTHS = '一二三四五六七八九十'.split('').concat(['十一', '十二']);

// Calendar fields as seen in China, e.g. { year: 2026, month: '九月', day: 22, weekday: '周二' }.
export function momentDate(moment: Moment) {
  const parts = Object.fromEntries(
    dateParts
      .formatToParts(moment.data.date)
      .map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: `${MONTHS[Number(parts.month) - 1]}月`,
    day: Number(parts.day),
    weekday: parts.weekday,
  };
}

const stills = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/life/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);
const videoFile = /\.(?:mp4|webm|mov)$/i;

function mediaUrls(moment: Moment): string[] {
  const directory = posix.join('/', posix.dirname(moment.filePath ?? ''));
  return [...(moment.body ?? '').matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map(
    ([, url]) => posix.join(directory, decodeURI(url)),
  );
}

// A record's photos and video posters, in the order they were written.
export function momentImages(moment: Moment): ImageMetadata[] {
  const images: ImageMetadata[] = [];
  for (const path of mediaUrls(moment)) {
    const stem = path.replace(videoFile, '');
    const source = videoFile.test(path)
      ? Object.keys(stills).find(
          (candidate) => candidate.replace(/\.[^.]+$/, '') === stem,
        )
      : path;
    const image = source && stills[source]?.default;
    if (image) images.push(image);
  }
  return images;
}

export function momentCover(moment: Moment): ImageMetadata | undefined {
  return momentImages(moment)[0];
}

export function momentCounts(moment: Moment) {
  const urls = mediaUrls(moment);
  const videos = urls.filter((url) => videoFile.test(url)).length;
  return { photos: urls.length - videos, videos };
}

export function momentExcerpt(moment: Moment, limit = 60): string {
  const text = (moment.body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return `${formatDate(moment.data.date)} 的记录`;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
