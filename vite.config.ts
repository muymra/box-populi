import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

// Where this build runs (TECH.md "Hosting targets"). Cloudflare Pages and Workers share one build;
// the others swap the one platform module for theirs.
const TARGETS = {
	cloudflare: { adapter: '@sveltejs/adapter-cloudflare', platform: null },
	node: { adapter: '@sveltejs/adapter-node', platform: 'platform.node.ts' },
	vercel: { adapter: '@sveltejs/adapter-vercel', platform: 'platform.libsql.ts' },
	netlify: { adapter: '@sveltejs/adapter-netlify', platform: 'platform.libsql.ts' }
} as const;
const target = (process.env.BOX_TARGET || 'cloudflare') as keyof typeof TARGETS;
if (!(target in TARGETS)) throw new Error(`BOX_TARGET must be one of ${Object.keys(TARGETS).join(', ')} (got "${target}").`);
const { adapter: adapterModule, platform } = TARGETS[target];
const adapter = (await import(adapterModule)).default;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	resolve: {
		alias: platform
			? [{ find: /^#lib\/server\/platform\.ts$/, replacement: fileURLToPath(new URL(`./src/lib/server/${platform}`, import.meta.url)) }]
			: []
	},
	// Lucide ships .svelte sources; bundle them for server rendering instead of handing them to Node.
	ssr: { noExternal: ['@lucide/svelte'] },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
