import { fail, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/authz.ts';
import { getDb } from '#lib/server/platform.ts';
import {
	cleanDisplayName,
	deletePerson,
	endSession,
	leaveGroup,
	listMyGroups,
	regeneratePersonalLink,
	renamePerson,
	SESSION_COOKIE,
	signOutEverywhere
} from '#lib/server/identity.ts';
import { clearSessionCookie, SECRET_PAGE_HEADERS, setNewLinkCookie, takeNewLink } from '#lib/server/cookies.ts';
import { myLoans, returnCopy } from '#lib/server/lending.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	event.setHeaders(SECRET_PAGE_HEADERS);
	const token = takeNewLink(event.cookies, event.url);
	return {
		name: user.name,
		groups: await listMyGroups(getDb(), user.id),
		loans: await myLoans(getDb(), user.id),
		newLink: token ? `${event.url.origin}/key/${token}` : null
	};
};

export const actions: Actions = {
	returned: async (event) => {
		const user = requireUser(event);
		const gameId = Number((await event.request.formData()).get('gameId'));
		if (Number.isInteger(gameId) && gameId > 0) await returnCopy(getDb(), user.id, gameId);
		return { returned: true };
	},

	rename: async (event) => {
		const user = requireUser(event);
		const raw = String((await event.request.formData()).get('displayName') ?? '');
		const name = cleanDisplayName(raw);
		if (!name) return fail(400, { renameError: 'Names are 1 to 40 characters.' });
		await renamePerson(getDb(), user.id, name);
		return { renamed: true };
	},

	newLink: async (event) => {
		const user = requireUser(event);
		setNewLinkCookie(event.cookies, event.url, await regeneratePersonalLink(getDb(), user.id, Date.now()));
		redirect(303, '/me#personal-link');
	},

	signOut: async (event) => {
		requireUser(event);
		const token = event.cookies.get(SESSION_COOKIE);
		if (token) await endSession(getDb(), token);
		clearSessionCookie(event.cookies, event.url);
		redirect(303, '/');
	},

	signOutEverywhere: async (event) => {
		const user = requireUser(event);
		const link = await signOutEverywhere(getDb(), user.id, Date.now());
		// This device signs straight back in through the new link, which the person must save.
		clearSessionCookie(event.cookies, event.url);
		setNewLinkCookie(event.cookies, event.url, link);
		redirect(303, '/signed-out');
	},

	leave: async (event) => {
		const user = requireUser(event);
		const groupId = String((await event.request.formData()).get('groupId') ?? '');
		const result = await leaveGroup(getDb(), user.id, groupId);
		if (!result.ok) {
			return fail(400, {
				leaveError: result.reason === 'owner_with_members' ? 'You own that group. Hand ownership to someone else first, or delete the group.' : 'You’re not in that group.'
			});
		}
		return { left: true };
	},

	deleteAccount: async (event) => {
		const user = requireUser(event);
		const confirm = String((await event.request.formData()).get('confirm') ?? '');
		if (confirm.trim().toLowerCase() !== 'delete') return fail(400, { deleteError: 'Type "delete" to confirm.' });
		const result = await deletePerson(getDb(), user.id);
		if (!result.ok) {
			return fail(400, { deleteError: `You own groups with other members: ${result.blockingGroups.join(', ')}. Hand them over or delete them first.` });
		}
		clearSessionCookie(event.cookies, event.url);
		redirect(303, '/');
	}
};
