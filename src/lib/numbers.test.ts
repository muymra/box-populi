import { describe, expect, it } from 'vitest';
import { wholeNumberIn } from './numbers.ts';

describe('wholeNumberIn', () => {
	it('takes digits in range, spaces around them ignored, and nothing else', () => {
		expect(wholeNumberIn(' 30 ', 5, 240)).toBe(30);
		expect(wholeNumberIn('5', 5, 240)).toBe(5);
		expect(wholeNumberIn('240', 5, 240)).toBe(240);
		for (const bad of ['4', '241', '30.5', '-1', '1e2', '', 'thirty', null, undefined, 30, '9'.repeat(30)]) {
			expect(wholeNumberIn(bad, 5, 240)).toBeNull();
		}
	});
});
