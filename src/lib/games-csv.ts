// "Your games" as a CSV (PRD "Account"): your shelf and your wishlist, to keep or to take to another
// Box Populi. The first three columns are the ones "Paste a list" reads, so copying them from a
// spreadsheet adds the games anywhere. BGG games carry their name, year and BGG id only, never
// BGG's players, times or statistics (TECH.md "Access and terms").
import { csvField, csvFile, SOURCE_LABEL, type GameSource } from './csv.ts';

export type YourGame = {
	list: 'shelf' | 'wishlist';
	name: string;
	year: number | null;
	source: GameSource;
	bggId: number | null;
	wikidataId: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	addedAt: number;
	/** Who has the copy now: a member's name or what was typed for someone outside the app. */
	lentTo: string | null;
	note: string | null;
};

export const GAMES_CSV_COLUMNS = ['game', 'players', 'minutes', 'list', 'year', 'game_data_from', 'bgg_id', 'wikidata_id', 'added', 'lent_to', 'note'];

/** "2-4", "2" or empty, as "Paste a list" reads it. */
export function rangeText(lo: number | null, hi: number | null): string | null {
	const from = lo ?? hi;
	if (from == null) return null;
	return hi == null || hi === from ? String(from) : `${from}-${hi}`;
}

/** Shelf first, then the wishlist, each by name. */
export function gamesCsv(games: readonly YourGame[]): string {
	const sorted = [...games].sort((a, b) => (a.list === b.list ? a.name.localeCompare(b.name) : a.list === 'shelf' ? -1 : 1));
	const lines = [GAMES_CSV_COLUMNS.join(',')];
	for (const g of sorted) {
		const bgg = g.source === 'bgg';
		lines.push(
			[
				csvField(g.name, bgg),
				// Players and times typed in or from Wikidata (CC0) travel; BGG's stay with BGG.
				csvField(bgg ? null : rangeText(g.minPlayers, g.maxPlayers)),
				csvField(bgg ? null : rangeText(g.minPlaytime, g.maxPlaytime)),
				csvField(g.list),
				csvField(g.year),
				csvField(SOURCE_LABEL[g.source]),
				csvField(g.bggId),
				csvField(g.wikidataId),
				csvField(new Date(g.addedAt).toISOString().slice(0, 10)),
				csvField(g.lentTo),
				csvField(g.note)
			].join(',')
		);
	}
	return csvFile(lines);
}
