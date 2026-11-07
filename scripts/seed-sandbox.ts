// Writes seed/sandbox.sql: a small writable group with invented data, for trying the app as a member
// sees it. The demo group is read-only and hides every control (TECH.md "Sandbox group").
//
//   pnpm db:sandbox                 write it, load it into the local database, print a link per member
//   node scripts/seed-sandbox.ts --print [--origin http://localhost:5173]   print the links again
//
// Local only. Each member gets a personal link, written to seed/sandbox-links.json and printed, so
// anyone holding the file can sign in as them: never load this into a deployed database. Re-running
// replaces the sandbox, its people and their links. Both output files are gitignored.
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildSearchText } from '../src/lib/catalog/normalize.ts';
import { maskFromCounts } from '../src/lib/catalog/players.ts';
import { seededRng } from '../src/lib/catalog/pick.ts';
import { nightOf } from '../src/lib/table/regulars.ts';

const { values } = parseArgs({
	options: { print: { type: 'boolean', default: false }, origin: { type: 'string', default: 'http://localhost:5173' } }
});
const LINKS_FILE = 'seed/sandbox-links.json';
const GROUP = 'sandbox';

if (values.print) {
	const people = JSON.parse(readFileSync(LINKS_FILE, 'utf8')) as Array<{ name: string; role: string; token: string }>;
	console.log('\nSandbox loaded. Open a link in your browser to be that person on this device:\n');
	for (const p of people) console.log(`  ${p.name.padEnd(5)} ${p.role.padEnd(9)} ${values.origin}/key/${p.token}`);
	console.log(`\nThen the group is at ${values.origin}/g/${GROUP}\n`);
	process.exit(0);
}

const rng = seededRng(11);
const rand = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const choice = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const sample = <T>(items: readonly T[], n: number): T[] => [...items].sort(() => rng() - 0.5).slice(0, n);
const sql = (v: unknown): string => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const NOW = Date.now();
const DAY = 86_400_000;
const TONIGHT = nightOf(NOW);
const dayOffset = (days: number) => nightOf(NOW + days * DAY);
const FIRST_ID = 9_100_001; // reserved range for sandbox games; the demo uses 9_000_001 up
const LAST_ID = 9_199_999;

// Twelve people, so "who's here" folds its list; the last two have just joined and own nothing.
const members = [
	{ id: 'sbx-ada', name: 'Ada', role: 'owner', share: 0.3, seen: 0 },
	{ id: 'sbx-bram', name: 'Bram', role: 'admin', share: 0.2, seen: 1 },
	{ id: 'sbx-chen', name: 'Chen', role: 'member', share: 0.12, seen: 3 },
	{ id: 'sbx-dewi', name: 'Dewi', role: 'member', share: 0.1, seen: 6 },
	{ id: 'sbx-eli', name: 'Eli', role: 'member', share: 0.08, seen: 9 },
	{ id: 'sbx-femi', name: 'Femi', role: 'member', share: 0.06, seen: 14 },
	{ id: 'sbx-gus', name: 'Gus', role: 'member', share: 0.04, seen: 20 },
	{ id: 'sbx-hana', name: 'Hana', role: 'member', share: 0.04, seen: 25 },
	{ id: 'sbx-ivo', name: 'Ivo', role: 'member', share: 0.03, seen: 33 },
	{ id: 'sbx-jun', name: 'Jun', role: 'member', share: 0.03, seen: 41 },
	{ id: 'sbx-kai', name: 'Kai', role: 'member', share: 0, seen: 2 },
	{ id: 'sbx-lena', name: 'Lena', role: 'member', share: 0, seen: 4 }
];
const ROLE_LABEL: Record<string, string> = { owner: 'owner', admin: 'co-admin', member: 'member' };
const OWNER = members[0].id;

