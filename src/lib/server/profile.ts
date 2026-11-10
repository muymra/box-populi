// The reads behind a member's profile (D61): only what the group already sees. Their games are
// `group_copies` (D66), so a copy hidden from this group stays hidden here; hearts count only for games
// on this group's shelf, as the shelf's filter shows them; their wishlist only as games nobody in the
// group has, as on the Wanted tab; and plays and nights only from this group. Nothing from another group.
import { GAME_COLUMNS, toCatalogGame, type GameRow } from './catalog.ts';
import { applyCorrection, correctionsRead, type Correction } from './corrections.ts';
import { known, rowOf, rowsOf, type DB, type Read } from './db.ts';
import { activeMark, markUntil, playSoonSince, setFavourite, setPlaySoon } from './interest.ts';
import type { PlaySoonRule } from './instance.ts';
import { addWish, removeWish } from './wishlist.ts';
import { OWN_MARKS, type OwnMark } from '#lib/profile.ts';
import type { CatalogGame, Role } from '#lib/catalog/types.ts';

/** A game a profile shows from the group's shelf, with how it stands with the person and the viewer. */
export type ProfileGame = CatalogGame & {
	subjectOwns: boolean;
	subjectLoves: boolean;
	viewerLoves: boolean;
	/** Anyone in this group has logged a play of it. */
	playedHere: boolean;
	/** The viewer has played it in this group. */
	viewerPlayed: boolean;
};

export type ProfileWant = { id: number; name: string; thumbUrl: string | null; isExpansion: boolean; viewerWants: boolean };
export type ProfileNight = { nightOn: string; subjectWent: boolean; viewerWent: boolean };
export type PlaySoonHere = { gameId: number; name: string; until: number };

// ?1 the group, ?2 the person, ?3 the viewer (null for a visitor to the demo): the person's copies on
// the shelf here, and the games on the shelf they hearted.
const PROFILE_GAMES = `SELECT c.game_id FROM group_copies c WHERE c.group_id = ?1 AND c.user_id = ?2
	UNION SELECT f.game_id FROM favourites f
	WHERE f.user_id = ?2 AND EXISTS (SELECT 1 FROM group_copies c WHERE c.group_id = ?1 AND c.game_id = f.game_id)`;

type NightMarkRow = { id: string; night_on: string; subject_mark: number | null; viewer_mark: number | null };
type FlagRow = GameRow & { subject_owns: number; subject_loves: number; viewer_loves: number; played_here: number; viewer_played: number };
type CopyRow = { game_id: number; owner_id: string; lent_to_user_id: string | null; lent_to_text: string | null; added_at: number };

/**
 * Everything a profile reads, for one `readAll` after the access check (D59): up to eight statements.
 * `today` is YYYY-MM-DD: nights up to it count as been.
 */
