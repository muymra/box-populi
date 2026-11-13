// Thin helpers over D1. Every value is bound by position; D1 doesn't support named parameters.

export type DB = D1Database;

export function stmt(db: DB, sql: string, ...params: unknown[]): D1PreparedStatement {
	return db.prepare(sql).bind(...params);
}

export async function one<T>(db: DB, sql: string, ...params: unknown[]): Promise<T | null> {
	return (await stmt(db, sql, ...params).first<T>()) ?? null;
}

export async function all<T>(db: DB, sql: string, ...params: unknown[]): Promise<T[]> {
	return (await stmt(db, sql, ...params).all<T>()).results;
}

export async function run(db: DB, sql: string, ...params: unknown[]): Promise<D1Result> {
	return stmt(db, sql, ...params).run();
}

/** A SELECT (or WITH … SELECT), or a write with RETURNING: statements whose rows a batch hands back. */
export const returnsRows = (sql: string) => /^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

/** One read, as a statement and what to make of its rows, so several can share a round trip (`readAll`). */
export type Read<T> = { statement: D1PreparedStatement | null; map: (rows: unknown[]) => T };

/** A read whose rows come back as they are. */
export function rowsOf<T>(db: DB, sql: string, ...params: unknown[]): Read<T[]> {
	return { statement: stmt(db, sql, ...params), map: (rows) => rows as T[] };
}

/** A read of at most one row. */
export function rowOf<T>(db: DB, sql: string, ...params: unknown[]): Read<T | null> {
	return { statement: stmt(db, sql, ...params), map: (rows) => (rows[0] as T | undefined) ?? null };
}

/** A read that needs no query, for a value already known: keeps a `readAll` call's shape the same. */
export function known<T>(value: T): Read<T> {
	return { statement: null, map: () => value };
}

/** Same read, different result. */
export function mapRead<T, U>(read: Read<T>, f: (value: T) => U): Read<U> {
	return { statement: read.statement, map: (rows) => f(read.map(rows)) };
}

/**
 * Runs several reads in one round trip and returns their results by name. On Cloudflare's free plan
 * each database call costs CPU time out of about 10ms per request (D59), and D1 counts a batch as one
 * query towards its 50 per request. A batch is a transaction; for reads that only means a consistent view.
 */
export async function readAll<T extends Record<string, Read<unknown>>>(db: DB, reads: T): Promise<{ [K in keyof T]: T[K] extends Read<infer U> ? U : never }> {
	const keys = Object.keys(reads);
	const queried = keys.filter((k) => reads[k].statement != null);
	const results = queried.length ? await db.batch(queried.map((k) => reads[k].statement!)) : [];
	const rowsFor = new Map(queried.map((k, i) => [k, (results[i]?.results ?? []) as unknown[]]));
	return Object.fromEntries(keys.map((k) => [k, reads[k].map(rowsFor.get(k) ?? [])])) as { [K in keyof T]: T[K] extends Read<infer U> ? U : never };
}

/** Reads a JSON array column, tolerating bad data instead of failing the page. */
export function jsonArray<T>(raw: unknown): T[] {
	if (typeof raw !== 'string') return [];
	try {
		const value = JSON.parse(raw);
		return Array.isArray(value) ? (value as T[]) : [];
	} catch {
		return [];
	}
}

/**
 * Deleting a group, with everything that belongs only to it. D1 and node:sqlite would cascade,
 * but Turso doesn't enforce foreign keys over HTTP, so the rows go explicitly, children first.
 */
export function deleteGroupStatements(db: DB, groupId: string): D1PreparedStatement[] {
	return [
		stmt(db, 'DELETE FROM game_links WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM game_corrections WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM play_players WHERE play_id IN (SELECT id FROM plays WHERE group_id = ?1)', groupId),
		stmt(db, 'DELETE FROM plays WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM night_games WHERE night_id IN (SELECT id FROM game_nights WHERE group_id = ?1)', groupId),
		stmt(db, 'DELETE FROM night_people WHERE night_id IN (SELECT id FROM game_nights WHERE group_id = ?1)', groupId),
		stmt(db, 'DELETE FROM game_nights WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM sign_in_codes WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM hidden_copies WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM memberships WHERE group_id = ?1', groupId),
		stmt(db, 'DELETE FROM groups WHERE id = ?1', groupId)
	];
}

