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
 * The group's BGG games, oldest details first: on its shelf (less copies hidden from it, D66), on its
 * members' wishlists, or on its game nights' bring lists (D80). Typed-in and Wikidata games aren't
 * BGG's, and a stub still waiting for its first details is the hydrate loop's. One more than a request's
 * worth, so `refreshDue` can tell when the next one turns REFRESH_DAYS old.
 */
async function oldestDetails(db: DB, groupId: string): Promise<Array<{ id: number; bgg_id: number; fetched_at: number }>> {
	return all(
		db,
		`WITH here(id) AS (
		   SELECT game_id FROM group_copies WHERE group_id = ?1
		   UNION SELECT w.game_id FROM wishlist w JOIN memberships m ON m.user_id = w.user_id WHERE m.group_id = ?1
		   UNION SELECT ng.game_id FROM night_games ng JOIN game_nights n ON n.id = ng.night_id WHERE n.group_id = ?1
		 )
		 SELECT g.id, g.bgg_id, g.fetched_at FROM here JOIN games g ON g.id = here.id
		 WHERE g.source = 'bgg' AND g.is_manual = 0 AND g.bgg_id IS NOT NULL AND g.fetched_at IS NOT NULL
		 ORDER BY g.fetched_at, g.id LIMIT ?2`,
		groupId,
		THINGS_PER_REQUEST + 1
	);
}

/**
 * The group's games whose details are older than REFRESH_DAYS, at most one `thing` request's worth,
 * and when to look again (`groups.next_refresh_at`, D82): when the oldest game left turns REFRESH_DAYS
 * old, or at once while more are stale. Gathering the group's games reads about 19,400 rows at the
 * planned scale, so the endpoint asks only once that time has come, about once a month per group,
 * instead of on every shelf opened. A game added since with older details waits until then.
 */
export async function refreshDue(db: DB, groupId: string, now: number): Promise<{ games: Array<{ id: number; bggId: number }>; nextAt: number }> {
	const rows = await oldestDetails(db, groupId);
	const cutoff = now - REFRESH_MS;
	const stale = rows.filter((r) => r.fetched_at < cutoff).slice(0, THINGS_PER_REQUEST);
	const left = rows.slice(stale.length);
	const nextAt = left.length === 0 ? now + REFRESH_MS : Math.max(now, left[0].fetched_at + REFRESH_MS);
	return { games: stale.map((r) => ({ id: r.id, bggId: r.bgg_id })), nextAt };
}

/** The group's games that are due now (`refreshDue` without the date). */
export async function staleGames(db: DB, groupId: string, now: number): Promise<Array<{ id: number; bggId: number }>> {
	return (await refreshDue(db, groupId, now)).games;
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
