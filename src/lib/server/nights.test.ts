import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { deleteGroupStatements, deletePersonStatements, one, readAll, run } from './db.ts';
import {
	addNightGuest,
	bringCopy,
	bringOther,
	createNight,
	deleteNight,
	loadNights,
	nightAboutRead,
	nightOnlyGames,
	parseNightForm,
	removeNightGuest,
	setGoing,
	setNightPlanners,
	setStayedHome,
	unbring,
	updateNight,
	type Actor
} from './nights.ts';
import { loadPlays, savePlay } from './plays.ts';
import { gameVisibleInGroup } from './games.ts';
import { chatText, cleanDescription, cleanPictures, cleanTime, goingMembers, nightOn, nightOptions, nightPoolIds, type Night } from '#lib/nights.ts';
import { copy, game } from '#lib/catalog/testing.ts';

// These nights are on 2026-11-14; the night actions lock once a night is over (D70), so the clock is pinned before it.
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.UTC(2026, 10, 10, 12));
});
afterEach(() => {
	vi.useRealTimers();
});

describe('night rules', () => {
	const night = (over: Partial<Night> = {}): Night => ({
		id: 'n',
		name: 'Café',
		nightOn: '2026-11-14',
		startsAt: '19:00',
		hostId: null,
		createdBy: 'ada',
		people: [
			{ userId: 'ada', guestName: null, going: true, came: null },
			{ userId: 'bo', guestName: null, going: false, came: null },
			{ userId: null, guestName: 'Sam', going: true, came: null }
		],
		games: [
			{ gameId: 1, broughtBy: 'ada', guestName: null, addedBy: 'ada', stayedHome: false },
			{ gameId: 2, broughtBy: 'gone', guestName: null, addedBy: 'ada', stayedHome: false },
			{ gameId: 3, broughtBy: null, guestName: 'Sam', addedBy: 'ada', stayedHome: false },
			{ gameId: 4, broughtBy: 'ada', guestName: null, addedBy: 'ada', stayedHome: true }
		],
		...over
	});
	const members = new Set(['ada', 'bo', 'cy']);

	it('plays from the bring list, minus what stayed home and what left with a member', () => {
		expect([...nightPoolIds(night(), [], members)].sort()).toEqual([1, 3]);
	});
	it('adds the host’s own copies at a member’s home, but not ones lent out', () => {
		const shelf = [game({ id: 10, copies: [copy('cy')] }), game({ id: 11, copies: [copy('cy', { lentOut: true })] }), game({ id: 12, copies: [copy('bo')] })];
		expect([...nightPoolIds(night({ hostId: 'cy' }), shelf, members)].sort((a, b) => a - b)).toEqual([1, 3, 10]);
	});
	it('lists who’s going and finds tonight', () => {
		expect(goingMembers(night(), members)).toEqual(['ada']);
		expect(nightOn([night()], '2026-11-14')?.id).toBe('n');
		expect(nightOn([night()], '2026-11-15')).toBeNull();
	});
	it('reads start times', () => {
		expect(cleanTime('9:05')).toBe('09:05');
		expect(cleanTime('')).toBeNull();
		expect(cleanTime('25:00')).toBe('bad');
	});
	it('writes the message for the chat', () => {
		const text = chatText(night(), members, { member: (id) => ({ ada: 'Ada', bo: 'Bo' })[id] ?? id, game: (id) => `Game ${id}` }, 'https://x/n');
		expect(text).toBe(['Café: Sat 14 Nov, 19:00', 'Going: Ada, Sam', 'Bringing:', 'Ada: Game 1, Game 4', 'Sam: Game 3', 'https://x/n'].join('\n'));
	});
	it('puts the description and its pictures in the message, set off by a blank line (D77)', () => {
		const names = { member: (id: string) => ({ ada: 'Ada' })[id] ?? id, game: (id: number) => `Game ${id}` };
		const about = { description: 'Doorbell’s broken.\n\nPark round the back.', pictures: ['https://img.example/a.jpg'] };
		const text = chatText(night({ games: [] }), members, names, 'https://x/n', about);
		expect(text).toBe(['Café: Sat 14 Nov, 19:00', 'Doorbell’s broken.', '', 'Park round the back.', 'https://img.example/a.jpg', '', 'Going: Ada, Sam', 'https://x/n'].join('\n'));
		expect(chatText(night({ games: [] }), members, names, 'https://x/n', { description: null, pictures: [] })).toBe(['Café: Sat 14 Nov, 19:00', 'Going: Ada, Sam', 'https://x/n'].join('\n'));
	});
	it('tidies a description as typed (D77)', () => {
		expect(cleanDescription('  Bring snacks.  \r\n\r\n\r\n\r\nParking\tround back  ')).toBe('Bring snacks.\n\nParking round back');
		expect(cleanDescription('a\u0007b\u202Ec')).toBe('abc');
		expect(cleanDescription(' \n ')).toBeNull();
		expect(cleanDescription('x'.repeat(2000))).toHaveLength(2000);
		expect(cleanDescription('x'.repeat(2001))).toBe('long');
	});
	it('takes up to four https picture addresses (D77)', () => {
		expect(cleanPictures('')).toEqual([]);
		expect(cleanPictures(' https://i.example/a.jpg \r\n\nhttps://i.example/b.png https://i.example/a.jpg')).toEqual(['https://i.example/a.jpg', 'https://i.example/b.png']);
		expect(cleanPictures('http://i.example/a.jpg')).toBe('bad');
		expect(cleanPictures('i.example/a.jpg')).toBe('bad');
		expect(cleanPictures('javascript:alert(1)')).toBe('bad');
		expect(cleanPictures('https://me:secret@i.example/a.jpg')).toBe('bad');
		expect(cleanPictures([1, 2, 3, 4, 5].map((n) => `https://i.example/${n}.jpg`).join('\n'))).toBe('many');
	});
});

