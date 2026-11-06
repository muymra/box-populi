// A D1-shaped wrapper around node:sqlite (TECH.md "Hosting targets"). The Node platform (Docker)
// runs on it, and so do the tests, which is why the app code never needs to know which it has.
import type { DatabaseSync, StatementSync } from 'node:sqlite';

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

	async all<T = Row>() {
		return { results: this.prepared().all(...toArgs(this.params)) as T[], success: true, meta: {} };
	}

	async run() {
		const info = this.prepared().run(...toArgs(this.params));
		return { success: true, results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
	}

	/** Used by batch(): statements with RETURNING need all(), others run(). */
	async execute() {
		return /\breturning\b/i.test(this.sql) ? this.all() : this.run();
	}
}

export function sqliteD1(raw: DatabaseSync): D1Database {
	const db = {
		prepare: (sql: string) => new SqliteStatement(raw, sql),
		// D1's batch is a transaction.
		async batch(statements: SqliteStatement[]) {
			raw.exec('BEGIN');
			try {
				const results = [];
				for (const s of statements) results.push(await s.execute());
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
