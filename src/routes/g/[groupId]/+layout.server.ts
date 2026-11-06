import { requireRead } from '#lib/server/authz.ts';
import { getDb } from '#lib/server/platform.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const access = await requireRead(event, getDb(), event.params.groupId);
	return { ...access, contact: event.locals.config.instanceContact };
};
