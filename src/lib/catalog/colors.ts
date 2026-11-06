// Colour roles of the cube-shelf world (DESIGN.md). Pure, shared by server and browser.

/** Wooden-cube player colours. Each member gets one by join order, so it never changes. */
export const PLAYER_COLORS = [
	{ name: 'red', bg: '#c8402e', ink: '#ffffff' },
	{ name: 'blue', bg: '#2f62b0', ink: '#ffffff' },
	{ name: 'pink', bg: '#b23f78', ink: '#ffffff' },
	{ name: 'green', bg: '#2e7d4f', ink: '#ffffff' },
	{ name: 'purple', bg: '#6f4f96', ink: '#ffffff' },
	{ name: 'orange', bg: '#b14f17', ink: '#ffffff' },
	{ name: 'teal', bg: '#17706f', ink: '#ffffff' },
	{ name: 'black', bg: '#2b2a28', ink: '#ffffff' }
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export function playerColor(index: number): PlayerColor {
	return PLAYER_COLORS[((index % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];
}

/**
 * Box fronts for games without art: low-chroma cardboard prints (kraft, stone, slate, umber),
 * kept away from the player hues so the owner edge is the only player colour on the shelf.
 * Every pair passes 4.5:1.
 */
export const BOX_COLORS = [
	{ bg: '#b49a7a', ink: '#1f1d1a' },
	{ bg: '#3d3a36', ink: '#f4f1ec' },
	{ bg: '#d6cdbd', ink: '#2b2a28' },
	{ bg: '#5c636b', ink: '#ffffff' },
	{ bg: '#6b5948', ink: '#ffffff' },
	{ bg: '#9a948a', ink: '#1f1d1a' },
	{ bg: '#2f3336', ink: '#f1eee8' },
	{ bg: '#c4b59c', ink: '#2b2a28' },
	{ bg: '#4b4038', ink: '#f4efe8' },
	{ bg: '#7d7569', ink: '#ffffff' },
	{ bg: '#e3dccf', ink: '#2b2a28' },
	{ bg: '#55524d', ink: '#ffffff' }
] as const;

/** Stable colour for a game's printed box front, from its name. */
export function boxColor(name: string): (typeof BOX_COLORS)[number] {
	let h = 2166136261;
	for (let i = 0; i < name.length; i++) {
		h ^= name.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return BOX_COLORS[(h >>> 0) % BOX_COLORS.length];
}

/** Member colour indexes by join order: the first member gets 0, the next 1, and so on. */
export function colorIndexesByJoinOrder(members: Array<{ id: string; joinedAt: number }>): Map<string, number> {
	const sorted = [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
	return new Map(sorted.map((m, i) => [m.id, i]));
}
