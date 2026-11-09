// Game nights on the server (PRD "Game night", DECISIONS D38): planning, who's going, the bring
// list, and reading nights back. Every function takes the group; nothing crosses groups.
import { all, known, mapRead, one, readAll, rowOf, rowsOf, stmt, type DB, type Read } from './db.ts';
import { can } from './permissions.ts';
import { GAME_COLUMNS, toCatalogGame } from './catalog.ts';
import { buildSearchText, normalize } from '#lib/catalog/normalize.ts';
import { MAX_GUESTS, cleanGuestName } from '#lib/table/here.ts';
import { MAX_NIGHT_NAME, cleanTime, type Night, type NightGame, type NightPerson } from '#lib/nights.ts';
import type { CatalogGame, Role } from '#lib/catalog/types.ts';
import type { NightGameInfo } from '#lib/nights-csv.ts';
import type { GameSource } from '#lib/csv.ts';

export type Actor = { id: string; role: Role };
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
export type NightInput = { name: string; nightOn: string; startsAt: string | null; hostId: string | null };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const done: Result = { ok: true, value: undefined };
const no = (error: string): { ok: false; error: string } => ({ ok: false, error });

function validDay(value: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return false;
	const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
	return d.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}

/** The plan form: `name`, `nightOn`, an optional `startsAt` and `host` (a member id, or empty for somewhere else). */
export function parseNightForm(form: FormData): Result<NightInput> {
	const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim();
	if (!name || name.length > MAX_NIGHT_NAME || /\p{C}/u.test(name)) return no(`Give the night a name, up to ${MAX_NIGHT_NAME} characters, like “Café”.`);
	const nightOn = String(form.get('nightOn') ?? '');
	if (!validDay(nightOn)) return no('Pick the date of the night.');
	const startsAt = cleanTime(String(form.get('startsAt') ?? ''));
	if (startsAt === 'bad') return no('Give the start time as hours and minutes, like 19:30.');
	const hostId = String(form.get('host') ?? '') || null;
	return ok({ name, nightOn, startsAt, hostId });
}

