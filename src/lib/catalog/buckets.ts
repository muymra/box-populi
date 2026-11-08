// Box Populi's own complexity labels over BGG's 1–5 weight (DECISIONS D15). The UI shows these
// next to BGG's own value, never instead of it (TECH.md "No modification").

export type WeightBucket = 'light' | 'medium' | 'heavy';

export const WEIGHT_BUCKETS: WeightBucket[] = ['light', 'medium', 'heavy'];

export const BUCKET_LABELS: Record<WeightBucket, string> = {
	light: 'Light',
	medium: 'Medium',
	heavy: 'Heavy'
};

/**
 * What a member's complexity stores, on the same 1–5 scale as BGG's weight so the two sort together:
 * the middle of each band (D55).
 */
export const BUCKET_WEIGHTS: Record<WeightBucket, number> = { light: 1.5, medium: 2.5, heavy: 4 };

export function weightBucket(weight: number | null): WeightBucket | null {
	if (weight == null) return null;
	if (weight < 2) return 'light';
	if (weight < 3) return 'medium';
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
