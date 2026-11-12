import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, CUBE_LAMINATE, isDeviceTheme, isThemeId, resolve, resolveTheme, THEME_IDS, themeBarColors, THEMES, themesCss, type Mode } from './themes.ts';

// Every text colour against every surface it's drawn on (DESIGN.md "Themes").
const PAIRS: Array<[string, string[]]> = [
	['--ink', ['--cube', '--laminate', '--gap', '--note', '--danger-soft']],
	['--ink-2', ['--cube', '--laminate', '--gap', '--note', '--danger-soft']],
	['--ink-3', ['--cube', '--laminate']],
	['--laminate', ['--ink']], // primary buttons
	['--label-ink', ['--label', '--label-field']],
	['--label-ink-2', ['--label', '--label-field']],
	['--mark-ink', ['--mark']],
	['--danger', ['--cube', '--laminate', '--danger-soft']]
];

describe('themes', () => {
	it('has twelve presets with unique ids', () => {
		expect(THEMES).toHaveLength(12);
		expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
		expect(isThemeId('dracula')).toBe(true);
		expect(isThemeId('cube')).toBe(true);
		expect(isThemeId('comic-sans')).toBe(false);
	});

	for (const theme of THEMES) {
		for (const mode of ['light', 'dark'] as Mode[]) {
			it(`${theme.label} ${mode} keeps every text at 4.5:1 or better`, () => {
				const tokens = resolve(theme[mode], mode);
				const low = PAIRS.flatMap(([fg, bgs]) =>
					bgs.filter((bg) => contrast(tokens[fg], tokens[bg]) < 4.5).map((bg) => `${fg} on ${bg}: ${contrast(tokens[fg], tokens[bg]).toFixed(2)}`)
				);
				expect(low).toEqual([]);
			});
		}
	}

	it('lets the device win, then the group, then the instance', () => {
		expect(resolveTheme('dracula', 'nord', 'cube')).toBe('dracula');
		expect(resolveTheme('auto', 'nord', 'cube')).toBe('nord');
		expect(resolveTheme('auto', null, 'gruvbox')).toBe('gruvbox');
		expect(resolveTheme(undefined, 'not-a-theme', 'cube')).toBe('cube');
		expect(isDeviceTheme('auto')).toBe(true);
		expect(isThemeId('auto')).toBe(false);
	});

	it('matches the generated stylesheet (run node scripts/gen-themes.ts after editing themes.ts)', () => {
		expect(readFileSync(new URL('./themes.css', import.meta.url), 'utf8')).toBe(themesCss());
	});
});

describe('themeBarColors', () => {
	it('takes the cube shelf\'s page colours from app.css', () => {
		const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
		const laminates = [...css.matchAll(/--laminate: (#[0-9a-f]{6})/g)].map((m) => m[1]);
		expect(laminates.slice(0, 2)).toEqual([CUBE_LAMINATE.light, CUBE_LAMINATE.dark]);
		expect(themeBarColors('cube', null)).toEqual(CUBE_LAMINATE);
	});

	it('gives a preset its light and dark page, and the custom theme its one page in both', () => {
		const nord = THEMES.find((t) => t.id === 'nord')!;
		expect(themeBarColors('nord', null)).toEqual({ light: nord.light.laminate, dark: nord.dark.laminate });
		expect(themeBarColors('custom', '#123456')).toEqual({ light: '#123456', dark: '#123456' });
		// A custom theme the hoster has since removed falls back to the cube shelf, as its CSS does.
		expect(themeBarColors('custom', null)).toEqual(CUBE_LAMINATE);
	});
});
