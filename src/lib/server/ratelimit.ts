// Fixed-window rate limits stored in D1 (TECH.md "Security"). Pages has no cron, so old rows for
// a subject and kind are deleted whenever a new one is recorded.
import { one, stmt, type DB } from './db.ts';

export type Limit = { kind: string; max: number; windowMs: number };

export const LIMITS = {
	joinFail: { kind: 'join_fail', max: 5, windowMs: 10 * 60_000 },
	groupCreate: { kind: 'group_create', max: 5, windowMs: 24 * 60 * 60_000 },
	linkFail: { kind: 'link_fail', max: 10, windowMs: 60 * 60_000 },
	adminFail: { kind: 'admin_fail', max: 5, windowMs: 15 * 60_000 },
	bggSearch: { kind: 'bgg_search', max: 30, windowMs: 60_000 },
	wikidataSearch: { kind: 'wikidata_search', max: 30, windowMs: 60_000 },
	listMatch: { kind: 'list_match', max: 40, windowMs: 10 * 60_000 }, // a 200-line list is 20 calls
	bggImport: { kind: 'bgg_import', max: 20, windowMs: 10 * 60_000 } // one lookup can poll up to 12 times
} satisfies Record<string, Limit>;

export const ipSubject = (ip: string) => `ip:${ip}`;

/** The longest window above. Rows older than this are deleted on every write, whoever they belong to. */
export const KEEP_MS = Math.max(...Object.values(LIMITS).map((l) => l.windowMs));

export async function isLimited(db: DB, subject: string, limit: Limit, now: number): Promise<boolean> {
	const row = await one<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM rate_events WHERE subject = ?1 AND kind = ?2 AND at > ?3',
		subject,
		limit.kind,
		now - limit.windowMs
	);
	return (row?.n ?? 0) >= limit.max;
}

export async function recordEvent(db: DB, subject: string, limit: Limit, now: number): Promise<void> {
	await db.batch([
		stmt(db, 'DELETE FROM rate_events WHERE subject = ?1 AND kind = ?2 AND at <= ?3', subject, limit.kind, now - limit.windowMs),
		// Keeps the privacy page's "about a day" true for addresses that never come back.
		stmt(db, 'DELETE FROM rate_events WHERE at <= ?1', now - KEEP_MS),
		stmt(db, 'INSERT INTO rate_events (subject, kind, at) VALUES (?1, ?2, ?3)', subject, limit.kind, now)
	]);
}
