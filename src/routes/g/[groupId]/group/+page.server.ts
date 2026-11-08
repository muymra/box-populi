import { fail, redirect } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { OWNER_AWAY_DAYS } from '#lib/server/permissions.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import {
	archiveGroup,
	claimOwnership,
	deleteGroup,
	ownerAway,
	restoreGroup,
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
import { one, type DB } from '#lib/server/db.ts';
import { setNightPlanners } from '#lib/server/nights.ts';
import { formatSignInCode, makeSignInCode, memberReach, mergeMember, recoveryTools } from '#lib/server/recovery.ts';
import { getDb } from '#lib/server/platform.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const [members, counts, settings, reach] = await Promise.all([
		loadMembers(db, groupId),
		gameCounts(db, groupId),
		one<{ nights_by: 'members' | 'admins' }>(db, 'SELECT nights_by FROM groups WHERE id = ?1', groupId),
		memberReach(db, groupId)
	]);
	const me = event.locals.user;
	const away = access.role === 'admin' ? await ownerAway(db, groupId, Date.now()) : false;
	// Controls only for members of a writable group; the server checks every action again anyway.
	const actor: Actor | null = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	return {
		now: Date.now(),
		nightsBy: settings?.nights_by ?? 'members',
		canManage: actor != null && actor.role !== 'member',
		// Deleting stays open to the owner of a suspended group.
		// Archiving (D50): the owner archives and restores, and a co-admin once the owner has been away
		// 60 days; the owner deletes, once archived. A co-admin who may not is told why.
		canArchive: actor != null && (actor.role === 'owner' || (actor.role === 'admin' && away)) && !access.group.isDemo,
		archiveWaits: actor != null && actor.role === 'admin' && !away && !access.group.isDemo,
		// Taking over as owner (D51): a co-admin, once the owner has been away 60 days.
		canClaim: actor != null && actor.role === 'admin' && away && !access.group.isDemo,
		restoreWaits: me != null && access.role === 'admin' && access.group.archived && !access.group.suspended && !away,
		/** For saying the 60-day rule out loud wherever it applies. */
		ownerAwayDays: OWNER_AWAY_DAYS,
		ownerIsAway: away,
		canRestore:
			me != null &&
			(access.role === 'owner' || (access.role === 'admin' && away)) &&
			access.group.archived &&
			!access.group.suspended &&
			!access.group.isDemo,
		canDelete: me != null && access.role === 'owner' && (access.group.archived || access.group.suspended) && !access.group.isDemo,
		members: members.map((m) => ({
			id: m.id,
			name: m.name,
			role: m.role,
			colorIndex: m.colorIndex,
			lastSeenAt: m.lastSeenAt,
			games: counts.get(m.id) ?? 0,
			isMe: m.id === me?.id,
			actions: actor ? memberActions(actor, m) : [],
			// For the owner and co-admins only: who still needs a PIN, and who can be helped back in (D48).
			noPin: actor != null && actor.role !== 'member' && reach.get(m.id)?.hasPin === false,
			tools: actor ? recoveryTools(actor, m, reach.get(m.id)?.groups ?? 0) : [],
			// Why the helping-back-in tools aren't offered, said in the panel rather than left out silently.
			helpNote:
				actor && actor.role !== 'member' && m.id !== me?.id
					? (reach.get(m.id)?.groups ?? 0) > 1
						? ('other_group' as const)
						: recoveryTools(actor, m, 1).length === 0
							? ('role' as const)
							: null
					: null,
			joinedAt: reach.get(m.id)?.joinedAt ?? 0
		}))
	};
};

/** requireRole, then the action with the caller as actor. The group functions check the role table. */
async function act(
	event: RequestEvent,
	min: 'admin' | 'owner',
	run: (db: DB, groupId: string, actor: Actor, form: FormData) => Promise<AdminResult>,
	opts: { allowSuspended?: boolean; allowArchived?: boolean } = {}
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

	nightsBy: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => setNightPlanners(db, id, actor, form.get('nightsBy')));
		return result.ok ? { nightsBySaved: true } : fail(400, { nightsByError: result.error });
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
		const result = await act(event, 'owner', (db, id, actor, form) => transferOwnership(db, id, actor, target(form), form.get('confirmName')));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	/** A one-time sign-in code for a member who lost their PIN and every device (D48), shown once. */
	signInCode: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		const access = await requireRole(event, db, groupId, 'admin');
		const userId = target(await event.request.formData());
		const made = await makeSignInCode(db, groupId, { id: event.locals.user!.id, role: access.role }, userId, Date.now());
		if (!made.ok) return fail(400, { memberError: made.error });
		event.setHeaders({ 'cache-control': 'no-store' });
		return { signInCode: { userId, name: made.name, code: formatSignInCode(made.code), expiresAt: made.expiresAt } };
	},

	merge: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) =>
			mergeMember(db, id, actor, { oldId: target(form), newId: String(form.get('intoId') ?? '') })
		);
		return result.ok ? { merged: true } : fail(400, { memberError: result.error });
	},

	remove: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => removeMember(db, id, actor, target(form)));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	claim: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => claimOwnership(db, id, actor, Date.now()));
		return result.ok ? { claimed: true } : fail(400, { claimError: result.error });
	},

	archive: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => archiveGroup(db, id, actor, Date.now()));
		return result.ok ? { archived: true } : fail(400, { archiveError: result.error });
	},

	restore: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => restoreGroup(db, id, actor, Date.now()), { allowArchived: true });
		return result.ok ? { restored: true } : fail(400, { archiveError: result.error });
	},

	delete: async (event) => {
		// The owner can delete a suspended group (TECH.md "Authorization").
		const name = (await one<{ name: string }>(getDb(), 'SELECT name FROM groups WHERE id = ?1', event.params.groupId))?.name ?? '';
		const result = await act(event, 'owner', (db, id, actor, form) => deleteGroup(db, id, actor, form.get('confirmName')), {
			allowSuspended: true,
			allowArchived: true
		});
		if (!result.ok) return fail(400, { deleteError: result.error });
		// Your account says it's done, by name, since the group is gone from every list.
		redirect(303, `/me?deleted=${encodeURIComponent(name)}`);
	}
};
