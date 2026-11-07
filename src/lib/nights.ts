// Game nights (PRD "Game night"): the pool a night plays from, who's going, and the text for the
// group chat. Pure, so the pages, the server and the tests share it.
import { isCopyAtHand } from './catalog/pick.ts';
import type { CatalogGame } from './catalog/types.ts';

export type NightPerson = { userId: string | null; guestName: string | null; going: boolean };
export type NightGame = { gameId: number; broughtBy: string | null; guestName: string | null; addedBy: string | null; stayedHome: boolean };
export type Night = {
	id: string;
	name: string;
	nightOn: string;
	startsAt: string | null;
	hostId: string | null;
	createdBy: string | null;
	people: NightPerson[];
	games: NightGame[];
};

export const MAX_NIGHT_NAME = 60;

/** Members marked going who are still in the group, in the order they were added. */
export function goingMembers(night: Night, memberIds: ReadonlySet<string>): string[] {
	return night.people.flatMap((p) => (p.userId && p.going && memberIds.has(p.userId) ? [p.userId] : []));
}

export function nightGuests(night: Night): string[] {
	return night.people.flatMap((p) => (p.guestName ? [p.guestName] : []));
}

/**
 * Whether a brought game is on the night's list: its bringer is a guest or still in the group. A
 * member who left takes their games with them; one who said no still shows, so it can be fixed.
 */
function stillComing(g: NightGame, memberIds: ReadonlySet<string>): boolean {
	return g.guestName != null || (g.broughtBy != null && memberIds.has(g.broughtBy));
}

/** The bring list as shown: games still coming, grouped later by bringer. */
export function bringList(night: Night, memberIds: ReadonlySet<string>): NightGame[] {
	return night.games.filter((g) => stillComing(g, memberIds));
}

/**
 * The games a night plays from: the bring list minus anything that stayed home, plus the host's
 * own copies (not lent out) when it's at a member's home. Ids only; the caller has the games.
 */
export function nightPoolIds(night: Night, catalog: readonly CatalogGame[], memberIds: ReadonlySet<string>): Set<number> {
	const ids = new Set(bringList(night, memberIds).flatMap((g) => (g.stayedHome ? [] : [g.gameId])));
	if (night.hostId && memberIds.has(night.hostId)) {
		const host = new Set([night.hostId]);
		for (const game of catalog) if (game.copies.some((c) => c.ownerId === night.hostId && isCopyAtHand(c, host))) ids.add(game.id);
	}
	return ids;
}

/**
 * What seeds tonight's who's here from the night (D38): its going members and guests, keyed by
 * that list, so a change to the night reseeds the device but the device's own ticks otherwise stay.
 */
export function tonightSeed(night: Night | null, memberIds: ReadonlySet<string>): { key: string; members: string[]; guests: string[] } | null {
	if (!night) return null;
	const members = goingMembers(night, memberIds);
	const guests = nightGuests(night);
	return { key: `${night.id}:${members.join(',')}|${guests.join(',')}`, members, guests };
}

/** The night whose date is `today`, if any; the earliest planned when two share a date. */
export function nightOn(nights: readonly Night[], today: string): Night | null {
	return nights.find((n) => n.nightOn === today) ?? null;
}

/** "Fri 14 Nov", or "Fri 14 Nov 2027" when it isn't this year. */
export function nightDate(day: string, thisYear = new Date().getFullYear()): string {
	const d = new Date(`${day}T12:00:00`);
	return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === thisYear ? undefined : 'numeric' });
}

/** A start time as typed, HH:MM in 24 hours, or null. */
export function cleanTime(raw: string): string | null | 'bad' {
	const t = raw.trim();
	if (!t) return null;
	const m = /^(\d{1,2}):(\d{2})$/.exec(t);
	if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return 'bad';
	return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** What "Copy for the chat" copies: date and place, who's going, the bring list by person, the link. */
export function chatText(
	night: Night,
	memberIds: ReadonlySet<string>,
	names: { member: (id: string) => string; game: (id: number) => string },
	url: string
): string {
	const when = `${nightDate(night.nightOn)}${night.startsAt ? `, ${night.startsAt}` : ''}`;
	const where = night.hostId && memberIds.has(night.hostId) ? `at ${names.member(night.hostId)}'s` : night.name;
	const going = [...goingMembers(night, memberIds).map(names.member), ...nightGuests(night)];
	const byPerson = new Map<string, string[]>();
	for (const g of bringList(night, memberIds)) {
		const who = g.guestName ?? names.member(g.broughtBy!);
		byPerson.set(who, [...(byPerson.get(who) ?? []), names.game(g.gameId)]);
	}
	const lines = [`${night.name}: ${when}${where === night.name ? '' : `, ${where}`}`];
	if (going.length) lines.push(`Going: ${going.join(', ')}`);
	if (byPerson.size) {
		lines.push('Bringing:');
		for (const [who, games] of byPerson) lines.push(`${who}: ${games.join(', ')}`);
	}
	lines.push(url);
	return lines.join('\n');
}
