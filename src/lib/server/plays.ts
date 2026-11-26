// The play log on the server (PRD "Play log"): reading the form, saving, reading back and deleting
// plays, and the group's podium points. Every function takes the group, and nothing crosses groups.
import { all, mapRead, one, readAll, rowOf, rowsOf, run, stmt, type DB, type Read } from './db.ts';
import { fullMember } from './standing.ts';
import { aroundStatements, dayAt } from './away.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { can } from './permissions.ts';
import { gameOnNight, nightDay } from './nights.ts';
import { FIRST_DAY, LAST_DAY, pageStart } from './log-pages.ts';
import { cleanGuestName } from '#lib/table/here.ts';
import {
	DEFAULT_COOP_WIN_POINTS,
	MAX_POINTS,
	type PlayRules,
	MAX_PLAY_PLAYERS,
	MAX_SCORE,
	fillPlaces,
	formatPoints,
	parsePoints,
	placesFromScores,
	type Coop,
	type Play,
	type PlayOutcome,
	type PlayPlayer,
	type StandingCounts
} from '#lib/plays.ts';
import type { Role } from '#lib/catalog/types.ts';
import { complexityLevel } from '#lib/catalog/buckets.ts';
import { wholeNumberIn } from '#lib/numbers.ts';

export type Actor = { id: string; role: Role };
export type PlayInput = { playedOn: string; coop: Coop | null; lowestWins: boolean; players: PlayPlayer[]; nightId?: string | null };
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
export type StoredPlay = Play & { loggedBy: string | null; lowestWins: boolean };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date from 2000 up to `latest`. */
function validDate(value: string, latest: string): boolean {
	const m = DATE.exec(value);
	if (!m) return false;
	const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
	return d.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= latest;
}

function optionalInt(raw: FormDataEntryValue | undefined, min: number, max: number): number | null | 'bad' {
	const text = String(raw ?? '').trim();
	if (!text) return null;
	if (!/^-?\d+$/.test(text)) return 'bad';
	const n = Number(text);
	return n >= min && n <= max ? n : 'bad';
}

/**
 * Reads the log form. `player` lists "m:<member id>" or "g:<guest name>" in order, and each player's
 * score and place come in `score:<key>` and `place:<key>`, named after them rather than paired by
 * position, because a select with no matching option sends nothing. `result` is scores, places, teams,
 * won or lost. A team play (D87) gives each player's team in `team:<key>` and each team's place in
 * `teamPlace:<team>`; teams are numbered again from 1 without gaps, and every player takes their
 * team's place. `latest` is the newest allowed date.
 */
