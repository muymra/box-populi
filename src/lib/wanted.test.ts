import { describe, expect, it } from 'vitest';
import { shelvesSaid } from './wanted.ts';

describe('shelvesSaid', () => {
	it('names up to three shelves, yours first', () => {
		expect(shelvesSaid(false, ['Bram'])).toBe('On Bram’s shelf');
		expect(shelvesSaid(false, ['Bram', 'Ada'])).toBe('On Bram’s and Ada’s shelves');
		expect(shelvesSaid(false, ['Bram', 'Ada', 'Chen'])).toBe('On Bram’s, Ada’s and Chen’s shelves');
		expect(shelvesSaid(true, [])).toBe('On your shelf');
		expect(shelvesSaid(true, ['Bram'])).toBe('On your shelf and Bram’s');
		expect(shelvesSaid(true, ['Bram', 'Ada'])).toBe('On your shelf, Bram’s and Ada’s');
	});

	it('counts past three, and says nothing for no shelf', () => {
		expect(shelvesSaid(false, ['A', 'B', 'C', 'D'])).toBe('On 4 shelves here');
		expect(shelvesSaid(true, ['A', 'B', 'C'])).toBe('On 4 shelves here');
		expect(shelvesSaid(false, [])).toBe('');
	});
});
