import type { HandleClientError } from '@sveltejs/kit/hooks';
import { errorRef, errorStatus } from '#lib/error-ref.ts';

/**
 * An unexpected error in the browser gets a reference (STATUS item 50), shown on the error page and
 * logged to the browser's console with the error, so a report can be matched to what went wrong.
 */
export const handleError: HandleClientError = ({ kind, error, event }) => {
	if (kind === 'app') return;
	const status = errorStatus(kind, error);
	if (status === 404) return;
	const ref = errorRef('browser');
	console.error(`[box-populi error ${ref}] ${status} in the browser on ${event.route.id ?? event.url.pathname} (${kind})`, error);
	return { message: 'Something in this page failed in the browser', ref };
};
