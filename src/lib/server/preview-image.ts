// The link preview's picture (TECH.md "Link previews", D72): the cube mark large on the instance
// theme's page colour with an accent rule under it, 1200×630, drawn here with no image library so it
// follows THEME and a custom theme. It has no text; the instance's and group's names go in the card's
// title. An instance with a logo uses the logo instead, as a small card (`linkPreview`).
import { mix, THEMES, type CustomColors } from '#lib/themes.ts';
import type { PreviewImage } from '#lib/link-preview.ts';

export type PreviewColors = { page: string; ink: string; accent: string };

/** The cube theme's own, from app.css (it isn't in THEMES). */
const CUBE: PreviewColors = { page: '#f4f4f2', ink: '#2b2a28', accent: '#e9b44c' };

/** The colours the picture takes from the instance's default theme: a preset's light palette, or the custom theme. */
export function previewColors(instanceTheme: string, custom: CustomColors | null): PreviewColors {
	if (instanceTheme === 'custom' && custom) return { page: custom.page, ink: custom.ink, accent: custom.accent };
	const preset = THEMES.find((t) => t.id === instanceTheme);
	return preset ? { page: preset.light.laminate, ink: preset.light.ink, accent: preset.light.mark } : CUBE;
}

/** What the pages' preview tags show: the drawn picture, or the hoster's logo as a small square. */
export function linkPreview(instanceName: string, instanceTheme: string, appearance: { colors: CustomColors | null; logoUrl: string | null }): PreviewImage {
	if (appearance.logoUrl) return { image: appearance.logoUrl, small: true, alt: `The ${instanceName} logo` };
	const c = previewColors(instanceTheme, appearance.colors);
	// The colours are in the address, so a new theme is a new picture past the chat apps' caches.
	const v = [c.page, c.ink, c.accent].map((h) => h.replace('#', '')).join('-');
	return { image: `/preview.png?v=${v}`, small: false, alt: 'A two-by-two cube shelf with one box in it, the Box Populi mark' };
}

export const PREVIEW_WIDTH = 1200;
export const PREVIEW_HEIGHT = 630;

/** Steps between a shape's colour and the page, for smooth edges. */
const LEVELS = 8;

type Shape = { color: number; box: [number, number, number, number]; distance: (x: number, y: number) => number };

/** Signed distance from (x, y) to a rounded rectangle from (x0, y0) to (x1, y1): negative inside. */
function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number) {
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	const hx = (x1 - x0) / 2 - r;
	const hy = (y1 - y0) / 2 - r;
	return (x: number, y: number) => {
		const qx = Math.abs(x - cx) - hx;
		const qy = Math.abs(y - cy) - hy;
		return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
	};
}

/**
 * The mark as CubeMark.svelte draws it in its 32-unit box, 11 times over, centred above the rule. The
 * stroked frame becomes a ring (its stroke's outer and inner edges), the dividers two bars.
 */
function shapes(): Shape[] {
	const S = 11;
	const ox = (PREVIEW_WIDTH - 32 * S) / 2;
	const oy = 104;
	const at = (u: number, o: number) => o + u * S;
	const rect = (x0: number, y0: number, x1: number, y1: number, r: number) => roundedRect(at(x0, ox), at(y0, oy), at(x1, ox), at(y1, oy), r * S);
	const outer = rect(0, 0, 32, 32, 3.5);
	const inner = rect(3, 3, 29, 29, 0.5);
	const across = rect(2.5, 14.75, 29.5, 17.25, 0);
	const down = rect(14.75, 2.5, 17.25, 29.5, 0);
	const box = (x0: number, y0: number, x1: number, y1: number): Shape['box'] => [Math.floor(at(x0, ox)) - 1, Math.floor(at(y0, oy)) - 1, Math.ceil(at(x1, ox)) + 1, Math.ceil(at(y1, oy)) + 1];
	return [
		{ color: 0, box: box(0, 0, 32, 32), distance: (x, y) => Math.min(Math.max(outer(x, y), -inner(x, y)), across(x, y), down(x, y)) },
		{ color: 1, box: box(5.5, 18.5, 12.5, 27), distance: rect(5.5, 18.5, 12.5, 27, 0.8) },
		{ color: 2, box: box(19.5, 5, 27, 13), distance: rect(19.5, 5, 27, 13, 0.8) },
		{ color: 3, box: [529, 509, 671, 523], distance: roundedRect(530, 510, 670, 522, 6) }
	];
}

/** The picture's pixels, one palette index each: 0 is the page, then LEVELS steps towards each shape's colour. */
export function previewPixels(): Uint8Array {
	const pixels = new Uint8Array(PREVIEW_WIDTH * PREVIEW_HEIGHT);
	for (const shape of shapes()) {
		const [x0, y0, x1, y1] = shape.box;
		for (let y = y0; y < y1; y++) {
			for (let x = x0; x < x1; x++) {
				// Coverage of the pixel, from the distance at its centre; the shapes never touch each other.
				const level = Math.round(Math.min(1, Math.max(0, 0.5 - shape.distance(x + 0.5, y + 0.5))) * LEVELS);
				if (level > 0) pixels[y * PREVIEW_WIDTH + x] = 1 + shape.color * LEVELS + level - 1;
			}
		}
	}
	return pixels;
}

/** The palette for previewPixels: the page, then each of ink, the mark's two boxes and the accent in LEVELS steps. */
export function previewPalette(c: PreviewColors): string[] {
	// The boxes keep the mark's own red and tan (CubeMark.svelte) in every theme.
	const colors = [c.ink, '#c8402e', '#b49a7a', c.accent];
	return [c.page, ...colors.flatMap((color) => Array.from({ length: LEVELS }, (_, i) => mix(c.page, color, (i + 1) / LEVELS)))];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** zlib, as PNG's IDAT wants it, by the runtime's own CompressionStream (Workers and Node both have it). */
async function zlib(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** An 8-bit palette PNG. */
export async function encodePng(width: number, height: number, pixels: Uint8Array, palette: string[]): Promise<Uint8Array> {
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	header.set([8, 3, 0, 0, 0], 8); // 8 bits, palette, deflate, no filter, no interlace
	const plte = new Uint8Array(palette.flatMap((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))));
	// Each row starts with its filter type, 0 (none): the rows are mostly one colour, so deflate does the rest.
	const raw = new Uint8Array(height * (width + 1));
	for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
	const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('PLTE', plte), chunk('IDAT', await zlib(raw)), chunk('IEND', new Uint8Array())];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

/** Pictures already drawn in this isolate, by colours; an instance has one at a time. */
const drawn = new Map<string, Uint8Array>();

/** The picture in these colours as a PNG, drawn once per isolate. */
export async function previewPng(c: PreviewColors): Promise<Uint8Array> {
	const key = `${c.page}${c.ink}${c.accent}`;
	const kept = drawn.get(key);
	if (kept) return kept;
	const png = await encodePng(PREVIEW_WIDTH, PREVIEW_HEIGHT, previewPixels(), previewPalette(c));
	if (drawn.size >= 4) drawn.clear();
	drawn.set(key, png);
	return png;
}
