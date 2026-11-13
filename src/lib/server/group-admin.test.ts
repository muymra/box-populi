import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, deletePersonStatements, one, run } from './db.ts';
import {
	archiveGroup,
	claimOwnership,
	deleteGroup,
	ownerAway,
	restoreGroup,
	memberActions,
	regenerateCode,
	removeMember,
	renameGroup,
	setCoAdmin,
	transferOwnership,
	setGroupTheme,
	setGroupChat,
	setProbation,
	letIn,
	suspendMember,
	reinstateMember,
	memberPlace,
	setFillerRule,
	setStaleDays,
	groupThemeFor,
	type Actor
} from './group-admin.ts';
import { lastActive } from '../time.ts';
import { joinGroup } from './groups.ts';

let db: ReturnType<typeof createTestDb>;

const owner: Actor = { id: 'ada', role: 'owner' };
const admin: Actor = { id: 'cy', role: 'admin' };
const member: Actor = { id: 'bo', role: 'member' };

const roles = async () =>
	Object.fromEntries((await all<{ user_id: string; role: string }>(db, "SELECT user_id, role FROM memberships WHERE group_id = 'g1'")).map((r) => [r.user_id, r.role]));
const version = async () => (await one<{ v: number }>(db, "SELECT catalog_version AS v FROM groups WHERE id = 'g1'"))?.v;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('di', 'Di', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'Thursday Club', 'AAAAA', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'admin', 2, 0), ('g1', 'di', 'member', 3, 0)`
	);
});

describe('memberActions', () => {
	it('offers each actor only what the role table allows', () => {
		const full = 'full' as const;
		expect(memberActions(owner, { id: 'bo', role: 'member', standing: full })).toEqual(['promote', 'transfer_ownership', 'remove_member', 'suspend_member']);
		expect(memberActions(owner, { id: 'cy', role: 'admin', standing: full })).toEqual(['demote', 'transfer_ownership', 'remove_member', 'suspend_member']);
		expect(memberActions(owner, { id: 'ada', role: 'owner', standing: full })).toEqual([]);
		expect(memberActions(admin, { id: 'bo', role: 'member', standing: full })).toEqual(['remove_member', 'suspend_member']);
		expect(memberActions(admin, { id: 'ada', role: 'owner', standing: full })).toEqual([]);
		expect(memberActions({ id: 'zz', role: 'admin' }, { id: 'cy', role: 'admin', standing: full })).toEqual([]);
		expect(memberActions(member, { id: 'di', role: 'member', standing: full })).toEqual([]);
	});

	it('lets someone waiting in or out, and keeps a role for full members (D79)', () => {
		expect(memberActions(owner, { id: 'bo', role: 'member', standing: 'waiting' })).toEqual(['remove_member', 'let_in']);
		expect(memberActions(admin, { id: 'bo', role: 'member', standing: 'waiting' })).toEqual(['remove_member', 'let_in']);
		expect(memberActions(member, { id: 'bo', role: 'member', standing: 'waiting' })).toEqual([]);
		expect(memberActions(owner, { id: 'bo', role: 'member', standing: 'suspended' })).toEqual(['remove_member', 'suspend_member']);
		expect(memberActions(owner, { id: 'cy', role: 'admin', standing: 'suspended' })).toEqual(['demote', 'remove_member', 'suspend_member']);
	});
});

describe('rename and code', () => {
	it('lets admins rename with a valid name and bumps the catalog', async () => {
		const before = await version();
		expect(await renameGroup(db, 'g1', admin, '  Friday   Club ')).toEqual({ ok: true });
		expect((await one<{ name: string }>(db, "SELECT name FROM groups WHERE id = 'g1'"))?.name).toBe('Friday Club');
		expect(await version()).toBe((before ?? 0) + 1);
		expect((await renameGroup(db, 'g1', admin, '')).ok).toBe(false);
		expect((await renameGroup(db, 'g1', member, 'Mine now')).ok).toBe(false);
	});

	it('replaces the code for admins only', async () => {
		const result = await regenerateCode(db, 'g1', admin);
		expect(result.ok).toBe(true);
		const row = await one<{ code: string; link_key: string | null }>(db, "SELECT code, link_key FROM groups WHERE id = 'g1'");
		expect(row?.code).toBe(result.code);
		expect(row?.code).not.toBe('AAAAA');
		expect(row?.link_key).toMatch(/^[0-9a-f]{20}$/); // the invite link's key is replaced too (D65)
		expect((await regenerateCode(db, 'g1', member)).ok).toBe(false);
	});
});

describe('roles', () => {
	it('lets the owner promote and demote, and nobody else', async () => {
		expect(await setCoAdmin(db, 'g1', owner, 'bo', true)).toEqual({ ok: true });
		expect(await setCoAdmin(db, 'g1', owner, 'cy', false)).toEqual({ ok: true });
		expect(await roles()).toMatchObject({ bo: 'admin', cy: 'member' });
		expect((await setCoAdmin(db, 'g1', { id: 'bo', role: 'admin' }, 'di', true)).ok).toBe(false);
		expect((await setCoAdmin(db, 'g1', owner, 'ada', false)).ok).toBe(false);
		expect((await setCoAdmin(db, 'g1', owner, 'nobody', true)).ok).toBe(false);
	});

	it('hands over ownership and makes the old owner a co-admin', async () => {
		// The new owner's name has to be typed first.
		expect((await transferOwnership(db, 'g1', owner, 'bo', 'Cy')).ok).toBe(false);
		expect((await transferOwnership(db, 'g1', owner, 'bo', '')).ok).toBe(false);
		expect(await roles()).toMatchObject({ ada: 'owner', bo: 'member' });
		expect(await transferOwnership(db, 'g1', owner, 'bo', ' bo ')).toEqual({ ok: true });
		expect(await roles()).toMatchObject({ ada: 'admin', bo: 'owner' });
		expect((await transferOwnership(db, 'g1', { id: 'ada', role: 'admin' }, 'di', 'Di')).ok).toBe(false);
	});
});

describe('removing members', () => {
	it('follows the table: admins remove members, the owner removes anyone but themselves', async () => {
		expect((await removeMember(db, 'g1', admin, 'ada')).ok).toBe(false);
		expect((await removeMember(db, 'g1', { id: 'zz', role: 'admin' }, 'cy')).ok).toBe(false);
		expect((await removeMember(db, 'g1', member, 'di')).ok).toBe(false);
		expect((await removeMember(db, 'g1', owner, 'ada')).ok).toBe(false);
		expect(await removeMember(db, 'g1', admin, 'bo')).toEqual({ ok: true });
		expect(await removeMember(db, 'g1', owner, 'cy')).toEqual({ ok: true });
		expect(Object.keys(await roles()).sort()).toEqual(['ada', 'di']);
		expect(await removeMember(db, 'g1', owner, 'bo')).toEqual({ ok: false, error: expect.stringMatching(/isn’t in this group/) });
	});
});

describe('archiving the group', () => {
	it('lets the owner archive and restore, and records who and when', async () => {
		expect((await archiveGroup(db, 'g1', member, 5, 60)).ok).toBe(false);
		expect(await archiveGroup(db, 'g1', owner, 5, 60)).toEqual({ ok: true });
		expect(await one(db, "SELECT archived_at, archived_by FROM groups WHERE id = 'g1'")).toEqual({ archived_at: 5, archived_by: 'ada' });
		expect((await archiveGroup(db, 'g1', owner, 6, 60)).ok).toBe(false);
		expect((await restoreGroup(db, 'g1', member, 7, 60)).ok).toBe(false);
		expect(await restoreGroup(db, 'g1', owner, 7, 60)).toEqual({ ok: true });
		expect(await one(db, "SELECT archived_at, archived_by FROM groups WHERE id = 'g1'")).toEqual({ archived_at: null, archived_by: null });
		expect((await restoreGroup(db, 'g1', owner, 8, 60)).ok).toBe(false);
	});

	it('lets a co-admin archive and restore only once the owner has been away 60 days', async () => {
		const day = 86_400_000;
		// The owner was last seen at 0.
		expect(await ownerAway(db, 'g1', 59 * day, 60)).toBe(false);
		expect((await archiveGroup(db, 'g1', admin, 59 * day, 60)).ok).toBe(false);
		expect(await ownerAway(db, 'g1', 61 * day, 60)).toBe(true);
		expect(await archiveGroup(db, 'g1', admin, 61 * day, 60)).toEqual({ ok: true });
		expect(await restoreGroup(db, 'g1', admin, 62 * day, 60)).toEqual({ ok: true });
		// Back, the owner takes the decision again.
		await run(db, "UPDATE memberships SET last_seen_at = ?1 WHERE user_id = 'ada'", 62 * day);
		expect((await archiveGroup(db, 'g1', admin, 63 * day, 60)).ok).toBe(false);
	});

	it('waits the instance’s OWNER_AWAY_DAYS instead when it sets one (D71)', async () => {
		const day = 86_400_000;
		expect(await ownerAway(db, 'g1', 11 * day, 10)).toBe(true);
		expect(await ownerAway(db, 'g1', 9 * day, 10)).toBe(false);
		expect(await claimOwnership(db, 'g1', admin, 9 * day, 10)).toMatchObject({ ok: false, error: expect.stringContaining('10 days') });
		expect(await archiveGroup(db, 'g1', admin, 11 * day, 10)).toEqual({ ok: true });
		expect(await restoreGroup(db, 'g1', admin, 12 * day, 10)).toEqual({ ok: true });
		expect(await claimOwnership(db, 'g1', admin, 12 * day, 10)).toEqual({ ok: true });
	});
});

describe('group chat', () => {
	it('lets co-admins and the owner set, change and clear it, as a cleaned https address (D78)', async () => {
		const chat = async () => (await one<{ c: string | null }>(db, "SELECT chat_url AS c FROM groups WHERE id = 'g1'"))?.c;
		expect(await chat()).toBeNull();
		expect((await setGroupChat(db, 'g1', member, 'https://chat.whatsapp.com/abc')).ok).toBe(false);
		expect(await setGroupChat(db, 'g1', admin, ' discord.gg/abc ')).toEqual({ ok: true });
		expect(await chat()).toBe('https://discord.gg/abc');
		for (const bad of ['http://discord.gg/abc', 'javascript:alert(1)', 'not a link', null]) expect((await setGroupChat(db, 'g1', owner, bad)).ok).toBe(false);
		expect(await chat()).toBe('https://discord.gg/abc');
		expect(await setGroupChat(db, 'g1', owner, '')).toEqual({ ok: true });
		expect(await chat()).toBeNull();
	});
});

describe('not played lately', () => {
	it('looks back 90 days until co-admins or the owner change it (D71)', async () => {
		const days = async () => (await one<{ d: number }>(db, "SELECT stale_days AS d FROM groups WHERE id = 'g1'"))?.d;
		expect(await days()).toBe(90);
		expect((await setStaleDays(db, 'g1', member, '30')).ok).toBe(false);
		for (const bad of ['6', '731', '30.5', '', 'month', null]) expect((await setStaleDays(db, 'g1', admin, bad)).ok).toBe(false);
		expect(await setStaleDays(db, 'g1', admin, ' 30 ')).toEqual({ ok: true });
		expect(await days()).toBe(30);
	});
});

describe('fillers', () => {
	const rule = async () => one<{ m: number; w: number }>(db, "SELECT filler_max_minutes AS m, filler_max_weight AS w FROM groups WHERE id = 'g1'");
	it('starts at 30 minutes and under 2, and takes co-admins’ and the owner’s changes (D71)', async () => {
		expect(await rule()).toEqual({ m: 30, w: 2 });
		expect((await setFillerRule(db, 'g1', member, '45', '2.5')).ok).toBe(false);
		for (const [m, w] of [['4', '2'], ['241', '2'], ['30.5', '2'], ['', '2'], ['30', '0.5'], ['30', '5.5'], ['30', 'light'], [null, null]]) {
			expect((await setFillerRule(db, 'g1', admin, m, w)).ok).toBe(false);
		}
		expect(await setFillerRule(db, 'g1', admin, ' 45 ', '2,54')).toEqual({ ok: true });
		expect(await rule()).toEqual({ m: 45, w: 2.5 });
		expect(await setFillerRule(db, 'g1', owner, '20', '5')).toEqual({ ok: true });
		expect(await rule()).toEqual({ m: 20, w: 5 });
	});
});

describe('taking over as owner', () => {
	const day = 86_400_000;
	it('lets a co-admin take over once the owner has been away 60 days; the owner becomes a co-admin', async () => {
		expect((await claimOwnership(db, 'g1', member, 61 * day, 60)).ok).toBe(false);
		expect((await claimOwnership(db, 'g1', owner, 61 * day, 60)).ok).toBe(false);
		expect(await claimOwnership(db, 'g1', admin, 59 * day, 60)).toMatchObject({ ok: false, error: expect.stringContaining('60 days') });
		expect(await roles()).toMatchObject({ ada: 'owner', cy: 'admin' });
		const before = await version();
		expect(await claimOwnership(db, 'g1', admin, 61 * day, 60)).toEqual({ ok: true });
		expect(await roles()).toEqual({ ada: 'admin', bo: 'member', cy: 'owner', di: 'member' });
		expect(await version()).toBeGreaterThan(before!);
		expect(await one(db, "SELECT last_seen_at FROM memberships WHERE group_id = 'g1' AND user_id = 'cy'")).toEqual({ last_seen_at: 61 * day });
	});

	it('leaves a second co-admin to wait 60 days from the first one taking over', async () => {
		await run(db, "UPDATE memberships SET role = 'admin' WHERE user_id = 'di'");
		expect(await claimOwnership(db, 'g1', admin, 61 * day, 60)).toEqual({ ok: true });
		expect((await claimOwnership(db, 'g1', { id: 'di', role: 'admin' }, 62 * day, 60)).ok).toBe(false);
		expect(await roles()).toMatchObject({ cy: 'owner', di: 'admin' });
	});
});

describe('deleting the group', () => {
	it('needs the owner and the typed name, and takes the group’s links with it', async () => {
		await run(db, `INSERT INTO games (id, name, search_text, is_manual) VALUES (1, 'G', 'g', 1)`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0)`);
		await run(db, `INSERT INTO game_links (group_id, game_id, kind, url, added_by, added_at) VALUES ('g1', 1, 'rules', 'https://example.com/', 'bo', 0)`);
		expect((await deleteGroup(db, 'g1', admin, 'Thursday Club')).ok).toBe(false);
		// Only once it's archived (D50).
		expect(await deleteGroup(db, 'g1', owner, 'Thursday Club')).toMatchObject({ ok: false, error: expect.stringContaining('Archive') });
		expect(await archiveGroup(db, 'g1', owner, 5, 60)).toEqual({ ok: true });
		expect((await deleteGroup(db, 'g1', admin, 'Thursday Club')).ok).toBe(false);
		expect((await deleteGroup(db, 'g1', owner, 'Thursday')).ok).toBe(false);
		expect(await deleteGroup(db, 'g1', owner, ' thursday  club ')).toEqual({ ok: true });
		// A group the host suspended can be deleted without archiving.
		await run(db, `INSERT INTO groups (id, name, code, created_at, suspended_at) VALUES ('g9', 'Closed', 'ZZZZZ', 0, 1)`);
		expect(await deleteGroup(db, 'g9', owner, 'Closed')).toEqual({ ok: true });
		expect(await all(db, 'SELECT id FROM groups')).toEqual([]);
		expect(await all(db, 'SELECT * FROM memberships')).toEqual([]);
		expect(await all(db, 'SELECT * FROM game_links')).toEqual([]);
		expect(await all(db, 'SELECT user_id FROM copies')).toEqual([{ user_id: 'bo' }]);
	});
});