export function parsePlayForm(form: FormData, latest: string): Result<PlayInput> {
	const playedOn = String(form.get('playedOn') ?? '');
	if (!validDate(playedOn, latest)) return { ok: false, error: 'Pick the date it was played, today or earlier.' };
	const result = String(form.get('result') ?? '');
	if (!['scores', 'places', 'teams', 'won', 'lost'].includes(result)) return { ok: false, error: 'Say how it ended.' };

	const keys = form.getAll('player').map(String);
	if (keys.length === 0) return { ok: false, error: 'Add who played.' };
	if (keys.length > MAX_PLAY_PLAYERS) return { ok: false, error: `A play can have up to ${MAX_PLAY_PLAYERS} players.` };

	const players: PlayPlayer[] = [];
	const teams: number[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		let userId: string | null = null;
		let guestName: string | null = null;
		if (key.startsWith('m:') && key.length > 2) userId = key.slice(2);
		else if (key.startsWith('g:')) guestName = cleanGuestName(key.slice(2));
		if (!userId && !guestName) return { ok: false, error: 'One of the players has no name.' };
		const dedupe = userId ? `m:${userId}` : `g:${guestName!.toLowerCase()}`;
		if (seen.has(dedupe)) return { ok: false, error: `${guestName ?? 'Someone'} is listed twice.` };
		seen.add(dedupe);
		const score = optionalInt(form.get(`score:${key}`) ?? undefined, -MAX_SCORE, MAX_SCORE);
		const place = optionalInt(form.get(`place:${key}`) ?? undefined, 1, MAX_PLAY_PLAYERS);
		if (score === 'bad') return { ok: false, error: `Scores are whole numbers up to ${MAX_SCORE.toLocaleString('en')}.` };
		if (place === 'bad') return { ok: false, error: 'A place is a number from 1 up.' };
		if (result === 'teams') {
			const team = optionalInt(form.get(`team:${key}`) ?? undefined, 1, MAX_PLAY_PLAYERS);
			if (team === 'bad') return { ok: false, error: 'A team is a number from 1 up.' };
			if (team == null) return { ok: false, error: `Put ${guestName ?? 'everyone'} in a team.` };
			teams.push(team);
		}
		players.push({ userId, guestName, score, place });
	}

	const lowestWins = form.get('lowestWins') === '1';
	const nightId = String(form.get('nightId') ?? '') || null;
	if (result === 'won' || result === 'lost') {
		return { ok: true, value: { playedOn, coop: result, lowestWins: false, nightId, players: players.map((p) => ({ ...p, place: null })) } };
	}
	if (result === 'teams') {
		const used = [...new Set(teams)].sort((a, b) => a - b);
		if (used.length < 2) return { ok: false, error: 'Make at least two teams.' };
		const given: (number | null)[] = [];
		for (const team of used) {
			const place = optionalInt(form.get(`teamPlace:${team}`) ?? undefined, 1, MAX_PLAY_PLAYERS);
			if (place === 'bad') return { ok: false, error: 'A place is a number from 1 up.' };
			given.push(place);
		}
		if (given.every((p) => p == null)) return { ok: false, error: 'Pick at least the winning team.' };
		const teamPlaces = fillPlaces(given);
		return {
			ok: true,
			value: {
				playedOn,
				coop: null,
				lowestWins: false,
				nightId,
				players: players.map((p, i) => {
					const n = used.indexOf(teams[i]);
					return { ...p, score: null, team: n + 1, place: teamPlaces[n] };
				})
			}
		};
	}
	if (result === 'scores') {
		if (players.every((p) => p.score == null)) return { ok: false, error: 'Enter at least one score, or pick places instead.' };
		const places = placesFromScores(
			players.map((p) => p.score),
			lowestWins
		);
		return { ok: true, value: { playedOn, coop: null, lowestWins, nightId, players: players.map((p, i) => ({ ...p, place: places[i] })) } };
	}
	if (players.length > 1 && players.every((p) => p.place == null)) return { ok: false, error: 'Pick at least the winner.' };
	const places = fillPlaces(players.map((p) => p.place));
	return { ok: true, value: { playedOn, coop: null, lowestWins: false, nightId, players: players.map((p, i) => ({ ...p, score: null, place: places[i] })) } };
}

/** The game is on this group's shelf: a member has a copy. Plays are only logged for those (D37). */
export async function gameOnShelf(db: DB, groupId: string, gameId: number): Promise<boolean> {
	return (
		(await one(
			db,
			`SELECT 1 AS x FROM group_copies WHERE group_id = ?1 AND game_id = ?2 LIMIT 1`,
			groupId,
			gameId
		)) != null
	);
}

/** Whether everyone new in a play can take part (D79): in the group, not waiting, not suspended. */
async function allMembers(db: DB, groupId: string, ids: string[]): Promise<boolean> {
	if (ids.length === 0) return true;
	const rows = await all<{ user_id: string }>(
		db,
		`SELECT m.user_id FROM memberships m WHERE m.group_id = ?1 AND ${fullMember()} AND m.user_id IN (${ids.map((_, i) => `?${i + 2}`).join(', ')})`,
		groupId,
		...ids
	);
	return rows.length === new Set(ids).size;
}

/** Who may change or delete a play: whoever logged it, anyone in it, and co-admins or the owner. */
export function canChangePlay(actor: Actor, play: { loggedBy: string | null; players: readonly { userId: string | null }[] }): boolean {
	const own = play.loggedBy === actor.id || play.players.some((p) => p.userId === actor.id);
	return can(actor.role, 'change_play', { targetIsSelf: own });
}

