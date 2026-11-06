// A D1-shaped wrapper around node:sqlite for tests (TECH.md "Testing"). It runs the real
// migrations, so SQL tests exercise the same schema production uses. Test-only; never imported
// by app code.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

type Row = Record<string, unknown>;

class TestStatement {
	constructor(
		private db: DatabaseSync,
		private sql: string,
		private params: unknown[] = []
	) {}

	bind(...params: unknown[]) {
		return new TestStatement(this.db, this.sql, params);
	}

	private prepared(): StatementSync {
		return this.db.prepare(this.sql);
	}

	private args() {
		// node:sqlite takes booleans as errors; D1 stores them as 0/1.
		return this.params.map((p) => (typeof p === 'boolean' ? Number(p) : p === undefined ? null : p)) as never[];
	}

	async first<T = Row>(column?: string): Promise<T | null> {
		const row = this.prepared().get(...this.args()) as Row | undefined;
		if (!row) return null;
		return (column ? row[column] : row) as T;
	}

	async all<T = Row>() {
		return { results: this.prepared().all(...this.args()) as T[], success: true, meta: {} };
	}

	async run() {
		const info = this.prepared().run(...this.args());
		return { success: true, results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
	}

	/** Used by batch(): statements with RETURNING need all(), others run(). */
	async execute() {
		return /\breturning\b/i.test(this.sql) ? this.all() : this.run();
	}
}

export function createTestDb(): D1Database & { raw: DatabaseSync } {
	const raw = new DatabaseSync(':memory:');
	raw.exec('PRAGMA foreign_keys = ON;'); // D1 enforces foreign keys by default
	const dir = new URL('../../../../migrations/', import.meta.url);
	for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
		raw.exec(readFileSync(new URL(file, dir), 'utf8'));
	}

	const db = {
		raw,
		prepare: (sql: string) => new TestStatement(raw, sql),
		async batch(statements: TestStatement[]) {
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
	return db as unknown as D1Database & { raw: DatabaseSync };
}
