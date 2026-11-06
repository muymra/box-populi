// Test databases (TECH.md "Testing"): in memory, with every migration applied, behind the same
// D1-shaped wrapper production uses. TEST_DB=libsql runs the suite on the libSQL wrapper instead
// (`pnpm test:libsql`), which is what Vercel and Netlify instances use against Turso.
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { applyMigrations, applyMigrationsSync } from '../migrations.ts';
import { sqliteD1 } from '../sqlite-d1.ts';
import { libsqlD1 } from '../libsql-d1.ts';

export function createTestDb(): D1Database {
	if (process.env.TEST_DB === 'libsql') {
		// Foreign keys stay off, as on Turso over HTTP, so the suite proves the app's explicit deletes.
		const client = createClient({ url: ':memory:' });
		const ready = client
			.execute('PRAGMA foreign_keys = OFF') // embedded libSQL defaults to on; Turso over HTTP doesn't enforce them
			.then(() => applyMigrations(
			(sql) => client.executeMultiple(sql),
				async (sql) => (await client.execute(sql)).rows as unknown as Array<{ name: string }>
			))
			.then(() => undefined);
		return libsqlD1(client, ready);
	}
	const raw = new DatabaseSync(':memory:');
	raw.exec('PRAGMA foreign_keys = ON;'); // D1 enforces foreign keys by default
	applyMigrationsSync(raw);
	return sqliteD1(raw);
}
