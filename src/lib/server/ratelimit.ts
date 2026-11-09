// Fixed-window rate limits stored in D1 (TECH.md "Security"). Pages has no cron, so old rows are
// deleted whenever a try is taken.
import { run, stmt, type DB } from './db.ts';

export type Limit = { kind: string; max: number; windowMs: number };

export const LIMITS = {
	joinFail: { kind: 'join_fail', max: 5, windowMs: 10 * 60_000 },
	// Across the whole instance, so many addresses can't share out the guessing (subject INSTANCE).
	joinFailInstance: { kind: 'join_fail_all', max: 100, windowMs: 60 * 60_000 },
	groupCreate: { kind: 'group_create', max: 5, windowMs: 24 * 60 * 60_000 },
	linkFail: { kind: 'link_fail', max: 10, windowMs: 60 * 60_000 },
	// Wrong PINs at a group's front door (D47): per address, per person (so a person's PIN can't be
	// worked through from many addresses), and across the instance.
	pinFail: { kind: 'pin_fail', max: 10, windowMs: 10 * 60_000 },
	pinFailPerson: { kind: 'pin_fail_person', max: 5, windowMs: 15 * 60_000 },
	pinFailInstance: { kind: 'pin_fail_all', max: 200, windowMs: 60 * 60_000 },
	adminFail: { kind: 'admin_fail', max: 5, windowMs: 15 * 60_000 },
	bggSearch: { kind: 'bgg_search', max: 30, windowMs: 60_000 },
	wikidataSearch: { kind: 'wikidata_search', max: 30, windowMs: 60_000 },
	listMatch: { kind: 'list_match', max: 40, windowMs: 10 * 60_000 }, // a 200-line list is 20 calls
	bggImport: { kind: 'bgg_import', max: 20, windowMs: 10 * 60_000 }, // one lookup can poll up to 12 times, then one confirm
	// Find on BoardGameGeek: one typed-in game per call, a search and a details request each (D57).
	// About a game every ten seconds in the bulk lane (D58), so this rarely bites; then the page pauses.
	bggMatch: { kind: 'bgg_match', max: 120, windowMs: 10 * 60_000 },
	// Each step fills in 20 games, so 1,200 games per 10 minutes; past that the page pauses, then carries on.
	bggHydrate: { kind: 'bgg_hydrate', max: 60, windowMs: 10 * 60_000 }
} satisfies Record<string, Limit>;

/** The subject for limits that count the whole instance. */
export const INSTANCE = 'instance';

/**
 * The subject for a network address. An IPv6 address counts by its /64, the block a single
 * connection is usually given, so rotating addresses inside it doesn't buy more tries.
 */
export function ipSubject(ip: string): string {
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
	if (mapped) return `ip:${mapped[1]}`;
	if (!ip.includes(':')) return `ip:${ip}`;
	const [head, tail] = ip.split('::');
	const left = head ? head.split(':') : [];
	const right = tail ? tail.split(':') : [];
	const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
	return `ip:${groups
		.slice(0, 4)
		.map((g) => (parseInt(g, 16) || 0).toString(16))
		.join(':')}::/64`;
}

/** The longest window above. Rows older than this are deleted on every take, whoever they belong to. */
export const KEEP_MS = Math.max(...Object.values(LIMITS).map((l) => l.windowMs));

export type Take = { ok: true; taken: number[] } | { ok: false; limit: Limit };

/**
 * Takes one try from each limit, or none if any is used up. Each take is a single INSERT that
 * counts first, so parallel requests can't all slip under a limit the way a separate check and
 * record would. Limits that count only failures (a wrong code, key or link) take a try up front
 * and `giveBack` the rows when the attempt turns out right.
 */
export async function take(db: DB, now: number, ...limits: Array<[subject: string, limit: Limit]>): Promise<Take> {
	const taken: number[] = [];
	for (const [subject, limit] of limits) {
		const results = await db.batch<{ id: number }>([
			stmt(db, 'DELETE FROM rate_events WHERE subject = ?1 AND kind = ?2 AND at <= ?3', subject, limit.kind, now - limit.windowMs),
			// Keeps the privacy page's "about a day" true for addresses that never come back.
			stmt(db, 'DELETE FROM rate_events WHERE at <= ?1', now - KEEP_MS),
			stmt(
				db,
				`INSERT INTO rate_events (subject, kind, at)
				 SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM rate_events WHERE subject = ?1 AND kind = ?2 AND at > ?4) < ?5
				 RETURNING rowid AS id`,
				subject,
				limit.kind,
				now,
				now - limit.windowMs,
				limit.max
			)
		]);
		const id = results[2]?.results[0]?.id;
		if (id == null) {
			await giveBack(db, taken);
			return { ok: false, limit };
		}
		taken.push(id);
	}
	return { ok: true, taken };
}

/** Returns tries that turned out not to count. */
export async function giveBack(db: DB, taken: number[]): Promise<void> {
	if (taken.length === 0) return;
	await run(db, `DELETE FROM rate_events WHERE rowid IN (${taken.map((_, i) => `?${i + 1}`).join(', ')})`, ...taken);
}
