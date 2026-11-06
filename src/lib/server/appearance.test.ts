import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { forgetAppearance, getAppearance, saveAppearance } from './appearance.ts';
import { contrast, customPalette, customThemeCss, resolve } from '#lib/themes.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};
const colors = { page: '#101820', surface: '#18242f', ink: '#e8e3d3', strip: '#24364a', accent: '#f2aa4c' };

beforeEach(() => {
	db = createTestDb();
	forgetAppearance();
});

describe('the instance look', () => {
	it('starts with nothing, saves colours, the default flag and a logo, and removes the theme', async () => {
		expect(await getAppearance(db, NOW)).toEqual({ colors: null, customDefault: false, logoUrl: null, version: 0 });
		expect(await saveAppearance(db, form({ ...colors, customDefault: 'on', logoUrl: 'https://example.com/logo.svg' }), NOW)).toEqual({ ok: true });
		expect(await getAppearance(db, NOW + 1)).toEqual({ colors, customDefault: true, logoUrl: 'https://example.com/logo.svg', version: NOW });
		await saveAppearance(db, form({ remove: '1', customDefault: 'on', logoUrl: 'https://example.com/logo.svg' }), NOW + 2);
		expect(await getAppearance(db, NOW + 3)).toMatchObject({ colors: null, customDefault: false, logoUrl: 'https://example.com/logo.svg' });
	});

	it('takes hex codes with or without #, in either case, and the short form', async () => {
		expect(await saveAppearance(db, form({ ...colors, page: '101820', ink: '#E8E3D3', accent: 'f2a' }), NOW)).toEqual({ ok: true });
		expect((await getAppearance(db, NOW + 1)).colors).toEqual({ ...colors, accent: '#ff22aa' });
	});

	it('refuses bad colours and logos that aren’t https', async () => {
		expect((await saveAppearance(db, form({ ...colors, ink: 'red' }), NOW)).ok).toBe(false);
		expect((await saveAppearance(db, form({ ...colors, logoUrl: 'http://example.com/logo.png' }), NOW)).ok).toBe(false);
		expect((await saveAppearance(db, form({ ...colors, logoUrl: 'javascript:alert(1)' }), NOW)).ok).toBe(false);
	});
});

describe('custom palettes', () => {
	const PAIRS: Array<[string, string]> = [
		['--ink', '--cube'],
		['--ink', '--gap'],
		['--ink-2', '--gap'],
		['--ink-3', '--laminate'],
		['--laminate', '--ink'],
		['--label-ink', '--label'],
		['--label-ink-2', '--label-field'],
		['--mark-ink', '--mark'],
		['--danger', '--cube']
	];
	const cases = [
		colors,
		{ page: '#f4f4f2', surface: '#ffffff', ink: '#2b2a28', strip: '#2b2a28', accent: '#e9b44c' },
		{ page: '#ffffff', surface: '#ffffff', ink: '#bbbbbb', strip: '#eeeeee', accent: '#ffff00' }, // careless choices
		{ page: '#000000', surface: '#111111', ink: '#444444', strip: '#000000', accent: '#0000ff' }
	];
	for (const c of cases) {
		it(`keeps text readable for page ${c.page}, text ${c.ink}`, () => {
			const { palette, mode } = customPalette(c);
			const t = resolve(palette, mode);
			expect(PAIRS.filter(([a, b]) => contrast(t[a], t[b]) < 4.5).map(([a, b]) => `${a}/${b} ${contrast(t[a], t[b]).toFixed(2)}`)).toEqual([]);
		});
	}

	it('writes one block for the custom theme', () => {
		const css = customThemeCss(colors);
		expect(css).toContain(":root[data-theme='custom'] {");
		expect(css).not.toContain('@media');
	});
});
