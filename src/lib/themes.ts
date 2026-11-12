// Colour themes (PRD stretch "Themes and branding", DESIGN.md "Themes"). Each preset maps a
// published palette onto the app's tokens for light and dark. Values come from each project's
// own source (named per theme); anything that would fall under 4.5:1 is nudged toward the
// theme's ink until it passes, so every theme stays readable. `scripts/gen-themes.ts` writes
// `src/lib/themes.css` from this file; `themes.test.ts` checks the CSS is current.
//
// The accent (`mark`) is always the theme's yellow: yellow is the one hue the eight player
// colours don't use, so "chosen" never reads as a person.
//
// The palettes' copyrights stay with their authors, under each project's licence: MIT for all but
// Tokyo Night (Apache-2.0); README.md "Credits" names them. Colours were adjusted here for
// contrast, as said above. Licences checked 2026-11-10.

export type Mode = 'light' | 'dark';

/** What a theme specifies per mode. Everything else is derived. */
export type Palette = {
	laminate: string; // page
	cube: string; // cubes, panels, fields
	gap: string; // the shelf gaps, tags
	rule: string; // borders
	ink: string;
	ink2: string;
	ink3: string;
	label: string; // the filter strip
	labelInk: string;
	labelInk2: string;
	mark: string; // chosen state: active filters, current tab, selected people
	markInk: string;
	danger: string;
};

export type Theme = { id: string; label: string; source: string; light: Palette; dark: Palette };

export const DEFAULT_THEME = 'cube';

