import { error, fail, redirect } from '@sveltejs/kit';
import { requireRole } from '#lib/server/authz.ts';
import { canPlanNights, createNight, parseNightForm } from '#lib/server/nights.ts';
import { getDb } from '#lib/server/platform.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const access = await requireRole(event, db, event.params.groupId, 'member');
	if (!(await canPlanNights(db, event.params.groupId, access.role))) error(403, 'In this group, only the owner and co-admins plan game nights.');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		const access = await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const parsed = parseNightForm(form);
		const entered = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
		if (!parsed.ok) return fail(400, { error: parsed.error, entered });
		const created = await createNight(db, groupId, { id: event.locals.user!.id, role: access.role }, parsed.value);
		if (!created.ok) return fail(403, { error: created.error, entered });
		redirect(303, `/g/${groupId}/nights/${created.value}`);
	}
};
