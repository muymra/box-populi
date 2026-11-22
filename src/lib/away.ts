// Members who've been away (D86): a group setting, off unless the group turns it on. Being around is
// the latest of a visit, a play they were in, a night they came to or said they'd go to, joining, and
// being marked as around; a member is away once that's further back than the group's months. Pure, so
// the server, the pages and the tests share it.

/** A month here is 30 days, so "6 months" is 180 days whatever the calendar says. */
export const AWAY_MONTH_MS = 30 * 86_400_000;
export const AWAY_MONTHS = { min: 1, max: 24, fallback: 6 } as const;

/** The group's setting: the months (null while it's off) and whether away members' games leave the shelf. */
export type AwaySetting = { months: number | null; hides: boolean };

/** Being around before this moment counts as away; null while the group has it off. */
export function awayBefore(months: number | null, now: number): number | null {
	return months == null ? null : now - months * AWAY_MONTH_MS;
}

/** Whether someone last around at `activeAt` is away under the group's `months`. */
export function isAway(activeAt: number, months: number | null, now: number): boolean {
	const before = awayBefore(months, now);
	return before != null && activeAt < before;
}

/** Members with those who've been away last, otherwise in the order given, for the pickers. */
export function awayLast<T extends { away?: boolean }>(members: readonly T[]): T[] {
	return [...members.filter((m) => !m.away), ...members.filter((m) => m.away)];
}

/** "Last here in April", or "Last here in April 2025" for another year. */
export function lastHere(at: number, now: number): string {
	const then = new Date(at);
	const sameYear = then.getUTCFullYear() === new Date(now).getUTCFullYear();
	return `Last here in ${then.toLocaleDateString('en-GB', { month: 'long', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' })}`;
}

/** "Ada", "Ada and Bo", "Ada, Bo and Cy", "Ada, Bo and 3 more" */
export function namesOf(names: readonly string[], most = 3): string {
	if (names.length <= 1) return names[0] ?? '';
	if (names.length > most) return `${names.slice(0, most - 1).join(', ')} and ${names.length - most + 1} more`;
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
