import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { config } from '../../../../config/prancheta.config.ts';

export async function GET(context: APIContext) {
  const posts = (await getCollection('devlog')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  return rss({
    title: `Devlog · ${config.name}`,
    description: config.slogan['pt-BR'],
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary,
      link: `${config.paths.site}devlog/${p.id}/`,
    })),
  });
}
