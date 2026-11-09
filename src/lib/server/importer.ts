// BGG collection import (TECH.md "Import and hydrate"). Three steps the browser drives:
// preview (nothing stored), confirm (stubs and copies at once), hydrate (20 games' details per call).
// The BGG username is used for the requests and never stored.
import { all, mapRead, readAll, rowOf, stmt, type DB, type Read } from './db.ts';
import { bumpCatalogForGames, bumpCatalogForUser } from './catalog.ts';
import { upsertThingStatement } from './games.ts';
import { buildSearchText } from '#lib/catalog/normalize.ts';
import { THINGS_PER_REQUEST, type BggClient, type BggCollectionItem } from './bgg/types.ts';

/** BGG usernames: letters, digits, spaces, underscores, dots and hyphens. */
export function cleanBggUsername(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw.trim();
	return /^[\p{L}\p{N} _.-]{1,40}$/u.test(name) ? name : null;
}

export type CollectionOutcome =
	| { status: 'ready'; items: BggCollectionItem[] }
	| { status: 'pending' }
	| { status: 'not_found' };

/**
 * Asks for the collection up to `attempts` times while BGG answers 202. The live client's pacer
 * already spaces the requests, so no extra delay is added here.
 */
export async function fetchCollection(client: BggClient, username: string, attempts = 3): Promise<CollectionOutcome> {
	for (let i = 0; i < attempts; i++) {
		const result = await client.collection(username);
		if (result.status !== 'pending') {
			if (result.status === 'not_found') return result;
			const seen = new Set<number>();
			return { status: 'ready', items: result.items.filter((item) => !seen.has(item.bggId) && seen.add(item.bggId)) };
		}
	}
	return { status: 'pending' };
}

async function ownedBggIds(db: DB, userId: string): Promise<Set<number>> {
	// Read the whole list rather than binding an IN (...) of up to 1,000 ids: D1 caps bound parameters at 100.
	const rows = await all<{ bgg_id: number }>(
		db,
		'SELECT g.bgg_id FROM copies c JOIN games g ON g.id = c.game_id WHERE c.user_id = ?1 AND g.bgg_id IS NOT NULL',
		userId
	);
	return new Set(rows.map((r) => r.bgg_id));
}

export type PreviewItem = BggCollectionItem & { owned: boolean };