export const THEMES: Theme[] = [
	{
		id: 'dracula',
		label: 'Dracula',
		source: 'spec.draculatheme.com (Dracula); dracula/dracula-css tokens (Alucard)',
		light: {
			laminate: '#ece9df',
			cube: '#f8f8f2',
			gap: '#dedccf',
			rule: '#ceccc0',
			ink: '#282a36',
			ink2: '#44475a',
			ink3: '#6272a4',
			label: '#282a36',
			labelInk: '#f8f8f2',
			labelInk2: '#bcbab3',
			mark: '#f1fa8c',
			markInk: '#282a36',
			danger: '#c33027'
		},
		dark: {
			laminate: '#21222c',
			cube: '#282a36',
			gap: '#343746',
			rule: '#424450',
			ink: '#f8f8f2',
			ink2: '#d4d4d0',
			ink3: '#a9abb8',
			label: '#191a21',
			labelInk: '#f8f8f2',
			labelInk2: '#bd93f9',
			mark: '#f1fa8c',
			markInk: '#282a36',
			danger: '#ff5555'
		}
	},
	{
		id: 'catppuccin',
		label: 'Catppuccin',
		source: 'catppuccin/palette palette.json (Latte, Mocha)',
		light: {
			laminate: '#e6e9ef',
			cube: '#eff1f5',
			gap: '#dce0e8',
			rule: '#ccd0da',
			ink: '#4c4f69',
			ink2: '#5c5f77',
			ink3: '#6c6f85',
			label: '#4c4f69',
			labelInk: '#eff1f5',
			labelInk2: '#ccd0da',
			mark: '#df8e1d',
			markInk: '#11111b',
			danger: '#d20f39'
		},
		dark: {
			laminate: '#181825',
			cube: '#1e1e2e',
			gap: '#313244',
			rule: '#45475a',
			ink: '#cdd6f4',
			ink2: '#bac2de',
			ink3: '#a6adc8',
			label: '#11111b',
			labelInk: '#cdd6f4',
			labelInk2: '#a6adc8',
			mark: '#f9e2af',
			markInk: '#11111b',
			danger: '#f38ba8'
		}
	},
	{
		id: 'solarized',
		label: 'Solarized',
		source: 'altercation/solarized (base03 to base3, accents)',
		light: {
			laminate: '#eee8d5',
			cube: '#fdf6e3',
			gap: '#e4dcc6',
			rule: '#d3cbb4',
			ink: '#073642',
			ink2: '#586e75',
			ink3: '#657b83',
			label: '#002b36',
			labelInk: '#eee8d5',
			labelInk2: '#93a1a1',
			mark: '#b58900',
			markInk: '#002b36',
			danger: '#dc322f'
		},
		dark: {
			laminate: '#00212b',
			cube: '#002b36',
			gap: '#073642',
			rule: '#2a4b53',
			ink: '#eee8d5',
			ink2: '#93a1a1',
			ink3: '#839496',
			label: '#073642',
			labelInk: '#eee8d5',
			labelInk2: '#93a1a1',
			mark: '#b58900',
			markInk: '#002b36',
			danger: '#dc322f'
		}
	},
	{
		id: 'gruvbox',
		label: 'Gruvbox',
		source: 'morhetz/gruvbox (bg0 to fg4, neutral and bright accents)',
		light: {
			laminate: '#ebdbb2',
			cube: '#fbf1c7',
			gap: '#d5c4a1',
			rule: '#bdae93',
			ink: '#3c3836',
			ink2: '#504945',
			ink3: '#7c6f64',
			label: '#282828',
			labelInk: '#fbf1c7',
			labelInk2: '#d5c4a1',
			mark: '#d79921',
			markInk: '#282828',
			danger: '#9d0006'
		},
		dark: {
			laminate: '#1d2021',
			cube: '#282828',
			gap: '#3c3836',
			rule: '#504945',
			ink: '#ebdbb2',
			ink2: '#d5c4a1',
			ink3: '#a89984',
			label: '#32302f',
			labelInk: '#ebdbb2',
			labelInk2: '#bdae93',
			mark: '#fabd2f',
			markInk: '#282828',
			danger: '#fb4934'
		}
	},
	{
		id: 'tokyo-night',
		label: 'Tokyo Night',
		source: 'folke/tokyonight.nvim extras/lua (Day, Night)',
		light: {
			laminate: '#d0d5e3',
			cube: '#e1e2e7',
			gap: '#c4c8da',
			rule: '#a8aecb',
			ink: '#3760bf',
			ink2: '#6172b0',
			ink3: '#68709a',
			label: '#1a1b26',
			labelInk: '#c0caf5',
			labelInk2: '#a9b1d6',
			mark: '#e0af68',
			markInk: '#1a1b26',
			danger: '#f52a65'
		},
		dark: {
			laminate: '#16161e',
			cube: '#1a1b26',
			gap: '#292e42',
			rule: '#3b4261',
			ink: '#c0caf5',
			ink2: '#a9b1d6',
			ink3: '#737aa2',
			label: '#292e42',
			labelInk: '#c0caf5',
			labelInk2: '#a9b1d6',
			mark: '#e0af68',
			markInk: '#1a1b26',
			danger: '#f7768e'
		}
	},
	{
		id: 'kanagawa',
		label: 'Kanagawa',
		source: 'rebelot/kanagawa.nvim lua/kanagawa/colors.lua (Lotus, Wave)',
		light: {
			laminate: '#e5ddb0',
			cube: '#f2ecbc',
			gap: '#dcd5ac',
			rule: '#d5cea3',
			ink: '#545464',
			ink2: '#716e61',
			ink3: '#8a8980',
			label: '#1f1f28',
			labelInk: '#dcd7ba',
			labelInk2: '#c8c093',
			mark: '#de9800',
			markInk: '#1f1f28',
			danger: '#c84053'
		},
		dark: {
			laminate: '#181820',
			cube: '#1f1f28',
			gap: '#2a2a37',
			rule: '#363646',
			ink: '#dcd7ba',
			ink2: '#c8c093',
			ink3: '#727169',
			label: '#363646',
			labelInk: '#dcd7ba',
			labelInk2: '#c8c093',
			mark: '#e6c384',
			markInk: '#1f1f28',
			danger: '#e46876'
		}
	},
	{
		id: 'nord',
		label: 'Nord',
		source: 'nordtheme/nord src/nord.css (Snow Storm for light, Polar Night for dark)',
		light: {
			laminate: '#e5e9f0',
			cube: '#eceff4',
			gap: '#d8dee9',
			rule: '#bcc3d0',
			ink: '#2e3440',
			ink2: '#3b4252',
			ink3: '#4c566a',
			label: '#2e3440',
			labelInk: '#eceff4',
			labelInk2: '#d8dee9',
			mark: '#ebcb8b',
			markInk: '#2e3440',
			danger: '#bf616a'
		},
		dark: {
			laminate: '#2e3440',
			cube: '#3b4252',
			gap: '#434c5e',
			rule: '#4c566a',
			ink: '#eceff4',
			ink2: '#d8dee9',
			ink3: '#aeb5c3',
			label: '#434c5e',
			labelInk: '#eceff4',
			labelInk2: '#d8dee9',
			mark: '#ebcb8b',
			markInk: '#2e3440',
			danger: '#bf616a'
		}
	},
	{
		id: 'everforest',
		label: 'Everforest',
		source: 'sainnhe/everforest autoload/everforest.vim (medium contrast)',
		light: {
			laminate: '#efebd4',
			cube: '#fdf6e3',
			gap: '#e6e2cc',
			rule: '#cccbba',
			ink: '#5c6a72',
			ink2: '#829181',
			ink3: '#939f91',
			label: '#2d353b',
			labelInk: '#d3c6aa',
			labelInk2: '#9da9a0',
			mark: '#dfa000',
			markInk: '#2d353b',
			danger: '#f85552'
		},
		dark: {
			laminate: '#232a2e',
			cube: '#2d353b',
			gap: '#3d484d',
			rule: '#475258',
			ink: '#d3c6aa',
			ink2: '#9da9a0',
			ink3: '#859289',
			label: '#343f44',
			labelInk: '#d3c6aa',
			labelInk2: '#9da9a0',
			mark: '#dbbc7f',
			markInk: '#2d353b',
			danger: '#e67e80'
		}
	},
	{
		id: 'rose-pine',
		label: 'Rosé Pine',
		source: 'rose-pine/rose-pine-palette palette.json (Dawn, Main)',
		light: {
			laminate: '#faf4ed',
			cube: '#fffaf3',
			gap: '#f2e9e1',
			rule: '#dfdad9',
			ink: '#464261',
			ink2: '#797593',
			ink3: '#9893a5',
			label: '#191724',
			labelInk: '#e0def4',
			labelInk2: '#908caa',
			mark: '#ea9d34',
			markInk: '#191724',
			danger: '#b4637a'
		},
		dark: {
			laminate: '#191724',
			cube: '#1f1d2e',
			gap: '#26233a',
			rule: '#403d52',
			ink: '#e0def4',
			ink2: '#908caa',
			ink3: '#6e6a86',
			label: '#26233a',
			labelInk: '#e0def4',
			labelInk2: '#908caa',
			mark: '#f6c177',
			markInk: '#191724',
			danger: '#eb6f92'
		}
	},
	{
		id: 'one',
		label: 'One Light and Dark',
		source: 'atom/atom packages/one-light-syntax and one-dark-syntax colors.less',
		light: {
			laminate: '#eaeaeb',
			cube: '#fafafa',
			gap: '#e5e5e6',
			rule: '#dbdbdc',
			ink: '#383a42',
			ink2: '#696c77',
			ink3: '#a0a1a7',
			label: '#282c34',
			labelInk: '#abb2bf',
			labelInk2: '#828997',
			mark: '#e5c07b',
			markInk: '#282c34',
			danger: '#e45649'
		},
		dark: {
			laminate: '#21252b',
			cube: '#282c34',
			gap: '#2c313a',
			rule: '#3e4451',
			ink: '#abb2bf',
			ink2: '#828997',
			ink3: '#5c6370',
			label: '#21252b',
			labelInk: '#abb2bf',
			labelInk2: '#828997',
			mark: '#e5c07b',
			markInk: '#282c34',
			danger: '#e06c75'
		}
	},
	{
		id: 'github',
		label: 'GitHub',
		source: '@primer/primitives 10 functional themes (light, dark)',
		light: {
			laminate: '#f6f8fa',
			cube: '#ffffff',
			gap: '#eceef0',
			rule: '#d1d9e0',
			ink: '#1f2328',
			ink2: '#59636e',
			ink3: '#59636e',
			label: '#1f2328',
			labelInk: '#ffffff',
			labelInk2: '#d1d9e0',
			mark: '#9a6700',
			markInk: '#ffffff',
			danger: '#d1242f'
		},
		dark: {
			laminate: '#010409',
			cube: '#0d1117',
			gap: '#151b23',
			rule: '#3d444d',
			ink: '#f0f6fc',
			ink2: '#9198a1',
			ink3: '#9198a1',
			label: '#151b23',
			labelInk: '#f0f6fc',
			labelInk2: '#9198a1',
			mark: '#9e6a03',
			markInk: '#ffffff',
			danger: '#f85149'
		}
	},
	{
		id: 'ayu',
		label: 'Ayu',
		source: 'ayu-theme/ayu-colors themes/light.yaml and dark.yaml (translucent text flattened)',
		light: {
			laminate: '#ebeef0',
			cube: '#fcfcfc',
			gap: '#f0f2f4',
			rule: '#d6dbe0',
			ink: '#5c6166',
			ink2: '#828e9f',
			ink3: '#828e9f',
			label: '#0d1017',
			labelInk: '#bfbdb6',
			labelInk2: '#5a6378',
			mark: '#f29718',
			markInk: '#0d1017',
			danger: '#e65050'
		},
		dark: {
			laminate: '#0c0e15',
			cube: '#10141c',
			gap: '#141821',
			rule: '#262b37',
			ink: '#bfbdb6',
			ink2: '#5a6378',
			ink3: '#5a6378',
			label: '#141821',
			labelInk: '#bfbdb6',
			labelInk2: '#5a6378',
			mark: '#e6b450',
			markInk: '#0d1017',
			danger: '#d95757'
		}
	}
];