export function profileReads(db: DB, groupId: string, subjectId: string, viewerId: string | null, today: string, now: number, playSoon: PlaySoonRule) {
	return {
		membership: rowOf<{ role: Role; joined_at: number }>(db, 'SELECT role, joined_at FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, subjectId),
		gameRows: rowsOf<FlagRow>(
			db,
			`SELECT ${GAME_COLUMNS},
			   EXISTS (SELECT 1 FROM group_copies c WHERE c.group_id = ?1 AND c.user_id = ?2 AND c.game_id = g.id) AS subject_owns,
			   EXISTS (SELECT 1 FROM favourites f WHERE f.user_id = ?2 AND f.game_id = g.id) AS subject_loves,
			   EXISTS (SELECT 1 FROM favourites f WHERE f.user_id = ?3 AND f.game_id = g.id) AS viewer_loves,
			   EXISTS (SELECT 1 FROM plays p WHERE p.group_id = ?1 AND p.game_id = g.id) AS played_here,
			   EXISTS (SELECT 1 FROM plays p CROSS JOIN play_players pp
			           WHERE p.group_id = ?1 AND p.game_id = g.id AND pp.play_id = p.id AND +pp.user_id = ?3) AS viewer_played
			 FROM games g WHERE g.id IN (${PROFILE_GAMES})
			 ORDER BY g.id`,
			groupId,
			subjectId,
			viewerId
		),
		copyRows: rowsOf<CopyRow>(
			db,
			// From the profile's games to their copies: led by members instead, SQLite probed every member's
			// copies for every game, about 32,000 rows for a heavy player at the planned scale (D70).
			`SELECT c.game_id, c.user_id AS owner_id, c.lent_to_user_id, c.lent_to_text, c.added_at
			 FROM (${PROFILE_GAMES}) ids CROSS JOIN group_copies c
			 WHERE c.group_id = ?1 AND c.game_id = ids.game_id
			 ORDER BY c.game_id, c.id`,
			groupId,
			subjectId
		),
		corrections: correctionsRead(db, groupId),
		// Their wishlist as the Wanted tab has it: games nobody in the group has. Newest wish first.
		wantRows: rowsOf<GameRow & { viewer_wants: number }>(
			db,
			`SELECT ${GAME_COLUMNS}, EXISTS (SELECT 1 FROM wishlist v WHERE v.user_id = ?3 AND v.game_id = g.id) AS viewer_wants
			 FROM wishlist w JOIN games g ON g.id = w.game_id
			 WHERE w.user_id = ?2 AND NOT EXISTS (SELECT 1 FROM group_copies c WHERE c.group_id = ?1 AND c.game_id = w.game_id)
			 ORDER BY w.added_at DESC`,
			groupId,
			subjectId,
			viewerId
		),
		// The group's nights up to today, with the person's and the viewer's mark on each: came, or,
		// unmarked, going (D67). Being in a play logged on a night also counts; that part comes from their
		// plays, so this asks only night_people, two probes a night (D70). assembleNightsBeen keeps the
		// nights since they joined, and any before that they came to (guest plays taken over, D37).
		nightRows: rowsOf<NightMarkRow>(
			db,
			`SELECT n.id, n.night_on,
			   (SELECT COALESCE(np.came, np.going) FROM night_people np WHERE np.night_id = n.id AND np.user_id = ?2) AS subject_mark,
			   (SELECT COALESCE(np.came, np.going) FROM night_people np WHERE np.night_id = n.id AND np.user_id = ?3) AS viewer_mark
			 FROM game_nights n
			 WHERE n.group_id = ?1 AND n.night_on <= ?4
			 ORDER BY n.night_on`,
			groupId,
			subjectId,
			viewerId,
			today
		),
		// The nights the viewer played at, for "nights you both went to"; the person's come from their plays.
		viewerPlayNights:
			viewerId && viewerId !== subjectId
				? rowsOf<{ night_id: string }>(
						db,
						`SELECT DISTINCT p.night_id FROM play_players pp CROSS JOIN plays p
						 WHERE pp.user_id = ?2 AND p.id = pp.play_id AND p.group_id = ?1 AND p.night_id IS NOT NULL`,
						groupId,
						viewerId
					)
				: (known([]) as Read<Array<{ night_id: string }>>),
		// Only on your own profile: your live Play soon marks on games on this shelf (D64), with when each ends.
		playSoonRows:
			viewerId === subjectId
				? rowsOf<{ game_id: number; marked_at: number; name: string }>(
						db,
						`SELECT s.game_id, s.marked_at, COALESCE(gc.name, g.name) AS name
						 FROM play_soon s JOIN games g ON g.id = s.game_id
						 LEFT JOIN game_corrections gc ON gc.group_id = ?1 AND gc.game_id = s.game_id
						 WHERE s.user_id = ?2 AND EXISTS (SELECT 1 FROM group_copies c WHERE c.group_id = ?1 AND c.game_id = s.game_id)
						   AND ${activeMark('?3', '?4')}
						 ORDER BY s.marked_at`,
						groupId,
						subjectId,
						now,
						playSoonSince(now, playSoon)
					)
				: (known([]) as Read<Array<{ game_id: number; marked_at: number; name: string }>>)
	};
}

/** The profile's games as the shelf's cubes draw them, with the group's own corrections. */
export function assembleProfileGames(rows: FlagRow[], copies: CopyRow[], corrections: Map<number, Correction>): ProfileGame[] {
	const games = new Map<number, ProfileGame>();
	for (const row of rows) {
		games.set(row.id, {
			...toCatalogGame(applyCorrection(row, corrections.get(row.id))),
			copies: [],
			subjectOwns: row.subject_owns === 1,
			subjectLoves: row.subject_loves === 1,
			viewerLoves: row.viewer_loves === 1,
			playedHere: row.played_here === 1,
			viewerPlayed: row.viewer_played === 1
		});
	}
	for (const c of copies) {
		games.get(c.game_id)?.copies.push({ ownerId: c.owner_id, lentToUserId: c.lent_to_user_id, lentOut: c.lent_to_text != null, addedAt: c.added_at });
	}
	return [...games.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function assembleWants(rows: Array<GameRow & { viewer_wants: number }>, corrections: Map<number, Correction>): ProfileWant[] {
	return rows.map((row) => {
		const g = toCatalogGame(applyCorrection(row, corrections.get(row.id)));
		return { id: g.id, name: g.name, thumbUrl: g.thumbUrl, isExpansion: g.isExpansion, viewerWants: row.viewer_wants === 1 };
	});
}

/**
 * The nights a profile counts, from `nightRows`: since the person joined, and any before that they came
 * to. Someone came if they're marked as having come (or, unmarked, said they'd go), or played there.
 */
export function assembleNightsBeen(
	rows: NightMarkRow[],
	joinedAt: number,
	subjectPlayed: ReadonlySet<string>,
	viewerPlayed: ReadonlySet<string>
): ProfileNight[] {
	const joined = new Date(joinedAt).toISOString().slice(0, 10);
	return rows.flatMap((r) => {
		const subjectWent = r.subject_mark === 1 || subjectPlayed.has(r.id);
		if (r.night_on < joined && !subjectWent) return [];
		return [{ nightOn: r.night_on, subjectWent, viewerWent: r.viewer_mark === 1 || viewerPlayed.has(r.id) }];
	});
}

export function assemblePlaySoon(rows: Array<{ game_id: number; marked_at: number; name: string }>, rule: PlaySoonRule): PlaySoonHere[] {
	return rows.map((r) => ({ gameId: r.game_id, name: r.name, until: markUntil(r.marked_at, rule) }));
}

export type OwnMarkResult = { ok: true } | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Takes one of your own marks off a game, or puts it back, from your profile: a favourite, a Play soon
 * mark or a wish. Only on your own page: `profileId` must be `userId`, the person signed in. Putting one
 * back follows the game page's rules: a favourite only for a game on this shelf, Play soon under its cap
 * (and marked again, so its days restart), a wish only for a game this person may add here.
 */
export async function setOwnMark(
	db: DB,
	groupId: string,
	userId: string,
	profileId: string,
	mark: { kind: unknown; gameId: number; on: boolean },
	now: number,
	playSoon: PlaySoonRule
): Promise<OwnMarkResult> {
	if (profileId !== userId) return { ok: false, status: 403, error: 'Only on your own profile.' };
	if (!OWN_MARKS.includes(mark.kind as OwnMark)) return { ok: false, status: 400, error: 'Unknown kind of mark.' };
	const { gameId, on } = mark;
	switch (mark.kind as OwnMark) {
		case 'favourite':
			return (await setFavourite(db, groupId, userId, gameId, on, now)) ? { ok: true } : { ok: false, status: 404, error: 'That game isn’t on the shelf here any more.' };
		case 'playSoon': {
			const result = await setPlaySoon(db, groupId, userId, gameId, on, now, playSoon);
			return result.ok ? result : { ok: false, status: 400, error: result.error };
		}
		case 'want':
			if (!on) {
				await removeWish(db, userId, gameId);
				return { ok: true };
			}
			return (await addWish(db, groupId, userId, gameId, now)) ? { ok: true } : { ok: false, status: 404, error: 'That game can’t go back on your wants from here.' };
	}
}
