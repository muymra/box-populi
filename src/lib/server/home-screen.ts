// The installable app (D76, TECH.md "Home screen"): the web manifest that lets a phone or computer put
// Box Populi on its home screen, and where the app opens. There's no service worker, so the app needs
// a connection as the site does (Carlo, 2026-11-11).

/** The home page, marked as opened from the home screen, so it can go on to the last group. */
export const START_PARAM = 'start';
export const START_PATH = `/?${START_PARAM}`;

/** In static/, drawn by scripts/gen-icons.ts from the cube mark. */
export const HOME_SCREEN_ICONS = [
	{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
	{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
	{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];

/** The manifest: the instance's name under the icon, and its theme's page colour behind the app while it opens. */
export function webManifest(instanceName: string, pageColor: string) {
	return {
		id: '/',
		name: instanceName,
		short_name: instanceName,
		start_url: START_PATH,
		scope: '/',
		display: 'standalone',
		background_color: pageColor,
		theme_color: pageColor,
		icons: HOME_SCREEN_ICONS
	};
}

/**
 * Where the app goes when it opens: the group this device had open last (the `bp_group` cookie), if
 * the viewer can still open it, else nowhere (null), so the home page shows their groups.
 */
export function startPath(lastGroup: string | undefined, memberOf: string[], demoExists: boolean): string | null {
	if (!lastGroup) return null;
	if (memberOf.includes(lastGroup) || (lastGroup === 'demo' && demoExists)) return `/g/${encodeURIComponent(lastGroup)}`;
	return null;
}
