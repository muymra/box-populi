import { fail, redirect } from '@sveltejs/kit';
import { normalizeCode } from '#lib/server/codes.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const raw = String((await request.formData()).get('code') ?? '');
		const code = normalizeCode(raw);
		if (!code) return fail(400, { code: raw, error: 'Codes are five letters and numbers, like K7M4P.' });
		redirect(303, `/join/${code}`);
	}
};
