// Colour roles of the cube-shelf world (DESIGN.md). Pure, shared by server and browser.

/** Wooden-cube player colours. Each member gets one by join order, so it never changes. */
export const PLAYER_COLORS = [
	{ name: 'red', bg: '#c8402e', ink: '#ffffff' },
	{ name: 'blue', bg: '#2f62b0', ink: '#ffffff' },
	{ name: 'yellow', bg: '#e9b44c', ink: '#2b2a28' },
	{ name: 'green', bg: '#2e7d4f', ink: '#ffffff' },
	{ name: 'purple', bg: '#6f4f96', ink: '#ffffff' },
	{ name: 'orange', bg: '#e07a32', ink: '#2b2a28' },
	{ name: 'teal', bg: '#17706f', ink: '#ffffff' },
	{ name: 'black', bg: '#2b2a28', ink: '#ffffff' }
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export function playerColor(index: number): PlayerColor {
	return PLAYER_COLORS[((index % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];
}

/** Printed-cardboard colours for box fronts of games without art. Muted, all pass 4.5:1 with their ink. */
export const BOX_COLORS = [
	{ bg: '#1f5c63', ink: '#ffffff' },
	{ bg: '#8a3b2a', ink: '#ffffff' },
	{ bg: '#d9a441', ink: '#2b2a28' },
	{ bg: '#3d5a3a', ink: '#ffffff' },
	{ bg: '#5b3f6b', ink: '#ffffff' },
	{ bg: '#284a7a', ink: '#ffffff' },
	{ bg: '#b5653b', ink: '#ffffff' },
	{ bg: '#4a5560', ink: '#ffffff' },
	{ bg: '#6c6a2e', ink: '#ffffff' },
	{ bg: '#9c4a5e', ink: '#ffffff' },
	{ bg: '#c9b48a', ink: '#2b2a28' },
	{ bg: '#2f3b44', ink: '#ffffff' }
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
