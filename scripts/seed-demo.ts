// Writes seed/demo.sql: the read-only demo group (TECH.md "Demo group").
//
//   node scripts/seed-demo.ts                 invented games, no BGG data (works without a token)
//   node scripts/seed-demo.ts --games 600     more of them
//
// Seeding from a real BGG collection (--bgg-user) isn't built yet; it would need a BGG token. The output is
// gitignored either way. Apply with `pnpm db:seed` (local) or
// `wrangler d1 execute box-populi --remote --file seed/demo.sql`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildSearchText } from '../src/lib/catalog/normalize.ts';
import { maskFromCounts } from '../src/lib/catalog/players.ts';
import { seededRng } from '../src/lib/catalog/pick.ts';

const { values } = parseArgs({
	options: { games: { type: 'string', default: '400' }, 'bgg-user': { type: 'string' }, seed: { type: 'string', default: '7' } }
});
if (values['bgg-user']) {
	console.error('Seeding from a BGG collection isn’t built yet. Run without --bgg-user.');
	process.exit(1);
}

const rng = seededRng(Number(values.seed));
const rand = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const choice = <T>(items: T[]): T => items[Math.floor(rng() * items.length)];
const sample = <T>(items: T[], n: number): T[] => [...items].sort(() => rng() - 0.5).slice(0, n);
const sql = (v: unknown): string =>
	v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

const NOW = Date.UTC(2026, 10, 6);
const DAY = 86_400_000;
const OWNER = 'demo-ada';

const members = [
	{ id: 'demo-ada', name: 'Ada', role: 'owner', share: 0.45, seen: 0 },
	{ id: 'demo-bram', name: 'Bram', role: 'admin', share: 0.25, seen: 2 },
	{ id: 'demo-chen', name: 'Chen', role: 'member', share: 0.12, seen: 5 },
	{ id: 'demo-dewi', name: 'Dewi', role: 'member', share: 0.1, seen: 12 },
	{ id: 'demo-eli', name: 'Eli', role: 'member', share: 0.08, seen: 40 }
];

const FIRST = ['Copper', 'Lantern', 'Saffron', 'Hollow', 'Tidal', 'Ember', 'Granite', 'Willow', 'Velvet', 'Iron', 'Amber', 'Cobalt', 'Juniper', 'Harbor', 'Meadow', 'Obsidian', 'Paper', 'Quill', 'Rune', 'Silver', 'Thistle', 'Umber', 'Verdant', 'Winter', 'Zephyr', 'Clockwork', 'Starlit', 'Moss', 'Brass', 'Lunar'];
const SECOND = ['Harbor', 'Valley', 'Bazaar', 'Kingdoms', 'Expedition', 'Orchard', 'Railways', 'Guild', 'Lighthouse', 'Canals', 'Frontier', 'Heist', 'Archive', 'Garden', 'Tavern', 'Market', 'Citadel', 'Voyage', 'Village', 'Observatory', 'Caravan', 'Monastery', 'Foundry', 'Islands', 'Summit'];
const MECHANICS = ['Hand Management', 'Set Collection', 'Worker Placement', 'Deck, Bag, and Pool Building', 'Dice Rolling', 'Tile Placement', 'Area Majority / Influence', 'Drafting', 'Engine Building', 'Cooperative Game', 'Trick-taking', 'Network and Route Building', 'Push Your Luck', 'Auction / Bidding', 'Hidden Roles', 'Pattern Building', 'Variable Player Powers', 'Simultaneous Action Selection', 'Trading', 'Deduction'];
const CATEGORIES = ['Fantasy', 'Science Fiction', 'Economic', 'Animals', 'Card Game', 'Party Game', 'Adventure', 'Medieval', 'Exploration', 'Nautical', 'Trains', 'Farming', 'City Building', 'Mystery', 'Abstract Strategy', 'Humor', 'Civilization', 'Horror', 'Puzzle', 'Travel'];

type DemoGame = Record<string, string | number | null> & { id: number };
const games: DemoGame[] = [];
const usedNames = new Set<string>();
const total = Number(values.games);
let nextId = 9_000_001; // reserved range for demo games

