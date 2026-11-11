// The link preview's picture (TECH.md "Link previews"): the cube mark in the instance theme's colours.
// Pages link it with the colours in its address, so a day's caching never outlives a theme change.
import { previewColors, previewPng } from '#lib/server/preview-image.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const png = await previewPng(previewColors(locals.instanceTheme, locals.appearance.colors));
	return new Response(png as BodyInit, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
};
