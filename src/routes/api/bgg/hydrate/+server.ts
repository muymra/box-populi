// Step 3 of the import: fill in details for up to 20 of the caller's games per call. The browser
// calls again until nothing remains; the instance-wide pacer sets the real rate.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, OFF_MESSAGE } from '#lib/server/bgg/http.ts';
import { hydrateStep } from '#lib/server/importer.ts';
import { getDb } from '#lib/server/platform.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const db = getDb();
	const client = getBggClient(event.locals.config, db, event.url.origin);
	if (!client) return jsonError(503, OFF_MESSAGE);
	try {
		return Response.json(await hydrateStep(db, client, user.id, Date.now()), { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		return bggFailure(e);
	}
};
