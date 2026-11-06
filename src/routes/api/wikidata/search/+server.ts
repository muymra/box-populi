// Wikidata title search for the add page while BGG is off (TECH.md "Public-sources mode").
// Same contract as /api/bgg/search: needs a session, no CORS headers, rate-limited per person.
import { userAgent } from '#lib/server/bgg/client.ts';
import { getDb } from '#lib/server/platform.ts';
import { isLimited, LIMITS, recordEvent } from '#lib/server/ratelimit.ts';
import { getWikidataClient, searchWikidata, WikidataBusyError } from '#lib/server/wikidata.ts';
import type { RequestHandler } from './$types';

const error = (status: number, message: string) =>
	Response.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } });

export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return error(401, 'Sign in on this device to search.');

	const query = (event.url.searchParams.get('q') ?? '').trim().slice(0, 100);
	if (query.length < 3) return Response.json({ results: [] });

	const client = getWikidataClient(event.locals.config, userAgent(event.url.origin));
	if (!client) return error(503, 'Wikidata search isn’t used on this site. Add the game by hand below.');

	const db = getDb();
	const now = Date.now();
	if (await isLimited(db, user.id, LIMITS.wikidataSearch, now)) return error(429, 'That’s a lot of searches. Wait a minute.');
	await recordEvent(db, user.id, LIMITS.wikidataSearch, now);

	try {
		return Response.json({ results: await searchWikidata(db, client, query, user.id, now) }, { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		if (e instanceof WikidataBusyError) return error(503, 'Wikidata isn’t answering right now. Try again in a moment, or add the game by hand.');
		throw e;
	}
};
