import { fail, redirect } from '@sveltejs/kit';
import { requireRole } from '#lib/server/authz.ts';
import { one } from '#lib/server/db.ts';
import { addCopy, addManualGame, parseManualGame } from '#lib/server/games.ts';
import { pendingDetails } from '#lib/server/importer.ts';
import { addWish, removeWish } from '#lib/server/wishlist.ts';
import { getDb } from '#lib/server/platform.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	await requireRole(event, db, event.params.groupId, 'member');
	const user = event.locals.user!;
	const mine = await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM copies WHERE user_id = ?1', user.id);
	const pending = event.locals.config.bggMode === 'off' ? 0 : await pendingDetails(db, user.id);
	return { bggMode: event.locals.config.bggMode, myGameCount: mine?.n ?? 0, userId: user.id, pending };
};

export const actions: Actions = {
	add: async (event) => {
		const db = getDb();
		await requireRole(event, db, event.params.groupId, 'member');
		const gameId = Number((await event.request.formData()).get('gameId'));
		if (!Number.isInteger(gameId) || gameId <= 0 || !(await addCopy(db, event.locals.user!.id, gameId, Date.now()))) {
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
