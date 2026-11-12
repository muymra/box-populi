import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_SCREEN_ICONS, START_PATH, startPath, webManifest } from './home-screen.ts';

describe('webManifest', () => {
	const m = webManifest('Our Games', '#ece9df');

	it('names the app after the instance and opens it standalone, from the start page', () => {
		expect(m).toMatchObject({ name: 'Our Games', short_name: 'Our Games', display: 'standalone', start_url: START_PATH, scope: '/', id: '/' });
		expect(new URL(m.start_url, 'https://x.example').pathname.startsWith(m.scope)).toBe(true);
	});

	it('takes the page colour for the bar and the opening screen', () => {
		expect(m.theme_color).toBe('#ece9df');
		expect(m.background_color).toBe('#ece9df');
	});

	it('has the 192 and 512 icons installing needs, and one a launcher may cut to shape', () => {
		expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
	});

	it('lists only icons that are in static/ at their stated size', () => {
		for (const icon of HOME_SCREEN_ICONS) {
			const file = readFileSync(new URL(`../../../static${icon.src}`, import.meta.url));
			// A PNG's width and height are the first two numbers of its IHDR chunk, from byte 16.
			expect(file.subarray(12, 16).toString('ascii')).toBe('IHDR');
			expect(`${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`).toBe(icon.sizes);
		}
	});
});

describe('startPath', () => {
	it('goes to the group this device had open last when the viewer is in it', () => {
		expect(startPath('g1', ['g1', 'g2'], false)).toBe('/g/g1');
	});

	it('stays on the home page with no group remembered, or one the viewer has left', () => {
		expect(startPath(undefined, ['g1'], true)).toBeNull();
		expect(startPath('gone', ['g1'], true)).toBeNull();
		expect(startPath('g1', [], false)).toBeNull();
	});

	it('opens the demo group for anyone while it exists', () => {
		expect(startPath('demo', [], true)).toBe('/g/demo');
		expect(startPath('demo', [], false)).toBeNull();
	});
});
