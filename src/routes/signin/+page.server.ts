import { safeReturnTo } from '#lib/server/return-to.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => ({
	signInConfigured: locals.config.google != null,
	returnTo: safeReturnTo(url.searchParams.get('returnTo'))
});
