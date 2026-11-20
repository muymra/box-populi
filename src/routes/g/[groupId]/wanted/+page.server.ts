import { error, fail } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { applyCorrection, correctionsRead } from '#lib/server/corrections.ts';
import { known, readAll } from '#lib/server/db.ts';
import { groupPlaySoonRead, myPlaySoonRead, setPlaySoon } from '#lib/server/interest.ts';
import { getDb } from '#lib/server/platform.ts';
import { addWish, landedRead, removeWish, wantedFrom, wantedRead } from '#lib/server/wishlist.ts';
import { shelvesSaid } from '#lib/wanted.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const me = event.locals.user?.id ?? null;
	const rule = event.locals.config.playSoon;
	const now = Date.now();
	const canEdit = access.role != null && !access.readonly;
	// One round trip (D59): the wishes, the shelf's Play soon counts (D83), the members for names and
	// colours, the group's own pictures, the viewer's own marks, which say whether their list is full,
	// and the viewer's wishes that are on the shelf now (D84).
	const r = await readAll(db, {
		wanted: wantedRead(db, groupId),
		soon: groupPlaySoonRead(db, groupId, me, now, rule),
		members: membersRead(db, groupId),
		corrections: correctionsRead(db, groupId),
		myMarks: canEdit && me ? myPlaySoonRead(db, me, now, rule) : known([]),
		landed: canEdit && me ? landedRead(db, groupId, me) : known([])
	});
	const byId = new Map(r.members.map((m) => [m.id, m]));
	const person = (id: string) => byId.get(id);
	// A wish the viewer has already put on Play soon has its answer; it asks again once that mark ends.
	const marked = new Set(r.myMarks.map((m) => m.gameId));
	return {
		canEdit,
		landed: r.landed
			.filter((row) => !marked.has(row.id))
			.map((row) => {
				const g = applyCorrection(row, r.corrections.get(row.id));
				const ids = JSON.parse(g.owners) as string[];
				const owners = ids
					.map(person)
					.filter((m) => m != null)
					.sort((a, b) => a.colorIndex - b.colorIndex);
				const others = owners.filter((m) => m.id !== me).map((m) => m.name);
				return {
					id: g.id,
					name: g.name,
					isExpansion: g.is_expansion === 1,
					shelves: shelvesSaid(me != null && ids.includes(me), others),
					colors: owners.map((m) => m.colorIndex)
				};
			})
			.filter((g) => g.shelves !== ''),
		soon: r.soon.map((row) => {
			const g = applyCorrection(row, r.corrections.get(row.id));
			return {
				id: g.id,
				name: g.name,
				year: g.year,
				thumbUrl: g.thumb_url,
				isExpansion: g.is_expansion === 1,
				marks: g.marks,
				mine: g.mine === 1,
				owners: (JSON.parse(g.owners) as string[])
					.map(person)
					.filter((m) => m != null)
					.map((m) => ({ name: m.name, colorIndex: m.colorIndex }))
					.sort((a, b) => a.colorIndex - b.colorIndex)
			};
		}),
		soonFull: r.myMarks.length >= rule.max,
		soonMax: rule.max,
		games: wantedFrom(r.wanted, r.corrections).map((g) => ({
			id: g.id,
			bggId: g.bggId,
			name: g.name,
			year: g.year,
			thumbUrl: g.thumbUrl,
			isExpansion: g.isExpansion,
			mine: me != null && g.wantedBy.includes(me),
			wantedBy: g.wantedBy
				.map(person)
				.filter((m) => m != null)
				.map((m) => ({ id: m.id, name: m.name, colorIndex: m.colorIndex }))
				.sort((a, b) => a.name.localeCompare(b.name))
		}))
	};
};

function gameIdOf(form: FormData): number {
	const gameId = Number(form.get('gameId'));
	if (!Number.isInteger(gameId) || gameId <= 0) error(404, 'Game not found');
	return gameId;
}

export const actions: Actions = {
	want: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const gameId = gameIdOf(form);
		if (form.get('on') === '0') await removeWish(db, event.locals.user!.id, gameId);
		else if (!(await addWish(db, groupId, event.locals.user!.id, gameId, Date.now()))) error(404, 'Game not found');
		return { wishChanged: true };
	},

	// "Me too" on a Play soon game (D83): the same mark as the game page's Play soon button.
	playSoon: async (event) => {
		const db = getDb();
		const { groupId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const gameId = gameIdOf(form);
		const result = await setPlaySoon(db, groupId, event.locals.user!.id, gameId, form.get('on') !== '0', Date.now(), event.locals.config.playSoon);
		return result.ok ? { playSoonChanged: true } : fail(400, { playSoonError: result.error });
	}
};
