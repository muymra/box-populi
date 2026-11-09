import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to.ts';

describe('safeReturnTo', () => {
	it('keeps paths on this site and refuses anything a browser could read as another one', () => {
		expect(safeReturnTo('/g/abc/game/12?q=cat#top')).toBe('/g/abc/game/12?q=cat#top');
		for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', 'g/abc']) {
			expect(safeReturnTo(bad)).toBe('/');
		}
	});
});
