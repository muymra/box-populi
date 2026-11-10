// The play log's rules (PRD "Play log"): places from scores, podium points, standings and the CSV
// export. Pure, so the form, the pages and the tests share them.

export type Coop = 'won' | 'lost';
export type PlayPlayer = { userId: string | null; guestName: string | null; place: number | null; score: number | null };
import { csvField, csvFile, SOURCE_LABEL, type GameSource } from './csv.ts';

export type { GameSource } from './csv.ts';
export { csvField } from './csv.ts';
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
	/** The game night it belongs to, if any (D38). */
	night?: { id: string; name: string } | null;
};

/**
 * Who finished where in a play, and at which night: all that standings, a night's "went" and a
 * profile's figures read, so a long history is read without games, names or scores (D70).
 */
export type PlayOutcome = {
	id: string;
	playedOn: string;
	coop: Coop | null;
	nightId: string | null;
	players: Array<Pick<PlayPlayer, 'userId' | 'guestName' | 'place'>>;
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
 * most wins, then fewer plays. Co-op plays count as plays and score nothing. The pages count in SQL
 * instead (`standingsRead`, then `standingsFromCounts`); this is the rule in plain code, which the
 * tests hold the SQL to.
 */
export function standings(plays: readonly Pick<PlayOutcome, 'coop' | 'players'>[], scheme: readonly number[], memberIds: ReadonlySet<string>): Standing[] {
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

/**
 * One member's numbers for the leaderboard, counted in SQL (`standingsRead`, D70): their plays, wins,
 * and how often they finished 1st to 5th in a play that scores (competitive, everyone placed, not last).
 * `latest` orders exact ties: whoever played most recently first, as `standings()` meets them.
 */
export type StandingCounts = { userId: string; plays: number; wins: number; scored: readonly number[]; latest: string };

/** The leaderboard from `StandingCounts`, by the same rules and order as `standings()`. */
export function standingsFromCounts(rows: readonly StandingCounts[], scheme: readonly number[]): Standing[] {
	return rows
		.map((r) => ({ userId: r.userId, points: r.scored.reduce((sum, n, i) => sum + n * (scheme[i] ?? 0), 0), wins: r.wins, plays: r.plays, latest: r.latest }))
		.sort((a, b) => b.points - a.points || b.wins - a.wins || a.plays - b.plays || b.latest.localeCompare(a.latest) || a.userId.localeCompare(b.userId))
		.map(({ userId, points, wins, plays }) => ({ userId, points, wins, plays }));
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd" */
export function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

export const CSV_COLUMNS = ['date', 'game_night', 'night_id', 'game', 'game_data_from', 'bgg_id', 'play_id', 'player', 'player_type', 'place', 'score', 'won', 'coop_result', 'points'];

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
					csvField(play.night?.name ?? null),
					// Joins the nights file's night_id in a spreadsheet (STATUS item 45).
					csvField(play.night?.id ?? null),
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
	return csvFile(lines);
}
