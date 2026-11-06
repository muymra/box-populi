// Step 1 of the import: preview a BGG collection. Stores nothing; the username is not kept.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, OFF_MESSAGE } from '#lib/server/bgg/http.ts';
import { cleanBggUsername, fetchCollection, previewItems } from '#lib/server/importer.ts';
import { getDb } from '#lib/server/platform.ts';
import { LIMITS, take } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const body = await event.request.json().catch(() => ({}));
	const username = cleanBggUsername((body as { username?: unknown }).username);
	if (!username) return jsonError(400, 'That doesn’t look like a BoardGameGeek username.');

	const db = getDb();
	const client = getBggClient(event.locals.config, db, event.url.origin);
	if (!client) return jsonError(503, OFF_MESSAGE);

	const now = Date.now();
	if (!(await take(db, now, [user.id, LIMITS.bggImport])).ok) return jsonError(429, 'Too many imports in a row. Wait ten minutes.');

	try {
		// One BGG request per call: while BGG prepares the collection, the page asks again every 5 seconds.
		const result = await fetchCollection(client, username, 1);
		if (result.status === 'pending') return Response.json({ status: 'pending' }, { status: 202 });
		if (result.status === 'not_found') return jsonError(404, `BoardGameGeek has no user called “${username}”.`);
		return Response.json({ status: 'ready', items: await previewItems(db, user.id, result.items) }, { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		return bggFailure(e);
	}
};
