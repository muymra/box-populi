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
