// Saves this device's colour theme. The footer picker posts here: with JavaScript it has already
// switched the page and just wants 204; without, it gets sent back to the page it came from.
import { redirect } from '@sveltejs/kit';
import { setThemeCookie } from '#lib/server/cookies.ts';
import { safeReturnTo } from '#lib/server/return-to.ts';
import { isDeviceTheme } from '#lib/themes.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const form = await request.formData();
	const theme = form.get('theme');
	if (!isDeviceTheme(theme)) return new Response('Unknown theme', { status: 400 });
	setThemeCookie(cookies, url, theme);
	if (request.headers.get('accept')?.includes('application/json')) return new Response(null, { status: 204 });
	redirect(303, safeReturnTo(String(form.get('returnTo') ?? '')));
};
