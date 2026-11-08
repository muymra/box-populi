// After creating a group (D46): the invite to share and, for someone new, their sign-in link, shown
// once. Members only; anyone else goes to the group.
import { redirect } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { SECRET_PAGE_HEADERS, takeNewLink } from '#lib/server/cookies.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const access = await requireRead(event, getDb(), event.params.groupId);
	if (!access.role || access.group.isDemo) redirect(303, `/g/${event.params.groupId}`);
	const token = takeNewLink(event.cookies, event.url);
	event.setHeaders(SECRET_PAGE_HEADERS);
	return { signInLink: token ? `${event.url.origin}/key/${token}` : null };
};
