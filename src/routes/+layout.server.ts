import { needsBggCredit } from '#lib/server/bgg-credit.ts';
import { activeGameSource } from '#lib/server/instance.ts';
import { getDb } from '#lib/server/platform.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => ({
	instanceName: locals.config.instanceName,
	bggCredit: await needsBggCredit(getDb(), locals.config.bggMode),
	wikidataCredit: activeGameSource(locals.config) === 'wikidata',
	demoMode: locals.config.instanceMode === 'demo',
	theme: locals.theme,
	deviceTheme: locals.deviceTheme,
	instanceTheme: locals.config.theme,
	user: locals.user ? { name: locals.user.name } : null
});
