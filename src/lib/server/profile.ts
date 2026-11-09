// The reads behind a member's profile (D61): only what the group already sees. Their games are
// `group_copies` (D66), so a copy hidden from this group stays hidden here; hearts count only for games
// on this group's shelf, as the shelf's filter shows them; their wishlist only as games nobody in the
// group has, as on the Wanted tab; and plays and nights only from this group. Nothing from another group.
import { GAME_COLUMNS, toCatalogGame, type GameRow } from './catalog.ts';
import { applyCorrection, correctionsRead, type Correction } from './corrections.ts';
import { known, rowOf, rowsOf, type DB, type Read } from './db.ts';
import { activeMark, PLAY_SOON_MS } from './interest.ts';
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

type FlagRow = GameRow & { subject_owns: number; subject_loves: number; viewer_loves: number; played_here: number; viewer_played: number };
type CopyRow = { game_id: number; owner_id: string; lent_to_user_id: string | null; lent_to_text: string | null; added_at: number };

/**
 * Everything a profile reads, for one `readAll` after the access check (D59): five statements, the same
 * whoever's looking. `today` is YYYY-MM-DD: nights up to it count as been.
 */
export function profileReads(db: DB, groupId: string, subjectId: string, viewerId: string | null, today: string, now: number) {
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
			`SELECT c.game_id, c.user_id AS owner_id, c.lent_to_user_id, c.lent_to_text, c.added_at
			 FROM group_copies c WHERE c.group_id = ?1 AND c.game_id IN (${PROFILE_GAMES})
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
		// The group's nights since they joined (and any before, from guest plays taken over, D37) up to today.
		nightRows: rowsOf<{ night_on: string; subject_went: number; viewer_went: number }>(
			db,
			`SELECT n.night_on,
			   EXISTS (SELECT 1 FROM night_people np WHERE np.night_id = n.id AND np.user_id = ?2 AND np.going = 1) AS subject_went,
			   EXISTS (SELECT 1 FROM night_people np WHERE np.night_id = n.id AND np.user_id = ?3 AND np.going = 1) AS viewer_went
			 FROM game_nights n
			 WHERE n.group_id = ?1 AND n.night_on <= ?4
			   AND (n.night_on >= (SELECT date(m.joined_at / 1000, 'unixepoch') FROM memberships m WHERE m.group_id = ?1 AND m.user_id = ?2)
			        OR EXISTS (SELECT 1 FROM night_people np WHERE np.night_id = n.id AND np.user_id = ?2 AND np.going = 1))
			 ORDER BY n.night_on`,
			groupId,
			subjectId,
			viewerId,
			today
		),
		// Only on your own profile: your live Play soon marks on games on this shelf (D64), with when each ends.
		playSoonRows:
			viewerId === subjectId
				? rowsOf<{ game_id: number; marked_at: number; name: string }>(
						db,
						`SELECT s.game_id, s.marked_at, COALESCE(gc.name, g.name) AS name
						 FROM play_soon s JOIN games g ON g.id = s.game_id
						 LEFT JOIN game_corrections gc ON gc.group_id = ?1 AND gc.game_id = s.game_id
						 WHERE s.user_id = ?2 AND EXISTS (SELECT 1 FROM group_copies c WHERE c.group_id = ?1 AND c.game_id = s.game_id)
						   AND ${activeMark('?3')}
						 ORDER BY s.marked_at`,
						groupId,
						subjectId,
						now
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

export function assembleNightsBeen(rows: Array<{ night_on: string; subject_went: number; viewer_went: number }>): ProfileNight[] {
	return rows.map((r) => ({ nightOn: r.night_on, subjectWent: r.subject_went === 1, viewerWent: r.viewer_went === 1 }));
}

export function assemblePlaySoon(rows: Array<{ game_id: number; marked_at: number; name: string }>): PlaySoonHere[] {
	return rows.map((r) => ({ gameId: r.game_id, name: r.name, until: r.marked_at + PLAY_SOON_MS }));
}
