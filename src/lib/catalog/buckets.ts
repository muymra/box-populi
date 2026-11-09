// Complexity levels over BGG's 1–5 weight (DECISIONS D62, replacing D15 and D56): BGG's own five vote labels,
// a weight taking the label of the vote it rounds to, so "2.31 / 5" reads "medium light" as BGG's voters would
// call it. The UI shows these next to BGG's own value, never instead of it (TECH.md "No modification").

export type WeightBucket = 'light' | 'medium-light' | 'medium' | 'medium-heavy' | 'heavy';

export const WEIGHT_BUCKETS: WeightBucket[] = ['light', 'medium-light', 'medium', 'medium-heavy', 'heavy'];

export const BUCKET_LABELS: Record<WeightBucket, string> = {
	light: 'Light',
	'medium-light': 'Medium light',
	medium: 'Medium',
	'medium-heavy': 'Medium heavy',
	heavy: 'Heavy'
};

/**
 * What a member's complexity stores, on the same 1–5 scale as BGG's weight so the two sort together:
 * the vote its level stands for (D55, D62).
 */
export const BUCKET_WEIGHTS: Record<WeightBucket, number> = { light: 1, 'medium-light': 2, medium: 3, 'medium-heavy': 4, heavy: 5 };

/** The label of the BGG vote a weight rounds to: each level runs from half a point below its vote to half above. */
export function weightBucket(weight: number | null): WeightBucket | null {
	if (weight == null) return null;
	if (weight < 1.5) return 'light';
	if (weight < 2.5) return 'medium-light';
	if (weight < 3.5) return 'medium';
	if (weight < 4.5) return 'medium-heavy';
	return 'heavy';
}

/** BGG shows weight to two decimals, so the app does too: "2.31 / 5". */
export function formatWeight(weight: number | null): string | null {
	return weight == null ? null : `${weight.toFixed(2)} / 5`;
}

export function formatPlaytime(min: number | null, max: number | null): string | null {
	if (min == null && max == null) return null;
	if (min != null && max != null && min !== max) return `${min}–${max} min`;
	return `${max ?? min} min`;
}
