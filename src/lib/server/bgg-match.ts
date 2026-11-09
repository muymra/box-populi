// Finding hand-entered and Wikidata games on BGG once an instance has a token (DECISIONS D57,
// TECH.md "Find on BoardGameGeek"). The hydrate loop only reaches games that already carry a BGG
// id; these have none. The browser asks for one game's matches at a time through the normal paced
// search, the person ticks the right ones, and each ticked game is merged into the BGG game: its
// copies, wishes, links, bring lists and plays move across, and the typed-in row goes.
import { all, mapRead, readAll, rowsOf, stmt, type DB, type Read } from './db.ts';
import { bumpCatalogForGames, bumpCatalogForUser } from './catalog.ts';
import { searchBgg } from './games.ts';
import { normalize } from '#lib/catalog/normalize.ts';
import type { BggClient } from './bgg/types.ts';

/**
 * Games on the person's shelf with no BGG details to fetch: typed in, or from Wikidata, without a
 * BGG id. One that has a BGG id is the hydrate loop's job, so it isn't listed here.
 */
const UNMATCHED = `(g.is_manual = 1 OR g.source <> 'bgg') AND g.bgg_id IS NULL`;

export type UnmatchedGame = {
	gameId: number;
	name: string;
	source: 'manual' | 'wikidata';
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
};

export async function unmatchedGames(db: DB, userId: string): Promise<UnmatchedGame[]> {
	return (await readAll(db, { u: unmatchedGamesRead(db, userId) })).u;
}

/** unmatchedGames as a read, to share a round trip with others (`readAll`, D59). */
export function unmatchedGamesRead(db: DB, userId: string): Read<UnmatchedGame[]> {
	return mapRead(
		rowsOf<{ id: number; name: string; source: string; min_players: number | null; max_players: number | null; min_playtime: number | null; max_playtime: number | null }>(
			db,
			`SELECT g.id, g.name, g.source, g.min_players, g.max_players, g.min_playtime, g.max_playtime
			 FROM copies c JOIN games g ON g.id = c.game_id
			 WHERE c.user_id = ?1 AND ${UNMATCHED}`,
			userId
		),
		(rows) =>
			rows
				.map((r) => ({
					gameId: r.id,
					name: r.name,
					source: r.source === 'wikidata' ? ('wikidata' as const) : ('manual' as const),
					minPlayers: r.min_players,
					maxPlayers: r.max_players,
					minPlaytime: r.min_playtime,
					maxPlaytime: r.max_playtime
				}))
				.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
	);
}

/**
 * A shorter title to try when the typed one finds nothing: without a trailing "(...)", or only the
 * part before a colon or a spaced dash ("Catan: 5-6 players" finds Catan). Null when there's
 * nothing shorter worth a second search.
 */
export function shorterTitle(name: string): string | null {
	const trimmed = name.trim();
	const shorter = trimmed
		.replace(/\s*\([^)]*\)\s*$/, '')
		.split(/\s*:\s*|\s+[-–—]\s+/)[0]
		.trim();
	return shorter.length >= 3 && shorter !== trimmed ? shorter : null;
}

/** Same title once case, accents and extra spaces are set aside (punctuation counts). */
export function sameTitle(a: string, b: string): boolean {
	return normalize(a) === normalize(b);
}

export type MatchCandidate = {
	gameId: number;
	bggId: number;
	name: string;
	year: number | null;
	thumbUrl: string | null;
	isExpansion: boolean;
	minPlayers: number | null;
	maxPlayers: number | null;
	exact: boolean;
};

/** Up to this many BGG games are offered per typed-in game. */
export const CANDIDATES = 5;

/**
 * BGG's likeliest matches for one of the person's unmatched games, best first: exact titles, then
 * the most rated (searchBgg's order). One search, plus one for a shorter title when the first finds
 * nothing. Null when the game isn't one of theirs to match.
 */
export async function findMatches(db: DB, client: BggClient, userId: string, gameId: number, now: number): Promise<MatchCandidate[] | null> {
	const own = await all<{ name: string }>(
		db,
		`SELECT g.name FROM copies c JOIN games g ON g.id = c.game_id WHERE c.user_id = ?1 AND g.id = ?2 AND ${UNMATCHED}`,
		userId,
		gameId
	);
	if (own.length === 0) return null;
	const name = own[0].name;
	let hits = await searchBgg(db, client, name, userId, now, CANDIDATES);
	const shorter = hits.length === 0 ? shorterTitle(name) : null;
	if (shorter) hits = await searchBgg(db, client, shorter, userId, now, CANDIDATES);
	return hits
		.filter((h) => h.gameId !== gameId)
		.map((h) => ({
			gameId: h.gameId,
			bggId: h.bggId,
			name: h.name,
			year: h.year,
			thumbUrl: h.thumbUrl,
			isExpansion: h.isExpansion,
			minPlayers: h.minPlayers,
			maxPlayers: h.maxPlayers,
			exact: sameTitle(h.name, name)
		}))
		.sort((a, b) => Number(b.exact) - Number(a.exact));
}

