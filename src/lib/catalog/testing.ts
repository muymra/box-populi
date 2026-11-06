// Builders for tests. Not imported by app code.
import { buildSearchText } from './normalize.ts';
import type { CatalogCopy, CatalogGame } from './types.ts';

let nextId = 1;

export function copy(ownerId: string, overrides: Partial<CatalogCopy> = {}): CatalogCopy {
	return { ownerId, lentToUserId: null, lentOut: false, addedAt: 1, ...overrides };
}

export function game(overrides: Partial<CatalogGame> & { name?: string } = {}): CatalogGame {
	const id = overrides.id ?? nextId++;
	const name = overrides.name ?? `Game ${id}`;
	return {
		id,
		bggId: id,
		name,
		search: buildSearchText(name),
		year: 2020,
		thumbUrl: null,
		minPlayers: 2,
		maxPlayers: 4,
		bestMask: 0,
		recMask: 0,
		pollSource: null,
		minPlaytime: 30,
		maxPlaytime: 60,
		weight: 2.5,
		usersRated: 100,
		mechanics: [],
		categories: [],
		isExpansion: false,
		isManual: false,
		incomplete: false,
		copies: [copy('u1')],
		...overrides
	};
}
