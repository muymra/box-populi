// Shapes shared by the server (which builds them) and the browser (which filters them).
// See TECH.md "Catalog delivery".

export type Role = 'owner' | 'admin' | 'member';

export type PollSource = 'summary' | 'votes' | null;

export type CatalogMember = {
	id: string;
	name: string;
	role: Role;
	lastSeenAt: number;
	/** Index into PLAYER_COLORS, assigned by join order so it never changes. */
	colorIndex: number;
};

export type CatalogCopy = {
	ownerId: string;
	/** Lent to a user of this app; that user may or may not be in the group being viewed. */
	lentToUserId: string | null;
	/** Lent to someone outside the app. */
	lentOut: boolean;
	addedAt: number;
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