const FIRST = ['Copper', 'Lantern', 'Saffron', 'Hollow', 'Tidal', 'Ember', 'Granite', 'Willow', 'Velvet', 'Iron', 'Amber', 'Cobalt', 'Juniper', 'Meadow', 'Paper', 'Quill', 'Rune', 'Thistle', 'Winter', 'Zephyr', 'Clockwork', 'Starlit', 'Moss', 'Brass', 'Lunar'];
const SECOND = ['Harbor', 'Valley', 'Bazaar', 'Kingdoms', 'Expedition', 'Orchard', 'Railways', 'Guild', 'Lighthouse', 'Canals', 'Frontier', 'Heist', 'Archive', 'Garden', 'Tavern', 'Market', 'Citadel', 'Voyage', 'Village', 'Observatory'];
const MECHANICS = ['Hand Management', 'Set Collection', 'Worker Placement', 'Deck, Bag, and Pool Building', 'Dice Rolling', 'Tile Placement', 'Area Majority / Influence', 'Drafting', 'Engine Building', 'Cooperative Game', 'Trick-taking', 'Push Your Luck', 'Hidden Roles', 'Deduction'];
const CATEGORIES = ['Fantasy', 'Science Fiction', 'Economic', 'Animals', 'Card Game', 'Party Game', 'Adventure', 'Medieval', 'Exploration', 'Nautical', 'Trains', 'Farming', 'Mystery', 'Puzzle'];

type Row = Record<string, string | number | null>;
type Game = Row & { id: number; name: string };
const games: Game[] = [];
const usedNames = new Set<string>();
let nextId = FIRST_ID;
const newName = (suffix = '') => {
	for (;;) {
		const name = `${choice(FIRST)} ${choice(SECOND)}${suffix}`;
		if (!usedNames.has(name)) return (usedNames.add(name), name);
	}
};
/** An invented game with the details BGG would give, so the shelf, filters and picker all have something to show. */
function invent(name: string, short = false): Game {
	const minPlayers = choice([1, 2, 2, 2, 3, 3, 4]);
	const maxPlayers = Math.max(minPlayers, choice([2, 4, 4, 5, 5, 6, 8]));
	const range = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i);
	const best = sample(range, Math.min(range.length, rand(1, 2)));
	const minPlaytime = short ? choice([10, 15, 20]) : choice([20, 30, 45, 60, 60, 90, 120]);
	const maxPlaytime = short ? minPlaytime + choice([0, 5, 10]) : Math.round((minPlaytime * choice([1, 1, 1.5, 2])) / 5) * 5;
	return {
		id: nextId++,
		name,
		search_text: buildSearchText(name),
		year: rand(2005, 2026),
		description: `${name} is an invented game for the Box Populi sandbox. It isn't a real product and has no BoardGameGeek entry.`,
		min_players: minPlayers,
		max_players: maxPlayers,
		best_mask: maskFromCounts(best),
		rec_mask: maskFromCounts([...new Set([...best, ...sample(range, Math.min(range.length, 2))])]),
		poll_source: 'summary',
		min_playtime: minPlaytime,
		max_playtime: maxPlaytime,
		weight: short ? Math.round((1 + rng() * 0.8) * 100) / 100 : Math.round((1.2 + rng() ** 1.3 * 3.3) * 100) / 100,
		users_rated: rand(80, 40_000),
		mechanics: JSON.stringify(sample(MECHANICS, rand(2, 3))),
		categories: JSON.stringify(sample(CATEGORIES, rand(1, 2))),
		created_by: OWNER,
		fetched_at: NOW
	};
}

// 60 games on shelves, ten of them short and light so fillers have something to pull, and a few expansions.
for (let i = 0; i < 60; i++) games.push(invent(newName(), i < 10));
const owned = [...games];
for (const base of sample(owned, 4)) {
	const name = `${base.name}: ${choice(['Night Shift', 'New Horizons', 'Fifth Player', 'Big Box'])}`;
	if (usedNames.has(name)) continue;
	usedNames.add(name);
	const expansion: Game = { ...base, id: nextId++, name, search_text: buildSearchText(name), is_expansion: 1, description: `An invented expansion for ${base.name}.` };
	games.push(expansion);
	owned.push(expansion);
}
// Six games nobody owns, for the Wanted tab.
const wantedGames = Array.from({ length: 6 }, () => invent(newName(' Deluxe')));
games.push(...wantedGames);
// A guest's game, added by name to tonight's bring list.
const guestGame: Game = { id: nextId++, name: 'Pocket Duel', search_text: buildSearchText('Pocket Duel'), min_players: 2, max_players: 2, max_playtime: 20, is_manual: 1, source: 'manual', created_by: OWNER, fetched_at: NOW };
games.push(guestGame);

