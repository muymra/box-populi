import { fail, redirect } from '@sveltejs/kit';
import { readGroup, requireRole } from '#lib/server/authz.ts';
import { membersRead } from '#lib/server/catalog.ts';
import {
	archiveGroup,
	claimOwnership,
	deleteGroup,
	ownerAwayRead,
	restoreGroup,
	setFillerRule,
	setStaleDays,
	gameCountsRead,
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
import { known, one, readAll, type DB } from '#lib/server/db.ts';
import { setNightPlanners } from '#lib/server/nights.ts';
import { formatSignInCode, makeSignInCode, memberReachRead, mergeMember, recoveryTools } from '#lib/server/recovery.ts';
import { assembleGuestHistory, guestHistoryReads, linkGuestPlays } from '#lib/server/guest-plays.ts';
import { can } from '#lib/server/permissions.ts';
import { getDb } from '#lib/server/platform.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const { access, extras } = await readGroup(event, db, groupId);
	const me = event.locals.user;
	// Controls only for members of a writable group; the server checks every action again anyway.
	const actor: Actor | null = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	const manages = actor != null && actor.role !== 'member';
	// One round trip after the access check (D59, D65).
	const r = await readAll(db, {
		members: membersRead(db, groupId),
		counts: gameCountsRead(db, groupId),
		reach: memberReachRead(db, groupId),
		away: access.role === 'admin' ? ownerAwayRead(db, groupId, Date.now(), event.locals.config.ownerAwayDays) : known(false),
		// Guest plays to a member (D37): the guest names and what they were in, for the owner and co-admins.
		...(manages ? guestHistoryReads(db, groupId) : { guestPlays: known([]), guestNights: known([]) })
	});
	const { members, counts, reach, away } = r;
	const guests = manages ? assembleGuestHistory(r.guestPlays, r.guestNights) : [];
	return {
		guests,
		now: Date.now(),
		nightsBy: extras.nightsBy === 'admins' ? ('admins' as const) : ('members' as const),
		canManage: actor != null && actor.role !== 'member',
		// Deleting stays open to the owner of a suspended group.
		// Archiving (D50): the owner archives and restores, and a co-admin once the owner has been away
		// OWNER_AWAY_DAYS (60 unless the instance sets it); the owner deletes, once archived. A co-admin who may not is told why.
		canArchive: actor != null && (actor.role === 'owner' || (actor.role === 'admin' && away)) && !access.group.isDemo,
		archiveWaits: actor != null && actor.role === 'admin' && !away && !access.group.isDemo,
		// Taking over as owner (D51): a co-admin, once the owner has been away OWNER_AWAY_DAYS.
		canClaim: actor != null && actor.role === 'admin' && away && !access.group.isDemo,
		restoreWaits: me != null && access.role === 'admin' && access.group.archived && !access.group.suspended && !away,
		/** For saying the days-away rule out loud wherever it applies. */
		ownerAwayDays: event.locals.config.ownerAwayDays,
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
			canLinkGuests: actor != null && guests.length > 0 && can(actor.role, 'link_guest_plays', { targetRole: m.role, targetIsSelf: m.id === actor.id }),
			// Why the helping-back-in tools aren't offered, said in the panel rather than left out silently.
			helpNote:
				actor && actor.role !== 'member' && m.id !== me?.id
					? (reach.get(m.id)?.groups ?? 0) > 1
						? ('other_group' as const)
						: recoveryTools(actor, m, 1).length === 0
							? ('role' as const)
							: null
					: null,
			joinedAt: reach.get(m.id)?.joinedAt ?? 0,
			// Only an entry in this group alone can take another's things in a merge (D65).
			onlyHere: (reach.get(m.id)?.groups ?? 0) === 1
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

	stale: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => setStaleDays(db, id, actor, form.get('staleDays')));
		return result.ok ? { staleSaved: true } : fail(400, { staleError: result.error });
	},

	filler: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => setFillerRule(db, id, actor, form.get('fillerMinutes'), form.get('fillerWeight')));
		return result.ok ? { fillerSaved: true } : fail(400, { fillerError: result.error });
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

	/** Guest plays to a member (D37): the chosen plays and nights of the names they used as a guest. */
	guestPlays: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		const access = await requireRole(event, db, groupId, 'admin');
		const form = await event.request.formData();
		const result = await linkGuestPlays(db, groupId, { id: event.locals.user!.id, role: access.role }, {
			userId: target(form),
			names: form.getAll('name').map(String),
			playIds: form.getAll('play').map(String),
			nightIds: form.getAll('night').map(String)
		});
		if (!result.ok) return fail(400, { memberError: result.error });
		const name = (await one<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?1', target(form)))?.name ?? 'them';
		return { guestLinked: { name, plays: result.plays, nights: result.nights, skipped: result.skipped } };
	},

	remove: async (event) => {
		const result = await act(event, 'admin', (db, id, actor, form) => removeMember(db, id, actor, target(form)));
		return result.ok ? { memberChanged: true } : fail(400, { memberError: result.error });
	},

	claim: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => claimOwnership(db, id, actor, Date.now(), event.locals.config.ownerAwayDays));
		return result.ok ? { claimed: true } : fail(400, { claimError: result.error });
	},

	archive: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => archiveGroup(db, id, actor, Date.now(), event.locals.config.ownerAwayDays));
		return result.ok ? { archived: true } : fail(400, { archiveError: result.error });
	},

	restore: async (event) => {
		const result = await act(event, 'admin', (db, id, actor) => restoreGroup(db, id, actor, Date.now(), event.locals.config.ownerAwayDays), { allowArchived: true });
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
