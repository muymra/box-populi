import { describe, expect, it } from 'vitest';
import { tidyCode } from './codes.ts';

describe('tidyCode', () => {
	it('capitalises, drops spaces and dashes, and stops at five', () => {
		expect(tidyCode('k7m4p')).toBe('K7M4P');
		expect(tidyCode('K7M 4P')).toBe('K7M4P');
		expect(tidyCode(' k7m-4p ')).toBe('K7M4P');
		expect(tidyCode('K7M4PQRS')).toBe('K7M4P');
	});

	it('leaves characters codes never use for the server to explain', () => {
		expect(tidyCode('K0M1O')).toBe('K0M1O');
	});
});
