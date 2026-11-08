import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
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
	groupThemeFor,
	type Actor
} from './group-admin.ts';
import { lastActive } from '../time.ts';

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
		expect(memberActions(owner, { id: 'bo', role: 'member' })).toEqual(['promote', 'transfer_ownership', 'remove_member']);
		expect(memberActions(owner, { id: 'cy', role: 'admin' })).toEqual(['demote', 'transfer_ownership', 'remove_member']);
		expect(memberActions(owner, { id: 'ada', role: 'owner' })).toEqual([]);
		expect(memberActions(admin, { id: 'bo', role: 'member' })).toEqual(['remove_member']);
		expect(memberActions(admin, { id: 'ada', role: 'owner' })).toEqual([]);
		expect(memberActions({ id: 'zz', role: 'admin' }, { id: 'cy', role: 'admin' })).toEqual([]);
		expect(memberActions(member, { id: 'di', role: 'member' })).toEqual([]);
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
		const code = (await one<{ code: string }>(db, "SELECT code FROM groups WHERE id = 'g1'"))?.code;
		expect(code).toBe(result.code);
		expect(code).not.toBe('AAAAA');
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
		expect((await archiveGroup(db, 'g1', member, 5)).ok).toBe(false);
		expect(await archiveGroup(db, 'g1', owner, 5)).toEqual({ ok: true });
		expect(await one(db, "SELECT archived_at, archived_by FROM groups WHERE id = 'g1'")).toEqual({ archived_at: 5, archived_by: 'ada' });
		expect((await archiveGroup(db, 'g1', owner, 6)).ok).toBe(false);
		expect((await restoreGroup(db, 'g1', member, 7)).ok).toBe(false);
		expect(await restoreGroup(db, 'g1', owner, 7)).toEqual({ ok: true });
		expect(await one(db, "SELECT archived_at, archived_by FROM groups WHERE id = 'g1'")).toEqual({ archived_at: null, archived_by: null });
		expect((await restoreGroup(db, 'g1', owner, 8)).ok).toBe(false);
	});

	it('lets a co-admin archive and restore only once the owner has been away 60 days', async () => {
		const day = 86_400_000;
		// The owner was last seen at 0.
		expect(await ownerAway(db, 'g1', 59 * day)).toBe(false);
		expect((await archiveGroup(db, 'g1', admin, 59 * day)).ok).toBe(false);
		expect(await ownerAway(db, 'g1', 61 * day)).toBe(true);
		expect(await archiveGroup(db, 'g1', admin, 61 * day)).toEqual({ ok: true });
		expect(await restoreGroup(db, 'g1', admin, 62 * day)).toEqual({ ok: true });
		// Back, the owner takes the decision again.
		await run(db, "UPDATE memberships SET last_seen_at = ?1 WHERE user_id = 'ada'", 62 * day);
		expect((await archiveGroup(db, 'g1', admin, 63 * day)).ok).toBe(false);
	});
});

describe('taking over as owner', () => {
	const day = 86_400_000;
	it('lets a co-admin take over once the owner has been away 60 days; the owner becomes a co-admin', async () => {
		expect((await claimOwnership(db, 'g1', member, 61 * day)).ok).toBe(false);
		expect((await claimOwnership(db, 'g1', owner, 61 * day)).ok).toBe(false);
		expect(await claimOwnership(db, 'g1', admin, 59 * day)).toMatchObject({ ok: false, error: expect.stringContaining('60 days') });
		expect(await roles()).toMatchObject({ ada: 'owner', cy: 'admin' });
		const before = await version();
		expect(await claimOwnership(db, 'g1', admin, 61 * day)).toEqual({ ok: true });
		expect(await roles()).toEqual({ ada: 'admin', bo: 'member', cy: 'owner', di: 'member' });
		expect(await version()).toBeGreaterThan(before!);
		expect(await one(db, "SELECT last_seen_at FROM memberships WHERE group_id = 'g1' AND user_id = 'cy'")).toEqual({ last_seen_at: 61 * day });
	});

	it('leaves a second co-admin to wait 60 days from the first one taking over', async () => {
		await run(db, "UPDATE memberships SET role = 'admin' WHERE user_id = 'di'");
		expect(await claimOwnership(db, 'g1', admin, 61 * day)).toEqual({ ok: true });
		expect((await claimOwnership(db, 'g1', { id: 'di', role: 'admin' }, 62 * day)).ok).toBe(false);
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
		expect(await archiveGroup(db, 'g1', owner, 5)).toEqual({ ok: true });
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