export async function previewItems(db: DB, userId: string, items: BggCollectionItem[]): Promise<PreviewItem[]> {
	const owned = await ownedBggIds(db, userId);
	return items
		.map((item) => ({ ...item, owned: owned.has(item.bggId) }))
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

export type ShelfOnly = { gameId: number; bggId: number; name: string; year: number | null; thumbUrl: string | null; lent: boolean };

/**
 * Games on the person's shelf that this BGG collection doesn't list as owned: sold, traded or given
 * away, or simply never marked "Own" on BGG. Offered for removal in a repeat import's preview, never
 * removed by themselves. Only games with a BGG id can be compared; typed-in games never appear.
 */
export async function shelfNotInCollection(db: DB, userId: string, items: BggCollectionItem[]): Promise<ShelfOnly[]> {
	const inCollection = new Set(items.map((i) => i.bggId));
	const rows = await all<{ id: number; bgg_id: number; name: string; year: number | null; thumb_url: string | null; lent: number }>(
		db,
		`SELECT g.id, g.bgg_id, g.name, g.year, g.thumb_url,
			(c.lent_to_user_id IS NOT NULL OR c.lent_to_text IS NOT NULL) AS lent
		 FROM copies c JOIN games g ON g.id = c.game_id
		 WHERE c.user_id = ?1 AND g.bgg_id IS NOT NULL`,
		userId
	);
	return rows
		.filter((r) => !inCollection.has(r.bgg_id))
		.map((r) => ({ gameId: r.id, bggId: r.bgg_id, name: r.name, year: r.year, thumbUrl: r.thumb_url, lent: r.lent === 1 }))
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

/** Takes the person's own copies of these games off their shelf, the same as "Remove from my games" on each. */
export async function removeFromShelf(db: DB, userId: string, gameIds: number[]): Promise<{ removed: number }> {
	const ids = [...new Set(gameIds)];
	if (ids.length === 0) return { removed: 0 };
	const [deleted] = await db.batch([
		stmt(db, 'DELETE FROM copies WHERE user_id = ?1 AND game_id IN (SELECT value FROM json_each(?2))', userId, JSON.stringify(ids)),
		bumpCatalogForUser(db, userId)
	]);
	return { removed: deleted?.meta?.changes ?? 0 };
}

/**
 * Games per batch when confirming an import. Each batch is two statements whatever its size, the
 * games passed as one JSON value (D65), where it was two statements a game; 500 keeps that value far
 * under D1's 2 MB limit for one, and a 1,000-game import is two round trips instead of twenty.
 */
const CONFIRM_CHUNK = 500;

/**
 * Creates a stub for every chosen game not yet cached and the person's copy of each. Only ids that
 * are really in their collection count, so names never come from the browser.
 */
export async function confirmImport(
	db: DB,
	userId: string,
	items: BggCollectionItem[],
	chosen: number[],
	now: number
): Promise<{ added: number }> {
	const wanted = new Set(chosen);
	const picked = items.filter((item) => wanted.has(item.bggId));
	const before = (await ownedBggIds(db, userId)).size;
	for (let i = 0; i < picked.length; i += CONFIRM_CHUNK) {
		const chunk = picked.slice(i, i + CONFIRM_CHUNK);
		// Each batch bumps the catalog itself, so a request that stops part-way (D1 allows 50 queries
		// per request on the free plan, about 2,000 games here) never leaves copies the catalog misses.
		const stubs = chunk.map((item) => ({ b: item.bggId, n: item.name, s: buildSearchText(item.name), y: item.year, i: item.imageUrl ?? null, t: item.thumbUrl ?? null }));
		await db.batch([
			// The same row stubStatement writes, for every game in the chunk.
			stmt(
				db,
				`INSERT INTO games (bgg_id, name, search_text, year, is_expansion, image_url, thumb_url)
				 SELECT json_extract(value, '$.b'), json_extract(value, '$.n'), json_extract(value, '$.s'), json_extract(value, '$.y'), 0,
				        json_extract(value, '$.i'), json_extract(value, '$.t')
				 FROM json_each(?1) WHERE true
				 ON CONFLICT(bgg_id) DO NOTHING`,
				JSON.stringify(stubs)
			),
			stmt(
				db,
				`INSERT INTO copies (user_id, game_id, added_at)
				 SELECT ?1, id, ?2 FROM games WHERE bgg_id IN (SELECT value FROM json_each(?3))
				 ON CONFLICT(user_id, game_id) DO NOTHING`,
				userId,
				now,
				JSON.stringify(chunk.map((item) => item.bggId))
			),
			bumpCatalogForUser(db, userId)
		]);
	}
	const after = (await ownedBggIds(db, userId)).size;
	return { added: after - before };
}

/**
 * Games still waiting for BGG details: stubs from an import, and Wikidata or typed-in games that carry
 * a BGG id, which get upgraded to full BGG data once BGG is on (only called then).
 */
// A typed-in row that somehow carries a BGG id counts too (seen on a live instance, 2026-11-09): the
// upsert on its BGG id turns it into the BGG game, the way it turns a Wikidata one.
const NEEDS_BGG_DETAILS = `g.bgg_id IS NOT NULL AND (g.fetched_at IS NULL OR g.source <> 'bgg' OR g.is_manual = 1)`;

export async function pendingDetails(db: DB, userId: string): Promise<number> {
	return (await readAll(db, { n: pendingDetailsRead(db, userId) })).n;
}

/** pendingDetails as a read, to share a round trip with others (`readAll`, D59). */
export function pendingDetailsRead(db: DB, userId: string): Read<number> {
	return mapRead(
		rowOf<{ n: number }>(
			db,
			`SELECT COUNT(DISTINCT g.id) AS n FROM copies c JOIN games g ON g.id = c.game_id
			 WHERE c.user_id = ?1 AND ${NEEDS_BGG_DETAILS}`,
			userId
		),
		(row) => row?.n ?? 0
	);
}

/**
 * Fetches details for up to 20 of the person's games that are still stubs. Games BGG doesn't
 * return are marked fetched as they are, so the loop always ends.
 */
export async function hydrateStep(db: DB, client: BggClient, userId: string, now: number): Promise<{ updated: number; remaining: number }> {
	const rows = await all<{ id: number; bgg_id: number }>(
		db,
		`SELECT DISTINCT g.id, g.bgg_id FROM copies c JOIN games g ON g.id = c.game_id
		 WHERE c.user_id = ?1 AND ${NEEDS_BGG_DETAILS}
		 ORDER BY g.bgg_id LIMIT ?2`,
		userId,
		THINGS_PER_REQUEST
	);
	if (rows.length === 0) return { updated: 0, remaining: 0 };

	const ids = rows.map((r) => r.bgg_id);
	const things = await client.things(ids);
	const found = new Set(things.map((t) => t.bggId));
	await db.batch([
		...things.map((t) => upsertThingStatement(db, t, now)),
		// Ids BGG doesn't return end the loop too: BGG stubs are marked fetched as they are, and a
		// Wikidata or typed-in game loses the BGG id it carried but keeps its own details (so it can be
		// found with Find on BoardGameGeek instead).
		...ids
			.filter((id) => !found.has(id))
			.flatMap((id) => [
				stmt(db, "UPDATE games SET fetched_at = ?1 WHERE bgg_id = ?2 AND source = 'bgg' AND is_manual = 0", now, id),
				stmt(db, "UPDATE games SET bgg_id = NULL WHERE bgg_id = ?1 AND (source <> 'bgg' OR is_manual = 1)", id)
			]),
		// Every group with a copy of these games, which includes all of the caller's groups.
		bumpCatalogForGames(db, rows.map((r) => r.id))
	]);
	return { updated: ids.length, remaining: await pendingDetails(db, userId) };
}
