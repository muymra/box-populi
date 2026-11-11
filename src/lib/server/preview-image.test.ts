import { describe, expect, it } from 'vitest';
import { linkPreview, PREVIEW_HEIGHT, PREVIEW_WIDTH, previewColors, previewPalette, previewPixels, previewPng } from './preview-image.ts';
import { CUSTOM_DEFAULTS } from '#lib/themes.ts';

const custom = { ...CUSTOM_DEFAULTS, page: '#102030', ink: '#eeeeee', accent: '#ffcc00' };

describe('the link preview picture (STATUS item 26, D72)', () => {
	it('takes its colours from the instance’s default theme', () => {
		expect(previewColors('cube', null)).toEqual({ page: '#f4f4f2', ink: '#2b2a28', accent: '#e9b44c' });
		expect(previewColors('gruvbox', null)).toEqual({ page: '#ebdbb2', ink: '#3c3836', accent: '#d79921' });
		expect(previewColors('custom', custom)).toEqual({ page: '#102030', ink: '#eeeeee', accent: '#ffcc00' });
		expect(previewColors('nonsense', null)).toEqual(previewColors('cube', null));
	});

	it('is the hoster’s logo as a small square when there is one, else the drawn picture with its colours in the address', () => {
		expect(linkPreview('Dice Den', 'gruvbox', { colors: null, logoUrl: 'https://example.org/logo.png' })).toEqual({
			image: 'https://example.org/logo.png',
			small: true,
			alt: 'The Dice Den logo'
		});
		expect(linkPreview('Dice Den', 'gruvbox', { colors: null, logoUrl: null })).toMatchObject({ image: '/preview.png?v=ebdbb2-3c3836-d79921', small: false });
	});

	it('draws the mark: page around it, ink on the frame, the two boxes, the accent rule', () => {
		const px = previewPixels();
		const palette = previewPalette(previewColors('cube', null));
		const at = (x: number, y: number) => palette[px[y * PREVIEW_WIDTH + x]];
		expect(at(0, 0)).toBe('#f4f4f2');
		expect(at(440, 280)).toBe('#2b2a28'); // the frame's left side
		expect(at(600, 200)).toBe('#2b2a28'); // the divider
		expect(at(523, 354)).toBe('#c8402e'); // the red box, bottom left
		expect(at(677, 205)).toBe('#b49a7a'); // the tan box, top right
		expect(at(500, 200)).toBe('#f4f4f2'); // an empty cubby
		expect(at(600, 516)).toBe('#e9b44c'); // the rule
		// The frame's rounded corner steps between the colours rather than jumping.
		const corner = new Set<string>();
		for (let y = 104; y < 124; y++) for (let x = 424; x < 444; x++) corner.add(at(x, y));
		expect(corner.size).toBeGreaterThan(4);
	});

	it('is a 1200×630 palette PNG whose pixels decode back', async () => {
		const png = await previewPng(previewColors('nord', null));
		expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		const view = new DataView(png.buffer, png.byteOffset);
		expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR');
		expect([view.getUint32(16), view.getUint32(20), png[24], png[25]]).toEqual([PREVIEW_WIDTH, PREVIEW_HEIGHT, 8, 3]);
		expect(png.length).toBeLessThan(40_000);
		// Find IDAT and inflate it.
		let at = 8;
		const idat: Uint8Array[] = [];
		while (at < png.length) {
			const length = view.getUint32(at);
			const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
			if (type === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length));
			at += 12 + length;
		}
		const inflated = new Uint8Array(await new Response(new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
		expect(inflated.length).toBe(PREVIEW_HEIGHT * (PREVIEW_WIDTH + 1));
		const pixels = previewPixels();
		const row = 354;
		expect([...inflated.subarray(row * (PREVIEW_WIDTH + 1) + 1, (row + 1) * (PREVIEW_WIDTH + 1))]).toEqual([...pixels.subarray(row * PREVIEW_WIDTH, (row + 1) * PREVIEW_WIDTH)]);
		expect(await previewPng(previewColors('nord', null))).toBe(png); // kept, not drawn again
	});

	it('draws quickly enough for the free plan’s CPU time', () => {
		const start = performance.now();
		previewPixels();
		expect(performance.now() - start).toBeLessThan(50);
	});
});
