// Words for the Wanted tab's "Wished for, now on the shelf" (D84): whose shelf a wished-for game is on.

/**
 * "On Bram's shelf", "On your shelf, Bram's and Ada's", "On Bram's and Ada's shelves", or past three
 * owners "On 5 shelves here". `yours` says the viewer has a copy too; `others` are the other owners' names.
 */
export function shelvesSaid(yours: boolean, others: readonly string[]): string {
	const count = others.length + (yours ? 1 : 0);
	if (count === 0) return '';
	if (count > 3) return `On ${count} shelves here`;
	const theirs = others.map((n) => `${n}’s`);
	if (yours) return `On ${list(['your shelf', ...theirs])}`;
	return `On ${list(theirs)} ${count === 1 ? 'shelf' : 'shelves'}`;
}

function list(parts: readonly string[]): string {
	return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
