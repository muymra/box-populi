// A D1-shaped wrapper around @libsql/client (TECH.md "Hosting targets"), for Vercel and Netlify
// instances on Turso. Positional ?1 parameters work as in D1; batch() is a write transaction.
// Turso doesn't enforce foreign keys over HTTP, so the app deletes dependent rows itself
// (deleteGroupStatements, deletePersonStatements in db.ts) instead of relying on cascades.
import type { Client, InStatement, ResultSet } from '@libsql/client';

type Row = Record<string, unknown>;

const toArgs = (params: unknown[]) =>
	params.map((p) => (typeof p === 'boolean' ? Number(p) : p === undefined ? null : p)) as Array<string | number | bigint | null>;

function rows<T>(rs: ResultSet): T[] {
	return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])) as T);
}

const runResult = (rs: ResultSet) => ({
	success: true,
	results: [],
	meta: { changes: rs.rowsAffected, last_row_id: rs.lastInsertRowid == null ? 0 : Number(rs.lastInsertRowid) }
});

class LibsqlStatement {
	constructor(
		private client: Client,
		private ready: Promise<void>,
		readonly sql: string,
		private params: unknown[] = []
	) {}

	bind(...params: unknown[]) {
		return new LibsqlStatement(this.client, this.ready, this.sql, params);
	}

	get statement(): InStatement {
		return { sql: this.sql, args: toArgs(this.params) };
	}

	private async execute() {
		await this.ready;
		return this.client.execute(this.statement);
	}

	async first<T = Row>(column?: string): Promise<T | null> {
		const row = rows<Row>(await this.execute())[0];
		if (!row) return null;
		return (column ? row[column] : row) as T;
	}

	async all<T = Row>() {
		return { results: rows<T>(await this.execute()), success: true, meta: {} };
	}

	async run() {
		return runResult(await this.execute());
	}
}

/** `ready` resolves once the database may be used (migrations applied). */
export function libsqlD1(client: Client, ready: Promise<void> = Promise.resolve()): D1Database {
	const db = {
		prepare: (sql: string) => new LibsqlStatement(client, ready, sql),
		async batch(statements: LibsqlStatement[]) {
			await ready;
			const results = await client.batch(
				statements.map((s) => s.statement),
				'write'
			);
			return results.map((rs, i) => (/\breturning\b/i.test(statements[i].sql) ? { results: rows(rs), success: true, meta: {} } : runResult(rs)));
		},
		async exec(sql: string) {
			await ready;
			await client.executeMultiple(sql);
			return { count: 0, duration: 0 };
		}
	};
	return db as unknown as D1Database;
}
