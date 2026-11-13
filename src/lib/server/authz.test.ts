import { beforeEach, describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createTestDb } from './testing/d1.ts';
import { one, run } from './db.ts';
import { readGroup, requireActiveMember, requireRead, requireRole } from './authz.ts';
import { refuseInactive } from './bgg/http.ts';

let db: ReturnType<typeof createTestDb>;

const as = (userId: string) =>
	({ locals: { user: { id: userId, name: userId } }, url: new URL('https://example.test/api/bgg/hydrate') }) as unknown as RequestEvent;

const status = (work: Promise<unknown>) =>
	work.then(
		() => 'ok',
		(e: { status?: number }) => e.status
	);

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0)`);
	await run(
		db,
		`INSERT INTO groups (id, name, code, created_at, is_demo, suspended_at) VALUES
		 ('open', 'Open', 'AAAAA', 0, 0, NULL), ('shut', 'Shut', 'BBBBB', 0, 0, 5), ('demo', 'Demo', 'CCCCC', 0, 1, NULL)`
	);
	// Ada is in an open group and a suspended one; Bo only in the suspended one and the demo; Cy in none.
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('open', 'ada', 'owner', 0, 0), ('shut', 'ada', 'member', 0, 0), ('shut', 'bo', 'owner', 0, 0), ('demo', 'bo', 'owner', 0, 0)`
	);
});

describe('requireActiveMember', () => {
	it('checks the group the page sent like requireRole(member)', async () => {
		expect(await status(requireActiveMember(as('ada'), db, 'open'))).toBe('ok');
		expect(await status(requireActiveMember(as('ada'), db, 'shut'))).toBe(403);
		expect(await status(requireActiveMember(as('bo'), db, 'demo'))).toBe(403);
		expect(await status(requireActiveMember(as('bo'), db, 'open'))).toBe(404);
	});

	it('without a group, needs one membership that is neither suspended nor the demo', async () => {
		expect(await status(requireActiveMember(as('ada'), db, null))).toBe('ok');
		expect(await status(requireActiveMember(as('bo'), db, null))).toBe(403);
		expect(await status(requireActiveMember(as('cy'), db, null))).toBe(403);
	});

	it('answers the JSON endpoints with their usual { error } body', async () => {
		expect(await refuseInactive(as('ada'), db, 'open')).toBeNull();
		expect(await refuseInactive(as('ada'), db, undefined)).toBeNull();
		const refused = await refuseInactive(as('ada'), db, 'shut');
		expect(refused?.status).toBe(403);
		expect(await refused?.json()).toEqual({ error: 'This group is suspended by the host' });
		expect((await refuseInactive(as('bo'), db, 42))?.status).toBe(403);
	});
});

describe('readGroup (D59)', () => {
	const anonymous = { locals: { user: null }, url: new URL('https://example.test/g/demo') } as unknown as RequestEvent;
	const seen = async () => (await one<{ last_seen_at: number }>(db, `SELECT last_seen_at FROM memberships WHERE group_id = 'open' AND user_id = 'ada'`))!.last_seen_at;

	it('reads the group, the role and the layout’s extras in one go', async () => {
		await run(db, `UPDATE groups SET theme = 'nord' WHERE id = 'open'`);
		await run(db, `UPDATE users SET pin_set_at = 123 WHERE id = 'ada'`);
		await run(db, `UPDATE groups SET chat_url = 'https://chat.whatsapp.com/K7M4P' WHERE id = 'open'`);
		const { access, extras } = await readGroup(as('ada'), db, 'open');
		expect(access).toMatchObject({ role: 'owner', readonly: false, group: { id: 'open', isDemo: false } });
		expect(extras).toEqual({
			code: 'AAAAA',
			linkKey: null,
			theme: 'nord',
			pinSetAt: 123,
			nightsBy: 'members',
			filler: { maxMinutes: 30, maxWeight: 2 },
			staleDays: 90,
			catalogVersion: 0,
			chatUrl: 'https://chat.whatsapp.com/K7M4P',
			joinedAt: 0,
			probation: false
		});
		expect(await requireRead(as('ada'), db, 'open')).toEqual(access);
	});

	it('keeps the demo open to anyone, with no role for visitors, and hides other groups', async () => {
		expect((await readGroup(anonymous, db, 'demo')).access).toMatchObject({ role: null, readonly: true });
		expect((await readGroup(as('bo'), db, 'demo')).access.role).toBe('owner');
		expect(await status(readGroup(as('cy'), db, 'open'))).toBe(404);
		expect(await status(readGroup(as('ada'), db, 'nope'))).toBe(404);
		expect(await status(readGroup(anonymous, db, 'open'))).toBe(303);
	});

	it('writes last_seen_at only when it’s over an hour old', async () => {
		await readGroup(as('ada'), db, 'open');
		const first = await seen();
		expect(first).toBeGreaterThan(0);
		await readGroup(as('ada'), db, 'open');
		expect(await seen()).toBe(first);
	});
});


