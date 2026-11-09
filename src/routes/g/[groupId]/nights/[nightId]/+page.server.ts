import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import {
	addNightGuest,
	bringCopy,
	bringOther,
	canChangeNight,
	canMarkCame,
	confirmCame,
	addCameGuest,
	setCame,
	deleteNight,
	assembleNights,
	nightOnlyGamesRead,
	nightListRead,
	nightReads,
	parseNightForm,
	removeNightGuest,
	setGoing,
	setStayedHome,
	unbring,
	updateNight,
	type Result
} from '#lib/server/nights.ts';
import { canChangePlay, playsRead } from '#lib/server/plays.ts';
import { getDb } from '#lib/server/platform.ts';
import { known, readAll, rowsOf } from '#lib/server/db.ts';
import { nightPlaySoonRead } from '#lib/server/interest.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId, nightId } = event.params;
	const access = await requireRead(event, db, groupId);
	const me = event.locals.user;
	// Everything in one round trip after the access check (D59, D65).
	const r = await readAll(db, {
		// The nights a play can be put on (STATUS item 42).
		nightList: nightListRead(db, groupId, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)),
		...nightReads(db, groupId, { id: nightId }),
		otherGames: nightOnlyGamesRead(db, groupId, { ids: [nightId] }),
		plays: playsRead(db, groupId, { nightId }),
		// The bring list's titles, with this group's corrections, before the catalog loads in the browser.
		names: rowsOf<{ id: number; name: string }>(
			db,
			`SELECT g.id, COALESCE(gc.name, g.name) AS name FROM night_games ng JOIN games g ON g.id = ng.game_id
			 LEFT JOIN game_corrections gc ON gc.group_id = ?1 AND gc.game_id = g.id
			 WHERE ng.night_id = ?2 AND EXISTS (SELECT 1 FROM game_nights n WHERE n.id = ?2 AND n.group_id = ?1)`,
			groupId,
			nightId
		),
		// Play soon (D64): games someone going would like to play, never who, and the viewer's own marks.
		soon: access.role && !access.readonly ? nightPlaySoonRead(db, groupId, nightId, me?.id ?? null, Date.now()) : known({ others: [], mine: [] })
	});
	const [night] = assembleNights(r.nights, r.people, r.games);
	if (!night) error(404, 'Game night not found');
	const { otherGames, plays, names, soon } = r;
	const actor = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	return {
		night,
		otherGames,
		gameNames: Object.fromEntries(names.map((n) => [n.id, n.name])) as Record<number, string>,
		plays: plays.map((p) => ({ ...p, canChange: actor != null && canChangePlay(actor, p) })),
		me: actor?.id ?? null,
		playSoon: soon,
		canChange: actor != null && canChangeNight(actor, night),
		// Who came (D67): co-admins for anyone; everyone else for themselves.
		canMarkAll: actor != null && canMarkCame(actor, null),
		nightList: r.nightList,
		canAnswer: actor != null
	};
};

/** requireRole(member) on the group, then the action with the caller as actor. */
async function act(event: RequestEvent<{ groupId: string; nightId: string }>, run: (form: FormData, actor: { id: string; role: 'member' | 'admin' | 'owner' }) => Promise<Result<unknown>>) {
	const db = getDb();
	const access = await requireRole(event, db, event.params.groupId, 'member');
	const result = await run(await event.request.formData(), { id: event.locals.user!.id, role: access.role });
	return result.ok ? { nightSaved: true } : fail(400, { nightError: result.error });
}

const gameIdOf = (form: FormData) => Number(form.get('gameId'));
const optionalCount = (form: FormData, key: string, max: number) => {
	const n = Number(String(form.get(key) ?? '').trim() || NaN);
	return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

export const actions: Actions = {
	edit: async (event) =>
		act(event, async (form, actor) => {
			const parsed = parseNightForm(form);
			return parsed.ok ? updateNight(getDb(), event.params.groupId, actor, event.params.nightId, parsed.value) : parsed;
		}),

	delete: async (event) => {
		const db = getDb();
		const { groupId, nightId } = event.params;
		const access = await requireRole(event, db, groupId, 'member');
		const result = await deleteNight(db, groupId, { id: event.locals.user!.id, role: access.role }, nightId);
		if (!result.ok) return fail(403, { nightError: result.error });
		redirect(303, `/g/${groupId}/pick`);
	},

	going: async (event) =>
		act(event, (form, actor) =>
			setGoing(getDb(), event.params.groupId, actor, event.params.nightId, String(form.get('userId') ?? actor.id), form.get('going') === '1')
		),

	addGuest: async (event) => act(event, (form) => addNightGuest(getDb(), event.params.groupId, event.params.nightId, form.get('name'))),

	// Who came (D67): you for yourself, co-admins for anyone; then "That's right", and a guest added afterwards.
	came: async (event) =>
		act(event, (form, actor) => {
			const guestName = String(form.get('guestName') ?? '');
			const who = guestName ? { guestName } : { userId: String(form.get('userId') ?? '') || actor.id };
			return setCame(getDb(), event.params.groupId, actor, event.params.nightId, who, form.get('came') === '1');
		}),

	confirmCame: async (event) => act(event, (_form, actor) => confirmCame(getDb(), event.params.groupId, actor, event.params.nightId)),

	addCameGuest: async (event) => act(event, (form, actor) => addCameGuest(getDb(), event.params.groupId, actor, event.params.nightId, form.get('name'))),

	removeGuest: async (event) => act(event, (form) => removeNightGuest(getDb(), event.params.groupId, event.params.nightId, String(form.get('name') ?? ''))),

	bring: async (event) =>
		act(event, (form, actor) => bringCopy(getDb(), event.params.groupId, actor, event.params.nightId, gameIdOf(form), String(form.get('ownerId') ?? ''))),

	bringOther: async (event) =>
		act(event, (form, actor) =>
			bringOther(getDb(), event.params.groupId, actor, event.params.nightId, {
				title: String(form.get('title') ?? ''),
				minPlayers: optionalCount(form, 'minPlayers', 99),
				maxPlayers: optionalCount(form, 'maxPlayers', 99),
				minPlaytime: null,
				maxPlaytime: optionalCount(form, 'maxPlaytime', 1440),
				bringer: String(form.get('bringer') ?? '')
			})
		),

	unbring: async (event) => act(event, (form, actor) => unbring(getDb(), event.params.groupId, actor, event.params.nightId, gameIdOf(form))),

	stayedHome: async (event) =>
		act(event, (form) => setStayedHome(getDb(), event.params.groupId, event.params.nightId, gameIdOf(form), form.get('stayedHome') === '1'))
};
