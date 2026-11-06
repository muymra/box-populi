import { one } from '#lib/server/db.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const demo = await one<{ id: string }>(getDb(), "SELECT id FROM groups WHERE id = 'demo' AND is_demo = 1");
	return { demoExists: demo != null };
};