/** The hoster's own theme, defined on /admin; its CSS comes from /custom-theme.css. */
export const CUSTOM_THEME = 'custom';

export const THEME_IDS = [DEFAULT_THEME, ...THEMES.map((t) => t.id)];
export const THEME_LABELS: Record<string, string> = {
	[DEFAULT_THEME]: 'Cube shelf',
	...Object.fromEntries(THEMES.map((t) => [t.id, t.label])),
	[CUSTOM_THEME]: 'Custom'
};

export function isThemeId(value: unknown): value is string {
	return typeof value === 'string' && (THEME_IDS.includes(value) || value === CUSTOM_THEME);
}

/** A device's setting: a theme id, or `auto` to follow the group's theme and then the instance's. */
export const AUTO_THEME = 'auto';

export function isDeviceTheme(value: unknown): value is string {
	return value === AUTO_THEME || isThemeId(value);
}

/** The cube shelf's page colour in each mode, from app.css (its own palette isn't in THEMES). */
export const CUBE_LAMINATE: Record<Mode, string> = { light: '#f4f4f2', dark: '#1c1916' };

/**
 * A theme's page colour in light and dark, for the browser's own bar around an installed app
 * (`<meta name="theme-color">`, D76). The custom theme has one palette, so it's the same in both.
 */
