import { fail, redirect } from '@sveltejs/kit';
import { normalizeCode } from '#lib/server/codes.ts';
import { cleanSignInCode } from '#lib/server/recovery.ts';
import { GROUP_CODE_EXAMPLE } from '#lib/codes.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const raw = String((await request.formData()).get('code') ?? '');
		const code = normalizeCode(raw);
		if (!code) {
			// A sign-in code in the wrong place (D48): say where it goes rather than just "wrong".
			const error = cleanSignInCode(raw)
				? 'That’s a sign-in code. It goes on your group’s page, after you tap your name. A group code has five characters.'
				: `Codes are five letters and numbers, like ${GROUP_CODE_EXAMPLE}.`;
			return fail(400, { code: raw, error });
		}
		redirect(303, `/join/${code}`);
	}
};
