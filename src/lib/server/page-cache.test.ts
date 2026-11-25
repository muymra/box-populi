import { describe, expect, it } from 'vitest';
import { DEMO_CACHE_SECONDS, demoCacheKey, demoCacheable, forCache, fromCache, storable } from './page-cache.ts';

const jar = (cookies: Record<string, string> = {}) => (name: string) => cookies[name];

describe('demoCacheable', () => {
	it('takes a signed-out GET of the demo group, pages and data requests alike', () => {
		expect(demoCacheable('GET', '/g/demo', jar())).toBe(true);
		expect(demoCacheable('GET', '/g/demo/plays', jar())).toBe(true);
		expect(demoCacheable('GET', '/g/demo/plays/__data.json', jar())).toBe(true);
		expect(demoCacheable('GET', '/g/demo', jar({ bp_group: 'demo' }))).toBe(true);
	});

	it('leaves other groups, other pages and other methods alone', () => {
		expect(demoCacheable('GET', '/g/sandbox', jar())).toBe(false);
		expect(demoCacheable('GET', '/g/demonic/plays', jar())).toBe(false);
		expect(demoCacheable('GET', '/demo', jar())).toBe(false);
		expect(demoCacheable('GET', '/', jar())).toBe(false);
		expect(demoCacheable('POST', '/g/demo/plays', jar())).toBe(false);
		expect(demoCacheable('HEAD', '/g/demo', jar())).toBe(false);
	});

	it('leaves anyone signed in, or signed in as the hoster, alone', () => {
		expect(demoCacheable('GET', '/g/demo', jar({ bp_session: 'x' }))).toBe(false);
		expect(demoCacheable('GET', '/g/demo', jar({ bp_admin: 'x' }))).toBe(false);
	});

	it('leaves a device with its own theme alone, but not one on Automatic or with a cookie the hook ignores', () => {
		expect(demoCacheable('GET', '/g/demo', jar({ bp_theme: 'dracula' }))).toBe(false);
		expect(demoCacheable('GET', '/g/demo', jar({ bp_theme: 'auto' }))).toBe(true);
		expect(demoCacheable('GET', '/g/demo', jar({ bp_theme: 'not-a-theme' }))).toBe(true);
	});
});

describe('demoCacheKey', () => {
	it('keeps the path and query and adds the build', () => {
		const key = new URL(demoCacheKey('https://x.example/g/demo/plays/__data.json?x-sveltekit-invalidated=01', 'b1'));
		expect(key.pathname).toBe('/g/demo/plays/__data.json');
		expect(key.searchParams.get('x-sveltekit-invalidated')).toBe('01');
		expect(key.searchParams.get('bp-build')).toBe('b1');
		expect(demoCacheKey('https://x.example/g/demo', 'b1')).not.toBe(demoCacheKey('https://x.example/g/demo', 'b2'));
	});
});

describe('storable', () => {
	it('keeps a 200 page with no cache header, and a data response with only SvelteKit’s', () => {
		expect(storable(new Response('x'), false)).toBe(true);
		expect(storable(new Response('x', { headers: { 'cache-control': 'private, no-store' } }), true)).toBe(true);
	});

	it('refuses anything else', () => {
		expect(storable(new Response('x', { status: 404 }), false)).toBe(false);
		expect(storable(new Response(null, { status: 303, headers: { location: '/' } }), false)).toBe(false);
		expect(storable(new Response('x', { headers: { 'cache-control': 'no-store' } }), false)).toBe(false);
		expect(storable(new Response('x', { headers: { 'cache-control': 'private, no-store' } }), false)).toBe(false);
		expect(storable(new Response('x', { headers: { 'cache-control': 'no-store' } }), true)).toBe(false);
	});
});

describe('forCache and fromCache', () => {
	it('stores without cookies for the cache’s lifetime, then gives the visitor the original header back', async () => {
		const original = new Response('body', {
			headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'set-cookie': 'bp_group=demo' }
		});
		const stored = forCache(original);
		expect(stored.headers.get('set-cookie')).toBeNull();
		expect(stored.headers.get('cache-control')).toBe(`public, max-age=${DEMO_CACHE_SECONDS}`);
		const served = fromCache(stored);
		expect(served.headers.get('cache-control')).toBe('private, no-store');
		expect(served.headers.get('x-box-cache')).toBe('hit');
		expect(served.headers.get('x-box-cache-control')).toBeNull();
		expect(served.headers.get('content-type')).toBe('application/json');
		expect(await served.text()).toBe('body');
	});

	it('serves a page that had no cache header without one', () => {
		const served = fromCache(forCache(new Response('<html>', { headers: { 'content-type': 'text/html' } })));
		expect(served.headers.get('cache-control')).toBeNull();
	});
});