/** Pairs per call: fourteen statements each, so a batch stays near a hundred. */
export const MERGES_PER_CALL = 7;

export type Merge = { gameId: number; targetId: number };

/**
 * Everything that names the typed-in game moves to the BGG game, in order, for one pair. Where a
 * person already has the BGG game on their shelf, wishlist, favourites or Play soon, or a night already lists it, the
 * typed-in row is the one dropped, so the unique keys hold. Group-only corrections go with it:
 * BGG games are never corrected.
 */
function mergeStatements(db: DB, from: number, to: number): D1PreparedStatement[] {
	return [
		stmt(db, 'UPDATE copies SET game_id = ?2 WHERE game_id = ?1 AND NOT EXISTS (SELECT 1 FROM copies c2 WHERE c2.game_id = ?2 AND c2.user_id = copies.user_id)', from, to),
		stmt(db, 'DELETE FROM copies WHERE game_id = ?1', from),
		stmt(db, 'UPDATE wishlist SET game_id = ?2 WHERE game_id = ?1 AND NOT EXISTS (SELECT 1 FROM wishlist w2 WHERE w2.game_id = ?2 AND w2.user_id = wishlist.user_id)', from, to),
		stmt(db, 'DELETE FROM wishlist WHERE game_id = ?1', from),
		stmt(db, 'UPDATE favourites SET game_id = ?2 WHERE game_id = ?1 AND NOT EXISTS (SELECT 1 FROM favourites f2 WHERE f2.game_id = ?2 AND f2.user_id = favourites.user_id)', from, to),
		stmt(db, 'DELETE FROM favourites WHERE game_id = ?1', from),
		stmt(db, 'UPDATE play_soon SET game_id = ?2 WHERE game_id = ?1 AND NOT EXISTS (SELECT 1 FROM play_soon s2 WHERE s2.game_id = ?2 AND s2.user_id = play_soon.user_id)', from, to),
		stmt(db, 'DELETE FROM play_soon WHERE game_id = ?1', from),
		stmt(db, 'UPDATE game_links SET game_id = ?2 WHERE game_id = ?1', from, to),
		stmt(db, 'UPDATE night_games SET game_id = ?2 WHERE game_id = ?1 AND NOT EXISTS (SELECT 1 FROM night_games n2 WHERE n2.game_id = ?2 AND n2.night_id = night_games.night_id)', from, to),
		stmt(db, 'DELETE FROM night_games WHERE game_id = ?1', from),
		stmt(db, 'UPDATE plays SET game_id = ?2 WHERE game_id = ?1', from, to),
		stmt(db, 'DELETE FROM game_corrections WHERE game_id = ?1', from),
		stmt(db, 'DELETE FROM games WHERE id = ?1', from)
	];
}

/**
 * Merges each typed-in game into the BGG game the person chose. A pair counts only when the first
 * game is one of their unmatched ones and the second is a BGG game; anything else is skipped, so
 * ids from the browser can't move another person's games or merge into a typed-in one. The game is
 * shared (D54), so other people's copies of it move too.
 */
export async function mergeMatches(db: DB, userId: string, pairs: Merge[]): Promise<{ merged: number; skipped: number }> {
	const unique = [...new Map(pairs.map((p) => [p.gameId, p])).values()];
	if (unique.length === 0) return { merged: 0, skipped: 0 };
	if (unique.length > MERGES_PER_CALL) throw new Error(`mergeMatches takes at most ${MERGES_PER_CALL} pairs`);

	const mine = new Set(
		(
			await all<{ id: number }>(
				db,
				`SELECT g.id FROM copies c JOIN games g ON g.id = c.game_id
				 WHERE c.user_id = ?1 AND g.id IN (SELECT value FROM json_each(?2)) AND ${UNMATCHED}`,
				userId,
				JSON.stringify(unique.map((p) => p.gameId))
			)
		).map((r) => r.id)
	);
	const bgg = new Set(
		(
			await all<{ id: number }>(
				db,
				`SELECT id FROM games WHERE id IN (SELECT value FROM json_each(?1)) AND source = 'bgg' AND is_manual = 0 AND bgg_id IS NOT NULL`,
				JSON.stringify(unique.map((p) => p.targetId))
			)
		).map((r) => r.id)
	);
	const valid = unique.filter((p) => mine.has(p.gameId) && bgg.has(p.targetId) && p.gameId !== p.targetId);
	if (valid.length === 0) return { merged: 0, skipped: pairs.length };

	await db.batch([
		...valid.flatMap((p) => mergeStatements(db, p.gameId, p.targetId)),
		bumpCatalogForGames(db, [...new Set(valid.map((p) => p.targetId))]),
		bumpCatalogForUser(db, userId)
	]);
	return { merged: valid.length, skipped: pairs.length - valid.length };
}
