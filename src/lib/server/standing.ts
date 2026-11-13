// SQL for a member's standing (D79), so every query that means "a member who can take part" says it
// the same way. Waiting and suspended members can read the group but not join in.

/** A membership row, under `alias`, that's neither waiting nor suspended. */
export function fullMember(alias = 'm'): string {
	const a = alias ? `${alias}.` : '';
	return `${a}waiting_since IS NULL AND ${a}suspended_at IS NULL`;
}
