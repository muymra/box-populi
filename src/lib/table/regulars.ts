// Regulars (PRD "Picker"): who this device has ticked as here on recent nights, so "who's here" can
// show the usual crowd first and fold everyone else behind "N more". Pure: the caller supplies the
// clock and storage. Stored per group as { memberId: ["2026-11-07", ...] }, newest first.

export type Regulars = Record<string, string[]>;

/** Nights older than this don't count. */
export const REGULAR_WINDOW_DAYS = 90;
/** Nights kept per member; enough to rank by. */
export const NIGHTS_KEPT = 12;
/** With more members than this, only the first SHOWN_MEMBERS (plus anyone ticked) show until "More". */
export const COLLAPSE_ABOVE = 10;
export const SHOWN_MEMBERS = 8;

/** The night something happened on: the local date six hours earlier, so 1 a.m. still counts as the evening before. */
export function nightOf(now: number): string {
	const d = new Date(now - 6 * 60 * 60 * 1000);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseRegulars(raw: string | null): Regulars {
	if (!raw) return {};
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
		const out: Regulars = {};
		for (const [id, nights] of Object.entries(value)) {
			if (!Array.isArray(nights)) continue;
			const clean = nights.filter((n): n is string => typeof n === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n));
			if (clean.length) out[id] = clean.slice(0, NIGHTS_KEPT);
		}
		return out;
	} catch {
		return {};
	}
}

/** Ticking someone records tonight; unticking them takes tonight back, so a mis-tap doesn't count. */
export function markNight(regulars: Regulars, id: string, night: string, here: boolean): Regulars {
	const others = (regulars[id] ?? []).filter((n) => n !== night);
	const nights = here ? [night, ...others].slice(0, NIGHTS_KEPT) : others;
	const out = { ...regulars };
	if (nights.length) out[id] = nights;
	else delete out[id];
	return out;
}

/** Nights within the window, counting back from tonight. */
export function recentNights(nights: readonly string[] | undefined, tonight: string): number {
	if (!nights) return 0;
	const [y, m, d] = tonight.split('-').map(Number);
	const cutoff = new Date(y, m - 1, d - REGULAR_WINDOW_DAYS);
	const from = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
	return nights.filter((n) => n > from && n <= tonight).length;
}

/**
 * Most nights here first. Ties keep the order given, which is the server's most recently active
 * first, so a device with no history still starts with the people who use the app.
 */
export function rankMembers<T extends { id: string }>(members: readonly T[], regulars: Regulars, tonight: string): T[] {
	return members
		.map((m, i) => ({ m, i, n: recentNights(regulars[m.id], tonight) }))
		.sort((a, b) => b.n - a.n || a.i - b.i)
		.map((x) => x.m);
}

/** The folded list: everyone when the group is small, otherwise the first few plus anyone in `keep`, in rank order. */
export function foldMembers<T extends { id: string }>(ranked: readonly T[], keep: ReadonlySet<string>): { shown: T[]; hidden: number } {
	if (ranked.length <= COLLAPSE_ABOVE) return { shown: [...ranked], hidden: 0 };
	const shown = ranked.filter((m, i) => i < SHOWN_MEMBERS || keep.has(m.id));
	return { shown, hidden: ranked.length - shown.length };
}
