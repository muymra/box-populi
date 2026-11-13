// Shapes shared by the server (which builds them) and the browser (which filters them).
// See TECH.md "Catalog delivery".
import type { Standing } from '../standing.ts';

export type Role = 'owner' | 'admin' | 'member';

export type PollSource = 'summary' | 'votes' | null;

export type CatalogMember = {
	id: string;
	name: string;
	role: Role;
	lastSeenAt: number;
	/** Index into PLAYER_COLORS, assigned by join order so it never changes. */
	colorIndex: number;
	/** Waiting to be let in, suspended, or a full member (D79). Only full members are offered as players, going or here. */
	standing: Standing;
};

export type CatalogCopy = {
	ownerId: string;
	/** Lent to a user of this app; that user may or may not be in the group being viewed. */
	lentToUserId: string | null;
	/** Lent to someone outside the app. */
	lentOut: boolean;
	addedAt: number;
	/** How many can play with the expansions its owner has, by the owner's count (D75); left out when not set. */
	maxWith?: number;
};

export type CatalogGame = {
	id: number;
	bggId: number | null;
	name: string;
	/** Normalized primary and alternate titles, '|'-joined. Internal; never displayed. */
	search: string;
	year: number | null;
	thumbUrl: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	bestMask: number;
	recMask: number;
	pollSource: PollSource;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	weight: number | null;
	usersRated: number | null;
	mechanics: string[];
	categories: string[];
	isExpansion: boolean;
	isManual: boolean;
	/** True for hand-entered games and for BGG stubs still waiting for details. */
	incomplete: boolean;
	/** The last night this group logged a play of it (YYYY-MM-DD), or null. Only in a group's catalog. */
	lastPlayed?: string | null;
	/** Members of this group who have it as a favourite (D63). Only in a group's catalog. */
	favouredBy?: string[];
	/**
	 * For an expansion, the games in this catalog it expands, from BGG's links, so its player count can
	 * widen theirs (STATUS item 30, `extensions.ts`). Left out when there are none.
	 */
	baseIds?: number[];
	/**
	 * Never sent: set in the browser on an entry that stands for an owner's own count (D75), the owner's id,
	 * so the expansion checks in `extensions.ts` take it like an expansion.
	 */
	countBy?: string;
	copies: CatalogCopy[];
};

/** What a game's cube draws (Cube.svelte), so a page of cubes outside the shelf sends no more (D70). */
export type CubeGame = Pick<
	CatalogGame,
	'id' | 'name' | 'year' | 'thumbUrl' | 'minPlayers' | 'maxPlayers' | 'minPlaytime' | 'maxPlaytime' | 'isExpansion' | 'isManual' | 'copies'
>;

export type CatalogPayload = {
	version: number;
	members: CatalogMember[];
	games: CatalogGame[];
};