async function isMember(db: DB, groupId: string, userId: string): Promise<boolean> {
	return (await one(db, 'SELECT 1 AS x FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId)) != null;
}

/** Whether this person may plan nights in the group, by the group's `nights_by` setting. */
export async function canPlanNights(db: DB, groupId: string, role: Role): Promise<boolean> {
	const row = await one<{ nights_by: string }>(db, 'SELECT nights_by FROM groups WHERE id = ?1', groupId);
	return mayPlanNights(role, row?.nights_by ?? null);
}

/** canPlanNights for a caller that already has the group's `nights_by` (the group layout's one query, D59). */
export function mayPlanNights(role: Role, nightsBy: string | null): boolean {
	return can(role, 'plan_night', { openToMembers: (nightsBy ?? 'members') === 'members' });
}

async function nightRow(db: DB, groupId: string, nightId: string) {
	return one<{ created_by: string | null }>(db, 'SELECT created_by FROM game_nights WHERE id = ?1 AND group_id = ?2', nightId, groupId);
}

/** Whoever planned the night, and co-admins and the owner. */
export function canChangeNight(actor: Actor, night: { createdBy: string | null }): boolean {
	return can(actor.role, 'change_night', { targetIsSelf: night.createdBy === actor.id });
}

/** Plans a night; whoever plans it is marked going. */
export async function createNight(db: DB, groupId: string, actor: Actor, input: NightInput, now = Date.now()): Promise<Result<string>> {
	if (!(await canPlanNights(db, groupId, actor.role))) return no('In this group, only the owner and co-admins plan game nights.');
	if (input.hostId && !(await isMember(db, groupId, input.hostId))) return no('Pick a host from the group, or “somewhere else”.');
	const id = crypto.randomUUID();
	await db.batch([
		stmt(
			db,
			'INSERT INTO game_nights (id, group_id, name, night_on, starts_at, host_id, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
			id,
			groupId,
			input.name,
			input.nightOn,
			input.startsAt,
			input.hostId,
			actor.id,
			now
		),
		stmt(db, 'INSERT INTO night_people (night_id, user_id, going) VALUES (?1, ?2, 1)', id, actor.id)
	]);
	return ok(id);
}

export async function updateNight(db: DB, groupId: string, actor: Actor, nightId: string, input: NightInput): Promise<Result> {
	const night = await nightRow(db, groupId, nightId);
	if (!night) return no('That night is gone. Reload the page.');
	if (!canChangeNight(actor, { createdBy: night.created_by })) return no('Only whoever planned the night and co-admins can change it.');
	if (input.hostId && !(await isMember(db, groupId, input.hostId))) return no('Pick a host from the group, or “somewhere else”.');
	await stmt(
		db,
		'UPDATE game_nights SET name = ?1, night_on = ?2, starts_at = ?3, host_id = ?4 WHERE id = ?5',
		input.name,
		input.nightOn,
		input.startsAt,
		input.hostId,
		nightId
	).run();
	return done;
}

/** Deletes a night and its lists. Its plays stay, as plays outside any night. */
export async function deleteNight(db: DB, groupId: string, actor: Actor, nightId: string): Promise<Result> {
	const night = await nightRow(db, groupId, nightId);
	if (!night) return no('That night is already gone.');
	if (!canChangeNight(actor, { createdBy: night.created_by })) return no('Only whoever planned the night and co-admins can delete it.');
	await db.batch([
		stmt(db, 'UPDATE plays SET night_id = NULL WHERE night_id = ?1', nightId),
		stmt(db, 'DELETE FROM night_games WHERE night_id = ?1', nightId),
		stmt(db, 'DELETE FROM night_people WHERE night_id = ?1', nightId),
		stmt(db, 'DELETE FROM game_nights WHERE id = ?1', nightId)
	]);
	return done;
}

/** Marks a member going or not. Anyone answers for themselves; the planner and co-admins for others too. */
export async function setGoing(db: DB, groupId: string, actor: Actor, nightId: string, userId: string, going: boolean): Promise<Result> {
	const night = await nightRow(db, groupId, nightId);
	if (!night) return no('That night is gone. Reload the page.');
	if (userId !== actor.id && !canChangeNight(actor, { createdBy: night.created_by })) return no('Only whoever planned the night and co-admins can answer for someone else.');
	if (!(await isMember(db, groupId, userId))) return no('That person isn’t in this group.');
	// Updated in place, so a "came" mark on the row (D67) survives a change of answer.
	await db.batch([
		stmt(db, 'UPDATE night_people SET going = ?3 WHERE night_id = ?1 AND user_id = ?2', nightId, userId, going ? 1 : 0),
		stmt(
			db,
			'INSERT INTO night_people (night_id, user_id, going) SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM night_people WHERE night_id = ?1 AND user_id = ?2)',
			nightId,
			userId,
			going ? 1 : 0
		)
	]);
	return done;
}

/** Who may say who came (D67): you for yourself, co-admins for anyone. */
export function canMarkCame(actor: Actor, userId: string | null): boolean {
	return can(actor.role, 'mark_came', { targetIsSelf: userId === actor.id });
}

/**
 * Whether a night's date has come, by the server's clock plus a day (people are ahead of UTC), so who
 * came can be checked from the night itself on.
 */
function nightHasCome(nightOn: string, now: number): boolean {
	return nightOn <= new Date(now + 30 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Marks whether a member, or a guest on the list, came to a night (D67). Anyone in a play logged on
 * the night came, so they can't be marked as not having come while that play is there.
 */
export async function setCame(
	db: DB,
	groupId: string,
	actor: Actor,
	nightId: string,
	who: { userId: string } | { guestName: string },
	came: boolean,
	now = Date.now()
): Promise<Result> {
	const userId = 'userId' in who ? who.userId : null;
	const guestName = 'guestName' in who ? who.guestName : null;
	const r = await readAll(db, {
		night: rowOf<{ night_on: string }>(db, 'SELECT night_on FROM game_nights WHERE id = ?1 AND group_id = ?2', nightId, groupId),
		member: userId ? rowOf(db, 'SELECT 1 AS x FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId) : known(null),
		guest: guestName ? rowOf(db, 'SELECT 1 AS x FROM night_people WHERE night_id = ?1 AND guest_name = ?2', nightId, guestName) : known(null),
		played: rowOf(
			db,
			`SELECT 1 AS x FROM plays p JOIN play_players pp ON pp.play_id = p.id
			 WHERE p.night_id = ?1 AND p.group_id = ?2 AND (pp.user_id = ?3 OR (?3 IS NULL AND pp.guest_name = ?4 COLLATE NOCASE))`,
			nightId,
			groupId,
			userId,
			guestName
		)
	});
	if (!r.night) return no('That night is gone. Reload the page.');
	if (!nightHasCome(r.night.night_on, now)) return no('Who came can be checked from the night itself on.');
	if (!canMarkCame(actor, userId)) return no('You can say whether you came; co-admins can for anyone.');
	if (userId && !r.member) return no('That person isn’t in this group.');
	if (guestName && !r.guest) return no('That guest isn’t on this night’s list.');
	if (!came && r.played) return no('They’re in a play logged on this night, so they were there.');
	if (guestName) {
		await stmt(db, 'UPDATE night_people SET came = ?3 WHERE night_id = ?1 AND guest_name = ?2', nightId, guestName, came ? 1 : 0).run();
		return done;
	}
	// A member who came without answering gets a row of their own; going stays as they answered.
	await db.batch([
		stmt(db, 'UPDATE night_people SET came = ?3 WHERE night_id = ?1 AND user_id = ?2', nightId, userId, came ? 1 : 0),
		stmt(
			db,
			'INSERT INTO night_people (night_id, user_id, going, came) SELECT ?1, ?2, 0, ?3 WHERE NOT EXISTS (SELECT 1 FROM night_people WHERE night_id = ?1 AND user_id = ?2)',
			nightId,
			userId,
			came ? 1 : 0
		)
	]);
	return done;
}

/** "That's right" (D67): everyone nobody has marked came if they said they'd go. Co-admins only. */
export async function confirmCame(db: DB, groupId: string, actor: Actor, nightId: string, now = Date.now()): Promise<Result> {
	const night = await one<{ night_on: string }>(db, 'SELECT night_on FROM game_nights WHERE id = ?1 AND group_id = ?2', nightId, groupId);
	if (!night) return no('That night is gone. Reload the page.');
	if (!nightHasCome(night.night_on, now)) return no('Who came can be checked from the night itself on.');
	if (!canMarkCame(actor, null)) return no('Only co-admins can check who came for everyone.');
	await stmt(db, 'UPDATE night_people SET came = going WHERE night_id = ?1 AND came IS NULL', nightId).run();
	return done;
}

/** A guest who came to a night that's been, added afterwards by a co-admin (D67). */
export async function addCameGuest(db: DB, groupId: string, actor: Actor, nightId: string, raw: unknown, now = Date.now()): Promise<Result<string>> {
	const night = await one<{ night_on: string }>(db, 'SELECT night_on FROM game_nights WHERE id = ?1 AND group_id = ?2', nightId, groupId);
	if (!night) return no('That night is gone. Reload the page.');
	if (!nightHasCome(night.night_on, now)) return no('Who came can be checked from the night itself on.');
	if (!canMarkCame(actor, null)) return no('Only co-admins can add someone who came.');
	const name = cleanGuestName(String(raw ?? ''));
	if (!name) return no('Type the guest’s name.');
	const guests = await guestsOf(db, nightId);
	if (guests.some((g) => g.toLowerCase() === name.toLowerCase())) return no(`${name} is already on the list.`);
	if (guests.length >= MAX_GUESTS) return no(`That's ${MAX_GUESTS} guests, the most a night takes.`);
	await stmt(db, 'INSERT INTO night_people (night_id, guest_name, going, came) VALUES (?1, ?2, 1, 1)', nightId, name).run();
	return ok(name);
}

async function guestsOf(db: DB, nightId: string): Promise<string[]> {
	return (await all<{ guest_name: string }>(db, 'SELECT guest_name FROM night_people WHERE night_id = ?1 AND guest_name IS NOT NULL', nightId)).map((r) => r.guest_name);
}

/** Adds a guest by name; any member can. Returns the cleaned name. */
export async function addNightGuest(db: DB, groupId: string, nightId: string, raw: unknown): Promise<Result<string>> {
	if (!(await nightRow(db, groupId, nightId))) return no('That night is gone. Reload the page.');
	const name = cleanGuestName(String(raw ?? ''));
	if (!name) return no('Type the guest’s name.');
	const guests = await guestsOf(db, nightId);
	if (guests.some((g) => g.toLowerCase() === name.toLowerCase())) return no(`${name} is already on the list.`);
	if (guests.length >= MAX_GUESTS) return no(`That's ${MAX_GUESTS} guests, the most a night takes.`);
	await stmt(db, 'INSERT INTO night_people (night_id, guest_name, going) VALUES (?1, ?2, 1)', nightId, name).run();
	return ok(name);
}

/** Takes a guest off the night, with the games they were bringing. */
export async function removeNightGuest(db: DB, groupId: string, nightId: string, name: string): Promise<Result> {
	if (!(await nightRow(db, groupId, nightId))) return no('That night is gone. Reload the page.');
	await db.batch([
		stmt(db, 'DELETE FROM night_games WHERE night_id = ?1 AND guest_name = ?2', nightId, name),
		stmt(db, 'DELETE FROM night_people WHERE night_id = ?1 AND guest_name = ?2', nightId, name)
	]);
	return done;
}

async function goingMember(db: DB, nightId: string, userId: string): Promise<boolean> {
	return (await one(db, 'SELECT 1 AS x FROM night_people WHERE night_id = ?1 AND user_id = ?2 AND going = 1', nightId, userId)) != null;
}

/** Who may add to the bring list: anyone going, plus whoever planned the night and co-admins. */
async function mayAddGames(db: DB, actor: Actor, nightId: string, createdBy: string | null): Promise<boolean> {
	return canChangeNight(actor, { createdBy }) || (await goingMember(db, nightId, actor.id));
}

/** Puts a going member's copy on the bring list (D38: anyone going may; that member can take it off). */
export async function bringCopy(db: DB, groupId: string, actor: Actor, nightId: string, gameId: number, ownerId: string): Promise<Result> {
	// Every check in one round trip, then the write (D59, D65).
	const going = 'SELECT 1 AS x FROM night_people WHERE night_id = ?1 AND user_id = ?2 AND going = 1';
	const r = await readAll(db, {
		night: rowOf<{ created_by: string | null }>(db, 'SELECT created_by FROM game_nights WHERE id = ?1 AND group_id = ?2', nightId, groupId),
		actorGoing: rowOf(db, going, nightId, actor.id),
		ownerGoing: rowOf(db, `${going} AND EXISTS (SELECT 1 FROM memberships WHERE group_id = ?3 AND user_id = ?2)`, nightId, ownerId, groupId),
		// On their shelf in this group: a copy hidden from it isn't offered (D66).
		copy: rowOf(db, 'SELECT 1 AS x FROM group_copies WHERE group_id = ?3 AND user_id = ?1 AND game_id = ?2', ownerId, gameId, groupId)
	});
	if (!r.night) return no('That night is gone. Reload the page.');
	if (!canChangeNight(actor, { createdBy: r.night.created_by }) && !r.actorGoing) return no('Mark yourself going to add games to the night.');
	if (!r.ownerGoing) return no('Only people going can bring games. Mark them going first.');
	if (!r.copy) return no('That game isn’t on their shelf.');
	const added = await stmt(
		db,
		'INSERT INTO night_games (night_id, game_id, brought_by, added_by) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(night_id, game_id) DO NOTHING',
		nightId,
		gameId,
		ownerId,
		actor.id
	).run();
	return added.meta.changes ? done : no('That game is already on the list.');
}

export type OtherGameInput = {
	title: string;
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	/** "m:<member id>" or "g:<guest name>" */
	bringer: string;
};

/**
 * A game that isn't on a going member's shelf: a guest's, or one that turned up unplanned. If the
 * group already knows a game by that exact title it's reused; otherwise a hand-entered game is made,
 * on nobody's shelf, which the group sees through this night (and its plays).
 */
export async function bringOther(db: DB, groupId: string, actor: Actor, nightId: string, input: OtherGameInput, now = Date.now()): Promise<Result> {
	const night = await nightRow(db, groupId, nightId);
	if (!night) return no('That night is gone. Reload the page.');
	if (!(await mayAddGames(db, actor, nightId, night.created_by))) return no('Mark yourself going to add games to the night.');
	const title = input.title.replace(/\s+/g, ' ').trim();
	if (!title || title.length > 120 || /\p{C}/u.test(title)) return no('Type the game’s name, up to 120 characters.');

	let broughtBy: string | null = null;
	let guestName: string | null = null;
	if (input.bringer.startsWith('m:')) {
		broughtBy = input.bringer.slice(2);
		if (!(await goingMember(db, nightId, broughtBy))) return no('Pick who’s bringing it from the people going.');
	} else if (input.bringer.startsWith('g:')) {
		const name = input.bringer.slice(2);
		guestName = (await guestsOf(db, nightId)).find((g) => g === name) ?? null;
		if (!guestName) return no('Pick who’s bringing it from the people going.');
	} else return no('Say who’s bringing it.');

	// A game the group already sees under exactly this title: on a member's shelf or an earlier night.
	const known = await one<{ id: number }>(
		db,
		`SELECT g.id FROM games g
		 WHERE instr('|' || g.search_text || '|', '|' || ?2 || '|') > 0 AND (
			EXISTS (SELECT 1 FROM group_copies gc WHERE gc.group_id = ?1 AND gc.game_id = g.id)
			OR EXISTS (SELECT 1 FROM night_games ng JOIN game_nights n ON n.id = ng.night_id AND n.group_id = ?1 WHERE ng.game_id = g.id))
		 ORDER BY g.id LIMIT 1`,
		groupId,
		normalize(title)
	);
	if (known) {
		if (await one(db, 'SELECT 1 AS x FROM night_games WHERE night_id = ?1 AND game_id = ?2', nightId, known.id)) return no('That game is already on the list.');
		await stmt(
			db,
			'INSERT INTO night_games (night_id, game_id, brought_by, guest_name, added_by) VALUES (?1, ?2, ?3, ?4, ?5)',
			nightId,
			known.id,
			broughtBy,
			guestName,
			actor.id
		).run();
		return done;
	}
	await db.batch([
		stmt(
			db,
			`INSERT INTO games (name, search_text, min_players, max_players, min_playtime, max_playtime, is_manual, source, created_by, fetched_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 'manual', ?7, ?8)`,
			title,
			buildSearchText(title),
			input.minPlayers,
			input.maxPlayers,
			input.minPlaytime,
			input.maxPlaytime,
			actor.id,
			now
		),
		stmt(
			db,
			'INSERT INTO night_games (night_id, game_id, brought_by, guest_name, added_by) VALUES (?1, last_insert_rowid(), ?2, ?3, ?4)',
			nightId,
			broughtBy,
			guestName,
			actor.id
		)
	]);
	return done;
}

/** Takes a game off the list: whoever brings it or added it, whoever planned the night, co-admins. */
export async function unbring(db: DB, groupId: string, actor: Actor, nightId: string, gameId: number): Promise<Result> {
	const night = await nightRow(db, groupId, nightId);
	if (!night) return no('That night is gone. Reload the page.');
	const row = await one<{ brought_by: string | null; added_by: string | null }>(
		db,
		'SELECT brought_by, added_by FROM night_games WHERE night_id = ?1 AND game_id = ?2',
		nightId,
		gameId
	);
	if (!row) return no('That game is already off the list.');
	const own = row.brought_by === actor.id || row.added_by === actor.id;
	if (!own && !canChangeNight(actor, { createdBy: night.created_by })) return no('Only whoever brings or added it, whoever planned the night and co-admins can take it off.');
	await stmt(db, 'DELETE FROM night_games WHERE night_id = ?1 AND game_id = ?2', nightId, gameId).run();
	return done;
}

/** On the night: a game that stayed home, or turned up after all. Any member can tick it. */
export async function setStayedHome(db: DB, groupId: string, nightId: string, gameId: number, stayedHome: boolean): Promise<Result> {
	if (!(await nightRow(db, groupId, nightId))) return no('That night is gone. Reload the page.');
	await stmt(db, 'UPDATE night_games SET stayed_home = ?1 WHERE night_id = ?2 AND game_id = ?3', stayedHome ? 1 : 0, nightId, gameId).run();
	return done;
}

export async function setNightPlanners(db: DB, groupId: string, actor: Actor, value: unknown): Promise<Result> {
	if (!can(actor.role, 'set_night_planners')) return no('Only co-admins and the owner can change who plans nights.');
	if (value !== 'members' && value !== 'admins') return no('Pick who can plan game nights.');
	await stmt(db, 'UPDATE groups SET nights_by = ?1 WHERE id = ?2', value, groupId).run();
	return done;
}

export type NightQuery = { from?: string; to?: string; id?: string };

type NightRow = { id: string; name: string; night_on: string; starts_at: string | null; host_id: string | null; created_by: string | null };
type NightPersonRow = { night_id: string; user_id: string | null; guest_name: string | null; going: number; came: number | null };
type NightGameRow = { night_id: string; game_id: number; brought_by: string | null; guest_name: string | null; added_by: string | null; stayed_home: number };
export type NightReads = { nights: Read<NightRow[]>; people: Read<NightPersonRow[]>; games: Read<NightGameRow[]> };

/** Nights with their people and games, by date and then time. Three reads in one round trip, whatever the count. */
export async function loadNights(db: DB, groupId: string, q: NightQuery = {}): Promise<Night[]> {
	const { nights, people, games } = await readAll(db, nightReads(db, groupId, q));
	return assembleNights(nights, people, games);
}

/** loadNights' three reads, for a caller batching them with others (`readAll`, D59); then `assembleNights`. */
export function nightReads(db: DB, groupId: string, q: NightQuery = {}): NightReads {
	const params: unknown[] = [groupId];
	const where = ['group_id = ?1'];
	if (q.from) where.push(`night_on >= ?${params.push(q.from)}`);
	if (q.to) where.push(`night_on <= ?${params.push(q.to)}`);
	if (q.id) where.push(`id = ?${params.push(q.id)}`);
	const ids = `SELECT id FROM game_nights WHERE ${where.join(' AND ')}`;
	return {
		nights: rowsOf<NightRow>(
			db,
			`SELECT id, name, night_on, starts_at, host_id, created_by FROM game_nights WHERE ${where.join(' AND ')}
			 ORDER BY night_on, starts_at, created_at`,
			...params
		),
		people: rowsOf<NightPersonRow>(db, `SELECT night_id, user_id, guest_name, going, came FROM night_people WHERE night_id IN (${ids}) ORDER BY rowid`, ...params),
		games: rowsOf<NightGameRow>(
			db,
			`SELECT night_id, game_id, brought_by, guest_name, added_by, stayed_home FROM night_games WHERE night_id IN (${ids}) ORDER BY rowid`,
			...params
		)
	};
}

export function assembleNights(nights: NightRow[], people: NightPersonRow[], games: NightGameRow[]): Night[] {
	const peopleBy = new Map<string, NightPerson[]>();
	for (const p of people) peopleBy.set(p.night_id, [...(peopleBy.get(p.night_id) ?? []), { userId: p.user_id, guestName: p.guest_name, going: p.going === 1, came: p.came == null ? null : p.came === 1 }]);
	const gamesBy = new Map<string, NightGame[]>();
	for (const g of games)
		gamesBy.set(g.night_id, [
			...(gamesBy.get(g.night_id) ?? []),
			{ gameId: g.game_id, broughtBy: g.brought_by, guestName: g.guest_name, addedBy: g.added_by, stayedHome: g.stayed_home === 1 }
		]);
	return nights.map((n) => ({
		id: n.id,
		name: n.name,
		nightOn: n.night_on,
		startsAt: n.starts_at,
		hostId: n.host_id,
		createdBy: n.created_by,
		people: peopleBy.get(n.id) ?? [],
		games: gamesBy.get(n.id) ?? []
	}));
}

/**
 * Details of games on these nights that no member of the group has on a shelf (a guest's, or one
 * that turned up), shaped like catalog games so the picker can use them. Their one copy belongs to
 * nobody in the group.
 */
export async function nightOnlyGames(db: DB, groupId: string, nightIds: string[]): Promise<CatalogGame[]> {
	return (await readAll(db, { g: nightOnlyGamesRead(db, groupId, { ids: nightIds }) })).g;
}

/**
 * nightOnlyGames as a read (D59), for these nights or for the group's nights between two days, so a
 * caller can batch it before knowing which nights there are (D65).
 */
export function nightOnlyGamesRead(db: DB, groupId: string, nights: { ids: string[] } | { from: string; to: string }): Read<CatalogGame[]> {
	let which: string;
	let params: unknown[];
	if ('ids' in nights) {
		if (nights.ids.length === 0) return known([]);
		const ids = nights.ids.slice(0, 90);
		which = `ng.night_id IN (${ids.map((_, i) => `?${i + 2}`).join(', ')})`;
		params = ids;
	} else {
		which = 'ng.night_id IN (SELECT id FROM game_nights WHERE group_id = ?1 AND night_on BETWEEN ?2 AND ?3)';
		params = [nights.from, nights.to];
	}
	return mapRead(
		rowsOf<Parameters<typeof toCatalogGame>[0]>(
			db,
			`SELECT DISTINCT ${GAME_COLUMNS} FROM night_games ng JOIN games g ON g.id = ng.game_id
			 WHERE ${which}
			   AND NOT EXISTS (SELECT 1 FROM group_copies gc WHERE gc.group_id = ?1 AND gc.game_id = g.id)`,
			groupId,
			...params
		),
		(rows) => rows.map((r) => ({ ...toCatalogGame(r), lastPlayed: null, copies: [{ ownerId: 'guest', lentToUserId: null, lentOut: false, addedAt: 0 }] }))
	);
}

/** Whether a game is on a night's bring list, for logging a play of a guest's game (D38). */
export async function gameOnNight(db: DB, groupId: string, nightId: string, gameId: number): Promise<boolean> {
	return (
		(await one(
			db,
			'SELECT 1 AS x FROM night_games ng JOIN game_nights n ON n.id = ng.night_id WHERE n.group_id = ?1 AND ng.night_id = ?2 AND ng.game_id = ?3',
			groupId,
			nightId,
			gameId
		)) != null
	);
}

/** A night's date (YYYY-MM-DD), or null when it isn't this group's. */
export async function nightDay(db: DB, groupId: string, nightId: string): Promise<string | null> {
	return (await one<{ night_on: string }>(db, 'SELECT night_on FROM game_nights WHERE id = ?1 AND group_id = ?2', nightId, groupId))?.night_on ?? null;
}

/** The group's nights up to `until` (YYYY-MM-DD), newest first: what a play can be put on (STATUS item 42). */
export function nightListRead(db: DB, groupId: string, until: string): Read<Array<{ id: string; name: string; nightOn: string }>> {
	return mapRead(
		rowsOf<{ id: string; name: string; night_on: string }>(
			db,
			'SELECT id, name, night_on FROM game_nights WHERE group_id = ?1 AND night_on <= ?2 ORDER BY night_on DESC, starts_at LIMIT 500',
			groupId,
			until
		),
		(rows) => rows.map((r) => ({ id: r.id, name: r.name, nightOn: r.night_on }))
	);
}

/**
 * Names and sources of the games on this group's bring lists, for the nights export: with the group's
 * own corrections, as the plays export names them. One query, however many nights.
 */
export async function nightGameInfo(db: DB, groupId: string): Promise<Map<number, NightGameInfo>> {
	const rows = await all<{ id: number; name: string; source: GameSource; bgg_id: number | null }>(
		db,
		`SELECT g.id, COALESCE(gc.name, g.name) AS name, g.source, g.bgg_id
		 FROM games g LEFT JOIN game_corrections gc ON gc.group_id = ?1 AND gc.game_id = g.id
		 WHERE g.id IN (SELECT ng.game_id FROM night_games ng JOIN game_nights n ON n.id = ng.night_id WHERE n.group_id = ?1)`,
		groupId
	);
	return new Map(rows.map((r) => [r.id, { name: r.name, source: r.source, bggId: r.bgg_id }]));
}