/** Hand-entered games person ?1 created that are on nobody's shelf, wishlist, favourites, Play soon or bring list and in nobody's play log. */
const ORPHANED_OWN_GAMES = `SELECT g.id FROM games g
	WHERE g.created_by = ?1 AND (g.is_manual = 1 OR g.source = 'manual')
	AND NOT EXISTS (SELECT 1 FROM copies c WHERE c.game_id = g.id)
	AND NOT EXISTS (SELECT 1 FROM wishlist w WHERE w.game_id = g.id)
	AND NOT EXISTS (SELECT 1 FROM favourites f WHERE f.game_id = g.id AND f.user_id <> ?1)
	AND NOT EXISTS (SELECT 1 FROM play_soon s WHERE s.game_id = g.id AND s.user_id <> ?1)
	AND NOT EXISTS (SELECT 1 FROM plays p WHERE p.game_id = g.id)
	AND NOT EXISTS (SELECT 1 FROM night_games ng WHERE ng.game_id = g.id)`;

/** Deleting a person and their data (the privacy page's promise), explicitly, for the same reason. */
export function deletePersonStatements(db: DB, userId: string): D1PreparedStatement[] {
	return [
		stmt(db, 'DELETE FROM sessions WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM personal_links WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM sign_in_codes WHERE user_id = ?1', userId),
		stmt(db, 'UPDATE sign_in_codes SET created_by = NULL WHERE created_by = ?1', userId),
		stmt(db, 'UPDATE groups SET archived_by = NULL WHERE archived_by = ?1', userId),
		stmt(db, 'UPDATE memberships SET suspended_by = NULL WHERE suspended_by = ?1', userId),
		stmt(db, 'DELETE FROM hidden_copies WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM memberships WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM copies WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM wishlist WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM favourites WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM play_soon WHERE user_id = ?1', userId),
		stmt(db, 'UPDATE copies SET lent_to_user_id = NULL WHERE lent_to_user_id = ?1', userId),
		// Their results leave every play log; the plays stay for the others in them, and a play nobody
		// is left in goes (before the orphaned-games check below, which spares games a play names).
		stmt(db, 'DELETE FROM play_players WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM plays WHERE NOT EXISTS (SELECT 1 FROM play_players pp WHERE pp.play_id = plays.id)'),
		stmt(db, 'UPDATE plays SET logged_by = NULL WHERE logged_by = ?1', userId),
		// Off every night: their answers and the games they were bringing. Nights they planned or
		// hosted stay for the others, without them.
		stmt(db, 'DELETE FROM night_people WHERE user_id = ?1', userId),
		stmt(db, 'DELETE FROM night_games WHERE brought_by = ?1', userId),
		stmt(db, 'UPDATE night_games SET added_by = NULL WHERE added_by = ?1', userId),
		stmt(db, 'UPDATE game_nights SET created_by = NULL WHERE created_by = ?1', userId),
		stmt(db, 'UPDATE game_nights SET host_id = NULL WHERE host_id = ?1', userId),
		// Games they typed in go too, with their links, unless someone else still has one on a shelf
		// or wishlist; those stay, without their name.
		stmt(db, `DELETE FROM game_links WHERE game_id IN (${ORPHANED_OWN_GAMES})`, userId),
		stmt(db, `DELETE FROM game_corrections WHERE game_id IN (${ORPHANED_OWN_GAMES})`, userId),
		stmt(db, `DELETE FROM games WHERE id IN (${ORPHANED_OWN_GAMES})`, userId),
		stmt(db, 'UPDATE games SET created_by = NULL WHERE created_by = ?1', userId),
		stmt(db, 'UPDATE games SET edited_by = NULL WHERE edited_by = ?1', userId),
		stmt(db, 'UPDATE game_links SET added_by = NULL WHERE added_by = ?1', userId),
		stmt(db, 'UPDATE game_corrections SET edited_by = NULL WHERE edited_by = ?1', userId),
		stmt(db, 'DELETE FROM users WHERE id = ?1', userId)
	];
}
