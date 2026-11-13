// A member's standing in one group (D79): a full member, someone waiting to be let in (probation),
// or a member the owner or a co-admin suspended. Pure, so the server and the pages share it.

export type Standing = 'full' | 'waiting' | 'suspended';

/** From a membership's columns: suspended outranks waiting, though nobody waiting can be suspended. */
export function standingOf(row: { waiting_since: number | null; suspended_at: number | null }): Standing {
	if (row.suspended_at != null) return 'suspended';
	if (row.waiting_since != null) return 'waiting';
	return 'full';
}

/** The longest note a co-admin can leave a member they suspend. */
export const MAX_SUSPENDED_NOTE = 200;
