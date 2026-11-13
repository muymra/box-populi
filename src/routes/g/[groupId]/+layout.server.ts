import { readGroup } from '#lib/server/authz.ts';
import { rememberGroup } from '#lib/server/cookies.ts';
import { invitePath } from '#lib/server/codes.ts';
import { pendingDetailsRead } from '#lib/server/importer.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { assembleNights, mayPlanNights, nightOnlyGamesRead, nightReads } from '#lib/server/nights.ts';
import { getDb } from '#lib/server/platform.ts';
import { myGroupsRead } from '#lib/server/identity.ts';
import { known, readAll, rowOf } from '#lib/server/db.ts';
import { myPlaySoonRead } from '#lib/server/interest.ts';
import { chatForViewer } from '#lib/group-chat.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const db = getDb();
	// The join code, theme and PIN date come with the access check's one query (D59).
	const { access, extras } = await readGroup(event, db, event.params.groupId);
	// So the app on a home screen opens here next time (D76).
	rememberGroup(event.cookies, event.url, access.group.id);
	// Members see the join code so they can invite people; demo visitors never do, and nobody does
	// while the group is archived (D50) or suspended, since joining is refused then. Nor does someone
	// waiting to be let in or suspended (D79).
	const code = access.role && access.standing === 'full' && !access.group.isDemo && !access.group.archived && !access.group.suspended ? extras.code : null;
	// The invite link carries the group's link key after the code (D65), which spares it the limit on wrong codes.
	const invite = code ? invitePath(code, extras.linkKey) : null;
	// The group's theme, for switching colours without a reload when moving between groups.
	const groupTheme = extras.theme;
	const user = event.locals.user;
	// Game nights from yesterday on (PRD "Game night"): which one is tonight depends on the viewer's
	// clock, so the browser picks it.
	const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
	// Everything else in one round trip (D59): each database call costs CPU time on the free plan.
	const reads = await readAll(db, {
		// Imported games still waiting for BGG details; the note offers to finish loading them.
		pending: access.role && user && event.locals.config.bggMode !== 'off' ? pendingDetailsRead(db, user.id) : known(0),
		// Names and colours for "who's here" in the start player modal, which has to open without the catalog.
		members: membersRead(db, access.group.id),
		// The switcher in the top bar (PRD "Groups and codes").
		groups: access.role && user ? myGroupsRead(db, user.id) : known([]),
		// The viewer's own Play soon list (D64), for the shelf's "My Play soon" filter. Never anyone else's.
		myPlaySoon: access.role && user ? myPlaySoonRead(db, user.id, Date.now(), event.locals.config.playSoon) : known([]),
		...nightReads(db, access.group.id, { from: day(-1) }),
		// Games on nights around today that no member owns, so Play tonight can draw from a guest's game.
		nightGames: nightOnlyGamesRead(db, access.group.id, { from: day(-1), to: day(1) }),
		// Whether the group has a night behind it, for the Game night tab's "Past nights" link (STATUS item 45).
		pastNight: rowOf<{ x: number }>(db, 'SELECT 1 AS x FROM game_nights WHERE group_id = ?1 AND night_on < ?2 LIMIT 1', access.group.id, day(0))
	});
	// `active`: a full member (D79). Only they're offered as here, going, players, hosts or borrowers;
	// everyone stays in what already happened.
	const tableMembers = reads.members.map((m) => ({ id: m.id, name: m.name, colorIndex: m.colorIndex, active: m.standing === 'full' }));
	// For the owner and co-admins, a note on every page while anyone waits to be let in (D79).
	const waiting = access.role && access.role !== 'member' && access.standing === 'full' ? reads.members.filter((m) => m.standing === 'waiting').length : 0;
	const nights = assembleNights(reads.nights, reads.people, reads.games);
	const mayPlan = access.role && !access.readonly ? mayPlanNights(access.role, extras.nightsBy) : false;
	// A member's live groups, this one included, by name so they keep their places. Empty unless
	// there's somewhere else to go.
	const live = reads.groups.filter((g) => !g.isDemo && (g.archivedAt == null || g.id === access.group.id));
	const myGroups = live.length > 1 ? live.map((g) => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
	return {
		...access,
		myGroups,
		code,
		invite,
		groupTheme,
		tableMembers,
		nights,
		nightGames: reads.nightGames,
		hasPastNight: reads.pastNight != null,
		mayPlanNights: mayPlan,
		myId: event.locals.user?.id ?? null,
		// A member without a PIN is nudged on the shelf to set one (D47, D48).
		myPinSet: access.role && event.locals.user ? extras.pinSetAt != null : true,
		// Where the group talks (D78), for full members only (D79), and whether the shelf mentions it to someone new.
		...chatForViewer({ role: access.standing === 'full' ? access.role : null, readonly: access.readonly, joinedAt: extras.joinedAt }, extras.chatUrl, Date.now()),
		waiting,
		probation: access.role && access.standing === 'full' ? extras.probation : false,
		// Other members' profiles (D79); see profileHref.
		profilesOpen: access.standing === 'full',
		// The shelf asks for BGG details older than 30 days to be fetched again (D80): with BGG on, for a
		// member who can fill their shelf here (not the demo, an archived or suspended group, or while suspended).
		bggRefresh: event.locals.config.bggMode !== 'off' && access.role != null && access.shelfOpen,
		contact: event.locals.config.instanceContact,
		pendingDetails: reads.pending,
		myPlaySoon: reads.myPlaySoon,
		// What Play tonight calls a filler in this group, and how far back "Not played lately" looks (D71).
		filler: extras.filler,
		staleDays: extras.staleDays,
		// When who's here and kept games reset on a device (D36, D71).
		hereResetMs: event.locals.config.hereResetHours * 3_600_000
	};
};
