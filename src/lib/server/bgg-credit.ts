// Whether pages must credit BoardGameGeek (TECH.md "Attribution and public surface", D30).
// BGG's terms require the credit wherever BGG data is shown. An instance shows BGG data while
// BGG is on, and afterwards for as long as games fetched from BGG stay in its cache.
import { one, type DB } from './db.ts';
import type { BggMode } from './instance.ts';

export async function holdsBggData(db: DB): Promise<boolean> {
	return (await one(db, 'SELECT 1 AS x FROM games WHERE bgg_id IS NOT NULL LIMIT 1')) != null;
}

let cachedHolds: boolean | null = null;

/** BGG on: always. BGG off: only while BGG-sourced games remain, checked once per isolate. */
export async function needsBggCredit(db: DB, mode: BggMode): Promise<boolean> {
	if (mode !== 'off') return true;
	cachedHolds ??= await holdsBggData(db);
	return cachedHolds;
}
