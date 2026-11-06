import { error } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { getDb } from '#lib/server/platform.ts';
import { addWish, removeWish, wantedGames } from '#lib/server/wishlist.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const [games, members] = await Promise.all([wantedGames(db, groupId), loadMembers(db, groupId)]);
	const byId = new Map(members.map((m) => [m.id, m]));
	const me = event.locals.user?.id;
	return {
		canEdit: access.role != null && !access.readonly,
		games: games.map((g) => ({
			id: g.id,
			bggId: g.bggId,
			name: g.name,
			year: g.year,
			thumbUrl: g.thumbUrl,
			isExpansion: g.isExpansion,
			mine: me != null && g.wantedBy.includes(me),
			wantedBy: g.wantedBy
				.map((id) => byId.get(id))
				.filter((m) => m != null)
				.map((m) => ({ name: m.name, colorIndex: m.colorIndex }))
				.sort((a, b) => a.name.localeCompare(b.name))
		}))
	};
};

export const actions: Actions = {
	want: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const gameId = Number(form.get('gameId'));
		if (!Number.isInteger(gameId) || gameId <= 0) error(404, 'Game not found');
		if (form.get('on') === '0') await removeWish(db, event.locals.user!.id, gameId);
		else if (!(await addWish(db, groupId, event.locals.user!.id, gameId, Date.now()))) error(404, 'Game not found');
		return { wishChanged: true };
	}
};
