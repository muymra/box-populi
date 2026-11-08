// A group's game nights as a CSV (PRD "Play log", "Export"), beside the plays: one row per person per
// night, and one more for each further game they brought, so who came and who brought what can be
// filtered in a spreadsheet. Game names and BGG ids only; BGG is named on the rows that carry its data.
import { csvField, csvFile, SOURCE_LABEL, type GameSource } from './csv.ts';
import type { Night, NightGame } from './nights.ts';

export const NIGHTS_CSV_COLUMNS = ['date', 'starts', 'game_night', 'host', 'person', 'person_type', 'answer', 'brought', 'game_data_from', 'bgg_id', 'stayed_home', 'night_id'];

export type NightGameInfo = { name: string; source: GameSource; bggId: number | null };

type Person = { userId: string | null; guestName: string | null; going: boolean | null };

/** Everyone on a night: who answered, in the order they did, then anyone who brought a game without answering. */
function nightPeople(night: Night): Person[] {
	const people: Person[] = night.people.map((p) => ({ userId: p.userId, guestName: p.guestName, going: p.going }));
	const has = (g: NightGame) => people.some((p) => (g.guestName != null ? p.guestName === g.guestName : p.userId === g.broughtBy));
	for (const g of night.games) if (!has(g)) people.push({ userId: g.broughtBy, guestName: g.guestName, going: null });
	return people;
}

/**
 * Newest night first. `nameOf` gives a member's name, or null for someone no longer in the group, who
 * shows as "a former member"; `gameOf` gives the game's name (with the group's corrections) and source.
 */
export function nightsCsv(
	nights: readonly Night[],
	nameOf: (userId: string) => string | null,
	gameOf: (gameId: number) => NightGameInfo | null
): string {
	const sorted = [...nights].sort((a, b) => b.nightOn.localeCompare(a.nightOn) || (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
	const lines = [NIGHTS_CSV_COLUMNS.join(',')];
	for (const night of sorted) {
		const host = night.hostId ? (nameOf(night.hostId) ?? 'a former member') : null;
		for (const person of nightPeople(night)) {
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
