// The demo group's pages look the same to every signed-out visitor, so on Cloudflare each data
// centre keeps a copy for a few minutes and serves it without touching the database (D88). The hook
// in hooks.server.ts asks these rules; `pageCache()` in the platform module gives the cache, or null
// where there is none (Node, Vercel, Netlify, `vite dev`).
import { AUTO_THEME, isDeviceTheme } from '#lib/themes.ts';
import { SESSION_COOKIE } from './identity.ts';
import { ADMIN_COOKIE } from './admin.ts';
import { THEME_COOKIE } from './cookies.ts';

/** How long a data centre keeps a demo page. The demo only changes when it's reseeded. */
export const DEMO_CACHE_SECONDS = 300;

/** SvelteKit's own header on every `__data.json` response; anything else a route set means "don't keep". */
const DATA_DEFAULT = 'private, no-store';
/** Where a stored copy remembers the response's own `cache-control`, to give it back on a hit. */
const ORIGINAL_CC = 'x-box-cache-control';

/**
 * A GET of the demo group's pages (`/g/demo` and below, `__data.json` included) from a device with
 * no session, no admin sign-in and no theme of its own. Anything else can differ per person.
 * An unknown theme cookie counts as none, as the hook reads it.
 */
export function demoCacheable(method: string, pathname: string, cookie: (name: string) => string | undefined): boolean {
	if (method !== 'GET' || !/^\/g\/demo(\/|$)/.test(pathname)) return false;
	if (cookie(SESSION_COOKIE) != null || cookie(ADMIN_COOKIE) != null) return false;
	const theme = cookie(THEME_COOKIE);
	return !isDeviceTheme(theme) || theme === AUTO_THEME;
}

/** The request's own URL (a data request keeps its `__data.json`) with the build in it, so a deploy never serves pages that name the old build's scripts. */
export function demoCacheKey(requestUrl: string, build: string): string {
	const url = new URL(requestUrl);
	url.searchParams.set('bp-build', build);
	return url.toString();
}

/** A 200 whose `cache-control`, if any, is only SvelteKit's default on a data response. */
export function storable(response: Response, isDataRequest: boolean): boolean {
	if (response.status !== 200) return false;
	const cc = response.headers.get('cache-control');
	return cc == null || (isDataRequest && cc === DATA_DEFAULT);
}

/** The copy to store: no cookies, and a lifetime the cache understands. */
export function forCache(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.delete('set-cookie');
	const cc = headers.get('cache-control');
	if (cc != null) headers.set(ORIGINAL_CC, cc);
	headers.set('cache-control', `public, max-age=${DEMO_CACHE_SECONDS}`);
	return new Response(response.body, { status: response.status, headers });
}

/** A stored copy as the visitor gets it: the response's own `cache-control` back, so browsers don't keep it. */
export function fromCache(stored: Response): Response {
	const headers = new Headers(stored.headers);
	headers.delete('cache-control');
	const cc = headers.get(ORIGINAL_CC);
	headers.delete(ORIGINAL_CC);
	if (cc != null) headers.set('cache-control', cc);
	headers.set('x-box-cache', 'hit');
	return new Response(stored.body, { status: stored.status, headers });
}
