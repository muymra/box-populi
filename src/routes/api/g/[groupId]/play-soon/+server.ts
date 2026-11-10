// Play soon marks of the people said to be here (DECISIONS D64), for Play tonight: it leans the pulls
// towards them and says whose they are on the table. Members of the group only, and only the people
// asked for; a whole list is never sent.
import { requireRead } from '#lib/server/authz.ts';
import { playSoonOfPeople } from '#lib/server/interest.ts';
import { getDb } from '#lib/server/platform.ts';
import type { RequestHandler } from './$types';

/** More people than any table holds; a longer list is cut. */
const MAX_HERE = 60;

export const GET: RequestHandler = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const headers = { 'cache-control': 'private, no-store' };
	if (!access.role || access.readonly || !event.locals.user) return Response.json({ marks: [] }, { headers });
	const here = (event.url.searchParams.get('here') ?? '').split(',').filter(Boolean).slice(0, MAX_HERE);
	return Response.json({ marks: await playSoonOfPeople(db, groupId, here, Date.now(), event.locals.config.playSoon) }, { headers });
};
