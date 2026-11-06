import type { PollSource } from '#lib/catalog/types.ts';

export type BggItemType = 'boardgame' | 'boardgameexpansion';

export type BggSearchHit = {
	bggId: number;
	name: string;
	year: number | null;
	type: BggItemType;
};

export type BggThing = {
	bggId: number;
	type: BggItemType;
	name: string;
	alternateNames: string[];
	description: string | null;
	year: number | null;
	imageUrl: string | null;
	thumbUrl: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	weight: number | null;
	usersRated: number | null;
	mechanics: string[];
	categories: string[];
	/** For expansions: the base games' BGG ids (inbound expansion links). */
	baseBggIds: number[];
	bestMask: number;
	recMask: number;
	pollSource: PollSource;
};

export type BggCollectionItem = {
	bggId: number;
	name: string;
	year: number | null;
	imageUrl: string | null;
	thumbUrl: string | null;
};

export type BggCollectionResult =
	| { status: 'ready'; items: BggCollectionItem[] }
	| { status: 'pending' }
	| { status: 'not_found' };

export interface BggClient {
	search(query: string): Promise<BggSearchHit[]>;
	/** At most 20 ids per call. */
	things(bggIds: number[]): Promise<BggThing[]>;
	collection(username: string): Promise<BggCollectionResult>;
}

/** BGG is throttling or unavailable. Callers show "BGG is busy" and retry after `retryAfterMs`. */
export class BggBusyError extends Error {
	constructor(public retryAfterMs: number) {
		super(`BGG is busy; retry in ${Math.round(retryAfterMs / 1000)}s`);
		this.name = 'BggBusyError';
	}
}

export const THINGS_PER_REQUEST = 20;