describe('lastActive', () => {
	const now = 1_800_000_000_000;
	const day = 86_400_000;
	it('reads coarsely', () => {
		expect(lastActive(now - 1000, now)).toBe('active today');
		expect(lastActive(now - day, now)).toBe('active yesterday');
		expect(lastActive(now - 5 * day, now)).toBe('active 5 days ago');
		expect(lastActive(now - 21 * day, now)).toBe('active 3 weeks ago');
		expect(lastActive(now - 100 * day, now)).toBe('active 3 months ago');
		expect(lastActive(now - 400 * day, now)).toBe('active a year ago');
	});
});

describe('group themes', () => {
	it('lets co-admins and the owner set it, shows it only to members, and clears with empty', async () => {
		expect((await setGroupTheme(db, 'g1', member, 'nord')).ok).toBe(false);
		expect((await setGroupTheme(db, 'g1', admin, 'comic-sans')).ok).toBe(false);
		expect(await setGroupTheme(db, 'g1', admin, 'nord')).toEqual({ ok: true });
		expect(await groupThemeFor(db, 'g1', 'bo')).toBe('nord');
		expect(await groupThemeFor(db, 'g1', 'stranger')).toBeNull();
		expect(await groupThemeFor(db, 'g1', null)).toBeNull();
		expect(await setGroupTheme(db, 'g1', owner, '')).toEqual({ ok: true });
		expect(await groupThemeFor(db, 'g1', 'bo')).toBeNull();
	});
});

