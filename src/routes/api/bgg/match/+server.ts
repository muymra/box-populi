// Find on BoardGameGeek, step 1 (D57): BGG's likeliest matches for one of the caller's typed-in
// games. One game per call, so the instance-wide pacer sets the rate and the page shows progress.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, OFF_MESSAGE, refuseInactive } from '#lib/server/bgg/http.ts';
import { findMatches } from '#lib/server/bgg-match.ts';
import { getDb } from '#lib/server/platform.ts';
import { LIMITS, take } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

/** How long the page waits before carrying on once the limit is used up. */
const LIMITED_RETRY_MS = 60_000;

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const body = (await event.request.json().catch(() => ({}))) as { groupId?: unknown; gameId?: unknown };
	const db = getDb();
	const refused = await refuseInactive(event, db, body.groupId);
	if (refused) return refused;
	const client = getBggClient(event.locals.config, db, event.url.origin, 'bulk');
	if (!client) return jsonError(503, OFF_MESSAGE);

	const gameId = Number(body.gameId);
	if (!Number.isInteger(gameId) || gameId <= 0) return jsonError(400, 'That game couldn’t be found.');

	const now = Date.now();
	if (!(await take(db, now, [user.id, LIMITS.bggMatch])).ok) {
		return jsonError(429, 'That’s a lot of games at once.', { retryAfterMs: LIMITED_RETRY_MS });
	}

	try {
		const candidates = await findMatches(db, client, user.id, gameId, now);
		if (!candidates) return jsonError(404, 'That game isn’t on your shelf, or it already has BoardGameGeek details.');
		return Response.json({ gameId, candidates }, { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		return bggFailure(e);
	}
};
