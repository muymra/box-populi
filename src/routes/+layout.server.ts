import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	instanceName: locals.config.instanceName,
	demoMode: locals.config.instanceMode === 'demo',
	theme: locals.theme,
	user: locals.user ? { name: locals.user.name } : null
});
