// BGG collection import (TECH.md "Import and hydrate"). Three steps the browser drives:
// preview (nothing stored), confirm (stubs and copies at once), hydrate (20 games' details per call).
// The BGG username is used for the requests and never stored.
import { all, one, stmt, type DB } from './db.ts';
import { bumpCatalogForUser } from './catalog.ts';
import { stubStatement, upsertThingStatement } from './games.ts';
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

const CONFIRM_CHUNK = 50; // 50 games = 100 statements per batch, plus the catalog bump

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
		await db.batch([
			...chunk.flatMap((item) => [
				stubStatement(db, item),
				stmt(
					db,
					`INSERT INTO copies (user_id, game_id, added_at)
					 SELECT ?1, id, ?2 FROM games WHERE bgg_id = ?3
					 ON CONFLICT(user_id, game_id) DO NOTHING`,
					userId,
					now,
					item.bggId
				)
			]),
			bumpCatalogForUser(db, userId)
		]);
	}
	const after = (await ownedBggIds(db, userId)).size;
	return { added: after - before };
}

/**
 * Games still waiting for BGG details: stubs from an import, and Wikidata games that carry a BGG id,
 * which get upgraded to full BGG data once BGG is on (only called then).
 */
const NEEDS_BGG_DETAILS = `g.bgg_id IS NOT NULL AND (g.fetched_at IS NULL OR g.source = 'wikidata')`;

export async function pendingDetails(db: DB, userId: string): Promise<number> {
	const row = await one<{ n: number }>(
		db,
		`SELECT COUNT(DISTINCT g.id) AS n FROM copies c JOIN games g ON g.id = c.game_id
		 WHERE c.user_id = ?1 AND ${NEEDS_BGG_DETAILS}`,
		userId
	);
	return row?.n ?? 0;
}

/**
 * Bumps the catalog of every group where any member has a copy of one of these games. Games are
 * shared by every group, so a change to one reaches groups the caller isn't in. The ids are bound
 * as one JSON array, so the count never runs into D1's 100-parameter cap.
 * Belongs next to `bumpCatalogForUser` in catalog.ts.
 */
export function bumpCatalogForGames(db: DB, gameIds: number[]): D1PreparedStatement {
	return stmt(
		db,
		`UPDATE groups SET catalog_version = catalog_version + 1
		 WHERE id IN (SELECT m.group_id FROM copies c JOIN memberships m ON m.user_id = c.user_id
		              WHERE c.game_id IN (SELECT value FROM json_each(?1)))`,
		JSON.stringify(gameIds)
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
		// Wikidata game loses the BGG id Wikidata gave it but keeps its Wikidata details.
		...ids
			.filter((id) => !found.has(id))
			.flatMap((id) => [
				stmt(db, "UPDATE games SET fetched_at = ?1 WHERE bgg_id = ?2 AND source != 'wikidata'", now, id),
				stmt(db, "UPDATE games SET bgg_id = NULL WHERE bgg_id = ?1 AND source = 'wikidata'", id)
			]),
		// Every group with a copy of these games, which includes all of the caller's groups.
		bumpCatalogForGames(db, rows.map((r) => r.id))
	]);
	return { updated: ids.length, remaining: await pendingDetails(db, userId) };
}
