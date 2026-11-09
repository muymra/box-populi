import { describe, expect, it } from 'vitest';
import { GROUP_CODE_EXAMPLE, SIGN_IN_CODE_EXAMPLE, looksLikeSignInCode, tidyCode, tidySignInCode } from './codes.ts';

describe('group codes', () => {
	it('capitalise, drop spaces and dashes', () => {
		expect(tidyCode('k7m4p')).toBe('K7M4P');
		expect(tidyCode('K7M 4P')).toBe('K7M4P');
		expect(tidyCode(' k7m-4p ')).toBe('K7M4P');
	});

	it('keep a sign-in code whole instead of cutting it to five, and say so', () => {
		expect(tidyCode('hq6t-8vna')).toBe('HQ6T8VNA');
		expect(looksLikeSignInCode(tidyCode('hq6t-8vna'))).toBe(true);
		expect(looksLikeSignInCode(tidyCode('K7M4P'))).toBe(false);
		expect(tidyCode('ABCDEFGHJK')).toBe('ABCDEFGH');
	});

	it('leave characters codes never use for the server to explain', () => {
		expect(tidyCode('K0M1O')).toBe('K0M1O');
	});
});

describe('sign-in codes', () => {
	it('capitalise and show the dash after four', () => {
		expect(tidySignInCode('hq6')).toBe('HQ6');
		expect(tidySignInCode('hq6t8')).toBe('HQ6T-8');
		expect(tidySignInCode('hq6t 8vna')).toBe('HQ6T-8VNA');
		expect(tidySignInCode('HQ6T-8VNAXX')).toBe('HQ6T-8VNA');
	});

	it('have examples that share no characters', () => {
		const a = new Set(GROUP_CODE_EXAMPLE);
		expect([...SIGN_IN_CODE_EXAMPLE.replace('-', '')].some((c) => a.has(c))).toBe(false);
	});
});
