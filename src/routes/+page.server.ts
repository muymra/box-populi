import { one } from '#lib/server/db.ts';
import { groupGlances } from '#lib/server/groups.ts';
import { listMyGroups } from '#lib/server/identity.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = getDb();
	const demo = await one<{ id: string }>(db, "SELECT id FROM groups WHERE id = 'demo' AND is_demo = 1");
	const groups = locals.user ? (await listMyGroups(db, locals.user.id)).filter((g) => !g.isDemo) : [];
	// Nights from yesterday (UTC) on: which is next depends on the viewer's clock, so the page picks it.
	const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
	const glances = await groupGlances(db, groups.map((g) => g.id), from);
	return {
		demoExists: demo != null,
		groups: groups.map((g) => ({ ...g, ...(glances.get(g.id) ?? { games: 0, colors: [], nights: [] }) })),
		canCreate: locals.config.groupCreation === 'anyone' || locals.isAdmin
	};
};