describe('readGroup on one request (D65)', () => {
	it('asks the database once for a GET, whichever loads check, and afresh on a POST', async () => {
		await run(db, 'UPDATE memberships SET last_seen_at = ?1', Date.now()); // no "last active" write to count
		let calls = 0;
		const counting = new Proxy(db, {
			get(target, key) {
				if (key === 'prepare') return (sql: string) => (calls++, target.prepare(sql));
				const value = Reflect.get(target, key);
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
		const request = (method: string) => {
			const locals = { user: { id: 'ada', name: 'ada' } };
			return { locals, request: new Request('https://example.test/g/open', { method }), url: new URL('https://example.test/g/open') } as unknown as RequestEvent;
		};
		const get = request('GET');
		const [layout, page] = await Promise.all([readGroup(get, counting, 'open'), readGroup(get, counting, 'open')]);
		expect(page).toBe(layout);
		expect(calls).toBe(1);
		const post = request('POST');
		await readGroup(post, counting, 'open');
		await readGroup(post, counting, 'open');
		expect(calls).toBe(3);
	});
});

describe('standing (D79)', () => {
	beforeEach(async () => {
		// Cy waits to be let in to Open; Bo, also in Open now, was suspended there by Ada with a note.
		await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at, waiting_since) VALUES ('open', 'cy', 'member', 0, 0, 10)`);
		await run(
			db,
			`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at, suspended_at, suspended_by, suspended_note) VALUES ('open', 'bo', 'admin', 0, 0, 20, 'ada', 'Talk to me')`
		);
	});

	it('reads someone waiting as read-only, with their shelf open', async () => {
		const { access } = await readGroup(as('cy'), db, 'open');
		expect(access).toMatchObject({ role: 'member', readonly: true, standing: 'waiting', shelfOpen: true, suspension: null });
		expect(await status(requireRole(as('cy'), db, 'open', 'member'))).toBe(403);
		expect(await status(requireRole(as('cy'), db, 'open', 'member', { ownShelf: true }))).toBe('ok');
		expect(await status(requireActiveMember(as('cy'), db, 'open'))).toBe('ok');
		expect(await status(requireActiveMember(as('cy'), db, null))).toBe('ok');
	});

	it('reads a suspended member as read-only, shelf closed, with who suspended them and the note', async () => {
		const { access } = await readGroup(as('bo'), db, 'open');
		expect(access).toMatchObject({ role: 'admin', readonly: true, standing: 'suspended', shelfOpen: false, suspension: { at: 20, byName: 'Ada', note: 'Talk to me' } });
		expect(await status(requireRole(as('bo'), db, 'open', 'member', { ownShelf: true }))).toBe(403);
		expect(await status(requireRole(as('bo'), db, 'open', 'admin'))).toBe(403); // a suspended co-admin can't use the role
		expect(await status(requireActiveMember(as('bo'), db, 'open'))).toBe(403);
	});

	it('keeps the group’s own suspension apart from a member’s', async () => {
		// The membership's suspended_at must not hide the host's on the group, or the other way round.
		expect((await readGroup(as('bo'), db, 'open')).access.group.suspended).toBe(false);
		expect((await readGroup(as('ada'), db, 'shut')).access).toMatchObject({ readonly: true, standing: 'full', shelfOpen: false, group: { suspended: true } });
		expect((await readGroup(as('ada'), db, 'open')).access).toMatchObject({ readonly: false, standing: 'full', shelfOpen: true });
	});
});

