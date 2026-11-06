// The schema migrations, bundled into every build (TECH.md "Hosting targets"). Cloudflare applies
// them with `wrangler d1 migrations apply`; the Node and libSQL platforms apply pending ones
// themselves, recording them in the same `d1_migrations` table wrangler uses.
import type { DatabaseSync } from 'node:sqlite';

const files = import.meta.glob('/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const MIGRATIONS: Array<{ name: string; sql: string }> = Object.entries(files)
	.map(([path, sql]) => ({ name: path.split('/').pop()!, sql }))
	.sort((a, b) => a.name.localeCompare(b.name));

const TRACKING = `CREATE TABLE IF NOT EXISTS d1_migrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT UNIQUE,
	applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/** For node:sqlite, at startup. Each migration runs in its own transaction. Returns the names applied. */
export function applyMigrationsSync(raw: DatabaseSync, migrations = MIGRATIONS): string[] {
	raw.exec(TRACKING);
	const done = new Set((raw.prepare('SELECT name FROM d1_migrations').all() as Array<{ name: string }>).map((r) => r.name));
	const applied: string[] = [];
	for (const m of migrations.filter((m) => !done.has(m.name))) {
		raw.exec('BEGIN');
		try {
			raw.exec(m.sql);
			raw.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(m.name);
			raw.exec('COMMIT');
			applied.push(m.name);
		} catch (error) {
			raw.exec('ROLLBACK');
			throw new Error(`Migration ${m.name} failed: ${(error as Error).message}`);
		}
	}
	return applied;
}

/** For libSQL (Turso), on first use. Runs each pending migration as one script with its record. */
export async function applyMigrations(
	exec: (sql: string) => Promise<unknown>,
	query: (sql: string) => Promise<Array<{ name: string }>>,
	migrations = MIGRATIONS
): Promise<string[]> {
	await exec(TRACKING);
	const done = new Set((await query('SELECT name FROM d1_migrations')).map((r) => r.name));
	const applied: string[] = [];
	for (const m of migrations.filter((m) => !done.has(m.name))) {
		if (!/^[\w.-]+\.sql$/.test(m.name)) throw new Error(`Unexpected migration name ${m.name}`);
		await exec(`BEGIN;\n${m.sql}\n;INSERT INTO d1_migrations (name) VALUES ('${m.name}');\nCOMMIT;`);
		applied.push(m.name);
	}
	return applied;
}