// Copies: lopsided like real groups, some games owned twice, an expansion with its base game's owner.
const copies: Row[] = [];
const sharers = members.filter((m) => m.share > 0);
const pickOwner = () => {
	let r = rng() * sharers.reduce((s, m) => s + m.share, 0);
	for (const m of sharers) if ((r -= m.share) < 0) return m.id;
	return OWNER;
};
const ownersOf = new Map<number, string[]>();
for (const g of owned) {
	const owners = new Set([pickOwner()]);
	if (rng() < 0.15) owners.add(pickOwner());
	for (const owner of owners) {
		const loan = rng();
		copies.push({
			user_id: owner,
			game_id: g.id,
			lent_to_user_id: loan < 0.05 ? choice(members.filter((m) => m.id !== owner)).id : null,
			lent_to_text: loan >= 0.05 && loan < 0.08 ? 'A neighbour' : null,
			added_at: NOW - rand(1, 600) * DAY
		});
	}
	ownersOf.set(g.id, [...owners]);
}

// Wishlists: the unowned games wanted by 4, 3, 2, then 1 person each, and a few owned games too.
const wishlist: Row[] = [];
wantedGames.forEach((g, i) => {
	for (const m of sample(members, [4, 3, 2, 1, 1, 1][i])) wishlist.push({ user_id: m.id, game_id: g.id, added_at: NOW - rand(1, 90) * DAY });
});
for (const g of sample(owned, 4)) {
	const fan = choice(members.filter((m) => !ownersOf.get(g.id)!.includes(m.id)));
	wishlist.push({ user_id: fan.id, game_id: g.id, added_at: NOW - rand(1, 90) * DAY });
}

// Plays over the last three months, among the six who come most, with the odd guest.
const regulars = members.slice(0, 6);
const SKILL: Record<string, number> = { 'sbx-ada': 1.3, 'sbx-bram': 1.6, 'sbx-chen': 1, 'sbx-dewi': 1.2, 'sbx-eli': 0.8, 'sbx-femi': 1.1 };
const GUESTS = ['Sam', 'Robin'];
const playable = owned.filter((g) => !g.is_expansion);
const favourites = sample(playable, 15);
const plays: Row[] = [];
const playPlayers: Row[] = [];
const playDates = [...new Set(Array.from({ length: 14 }, () => dayOffset(-rand(2, 90))))].sort();
playDates.forEach((date, d) => {
	for (let k = 0; k < rand(2, 4); k++) {
		const game = rng() < 0.7 ? choice(favourites) : choice(playable);
		const count = rand(2, Math.max(2, Math.min(Number(game.max_players ?? 4), 6)));
		const people: Array<{ userId: string | null; guestName: string | null }> = sample(regulars, count).map((m) => ({ userId: m.id, guestName: null }));
		if (rng() < 0.15) people.push({ userId: null, guestName: choice(GUESTS) });
		const id = `sbx-play-${d}-${k}`;
		const kind = rng();
		const coop = kind < 0.12 ? (rng() < 0.6 ? 'won' : 'lost') : null;
		const withScores = !coop && kind < 0.6;
		const order = people.map((p, seat) => ({ seat, draw: (p.userId ? SKILL[p.userId] : 1) * rng() })).sort((a, b) => b.draw - a.draw);
		const placeOf = new Map(order.map((o, rank) => [o.seat, rank + 1]));
		const scoreAt: number[] = [];
		for (let place = 1, score = rand(30, 110); place <= people.length; place++, score -= rand(3, 12)) scoreAt[place] = score;
		plays.push({ id, group_id: GROUP, game_id: game.id, played_on: date, coop, lowest_wins: 0, logged_by: choice(regulars).id, created_at: NOW - (playDates.length - d) * DAY + k });
		people.forEach((p, seat) => {
			const place = placeOf.get(seat)!;
			playPlayers.push({ play_id: id, seat, user_id: p.userId, guest_name: p.guestName, place: coop ? null : withScores || place === 1 ? place : 2, score: withScores ? scoreAt[place] : null });
		});
	}
});