async function playOwnership(db: DB, groupId: string, playId: string) {
	const play = await one<{ logged_by: string | null; game_id: number }>(db, 'SELECT logged_by, game_id FROM plays WHERE id = ?1 AND group_id = ?2', playId, groupId);
	if (!play) return null;
	const players = await all<{ user_id: string | null }>(db, 'SELECT user_id FROM play_players WHERE play_id = ?1', playId);
	return { loggedBy: play.logged_by, gameId: play.game_id, players: players.map((p) => ({ userId: p.user_id })) };
}

function playerInserts(db: DB, playId: string, players: PlayPlayer[]): D1PreparedStatement[] {
	return players.map((p, seat) =>
		stmt(
			db,
			'INSERT INTO play_players (play_id, seat, user_id, guest_name, place, score, team) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
			playId,
			seat,
			p.userId,
			p.guestName,
			p.place,
			p.score,
			p.team ?? null
		)
	);
}

/**
 * Logs a new play, or replaces play `playId` when given. Bumps the group's catalog for "last played".
 * An edit keeps working after its game leaves the shelf, and keeps players who have since left the
 * group: they were in it, so they stay, but nobody outside the group can be added.
 */
export async function savePlay(db: DB, groupId: string, actor: Actor, gameId: number, input: PlayInput, playId?: string, now = Date.now()): Promise<Result<string>> {
	const existing = playId ? await playOwnership(db, groupId, playId) : null;
	if (playId && !existing) return { ok: false, error: 'That play is gone. Reload the page.' };
	if (existing && !canChangePlay(actor, existing)) return { ok: false, error: 'Only whoever logged it, its players and co-admins can change a play.' };
	const nightId = input.nightId ?? null;
	if (nightId) {
		const night = await nightDay(db, groupId, nightId);
		if (!night) return { ok: false, error: 'That game night is gone. Reload the page.' };
		// A play on a night is played on its day (STATUS item 42).
		if (night !== input.playedOn) return { ok: false, error: 'That game night was on another day. Change the date, or untick the night.' };
	}
	// A shelf game, or one on the night's bring list, such as a guest's (D38).
	if (existing?.gameId !== gameId && !(await gameOnShelf(db, groupId, gameId)) && !(nightId && (await gameOnNight(db, groupId, nightId, gameId)))) {
		return { ok: false, error: 'That game isn’t on this group’s shelf or the night’s list.' };
	}
	const already = new Set(existing?.players.map((p) => p.userId) ?? []);
	const memberIds = input.players.map((p) => p.userId).filter((id): id is string => id != null && !already.has(id));
	if (!(await allMembers(db, groupId, memberIds))) return { ok: false, error: 'Someone in that play isn’t in this group. Reload and try again.' };

	if (playId) {
		await db.batch([
			stmt(
				db,
				'UPDATE plays SET game_id = ?1, played_on = ?2, coop = ?3, lowest_wins = ?4, night_id = ?5 WHERE id = ?6',
				gameId,
				input.playedOn,
				input.coop,
				input.lowestWins ? 1 : 0,
				nightId,
				playId
			),
			stmt(db, 'DELETE FROM play_players WHERE play_id = ?1', playId),
			...playerInserts(db, playId, input.players),
			bumpCatalogForGroup(db, groupId),
			// Its players were around that day (D86).
			...aroundStatements(db, groupId, input.players.map((p) => p.userId), dayAt(input.playedOn), now)
		]);
		return { ok: true, value: playId };
	}

	const id = crypto.randomUUID();
	await db.batch([
		stmt(
			db,
			'INSERT INTO plays (id, group_id, game_id, played_on, coop, lowest_wins, logged_by, created_at, night_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
			id,
			groupId,
			gameId,
			input.playedOn,
			input.coop,
			input.lowestWins ? 1 : 0,
			actor.id,
			now,
			nightId
		),
		...playerInserts(db, id, input.players),
		bumpCatalogForGroup(db, groupId),
		...aroundStatements(db, groupId, input.players.map((p) => p.userId), dayAt(input.playedOn), now)
	]);
	return { ok: true, value: id };
}

