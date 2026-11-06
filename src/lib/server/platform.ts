// The one place that touches Cloudflare's runtime. Everything else receives `db` or `config` as
// arguments, so it can be tested without workerd. SvelteKit 3 provides bindings through
// `cloudflare:workers` (emulated during `vite dev`), not through `event.platform`.
import { env, waitUntil } from 'cloudflare:workers';
import { dev } from '$app/env';
import { parseInstanceConfig, type ConfigResult } from './instance.ts';

let config: ConfigResult | null = null;

/** Parsed once per isolate. Restart the dev server after editing .dev.vars or wrangler.jsonc. */
export function getConfig(): ConfigResult {
	config ??= parseInstanceConfig(env as unknown as Record<string, unknown>, { dev });
	return config;
}

export function getDb(): D1Database {
	return (env as unknown as Env).DB;
}

/** Runs work after the response is sent (a no-op in dev). */
export function afterResponse(promise: Promise<unknown>): void {
	waitUntil(promise.catch((e) => console.error('background task failed', e)));
}
