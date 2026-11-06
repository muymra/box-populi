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
	instanceTheme: locals.instanceTheme,
	// The custom theme's stylesheet version (null when there's none) and the logo replacing the cube mark.
	customTheme: locals.appearance.colors ? locals.appearance.version : null,
	logoUrl: locals.appearance.logoUrl,
	user: locals.user ? { name: locals.user.name } : null
});
