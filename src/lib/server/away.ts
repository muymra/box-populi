// Members who've been away (D86) on the server: the group's setting, keeping `memberships.off_shelf`
// up to date, and the writes that say someone was around. With no cron, who's away is brought up to
// date at most once a day by a visit to the group (`awayRefreshDue`), and straight away by anything
// that shows someone was around: a visit (`touchLastSeen`), a play, a night, or being marked as around.
// `off_shelf` is what `group_copies` and `copyOnShelf` read; a trigger moves the catalog's version
// whenever it changes (migration 0027).
import { all, stmt, type DB } from './db.ts';
import { can } from './permissions.ts';
import { AWAY_MONTHS, AWAY_MONTH_MS, type AwaySetting } from '#lib/away.ts';
import { wholeNumberIn } from '#lib/numbers.ts';
import type { Role } from '#lib/catalog/types.ts';

type Actor = { id: string; role: Role };
type Result = { ok: true } | { ok: false; error: string };

const DAY_MS = 86_400_000;

/** SQL for when a member was last around: the latest of a play, a night or a mark, a visit, and joining. */
export function aroundAt(m: string): string {
	return `MAX(${m}.active_at, ${m}.last_seen_at, ${m}.joined_at)`;
}

/** A day (YYYY-MM-DD) as the moment someone was around then: midday UTC. */
export function dayAt(day: string): number {
	return Date.parse(`${day}T12:00:00Z`);
}

/** The UPDATE behind the around statements: ?1 the group, ?2 when, ?3 now; `who` is the SQL list of people. */
function aroundUpdate(who: string): string {
	return `UPDATE memberships SET active_at = MAX(active_at, ?2),
	   off_shelf = off_shelf AND MAX(active_at, last_seen_at, joined_at, ?2) < ?3 - IFNULL((SELECT away_months FROM groups WHERE id = ?1), 0) * ${AWAY_MONTH_MS}
	 WHERE group_id = ?1 AND user_id IN ${who} AND (active_at < ?2 OR off_shelf = 1)`;
}

/** `aroundStatements`' SQL for `n` people, their ids from ?4 on. Exported for its plan test. */
export function aroundSql(n: number): string {
	return aroundUpdate(`(${Array.from({ length: n }, (_, i) => `?${i + 4}`).join(', ')})`);
}

/** `aroundNightStatements`' SQL: the members at night ?4, in its plays or marked as having come. */
export const AROUND_NIGHT_SQL = aroundUpdate(`(SELECT pp.user_id FROM plays p JOIN play_players pp ON pp.play_id = p.id WHERE p.night_id = ?4 AND pp.user_id IS NOT NULL
	   UNION SELECT user_id FROM night_people WHERE night_id = ?4 AND came = 1 AND user_id IS NOT NULL)`);

/**
 * `refreshAwayStatements`' SQL: ?1 the group, ?2 now. The cutoff comes from the group's row as it stands
 * when the statement runs, not as a visit read it earlier, so a setting saved meanwhile is never undone.
 */
export const REFRESH_OFF_SHELF_SQL = `UPDATE memberships SET off_shelf = IFNULL(MAX(active_at, last_seen_at, joined_at) < (${cutoffSql()}), 0)
	 WHERE group_id = ?1 AND off_shelf <> IFNULL(MAX(active_at, last_seen_at, joined_at) < (${cutoffSql()}), 0)`;

/** The moment before which someone is away and off the shelf in group ?1 at ?2, or NULL while its games stay. */
function cutoffSql(): string {
	return `SELECT CASE WHEN away_hides = 1 THEN ?2 - away_months * ${AWAY_MONTH_MS} END FROM groups WHERE id = ?1`;
}

/**
 * These members were around at `at`: in a play on that day, or at a night or answering for one. Their
 * `active_at` moves on (never back), and anyone off the shelf comes back if that's within the group's
 * months. Nothing to write for someone already as recent. Up to 96 people a statement.
 */
export function aroundStatements(db: DB, groupId: string, userIds: readonly (string | null)[], at: number, now: number): D1PreparedStatement[] {
	const ids = [...new Set(userIds.filter((id): id is string => id != null))].slice(0, 96);
	if (ids.length === 0) return [];
	return [stmt(db, aroundSql(ids.length), groupId, Math.min(at, now), now, ...ids)];
}

/** The members at a night (in its plays, or marked as having come) were around on its day: after "That's right" or moving the night. */
export function aroundNightStatements(db: DB, groupId: string, nightId: string, day: string, now: number): D1PreparedStatement[] {
	return [stmt(db, AROUND_NIGHT_SQL, groupId, Math.min(dayAt(day), now), now, nightId)];
}

/**
 * Brings every member's `off_shelf` up to date with the group's setting as it stands: on for those away
 * while the group takes their games off the shelf, off for everyone else. Writes only the rows that
 * change, and notes when it ran. Safe to add to any batch that may have changed someone's dates.
 */
export function refreshAwayStatements(db: DB, groupId: string, now: number): D1PreparedStatement[] {
	return [stmt(db, REFRESH_OFF_SHELF_SQL, groupId, now), stmt(db, 'UPDATE groups SET away_checked_at = ?2 WHERE id = ?1', groupId, now)];
}

/** Whether a visit should bring `off_shelf` up to date: the group takes away members' games off its shelf, and it's been a day. */
export function awayRefreshDue(setting: AwaySetting, checkedAt: number, now: number): boolean {
	return setting.hides && setting.months != null && checkedAt < now - DAY_MS;
}

/**
 * The Group tab's "Away members" (D86): `away` "on" or "off", `months` 1 to 24, `hides` "on" when away
 * members' games leave the shelf. Who goes away, or comes back, does so at once.
 */
export async function setAway(db: DB, groupId: string, actor: Actor, form: { away: unknown; months: unknown; hides: unknown }, now: number): Promise<Result> {
	if (!can(actor.role, 'set_away')) return { ok: false, error: 'Only co-admins and the owner can change this.' };
	let setting: AwaySetting = { months: null, hides: false };
	if (form.away === 'on') {
		const months = wholeNumberIn(form.months, AWAY_MONTHS.min, AWAY_MONTHS.max);
		if (months == null) return { ok: false, error: `Give the months as a whole number from ${AWAY_MONTHS.min} to ${AWAY_MONTHS.max}.` };
		setting = { months, hides: form.hides === 'on' };
	} else if (form.away !== 'off') return { ok: false, error: 'Say whether to mark members as away.' };
	await db.batch([
		stmt(db, 'UPDATE groups SET away_months = ?2, away_hides = ?3 WHERE id = ?1', groupId, setting.months, setting.hides ? 1 : 0),
		...refreshAwayStatements(db, groupId, now)
	]);
	return { ok: true };
}

/** "Mark as around" (D86): the owner or a co-admin says an away member still comes, which starts their months again. */
export async function markAround(db: DB, groupId: string, actor: Actor, userId: string, now: number): Promise<Result> {
	if (!can(actor.role, 'mark_around', { targetIsSelf: userId === actor.id })) return { ok: false, error: 'Only co-admins and the owner can mark someone as around.' };
	const rows = await all(db, 'SELECT 1 AS x FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId);
	if (rows.length === 0) return { ok: false, error: 'That person isn’t in this group.' };
	await stmt(db, 'UPDATE memberships SET active_at = MAX(active_at, ?3), off_shelf = 0 WHERE group_id = ?1 AND user_id = ?2', groupId, userId, now).run();
	return { ok: true };
}
