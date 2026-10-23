import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib/posts';
import { inlineText } from '../lib/inline-markdown';
import { site } from '../data/site';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: context.site!,
    items: posts.map((post) => ({
      title: inlineText(post.data.title),
      description: inlineText(post.data.description),
      pubDate: post.data.pubDate,
      link: `/posts/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
