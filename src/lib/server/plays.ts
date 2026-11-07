// The play log on the server (PRD "Play log"): reading the form, saving, reading back and deleting
// plays, and the group's podium points. Every function takes the group, and nothing crosses groups.
import { all, one, stmt, type DB } from './db.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { can } from './permissions.ts';
import { gameOnNight, nightInGroup } from './nights.ts';
import { cleanGuestName } from '#lib/table/here.ts';
import {
	DEFAULT_POINTS,
	MAX_PLAY_PLAYERS,
	MAX_SCORE,
	fillPlaces,
	formatPoints,
	parsePoints,
	placesFromScores,
	type Coop,
	type Play,
	type PlayPlayer
} from '#lib/plays.ts';
import type { Role } from '#lib/catalog/types.ts';

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
 * position, because a select with no matching option sends nothing. `result` is scores, places, won
 * or lost. `latest` is the newest allowed date.
 */
export function parsePlayForm(form: FormData, latest: string): Result<PlayInput> {
	const playedOn = String(form.get('playedOn') ?? '');
	if (!validDate(playedOn, latest)) return { ok: false, error: 'Pick the date it was played, today or earlier.' };
	const result = String(form.get('result') ?? '');
	if (!['scores', 'places', 'won', 'lost'].includes(result)) return { ok: false, error: 'Say how it ended.' };

	const keys = form.getAll('player').map(String);
	if (keys.length === 0) return { ok: false, error: 'Add who played.' };
	if (keys.length > MAX_PLAY_PLAYERS) return { ok: false, error: `A play can have up to ${MAX_PLAY_PLAYERS} players.` };

	const players: PlayPlayer[] = [];
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
		players.push({ userId, guestName, score, place });
	}

	const lowestWins = form.get('lowestWins') === '1';
	const nightId = String(form.get('nightId') ?? '') || null;
	if (result === 'won' || result === 'lost') {
		return { ok: true, value: { playedOn, coop: result, lowestWins: false, nightId, players: players.map((p) => ({ ...p, place: null })) } };
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
			`SELECT 1 AS x FROM copies c JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1 WHERE c.game_id = ?2 LIMIT 1`,
			groupId,
			gameId
		)) != null
	);
}

async function allMembers(db: DB, groupId: string, ids: string[]): Promise<boolean> {
	if (ids.length === 0) return true;
	const rows = await all<{ user_id: string }>(
		db,
		`SELECT user_id FROM memberships WHERE group_id = ?1 AND user_id IN (${ids.map((_, i) => `?${i + 2}`).join(', ')})`,
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
			'INSERT INTO play_players (play_id, seat, user_id, guest_name, place, score) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
			playId,
			seat,
			p.userId,
			p.guestName,
			p.place,
			p.score
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
	if (nightId && !(await nightInGroup(db, groupId, nightId))) return { ok: false, error: 'That game night is gone. Reload the page.' };
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
			bumpCatalogForGroup(db, groupId)
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
		bumpCatalogForGroup(db, groupId)
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

export type PlayQuery = { gameId?: number; since?: string; withUser?: string; nightId?: string; limit?: number };

/** Plays in a group, newest first, with their players in the order entered and the group's name for each game. */
export async function loadPlays(db: DB, groupId: string, q: PlayQuery = {}): Promise<StoredPlay[]> {
	const params: unknown[] = [groupId];
	const where = ['group_id = ?1'];
	if (q.gameId != null) where.push(`game_id = ?${params.push(q.gameId)}`);
	if (q.since) where.push(`played_on >= ?${params.push(q.since)}`);
	if (q.withUser) where.push(`id IN (SELECT play_id FROM play_players WHERE user_id = ?${params.push(q.withUser)})`);
	if (q.nightId) where.push(`night_id = ?${params.push(q.nightId)}`);
	const limit = q.limit != null ? ` LIMIT ${Math.max(1, Math.floor(q.limit))}` : '';
	const rows = await all<{
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
	}>(
		db,
		`SELECT p.id, p.game_id, COALESCE(gc.name, g.name) AS game_name, g.bgg_id, g.source, g.is_manual, p.played_on, p.coop, p.lowest_wins, p.logged_by,
		        p.night_id, n.name AS night_name,
		        pp.user_id, pp.guest_name, pp.place, pp.score
		 FROM (SELECT * FROM plays WHERE ${where.join(' AND ')} ORDER BY played_on DESC, created_at DESC${limit}) p
		 JOIN games g ON g.id = p.game_id
		 LEFT JOIN game_corrections gc ON gc.group_id = p.group_id AND gc.game_id = p.game_id
		 LEFT JOIN game_nights n ON n.id = p.night_id
		 JOIN play_players pp ON pp.play_id = p.id
		 ORDER BY p.played_on DESC, p.created_at DESC, p.id, pp.seat`,
		...params
	);
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
				players: []
			};
			plays.set(r.id, play);
		}
		play.players.push({ userId: r.user_id, guestName: r.guest_name, place: r.place, score: r.score });
	}
	return [...plays.values()];
}

export async function podiumPoints(db: DB, groupId: string): Promise<number[]> {
	const row = await one<{ podium_points: string | null }>(db, 'SELECT podium_points FROM groups WHERE id = ?1', groupId);
	return parsePoints(row?.podium_points ?? null) ?? DEFAULT_POINTS;
}

export async function setPodiumPoints(db: DB, groupId: string, actor: Actor, raw: unknown): Promise<Result> {
	if (!can(actor.role, 'set_points')) return { ok: false, error: 'Only co-admins and the owner can change the points.' };
	const scheme = parsePoints(raw);
	if (!scheme) return { ok: false, error: 'Give one to five whole numbers from 0 to 100, first place first, like 3, 2, 1.' };
	await stmt(db, 'UPDATE groups SET podium_points = ?1 WHERE id = ?2', formatPoints(scheme), groupId).run();
	return { ok: true, value: undefined };
}