export function themeBarColors(id: string, customPage: string | null): Record<Mode, string> {
	if (id === CUSTOM_THEME && customPage) return { light: customPage, dark: customPage };
	const preset = THEMES.find((t) => t.id === id);
	return preset ? { light: preset.light.laminate, dark: preset.dark.laminate } : CUBE_LAMINATE;
}

/** What a page shows: the device's pick, else the group's theme (on its pages), else the instance default. */
export function resolveTheme(device: string | null | undefined, group: string | null | undefined, instance: string): string {
	if (isThemeId(device)) return device;
	if (isThemeId(group)) return group;
	return instance;
}

// Colour arithmetic in sRGB, enough for mixing tokens and checking WCAG contrast.

type Rgb = [number, number, number];

function parse(hex: string): Rgb {
	const h = hex.replace('#', '');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
	return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

/** `amount` of `b` mixed into `a`. */
export function mix(a: string, b: string, amount: number): string {
	const [x, y] = [parse(a), parse(b)];
	return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * amount) as Rgb);
}

function luminance(hex: string): number {
	const [r, g, b] = parse(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
	const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (l1 + 0.05) / (l2 + 0.05);
}

/** Moves `fg` toward `toward` in 5% steps until it reaches `min` against every background. */
export function ensureContrast(fg: string, backgrounds: string[], min: number, toward: string): string {
	let color = fg;
	for (let step = 1; step <= 20 && backgrounds.some((bg) => contrast(color, bg) < min); step++) color = mix(fg, toward, step / 20);
	return color;
}

export type Tokens = Record<string, string>;

/** The full token set for one theme and mode, keyed by CSS custom property name. */
export function resolve(p: Palette, mode: Mode): Tokens {
	// Readability fixes move a colour toward black on light themes and white on dark ones.
	const extreme = mode === 'light' ? '#000000' : '#ffffff';
	const labelExtreme = contrast(p.label, '#000000') > contrast(p.label, '#ffffff') ? '#000000' : '#ffffff';
	const labelField = mix(p.label, p.labelInk, 0.08);
	const dangerSoft = mix(p.cube, p.danger, 0.14);
	const note = mix(p.cube, p.mark, 0.18);
	const surfaces = [p.cube, p.laminate, p.gap, dangerSoft, note];
	const ink = ensureContrast(p.ink, surfaces, 4.5, extreme);
	const markInk = contrast(p.markInk, p.mark) >= 4.5 ? p.markInk : contrast(p.mark, '#000000') > contrast(p.mark, '#ffffff') ? '#000000' : '#ffffff';
	return {
		'--laminate': p.laminate,
		'--cube': p.cube,
		'--gap': p.gap,
		'--rule': p.rule,
		'--ink': ink,
		'--ink-2': ensureContrast(p.ink2, surfaces, 4.5, extreme),
		'--ink-3': ensureContrast(p.ink3, [p.cube, p.laminate], 4.5, extreme),
		'--label': p.label,
		'--label-ink': ensureContrast(p.labelInk, [p.label, labelField], 4.5, labelExtreme),
		'--label-ink-2': ensureContrast(p.labelInk2, [p.label, labelField], 4.5, labelExtreme),
		'--label-line': mix(p.label, p.labelInk, 0.3),
		'--label-field': labelField,
		'--mark': p.mark,
		'--mark-ink': markInk,
		'--danger': ensureContrast(p.danger, [p.cube, p.laminate, dangerSoft], 4.5, extreme),
		'--danger-soft': dangerSoft,
		'--note': note,
		'--focus': ink,
		// Which of a pair of pictures shows, for one made for light grounds and one for dark: the BGG
		// logo in the footer has both (display values, not colours).
		'--on-light': mode === 'light' ? 'block' : 'none',
		'--on-dark': mode === 'dark' ? 'block' : 'none'
	};
}

const chevron = (stroke: string) =>
	`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23${stroke.slice(1)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

function block(selector: string, tokens: Tokens, indent: string): string {
	const lines = Object.entries({
		...tokens,
		'--chevron': chevron(tokens['--ink']),
		'--chevron-label': chevron(tokens['--label-ink']),
		'--chevron-mark': chevron(tokens['--mark-ink'])
	}).map(([k, v]) => `${indent}\t${k}: ${v};`);
	return `${indent}${selector} {\n${lines.join('\n')}\n${indent}}`;
}

/** The stylesheet `scripts/gen-themes.ts` writes. Light by default, dark under the OS setting. */
export function themesCss(): string {
	const parts = THEMES.map((t) => {
		const selector = `:root[data-theme='${t.id}']`;
		return [
			`/* ${t.label}: ${t.source} */`,
			block(selector, resolve(t.light, 'light'), ''),
			`@media (prefers-color-scheme: dark) {\n${block(selector, resolve(t.dark, 'dark'), '\t')}\n}`
		].join('\n');
	});
	return `/* Generated by scripts/gen-themes.ts from src/lib/themes.ts. Don't edit by hand. */\n\n${parts.join('\n\n')}\n`;
}

/** The five colours a hoster picks for the custom theme. */
export type CustomColors = { page: string; surface: string; ink: string; strip: string; accent: string };

export const CUSTOM_DEFAULTS: CustomColors = { page: '#f4f4f2', surface: '#fbfbfa', ink: '#2b2a28', strip: '#2b2a28', accent: '#e9b44c' };

export function isHex(value: unknown): value is string {
	return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** "#2B2A28", "2b2a28" and "#2ba" all become "#2b2a28" (or "#22bbaa"); anything else is null. */
export function normalizeHex(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const hex = value.trim().replace(/^#/, '').toLowerCase();
	if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
	if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((c) => c + c).join('')}`;
	return null;
}

