// The live BGG XML API client (TECH.md "Client"). Every request goes through the instance-wide
// pacer, carries the bearer token and an identifying User-Agent, and backs the whole instance off
// when BGG throttles. Not yet run against BGG itself: STATUS.md tracks that.
import pkg from '../../../../package.json';
import { SOURCE_URL } from '#lib/project.ts';
import { parseCollection, parseSearch, parseThings } from './parse.ts';
import { BACKOFF_MS, backOff, reserveSlot } from './pace.ts';
import { FakeBggClient } from './fake.ts';
import {
	BggBusyError,
	THINGS_PER_REQUEST,
	type BggClient,
	type BggCollectionResult,
	type BggSearchHit,
	type BggThing
} from './types.ts';
import type { DB } from '../db.ts';
import type { InstanceConfig } from '../instance.ts';

export const BGG_BASE = 'https://boardgamegeek.com/xmlapi2/';
/** Longest a request will wait for its slot before telling the caller BGG is busy. */
export const MAX_SLOT_WAIT_MS = 15_000;

export class BggAuthError extends Error {
	constructor(status: number) {
		super(`BGG refused the request (HTTP ${status}). Check BGG_TOKEN and that the application is approved.`);
		this.name = 'BggAuthError';
	}
}

export function userAgent(origin: string): string {
	return `BoxPopuli/${pkg.version} (+${SOURCE_URL}; instance=${origin})`;
}

function retryAfterMs(header: string | null): number | null {
	if (!header) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10 * 60_000);
	const date = Date.parse(header);
	return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 10 * 60_000)) : null;
}

export type LiveClientOptions = {
	token: string;
	db: DB;
	intervalMs: number;
	origin: string;
	fetchFn?: typeof fetch;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
};

export class LiveBggClient implements BggClient {
	private fetchFn: typeof fetch;
	private now: () => number;
	private sleep: (ms: number) => Promise<void>;

	constructor(private opts: LiveClientOptions) {
		this.fetchFn = opts.fetchFn ?? fetch;
		this.now = opts.now ?? Date.now;
		this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	}

	private async request(path: string): Promise<Response> {
		const now = this.now();
		const slot = await reserveSlot(this.opts.db, now, this.opts.intervalMs);
		const wait = slot - now;
		if (wait > MAX_SLOT_WAIT_MS) throw new BggBusyError(wait);
		if (wait > 0) await this.sleep(wait);

		const response = await this.fetchFn(BGG_BASE + path, {
			headers: {
				Authorization: `Bearer ${this.opts.token}`,
				'User-Agent': userAgent(this.opts.origin),
				Accept: 'application/xml, text/xml'
			}
		});
		if (response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503) {
			const delay = retryAfterMs(response.headers.get('retry-after')) ?? BACKOFF_MS;
			await backOff(this.opts.db, this.now() + delay);
			throw new BggBusyError(delay);
		}
		if (response.status === 401 || response.status === 403) throw new BggAuthError(response.status);
		return response;
	}

	async search(query: string): Promise<BggSearchHit[]> {
		const response = await this.request(`search?query=${encodeURIComponent(query)}&type=boardgame,boardgameexpansion`);
		if (!response.ok) throw new Error(`BGG search failed (HTTP ${response.status})`);
		return parseSearch(await response.text());
	}

	async things(bggIds: number[]): Promise<BggThing[]> {
		const ids = [...new Set(bggIds)].filter((id) => Number.isInteger(id) && id > 0);
		const out: BggThing[] = [];
		for (let i = 0; i < ids.length; i += THINGS_PER_REQUEST) {
			const chunk = ids.slice(i, i + THINGS_PER_REQUEST);
			const response = await this.request(`thing?id=${chunk.join(',')}&stats=1`);
			if (!response.ok) throw new Error(`BGG thing request failed (HTTP ${response.status})`);
			out.push(...parseThings(await response.text()));
		}
		return out;
	}

	async collection(username: string): Promise<BggCollectionResult> {
		const response = await this.request(`collection?username=${encodeURIComponent(username)}&own=1`);
		if (response.status === 202) return { status: 'pending' };
		if (!response.ok) throw new Error(`BGG collection request failed (HTTP ${response.status})`);
		return parseCollection(await response.text());
	}
}

/** The client for this instance's BGG_MODE, or null when BGG is switched off. */
export function getBggClient(config: InstanceConfig, db: DB, origin: string): BggClient | null {
	if (config.bggMode === 'off') return null;
	if (config.bggMode === 'fake') return new FakeBggClient();
	return new LiveBggClient({ token: config.bggToken ?? '', db, intervalMs: config.bggMinIntervalMs, origin });
}
