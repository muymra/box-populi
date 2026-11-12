// Game nights (PRD "Game night"): the pool a night plays from, who's going, and the text for the
// group chat. Pure, so the pages, the server and the tests share it.
import { expansionsOnHand, type OnHand } from './catalog/extensions.ts';
import { isCopyAtHand } from './catalog/pick.ts';
import type { CatalogGame } from './catalog/types.ts';

/** `came`: who came, checked after the night (D67); null until someone does. */
export type NightPerson = { userId: string | null; guestName: string | null; going: boolean; came: boolean | null };
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

type PlayedBy = { players: readonly { userId: string | null; guestName: string | null }[] };

/** The members and guests in a night's logged plays: they came, whatever anyone marked (D67). */
export function nightPlayers(plays: readonly PlayedBy[]): { members: Set<string>; guests: Set<string> } {
	const members = new Set<string>();
	const guests = new Set<string>();
	for (const play of plays)
		for (const p of play.players) {
			if (p.userId) members.add(p.userId);
			else if (p.guestName) guests.add(p.guestName);
		}
	return { members, guests };
}

/** Whether anyone has checked who came (D67). Until someone does, a night counts its going list. */
export function cameChecked(night: Night): boolean {
	return night.people.some((p) => p.came != null);
}

const sameGuest = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Who came to a night (D67): anyone in a play logged on it, then anyone marked as having come, or,
 * for someone nobody marked, anyone who said they'd go. Members still in the group, in the order
 * they answered, then members who only played; guests the same way.
 */
export function cameList(night: Night, memberIds: ReadonlySet<string>, played: { members: ReadonlySet<string>; guests: ReadonlySet<string> }): { members: string[]; guests: string[] } {
	const members = night.people.flatMap((p) => (p.userId && memberIds.has(p.userId) && (played.members.has(p.userId) || (p.came ?? p.going)) ? [p.userId] : []));
	for (const id of played.members) if (memberIds.has(id) && !members.includes(id)) members.push(id);
	const guests = night.people.flatMap((p) => {
		const name = p.guestName;
		return name && ([...played.guests].some((g) => sameGuest(g, name)) || (p.came ?? p.going)) ? [name] : [];
	});
	for (const g of played.guests) if (!guests.some((x) => sameGuest(x, g))) guests.push(g);
	return { members, guests };
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
 * The expansions a night's suggestions count (D73, STATUS item 55), as Play tonight does with the
 * night's people here: one a member going (or the host) has at hand, or one on the bring list that
 * isn't staying home.
 */
export function nightExpansions(night: Night, catalog: readonly CatalogGame[], memberIds: ReadonlySet<string>): OnHand {
	const listed = nightPoolIds(night, catalog, memberIds);
	const people = new Set(goingMembers(night, memberIds));
	if (night.hostId && memberIds.has(night.hostId)) people.add(night.hostId);
	return expansionsOnHand(catalog, (c, g) => listed.has(g.id) || isCopyAtHand(c, people));
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

type RecapPlay = { gameName: string; coop: 'won' | 'lost' | null; players: readonly { userId: string | null; guestName: string | null; place: number | null }[] };

/** "Bram won", "Ada and Bram won", "co-op, won", or nothing for a play logged without places. */
export function playOutcome(play: RecapPlay, name: (p: { userId: string | null; guestName: string | null }) => string): string {
	if (play.coop) return `co-op, ${play.coop}`;
	const places = play.players.map((p) => p.place);
	const winners = play.players.filter((p) => p.place === 1 && places.some((q) => q != null && q > 1)).map(name);
	if (!winners.length) return '';
	return `${winners.length > 1 ? `${winners.slice(0, -1).join(', ')} and ${winners.at(-1)}` : winners[0]} won`;
}

/**
 * A past night for the chat (D67): who came, what got played and who won, and what was brought but
 * not played, then the link.
 */
export function recapText(
	night: Night,
	came: { members: string[]; guests: string[] },
	plays: readonly RecapPlay[],
	broughtNotPlayed: readonly string[],
	member: (id: string) => string,
	url: string
): string {
	const people = [...came.members.map(member), ...came.guests];
	const name = (p: { userId: string | null; guestName: string | null }) => p.guestName ?? (p.userId ? member(p.userId) : 'someone');
	const lines = [`${night.name}, ${nightDate(night.nightOn)}: ${people.length} came${people.length ? ` (${people.join(', ')})` : ''}`];
	if (plays.length) {
		lines.push(
			`Played: ${plays
				.map((p) => {
					const outcome = playOutcome(p, name);
					return outcome ? `${p.gameName} (${outcome})` : p.gameName;
				})
				.join(', ')}`
		);
	}
	if (broughtNotPlayed.length) lines.push(`Brought, not played: ${broughtNotPlayed.join(', ')}`);
	lines.push(url);
	return lines.join('\n');
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

/**
 * The game nights the log form offers: the page's list of recent ones, plus the play's own night and
 * the night a new play is logged at, which can be older than the list (D70). Without them, saving an
 * older play would quietly take it off its night.
 */
export function nightOptions<N extends { id: string }>(recent: readonly N[], ...always: Array<N | null>): N[] {
	const out = [...recent];
	for (const n of always) if (n && !out.some((m) => m.id === n.id)) out.push(n);
	return out;
}

