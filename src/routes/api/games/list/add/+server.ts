// Adds up to 25 rows chosen from a matched list to the person's shelf (TECH.md "Paste a list").
import { requireRole } from '#lib/server/authz.ts';
import { ADD_CHUNK, addListItems, type AddItem } from '#lib/server/game-list.ts';
import { getDb } from '#lib/server/platform.ts';
import type { RequestHandler } from './$types';

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function toItem(raw: unknown): AddItem | null {
	const r = raw as { gameId?: unknown; line?: unknown } | null;
	if (r && Number.isInteger(r.gameId) && (r.gameId as number) > 0) return { gameId: r.gameId as number };
	if (r && typeof r.line === 'string' && r.line.length <= 500) return { line: r.line };
	return null;
}

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return reply(401, { error: 'Sign in on this device to add games.' });
	const body = (await event.request.json().catch(() => null)) as { groupId?: unknown; items?: unknown } | null;
	const items = Array.isArray(body?.items) ? body.items.map(toItem) : [];
	if (typeof body?.groupId !== 'string' || items.length === 0 || items.length > ADD_CHUNK || items.includes(null)) {
		return reply(400, { error: `Send 1 to ${ADD_CHUNK} games.` });
	}
	const db = getDb();
	await requireRole(event, db, body.groupId, 'member', { ownShelf: true });
	return reply(200, await addListItems(db, body.groupId, event.locals.user.id, items as AddItem[], Date.now()));
};
