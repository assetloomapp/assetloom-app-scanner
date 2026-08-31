// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://assetloomapp.github.io',
	base: '/assetloom-app-scanner',
	integrations: [
		starlight({
			title: 'AssetLoom App Scanner',
			description:
				'Scan your Google Workspace for third-party OAuth app grants — AI apps, risky permissions, every user.',
			components: {
				SocialIcons: './src/components/SocialIcons.astro',
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/assetloomapp/assetloom-app-scanner',
				},
			],
			sidebar: [
				{ label: 'Quick Guide', slug: 'quick-guide' },
				{ label: 'Installation', slug: 'installation' },
				{ label: 'Setup', items: ['setup/google-workspace', 'setup/okta', 'setup/entra'] },
				{
					label: 'How it works',
					items: [
						'how-it-works/how-risk-is-decided',
						'how-it-works/data-privacy',
					],
				},
			],
		}),
	],
});
