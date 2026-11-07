// The play log's rules (PRD "Play log"): places from scores, podium points, standings and the CSV
// export. Pure, so the form, the pages and the tests share them.

export type Coop = 'won' | 'lost';
export type PlayPlayer = { userId: string | null; guestName: string | null; place: number | null; score: number | null };
export type GameSource = 'bgg' | 'wikidata' | 'manual';
export type Play = {
	id: string;
	gameId: number;
	gameName: string;
	bggId: number | null;
	/** Where the game's details came from, for crediting BGG only on rows with BGG data. */
	gameSource: GameSource;
	playedOn: string;
	coop: Coop | null;
	players: PlayPlayer[];
};

export const DEFAULT_POINTS = [3, 2, 1];
export const MAX_POINT_PLACES = 5;
export const MAX_POINTS = 100;
export const MAX_PLAY_PLAYERS = 30;
export const MAX_SCORE = 1_000_000;

/** Competition ranking: equal scores share a place and the next place is skipped (1, 1, 3). Missing scores come last. */
export function placesFromScores(scores: readonly (number | null)[], lowestWins: boolean): number[] {
	const better = (a: number, b: number) => (lowestWins ? a < b : a > b);
	const scored = scores.filter((s): s is number => s != null);
	const last = scored.length + 1;
	return scores.map((s) => (s == null ? last : 1 + scored.filter((o) => better(o, s)).length));
}

/** Places someone picked by hand, with anyone left unplaced sharing the place after the last one given. */
export function fillPlaces(places: readonly (number | null)[]): number[] {
	const given = places.filter((p): p is number => p != null);
	const last = given.length ? Math.max(...given) + 1 : 1;
	return places.map((p) => p ?? last);
}

/**
 * Points for one competitive play. A player scores only if someone finished below them, so last
 * place never scores and a draw among everyone scores nothing. Ties take their shared place's points.
 */
export function playPoints(places: readonly number[], scheme: readonly number[]): number[] {
	const worst = Math.max(...places);
	return places.map((p) => (p < worst ? (scheme[p - 1] ?? 0) : 0));
}

/** A win: first place in a competitive play where someone finished below. Ties for first share it. */
export function isWin(place: number | null, places: readonly (number | null)[]): boolean {
	if (place !== 1) return false;
	return places.some((p) => p != null && p > 1);
}

/** "3, 2, 1" or "5,3,1,0" into numbers: one to five whole numbers from 0 to 100. Null when it isn't that. */
export function parsePoints(raw: unknown): number[] | null {
	if (typeof raw !== 'string') return null;
	const parts = raw.split(/[\s,]+/).filter(Boolean);
	if (parts.length < 1 || parts.length > MAX_POINT_PLACES) return null;
	const numbers = parts.map(Number);
	return numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_POINTS) ? numbers : null;
}

export function formatPoints(scheme: readonly number[]): string {
	return scheme.join(', ');
}

export type Standing = { userId: string; points: number; wins: number; plays: number };

/**
 * The leaderboard: members only (guests and people who left aren't on it), most points first, then
 * most wins, then fewer plays. Co-op plays count as plays and score nothing.
 */
export function standings(plays: readonly Play[], scheme: readonly number[], memberIds: ReadonlySet<string>): Standing[] {
	const table = new Map<string, Standing>();
	for (const play of plays) {
		const places = play.players.map((p) => p.place);
		const points = play.coop == null && places.every((p) => p != null) ? playPoints(places as number[], scheme) : play.players.map(() => 0);
		play.players.forEach((player, i) => {
			if (!player.userId || !memberIds.has(player.userId)) return;
			const row = table.get(player.userId) ?? { userId: player.userId, points: 0, wins: 0, plays: 0 };
			row.plays += 1;
			row.points += points[i];
			if (play.coop == null && isWin(player.place, places)) row.wins += 1;
			table.set(player.userId, row);
		});
	}
	return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.plays - b.plays);
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd" */
export function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV field, quoted when needed. Text people typed that a spreadsheet would run as a formula is
 * defused with a leading apostrophe; `verbatim` skips that for BGG titles, which are shown as BGG
 * gives them (TECH.md "Access and terms").
 */
export function csvField(value: string | number | null, verbatim = false): string {
	if (value == null) return '';
	if (typeof value === 'number') return String(value);
	const safe = !verbatim && FORMULA_START.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const SOURCE_LABEL: Record<GameSource, string> = { bgg: 'BoardGameGeek', wikidata: 'Wikidata', manual: 'typed in' };

export const CSV_COLUMNS = ['date', 'game', 'game_data_from', 'bgg_id', 'play_id', 'player', 'player_type', 'place', 'score', 'won', 'coop_result', 'points'];

/**
 * The export: one row per player per play, newest play first. `nameOf` gives a member's name, or
 * null for someone who has left the group, who shows as "a former member".
 */
export function playsCsv(plays: readonly Play[], scheme: readonly number[], nameOf: (userId: string) => string | null): string {
	const lines = [CSV_COLUMNS.join(',')];
	for (const play of plays) {
		const places = play.players.map((p) => p.place);
		const points = play.coop == null && places.every((p) => p != null) ? playPoints(places as number[], scheme) : play.players.map(() => 0);
		play.players.forEach((player, i) => {
			const member = player.userId ? nameOf(player.userId) : null;
			const name = player.guestName ?? member ?? 'a former member';
			const type = player.guestName != null ? 'guest' : member != null ? 'member' : 'former member';
			const won = play.coop != null ? play.coop === 'won' : isWin(player.place, places);
			const bgg = play.gameSource === 'bgg';
			lines.push(
				[
					csvField(play.playedOn),
					csvField(play.gameName, bgg),
					// BGG is named on the rows that carry its data, and nowhere else.
					csvField(SOURCE_LABEL[play.gameSource]),
					csvField(play.bggId),
					csvField(play.id),
					csvField(name),
					csvField(type),
					csvField(play.coop == null ? player.place : null),
					csvField(player.score),
					csvField(won ? 'yes' : 'no'),
					csvField(play.coop),
					csvField(play.coop == null ? points[i] : null)
				].join(',')
			);
		});
	}
	// CRLF line ends and a byte-order mark, so spreadsheet apps read accents and line breaks right.
	return '﻿' + lines.join('\r\n') + '\r\n';
}
