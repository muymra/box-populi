import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { addLink, canDeleteLink, deleteLink, MAX_LINKS_PER_GAME, parseLink, type LinkInput } from './links.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};
const parsed = (fields: Record<string, string>) => {
	const result = parseLink(form(fields));
	if (!result.ok) throw new Error(result.error);
	return result.value;
};
const errorOf = (fields: Record<string, string>) => {
	const result = parseLink(form(fields));
	return result.ok ? null : result.error;
};

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'admin', 2, 0), ('g2', 'out', 'owner', 0, 0)`
	);
	await run(db, `INSERT INTO games (id, name, search_text, is_manual) VALUES (1, 'Owned', 'owned', 1), (2, 'Elsewhere', 'elsewhere', 1)`);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('out', 2, 0)`);
});

describe('parseLink', () => {
	it('normalizes web addresses and adds https to bare ones', () => {
		expect(parsed({ url: ' HTTPS://Example.com/Rules.pdf ', kind: 'rules' }).url).toBe('https://example.com/Rules.pdf');
		expect(parsed({ url: 'example.com/how-to-play' }).url).toBe('https://example.com/how-to-play');
		expect(parsed({ url: 'http://example.com' }).url).toBe('http://example.com/');
	});

	it('refuses anything that is not a web address', () => {
		expect(errorOf({ url: 'javascript:alert(1)' })).toMatch(/http or https/);
		expect(errorOf({ url: 'data:text/html,hi' })).toMatch(/http or https/);
		expect(errorOf({ url: 'ftp://example.com/rules.pdf' })).toMatch(/http or https/);
		expect(errorOf({ url: 'not a url' })).toMatch(/web address/);
		expect(errorOf({ url: 'localhost' })).toMatch(/web address/);
		expect(errorOf({ url: 'https://me:secret@example.com/' })).toMatch(/password/);
		expect(errorOf({ url: '' })).toMatch(/Paste/);
		expect(errorOf({ url: `https://example.com/${'a'.repeat(2000)}` })).toMatch(/too long/);
	});

	it('takes the kind from the form, or guesses it from the address', () => {
		expect(parsed({ url: 'https://example.com/x', kind: 'video' }).kind).toBe('video');
		expect(parsed({ url: 'https://www.youtube.com/watch?v=abc' }).kind).toBe('video');
		expect(parsed({ url: 'https://youtu.be/abc', kind: 'nonsense' }).kind).toBe('video');
		expect(parsed({ url: 'https://example.com/files/RULES.PDF' }).kind).toBe('rules');
		expect(parsed({ url: 'https://example.com/faq' }).kind).toBe('other');
	});

	it('tidies the optional title', () => {
		expect(parsed({ url: 'example.com', title: '  Official   rules ' }).title).toBe('Official rules');
		expect(parsed({ url: 'example.com', title: '   ' }).title).toBeNull();
		expect(errorOf({ url: 'example.com', title: 'x'.repeat(101) })).toMatch(/title/);
	});
});

const rules: LinkInput = { kind: 'rules', title: 'Rules', url: 'https://example.com/rules.pdf' };

describe('addLink', () => {
	it('adds a link to a game someone in the group owns', async () => {
		const result = await addLink(db, 'g1', 1, 'ada', rules, NOW);
		expect(result.ok).toBe(true);
		expect(await all(db, 'SELECT group_id, game_id, kind, title, url, added_by, added_at FROM game_links')).toEqual([
			{ group_id: 'g1', game_id: 1, kind: 'rules', title: 'Rules', url: rules.url, added_by: 'ada', added_at: NOW }
		]);
	});

	it('refuses games the group can’t see, duplicates, and more than the cap', async () => {
		expect(await addLink(db, 'g1', 2, 'ada', rules, NOW)).toMatchObject({ ok: false, status: 404 });
		await addLink(db, 'g1', 1, 'ada', rules, NOW);
		expect(await addLink(db, 'g1', 1, 'bo', rules, NOW)).toMatchObject({ ok: false, status: 409 });
		for (let i = 1; i < MAX_LINKS_PER_GAME; i++) await addLink(db, 'g1', 1, 'bo', { ...rules, url: `https://example.com/${i}` }, NOW);
		expect(await addLink(db, 'g1', 1, 'bo', { ...rules, url: 'https://example.com/one-more' }, NOW)).toMatchObject({ ok: false, status: 400 });
	});

	it('keeps each group’s links to itself', async () => {
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('out', 1, 0)`);
		await addLink(db, 'g1', 1, 'ada', rules, NOW);
		expect((await addLink(db, 'g2', 1, 'out', rules, NOW)).ok).toBe(true);
		expect(await all(db, 'SELECT group_id FROM game_links ORDER BY group_id')).toEqual([{ group_id: 'g1' }, { group_id: 'g2' }]);
	});
});

describe('deleting links', () => {
	it('follows the role table: the adder, a co-admin or the owner', () => {
		expect(canDeleteLink({ id: 'bo', role: 'member' }, 'bo')).toBe(true);
		expect(canDeleteLink({ id: 'bo', role: 'member' }, 'ada')).toBe(false);
		expect(canDeleteLink({ id: 'bo', role: 'member' }, null)).toBe(false);
		expect(canDeleteLink({ id: 'cy', role: 'admin' }, 'bo')).toBe(true);
		expect(canDeleteLink({ id: 'ada', role: 'owner' }, null)).toBe(true);
	});

	it('deletes only this group’s link for this game, and only when allowed', async () => {
		const added = await addLink(db, 'g1', 1, 'ada', rules, NOW);
		if (!added.ok) throw new Error(added.error);
		expect(await deleteLink(db, 'g1', 1, added.id, { id: 'bo', role: 'member' })).toBe(false);
		expect(await deleteLink(db, 'g2', 1, added.id, { id: 'out', role: 'owner' })).toBe(false);
		expect(await deleteLink(db, 'g1', 2, added.id, { id: 'ada', role: 'owner' })).toBe(false);
		expect(await deleteLink(db, 'g1', 1, added.id, { id: 'cy', role: 'admin' })).toBe(true);
		expect(await all(db, 'SELECT id FROM game_links')).toEqual([]);
	});
});
