// After creating a group (D46): the invite to share. Members only; anyone else goes to the group.
import { redirect } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const access = await requireRead(event, getDb(), event.params.groupId);
	if (!access.role || access.group.isDemo) redirect(303, `/g/${event.params.groupId}`);
	return {};
};
