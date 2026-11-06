import { error, fail, redirect } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { addCopy, gameUsableInGroup, gameVisibleInGroup, removeCopy } from '#lib/server/games.ts';
import { addLink, canDeleteLink, deleteLink, parseLink } from '#lib/server/links.ts';
import { addWish, removeWish } from '#lib/server/wishlist.ts';
import { lendCopy, returnCopy } from '#lib/server/lending.ts';
import { canEditGame, editGame } from '#lib/server/game-edit.ts';
import { linkHost } from '#lib/link-kinds.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { all, jsonArray, one } from '#lib/server/db.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PollSource } from '#lib/catalog/types.ts';
import type { Actions, PageServerLoad } from './$types';

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
	source: 'bgg' | 'wikidata' | 'manual';
	wikidata_id: string | null;
	edited_by: string | null;
	edited_at: number | null;
};

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);

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

	const [owners, wishers, links, expansions, bases, members] = await Promise.all([
		all<{ user_id: string; name: string; lent_to_name: string | null; lent_to_text: string | null; lent_in_group: number }>(
			db,
			`SELECT c.user_id, u.name, lu.name AS lent_to_name, c.lent_to_text,
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
		all<{ id: string; name: string }>(
			db,
			`SELECT u.id, u.name FROM wishlist w
			 JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1
			 JOIN users u ON u.id = w.user_id
			 WHERE w.game_id = ?2
			   AND NOT EXISTS (SELECT 1 FROM copies c WHERE c.user_id = w.user_id AND c.game_id = w.game_id)
			 ORDER BY u.name`,
			groupId,
			gameId
		),
		all<{ id: number; kind: 'rules' | 'video' | 'other'; title: string | null; url: string; added_by: string | null; added_by_name: string | null }>(
			db,
			`SELECT l.id, l.kind, l.title, l.url, l.added_by, u.name AS added_by_name
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
			: Promise.resolve([]),
		loadMembers(db, groupId)
	]);
	const colorOf = new Map(members.map((m) => [m.id, m.colorIndex]));

	const me = event.locals.user;
	const canEdit = access.role != null && !access.readonly;
	const actor = me && access.role ? { id: me.id, role: access.role } : null;
	const myCopy = me
		? await one<{ lent_to_user_id: string | null; lent_to_text: string | null }>(
				db,
				'SELECT lent_to_user_id, lent_to_text FROM copies WHERE user_id = ?1 AND game_id = ?2',
				me.id,
				gameId
			)
		: null;
	const mine = myCopy != null;
	const canEditDetails = canEdit && actor != null && (await canEditGame(db, groupId, actor, gameId));
	// A game is one row shared by every group, so its editor may be in another group. Their name
	// shows only to groups they're in (the privacy page: only your groups see your name).
	const editedByName =
		game.edited_at == null
			? null
			: game.edited_by == null
				? 'a former member'
				: (members.find((m) => m.id === game.edited_by)?.name ?? 'someone outside this group');
	const wanted = me ? wishers.some((w) => w.id === me.id) : false;

	return {
		mine,
		wanted,
		canEditDetails,
		editedByName,
		myLoan: myCopy && (myCopy.lent_to_user_id || myCopy.lent_to_text) ? { toUserId: myCopy.lent_to_user_id, toText: myCopy.lent_to_text } : null,
		// Borrowers to pick from: this group's other members, most recently active first.
		lendTo: me ? members.filter((m) => m.id !== me.id).map((m) => ({ id: m.id, name: m.name })) : [],
		canEdit,
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
			imageUrlRaw: game.image_url,
			maxPlaytime: game.max_playtime,
			weight: game.weight,
			mechanics: jsonArray<string>(game.mechanics),
			categories: jsonArray<string>(game.categories),
			isExpansion: game.is_expansion === 1,
			isManual: game.is_manual === 1,
			source: game.is_manual === 1 ? 'manual' : game.source,
			wikidataId: game.wikidata_id,
			detailsPending: game.bgg_id != null && game.fetched_at == null
		},
		owners: owners.map((o) => ({
			name: o.name,
			isMe: o.user_id === me?.id,
			colorIndex: colorOf.get(o.user_id) ?? 0,
			status: o.lent_to_text
				? `Lent to ${o.lent_to_text}`
				: o.lent_to_name
					? o.lent_in_group
						? `With ${o.lent_to_name}`
						: `Lent to ${o.lent_to_name}`
					: null
		})),
		wishers: wishers.map((w) => ({ name: w.name, colorIndex: colorOf.get(w.id) ?? 0 })),
		links: links.map((l) => ({
			id: l.id,
			kind: l.kind,
			title: l.title,
			url: l.url,
			host: linkHost(l.url),
			addedByName: l.added_by_name,
			canDelete: canEdit && actor != null && canDeleteLink(actor, l.added_by)
		})),
		expansions,
		bases: bases.map((b) => ({ id: b.id, name: b.name }))
	};
};

function gameIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Game not found');
	return id;
}

export const actions: Actions = {
	add: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		const gameId = gameIdParam(event.params.gameId);
		const userId = event.locals.user!.id;
		if (!(await gameUsableInGroup(db, event.params.groupId, userId, gameId)) || !(await addCopy(db, userId, gameId, Date.now()))) {
			error(404, 'Game not found');
		}
		return { copyAdded: true };
	},

	remove: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		await removeCopy(db, event.locals.user!.id, gameIdParam(event.params.gameId));
		// If nobody else in the group owns it, the game page would now 404, so go back to the catalog.
		redirect(303, `/g/${event.params.groupId}`);
	},

	lend: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const result = await lendCopy(db, groupId, event.locals.user!.id, gameIdParam(event.params.gameId), {
			toUserId: String(form.get('toUser') ?? '') || null,
			toText: form.get('toText')
		});
		return result.ok ? { lent: true } : fail(400, { lendError: result.error });
	},

	returned: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		await returnCopy(db, event.locals.user!.id, gameIdParam(event.params.gameId));
		return { returned: true };
	},

	editDetails: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		const access = await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const result = await editGame(db, groupId, { id: event.locals.user!.id, role: access.role }, gameIdParam(event.params.gameId), form, Date.now());
		return result.ok ? { detailsSaved: true } : fail(400, { editError: result.error });
	},

	want: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const gameId = gameIdParam(event.params.gameId);
		if ((await event.request.formData()).get('on') === '0') {
			await removeWish(db, event.locals.user!.id, gameId);
			// Nobody here owns or wants it any more, so this page would now 404: go to the Wanted tab.
			if (!(await gameVisibleInGroup(db, groupId, gameId))) redirect(303, `/g/${groupId}/wanted`);
			return { wishChanged: true };
		}
		if (!(await addWish(db, groupId, event.locals.user!.id, gameId, Date.now()))) error(404, 'Game not found');
		return { wishChanged: true };
	},

	addLink: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const gameId = gameIdParam(event.params.gameId);
		const form = await event.request.formData();
		const entered = { url: String(form.get('url') ?? ''), title: String(form.get('title') ?? ''), kind: String(form.get('kind') ?? '') };
		const parsed = parseLink(form);
		if (!parsed.ok) return fail(400, { linkError: parsed.error, link: entered });
		const result = await addLink(db, groupId, gameId, event.locals.user!.id, parsed.value, Date.now());
		if (!result.ok) {
			if (result.status === 404) error(404, 'Game not found');
			return fail(result.status, { linkError: result.error, link: entered });
		}
		return { linkAdded: true };
	},

	deleteLink: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		const access = await requireRole(event, db, groupId, 'member');
		const gameId = gameIdParam(event.params.gameId);
		const linkId = Number((await event.request.formData()).get('id'));
		const actor = { id: event.locals.user!.id, role: access.role };
		if (!Number.isInteger(linkId) || !(await deleteLink(db, groupId, gameId, linkId, actor))) {
			return fail(403, { deleteError: 'That link couldn’t be removed. Reload the page and try again.' });
		}
		return { linkRemoved: true };
	}
};
