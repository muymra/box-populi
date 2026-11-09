// The PRD's role table as one pure function. Actions call this after `requireRole`, with the
// target's role read fresh from the database (TECH.md "Authorization").
import type { Role } from '#lib/catalog/types.ts';

export type GroupAction =
	| 'rename'
	| 'regenerate_code'
	| 'delete_any_link'
	| 'remove_member'
	| 'promote'
	| 'demote'
	| 'transfer_ownership'
	| 'delete_group'
	| 'leave'
	| 'change_play'
	| 'set_points'
	| 'plan_night'
	| 'change_night'
	| 'mark_came'
	| 'set_night_planners'
	| 'make_sign_in_code'
	| 'merge_member'
	| 'archive_group'
	| 'claim_ownership'
	| 'link_guest_plays';

export type PermissionContext = {
	/** Role of the member being acted on, for member-targeted actions. */
	targetRole?: Role;
	/** True when the target is the actor, or for `change_play`, when the actor logged the play or played in it. */
	targetIsSelf?: boolean;
	/** Members in the group other than the actor, for `leave`. */
	otherMembers?: number;
	/** For `plan_night`: the group lets any member plan nights (its `nights_by` setting). */
	openToMembers?: boolean;
	/** For `archive_group` and `claim_ownership`: the owner hasn't been seen in the group for OWNER_AWAY_DAYS. */
	ownerAway?: boolean;
};

/** After this long without the owner, a co-admin may archive or restore the group (D50) or take over as owner (D51). */
export const OWNER_AWAY_DAYS = 60;

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

export function atLeast(role: Role, min: Role): boolean {
	return RANK[role] >= RANK[min];
}

export function can(actor: Role, action: GroupAction, ctx: PermissionContext = {}): boolean {
	const { targetRole, targetIsSelf = false, otherMembers = 0, openToMembers = true, ownerAway = false } = ctx;
	switch (action) {
		case 'rename':
		case 'regenerate_code':
		case 'delete_any_link':
		case 'set_points':
		case 'set_night_planners':
			return atLeast(actor, 'admin');
		case 'plan_night':
			return openToMembers || atLeast(actor, 'admin');
		case 'change_night':
			// targetIsSelf: the actor planned the night.
			return targetIsSelf || atLeast(actor, 'admin');
		case 'change_play':
			return targetIsSelf || atLeast(actor, 'admin');
		case 'mark_came':
			// Who came to a night (D67): you for yourself, co-admins for anyone. Not the planner as such.
			return targetIsSelf || atLeast(actor, 'admin');
		case 'remove_member':
		// A sign-in code for someone who lost their way in, and merging an old entry into a new one (D48),
		// reach the same people removing does: anyone but the owner for the owner, members for a co-admin.
		case 'make_sign_in_code':
		case 'merge_member':
			if (targetIsSelf || targetRole == null || targetRole === 'owner') return false;
			if (actor === 'owner') return true;
			return actor === 'admin' && targetRole === 'member';
		case 'promote':
			return actor === 'owner' && !targetIsSelf && targetRole === 'member';
		case 'demote':
			return actor === 'owner' && !targetIsSelf && targetRole === 'admin';
		case 'transfer_ownership':
			return actor === 'owner' && !targetIsSelf && targetRole != null && targetRole !== 'owner';
		case 'delete_group':
			return actor === 'owner';
		// Archiving and restoring (D50): the owner, or a co-admin once the owner has been away a while, so
		// a group whose owner has gone can still be wound down. Deleting for good stays the owner's.
		case 'archive_group':
			return actor === 'owner' || (actor === 'admin' && ownerAway);
		// Taking over (D51): a co-admin, once the owner has been away, so a group isn't stuck without one.
		// The owner becomes a co-admin.
		case 'claim_ownership':
			return actor === 'admin' && ownerAway;
		// Guest plays to a member (D37): the owner or a co-admin, for anyone in the group but themselves,
		// so nobody takes a guest's wins for their own.
		case 'link_guest_plays':
			return atLeast(actor, 'admin') && !targetIsSelf && targetRole != null;
		case 'leave':
			return actor !== 'owner' || otherMembers === 0;
	}
}
