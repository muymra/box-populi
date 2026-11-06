import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	contact: locals.config.instanceContact,
	contactLabel: locals.config.instanceContact.replace(/^mailto:/, '')
});
