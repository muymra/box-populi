// Form actions for the play log, shared by the game page and the plays page (SvelteKit lets a
// +page.server.ts export only its own names, so the bodies live here).
import { fail, type RequestEvent } from '@sveltejs/kit';
import { requireRole } from './authz.ts';
import { getDb } from './platform.ts';
import { deletePlay, parsePlayForm, savePlay, setPodiumPoints } from './plays.ts';
import { nightOf } from '#lib/table/regulars.ts';

type Event = RequestEvent<{ groupId: string }>;

/** The newest date a play can have: the server's tonight plus a day, since people are ahead of UTC. */
function latestDate(now = Date.now()): string {
	return nightOf(now + 30 * 60 * 60 * 1000);
}

async function actor(event: Event) {
	const db = getDb();
	const access = await requireRole(event, db, event.params.groupId, 'member');
	return { db, actor: { id: event.locals.user!.id, role: access.role } };
}

/** `logPlay` and `editPlay`: the form carries `gameId`, and `playId` when editing. */
export async function savePlayAction(event: Event) {
	const { db, actor: who } = await actor(event);
	const form = await event.request.formData();
	const gameId = Number(form.get('gameId'));
	const playId = String(form.get('playId') ?? '') || undefined;
	if (!Number.isInteger(gameId) || gameId <= 0) return fail(400, { playError: 'Pick a game.', playId });
	const parsed = parsePlayForm(form, latestDate());
	if (!parsed.ok) return fail(400, { playError: parsed.error, playId });
	const saved = await savePlay(db, event.params.groupId, who, gameId, parsed.value, playId);
	if (!saved.ok) return fail(400, { playError: saved.error, playId });
	return { playSaved: saved.value };
}

export async function deletePlayAction(event: Event) {
	const { db, actor: who } = await actor(event);
	const playId = String((await event.request.formData()).get('playId') ?? '');
	const result = await deletePlay(db, event.params.groupId, who, playId);
	return result.ok ? { playDeleted: true } : fail(403, { playError: result.error, playId });
}

export async function pointsAction(event: Event) {
	const db = getDb();
	const access = await requireRole(event, db, event.params.groupId, 'admin');
	const result = await setPodiumPoints(db, event.params.groupId, { id: event.locals.user!.id, role: access.role }, (await event.request.formData()).get('points'));
	return result.ok ? { pointsSaved: true } : fail(400, { pointsError: result.error });
}
