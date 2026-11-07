// "Who's here" on this device (PRD "Picker" and "At the table"). Pure: the caller supplies storage
// and the clock. Members are ticked by id; guests are names typed in for people without an account.

export type Here = { members: string[]; guests: string[] };

/** Who's here resets this long after the last change, so last week's table doesn't carry over. */
export const HERE_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_GUESTS = 20;
export const MAX_GUEST_NAME = 30;

export const EMPTY_HERE: Here = { members: [], guests: [] };

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** Reads a stored value. Anything unreadable, from before guests existed, or older than the TTL is empty. */
export function parseHere(raw: string | null, now: number): Here {
	if (!raw) return EMPTY_HERE;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return EMPTY_HERE;
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return EMPTY_HERE;
	const { members, guests, at } = value as Record<string, unknown>;
	if (typeof at !== 'number' || !(now - at < HERE_TTL_MS) || at > now + HERE_TTL_MS) return EMPTY_HERE;
	return { members: [...new Set(strings(members))], guests: cleanGuests(strings(guests)) };
}

export function serializeHere(here: Here, now: number): string {
	return JSON.stringify({ members: here.members, guests: here.guests, at: now });
}

/** A guest's name with spaces tidied and the length capped, or null when nothing is left. */
export function cleanGuestName(raw: string): string | null {
	const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_GUEST_NAME).trim();
	return name || null;
}

/** Adds a guest unless the name is empty, already listed (ignoring case) or the list is full. */
export function addGuest(guests: readonly string[], raw: string): string[] {
	const name = cleanGuestName(raw);
	if (!name || guests.length >= MAX_GUESTS) return [...guests];
	if (guests.some((g) => g.toLowerCase() === name.toLowerCase())) return [...guests];
	return [...guests, name];
}

/** Cleans, de-duplicates and caps a list of guest names, for storage and setup links. */
export function cleanGuests(raw: readonly string[]): string[] {
	return raw.reduce<string[]>((list, name) => addGuest(list, name), []);
}
