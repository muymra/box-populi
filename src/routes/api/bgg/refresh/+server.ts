// BGG details older than 30 days, fetched again (D80). The shelf calls this in the background when it
// opens; nobody waits on it and nothing shows, so every answer is quiet, failures included.
import { getBggClient } from '#lib/server/bgg/client.ts';
import { bggFailure, jsonError, refuseInactive } from '#lib/server/bgg/http.ts';
import { refreshGames, staleGames } from '#lib/server/refresh.ts';
import { getDb } from '#lib/server/platform.ts';
import { INSTANCE, LIMITS, take } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

const quiet = (body: { refreshed: number; reason?: string }) => Response.json(body, { headers: { 'cache-control': 'no-store' } });

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Sign in on this device first.');
	const body = (await event.request.json().catch(() => ({}))) as { groupId?: unknown };
	if (typeof body.groupId !== 'string' || body.groupId === '') return jsonError(400, 'Which group?');
	const db = getDb();
	// A member who can fill their shelf from this group (D79), in a group that isn't the demo, archived or suspended.
	const refused = await refuseInactive(event, db, body.groupId);
	if (refused) return refused;
	const client = getBggClient(event.locals.config, db, event.url.origin, 'bulk');
	if (!client) return quiet({ refreshed: 0, reason: 'off' });

	const now = Date.now();
	const games = await staleGames(db, body.groupId, now);
	if (games.length === 0) return quiet({ refreshed: 0 });
	// One batch per 10 minutes across the instance; the next shelf to open after that carries on.
	if (!(await take(db, now, [INSTANCE, LIMITS.bggRefresh])).ok) return quiet({ refreshed: 0, reason: 'later' });
	try {
		return quiet({ refreshed: await refreshGames(db, client, games, now) });
	} catch (e) {
		return bggFailure(e);
	}
};
