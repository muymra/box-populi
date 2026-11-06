// Step 2 of the import: add the chosen games. The collection is fetched again so names never
// come from the browser; only ids that are really in it are added.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, OFF_MESSAGE } from '#lib/server/bgg/http.ts';
import { cleanBggUsername, confirmImport, fetchCollection, pendingDetails } from '#lib/server/importer.ts';
import { getDb } from '#lib/server/platform.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const body = (await event.request.json().catch(() => ({}))) as { username?: unknown; bggIds?: unknown };
	const username = cleanBggUsername(body.username);
	const ids = Array.isArray(body.bggIds) ? body.bggIds.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 3000) : [];
	if (!username || ids.length === 0) return jsonError(400, 'Choose at least one game to add.');

	const db = getDb();
	const client = getBggClient(event.locals.config, db, event.url.origin);
	if (!client) return jsonError(503, OFF_MESSAGE);

	try {
		const result = await fetchCollection(client, username);
		if (result.status === 'pending') return Response.json({ status: 'pending' }, { status: 202 });
		if (result.status === 'not_found') return jsonError(404, `BoardGameGeek has no user called “${username}”.`);
		const { added } = await confirmImport(db, user.id, result.items, ids, Date.now());
		return Response.json({ status: 'added', added, pending: await pendingDetails(db, user.id) });
	} catch (e) {
		return bggFailure(e);
	}
};