while (games.length < total) {
	const name = `${choice(FIRST)} ${choice(SECOND)}`;
	if (usedNames.has(name)) continue;
	usedNames.add(name);

	const kind = rng();
	const manual = kind < 0.05;
	const minPlayers = choice([1, 1, 2, 2, 2, 2, 3, 3, 4]);
	const maxPlayers = Math.max(minPlayers, choice([2, 4, 4, 4, 5, 5, 6, 8, 10]));
	const range = Array.from({ length: Math.min(maxPlayers, 12) - minPlayers + 1 }, (_, i) => minPlayers + i);
	const best = sample(range, Math.min(range.length, rand(1, 2)));
	const rec = [...new Set([...best, ...sample(range, Math.min(range.length, rand(1, 3)))])];
	const minPlaytime = choice([15, 20, 30, 30, 45, 60, 60, 90, 120]);
	const maxPlaytime = Math.round((minPlaytime * choice([1, 1, 1.5, 2])) / 5) * 5; // BGG play times are whole minutes
	const weight = Math.round((1 + rng() ** 1.4 * 3.6) * 10000) / 10000;

	const base = {
		id: nextId++,
		name,
		search_text: buildSearchText(name),
		year: rand(1995, 2026),
		created_by: OWNER,
		fetched_at: NOW
	};
	if (manual) {
		games.push({ ...base, min_players: rng() < 0.5 ? minPlayers : null, max_players: rng() < 0.5 ? maxPlayers : null, max_playtime: null, is_manual: 1 });
		continue;
	}
	games.push({
		...base,
		description: `${name} is an invented game for the Box Populi demo. It isn't a real product and has no BoardGameGeek entry.`,
		min_players: minPlayers,
		max_players: maxPlayers,
		best_mask: maskFromCounts(best),
		rec_mask: maskFromCounts(rec),
		poll_source: 'summary',
		min_playtime: minPlaytime,
		max_playtime: maxPlaytime,
		weight,
		users_rated: rand(50, 90_000),
		mechanics: JSON.stringify(sample(MECHANICS, rand(2, 4))),
		categories: JSON.stringify(sample(CATEGORIES, rand(1, 3)))
	});
}

// A few expansions of existing games.
for (const baseGame of sample(games.filter((g) => !g.is_manual), Math.round(total * 0.08))) {
	const name = `${baseGame.name}: ${choice(['Night Shift', 'New Horizons', 'The Lost Wing', 'Big Box', 'Fifth Player'])}`;
	if (usedNames.has(name)) continue;
	usedNames.add(name);
	games.push({
		...baseGame,
		id: nextId++,
		name,
		search_text: buildSearchText(name),
		year: Math.min(2026, Number(baseGame.year) + rand(1, 3)),
		is_expansion: 1,
		description: `An invented expansion for ${baseGame.name}.`
	});
}

// Ownership: lopsided like real groups, with some popular games owned twice.
const copies: Array<Record<string, string | number | null>> = [];
const pickOwner = () => {
	let r = rng();
	for (const m of members) if ((r -= m.share) < 0) return m.id;
	return members[0].id;
};
for (const g of games) {
	const owners = new Set([pickOwner()]);
	if (rng() < 0.15) owners.add(pickOwner());
	for (const owner of owners) {
		const loan = rng();
		const borrower = choice(members.filter((m) => m.id !== owner)).id;
		copies.push({
			user_id: owner,
			game_id: g.id,
			note: rng() < 0.05 ? 'Second edition' : null, // unused since D33; kept so the seed draws the same demo
			lent_to_user_id: loan < 0.03 ? borrower : null,
			lent_to_text: loan >= 0.03 && loan < 0.05 ? 'A neighbour' : null,
			added_at: NOW - rand(0, 900) * DAY
		});
	}
}

// Wishlists: a handful of games nobody owns, plus a few owned ones.
const wanted: DemoGame[] = [];
for (let i = 0; i < 6; i++) {
	const name = `${choice(FIRST)} ${choice(SECOND)} Deluxe`;
	if (usedNames.has(name)) continue;
	usedNames.add(name);
	wanted.push({
		id: nextId++,
		name,
		search_text: buildSearchText(name),
		year: 2026,
		created_by: OWNER,
		fetched_at: NOW,
		min_players: 2,
		max_players: 4,
		min_playtime: 60,
		max_playtime: 90,
		weight: 2.8,
		users_rated: rand(100, 2000),
		mechanics: JSON.stringify(sample(MECHANICS, 2)),
		categories: JSON.stringify(sample(CATEGORIES, 1)),
		description: 'An invented game that someone in the demo group wants.'
	});
}
const wishlist = [...wanted, ...sample(games, 8)].map((g) => ({ user_id: choice(members).id, game_id: g.id, added_at: NOW }));

