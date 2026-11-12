import { redirect } from '@sveltejs/kit';
import { LAST_GROUP_COOKIE } from '#lib/server/cookies.ts';
import { known, readAll, rowsOf } from '#lib/server/db.ts';
import { assembleGlances, groupGlancesReads } from '#lib/server/groups.ts';
import { START_PARAM, startPath } from '#lib/server/home-screen.ts';
import { myGroupsRead } from '#lib/server/identity.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const db = getDb();
	// Nights from yesterday (UTC) on: which is next depends on the viewer's clock, so the page picks it.
	const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
	const user = locals.user;
	// One round trip (D59, D65).
	const r = await readAll(db, {
		demo: rowsOf<{ id: string }>(db, "SELECT id FROM groups WHERE id = 'demo' AND is_demo = 1"),
		groups: user ? myGroupsRead(db, user.id) : known([]),
		...(user ? groupGlancesReads(db, user.id, from) : { glanceGames: known([]), glanceMembers: known([]), glanceNights: known([]) })
	});
	const glances = assembleGlances(r);
	const groups = r.groups.filter((g) => !g.isDemo);
	// Opened from the home screen: straight on to the group this device had open last (D76).
	if (url.searchParams.has(START_PARAM)) {
		const to = startPath(cookies.get(LAST_GROUP_COOKIE), groups.map((g) => g.id), r.demo.length > 0);
		if (to) redirect(303, to);
	}
	return {
		demoExists: r.demo.length > 0,
		groups: groups.map((g) => ({ ...g, ...(glances.get(g.id) ?? { games: 0, colors: [], nights: [] }) })),
		canCreate: locals.config.groupCreation === 'anyone' || locals.isAdmin
	};
};
