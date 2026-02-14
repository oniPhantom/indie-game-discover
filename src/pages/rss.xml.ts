import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const games = await getCollection('games');

  return rss({
    title: 'Indie Game Discover',
    description: '注目のインディーゲームを関西弁で紹介',
    site: context.site!,
    items: games.map(game => ({
      title: game.data.title,
      description: game.data.kansaiCatch ?? game.data.title,
      link: `/games/${game.id}/`,
      pubDate: new Date(game.data.generatedAt),
    })),
  });
}
