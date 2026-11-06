// The instance admin page (TECH.md "Instance administration"). 404 for anyone without the admin
// cookie, so the page doesn't announce itself. Shows counts and group names, never group contents.
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { adminDeleteGroup, adminLog, instanceTotals, listGroups, suspendGroup, unsuspendGroup, type AdminResult } from '#lib/server/admin.ts';
import { clearAdminCookie } from '#lib/server/cookies.ts';
import { getDb } from '#lib/server/platform.ts';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(event: Pick<RequestEvent, 'locals'>): void {
	if (!event.locals.isAdmin) error(404, 'Not found');
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	event.setHeaders({ 'cache-control': 'no-store' });
	const db = getDb();
	const [totals, groups, log] = await Promise.all([instanceTotals(db), listGroups(db), adminLog(db)]);
	return {
		now: Date.now(),
		totals,
		groups,
		log,
		bggMode: event.locals.config.bggMode,
		groupCreation: event.locals.config.groupCreation
	};
};

async function groupAction(event: RequestEvent, run: (form: FormData, groupId: string) => Promise<AdminResult>) {
	requireAdmin(event);
	const form = await event.request.formData();
	const groupId = String(form.get('groupId') ?? '');
	const result = await run(form, groupId);
	return result.ok ? { done: true } : fail(400, { groupId, error: result.error });
}

export const actions: Actions = {
	suspend: (event) => groupAction(event, (form, id) => suspendGroup(getDb(), id, form.get('reason'), Date.now())),
	unsuspend: (event) => groupAction(event, (form, id) => unsuspendGroup(getDb(), id, form.get('reason'), Date.now())),
	delete: (event) => groupAction(event, (form, id) => adminDeleteGroup(getDb(), id, form.get('confirmName'), form.get('reason'), Date.now())),
	signOut: async (event) => {
		clearAdminCookie(event.cookies, event.url);
		redirect(303, '/');
	}
};
