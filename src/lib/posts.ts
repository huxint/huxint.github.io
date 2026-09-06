import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection(
    'posts',
    ({ data }) => import.meta.env.DEV || !data.draft,
  );
  return posts.sort(
    (left, right) =>
      right.data.pubDate.valueOf() - left.data.pubDate.valueOf() ||
      left.data.title.localeCompare(right.data.title, 'zh-CN'),
  );
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '.');
}

export function readingMinutes(body: string = ''): number {
  const chineseCharacters = body.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = body.match(/[a-zA-Z0-9]+/g)?.length ?? 0;
  return Math.max(1, Math.ceil(chineseCharacters / 400 + words / 200));
}

export function getTags(posts: Post[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of new Set(post.data.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts].sort(([left], [right]) =>
    left.localeCompare(right, 'zh-CN'),
  );
}
