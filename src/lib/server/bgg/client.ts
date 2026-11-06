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
/**
 * Longest a request may take, answer included, before it counts as BGG being busy. Wikidata gets
 * 8 seconds; BGG gets a little more because a `thing` call with stats for 20 games is heavier.
 */
export const BGG_TIMEOUT_MS = 10_000;

export class BggAuthError extends Error {
	constructor(status: number) {
		super(`BGG refused the request (HTTP ${status}). Check BGG_TOKEN and that the application is approved.`);
		this.name = 'BggAuthError';
	}
}

/**
 * How we introduce ourselves to BGG and Wikidata: the software and version, then the instance,
 * how to reach the person who runs it (INSTANCE_CONTACT), and the source code. Wikimedia asks for
 * a way to contact the operator; the repository alone would reach the project, not this host.
 */
export function userAgent(origin: string, contact?: string): string {
	return `BoxPopuli/${pkg.version} (${origin}; ${contact ? `${contact}; ` : ''}+${SOURCE_URL})`;
}

function retryAfterMs(header: string | null): number | null {
	if (!header) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10 * 60_000);
	const date = Date.parse(header);
	return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 10 * 60_000)) : null;
}

/** A request that ran out of time reports BGG as busy, so callers show their usual busy message. */
async function timed<T>(work: Promise<T>): Promise<T> {
	try {
		return await work;
	} catch (e) {
		const name = (e as { name?: unknown } | null)?.name;
		if (name === 'TimeoutError' || name === 'AbortError') throw new BggBusyError(BACKOFF_MS);
		throw e;
	}
}

type BggResponse = { status: number; ok: boolean; text: string };

export type LiveClientOptions = {
	token: string;
	db: DB;
	intervalMs: number;
	origin: string;
	/** INSTANCE_CONTACT, for the User-Agent. */
	contact?: string;
	fetchFn?: typeof fetch;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	timeoutMs?: number;
};

export class LiveBggClient implements BggClient {
	private fetchFn: typeof fetch;
	private now: () => number;
	private sleep: (ms: number) => Promise<void>;
	private timeoutMs: number;

	constructor(private opts: LiveClientOptions) {
		// A plain function, never `fetch` itself as a property: Workers throw "Illegal invocation"
		// when fetch is called with `this` set to another object.
		this.fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
		this.now = opts.now ?? Date.now;
		this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.timeoutMs = opts.timeoutMs ?? BGG_TIMEOUT_MS;
	}

	private async request(path: string): Promise<BggResponse> {
		const now = this.now();
		const slot = await reserveSlot(this.opts.db, now, this.opts.intervalMs, MAX_SLOT_WAIT_MS);
		if (!slot.ok) throw new BggBusyError(slot.waitMs);
		const wait = slot.slotAt - now;
		if (wait > 0) await this.sleep(wait);

		const fetchFn = this.fetchFn;
		// Started after the wait for the slot, and it covers reading the body too.
		const signal = AbortSignal.timeout(this.timeoutMs);
		const response = await timed(
			fetchFn(BGG_BASE + path, {
				headers: {
					Authorization: `Bearer ${this.opts.token}`,
					'User-Agent': userAgent(this.opts.origin, this.opts.contact),
					Accept: 'application/xml, text/xml'
				},
				signal
			})
		);
		if (response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503) {
			const delay = retryAfterMs(response.headers.get('retry-after')) ?? BACKOFF_MS;
			await backOff(this.opts.db, this.now() + delay);
			throw new BggBusyError(delay);
		}
		if (response.status === 401 || response.status === 403) throw new BggAuthError(response.status);
		const text = response.ok ? await timed(response.text()) : '';
		return { status: response.status, ok: response.ok, text };
	}

	async search(query: string): Promise<BggSearchHit[]> {
		const response = await this.request(`search?query=${encodeURIComponent(query)}&type=boardgame,boardgameexpansion`);
		if (!response.ok) throw new Error(`BGG search failed (HTTP ${response.status})`);
		return parseSearch(response.text);
	}

	async things(bggIds: number[]): Promise<BggThing[]> {
		const ids = [...new Set(bggIds)].filter((id) => Number.isInteger(id) && id > 0);
		const out: BggThing[] = [];
		for (let i = 0; i < ids.length; i += THINGS_PER_REQUEST) {
			const chunk = ids.slice(i, i + THINGS_PER_REQUEST);
			const response = await this.request(`thing?id=${chunk.join(',')}&stats=1`);
			if (!response.ok) throw new Error(`BGG thing request failed (HTTP ${response.status})`);
			out.push(...parseThings(response.text));
		}
		return out;
	}

	async collection(username: string): Promise<BggCollectionResult> {
		const response = await this.request(`collection?username=${encodeURIComponent(username)}&own=1`);
		if (response.status === 202) return { status: 'pending' };
		if (!response.ok) throw new Error(`BGG collection request failed (HTTP ${response.status})`);
		return parseCollection(response.text);
	}
}

/** The client for this instance's BGG_MODE, or null when BGG is switched off. */
export function getBggClient(config: InstanceConfig, db: DB, origin: string): BggClient | null {
	if (config.bggMode === 'off') return null;
	if (config.bggMode === 'fake') return new FakeBggClient();
	return new LiveBggClient({ token: config.bggToken ?? '', db, intervalMs: config.bggMinIntervalMs, origin, contact: config.instanceContact });
}
