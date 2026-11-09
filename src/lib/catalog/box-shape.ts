// How a cover stands on the shelf (DESIGN.md "Box Front"): at its own width over height, so a wide box
// stands low and a card game's tall one stands narrow, as on a real shelf. The extremes are held in, so
// a 2:1 box doesn't turn into a sliver: past them the box keeps the limit and the cover loses its ends.

/** The narrowest and widest a box gets, width over height. */
export const MIN_RATIO = 0.7;
export const MAX_RATIO = 1.6;

/** The room a cube gives its box, width over height (Cube.svelte sizes the room to match). */
export const ROOM = 0.886;

/** The box's width over height for a cover's: its own, held to the limits; square while unknown. */
export function boxRatio(ratio: number | null | undefined): number {
	if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return 1;
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

/** Whether the box fills the room's width or, being taller than the room, its height. */
export function boxFit(ratio: number | null | undefined): 'width' | 'height' {
	return boxRatio(ratio) >= ROOM ? 'width' : 'height';
}
