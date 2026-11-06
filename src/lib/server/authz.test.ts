import { beforeEach, describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createTestDb } from './testing/d1.ts';
import { run } from './db.ts';
import { requireActiveMember } from './authz.ts';
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
		expect(await refused?.json()).toEqual({ error: 'This group is suspended' });
		expect((await refuseInactive(as('bo'), db, 42))?.status).toBe(403);
	});
});
