import { requireRead } from '#lib/server/authz.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { can } from '#lib/server/permissions.ts';
import { canChangePlay, loadPlays, podiumPoints } from '#lib/server/plays.ts';
import { deletePlayAction, pointsAction, savePlayAction } from '#lib/server/play-actions.ts';
import { getDb } from '#lib/server/platform.ts';
import { standings } from '#lib/plays.ts';
import type { Actions, PageServerLoad } from './$types';

/** Plays listed on the page; the export has them all. */
const LISTED = 100;

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const period = event.url.searchParams.get('period') === 'all' ? 'all' : 'year';
	const year = new Date().getUTCFullYear();
	const [plays, scheme, members] = await Promise.all([
		loadPlays(db, groupId, { since: period === 'year' ? `${year}-01-01` : undefined }),
		podiumPoints(db, groupId),
		loadMembers(db, groupId)
	]);
	const me = event.locals.user;
	const actor = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	return {
		period,
		year,
		scheme,
		standings: standings(plays, scheme, new Set(members.map((m) => m.id))),
		plays: plays.slice(0, LISTED).map((p) => ({ ...p, canChange: actor != null && canChangePlay(actor, p) })),
		totalPlays: plays.length,
		listed: LISTED,
		canSetPoints: actor != null && can(actor.role, 'set_points'),
		isMember: me != null && access.role != null
	};
};

export const actions: Actions = {
	logPlay: savePlayAction,
	editPlay: savePlayAction,
	deletePlay: deletePlayAction,
	points: pointsAction
};
