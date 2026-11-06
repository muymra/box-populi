// Matches up to 10 pasted lines for the add page's list panel (TECH.md "Paste a list").
import { requireRole } from '#lib/server/authz.ts';
import { userAgent } from '#lib/server/bgg/client.ts';
import { MATCH_CHUNK, matchLines } from '#lib/server/game-list.ts';
import { getDb } from '#lib/server/platform.ts';
import { LIMITS, take } from '#lib/server/ratelimit.ts';
import { getWikidataClient, WikidataBusyError } from '#lib/server/wikidata.ts';
import type { RequestHandler } from './$types';

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return reply(401, { error: 'Sign in on this device to add games.' });
	const body = (await event.request.json().catch(() => null)) as { groupId?: unknown; lines?: unknown } | null;
	const lines = Array.isArray(body?.lines) ? body.lines.filter((l): l is string => typeof l === 'string').map((l) => l.slice(0, 500)) : [];
	if (typeof body?.groupId !== 'string' || lines.length === 0 || lines.length > MATCH_CHUNK) return reply(400, { error: `Send 1 to ${MATCH_CHUNK} lines.` });

	const db = getDb();
	await requireRole(event, db, body.groupId, 'member');
	const userId = event.locals.user.id;
	const now = Date.now();
	if (!(await take(db, now, [userId, LIMITS.listMatch])).ok) return reply(429, { error: 'That’s a lot of lists. Wait ten minutes.' });

	try {
		const rows = await matchLines(db, body.groupId, userId, lines, getWikidataClient(event.locals.config, userAgent(event.url.origin)), now);
		return reply(200, { rows });
	} catch (e) {
		if (e instanceof WikidataBusyError) return reply(503, { error: `Wikidata isn’t answering right now (${e.detail.slice(0, 60)}).`, retryAfterMs: 5000 });
		throw e;
	}
};
