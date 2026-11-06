// BGG title search for the add page (TECH.md "Search"). For this app's own pages only: needs a
// session, sends no CORS headers, and is rate-limited per person.
import { getBggClient, BggAuthError } from '#lib/server/bgg/client.ts';
import { BggBusyError } from '#lib/server/bgg/types.ts';
import { searchBgg } from '#lib/server/games.ts';
import { getDb } from '#lib/server/platform.ts';
import { isLimited, LIMITS, recordEvent } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
	Response.json({ error: message, ...extra }, { status, headers: { 'cache-control': 'no-store' } });

export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return error(401, 'Sign in on this device to search.');

	const query = (event.url.searchParams.get('q') ?? '').trim().slice(0, 100);
	if (query.length < 3) return Response.json({ results: [] });

	const db = getDb();
	const client = getBggClient(event.locals.config, db, event.url.origin);
	if (!client) return error(503, 'BoardGameGeek search isn’t set up on this site. Add the game by hand below.');

	const now = Date.now();
	if (await isLimited(db, user.id, LIMITS.bggSearch, now)) return error(429, 'That’s a lot of searches. Wait a minute.');
	await recordEvent(db, user.id, LIMITS.bggSearch, now);

	try {
		return Response.json({ results: await searchBgg(db, client, query, user.id, now) }, { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		if (e instanceof BggBusyError) return error(503, 'BoardGameGeek is busy. Try again in a moment, or add the game by hand.', { retryAfterMs: e.retryAfterMs });
		if (e instanceof BggAuthError) {
			console.error(e.message);
			return error(502, 'This site can’t reach BoardGameGeek right now. Add the game by hand, and let the host know.');
		}
		console.error('BGG search failed', e);
		return error(502, 'BoardGameGeek isn’t responding. Try again, or add the game by hand.');
	}
};
