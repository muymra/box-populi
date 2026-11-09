import { describe, expect, it } from 'vitest';
import { boxFit, boxRatio, MAX_RATIO, MIN_RATIO, ROOM } from './box-shape.ts';

describe('boxRatio', () => {
	it('is square until the cover is known', () => {
		expect(boxRatio(null)).toBe(1);
		expect(boxRatio(undefined)).toBe(1);
		expect(boxRatio(0)).toBe(1);
		expect(boxRatio(Number.NaN)).toBe(1);
	});

	it('keeps a cover its own shape between the limits', () => {
		expect(boxRatio(1)).toBe(1);
		expect(boxRatio(1.42)).toBe(1.42);
		expect(boxRatio(0.75)).toBe(0.75);
	});

	it('holds the extremes in', () => {
		expect(boxRatio(2)).toBe(MAX_RATIO);
		expect(boxRatio(0.5)).toBe(MIN_RATIO);
	});
});

describe('boxFit', () => {
	it('fills the width unless the box is taller than the room', () => {
		expect(boxFit(null)).toBe('width');
		expect(boxFit(1.42)).toBe('width');
		expect(boxFit(ROOM)).toBe('width');
		expect(boxFit(ROOM - 0.01)).toBe('height');
		expect(boxFit(0.65)).toBe('height');
	});
});
