// Colour roles of the cube-shelf world (DESIGN.md). Pure, shared by server and browser.

/** Wooden-cube player colours. Each member gets one by join order, so it never changes; see playerColor(). */
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

export type PlayerColor = (typeof PLAYER_COLORS)[number] & {
	/** The CSS background to paint: the colour itself, or hatched for a member's second round. */
	fill: string;
	/** True for members 9 to 16, 25 to 32, and so on. */
	hatched: boolean;
};

/**
 * A member's colour by join order. The eight colours go round once solid, then once hatched, so the
 * first sixteen members all look different; from the seventeenth the pattern repeats. The hatch's
 * stripe is a darker shade (a lighter grey for black), so white ink on it reads at least as well as on
 * the solid colour.
 */
export function playerColor(index: number): PlayerColor {
	const n = PLAYER_COLORS.length;
	const i = ((index % n) + n) % n;
	const base = PLAYER_COLORS[i];
	const round = Math.floor((((index % (2 * n)) + 2 * n) % (2 * n)) / n);
	const hatched = round === 1;
	const stripe = base.name === 'black' ? `color-mix(in srgb, ${base.bg} 75%, white)` : `color-mix(in srgb, ${base.bg} 62%, black)`;
	const fill = hatched ? `repeating-linear-gradient(135deg, ${base.bg} 0 3px, ${stripe} 3px 5px)` : base.bg;
	return { ...base, fill, hatched };
}

/**
 * Box fronts for games without art: low-chroma cardboard prints (kraft, stone, slate, umber),
 * kept away from the player hues so the owner edge is the only player colour on the shelf.
 * Every pair passes 4.5:1.
 */
export const BOX_COLORS = [
	{ bg: '#b49a7a', ink: '#1f1d1a' }, // kraft
	{ bg: '#e3dccf', ink: '#2b2a28' }, // oatmeal
	{ bg: '#9a948a', ink: '#1f1d1a' }, // stone
	{ bg: '#c4b59c', ink: '#2b2a28' }, // putty
	{ bg: '#3d3a36', ink: '#f4f1ec' }, // charcoal
	{ bg: '#d6cdbd', ink: '#2b2a28' }, // sand
	{ bg: '#a8ab9a', ink: '#1f1d1a' }, // sage stone
	{ bg: '#bdb8ae', ink: '#2b2a28' }, // dove
	{ bg: '#6b5948', ink: '#ffffff' }, // umber
	{ bg: '#c9bfae', ink: '#2b2a28' }, // linen
	{ bg: '#a9a196', ink: '#1f1d1a' }, // pebble
	{ bg: '#4b4038', ink: '#f4efe8' } // espresso
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
