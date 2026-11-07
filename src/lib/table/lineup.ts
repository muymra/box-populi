// Tonight's kept games on this device (PRD "Picker"): the ids kept in the lineup and among the fillers,
// and whose games count when no game night is planned (`at`: a host's member id, or null for everything
// the people here own, D40).
// Pure: the caller supplies storage and the clock. Like who's here, it resets 12 hours after the last change.
import { MAX_CHOSEN } from '#lib/catalog/pick.ts';
import { HERE_TTL_MS } from './here.ts';

export type Lineup = { main: number[]; fillers: number[]; at?: string | null };

export const EMPTY_LINEUP: Lineup = { main: [], fillers: [], at: null };

/** A member id for `at`, or null: ids are short, so anything long or not a string is junk. */
export function cleanVenue(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
}

const ids = (value: unknown): number[] =>
	Array.isArray(value) ? [...new Set(value.filter((v): v is number => Number.isSafeInteger(v) && v > 0))].slice(0, MAX_CHOSEN) : [];

/** Reads a stored lineup. Anything unreadable or older than the reset is empty. */
export function parseLineup(raw: string | null, now: number): Lineup {
	if (!raw) return EMPTY_LINEUP;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return EMPTY_LINEUP;
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return EMPTY_LINEUP;
	const { main, fillers, at, venue } = value as Record<string, unknown>;
	if (typeof at !== 'number' || !(now - at < HERE_TTL_MS) || at > now + HERE_TTL_MS) return EMPTY_LINEUP;
	return { main: ids(main), fillers: ids(fillers), at: cleanVenue(venue) };
}

export function serializeLineup(lineup: Lineup, now: number): string {
	return JSON.stringify({ main: lineup.main, fillers: lineup.fillers, at: now, ...(lineup.at ? { venue: lineup.at } : {}) });
}

/** Game ids from a setup link's `keep` or `fkeep`: "12,40". Junk is dropped, and anything past MAX_CHOSEN. */
export function parseIdList(raw: string | null): number[] {
	return ids((raw ?? '').split(',').map((s) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN)));
}
