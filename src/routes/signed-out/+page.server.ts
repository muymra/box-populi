import { redirect } from '@sveltejs/kit';
import { SECRET_PAGE_HEADERS, takeNewLink } from '#lib/server/cookies.ts';
import type { PageServerLoad } from './$types';

/** After "sign out everywhere": shows the replacement personal link once. */
export const load: PageServerLoad = (event) => {
	const token = takeNewLink(event.cookies, event.url);
	if (!token) redirect(303, '/');
	event.setHeaders(SECRET_PAGE_HEADERS);
	return { link: `${event.url.origin}/key/${token}` };
};
