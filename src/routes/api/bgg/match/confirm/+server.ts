// Find on BoardGameGeek, step 2 (D57): merge each ticked typed-in game into the BGG game chosen for
// it. Nothing is asked of BGG here; the BGG games were stored when step 1 found them.
import { jsonError, refuseInactive } from '#lib/server/bgg/http.ts';
import { MERGES_PER_CALL, mergeMatches, type Merge } from '#lib/server/bgg-match.ts';
import { getDb } from '#lib/server/platform.ts';
import type { RequestHandler } from './$types';

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return jsonError(401, 'Sign in on this device first.');
	const body = (await event.request.json().catch(() => ({}))) as { groupId?: unknown; pairs?: unknown };
	const db = getDb();
	const refused = await refuseInactive(event, db, body.groupId);
	if (refused) return refused;

	const raw = Array.isArray(body.pairs) ? body.pairs : [];
	if (raw.length === 0 || raw.length > MERGES_PER_CALL) return jsonError(400, `Send between 1 and ${MERGES_PER_CALL} games at a time.`);
	const pairs: Merge[] = [];
	for (const p of raw as Array<{ gameId?: unknown; targetId?: unknown }>) {
		if (!isId(p?.gameId) || !isId(p?.targetId)) return jsonError(400, 'That list couldn’t be read. Reload the page and try again.');
		pairs.push({ gameId: p.gameId, targetId: p.targetId });
	}

	return Response.json(await mergeMatches(db, user.id, pairs), { headers: { 'cache-control': 'no-store' } });
};
