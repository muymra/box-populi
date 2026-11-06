// Instance-wide spacing of BGG requests (TECH.md "Client", DECISIONS D23). Isolates share no
// memory, so the schedule lives in the one-row `bgg_pace` table. D1 applies writes one at a time,
// so concurrent callers always get distinct slots at least `intervalMs` apart.
import { one, run, type DB } from '../db.ts';

export const BACKOFF_MS = 30_000;

/** Reserves the next request slot and returns its time (ms). The caller waits until then. */
export async function reserveSlot(db: DB, now: number, intervalMs: number): Promise<number> {
	const row = await one<{ slot_at: number }>(
		db,
		`UPDATE bgg_pace SET next_at = MAX(next_at, ?1) + ?2 WHERE id = 1 RETURNING next_at - ?2 AS slot_at`,
		now,
		intervalMs
	);
	if (!row) throw new Error('bgg_pace row is missing; was the migration applied?');
	return row.slot_at;
}

/** Pushes the whole instance's next slot out after BGG throttles us. */
export async function backOff(db: DB, until: number): Promise<void> {
	await run(db, 'UPDATE bgg_pace SET next_at = MAX(next_at, ?1) WHERE id = 1', until);
}
