import { requireRead } from '#lib/server/authz.ts';
import { pendingDetails } from '#lib/server/importer.ts';
import { one } from '#lib/server/db.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { canPlanNights, loadNights, nightOnlyGames } from '#lib/server/nights.ts';
import { getDb } from '#lib/server/platform.ts';
import { pinSetAt } from '#lib/server/pins.ts';
import { listMyGroups } from '#lib/server/identity.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const db = getDb();
	const access = await requireRead(event, db, event.params.groupId);
	// Members see the join code so they can invite people; demo visitors never do, and nobody does
	// while the group is archived (D50) or suspended, since joining is refused then.
	const code =
		access.role && !access.group.isDemo && !access.group.archived && !access.group.suspended
			? ((await one<{ code: string }>(db, 'SELECT code FROM groups WHERE id = ?1', access.group.id))?.code ?? null)
			: null;
	// Imported games still waiting for BGG details; the note offers to finish loading them.
	const pending =
		access.role && event.locals.user && event.locals.config.bggMode !== 'off' ? await pendingDetails(db, event.locals.user.id) : 0;
	// The group's theme, for switching colours without a reload when moving between groups.
	const groupTheme = (await one<{ theme: string | null }>(db, 'SELECT theme FROM groups WHERE id = ?1', access.group.id))?.theme ?? null;
	// Names and colours for "who's here" in the start player modal, which has to open without the catalog.
	const tableMembers = (await loadMembers(db, access.group.id)).map((m) => ({ id: m.id, name: m.name, colorIndex: m.colorIndex }));
	// Game nights from yesterday on (PRD "Game night"): which one is tonight depends on the viewer's
	// clock, so the browser picks it. Games on nights around today that no member owns come along,
	// so Play tonight can draw from a guest's game.
	const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
	const nights = await loadNights(db, access.group.id, { from: day(-1) });
	const near = nights.filter((n) => n.nightOn <= day(1)).map((n) => n.id);
	const [nightGames, mayPlanNights] = await Promise.all([
		nightOnlyGames(db, access.group.id, near),
		access.role && !access.readonly ? canPlanNights(db, access.group.id, access.role) : Promise.resolve(false)
	]);
	// The switcher in the top bar (PRD "Groups and codes"): a member's live groups, this one included,
	// by name so they keep their places. Empty unless there's somewhere else to go.
	const live = access.role && event.locals.user
		? (await listMyGroups(db, event.locals.user.id)).filter((g) => !g.isDemo && (g.archivedAt == null || g.id === access.group.id))
		: [];
	const myGroups = live.length > 1 ? live.map((g) => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
	return {
		...access,
		myGroups,
		code,
		groupTheme,
		tableMembers,
		nights,
		nightGames,
		mayPlanNights,
		myId: event.locals.user?.id ?? null,
		// A member without a PIN is nudged on the shelf to set one (D47, D48).
		myPinSet: access.role && event.locals.user ? (await pinSetAt(db, event.locals.user.id)) != null : true,
		contact: event.locals.config.instanceContact,
		pendingDetails: pending
	};
};
