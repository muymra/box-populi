import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	instanceName: locals.config.instanceName,
	user: locals.user ? { name: locals.user.name, avatarUrl: locals.user.avatarUrl, isInstanceAdmin: locals.user.isInstanceAdmin } : null
});
