// A group's game nights as a CSV (PRD "Play log", "Export"), beside the plays: one row per person per
// night, and one more for each further game they brought, so who came and who brought what can be
// filtered in a spreadsheet. Game names and BGG ids only; BGG is named on the rows that carry its data.
import { csvField, csvFile, SOURCE_LABEL, type GameSource } from './csv.ts';
import type { Night, NightGame } from './nights.ts';

export const NIGHTS_CSV_COLUMNS = ['date', 'starts', 'game_night', 'host', 'person', 'person_type', 'answer', 'came', 'brought', 'game_data_from', 'bgg_id', 'stayed_home', 'night_id'];

export type NightGameInfo = { name: string; source: GameSource; bggId: number | null };

type Person = { userId: string | null; guestName: string | null; going: boolean | null; came: boolean | null };
type Played = { members: ReadonlySet<string>; guests: ReadonlySet<string> };

/**
 * Who came, as the night's page counts it (D67, STATUS item 45): the members and guests in each night's
 * logged plays, by night id, and today's date, since only a night that has been has a "came".
 */
export type CameContext = { played: ReadonlyMap<string, Played>; today: string };

const sameGuest = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Everyone on a night: who answered, in the order they did, then anyone who brought a game without
 * answering, then anyone in a play on it who's on neither list.
 */
function nightPeople(night: Night, played: Played | undefined): Person[] {
	const people: Person[] = night.people.map((p) => ({ userId: p.userId, guestName: p.guestName, going: p.going, came: p.came }));
	const has = (g: NightGame) => people.some((p) => (g.guestName != null ? p.guestName === g.guestName : p.userId === g.broughtBy));
	for (const g of night.games) if (!has(g)) people.push({ userId: g.broughtBy, guestName: g.guestName, going: null, came: null });
	for (const id of played?.members ?? []) if (!people.some((p) => p.userId === id)) people.push({ userId: id, guestName: null, going: null, came: null });
	for (const name of played?.guests ?? [])
		if (!people.some((p) => p.guestName != null && sameGuest(p.guestName, name))) people.push({ userId: null, guestName: name, going: null, came: null });
	return people;
}

/** "yes" or "no" for a night that has been: in a play, else marked, else said they'd go; empty for one to come. */
function cameOf(person: Person, played: Played | undefined, been: boolean): string | null {
	if (!been) return null;
	const inPlay = person.userId != null ? (played?.members.has(person.userId) ?? false) : [...(played?.guests ?? [])].some((g) => sameGuest(g, person.guestName ?? ''));
	return inPlay || (person.came ?? person.going ?? false) ? 'yes' : 'no';
}

/**
 * Newest night first. `nameOf` gives a member's name, or null for someone no longer in the group, who
 * shows as "a former member"; `gameOf` gives the game's name (with the group's corrections) and source.
 */
export function nightsCsv(
	nights: readonly Night[],
	nameOf: (userId: string) => string | null,
	gameOf: (gameId: number) => NightGameInfo | null,
	came: CameContext
): string {
	const sorted = [...nights].sort((a, b) => b.nightOn.localeCompare(a.nightOn) || (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
	const lines = [NIGHTS_CSV_COLUMNS.join(',')];
	for (const night of sorted) {
		const host = night.hostId ? (nameOf(night.hostId) ?? 'a former member') : null;
		const played = came.played.get(night.id);
		const been = night.nightOn < came.today;
		for (const person of nightPeople(night, played)) {
			const member = person.userId ? nameOf(person.userId) : null;
			const name = person.guestName ?? member ?? 'a former member';
			const type = person.guestName != null ? 'guest' : member != null ? 'member' : 'former member';
			const answer = person.going == null ? null : person.going ? 'going' : 'not going';
			const brought = night.games.filter((g) => (person.guestName != null ? g.guestName === person.guestName : g.broughtBy === person.userId));
			const row = (g: NightGame | null) => {
				const game = g ? gameOf(g.gameId) : null;
				const bgg = game?.source === 'bgg';
				return [
					csvField(night.nightOn),
					csvField(night.startsAt),
					csvField(night.name),
					csvField(host),
					csvField(name),
					csvField(type),
					csvField(answer),
					csvField(cameOf(person, played, been)),
					csvField(game?.name ?? null, bgg),
					csvField(game ? SOURCE_LABEL[game.source] : null),
					csvField(game?.bggId ?? null),
					csvField(g ? (g.stayedHome ? 'yes' : 'no') : null),
					csvField(night.id)
				].join(',');
			};
			if (brought.length === 0) lines.push(row(null));
			else for (const g of brought) lines.push(row(g));
		}
	}
	return csvFile(lines);
}
