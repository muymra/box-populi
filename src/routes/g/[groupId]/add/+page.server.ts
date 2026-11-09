import { fail, redirect } from '@sveltejs/kit';
import { requireRole } from '#lib/server/authz.ts';
import { known, readAll, rowsOf } from '#lib/server/db.ts';
import { addCopy, addManualGame, gameUsableInGroup, parseManualGame } from '#lib/server/games.ts';
import { pendingDetailsRead } from '#lib/server/importer.ts';
import { unmatchedGamesRead } from '#lib/server/bgg-match.ts';
import { activeGameSource } from '#lib/server/instance.ts';
import { addWish, removeWish } from '#lib/server/wishlist.ts';
import { getDb } from '#lib/server/platform.ts';
import { myShelfHereReads, setCopyHidden, setHideNew } from '#lib/server/hiding.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	await requireRole(event, db, groupId, 'member');
	const user = event.locals.user!;
	const source = activeGameSource(event.locals.config);
	// One round trip after the access check (D59, D65).
	const r = await readAll(db, {
		mine: rowsOf<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM copies WHERE user_id = ?1', user.id),
		pending: event.locals.config.bggMode === 'off' ? known(0) : pendingDetailsRead(db, user.id),
		// Typed-in and Wikidata games to find on BGG (D57), only while BGG is on.
		unmatched: source === 'bgg' ? unmatchedGamesRead(db, user.id) : known([]),
		// Your games in this group: which are hidden here, and "Hide new games here" (D66).
		...myShelfHereReads(db, groupId, user.id)
	});
	return { bggMode: event.locals.config.bggMode, source, myGameCount: r.mine[0]?.n ?? 0, userId: user.id, pending: r.pending, unmatched: r.unmatched, hideNew: r.hideNew, myGames: r.myGames };
};

export const actions: Actions = {
	// Hiding per group (D66): show one of your hidden games here again.
	showHere: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const gameId = Number((await event.request.formData()).get('gameId'));
		if (!Number.isInteger(gameId) || !(await setCopyHidden(db, groupId, event.locals.user!.id, gameId, false, Date.now()))) {
			return fail(400, { hideError: 'That game isn’t on your shelf any more.' });
		}
		return { shownHere: true };
	},

	// "Hide new games here" on, with the games to show (the pick list), or off (D66).
	hideNew: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const on = form.get('on') === '1';
		const shown = form
			.getAll('show')
			.map(Number)
			.filter((id) => Number.isInteger(id) && id > 0);
		await setHideNew(db, groupId, event.locals.user!.id, on, shown, Date.now());
		return { hideNewChanged: true };
	},

	add: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		const gameId = Number((await event.request.formData()).get('gameId'));
		const userId = event.locals.user!.id;
		if (
			!Number.isInteger(gameId) ||
			gameId <= 0 ||
			!(await gameUsableInGroup(db, event.params.groupId, userId, gameId)) ||
			!(await addCopy(db, userId, gameId, Date.now()))
		) {
			return fail(400, { addError: 'That game couldn’t be added. Search again and retry.' });
		}
		return { added: gameId };
	},

	want: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		const form = await event.request.formData();
		const gameId = Number(form.get('gameId'));
		if (!Number.isInteger(gameId) || gameId <= 0) return fail(400, { addError: 'That game couldn’t be found. Search again and retry.' });
		if (form.get('on') === '0') {
			await removeWish(db, event.locals.user!.id, gameId);
			return { wanted: false };
		}
		if (!(await addWish(db, event.params.groupId, event.locals.user!.id, gameId, Date.now()))) {
			return fail(400, { addError: 'That game couldn’t be found. Search again and retry.' });
		}
		return { wanted: true };
	},

	manual: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		const form = await event.request.formData();
		const parsed = parseManualGame(form);
		if (!parsed.ok) return fail(400, { manualError: parsed.error, manual: Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) });
		const gameId = await addManualGame(db, event.locals.user!.id, parsed.value, Date.now());
		redirect(303, `/g/${event.params.groupId}/game/${gameId}`);
	}
};
