// What Your account lets a person download (PRD "Account"): their games, wishlist, favourites and Play
// soon list here, and links to their plays on each group's plays page.
import { all, type DB } from './db.ts';
import { activeMark, playSoonSince } from './interest.ts';
import type { PlaySoonRule } from './instance.ts';
import type { YourGame } from '#lib/games-csv.ts';
import type { GameSource } from '#lib/csv.ts';

type Row = {
	list: YourGame['list'];
	name: string;
	year: number | null;
	source: GameSource;
	bgg_id: number | null;
	wikidata_id: string | null;
	min_players: number | null;
	max_players: number | null;
	min_playtime: number | null;
	max_playtime: number | null;
	added_at: number;
	lent_to: string | null;
	note: string | null;
};

/** The person's copies, wishes, favourites, live Play soon marks and copies hidden from a group (D66), with the game as stored (not any one group's corrections). */
export async function loadYourGames(db: DB, userId: string, now: number, playSoon: PlaySoonRule): Promise<YourGame[]> {
	const game = 'g.name, g.year, g.source, g.bgg_id, g.wikidata_id, g.min_players, g.max_players, g.min_playtime, g.max_playtime';
	const rows = await all<Row>(
		db,
		`SELECT 'shelf' AS list, ${game}, c.added_at, COALESCE(lu.name, c.lent_to_text) AS lent_to, c.note
		 FROM copies c JOIN games g ON g.id = c.game_id LEFT JOIN users lu ON lu.id = c.lent_to_user_id
		 WHERE c.user_id = ?1
		 UNION ALL
		 SELECT 'wishlist' AS list, ${game}, w.added_at, NULL AS lent_to, NULL AS note
		 FROM wishlist w JOIN games g ON g.id = w.game_id
		 WHERE w.user_id = ?1
		 UNION ALL
		 SELECT 'favourite' AS list, ${game}, f.added_at, NULL AS lent_to, NULL AS note
		 FROM favourites f JOIN games g ON g.id = f.game_id
		 WHERE f.user_id = ?1
		 UNION ALL
		 SELECT 'play soon' AS list, ${game}, s.marked_at, NULL AS lent_to, NULL AS note
		 FROM play_soon s JOIN games g ON g.id = s.game_id
		 WHERE s.user_id = ?1 AND ${activeMark('?2', '?3')}
		 UNION ALL
		 SELECT 'hidden' AS list, ${game}, h.hidden_at, NULL AS lent_to, 'from ' || gr.name AS note
		 FROM hidden_copies h JOIN games g ON g.id = h.game_id JOIN groups gr ON gr.id = h.group_id
		 WHERE h.user_id = ?1`,
		userId,
		now,
		playSoonSince(now, playSoon)
	);
	return rows.map((r) => ({
		list: r.list,
		name: r.name,
		year: r.year,
		source: r.source,
		bggId: r.bgg_id,
		wikidataId: r.wikidata_id,
		minPlayers: r.min_players,
		maxPlayers: r.max_players,
		minPlaytime: r.min_playtime,
		maxPlaytime: r.max_playtime,
		addedAt: r.added_at,
		lentTo: r.lent_to,
		note: r.note
	}));
}
