import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: z.object({
    title: z.string(),
    appId: z.number(),
    genres: z.array(z.string()),
    price: z.string(),
    releaseDate: z.string(),
    developer: z.string(),
    reviewScore: z.string(),
    reviewPercentage: z.number(),
    headerImage: z.string(),
    generatedAt: z.string(),
  }),
});

export const collections = { games };
