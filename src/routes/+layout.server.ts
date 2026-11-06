import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	instanceName: locals.config.instanceName,
	demoMode: locals.config.instanceMode === 'demo',
	user: locals.user ? { name: locals.user.name } : null
});
