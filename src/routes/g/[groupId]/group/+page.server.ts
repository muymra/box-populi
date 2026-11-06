import { fail, redirect } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import {
	deleteGroup,
	gameCounts,
	memberActions,
	regenerateCode,
	removeMember,
	renameGroup,
	setCoAdmin,
	setGroupTheme,
	transferOwnership,
	type Actor,
	type AdminResult
} from '#lib/server/group-admin.ts';
import type { DB } from '#lib/server/db.ts';
import { getDb } from '#lib/server/platform.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const [members, counts] = await Promise.all([loadMembers(db, groupId), gameCounts(db, groupId)]);
	const me = event.locals.user;
	// Controls only for members of a writable group; the server checks every action again anyway.
	const actor: Actor | null = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	return {
		now: Date.now(),
		canManage: actor != null && actor.role !== 'member',
		// Deleting stays open to the owner of a suspended group.
		canDelete: me != null && access.role === 'owner' && !access.group.isDemo,
		members: members.map((m) => ({
			id: m.id,
			name: m.name,
			role: m.role,
			colorIndex: m.colorIndex,
			lastSeenAt: m.lastSeenAt,
			games: counts.get(m.id) ?? 0,
			isMe: m.id === me?.id,
			actions: actor ? memberActions(actor, m) : []
		}))
	};
};

/** requireRole, then the action with the caller as actor. The group functions check the role table. */
async function act(
	event: RequestEvent,
	min: 'admin' | 'owner',
	run: (db: DB, groupId: string, actor: Actor, form: FormData) => Promise<AdminResult>,
	opts: { allowSuspended?: boolean } = {}
): Promise<AdminResult> {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRole(event, db, groupId, min, opts);
	return run(db, groupId, { id: event.locals.user!.id, role: access.role }, await event.request.formData());
}

const target = (form: FormData) => String(form.get('userId') ?? '');

export const actions: Actions = {
	rename: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => renameGroup(db, id, actor, form.get('name')));
		return result.ok ? { renamed: true } : fail(400, { renameError: result.error });
	},

	theme: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => setGroupTheme(db, id, actor, form.get('theme')));
		return result.ok ? { themeSaved: true } : fail(400, { themeError: result.error });
	},

	newCode: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => regenerateCode(db, id, actor));
		return result.ok ? { codeChanged: true } : fail(403, { codeError: result.error });
	},

	promote: async (event) => {
		const result = await act(event, 'owner', (db, id, actor, form) => setCoAdmin(db, id, actor, target(form), true));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	demote: async (event) => {
		const result = await act(event, 'owner', (db, id, actor, form) => setCoAdmin(db, id, actor, target(form), false));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	transfer: async (event) => {
		const result = await act(event, 'owner', (db, id, actor, form) => transferOwnership(db, id, actor, target(form)));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	remove: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => removeMember(db, id, actor, target(form)));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	delete: async (event) => {
		// The owner can delete a suspended group (TECH.md "Authorization").
		const result = await act(event, 'owner', (db, id, actor, form) => deleteGroup(db, id, actor, form.get('confirmName')), {
			allowSuspended: true
		});
		if (!result.ok) return fail(400, { deleteError: result.error });
		redirect(303, '/me');
	}
};
