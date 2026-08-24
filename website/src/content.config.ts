import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// Content lives in ../docs/public so it stays readable on GitHub;
// this site only renders it.
export const collections = {
	docs: defineCollection({
		loader: glob({ pattern: '**/*.md', base: '../docs/public' }),
		schema: docsSchema(),
	}),
};
