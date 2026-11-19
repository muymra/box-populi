// What SQLite plans for a statement, for tests that pin a query to its index (D82). node:sqlite has no
// row counts like D1's, so a plan that reads the wrong way passes every other test.
import { all, type DB } from '../db.ts';

/** EXPLAIN QUERY PLAN's steps, one per line. */
export async function queryPlan(db: DB, sql: string, ...params: unknown[]): Promise<string> {
	return (await all<{ detail: string }>(db, `EXPLAIN QUERY PLAN ${sql}`, ...params)).map((r) => r.detail).join('\n');
}
