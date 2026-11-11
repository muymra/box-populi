import { describe, expect, it } from 'vitest';
import { robotsTxt } from './robots.ts';

describe('robots.txt', () => {
	it('keeps crawlers out of /admin and sign-in links when search engines are allowed', () => {
		expect(robotsTxt('allow')).toBe('User-agent: *\nDisallow: /admin\nDisallow: /key/\n');
	});

	it('blocks everyone, but lets chat apps’ preview crawlers read what a card needs (D72)', () => {
		const txt = robotsTxt('block');
		const [previews, everyone] = txt.split('\n\n');
		expect(previews).toContain('User-agent: Twitterbot\n');
		expect(previews).toContain('User-agent: facebookexternalhit\n');
		expect(previews).toMatch(/Allow: \/join\/\nAllow: \/signin\nAllow: \/preview\.png\nDisallow: \/$/);
		expect(everyone).toBe('User-agent: *\nDisallow: /\n');
		expect(txt).not.toMatch(/Googlebot|GPTBot|meta-externalagent|Allow: \/g\//);
	});
});