export async function deletePlay(db: DB, groupId: string, actor: Actor, playId: string): Promise<Result> {
	const existing = await playOwnership(db, groupId, playId);
	if (!existing) return { ok: false, error: 'That play is already gone.' };
	if (!canChangePlay(actor, existing)) return { ok: false, error: 'Only whoever logged it, its players and co-admins can delete a play.' };
	await db.batch([
		stmt(db, 'DELETE FROM play_players WHERE play_id = ?1', playId),
		stmt(db, 'DELETE FROM plays WHERE id = ?1', playId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true, value: undefined };
}

/**
 * `page`: the newest `page` plays from `since` up to before `before`, widened to every play on the oldest
 * one's date (log-pages.ts), so a night is never cut in half (D70).
 */
export type PlayQuery = { gameId?: number; since?: string; before?: string; page?: number; withUser?: string; alsoWith?: string; nightId?: string; limit?: number };

/** Plays in a group, newest first, with their players in the order entered and the group's name for each game. */
export async function loadPlays(db: DB, groupId: string, q: PlayQuery = {}): Promise<StoredPlay[]> {
	return (await readAll(db, { p: playsRead(db, groupId, q) })).p;
}

/** loadPlays as a read, to share a round trip with others (`readAll`, D59). */
export function playsRead(db: DB, groupId: string, q: PlayQuery = {}): Read<StoredPlay[]> {
	const params: unknown[] = [groupId];
	// For one night's plays the `+` keeps SQLite on plays_night instead of walking the group's (D70).
	const where = [q.nightId ? '+group_id = ?1' : 'group_id = ?1'];
	if (q.gameId != null) where.push(`game_id = ?${params.push(q.gameId)}`);
	if (q.page) {
		const since = `?${params.push(q.since ?? FIRST_DAY)}`;
		const before = `?${params.push(q.before ?? LAST_DAY)}`;
		where.push(`played_on >= ${pageStart(since, before, q.page)}`, `played_on < ${before}`);
	} else {
		if (q.since) where.push(`played_on >= ?${params.push(q.since)}`);
		if (q.before) where.push(`played_on < ?${params.push(q.before)}`);
	}
	if (q.withUser) where.push(`id IN (SELECT play_id FROM play_players WHERE user_id = ?${params.push(q.withUser)})`);
	if (q.alsoWith) where.push(`id IN (SELECT play_id FROM play_players WHERE user_id = ?${params.push(q.alsoWith)})`);
	if (q.nightId) where.push(`night_id = ?${params.push(q.nightId)}`);
	const limit = q.limit != null ? ` LIMIT ${Math.max(1, Math.floor(q.limit))}` : '';
	type PlayRow = {
		id: string;
		game_id: number;
		game_name: string;
		bgg_id: number | null;
		source: string;
		is_manual: number;
		played_on: string;
		coop: Coop | null;
		lowest_wins: number;
		logged_by: string | null;
		night_id: string | null;
		night_name: string | null;
		user_id: string | null;
		guest_name: string | null;
		place: number | null;
		score: number | null;
		team: number | null;
		weight: number | null;
	};
	return mapRead(
		rowsOf<PlayRow>(
			db,
			`SELECT p.id, p.game_id, COALESCE(gc.name, g.name) AS game_name, g.bgg_id, g.source, g.is_manual, g.weight, p.played_on, p.coop, p.lowest_wins, p.logged_by,
			        p.night_id, n.name AS night_name,
			        pp.user_id, pp.guest_name, pp.place, pp.score, pp.team
			 FROM (SELECT * FROM plays WHERE ${where.join(' AND ')} ORDER BY played_on DESC, created_at DESC${limit}) p
			 JOIN games g ON g.id = p.game_id
			 LEFT JOIN game_corrections gc ON gc.group_id = p.group_id AND gc.game_id = p.game_id
			 LEFT JOIN game_nights n ON n.id = p.night_id
			 JOIN play_players pp ON pp.play_id = p.id
			 ORDER BY p.played_on DESC, p.created_at DESC, p.id, pp.seat`,
			...params
		),
		(rows) => {
			const plays = new Map<string, StoredPlay>();
			for (const r of rows) {
				let play = plays.get(r.id);
				if (!play) {
					play = {
						id: r.id,
						gameId: r.game_id,
						gameName: r.game_name,
						bggId: r.bgg_id,
						// BGG data means what the footer's credit means (holdsBggData): a BGG id, not typed in.
						gameSource: r.is_manual === 1 ? 'manual' : r.source === 'wikidata' ? 'wikidata' : r.source === 'bgg' && r.bgg_id != null ? 'bgg' : 'manual',
						playedOn: r.played_on,
						coop: r.coop,
						lowestWins: r.lowest_wins === 1,
						loggedBy: r.logged_by,
						night: r.night_id ? { id: r.night_id, name: r.night_name ?? '' } : null,
						level: complexityLevel(r.weight),
						players: []
					};
					plays.set(r.id, play);
				}
				play.players.push({ userId: r.user_id, guestName: r.guest_name, place: r.place, score: r.score, ...(r.team != null && { team: r.team }) });
			}
			return [...plays.values()];
		}
	);
}

/**
 * Who finished where in a group's plays, newest first, without games, nights' names or scores: what
 * standings, a night's "went" and a profile's figures need (D70). On a long history it reads a little
 * less than playsRead and returns well under half as much. `withUser` starts from that person's seats.
 */
export function playOutcomesRead(db: DB, groupId: string, q: { since?: string; withUser?: string } = {}): Read<PlayOutcome[]> {
	const params: unknown[] = [groupId];
	const since = q.since ? ` AND p.played_on >= ?${params.push(q.since)}` : '';
	const from = q.withUser
		? `play_players me CROSS JOIN plays p CROSS JOIN play_players pp
		   WHERE me.user_id = ?${params.push(q.withUser)} AND p.id = me.play_id AND p.group_id = ?1${since} AND pp.play_id = p.id`
		: `plays p CROSS JOIN play_players pp WHERE p.group_id = ?1${since} AND pp.play_id = p.id`;
	type Row = { id: string; played_on: string; coop: Coop | null; night_id: string | null; user_id: string | null; guest_name: string | null; place: number | null; team: number | null };
	return mapRead(
		rowsOf<Row>(
			db,
			`SELECT p.id, p.played_on, p.coop, p.night_id, pp.user_id, pp.guest_name, pp.place, pp.team FROM ${from}
			 ORDER BY p.played_on DESC, p.created_at DESC, p.id, pp.seat`,
			...params
		),
		(rows) => {
			const plays = new Map<string, PlayOutcome>();
			for (const r of rows) {
				let play = plays.get(r.id);
				if (!play) plays.set(r.id, (play = { id: r.id, playedOn: r.played_on, coop: r.coop, nightId: r.night_id, players: [] }));
				// `team` only in a team play, so the kept histories in plays_cache don't grow by a field per seat.
				play.players.push({ userId: r.user_id, guestName: r.guest_name, place: r.place, ...(r.team != null && { team: r.team }) });
			}
			return [...plays.values()];
		}
	);
}

/**
 * `complexityLevel()` in SQL, with 1 for a game without a weight: what a play's points are multiplied by
 * when its group's points follow complexity (D89). Migration 0028's trigger has the same CASE.
 */
export const LEVEL_OR_ONE = (weight: string) =>
	`CASE WHEN ${weight} IS NULL OR ${weight} < 1.5 THEN 1 WHEN ${weight} < 2.5 THEN 2 WHEN ${weight} < 3.5 THEN 3 WHEN ${weight} < 4.5 THEN 4 ELSE 5 END`;

/**
 * The leaderboard's numbers per member of the group, counted in SQL from every play since `since`
 * (D70): about 50 rows back however long the history, where reading every play's players cost a group
 * at the planned scale over 10ms of Worker CPU on "All time". `standingsFromCounts` applies the scheme.
 * A play scores when it's competitive and everyone has a place; a place scores unless it's the worst.
 * Co-op wins are counted apart (`coop_wins`), so `standingsFromCounts` can apply the group's rules to them.
 * When the group's points follow complexity (D89), each play counts its game's level times in the place
 * counts and `coop_scored`; with the setting off, `games` isn't read.
 */
export function standingsRead(db: DB, groupId: string, since?: string, before?: string): Read<StandingCounts[]> {
	type Row = { user_id: string; plays: number; wins: number; coop_wins: number; coop_scored: number; s1: number; s2: number; s3: number; s4: number; s5: number; latest: string };
	const scores = (k: number) => `SUM((s.coop IS NULL AND s.unplaced = 0 AND s.place < s.worst AND s.place = ${k}) * s.times) AS s${k}`;
	return mapRead(
		rowsOf<Row>(
			db,
			// Each play's worst place and unplaced seats first, then its seats: at the planned scale this reads
			// about 53,000 rows for "All time", where window functions read 64,000.
			`WITH per AS (
			   SELECT p.id, p.coop, p.played_on, p.created_at, MAX(pp.place) AS worst, COUNT(*) - COUNT(pp.place) AS unplaced,
			          CASE WHEN (SELECT points_by_complexity FROM groups WHERE id = ?1) = 1
			               THEN COALESCE((SELECT ${LEVEL_OR_ONE('weight')} FROM games WHERE id = p.game_id), 1) ELSE 1 END AS times
			   FROM plays p CROSS JOIN play_players pp
			   WHERE p.group_id = ?1 AND p.played_on >= ?2 AND p.played_on < ?3 AND pp.play_id = p.id
			   GROUP BY p.id
			 ),
			 seats AS (
			   SELECT per.coop, per.played_on, per.created_at, per.worst, per.unplaced, per.times, pp.user_id, pp.place
			   FROM per CROSS JOIN play_players pp WHERE pp.play_id = per.id
			 )
			 SELECT s.user_id, COUNT(*) AS plays, SUM(s.coop IS NULL AND s.place = 1 AND s.worst > 1) AS wins,
			        SUM(s.coop IS 'won') AS coop_wins, SUM((s.coop IS 'won') * s.times) AS coop_scored,
			        ${[1, 2, 3, 4, 5].map(scores).join(', ')},
			        MAX(s.played_on || printf('%016d', s.created_at)) AS latest
			 FROM seats s
			 WHERE s.user_id IN (SELECT user_id FROM memberships WHERE group_id = ?1)
			 GROUP BY s.user_id`,
			groupId,
			since ?? FIRST_DAY,
			before ?? LAST_DAY
		),
		(rows) => rows.map((r) => ({ userId: r.user_id, plays: r.plays, wins: r.wins ?? 0, coopWins: r.coop_wins ?? 0, coopScored: r.coop_scored ?? 0, scored: [r.s1 ?? 0, r.s2 ?? 0, r.s3 ?? 0, r.s4 ?? 0, r.s5 ?? 0], latest: r.latest }))
	);
}

/** Figures kept in `plays_cache` (D82): the value if it's still current, else what's needed to count and keep it. */
export type CachedFigures<T> = { groupId: string; key: string; version: number; value: T | null };

/** A string as long as this isn't kept: D1 refuses a string over 2,000,000 bytes. */
const KEPT_FIGURES_MAX = 1_900_000;

/**
 * A figure counted from the group's plays, as kept in `plays_cache`, for a batch (D59): one row. It's
 * current while the group's `standings_version` stands, which triggers bump whenever plays, their seats
 * or the group's members change (migration 0025). `keptFigures` counts and keeps it when not.
 */
function cachedFiguresRead<T>(db: DB, groupId: string, key: string): Read<CachedFigures<T>> {
	return mapRead(
		rowOf<{ version: number; cached: number | null; value: string | null }>(
			db,
			`SELECT g.standings_version AS version, k.version AS cached, k.value
			 FROM groups g LEFT JOIN plays_cache k ON k.group_id = g.id AND k.key = ?2
			 WHERE g.id = ?1`,
			groupId,
			key
		),
		(row) => ({
			groupId,
			key,
			version: row?.version ?? 0,
			value: row && row.value != null && row.cached === row.version ? (JSON.parse(row.value) as T) : null
		})
	);
}

/**
 * The figure from `cachedFiguresRead`, counted with `read` and kept when it wasn't current. It's kept
 * under the version read before counting, so a play logged meanwhile makes the next read count again.
 */
async function keptFigures<T>(db: DB, cached: CachedFigures<T>, read: Read<T>): Promise<T> {
	if (cached.value != null) return cached.value;
	const { value } = await readAll(db, { value: read });
	const json = JSON.stringify(value);
	if (json.length <= KEPT_FIGURES_MAX) {
		await run(
			db,
			`INSERT INTO plays_cache (group_id, key, version, value) VALUES (?1, ?2, ?3, ?4)
			 ON CONFLICT (group_id, key) DO UPDATE SET version = excluded.version, value = excluded.value`,
			cached.groupId,
			cached.key,
			cached.version,
			json
		).catch(() => {}); // too long in bytes for D1: counted again next time
	}
	return value;
}

/** The leaderboard's counts for a period, kept: one row, where counting read about 18,000 rows for the year at the planned scale on every plays page and profile. */
export type CachedStandings = CachedFigures<StandingCounts[]> & { since: string; before: string };

export function cachedStandingsRead(db: DB, groupId: string, since?: string, before?: string): Read<CachedStandings> {
	const from = since ?? FIRST_DAY;
	const to = before ?? LAST_DAY;
	return mapRead(cachedFiguresRead<StandingCounts[]>(db, groupId, `standings ${from} ${to}`), (c) => ({ ...c, since: from, before: to }));
}

export function standingsFor(db: DB, cached: CachedStandings): Promise<StandingCounts[]> {
	return keptFigures(db, cached, standingsRead(db, cached.groupId, cached.since, cached.before));
}

/** A member's play history in the group for their profile (`playOutcomesRead` with `withUser`), kept: about 6,000 rows for a regular at the planned scale. */
export type CachedOutcomes = CachedFigures<PlayOutcome[]> & { userId: string };

export function cachedOutcomesRead(db: DB, groupId: string, userId: string): Read<CachedOutcomes> {
	return mapRead(cachedFiguresRead<PlayOutcome[]>(db, groupId, `outcomes ${userId}`), (c) => ({ ...c, userId }));
}

export function outcomesFor(db: DB, cached: CachedOutcomes): Promise<PlayOutcome[]> {
	return keptFigures(db, cached, playOutcomesRead(db, cached.groupId, { withUser: cached.userId }));
}

/**
 * About a page of the play log (D70): its first date, whether anything older is left in the period
 * (plays or nights), and the period's play and night counts, up to `until` (inclusive). `before` is the
 * page's upper bound; a past year's page also stops at the year's end.
 */
export function playsPageRead(db: DB, groupId: string, q: { since?: string; before?: string; until: string; n: number }): Read<{ start: string; older: boolean; plays: number; nights: number }> {
	const start = pageStart('?2', '?3', q.n);
	return mapRead(
		rowsOf<{ start: string; older: number; plays: number; nights: number }>(
			db,
			`SELECT ${start} AS start,
			   EXISTS (SELECT 1 FROM plays WHERE group_id = ?1 AND played_on >= ?2 AND played_on < ${start})
			   OR EXISTS (SELECT 1 FROM game_nights WHERE group_id = ?1 AND night_on >= ?2 AND night_on < ${start}) AS older,
			   (SELECT COUNT(*) FROM plays WHERE group_id = ?1 AND played_on >= ?2 AND played_on <= ?4) AS plays,
			   (SELECT COUNT(*) FROM game_nights WHERE group_id = ?1 AND night_on >= ?2 AND night_on <= ?4) AS nights`,
			groupId,
			q.since ?? FIRST_DAY,
			q.before ?? LAST_DAY,
			q.until
		),
		(rows) => ({ start: rows[0].start, older: rows[0].older === 1, plays: rows[0].plays, nights: rows[0].nights })
	);
}

/**
 * Which years the plays page offers (STATUS item 45): the first day anyone played here, and whether
 * last year had plays, so "2025" shows beside this year only when there's something in it.
 */
export function playYearsRead(db: DB, groupId: string, thisYear: number): Read<{ first: string | null; lastYear: boolean }> {
	return mapRead(
		rowsOf<{ first: string | null; last_year: number }>(
			db,
			`SELECT (SELECT MIN(played_on) FROM plays WHERE group_id = ?1) AS first,
			   EXISTS (SELECT 1 FROM plays WHERE group_id = ?1 AND played_on >= ?2 AND played_on < ?3) AS last_year`,
			groupId,
			`${thisYear - 1}-01-01`,
			`${thisYear}-01-01`
		),
		(rows) => ({ first: rows[0]?.first ?? null, lastYear: rows[0]?.last_year === 1 })
	);
}

/**
 * The group's scoring (D71): its podium points, or the instance's `DEFAULT_POINTS` when it hasn't set
 * its own, and its co-op rules.
 */
export async function playRules(db: DB, groupId: string, defaultPoints: readonly number[]): Promise<PlayRules> {
	return (await readAll(db, { r: playRulesRead(db, groupId, defaultPoints) })).r;
}

/** playRules as a read, to share a round trip with others (`readAll`, D59). */
export function playRulesRead(db: DB, groupId: string, defaultPoints: readonly number[]): Read<PlayRules> {
	return mapRead(
		rowsOf<{ podium_points: string | null; coop_win_points: number; coop_wins_count: number; points_by_complexity: number }>(
			db,
			'SELECT podium_points, coop_win_points, coop_wins_count, points_by_complexity FROM groups WHERE id = ?1',
			groupId
		),
		(rows) => ({
			points: parsePoints(rows[0]?.podium_points ?? null) ?? defaultPoints,
			coopWinPoints: rows[0]?.coop_win_points ?? DEFAULT_COOP_WIN_POINTS,
			coopWinsCount: (rows[0]?.coop_wins_count ?? 1) === 1,
			byComplexity: rows[0]?.points_by_complexity === 1
		})
	);
}

export async function setPodiumPoints(db: DB, groupId: string, actor: Actor, raw: unknown): Promise<Result> {
	if (!can(actor.role, 'set_points')) return { ok: false, error: 'Only co-admins and the owner can change the points.' };
	const scheme = parsePoints(raw);
	if (!scheme) return { ok: false, error: 'Give one to five whole numbers from 0 to 100, first place first, like 3, 2, 1.' };
	await stmt(db, 'UPDATE groups SET podium_points = ?1 WHERE id = ?2', formatPoints(scheme), groupId).run();
	return { ok: true, value: undefined };
}

/** What a co-op win scores each player (0 to MAX_POINTS) and whether it counts as a win (D71). Same people as the points. */
export async function setCoopRules(db: DB, groupId: string, actor: Actor, form: { points: unknown; counts: unknown }): Promise<Result> {
	if (!can(actor.role, 'set_points')) return { ok: false, error: 'Only co-admins and the owner can change the points.' };
	const points = wholeNumberIn(form.points, 0, MAX_POINTS);
	if (points == null) return { ok: false, error: `Give a whole number from 0 to ${MAX_POINTS} for a co-op win.` };
	await stmt(db, 'UPDATE groups SET coop_win_points = ?1, coop_wins_count = ?2 WHERE id = ?3', points, form.counts === 'on' ? 1 : 0, groupId).run();
	return { ok: true, value: undefined };
}

/** Whether every point a play gives is multiplied by its game's level (D89). Same people as the points; a trigger counts the leaderboard again. */
export async function setPointsByComplexity(db: DB, groupId: string, actor: Actor, on: unknown): Promise<Result> {
	if (!can(actor.role, 'set_points')) return { ok: false, error: 'Only co-admins and the owner can change the points.' };
	await stmt(db, 'UPDATE groups SET points_by_complexity = ?1 WHERE id = ?2', on === 'on' ? 1 : 0, groupId).run();
	return { ok: true, value: undefined };
}
