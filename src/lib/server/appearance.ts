// The instance's own look (DESIGN.md "Themes"): a custom theme from five colours and an optional
// logo, both set on /admin. Read on every request, so cached per isolate for a minute; a save
// clears this isolate's copy, and others catch up within the minute.
import { one, run, type DB } from './db.ts';
import { CUSTOM_DEFAULTS, isHex, type CustomColors } from '#lib/themes.ts';

export type Appearance = {
	colors: CustomColors | null;
	/** Show the custom theme to everyone by default, instead of THEME. */
	customDefault: boolean;
	logoUrl: string | null;
	/** Changes on every save; busts the stylesheet's cache. */
	version: number;
};

const NONE: Appearance = { colors: null, customDefault: false, logoUrl: null, version: 0 };
const TTL_MS = 60_000;
let cached: { value: Appearance; at: number } | null = null;

function parseColors(raw: string | null): CustomColors | null {
	if (!raw) return null;
	try {
		const c = JSON.parse(raw) as Record<string, unknown>;
		const keys = Object.keys(CUSTOM_DEFAULTS) as Array<keyof CustomColors>;
		return keys.every((k) => isHex(c[k])) ? (Object.fromEntries(keys.map((k) => [k, c[k]])) as CustomColors) : null;
	} catch {
		return null;
	}
}

export async function getAppearance(db: DB, now = Date.now()): Promise<Appearance> {
	if (cached && now - cached.at < TTL_MS) return cached.value;
	// Before migration 0004 runs the table doesn't exist; the instance just has no custom look.
	const row = await one<{ custom_colors: string | null; custom_default: number; logo_url: string | null; updated_at: number }>(
		db,
		'SELECT custom_colors, custom_default, logo_url, updated_at FROM instance_settings WHERE id = 1'
	).catch(() => null);
	const value: Appearance = row
		? { colors: parseColors(row.custom_colors), customDefault: row.custom_default === 1, logoUrl: row.logo_url, version: row.updated_at }
		: NONE;
	cached = { value, at: now };
	return value;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Saves the form on /admin. `remove` clears the custom theme; the logo has its own field. */
export async function saveAppearance(db: DB, form: FormData, now: number): Promise<SaveResult> {
	const remove = form.get('remove') === '1';
	let colors: CustomColors | null = null;
	if (!remove) {
		const picked = Object.fromEntries((Object.keys(CUSTOM_DEFAULTS) as Array<keyof CustomColors>).map((k) => [k, String(form.get(k) ?? '')]));
		if (!Object.values(picked).every(isHex)) return { ok: false, error: 'Each colour must be a hex value like #2b2a28.' };
		colors = picked as CustomColors;
	}
	const rawLogo = String(form.get('logoUrl') ?? '').trim();
	let logoUrl: string | null = null;
	if (rawLogo) {
		try {
			const url = new URL(rawLogo);
			if (url.protocol !== 'https:' || rawLogo.length > 500) throw new Error();
			logoUrl = url.toString();
		} catch {
			return { ok: false, error: 'The logo address must start with https:// (up to 500 characters).' };
		}
	}
	await run(
		db,
		'UPDATE instance_settings SET custom_colors = ?1, custom_default = ?2, logo_url = ?3, updated_at = ?4 WHERE id = 1',
		colors ? JSON.stringify(colors) : null,
		colors && form.get('customDefault') === 'on' ? 1 : 0,
		logoUrl,
		now
	);
	cached = null;
	return { ok: true };
}

/** For tests: forget the cached settings. */
export function forgetAppearance(): void {
	cached = null;
}
