import { requireRead } from '#lib/server/authz.ts';
import { pendingDetails } from '#lib/server/importer.ts';
import { one } from '#lib/server/db.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { getDb } from '#lib/server/platform.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const db = getDb();
	const access = await requireRead(event, db, event.params.groupId);
	// Members see the join code so they can invite people; demo visitors never do.
	const code =
		access.role && !access.group.isDemo
			? ((await one<{ code: string }>(db, 'SELECT code FROM groups WHERE id = ?1', access.group.id))?.code ?? null)
			: null;
	// Imported games still waiting for BGG details; the note offers to finish loading them.
	const pending =
		access.role && event.locals.user && event.locals.config.bggMode !== 'off' ? await pendingDetails(db, event.locals.user.id) : 0;
	// The group's theme, for switching colours without a reload when moving between groups.
	const groupTheme = (await one<{ theme: string | null }>(db, 'SELECT theme FROM groups WHERE id = ?1', access.group.id))?.theme ?? null;
	// Names and colours for "who's here" in the start player modal, which has to open without the catalog.
	const tableMembers = (await loadMembers(db, access.group.id)).map((m) => ({ id: m.id, name: m.name, colorIndex: m.colorIndex }));
	return { ...access, code, groupTheme, tableMembers, contact: event.locals.config.instanceContact, pendingDetails: pending };
};