// Plays (PRD "Play log"): drawn after everything else, so the rest of the demo stays as it was.
// About 140 game nights' worth over the last 14 months, mostly the games people own most of,
// with some players better at winning than others and the odd guest.
const SKILL: Record<string, number> = { 'demo-ada': 1.3, 'demo-bram': 1.6, 'demo-chen': 1, 'demo-dewi': 1.2, 'demo-eli': 0.8 };
const GUESTS = ['Sam', 'Robin', 'Kit'];
const playable = games.filter((g) => !g.is_expansion);
const favourites = sample(playable, 40);
const plays: Array<Record<string, string | number | null>> = [];
const playPlayers: Array<Record<string, string | number | null>> = [];
for (let i = 0; i < 140; i++) {
	const game = rng() < 0.7 ? choice(favourites) : choice(playable);
	const most = Math.max(2, Math.min(Number(game.max_players ?? 4), 6));
	const count = rand(2, most);
	const people: Array<{ userId: string | null; guestName: string | null }> = sample(members, Math.min(count, members.length)).map((m) => ({
		userId: m.id,
		guestName: null
	}));
	if (people.length < count || rng() < 0.12) people.push({ userId: null, guestName: choice(GUESTS) });
	const id = `demo-play-${String(i + 1).padStart(3, '0')}`;
	const kind = rng();
	const coop = kind < 0.12 ? (rng() < 0.6 ? 'won' : 'lost') : null;
	const withScores = !coop && kind < 0.6;
	// A finishing order weighted by skill: each player draws skill × a random number.
	const order = people.map((p, seat) => ({ seat, draw: (p.userId ? SKILL[p.userId] : 1) * rng() })).sort((a, b) => b.draw - a.draw);
	const placeOf = new Map(order.map((o, rank) => [o.seat, rank + 1]));
	// Scores fall with each place, so the places and scores agree.
	const scoreAt: number[] = [];
	for (let place = 1, score = rand(30, 120); place <= people.length; place++, score -= rand(3, 12)) scoreAt[place] = score;
	plays.push({
		id,
		group_id: 'demo',
		game_id: game.id as number,
		played_on: new Date(NOW - rand(0, 420) * DAY).toISOString().slice(0, 10),
		coop,
		lowest_wins: 0,
		logged_by: choice(members).id,
		created_at: NOW - i
	});
	people.forEach((p, seat) => {
		const place = placeOf.get(seat)!;
		playPlayers.push({
			play_id: id,
			seat,
			user_id: p.userId,
			guest_name: p.guestName,
			// Winner-only logs: the winner first, everyone else sharing second.
			place: coop ? null : withScores || place === 1 ? place : 2,
			score: withScores ? scoreAt[place] : null
		});
	});
}

// Game nights (PRD "Game night"): most dates with plays become a night, at the café or at someone's
// place, with whoever played going and the games played on the bring list; one more is coming up.
const PLACES: Array<{ name: string; host: string | null }> = [
	{ name: 'Café', host: null },
	{ name: 'Café', host: null },
	{ name: 'At Ada’s', host: 'demo-ada' },
	{ name: 'At Bram’s', host: 'demo-bram' }
];
const owners = new Map<number, string[]>();
for (const c of copies) owners.set(c.game_id as number, [...(owners.get(c.game_id as number) ?? []), c.user_id as string]);
const nights: Array<Record<string, string | number | null>> = [];
const nightPeople: Array<Record<string, string | number | null>> = [];
const nightGames: Array<Record<string, string | number | null>> = [];
const dates = [...new Set(plays.map((p) => p.played_on as string))].sort();
dates.forEach((date, i) => {
	if (rng() < 0.2) return; // a few plays stay outside any night
	const id = `demo-night-${String(i + 1).padStart(3, '0')}`;
	const place = choice(PLACES);
	nights.push({ id, group_id: 'demo', name: place.name, night_on: date, starts_at: '19:30', host_id: place.host, created_by: OWNER, created_at: NOW - i });
	const tonight = plays.filter((p) => p.played_on === date);
	const seats = playPlayers.filter((pp) => tonight.some((p) => p.id === pp.play_id));
	const going = [...new Set(seats.flatMap((pp) => (pp.user_id ? [pp.user_id as string] : [])))];
	const guests = [...new Set(seats.flatMap((pp) => (pp.guest_name ? [pp.guest_name as string] : [])))];
	for (const user of going) nightPeople.push({ night_id: id, user_id: user, guest_name: null, going: 1 });
	for (const guest of guests) nightPeople.push({ night_id: id, user_id: null, guest_name: guest, going: 1 });
	const brought = new Set<number>();
	for (const p of tonight) {
		p.night_id = id;
		const gameId = p.game_id as number;
		if (brought.has(gameId)) continue;
		const bringer = (owners.get(gameId) ?? []).find((o) => going.includes(o));
		if (!bringer || bringer === place.host) continue; // the host's own games are already there
		brought.add(gameId);
		nightGames.push({ night_id: id, game_id: gameId, brought_by: bringer, guest_name: null, added_by: bringer, stayed_home: 0 });
	}
});
// Next Friday at the café, still being planned.
const next = 'demo-night-next';
nights.push({ id: next, group_id: 'demo', name: 'Café', night_on: new Date(NOW + 7 * DAY).toISOString().slice(0, 10), starts_at: '19:30', host_id: null, created_by: OWNER, created_at: NOW });
for (const [user, going] of [['demo-ada', 1], ['demo-bram', 1], ['demo-chen', 1], ['demo-dewi', 0]] as const) nightPeople.push({ night_id: next, user_id: user, guest_name: null, going });
nightPeople.push({ night_id: next, user_id: null, guest_name: 'Sam', going: 1 });
for (const user of ['demo-ada', 'demo-ada', 'demo-bram', 'demo-chen']) {
	const game = copies.find((c) => c.user_id === user && !nightGames.some((g) => g.night_id === next && g.game_id === c.game_id));
	if (game) nightGames.push({ night_id: next, game_id: game.game_id, brought_by: user, guest_name: null, added_by: user, stayed_home: 0 });
}

