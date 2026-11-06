import { one } from '#lib/server/db.ts';
import { listMyGroups } from '#lib/server/identity.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = getDb();
	const demo = await one<{ id: string }>(db, "SELECT id FROM groups WHERE id = 'demo' AND is_demo = 1");
	return {
		demoExists: demo != null,
		groups: locals.user ? (await listMyGroups(db, locals.user.id)).filter((g) => !g.isDemo) : [],
		canCreate: locals.config.groupCreation === 'anyone' || locals.isAdmin
	};
};
