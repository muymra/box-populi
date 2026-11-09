// Step 2 of the import: add the chosen games, and take the ticked ones the collection no longer
// lists off the shelf. The collection is fetched again so names never come from the browser; only
// ids that are really in it are added. Removing only ever touches the caller's own copies.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, OFF_MESSAGE, refuseInactive } from '#lib/server/bgg/http.ts';
import { cleanBggUsername, confirmImport, fetchCollection, pendingDetails, removeFromShelf } from '#lib/server/importer.ts';
import { getDb } from '#lib/server/platform.ts';
import { LIMITS, take } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const body = (await event.request.json().catch(() => ({}))) as { username?: unknown; bggIds?: unknown; removeGameIds?: unknown; groupId?: unknown };
	const username = cleanBggUsername(body.username);
	const positive = (raw: unknown) => (Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 3000) : []);
	const ids = positive(body.bggIds);
	const removeIds = positive(body.removeGameIds);
	if (!username || ids.length + removeIds.length === 0) return jsonError(400, 'Choose at least one game to add or remove.');

	const db = getDb();
	const refused = await refuseInactive(event, db, body.groupId);
	if (refused) return refused;
	const client = getBggClient(event.locals.config, db, event.url.origin, 'bulk');
	if (!client) return jsonError(503, OFF_MESSAGE);

	const now = Date.now();
	let added = 0;
	if (ids.length) {
		// Shares the lookup's limit: adding can make up to three BGG requests of its own.
		if (!(await take(db, now, [user.id, LIMITS.bggImport])).ok) return jsonError(429, 'Too many imports in a row. Wait ten minutes.');
		try {
			const result = await fetchCollection(client, username);
			if (result.status === 'pending') return Response.json({ status: 'pending' }, { status: 202 });
			if (result.status === 'not_found') return jsonError(404, `BoardGameGeek has no user called “${username}”.`);
			({ added } = await confirmImport(db, user.id, result.items, ids, now));
		} catch (e) {
			return bggFailure(e);
		}
	}
	// After the add, so a busy BGG sends the whole step back to be retried rather than half of it.
	const { removed } = await removeFromShelf(db, user.id, removeIds);
	return Response.json({ status: 'added', added, removed, pending: await pendingDetails(db, user.id) });
};