// Columns that are NOT NULL with a default: rows that don't set them get the default, not NULL.
const GAME_DEFAULTS = { best_mask: 0, rec_mask: 0, mechanics: '[]', categories: '[]', base_bgg_ids: '[]', is_expansion: 0, is_manual: 0 };

function insert(table: string, rows: Array<Record<string, unknown>>): string {
	const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
	const out: string[] = [];
	for (let i = 0; i < rows.length; i += 50) {
		const chunk = rows.slice(i, i + 50).map((r) => `(${columns.map((c) => sql(r[c])).join(', ')})`);
		out.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${chunk.join(',\n')};`);
	}
	return out.join('\n');
}

const statements = [
	'-- Generated by scripts/seed-demo.ts. Gitignored. Re-running replaces the demo group.',
	"DELETE FROM play_players WHERE play_id IN (SELECT id FROM plays WHERE group_id = 'demo');",
	"DELETE FROM plays WHERE group_id = 'demo';",
	"DELETE FROM night_games WHERE night_id IN (SELECT id FROM game_nights WHERE group_id = 'demo');",
	"DELETE FROM night_people WHERE night_id IN (SELECT id FROM game_nights WHERE group_id = 'demo');",
	"DELETE FROM game_nights WHERE group_id = 'demo';",
	"DELETE FROM copies WHERE user_id LIKE 'demo-%';",
	"DELETE FROM wishlist WHERE user_id LIKE 'demo-%';",
	"DELETE FROM game_links WHERE group_id = 'demo';",
	"DELETE FROM games WHERE created_by LIKE 'demo-%' AND id >= 9000000;",
	"DELETE FROM memberships WHERE group_id = 'demo';",
	"DELETE FROM groups WHERE id = 'demo';",
	"DELETE FROM users WHERE id LIKE 'demo-%';",
	insert('users', members.map((m) => ({ id: m.id, name: m.name, created_at: NOW }))),
	// The catalog version is when this file was made, so every reseed is a new version: the catalog's ETag and
	// its in-memory copy (D65) would otherwise keep serving the demo from before a reseed.
	`INSERT INTO groups (id, name, code, is_demo, catalog_version, created_at) VALUES ('demo', 'Demo game group', 'DEMO0', 1, ${Date.now()}, ${NOW});`,
	insert('memberships', members.map((m) => ({ group_id: 'demo', user_id: m.id, role: m.role, joined_at: NOW, last_seen_at: NOW - m.seen * DAY }))),
	insert('games', [...games, ...wanted].map((g) => ({ ...GAME_DEFAULTS, ...g }))),
	insert('copies', copies),
	insert('wishlist', wishlist),
	insert('game_nights', nights),
	insert('night_people', nightPeople),
	insert('night_games', nightGames),
	insert('plays', plays),
	insert('play_players', playPlayers)
];

mkdirSync('seed', { recursive: true });
writeFileSync('seed/demo.sql', statements.join('\n\n') + '\n');
console.log(`Wrote seed/demo.sql: ${games.length + wanted.length} games, ${copies.length} copies, ${members.length} members, ${plays.length} plays, ${nights.length} game nights.`);
