import { redirect } from '@sveltejs/kit';
import { safeReturnTo } from '#lib/server/return-to.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
	if (locals.user) redirect(303, returnTo);
	return { returnTo };
};
