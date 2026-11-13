// BGG details older than 30 days, fetched again (D80). Pages Functions run no scheduled jobs, so the
// shelf asks in the background when someone opens it, and each request refreshes up to 20 of that
// group's games in one `thing` call, like the hydrate loop does for new ones. Carlo's BGG application
// promised results refreshed at most every 30 days, so that's the floor, never a target to beat.
import { all, stmt, type DB } from './db.ts';
import { bumpCatalogForGames } from './catalog.ts';
import { upsertThingStatement } from './games.ts';
import { THINGS_PER_REQUEST, type BggClient } from './bgg/types.ts';

export const REFRESH_DAYS = 30;
const REFRESH_MS = REFRESH_DAYS * 86_400_000;

/**
 * The group's BGG games whose details are older than REFRESH_DAYS, oldest first, at most one `thing`
 * request's worth: on its shelf (less copies hidden from it, D66), on its members' wishlists, or on its
 * game nights' bring lists. Typed-in and Wikidata games aren't BGG's, and a stub still waiting for its
 * first details is the hydrate loop's.
 */
export async function staleGames(db: DB, groupId: string, now: number): Promise<Array<{ id: number; bggId: number }>> {
	const rows = await all<{ id: number; bgg_id: number }>(
		db,
		`WITH here(id) AS (
		   SELECT game_id FROM group_copies WHERE group_id = ?1
		   UNION SELECT w.game_id FROM wishlist w JOIN memberships m ON m.user_id = w.user_id WHERE m.group_id = ?1
		   UNION SELECT ng.game_id FROM night_games ng JOIN game_nights n ON n.id = ng.night_id WHERE n.group_id = ?1
		 )
		 SELECT g.id, g.bgg_id FROM here JOIN games g ON g.id = here.id
		 WHERE g.source = 'bgg' AND g.is_manual = 0 AND g.bgg_id IS NOT NULL AND g.fetched_at IS NOT NULL AND g.fetched_at < ?2
		 ORDER BY g.fetched_at, g.id LIMIT ?3`,
		groupId,
		now - REFRESH_MS,
		THINGS_PER_REQUEST
	);
	return rows.map((r) => ({ id: r.id, bggId: r.bgg_id }));
}

/**
 * Fetches these games' details again and writes them as the first fetch did, then bumps the catalog
 * of every group with a copy. Only the shared `games` row changes; copies, corrections, plays and
 * marks are members' and stay. A game BGG no longer returns keeps the details it had, and its date
 * moves on so it isn't asked about again for another REFRESH_DAYS.
 */
export async function refreshGames(db: DB, client: BggClient, games: Array<{ id: number; bggId: number }>, now: number): Promise<number> {
	if (games.length === 0) return 0;
	const things = await client.things(games.map((g) => g.bggId));
	const found = new Set(things.map((t) => t.bggId));
	await db.batch([
		...things.map((t) => upsertThingStatement(db, t, now)),
		...games
			.filter((g) => !found.has(g.bggId))
			.map((g) => stmt(db, "UPDATE games SET fetched_at = ?1 WHERE id = ?2 AND source = 'bgg' AND is_manual = 0", now, g.id)),
		bumpCatalogForGames(
			db,
			games.map((g) => g.id)
		)
	]);
	return things.length;
}
