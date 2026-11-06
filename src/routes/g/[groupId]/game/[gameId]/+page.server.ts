import { error } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { all, jsonArray, one } from '#lib/server/db.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PollSource } from '#lib/catalog/types.ts';
import type { PageServerLoad } from './$types';

type GameDetail = {
	id: number;
	bgg_id: number | null;
	name: string;
	year: number | null;
	description: string | null;
	image_url: string | null;
	thumb_url: string | null;
	min_players: number | null;
	max_players: number | null;
	best_mask: number;
	rec_mask: number;
	poll_source: PollSource;
	min_playtime: number | null;
	max_playtime: number | null;
	weight: number | null;
	mechanics: string;
	categories: string;
	base_bgg_ids: string;
	is_expansion: number;
	is_manual: number;
	fetched_at: number | null;
};

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	await requireRead(event, db, groupId);

	const gameId = Number(event.params.gameId);
	if (!Number.isInteger(gameId) || gameId <= 0) error(404, 'Game not found');

	// Only games this group owns or wants are visible here: the cache is shared across groups, and
	// hand-entered titles from other groups shouldn't be readable by guessing ids.
	const game = await one<GameDetail>(
		db,
		`SELECT g.* FROM games g WHERE g.id = ?2 AND (
			EXISTS (SELECT 1 FROM copies c JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1 WHERE c.game_id = g.id)
			OR EXISTS (SELECT 1 FROM wishlist w JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1 WHERE w.game_id = g.id))`,
		groupId,
		gameId
	);
	if (!game) error(404, 'Game not found');

	const [owners, wishers, links, expansions, bases] = await Promise.all([
		all<{ user_id: string; name: string; note: string | null; lent_to_name: string | null; lent_to_text: string | null; lent_in_group: number }>(
			db,
			`SELECT c.user_id, u.name, c.note, lu.name AS lent_to_name, c.lent_to_text,
				EXISTS (SELECT 1 FROM memberships lm WHERE lm.group_id = ?1 AND lm.user_id = c.lent_to_user_id) AS lent_in_group
			 FROM copies c
			 JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1
			 JOIN users u ON u.id = c.user_id
			 LEFT JOIN users lu ON lu.id = c.lent_to_user_id
			 WHERE c.game_id = ?2
			 ORDER BY u.name`,
			groupId,
			gameId
		),
		all<{ name: string }>(
			db,
			`SELECT u.name FROM wishlist w
			 JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1
			 JOIN users u ON u.id = w.user_id
			 WHERE w.game_id = ?2 ORDER BY u.name`,
			groupId,
			gameId
		),
		all<{ id: number; kind: 'rules' | 'video' | 'other'; title: string | null; url: string; added_by_name: string | null }>(
			db,
			`SELECT l.id, l.kind, l.title, l.url, u.name AS added_by_name
			 FROM game_links l LEFT JOIN users u ON u.id = l.added_by
			 WHERE l.group_id = ?1 AND l.game_id = ?2 ORDER BY l.kind, l.added_at`,
			groupId,
			gameId
		),
		game.bgg_id == null
			? Promise.resolve([])
			: all<{ id: number; name: string; year: number | null }>(
					db,
					`SELECT DISTINCT g.id, g.name, g.year
					 FROM games g, json_each(g.base_bgg_ids) j
					 JOIN copies c ON c.game_id = g.id
					 JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1
					 WHERE g.is_expansion = 1 AND j.value = ?2
					 ORDER BY g.name`,
					groupId,
					game.bgg_id
				),
		game.is_expansion
			? all<{ id: number; name: string; bgg_id: number }>(
					db,
					'SELECT id, name, bgg_id FROM games WHERE bgg_id IN (SELECT value FROM json_each(?1))',
					game.base_bgg_ids
				)
			: Promise.resolve([])
	]);

	return {
		game: {
			id: game.id,
			bggId: game.bgg_id,
			name: game.name,
			year: game.year,
			description: game.description,
			imageUrl: game.image_url ?? game.thumb_url,
			minPlayers: game.min_players,
			maxPlayers: game.max_players,
			bestMask: game.best_mask,
			recMask: game.rec_mask,
			pollSource: game.poll_source,
			minPlaytime: game.min_playtime,
			maxPlaytime: game.max_playtime,
			weight: game.weight,
			mechanics: jsonArray<string>(game.mechanics),
			categories: jsonArray<string>(game.categories),
			isExpansion: game.is_expansion === 1,
			isManual: game.is_manual === 1,
			detailsPending: game.bgg_id != null && game.fetched_at == null
		},
		owners: owners.map((o) => ({
			name: o.name,
			note: o.note,
			status: o.lent_to_text
				? `Lent to ${o.lent_to_text}`
				: o.lent_to_name
					? o.lent_in_group
						? `With ${o.lent_to_name}`
						: `Lent to ${o.lent_to_name}`
					: null
		})),
		wishers: wishers.map((w) => w.name),
		links,
		expansions,
		bases: bases.map((b) => ({ id: b.id, name: b.name }))
	};
};
