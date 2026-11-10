// Whole numbers typed into a form or set as an instance setting (D71): digits only, in a range.

/** `raw` as a whole number from `min` to `max`, spaces around it ignored; null when it isn't one. */
export function wholeNumberIn(raw: unknown, min: number, max: number): number | null {
	const text = typeof raw === 'string' ? raw.trim() : '';
	if (!/^\d+$/.test(text)) return null;
	const n = Number(text);
	return n >= min && n <= max ? n : null;
}
