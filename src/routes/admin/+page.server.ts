// The instance admin page (TECH.md "Instance administration"). 404 for anyone without the admin
// cookie, so the page doesn't announce itself. Shows counts and group names, never group contents.
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { adminDeleteGroup, adminLog, bggUsage, instanceTotals, listGroups, ownerSignInCode, suspendGroup, unsuspendGroup, type AdminResult } from '#lib/server/admin.ts';
import { formatSignInCode } from '#lib/server/recovery.ts';
import { clearAdminCookie } from '#lib/server/cookies.ts';
import { getAppearance, saveAppearance } from '#lib/server/appearance.ts';
import { CUSTOM_DEFAULTS } from '#lib/themes.ts';
import { getDb } from '#lib/server/platform.ts';
import { one } from '#lib/server/db.ts';
import { activeGameSource } from '#lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(event: Pick<RequestEvent, 'locals'>): void {
	if (!event.locals.isAdmin) error(404, 'Not found');
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	event.setHeaders({ 'cache-control': 'no-store' });
	const db = getDb();
	const now = Date.now();
	const [totals, groups, log, appearance, bgg] = await Promise.all([
		instanceTotals(db),
		listGroups(db),
		adminLog(db),
		getAppearance(db),
		event.locals.config.bggMode === 'off' ? null : bggUsage(db, now)
	]);
	return {
		now,
		bgg,
		totals,
		groups,
		log,
		bggMode: event.locals.config.bggMode,
		gameSource: activeGameSource(event.locals.config),
		groupCreation: event.locals.config.groupCreation,
		look: {
			hasCustom: appearance.colors != null,
			colors: appearance.colors ?? CUSTOM_DEFAULTS,
			customDefault: appearance.customDefault,
			logoUrl: appearance.logoUrl ?? ''
		}
	};
};

type GroupActionName = 'suspend' | 'unsuspend' | 'delete';

/**
 * Runs one of a group's actions and says what happened: an error goes back to the fold it came from,
 * and a success becomes a status line, which matters most for a deleted group whose row is gone.
 */
async function groupAction(event: RequestEvent, action: GroupActionName, run: (form: FormData, groupId: string) => Promise<AdminResult>) {
	requireAdmin(event);
	const form = await event.request.formData();
	const groupId = String(form.get('groupId') ?? '');
	const name = (await one<{ name: string }>(getDb(), 'SELECT name FROM groups WHERE id = ?1', groupId))?.name ?? 'The group';
	const result = await run(form, groupId);
	return result.ok ? { done: { action, name } } : fail(400, { groupId, action, error: result.error });
}

export const actions: Actions = {
	suspend: (event) => groupAction(event, 'suspend', (form, id) => suspendGroup(getDb(), id, form.get('reason'), Date.now())),
	unsuspend: (event) => groupAction(event, 'unsuspend', (form, id) => unsuspendGroup(getDb(), id, form.get('reason'), Date.now())),
	delete: (event) =>
		groupAction(event, 'delete', (form, id) => adminDeleteGroup(getDb(), id, form.get('confirmName'), form.get('reason'), Date.now())),
	/** A one-time sign-in code for a group's owner (D52), shown once and never stored in the clear. */
	ownerCode: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const groupId = String(form.get('groupId') ?? '');
		const made = await ownerSignInCode(getDb(), groupId, form.get('reason'), Date.now());
		if (!made.ok) return fail(400, { groupId, action: 'ownerCode' as const, error: made.error });
		event.setHeaders({ 'cache-control': 'no-store' });
		return { ownerCode: { groupId, code: formatSignInCode(made.code), expiresAt: made.expiresAt } };
	},
	look: async (event) => {
		requireAdmin(event);
		const result = await saveAppearance(getDb(), await event.request.formData(), Date.now());
		return result.ok ? { lookSaved: true } : fail(400, { lookError: result.error });
	},
	signOut: async (event) => {
		clearAdminCookie(event.cookies, event.url);
		redirect(303, '/');
	}
};
