import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/authz.ts';
import { SECRET_PAGE_HEADERS, takeNewLink } from '#lib/server/cookies.ts';
import { safeReturnTo } from '#lib/server/return-to.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const user = requireUser(event);
	const next = safeReturnTo(event.url.searchParams.get('next'));
	const token = takeNewLink(event.cookies, event.url);
	if (!token) redirect(303, next);
	event.setHeaders(SECRET_PAGE_HEADERS);
	return { name: user.name, link: `${event.url.origin}/key/${token}`, next };
};
