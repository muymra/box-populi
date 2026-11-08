import { describe, expect, it } from 'vitest';
import { addDays, dayName, dayWeeks, monthSpan, shortDay, startTimes, weekStart, whenLabel, windowStart } from './days.ts';

describe('days', () => {
	it('counts days across months, years and clock changes', () => {
		expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // the clocks go back on the 25th in Europe
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('starts weeks on Monday', () => {
		expect(weekStart('2026-11-08')).toBe('2026-11-02'); // a Sunday
		expect(weekStart('2026-11-09')).toBe('2026-11-09'); // a Monday
		expect(dayWeeks('2026-11-02', 2)).toEqual([
			['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'],
			['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
		]);
	});

	it('opens the window on the chosen day, this week first ahead and last looking back', () => {
		expect(windowStart('2026-11-08', '2026-11-20', 'ahead', 5)).toBe('2026-11-02');
		expect(windowStart('2026-11-08', null, 'back', 5)).toBe('2026-10-05');
		// An old night being edited, or a play months back, opens on its own week.
		expect(windowStart('2026-11-08', '2026-06-10', 'ahead', 5)).toBe('2026-06-08');
		expect(windowStart('2026-11-08', '2026-06-10', 'back', 5)).toBe('2026-05-11');
	});

	it('names months and days for people', () => {
		expect(monthSpan('2026-11-02', '2026-11-29')).toBe('November 2026');
		expect(monthSpan('2026-11-02', '2026-12-06')).toBe('November – December 2026');
		expect(monthSpan('2026-12-28', '2027-01-31')).toBe('December 2026 – January 2027');
		expect(dayName('2026-11-14', '2026-11-08')).toBe('Saturday 14 November');
		expect(shortDay('2026-11-14')).toMatch(/^Sat,? 14$/);
		expect(dayName('2027-01-02', '2026-11-08')).toMatch(/^Saturday,? 2 January 2027$/);
	});

	it('offers half hours from 10:00, keeping an odd time already set', () => {
		const times = startTimes();
		expect(times[0]).toBe('10:00');
		expect(times.at(-1)).toBe('23:30');
		expect(times).toHaveLength(28);
		expect(startTimes('19:45')).toContain('19:45');
		expect(startTimes('19:30')).toHaveLength(28);
	});

	it('says when a night is in words', () => {
		expect(whenLabel('2026-11-08', '2026-11-08')).toBe('Tonight');
		expect(whenLabel('2026-11-09', '2026-11-08')).toBe('Tomorrow');
		expect(whenLabel('2026-11-13', '2026-11-08')).toBe('Friday');
		expect(whenLabel('2026-11-20', '2026-11-08')).toMatch(/^Fri,? 20 Nov$/);
		expect(whenLabel('2027-01-08', '2026-11-08')).toMatch(/^Fri,? 8 Jan,? 2027$/);
	});
});
