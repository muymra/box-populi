// Step 3 of the import: fill in details for up to 20 of the caller's games per call. The browser
// calls again until nothing remains; the instance-wide pacer sets the real rate.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, OFF_MESSAGE, refuseInactive } from '#lib/server/bgg/http.ts';
import { hydrateStep } from '#lib/server/importer.ts';
import { getDb } from '#lib/server/platform.ts';
import { LIMITS, take } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

/** How long the page waits before carrying on once the hydrate limit is used up. */
const LIMITED_RETRY_MS = 60_000;

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const body = (await event.request.json().catch(() => ({}))) as { groupId?: unknown };
	const db = getDb();
	const refused = await refuseInactive(event, db, body.groupId);
	if (refused) return refused;
	const client = getBggClient(event.locals.config, db, event.url.origin);
	if (!client) return jsonError(503, OFF_MESSAGE);

	const now = Date.now();
	if (!(await take(db, now, [user.id, LIMITS.bggHydrate])).ok) {
		return jsonError(429, 'That’s a lot of games at once.', { retryAfterMs: LIMITED_RETRY_MS });
	}

	try {
		return Response.json(await hydrateStep(db, client, user.id, now), { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		return bggFailure(e);
	}
};
