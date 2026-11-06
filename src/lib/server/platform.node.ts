// The Node platform (TECH.md "Hosting targets"): Docker or any server running `node build`.
// Built with BOX_TARGET=node, which points `#lib/server/platform.ts` here. Settings come from
// environment variables; the database is a SQLite file, migrated when the server first uses it.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dev } from '$app/env';
import { parseInstanceConfig, type ConfigResult } from './instance.ts';
import { applyMigrationsSync } from './migrations.ts';
import { sqliteD1 } from './sqlite-d1.ts';

let config: ConfigResult | null = null;
let db: D1Database | null = null;

export function getConfig(): ConfigResult {
	config ??= parseInstanceConfig(process.env as Record<string, unknown>, { dev });
	return config;
}

export function getDb(): D1Database {
	if (!db) {
		const path = process.env.DATABASE_PATH || 'data/box-populi.db';
		mkdirSync(dirname(path), { recursive: true });
		const raw = new DatabaseSync(path);
		// WAL lets reads continue during a write; foreign keys match D1, which enforces them.
		raw.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
		const applied = applyMigrationsSync(raw);
		if (applied.length) console.log(`box-populi: applied migrations ${applied.join(', ')} to ${path}`);
		db = sqliteD1(raw);
	}
	return db;
}

/** Runs work after the response; Node keeps running, so there's nothing to wait for. */
export function afterResponse(promise: Promise<unknown>): void {
	promise.catch((e) => console.error('background task failed', e));
}