// Game nights: most past play dates were nights; one is tonight, one is coming up.
const PLACES = [
	{ name: 'Café', host: null },
	{ name: 'Café', host: null },
	{ name: 'At Ada’s', host: 'sbx-ada' },
	{ name: 'At Bram’s', host: 'sbx-bram' }
];
const nights: Row[] = [];
const nightPeople: Row[] = [];
const nightGames: Row[] = [];
playDates.forEach((date, i) => {
	if (rng() < 0.25) return;
	const id = `sbx-night-${i}`;
	const place = choice(PLACES);
	nights.push({ id, group_id: GROUP, name: place.name, night_on: date, starts_at: '19:30', host_id: place.host, created_by: OWNER, created_at: NOW - i });
	const those = plays.filter((p) => p.played_on === date);
	const seats = playPlayers.filter((pp) => those.some((p) => p.id === pp.play_id));
	const going = [...new Set(seats.flatMap((pp) => (pp.user_id ? [pp.user_id as string] : [])))];
	for (const user of going) nightPeople.push({ night_id: id, user_id: user, guest_name: null, going: 1 });
	for (const guest of new Set(seats.flatMap((pp) => (pp.guest_name ? [pp.guest_name as string] : [])))) nightPeople.push({ night_id: id, user_id: null, guest_name: guest, going: 1 });
	const brought = new Set<number>();
	for (const p of those) {
		p.night_id = id;
		const gameId = p.game_id as number;
		const bringer = (ownersOf.get(gameId) ?? []).find((o) => going.includes(o));
		if (brought.has(gameId) || !bringer || bringer === place.host) continue;
		brought.add(gameId);
		nightGames.push({ night_id: id, game_id: gameId, brought_by: bringer, guest_name: null, added_by: bringer, stayed_home: 0 });
	}
});
/** Up to `n` games `user` owns and isn't lending out, not yet on night `nightId`'s list. */
const shelfOf = (user: string, nightId: string, n: number) =>
	copies
		.filter((c) => c.user_id === user && c.lent_to_user_id == null && c.lent_to_text == null)
		.filter((c) => !nightGames.some((g) => g.night_id === nightId && g.game_id === c.game_id))
		.slice(0, n)
		.map((c) => c.game_id as number);
// Tonight at the café: four going, Eli can't, a guest bringing a game that's on nobody's shelf.
nights.push({ id: 'sbx-night-tonight', group_id: GROUP, name: 'Café', night_on: TONIGHT, starts_at: '19:30', host_id: null, created_by: OWNER, created_at: NOW });
for (const [user, going] of [['sbx-ada', 1], ['sbx-bram', 1], ['sbx-chen', 1], ['sbx-dewi', 1], ['sbx-eli', 0]] as const) nightPeople.push({ night_id: 'sbx-night-tonight', user_id: user, guest_name: null, going });
nightPeople.push({ night_id: 'sbx-night-tonight', user_id: null, guest_name: 'Sam', going: 1 });
for (const [user, n] of [['sbx-ada', 3], ['sbx-bram', 2], ['sbx-chen', 2]] as const) {
	for (const gameId of shelfOf(user, 'sbx-night-tonight', n)) nightGames.push({ night_id: 'sbx-night-tonight', game_id: gameId, brought_by: user, guest_name: null, added_by: user, stayed_home: 0 });
}
nightGames.push({ night_id: 'sbx-night-tonight', game_id: guestGame.id, brought_by: null, guest_name: 'Sam', added_by: OWNER, stayed_home: 0 });
// Next week at Bram's: some answers in, some not.
const next = 'sbx-night-next';
nights.push({ id: next, group_id: GROUP, name: 'At Bram’s', night_on: dayOffset(6), starts_at: '20:00', host_id: 'sbx-bram', created_by: 'sbx-bram', created_at: NOW });
for (const [user, going] of [['sbx-ada', 1], ['sbx-bram', 1], ['sbx-femi', 1], ['sbx-chen', 0]] as const) nightPeople.push({ night_id: next, user_id: user, guest_name: null, going });
for (const gameId of shelfOf('sbx-ada', next, 2)) nightGames.push({ night_id: next, game_id: gameId, brought_by: 'sbx-ada', guest_name: null, added_by: 'sbx-ada', stayed_home: 0 });

// A few rules and video links (example.com, which exists for documentation).
const gameLinks: Row[] = favourites.slice(0, 4).flatMap((g, i) => {
	const slug = String(g.name).toLowerCase().replace(/[^a-z]+/g, '-');
	return [
		{ group_id: GROUP, game_id: g.id, kind: 'rules', title: 'Rulebook', url: `https://example.com/rules/${slug}.pdf`, added_by: OWNER, added_at: NOW - i * DAY },
		...(i % 2 ? [] : [{ group_id: GROUP, game_id: g.id, kind: 'video', title: 'How to play in ten minutes', url: `https://example.com/video/${slug}`, added_by: 'sbx-bram', added_at: NOW - i * DAY }])
	];
});

// A personal link for everyone: a random token in the link, only its SHA-256 in the database, as the app does.
const links = members.map((m) => {
	const token = randomBytes(32).toString('base64url');
	return { ...m, token, hash: createHash('sha256').update(token).digest('hex') };
});

