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
  return date
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
    .replaceAll('-', '.');
}

export function readingMinutes(body: string = ''): number {
  const chineseCharacters = body.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = body.match(/[a-zA-Z0-9]+/g)?.length ?? 0;
  return Math.max(1, Math.ceil(chineseCharacters / 400 + words / 200));
}

export function getTags(posts: Post[]): [string, Post[]][] {
  const tagged = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of new Set(post.data.tags)) {
      const group = tagged.get(tag);
      if (group) group.push(post);
      else tagged.set(tag, [post]);
    }
  }
  return [...tagged].sort(([left], [right]) =>
    left.localeCompare(right, 'zh-CN'),
  );
}
