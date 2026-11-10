// Colour roles of the cube-shelf world (DESIGN.md). Pure, shared by server and browser.

/** Wooden-cube player colours. Each member keeps one from the day they join (D69); see playerColor(). */
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

/** The three rounds the eight colours go through: solid, then striped, then dotted. */
export const PATTERNS = ['solid', 'striped', 'dotted'] as const;
export type Pattern = (typeof PATTERNS)[number];
/** How many members look different before a look repeats: 24. */
export const DISTINCT_LOOKS = PLAYER_COLORS.length * PATTERNS.length;

export type PlayerColor = (typeof PLAYER_COLORS)[number] & {
	/** The CSS background to paint: the colour itself, striped or dotted. */
	fill: string;
	pattern: Pattern;
};

/**
 * A member's colour by their stored index (D69). The eight colours go round once solid, once striped
 * and once dotted, so twenty-four members all look different; from the twenty-fifth the looks repeat.
 * Stripes and dots are a darker shade (a lighter grey for black), so white ink on them reads at least
 * as well as on the solid colour.
 */
export function playerColor(index: number): PlayerColor {
	const n = PLAYER_COLORS.length;
	const look = ((index % DISTINCT_LOOKS) + DISTINCT_LOOKS) % DISTINCT_LOOKS;
	const base = PLAYER_COLORS[look % n];
	const pattern = PATTERNS[Math.floor(look / n)];
	const shade = base.name === 'black' ? `color-mix(in srgb, ${base.bg} 75%, white)` : `color-mix(in srgb, ${base.bg} 62%, black)`;
	const fill =
		pattern === 'striped'
			? `repeating-linear-gradient(135deg, ${base.bg} 0 3px, ${shade} 3px 5px)`
			: pattern === 'dotted'
				? `radial-gradient(circle at 2.5px 2.5px, ${shade} 1.25px, transparent 1.5px) 0 0 / 5px 5px, ${base.bg}`
				: base.bg;
	return { ...base, fill, pattern };
}

/**
 * The colour to draw `index` in beside `other`, where only the two of them are compared (a profile's
 * "You and Bram"): their own, or, when the two look the same, their hue in the next pattern.
 */
export function colorBeside(index: number, other: number): PlayerColor {
	const look = (i: number) => ((i % DISTINCT_LOOKS) + DISTINCT_LOOKS) % DISTINCT_LOOKS;
	return playerColor(look(index) === look(other) ? index + PLAYER_COLORS.length : index);
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