// Columns that are NOT NULL with a default: rows that don't set them get the default, not NULL.
const GAME_DEFAULTS = { best_mask: 0, rec_mask: 0, mechanics: '[]', categories: '[]', base_bgg_ids: '[]', is_expansion: 0, is_manual: 0, source: 'bgg' };

function insert(table: string, rows: Row[]): string {
	if (rows.length === 0) return '';
	const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
	const out: string[] = [];
	for (let i = 0; i < rows.length; i += 50) {
		const chunk = rows.slice(i, i + 50).map((r) => `(${columns.map((c) => sql(r[c])).join(', ')})`);
		out.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${chunk.join(',\n')};`);
	}
	return out.join('\n');
}

const SANDBOX_GAMES = `game_id BETWEEN ${FIRST_ID} AND ${LAST_ID}`;
const statements = [
	'-- Generated by scripts/seed-sandbox.ts. Gitignored. Local only: re-running replaces the sandbox group and its people.',
	`DELETE FROM play_players WHERE play_id IN (SELECT id FROM plays WHERE group_id = '${GROUP}' OR ${SANDBOX_GAMES});`,
	`DELETE FROM plays WHERE group_id = '${GROUP}' OR ${SANDBOX_GAMES};`,
	`DELETE FROM night_games WHERE night_id IN (SELECT id FROM game_nights WHERE group_id = '${GROUP}') OR ${SANDBOX_GAMES};`,
	`DELETE FROM night_people WHERE night_id IN (SELECT id FROM game_nights WHERE group_id = '${GROUP}');`,
	`DELETE FROM game_nights WHERE group_id = '${GROUP}';`,
	`DELETE FROM game_links WHERE group_id = '${GROUP}' OR ${SANDBOX_GAMES};`,
	`DELETE FROM game_corrections WHERE group_id = '${GROUP}' OR ${SANDBOX_GAMES};`,
	`DELETE FROM wishlist WHERE user_id LIKE 'sbx-%' OR ${SANDBOX_GAMES};`,
	`DELETE FROM copies WHERE user_id LIKE 'sbx-%' OR ${SANDBOX_GAMES};`,
	"UPDATE copies SET lent_to_user_id = NULL WHERE lent_to_user_id LIKE 'sbx-%';",
	"DELETE FROM sessions WHERE user_id LIKE 'sbx-%';",
	"DELETE FROM personal_links WHERE user_id LIKE 'sbx-%';",
	`DELETE FROM memberships WHERE group_id = '${GROUP}' OR user_id LIKE 'sbx-%';`,
	`DELETE FROM groups WHERE id = '${GROUP}';`,
	`DELETE FROM games WHERE id BETWEEN ${FIRST_ID} AND ${LAST_ID};`,
	"DELETE FROM users WHERE id LIKE 'sbx-%';",
	insert('users', members.map((m) => ({ id: m.id, name: m.name, created_at: NOW - 200 * DAY }))),
	insert('personal_links', links.map((l) => ({ user_id: l.id, token_hash: l.hash, created_at: NOW }))),
	`INSERT INTO groups (id, name, code, is_demo, catalog_version, created_at) VALUES ('${GROUP}', 'Sandbox', 'SNDBX', 0, ${NOW}, ${NOW - 200 * DAY});`,
	// Joined in list order, so the player colours follow it.
	insert('memberships', members.map((m, i) => ({ group_id: GROUP, user_id: m.id, role: m.role, joined_at: NOW - (200 - i) * DAY, last_seen_at: NOW - m.seen * DAY }))),
	insert('games', games.map((g) => ({ ...GAME_DEFAULTS, ...g }))),
	insert('copies', copies),
	insert('wishlist', wishlist),
	insert('game_links', gameLinks),
	insert('game_nights', nights),
	insert('night_people', nightPeople),
	insert('night_games', nightGames),
	insert('plays', plays),
	insert('play_players', playPlayers)
].filter(Boolean);

mkdirSync('seed', { recursive: true });
writeFileSync('seed/sandbox.sql', statements.join('\n\n') + '\n');
writeFileSync(LINKS_FILE, JSON.stringify(links.map((l) => ({ name: l.name, role: ROLE_LABEL[l.role], token: l.token })), null, '\t') + '\n');
console.log(`Wrote seed/sandbox.sql: ${games.length} games, ${copies.length} copies, ${members.length} members, ${plays.length} plays, ${nights.length} game nights (one tonight, ${TONIGHT}).`);
