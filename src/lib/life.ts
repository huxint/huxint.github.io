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
const DAY = 24 * 60 * 60 * 1000;

function calendar(date: Date) {
  const parts = Object.fromEntries(
    dateParts.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
  };
}

// Calendar fields as seen in China, e.g. { year: 2026, month: '九月', day: 22, weekday: '周二' }.
export function momentDate(moment: Moment) {
  const { year, month, day, weekday } = calendar(moment.data.date);
  return { year, month: `${MONTHS[month - 1]}月`, day, weekday };
}

// Where the middle of a record's day falls in its year, between 0 and 1.
export function yearFraction(moment: Moment): number {
  const { year, month, day } = calendar(moment.data.date);
  const start = Date.UTC(year, 0, 1);
  return (
    (Date.UTC(year, month - 1, day) - start + DAY / 2) /
    (Date.UTC(year + 1, 0, 1) - start)
  );
}

// Where each month begins in the year, as fractions like yearFraction's.
export function monthStarts(year: number): number[] {
  const start = Date.UTC(year, 0, 1);
  const length = Date.UTC(year + 1, 0, 1) - start;
  return MONTHS.map((_, month) => (Date.UTC(year, month, 1) - start) / length);
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

// Photos in the text in order, standing in for each video with its poster.
export function momentStills(moment: Moment): ImageMetadata[] {
  return mediaUrls(moment).flatMap((path) => {
    if (!videoFile.test(path)) return stills[path]?.default ?? [];
    const stem = path.replace(videoFile, '');
    const poster = Object.keys(stills).find(
      (candidate) => candidate.replace(/\.[^.]+$/, '') === stem,
    );
    return poster ? stills[poster].default : [];
  });
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

// The line written under a print, e.g. "09.22 · 深圳".
export function printNote(moment: Moment): string {
  return [formatDate(moment.data.date).slice(5), moment.data.location]
    .filter(Boolean)
    .join(' · ');
}
