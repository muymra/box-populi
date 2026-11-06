import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/platform.ts';
import { cleanDisplayName, newPersonStatements } from '#lib/server/identity.ts';
import { cleanGroupName, createGroup, ownedGroupCount } from '#lib/server/groups.ts';
import { giveBack, ipSubject, LIMITS, take } from '#lib/server/ratelimit.ts';
import { setNewLinkCookie, setSessionCookie } from '#lib/server/cookies.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	needsName: !locals.user,
	creationClosed: locals.config.groupCreation === 'admins' && !locals.isAdmin
});

export const actions: Actions = {
	default: async (event) => {
		const { locals, url, cookies } = event;
		const db = getDb();
		const now = Date.now();
		const form = await event.request.formData();
		const values = { groupName: String(form.get('groupName') ?? ''), displayName: String(form.get('displayName') ?? '') };

		if (locals.config.groupCreation === 'admins' && !locals.isAdmin) {
			return fail(403, { ...values, error: 'On this site, only the host creates groups. Ask them for a join code.' });
		}
		const groupName = cleanGroupName(values.groupName);
		if (!groupName) return fail(400, { ...values, error: 'Give the group a name, up to 60 characters.' });

		const tried = await take(db, now, [ipSubject(event.getClientAddress()), LIMITS.groupCreate]);
		if (!tried.ok) return fail(429, { ...values, error: 'Too many new groups from this network today. Try again tomorrow.' });

		let userId: string;
		let newPerson: Awaited<ReturnType<typeof newPersonStatements>> | null = null;
		if (locals.user) {
			if ((await ownedGroupCount(db, locals.user.id)) >= locals.config.maxGroupsPerUser) {
				await giveBack(db, tried.taken);
				return fail(400, { ...values, error: `You already own ${locals.config.maxGroupsPerUser} groups, the most this site allows.` });
			}
			userId = locals.user.id;
		} else {
			const displayName = cleanDisplayName(values.displayName);
			if (!displayName) {
				await giveBack(db, tried.taken);
				return fail(400, { ...values, error: 'Add your name as the group will see it, up to 40 characters.' });
			}
			newPerson = await newPersonStatements(db, displayName, now);
			userId = newPerson.person.id;
		}

		const { groupId } = await createGroup(db, { userId, name: groupName, now, before: newPerson?.statements });

		if (newPerson) {
			setSessionCookie(cookies, url, newPerson.sessionToken);
			setNewLinkCookie(cookies, url, newPerson.linkToken);
			redirect(303, `/welcome?next=${encodeURIComponent(`/g/${groupId}`)}`);
		}
		redirect(303, `/g/${groupId}`);
	}
};
