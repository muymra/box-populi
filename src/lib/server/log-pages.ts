// Pages of the play log (STATUS item 45, D70): the plays page shows the newest plays a page at a time,
// widened to whole days, with the game nights of the same stretch of dates. A play on a night is on
// the night's date (D67), so a day's edge is a night's edge and no night is cut in half.

/** Bounds for a period without one, as YYYY-MM-DD strings compare. */
export const FIRST_DAY = '0000-01-01';
export const LAST_DAY = '9999-12-31';

/**
 * SQL for the first date of a page: the date of the `n`th newest play of group ?1 from `since` up to
 * before `before`, or `since` when fewer are left, so the page then reaches back to the period's start.
 * `since` and `before` are bound parameters such as `?2`; `n` is a whole number the caller chose.
 */
export function pageStart(since: string, before: string, n: number): string {
	const offset = Math.max(0, Math.floor(n) - 1);
	return `COALESCE((SELECT played_on FROM plays WHERE group_id = ?1 AND played_on >= ${since} AND played_on < ${before}
	  ORDER BY played_on DESC LIMIT 1 OFFSET ${offset}), ${since})`;
}

/** A `before=` date from the address: YYYY-MM-DD, or nothing. */
export function beforeParam(raw: string | null): string | undefined {
	return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}
