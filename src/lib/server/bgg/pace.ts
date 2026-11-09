// Instance-wide spacing of BGG requests (TECH.md "Client", DECISIONS D23). Isolates share no
// memory, so the schedule lives in the one-row `bgg_pace` table. D1 applies writes one at a time,
// so concurrent callers always get distinct slots at least `intervalMs` apart.
import { one, run, type DB } from '../db.ts';

export const BACKOFF_MS = 30_000;

export type Reservation = { ok: true; slotAt: number } | { ok: false; waitMs: number };

/**
 * Reserves the next request slot (ms) if it comes within `maxWaitMs`; the caller waits until then.
 * The check and the reservation are one statement, so a refused caller moves nothing: a run of
 * refusals can't push the queue out and lock every other request on the instance out of BGG.
 */
export async function reserveSlot(db: DB, now: number, intervalMs: number, maxWaitMs: number): Promise<Reservation> {
	const row = await one<{ slot_at: number }>(
		db,
		`UPDATE bgg_pace SET next_at = MAX(next_at, ?1) + ?2
		 WHERE id = 1 AND MAX(next_at, ?1) - ?1 <= ?3
		 RETURNING next_at - ?2 AS slot_at`,
		now,
		intervalMs,
		maxWaitMs
	);
	if (row) return { ok: true, slotAt: row.slot_at };
	// Only for the retry hint. next_at never moves back, so this wait is at least the refused one.
	const pace = await one<{ next_at: number }>(db, 'SELECT next_at FROM bgg_pace WHERE id = 1');
	if (!pace) throw new Error('bgg_pace row is missing; was the migration applied?');
	return { ok: false, waitMs: Math.max(0, pace.next_at - now) };
}

/** Pushes the whole instance's next slot out after BGG throttles us. */
export async function backOff(db: DB, until: number): Promise<void> {
	await run(db, 'UPDATE bgg_pace SET next_at = MAX(next_at, ?1) WHERE id = 1', until);
}

/** Bulk work waits for at least this much quiet (D58): BGG's older wiki said five seconds sufficed. */
export const BULK_GAP_MS = 5_000;

/**
 * A slot for bulk work (imports, loading details, Find on BoardGameGeek; D58). It's taken only once
 * the instance has made no request for `gapMs`, and never booked ahead, so a member's search never
 * queues behind an import: searches keep `reserveSlot`'s plain interval. `next_at` is the last slot
 * plus `intervalMs`, so quiet for `gapMs` means `now >= next_at - intervalMs + gapMs`.
 */
export async function takeBulkSlot(db: DB, now: number, intervalMs: number, gapMs: number): Promise<Reservation> {
	const row = await one<{ slot_at: number }>(
		db,
		`UPDATE bgg_pace SET next_at = ?1 + ?2
		 WHERE id = 1 AND next_at - ?2 + ?3 <= ?1
		 RETURNING ?1 AS slot_at`,
		now,
		intervalMs,
		gapMs
	);
	if (row) return { ok: true, slotAt: row.slot_at };
	const pace = await one<{ next_at: number }>(db, 'SELECT next_at FROM bgg_pace WHERE id = 1');
	if (!pace) throw new Error('bgg_pace row is missing; was the migration applied?');
	return { ok: false, waitMs: Math.max(0, pace.next_at - intervalMs + gapMs - now) };
}

/** Counts a request sent to BGG, and whether BGG pushed back, for /admin (D58). */
export async function countRequest(db: DB, now: number, throttled: boolean): Promise<void> {
	await run(
		db,
		`INSERT INTO bgg_daily (day, requests, throttled) VALUES (?1, 1, ?2)
		 ON CONFLICT(day) DO UPDATE SET requests = requests + 1, throttled = throttled + excluded.throttled`,
		new Date(now).toISOString().slice(0, 10),
		throttled ? 1 : 0
	);
}
