import { error, fail, redirect } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { addCopy, gameUsableInGroup, gameVisibleInGroup, removeCopy } from '#lib/server/games.ts';
import { addLink, canDeleteLink, deleteLink, parseLink } from '#lib/server/links.ts';
import { addWish, removeWish } from '#lib/server/wishlist.ts';
import { hiddenHereRead, setCopyHidden } from '#lib/server/hiding.ts';
import { myPlaySoonRead, PLAY_SOON_MAX, setFavourite, setPlaySoon } from '#lib/server/interest.ts';
import { lendCopy, returnCopy } from '#lib/server/lending.ts';
import { editGame, mayEditGame } from '#lib/server/game-edit.ts';
import { applyCorrection, correctionsRead } from '#lib/server/corrections.ts';
import { linkHost } from '#lib/link-kinds.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { canChangePlay, playsRead } from '#lib/server/plays.ts';
import { isWin } from '#lib/plays.ts';
import { jsonArray, known, readAll, rowOf, rowsOf } from '#lib/server/db.ts';
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

	const me = event.locals.user;
	// Everything this page shows, in one round trip after the access check (D59). Only games this
	// group owns, wants, brings to a night or has played are visible here: the cache is shared across
	// groups, and hand-entered titles from other groups shouldn't be readable by guessing ids (same rule
	// as gameVisibleInGroup). That check comes back with the rest, and nothing else is used unless it passes.
	// Copies hidden from the group don't count (D66), except the viewer's own: they open it to show it again.
	const r = await readAll(db, {
		shared: rowOf<GameDetail>(
			db,
			`SELECT g.* FROM games g WHERE g.id = ?2 AND (
			EXISTS (SELECT 1 FROM group_copies gc WHERE gc.group_id = ?1 AND gc.game_id = g.id)
			OR EXISTS (SELECT 1 FROM copies c WHERE c.user_id = ?3 AND c.game_id = g.id)
			OR EXISTS (SELECT 1 FROM wishlist w JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1 WHERE w.game_id = g.id)
			OR EXISTS (SELECT 1 FROM night_games ng JOIN game_nights n ON n.id = ng.night_id AND n.group_id = ?1 WHERE ng.game_id = g.id)
			OR EXISTS (SELECT 1 FROM plays p WHERE p.group_id = ?1 AND p.game_id = g.id))`,
			groupId,
			gameId,
			me && access.role ? me.id : ''
		),
		corrections: correctionsRead(db, groupId, [gameId]),
		owners: rowsOf<{ user_id: string; name: string; lent_to_name: string | null; lent_to_text: string | null; lent_in_group: number }>(
			db,
			`SELECT c.user_id, u.name, lu.name AS lent_to_name, c.lent_to_text,
				EXISTS (SELECT 1 FROM memberships lm WHERE lm.group_id = ?1 AND lm.user_id = c.lent_to_user_id) AS lent_in_group
			 FROM group_copies c
			 JOIN users u ON u.id = c.user_id
			 LEFT JOIN users lu ON lu.id = c.lent_to_user_id
			 WHERE c.group_id = ?1 AND c.game_id = ?2
			 ORDER BY u.name`,
			groupId,
			gameId
		),
		wishers: rowsOf<{ id: string; name: string }>(
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
		links: rowsOf<{ id: number; kind: 'rules' | 'video' | 'other'; title: string | null; url: string; added_by: string | null; added_by_name: string | null }>(
			db,
			`SELECT l.id, l.kind, l.title, l.url, l.added_by, u.name AS added_by_name
			 FROM game_links l LEFT JOIN users u ON u.id = l.added_by
			 WHERE l.group_id = ?1 AND l.game_id = ?2 ORDER BY l.kind, l.added_at`,
			groupId,
			gameId
		),
		// Expansions of this game someone in the group owns; none for a game without a BGG id. Found
		// through `game_bases` (D65), not by unpacking the base ids of every game the group owns.
		expansions: rowsOf<{ id: number; name: string; year: number | null }>(
			db,
			`SELECT g.id, g.name, g.year
			 FROM game_bases b JOIN games g ON g.id = b.game_id
			 WHERE b.base_bgg_id = (SELECT bgg_id FROM games WHERE id = ?2) AND g.is_expansion = 1
			   AND EXISTS (SELECT 1 FROM group_copies gc WHERE gc.group_id = ?1 AND gc.game_id = g.id)
			 ORDER BY g.name`,
			groupId,
			gameId
		),
		// For an expansion, its base games; none otherwise.
		bases: rowsOf<{ id: number; name: string; bgg_id: number }>(
			db,
			`SELECT id, name, bgg_id FROM games
			 WHERE bgg_id IN (SELECT value FROM json_each((SELECT base_bgg_ids FROM games WHERE id = ?1 AND is_expansion = 1)))`,
			gameId
		),
		// Who in the group has it as a favourite (D63).
		favourites: rowsOf<{ id: string; name: string }>(
			db,
			`SELECT u.id, u.name FROM favourites f
			 JOIN memberships m ON m.user_id = f.user_id AND m.group_id = ?1
			 JOIN users u ON u.id = f.user_id
			 WHERE f.game_id = ?2
			 ORDER BY u.name`,
			groupId,
			gameId
		),
		// The viewer's own Play soon list (D64): whether this game is on it, until when, and whether it's full.
		myPlaySoon: me ? myPlaySoonRead(db, me.id, Date.now()) : known([]),
		members: membersRead(db, groupId),
		plays: playsRead(db, groupId, { gameId }),
		myCopy: me
			? rowOf<{ lent_to_user_id: string | null; lent_to_text: string | null }>(
					db,
					'SELECT lent_to_user_id, lent_to_text FROM copies WHERE user_id = ?1 AND game_id = ?2',
					me.id,
					gameId
				)
			: known(null),
		// Whether the viewer's copy is hidden from this group (D66).
		hiddenHere: me && access.role ? hiddenHereRead(db, groupId, me.id, gameId) : known(false)
	});
	const shared = r.shared;
	if (!shared) error(404, 'Game not found');
	// The game as this group sees it: the shared row, with this group's picture (D54) and anything it
	// corrected for itself before D54.
	const correction = r.corrections.get(gameId);
	const game = applyCorrection(shared, correction);
	const { owners, wishers, favourites, myPlaySoon, links, expansions, bases, members, plays, myCopy, hiddenHere } = r;
	const colorOf = new Map(members.map((m) => [m.id, m.colorIndex]));

	const canEdit = access.role != null && !access.readonly;
	const actor = me && access.role ? { id: me.id, role: access.role } : null;
	const mine = myCopy != null;
	const canEditDetails = canEdit && actor != null && mayEditGame(shared, actor.role, mine);
	// Who last edited it: the shared game's last editor, or this group's picture if that came later.
	// An editor's name shows only to groups they're in (D54; the privacy page says so).
	const nameOf = (id: string | null) => (id == null ? null : (members.find((m) => m.id === id)?.name ?? null));
	const isBgg = game.source === 'bgg' && game.is_manual !== 1;
	const groupEdit = correction != null && (shared.edited_at == null || correction.edited_at >= shared.edited_at) ? correction : null;
	const editedByName = isBgg
		? null
		: groupEdit
			? (nameOf(groupEdit.edited_by) ?? 'a former member')
			: shared.edited_at == null
				? null
				: shared.edited_by == null
					? 'a former member'
					: (nameOf(shared.edited_by) ?? 'someone outside this group');
	const wanted = me ? wishers.some((w) => w.id === me.id) : false;
	// Who has won this game most here, among current members (PRD "Play log").
	const wins = new Map<string, number>();
	for (const p of plays) {
		if (p.coop) continue;
		const places = p.players.map((x) => x.place);
		for (const x of p.players) if (x.userId && colorOf.has(x.userId) && isWin(x.place, places)) wins.set(x.userId, (wins.get(x.userId) ?? 0) + 1);
	}
	const [topId, topWins] = [...wins.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

	return {
		plays: plays.slice(0, 10).map((p) => ({ ...p, canChange: canEdit && actor != null && canChangePlay(actor, p) })),
		playCount: plays.length,
		mostWins: topId ? { name: nameOf(topId) ?? '', wins: topWins } : null,
		canLog: canEdit && owners.length > 0,
		// For attaching a play to tonight's game night when the game is in its pool (D38).
		ownerIds: owners.map((o) => o.user_id),
		mine,
		// The viewer's copy is hidden from this group: only they see the game here, and it can't be lent from here (D66).
		hiddenHere: mine && hiddenHere,
		wanted,
		favourite: me ? favourites.some((f) => f.id === me.id) : false,
		favourites: favourites.map((f) => ({ id: f.id, name: f.name, colorIndex: colorOf.get(f.id) ?? 0 })),
		playSoon: myPlaySoon.find((m) => m.gameId === gameId) ?? null,
		playSoonFull: myPlaySoon.filter((m) => m.gameId !== gameId).length >= PLAY_SOON_MAX,
		canEditDetails,
		editedByName,
		myLoan: myCopy && (myCopy.lent_to_user_id || myCopy.lent_to_text) ? { toUserId: myCopy.lent_to_user_id, toText: myCopy.lent_to_text } : null,
		// Borrowers to pick from: this group's other members, most recently active first.
		lendTo: me && !hiddenHere ? members.filter((m) => m.id !== me.id).map((m) => ({ id: m.id, name: m.name })) : [],
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

	hideHere: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const hidden = (await event.request.formData()).get('hidden') === '1';
		if (!(await setCopyHidden(db, groupId, event.locals.user!.id, gameIdParam(event.params.gameId), hidden, Date.now()))) error(404, 'Game not found');
		return { hiddenChanged: true };
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

	favourite: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const on = (await event.request.formData()).get('on') !== '0';
		if (!(await setFavourite(db, groupId, event.locals.user!.id, gameIdParam(event.params.gameId), on, Date.now()))) error(404, 'Game not found');
		return { favouriteChanged: true };
	},

	playSoon: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const on = (await event.request.formData()).get('on') !== '0';
		const result = await setPlaySoon(db, groupId, event.locals.user!.id, gameIdParam(event.params.gameId), on, Date.now());
		return result.ok ? { playSoonChanged: true } : fail(400, { playSoonError: result.error });
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
