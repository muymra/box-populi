// Calendar days as 'YYYY-MM-DD' strings. The arithmetic runs in UTC, so a clock change never moves a
// day. Used by the day grid that picks a game night's date and a play's date (DayGrid.svelte).

const DAY = 86_400_000;

function toMs(day: string): number {
	return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

function fromMs(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
	return fromMs(toMs(day) + n * DAY);
}

/** The Monday of the week holding `day`. */
export function weekStart(day: string): string {
	const weekday = (new Date(toMs(day)).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
	return addDays(day, -weekday);
}

/** `weeks` rows of seven days, from the Monday `monday`. */
export function dayWeeks(monday: string, weeks: number): string[][] {
	return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(monday, w * 7 + d)));
}

/**
 * The first Monday of a window of `weeks` weeks that shows `day`. Looking ahead (planning a night),
 * `anchor`'s week comes first; looking back (logging a play), it comes last. A `day` outside that
 * window gets the window that starts (ahead) or ends (back) with its own week.
 */
export function windowStart(anchor: string, day: string | null, look: 'ahead' | 'back', weeks: number): string {
	const first = (week: string) => (look === 'ahead' ? week : addDays(week, -7 * (weeks - 1)));
	const start = first(weekStart(anchor));
	if (!day || (day >= start && day < addDays(start, 7 * weeks))) return start;
	return first(weekStart(day));
}

/** "November 2026", "November – December 2026" or "December 2026 – January 2027" for a run of days. */
export function monthSpan(first: string, last: string): string {
	const month = (day: string) => new Date(toMs(day)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
	const [y1, y2] = [first.slice(0, 4), last.slice(0, 4)];
	if (first.slice(0, 7) === last.slice(0, 7)) return `${month(first)} ${y1}`;
	return y1 === y2 ? `${month(first)} – ${month(last)} ${y2}` : `${month(first)} ${y1} – ${month(last)} ${y2}`;
}

/** "Saturday 14 November" for a screen reader, with the year when it isn't `today`'s. */
export function dayName(day: string, today: string): string {
	return new Date(toMs(day)).toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
		timeZone: 'UTC'
	});
}

/** "Sat 14" for a chip or a short list. */
export function shortDay(day: string): string {
	return new Date(toMs(day)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Dec" over the first of a month in the grid. */
export function shortMonth(day: string): string {
	return new Date(toMs(day)).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
}

/** A night's start times: every half hour from 10:00 to 23:30, plus `current` when it's off that list. */
export function startTimes(current?: string | null): string[] {
	const times = Array.from({ length: 28 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
	if (current && !times.includes(current)) times.push(current);
	return times.sort();
}

/** When a night is, from `today`: "Tonight", "Tomorrow", "Friday" within the week, else "Fri 13 Nov". */
export function whenLabel(day: string, today: string): string {
	if (day === today) return 'Tonight';
	if (day === addDays(today, 1)) return 'Tomorrow';
	const date = new Date(toMs(day));
	if (day > today && day < addDays(today, 7)) return date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
	return date.toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
		timeZone: 'UTC'
	});
}