describe('probation and suspending (D79)', () => {
	const place = (id: string) => memberPlace(db, 'g1', id);
	const join = async (id: string) => {
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('${id}', '${id}', 0)`);
		await joinGroup(db, { groupId: 'g1', userId: id, now: 1000 });
	};

	it('lets people straight in until the group turns probation on, then makes them wait', async () => {
		await join('ed');
		expect(await place('ed')).toEqual({ role: 'member', standing: 'full' });
		expect((await setProbation(db, 'g1', member, 'on', false)).ok).toBe(false);
		expect((await setProbation(db, 'g1', admin, 'maybe', false)).ok).toBe(false);
		expect(await setProbation(db, 'g1', admin, 'on', false)).toEqual({ ok: true });
		await join('fi');
		expect(await place('fi')).toEqual({ role: 'member', standing: 'waiting' });
	});

	it('lets someone waiting in, by the owner or a co-admin only', async () => {
		await setProbation(db, 'g1', owner, 'on', false);
		await join('fi');
		expect((await letIn(db, 'g1', member, 'fi')).ok).toBe(false);
		expect((await letIn(db, 'g1', admin, 'bo')).ok).toBe(false); // Bo isn't waiting
		expect(await letIn(db, 'g1', admin, 'fi')).toEqual({ ok: true });
		expect((await place('fi'))?.standing).toBe('full');
	});

	it('turns probation off only with a confirmation when people are waiting, and lets them all in', async () => {
		await setProbation(db, 'g1', owner, 'on', false);
		await join('fi');
		await join('gu');
		const refused = await setProbation(db, 'g1', owner, 'off', false);
		expect(refused).toEqual({ ok: false, error: '2 people are waiting. Turning this off lets them in; confirm to go ahead.' });
		expect((await place('fi'))?.standing).toBe('waiting');
		expect(await setProbation(db, 'g1', owner, 'off', true)).toEqual({ ok: true, letIn: 2 });
		expect((await place('fi'))?.standing).toBe('full');
		expect((await place('gu'))?.standing).toBe('full');
		expect((await one<{ p: number }>(db, "SELECT probation AS p FROM groups WHERE id = 'g1'"))?.p).toBe(0);
		// With nobody waiting there's nothing to confirm.
		await setProbation(db, 'g1', owner, 'on', false);
		expect(await setProbation(db, 'g1', owner, 'off', false)).toEqual({ ok: true, letIn: 0 });
	});

	it('suspends and reinstates whom removing reaches, keeping a note until then', async () => {
		expect((await suspendMember(db, 'g1', member, 'di', '')).ok).toBe(false);
		expect((await suspendMember(db, 'g1', admin, 'ada', '')).ok).toBe(false); // the owner
		expect((await suspendMember(db, 'g1', admin, 'cy', '')).ok).toBe(false); // themselves
		expect((await suspendMember(db, 'g1', admin, 'bo', 'x'.repeat(201))).ok).toBe(false);
		expect(await suspendMember(db, 'g1', admin, 'bo', '  Talk  to me ', 50)).toEqual({ ok: true });
		const row = async () => one<{ at: number | null; by: string | null; note: string | null }>(db, "SELECT suspended_at AS at, suspended_by AS by, suspended_note AS note FROM memberships WHERE group_id = 'g1' AND user_id = 'bo'");
		expect(await row()).toEqual({ at: 50, by: 'cy', note: 'Talk to me' });
		expect((await suspendMember(db, 'g1', admin, 'bo', '')).ok).toBe(false); // already
		expect((await reinstateMember(db, 'g1', admin, 'di')).ok).toBe(false); // not suspended
		expect(await reinstateMember(db, 'g1', owner, 'bo')).toEqual({ ok: true });
		expect(await row()).toEqual({ at: null, by: null, note: null });
		// A co-admin can't suspend another; the owner can.
		expect((await suspendMember(db, 'g1', { id: 'zz', role: 'admin' }, 'cy', '')).ok).toBe(false);
		expect((await suspendMember(db, 'g1', owner, 'cy', '')).ok).toBe(true);
		// A suspended co-admin can't be made the owner.
		expect((await transferOwnership(db, 'g1', owner, 'cy', 'Cy')).ok).toBe(false);
	});

	it('forgets who suspended someone when that person deletes their account', async () => {
		await suspendMember(db, 'g1', admin, 'bo', '');
		await db.batch(deletePersonStatements(db, 'cy'));
		expect(await one(db, "SELECT suspended_at AS at, suspended_by AS by FROM memberships WHERE group_id = 'g1' AND user_id = 'bo'")).toEqual({ at: expect.any(Number), by: null });
	});
});

