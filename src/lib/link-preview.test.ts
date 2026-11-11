import { describe, expect, it } from 'vitest';
import { demoPreview, previewHtml, previewMeta, signInPreview } from './link-preview.ts';

const base = { origin: 'https://games.example.org', path: '/join/R2D9X', siteName: 'Dice Den', title: 'Join Thursday Boards on Dice Den', description: 'Everyone’s games.' };

describe('link preview tags (STATUS item 26, D72)', () => {
	it('gives the drawn picture as a large card with its size, and absolute addresses', () => {
		const tags = previewMeta({ ...base, preview: { image: '/preview.png?v=a-b-c', small: false, alt: 'The mark' } });
		const get = (key: string) => tags.find((t) => t.key === key)?.content;
		expect(get('og:url')).toBe('https://games.example.org/join/R2D9X');
		expect(get('og:image')).toBe('https://games.example.org/preview.png?v=a-b-c');
		expect(get('og:image:width')).toBe('1200');
		expect(get('twitter:card')).toBe('summary_large_image');
		expect(get('og:site_name')).toBe('Dice Den');
	});

	it('gives a logo as a small card, with no size claimed', () => {
		const tags = previewMeta({ ...base, preview: { image: 'https://cdn.example.org/logo.png', small: true, alt: 'The Dice Den logo' } });
		expect(tags.find((t) => t.key === 'og:image')?.content).toBe('https://cdn.example.org/logo.png');
		expect(tags.some((t) => t.key === 'og:image:width')).toBe(false);
		expect(tags.find((t) => t.key === 'twitter:card')?.content).toBe('summary');
	});

	it('escapes what goes into the HTML the hook adds', () => {
		const html = previewHtml(previewMeta({ ...base, ...demoPreview('Ada & Bram’s "Den" <3'), preview: { image: '/p.png', small: false, alt: 'x' } }));
		expect(html).toContain('content="A demo shelf on Ada &amp; Bram’s &quot;Den&quot; &lt;3"');
		expect(html).not.toContain('<3');
	});
});

describe('the sign-in card', () => {
	it('names the instance only', () => {
		expect(signInPreview('Dice Den')).toEqual({ title: 'Sign in to Dice Den', description: expect.stringContaining('PIN') });
	});
});
