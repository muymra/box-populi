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

const CONFIRM_CHUNK = 50; // 50 games = 100 statements per batch

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
		await db.batch(
			chunk.flatMap((item) => [
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
			])
		);
	}
	await bumpCatalogForUser(db, userId).run();
	const after = (await ownedBggIds(db, userId)).size;
	return { added: after - before };
}

export async function pendingDetails(db: DB, userId: string): Promise<number> {
	const row = await one<{ n: number }>(
		db,
		`SELECT COUNT(DISTINCT g.id) AS n FROM copies c JOIN games g ON g.id = c.game_id
		 WHERE c.user_id = ?1 AND g.fetched_at IS NULL AND g.bgg_id IS NOT NULL`,
		userId
	);
	return row?.n ?? 0;
}

/**
 * Fetches details for up to 20 of the person's games that are still stubs. Games BGG doesn't
 * return are marked fetched as they are, so the loop always ends.
 */
export async function hydrateStep(db: DB, client: BggClient, userId: string, now: number): Promise<{ updated: number; remaining: number }> {
	const rows = await all<{ bgg_id: number }>(
		db,
		`SELECT DISTINCT g.bgg_id FROM copies c JOIN games g ON g.id = c.game_id
		 WHERE c.user_id = ?1 AND g.fetched_at IS NULL AND g.bgg_id IS NOT NULL
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
		...ids.filter((id) => !found.has(id)).map((id) => stmt(db, 'UPDATE games SET fetched_at = ?1 WHERE bgg_id = ?2', now, id)),
		bumpCatalogForUser(db, userId)
	]);
	return { updated: ids.length, remaining: await pendingDetails(db, userId) };
}