/**
 * A full palette from five colours. Light or dark follows the page colour; the shades between are
 * mixed from them, and resolve() then pulls any text under 4.5:1 toward black or white.
 */
export function customPalette(c: CustomColors): { palette: Palette; mode: Mode } {
	const mode: Mode = contrast(c.page, '#000000') > contrast(c.page, '#ffffff') ? 'light' : 'dark';
	const stripText = contrast(c.strip, '#ffffff') >= contrast(c.strip, '#000000') ? '#ffffff' : '#000000';
	const labelInk = contrast(c.strip, c.page) >= contrast(c.strip, c.ink) ? c.page : c.ink;
	return {
		mode,
		palette: {
			laminate: c.page,
			cube: c.surface,
			gap: mix(c.surface, c.ink, 0.1),
			rule: mix(c.surface, c.ink, 0.2),
			ink: c.ink,
			ink2: mix(c.ink, c.surface, 0.25),
			ink3: mix(c.ink, c.surface, 0.4),
			label: c.strip,
			labelInk: contrast(labelInk, c.strip) >= 4.5 ? labelInk : stripText,
			labelInk2: mix(contrast(labelInk, c.strip) >= 4.5 ? labelInk : stripText, c.strip, 0.3),
			mark: c.accent,
			markInk: contrast(c.accent, '#000000') > contrast(c.accent, '#ffffff') ? '#000000' : '#ffffff',
			danger: mode === 'light' ? '#a8321f' : '#f08a75'
		}
	};
}

/** The stylesheet /custom-theme.css serves: one palette, used whatever the device's light or dark setting. */
export function customThemeCss(c: CustomColors): string {
	const { palette, mode } = customPalette(c);
	return `/* The custom theme set on /admin. */\n${block(`:root[data-theme='${CUSTOM_THEME}']`, resolve(palette, mode), '')}\n`;
}
