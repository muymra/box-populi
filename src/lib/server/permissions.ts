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
	| 'set_night_planners'
	| 'make_sign_in_code'
	| 'merge_member';

export type PermissionContext = {
	/** Role of the member being acted on, for member-targeted actions. */
	targetRole?: Role;
	/** True when the target is the actor, or for `change_play`, when the actor logged the play or played in it. */
	targetIsSelf?: boolean;
	/** Members in the group other than the actor, for `leave`. */
	otherMembers?: number;
	/** For `plan_night`: the group lets any member plan nights (its `nights_by` setting). */
	openToMembers?: boolean;
};

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

export function atLeast(role: Role, min: Role): boolean {
	return RANK[role] >= RANK[min];
}

export function can(actor: Role, action: GroupAction, ctx: PermissionContext = {}): boolean {
	const { targetRole, targetIsSelf = false, otherMembers = 0, openToMembers = true } = ctx;
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
		case 'leave':
			return actor !== 'owner' || otherMembers === 0;
	}
}