describe('planning nights', () => {
	let db: ReturnType<typeof createTestDb>;
	const ada: Actor = { id: 'ada', role: 'member' };
	const bo: Actor = { id: 'bo', role: 'member' };
	const cy: Actor = { id: 'cy', role: 'admin' };
	const form = (entries: Record<string, string>) => {
		const f = new FormData();
		for (const [k, v] of Object.entries(entries)) f.append(k, v);
		return f;
	};
	const input = { name: 'Café', nightOn: '2026-11-14', startsAt: '19:00', hostId: null, description: null, pictures: [] as string[] };
	const plan = async (actor = ada) => {
		const r = await createNight(db, 'g1', actor, input);
		if (!r.ok) throw new Error(r.error);
		return r.value;
	};

	beforeEach(async () => {
		db = createTestDb();
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('out', 'Out', 0)`);
		await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
		await run(
			db,
			`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'admin', 2, 0), ('g2', 'out', 'owner', 0, 0)`
		);
		await run(db, `INSERT INTO games (id, name, search_text, is_manual, created_by) VALUES (1, 'Alpha', 'alpha', 1, 'ada'), (2, 'Beta', 'beta', 1, 'bo'), (3, 'Secret', 'secret', 1, 'out')`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('bo', 2, 0), ('out', 3, 0)`);
	});

	it('reads the plan form', () => {
		expect(parseNightForm(form({ name: ' Café ', nightOn: '2026-11-14', startsAt: '19:00', host: '' }))).toEqual({ ok: true, value: input });
		expect(parseNightForm(form({ name: '', nightOn: '2026-11-14' })).ok).toBe(false);
		expect(parseNightForm(form({ name: 'Café', nightOn: '2026-02-30' })).ok).toBe(false);
		expect(parseNightForm(form({ name: 'Café', nightOn: '2026-11-14', startsAt: '7pm' })).ok).toBe(false);
		const about = { name: 'Café', nightOn: '2026-11-14', description: ' Park at the back. ', pictures: 'https://i.example/a.jpg\n' };
		expect(parseNightForm(form(about))).toMatchObject({ ok: true, value: { description: 'Park at the back.', pictures: ['https://i.example/a.jpg'] } });
		expect(parseNightForm(form({ ...about, pictures: 'not an address' }))).toEqual({ ok: false, error: 'Picture addresses start with https://, one per line.' });
		expect(parseNightForm(form({ ...about, description: 'x'.repeat(2001) })).ok).toBe(false);
	});

	it('keeps a description and pictures, changes and clears them, and only for its own group (D77)', async () => {
		const id = await createNight(db, 'g1', ada, { ...input, description: 'Snacks welcome.', pictures: ['https://i.example/a.jpg', 'https://i.example/b.jpg'] });
		if (!id.ok) throw new Error(id.error);
		const about = async (group = 'g1') => (await readAll(db, { a: nightAboutRead(db, group, id.value) })).a;
		expect(await about()).toEqual({ description: 'Snacks welcome.', pictures: ['https://i.example/a.jpg', 'https://i.example/b.jpg'] });
		expect(await about('g2')).toEqual({ description: null, pictures: [] });
		expect((await updateNight(db, 'g1', ada, id.value, { ...input, description: null, pictures: ['https://i.example/c.jpg'] })).ok).toBe(true);
		expect(await about()).toEqual({ description: null, pictures: ['https://i.example/c.jpg'] });
		expect((await updateNight(db, 'g1', ada, id.value, input)).ok).toBe(true);
		expect(await about()).toEqual({ description: null, pictures: [] });
	});

	it('lets any member plan by default, and only co-admins when the group says so', async () => {
		const id = await plan(bo);
		expect((await loadNights(db, 'g1'))[0]).toMatchObject({ id, name: 'Café', createdBy: 'bo', people: [{ userId: 'bo', going: true }] });
		expect((await setNightPlanners(db, 'g1', bo, 'admins')).ok).toBe(false);
		expect((await setNightPlanners(db, 'g1', cy, 'admins')).ok).toBe(true);
		expect((await createNight(db, 'g1', bo, input)).ok).toBe(false);
		expect((await createNight(db, 'g1', cy, input)).ok).toBe(true);
		expect((await createNight(db, 'g1', ada, { ...input, hostId: 'out' })).ok).toBe(false); // host from outside
	});

	it('offers only members who can take part as going, host or players, and keeps what already happened (D79)', async () => {
		const id = await plan();
		const bo1 = { userId: 'bo', guestName: null, place: null, score: null };
		const ada1 = { userId: 'ada', guestName: null, place: null, score: null };
		const play = { playedOn: '2026-11-10', coop: 'won' as const, lowestWins: false, nightId: null };
		const before = await savePlay(db, 'g1', ada, 1, { ...play, players: [ada1, bo1] });
		if (!before.ok) throw new Error(before.error);
		await run(db, `UPDATE memberships SET suspended_at = 5, suspended_by = 'ada' WHERE group_id = 'g1' AND user_id = 'bo'`);
		expect((await setGoing(db, 'g1', cy, id, 'bo', true)).ok).toBe(false);
		expect((await createNight(db, 'g1', ada, { ...input, hostId: 'bo' })).ok).toBe(false);
		expect((await savePlay(db, 'g1', ada, 1, { ...play, players: [ada1, bo1] })).ok).toBe(false); // a new play
		expect((await savePlay(db, 'g1', ada, 1, { ...play, playedOn: '2026-11-09', players: [ada1, bo1] }, before.value)).ok).toBe(true); // an edit keeps them
		await run(db, `UPDATE memberships SET suspended_at = NULL, waiting_since = 5 WHERE group_id = 'g1' AND user_id = 'bo'`);
		expect((await setGoing(db, 'g1', cy, id, 'bo', true)).ok).toBe(false);
		await run(db, `UPDATE memberships SET waiting_since = NULL WHERE group_id = 'g1' AND user_id = 'bo'`);
		expect((await setGoing(db, 'g1', cy, id, 'bo', true)).ok).toBe(true);
	});

	it('lets the planner and co-admins change or delete a night, and keeps its plays', async () => {
		const id = await plan();
		expect((await updateNight(db, 'g1', bo, id, { ...input, name: 'Pub' })).ok).toBe(false);
		expect((await updateNight(db, 'g1', ada, id, { ...input, name: 'Pub', hostId: 'bo' })).ok).toBe(true);
		expect((await loadNights(db, 'g1'))[0]).toMatchObject({ name: 'Pub', hostId: 'bo' });
		await savePlay(db, 'g1', ada, 1, { playedOn: '2026-11-14', coop: 'won', lowestWins: false, nightId: id, players: [{ userId: 'ada', guestName: null, place: null, score: null }] });
		expect((await loadPlays(db, 'g1'))[0].night).toEqual({ id, name: 'Pub' });
		expect((await deleteNight(db, 'g2', ada, id)).ok).toBe(false); // another group can't reach it
		expect((await deleteNight(db, 'g1', cy, id)).ok).toBe(true);
		expect(await loadNights(db, 'g1')).toEqual([]);
		expect((await loadPlays(db, 'g1'))[0].night).toBeNull();
	});

	it('takes answers from each member, and from the planner for others', async () => {
		const id = await plan();
		expect((await setGoing(db, 'g1', bo, id, 'bo', true)).ok).toBe(true);
		expect((await setGoing(db, 'g1', bo, id, 'cy', true)).ok).toBe(false);
		expect((await setGoing(db, 'g1', ada, id, 'cy', false)).ok).toBe(true);
		expect((await setGoing(db, 'g1', ada, id, 'out', true)).ok).toBe(false);
		const people = (await loadNights(db, 'g1'))[0].people;
		expect(people.map((p) => [p.userId, p.going])).toEqual([
			['ada', true],
			['bo', true],
			['cy', false]
		]);
	});

	it('builds the bring list from going members’ copies, and lets owners take theirs off', async () => {
		const id = await plan();
		expect((await bringCopy(db, 'g1', ada, id, 2, 'bo')).ok).toBe(false); // Bo isn't going
		await setGoing(db, 'g1', bo, id, 'bo', true);
		expect((await bringCopy(db, 'g1', ada, id, 2, 'bo')).ok).toBe(true); // Ada adds Bo's copy
		expect((await bringCopy(db, 'g1', ada, id, 2, 'bo')).ok).toBe(false); // already there
		expect((await bringCopy(db, 'g1', ada, id, 1, 'bo')).ok).toBe(false); // not Bo's
		expect((await bringCopy(db, 'g1', cy, id, 1, 'ada')).ok).toBe(true); // Cy isn't going but is a co-admin
		expect((await unbring(db, 'g1', { id: 'cy', role: 'member' }, id, 2)).ok).toBe(false);
		expect((await unbring(db, 'g1', bo, id, 2)).ok).toBe(true); // Bo takes his copy off
		expect((await setStayedHome(db, 'g1', id, 1, true)).ok).toBe(true);
		expect((await loadNights(db, 'g1'))[0].games).toEqual([{ gameId: 1, broughtBy: 'ada', guestName: null, addedBy: 'cy', stayedHome: true }]);
	});

	it('adds a guest’s game by title, reusing a game the group knows, and lets its plays be logged', async () => {
		const id = await plan();
		expect((await addNightGuest(db, 'g1', id, ' Sam ')).ok).toBe(true);
		expect((await addNightGuest(db, 'g1', id, 'sam')).ok).toBe(false);
		const other = (title: string, bringer = 'g:Sam') => bringOther(db, 'g1', ada, id, { title, minPlayers: 2, maxPlayers: 6, minPlaytime: null, maxPlaytime: 20, bringer });
		expect((await other('Wavelength')).ok).toBe(true);
		expect((await other('alpha', 'm:ada')).ok).toBe(true); // Alpha is on Ada's shelf: reused, no new game
		expect((await other('Secret', 'g:Nobody')).ok).toBe(false); // not on the night
		const night = (await loadNights(db, 'g1'))[0];
		const wavelength = night.games.find((g) => g.guestName === 'Sam')!.gameId;
		expect(night.games.map((g) => g.gameId)).toEqual([wavelength, 1]);
		expect(await gameVisibleInGroup(db, 'g1', wavelength)).toBe(true);
		expect(await gameVisibleInGroup(db, 'g2', wavelength)).toBe(false);
		expect((await nightOnlyGames(db, 'g1', [id])).map((g) => [g.id, g.name, g.maxPlayers])).toEqual([[wavelength, 'Wavelength', 6]]);

		const sam = { playedOn: '2026-11-14', coop: null, lowestWins: false, players: [{ userId: 'ada', guestName: null, place: 1, score: null }] };
		expect((await savePlay(db, 'g1', ada, wavelength, sam)).ok).toBe(false); // not on a shelf, and no night given
		expect((await savePlay(db, 'g1', ada, wavelength, { ...sam, nightId: id })).ok).toBe(true);

		await removeNightGuest(db, 'g1', id, 'Sam');
		expect((await loadNights(db, 'g1'))[0].games.map((g) => g.gameId)).toEqual([1]);
	});

	it('clears nights with the group, and a deleted person from every night', async () => {
		const id = await plan();
		await setGoing(db, 'g1', bo, id, 'bo', true);
		await bringCopy(db, 'g1', bo, id, 2, 'bo');
		await bringOther(db, 'g1', bo, id, { title: 'Bo’s Proto', minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null, bringer: 'm:bo' });
		await updateNight(db, 'g1', ada, id, { ...input, hostId: 'bo' });
		await db.batch(deletePersonStatements(db, 'bo'));
		const night = (await loadNights(db, 'g1'))[0];
		expect(night.hostId).toBeNull();
		expect(night.people.map((p) => p.userId)).toEqual(['ada']);
		expect(night.games).toEqual([]);
		expect(await one(db, `SELECT COUNT(*) AS n FROM games WHERE name = 'Bo’s Proto'`)).toEqual({ n: 0 });
		await db.batch(deleteGroupStatements(db, 'g1'));
		expect(await one(db, 'SELECT COUNT(*) AS n FROM game_nights')).toEqual({ n: 0 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM night_people')).toEqual({ n: 0 });
	});
});

describe('the log form’s nights (D70)', () => {
	const n = (id: string) => ({ id, name: id, nightOn: '2026-01-01' });
	it('adds the play’s own night and the page’s night when the recent list doesn’t have them, once each', () => {
		expect(nightOptions([n('a'), n('b')], n('old'), null).map((x) => x.id)).toEqual(['a', 'b', 'old']);
		expect(nightOptions([n('a')], n('a'), n('page')).map((x) => x.id)).toEqual(['a', 'page']);
		expect(nightOptions([], n('old'), n('old')).map((x) => x.id)).toEqual(['old']);
		expect(nightOptions([n('a')], null, null).map((x) => x.id)).toEqual(['a']);
	});
});

