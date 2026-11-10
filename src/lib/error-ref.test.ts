import { describe, expect, it } from 'vitest';
import { errorRef, errorStatus } from './error-ref.ts';
import { CODE_ALPHABET } from './codes.ts';

describe('error references (STATUS item 50)', () => {
	it('are six characters with no lookalikes, B-first from the browser', () => {
		const ref = errorRef();
		expect(ref).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
		expect(errorRef('server', new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe('ABCDEF');
		expect(errorRef('browser', new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe('BBCDEF');
	});

	it('take a framework error’s own status, and 500 for anything else', () => {
		expect(errorStatus('framework', { status: 404, message: 'Not found' })).toBe(404);
		expect(errorStatus('framework', { status: 403, message: 'Cross-site POST form submissions are forbidden' })).toBe(403);
		expect(errorStatus('unknown', new TypeError('x'))).toBe(500);
		expect(errorStatus('unknown', null)).toBe(500);
	});
});
