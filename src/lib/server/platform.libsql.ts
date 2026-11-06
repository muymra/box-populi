// The serverless platform for Vercel and Netlify (TECH.md "Hosting targets"). Built with
// BOX_TARGET=vercel or netlify, which points `#lib/server/platform.ts` here. These hosts have no
// disk, so the database is Turso (libSQL) over HTTP: DATABASE_URL and DATABASE_AUTH_TOKEN.
// Pending migrations run on a cold start's first query.
import { createClient } from '@libsql/client/web';
import { dev } from '$app/env';
import { parseInstanceConfig, type ConfigResult } from './instance.ts';
import { applyMigrations } from './migrations.ts';
import { libsqlD1 } from './libsql-d1.ts';

let config: ConfigResult | null = null;
let db: D1Database | null = null;

export function getConfig(): ConfigResult {
	if (!config) {
		const base = parseInstanceConfig(process.env as Record<string, unknown>, { dev });
		const missing = process.env.DATABASE_URL ? [] : ['DATABASE_URL is required: your Turso database URL, like libsql://box-populi-you.turso.io.'];
		config = missing.length ? { ok: false, errors: [...(base.ok ? [] : base.errors), ...missing] } : base;
	}
	return config;
}

export function getDb(): D1Database {
	if (!db) {
		const client = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
		const ready = applyMigrations(
			(sql) => client.executeMultiple(sql),
			async (sql) => (await client.execute(sql)).rows as unknown as Array<{ name: string }>
		).then((applied) => {
			if (applied.length) console.log(`box-populi: applied migrations ${applied.join(', ')}`);
		});
		// A failed start (bad URL, Turso down) shouldn't stick: the next request tries again.
		ready.catch(() => {
			db = null;
		});
		db = libsqlD1(client, ready);
	}
	return db;
}

/** Serverless functions may stop once the response is sent; nothing in the app relies on this. */
export function afterResponse(promise: Promise<unknown>): void {
	promise.catch((e) => console.error('background task failed', e));
}
