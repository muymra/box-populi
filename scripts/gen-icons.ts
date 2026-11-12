// Draws the home-screen icons in static/ from the cube mark (favicon.svg, CubeMark.svelte), for the
// installable app (D76). Run after changing the mark:
//   node scripts/gen-icons.ts
// src/lib/server/home-screen.ts lists them in the manifest; home-screen.test.ts checks each is there at its size.
// static/apple-touch-icon.png is older and stays as it is: the mark to the edge, which iPhones round off.
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const INK = '#2b2a28';
const PAPER = '#f4f4f2';
const RED = '#c8402e';
const TAN = '#b49a7a';

type Layer = { color: string; distance: (x: number, y: number) => number };

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

/** The mark in its 32-unit box, `scale` pixels to the unit, from (ox, oy): layers painted in order. */
function mark(scale: number, ox: number, oy: number): Layer[] {
	const r = (x0: number, y0: number, x1: number, y1: number, radius: number) =>
		roundedRect(ox + x0 * scale, oy + y0 * scale, ox + x1 * scale, oy + y1 * scale, radius * scale);
	return [
		// The stroked frame of favicon.svg: its outer edge, then the paper inside its inner edge.
		{ color: INK, distance: r(0, 0, 32, 32, 3.5) },
		{ color: PAPER, distance: r(3, 3, 29, 29, 0.5) },
		{ color: INK, distance: r(14.75, 2.5, 17.25, 29.5, 0) },
		{ color: INK, distance: r(2.5, 14.75, 29.5, 17.25, 0) },
		{ color: RED, distance: r(5.5, 18.5, 12.5, 27, 0.8) },
		{ color: TAN, distance: r(19.5, 5, 27, 13, 0.8) }
	];
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** RGBA pixels: each layer covers a pixel by its distance from the pixel's centre, painted over what's below. */
function paint(size: number, background: string | null, layers: Layer[]): Uint8Array {
	const out = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			// Premultiplied colour and alpha.
			let [r, g, b] = background ? rgb(background) : [0, 0, 0];
			let a = background ? 1 : 0;
			for (const layer of layers) {
				const c = Math.min(1, Math.max(0, 0.5 - layer.distance(x + 0.5, y + 0.5)));
				if (c === 0) continue;
				const [lr, lg, lb] = rgb(layer.color);
				r = lr * c + r * (1 - c);
				g = lg * c + g * (1 - c);
				b = lb * c + b * (1 - c);
				a = c + a * (1 - c);
			}
			const i = (y * size + x) * 4;
			const un = (v: number) => Math.round(a === 0 ? 0 : (v / a) * 255);
			out.set([un(r), un(g), un(b), Math.round(a * 255)], i);
		}
	}
	return out;
}

function chunk(type: string, data: Uint8Array): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
	return Buffer.concat([head, data, crc]);
}

/** An 8-bit RGBA PNG. */
function png(size: number, pixels: Uint8Array): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, deflate, no filter, no interlace
	const raw = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++) raw.set(pixels.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** The mark on nothing, an eighth of its width spare around it: for launchers that show the icon as drawn. */
function plain(size: number): Buffer {
	const scale = (size * 0.875) / 32;
	const o = (size - 32 * scale) / 2;
	return png(size, paint(size, null, mark(scale, o, o)));
}

/**
 * For launchers that cut the icon to their own shape: the frame's ink to every edge, so the shelf's four
 * cubbies (their 26 units) sit inside the middle circle, 80% of the width, that every shape keeps.
 */
function maskable(size: number): Buffer {
	const scale = (size * 0.8) / Math.SQRT2 / 26;
	const o = size / 2 - 16 * scale;
	return png(size, paint(size, INK, mark(scale, o, o)));
}

const write = (name: string, data: Buffer) => {
	writeFileSync(new URL(`../static/${name}`, import.meta.url), data);
	console.log(`Wrote static/${name}`);
};
write('icon-192.png', plain(192));
write('icon-512.png', plain(512));
write('icon-maskable-512.png', maskable(512));
