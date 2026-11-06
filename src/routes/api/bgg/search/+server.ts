// BGG title search for the add page (TECH.md "Search"). For this app's own pages only: needs a
// session, sends no CORS headers, and is rate-limited per person.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure } from '#lib/server/bgg/http.ts';
import { searchBgg } from '#lib/server/games.ts';
import { getDb } from '#lib/server/platform.ts';
import { LIMITS, take } from '#lib/server/ratelimit.ts';
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
	if (!(await take(db, now, [user.id, LIMITS.bggSearch])).ok) return error(429, 'That’s a lot of searches. Wait a minute.');

	try {
		return Response.json({ results: await searchBgg(db, client, query, user.id, now) }, { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		return bggFailure(e);
	}
};
