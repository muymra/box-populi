// "Active 3 days ago" for the members list. Coarse on purpose: it orders regulars, it isn't a log.

const DAY = 86_400_000;

export function lastActive(at: number, now: number): string {
	const days = Math.floor((now - at) / DAY);
	if (days <= 0) return 'active today';
	if (days === 1) return 'active yesterday';
	if (days < 14) return `active ${days} days ago`;
	if (days < 60) return `active ${Math.floor(days / 7)} weeks ago`;
	if (days < 365) return `active ${Math.floor(days / 30)} months ago`;
	const years = Math.floor(days / 365);
	return years === 1 ? 'active a year ago' : `active ${years} years ago`;
}
