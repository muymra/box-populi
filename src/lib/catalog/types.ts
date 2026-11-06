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
	copies: CatalogCopy[];
};

export type CatalogPayload = {
	version: number;
	members: CatalogMember[];
	games: CatalogGame[];
};
