// A D1-shaped wrapper around node:sqlite (TECH.md "Hosting targets"). The Node platform (Docker)
// runs on it, and so do the tests, which is why the app code never needs to know which it has.
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { returnsRows } from './db.ts';

type Row = Record<string, unknown>;

// node:sqlite refuses booleans and undefined; D1 stores booleans as 0/1 and undefined as NULL.
const toArgs = (params: unknown[]) => params.map((p) => (typeof p === 'boolean' ? Number(p) : p === undefined ? null : p)) as never[];

class SqliteStatement {
	constructor(
		private db: DatabaseSync,
		readonly sql: string,
		private params: unknown[] = []
	) {}

	bind(...params: unknown[]) {
		return new SqliteStatement(this.db, this.sql, params);
	}

	private prepared(): StatementSync {
		return this.db.prepare(this.sql);
	}

	async first<T = Row>(column?: string): Promise<T | null> {
		const row = this.prepared().get(...toArgs(this.params)) as Row | undefined;
		if (!row) return null;
		return (column ? row[column] : row) as T;
	}

	private allSync<T>() {
		return { results: this.prepared().all(...toArgs(this.params)) as T[], success: true, meta: {} };
	}

	private runSync() {
		const info = this.prepared().run(...toArgs(this.params));
		return { success: true, results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
	}

	async all<T = Row>() {
		return this.allSync<T>();
	}

	async run() {
		return this.runSync();
	}

	/** Used by batch(): reads and statements with RETURNING give their rows, as D1's batch does; others run(). */
	executeSync() {
		return returnsRows(this.sql) ? this.allSync() : this.runSync();
	}
}

export function sqliteD1(raw: DatabaseSync): D1Database {
	const db = {
		prepare: (sql: string) => new SqliteStatement(raw, sql),
		// D1's batch is a transaction. It runs without yielding, so no other query can land inside
		// it, and statements in it can rely on last_insert_rowid() from the one before.
		async batch(statements: SqliteStatement[]) {
			raw.exec('BEGIN');
			try {
				const results = statements.map((s) => s.executeSync());
				raw.exec('COMMIT');
				return results;
			} catch (error) {
				raw.exec('ROLLBACK');
				throw error;
			}
		},
		async exec(sql: string) {
			raw.exec(sql);
			return { count: 0, duration: 0 };
		}
	};
	return db as unknown as D1Database;
}
