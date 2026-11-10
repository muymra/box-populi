import { describe, expect, it } from 'vitest';
import { beforeParam, lastDayOf, parsePeriod } from './log-pages.ts';

describe('the plays page’s period (STATUS item 45)', () => {
	it('is this year by default, a past year when asked, or all time', () => {
		expect(parsePeriod(null, 2026)).toEqual({ key: 'year', year: 2026, since: '2026-01-01', label: '2026' });
		expect(parsePeriod('year', 2026).key).toBe('year');
		expect(parsePeriod('2025', 2026)).toEqual({ key: '2025', year: 2025, since: '2025-01-01', before: '2026-01-01', label: '2025' });
		expect(parsePeriod('all', 2026)).toEqual({ key: 'all', year: null, label: 'All time' });
	});

	it('treats this year, a future year, a year before 1990 or anything else as this year', () => {
		for (const raw of ['2026', '2031', '1989', 'twenty', '25', '']) expect(parsePeriod(raw, 2026).key).toBe('year');
	});

	it('gives a past year’s last day, and none for this year or all time', () => {
		expect(lastDayOf(parsePeriod('2024', 2026))).toBe('2024-12-31');
		expect(lastDayOf(parsePeriod(null, 2026))).toBeUndefined();
		expect(lastDayOf(parsePeriod('all', 2026))).toBeUndefined();
	});

	it('takes a page’s before= only as a date', () => {
		expect(beforeParam('2026-03-01')).toBe('2026-03-01');
		expect(beforeParam("2026-03-01' OR 1")).toBeUndefined();
		expect(beforeParam(null)).toBeUndefined();
	});
});
