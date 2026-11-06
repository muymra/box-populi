import { needsBggCredit } from '#lib/server/bgg-credit.ts';
import { getDb } from '#lib/server/platform.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => ({
	instanceName: locals.config.instanceName,
	bggCredit: await needsBggCredit(getDb(), locals.config.bggMode),
	demoMode: locals.config.instanceMode === 'demo',
	theme: locals.theme,
	user: locals.user ? { name: locals.user.name } : null
});
