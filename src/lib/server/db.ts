// Thin helpers over D1. Every value is bound by position; D1 doesn't support named parameters.

export type DB = D1Database;

export function stmt(db: DB, sql: string, ...params: unknown[]): D1PreparedStatement {
	return db.prepare(sql).bind(...params);
}

export async function one<T>(db: DB, sql: string, ...params: unknown[]): Promise<T | null> {
	return (await stmt(db, sql, ...params).first<T>()) ?? null;
}

export async function all<T>(db: DB, sql: string, ...params: unknown[]): Promise<T[]> {
	return (await stmt(db, sql, ...params).all<T>()).results;
}

export async function run(db: DB, sql: string, ...params: unknown[]): Promise<D1Result> {
	return stmt(db, sql, ...params).run();
}

/** Reads a JSON array column, tolerating bad data instead of failing the page. */
export function jsonArray<T>(raw: unknown): T[] {
	if (typeof raw !== 'string') return [];
	try {
		const value = JSON.parse(raw);
		return Array.isArray(value) ? (value as T[]) : [];
	} catch {
		return [];
	}
}
