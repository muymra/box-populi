<!--
	A game's box front. BGG box art when there is some (linked, never copied: DECISIONS D12);
	otherwise a printed box in a cardboard colour with the title set on it, so hand-entered,
	demo and not-yet-loaded games still stand on the shelf.
-->
<script lang="ts">
	import { boxColor } from '#lib/catalog/colors.ts';

	let {
		name,
		src = null,
		size = 'cube'
	}: { name: string; src?: string | null; size?: 'cube' | 'mini' | 'hero' } = $props();

	let failed = $state(false);
	const color = $derived(boxColor(name));
	const showImage = $derived(!!src && !failed);
</script>

<div class="box {size}" style:--box-bg={color.bg} style:--box-ink={color.ink} class:art={showImage}>
	{#if showImage}
		<img {src} alt="" loading="lazy" decoding="async" onerror={() => (failed = true)} />
	{:else}
		<span class="title" aria-hidden="true">{name}</span>
	{/if}
</div>

<style>
	.box {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 2px;
		background: var(--box-bg);
		color: var(--box-ink);
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
		container-type: inline-size;
	}
	/* the lid seam: a box front, not a tile */
	.box:not(.art)::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 16%;
		height: 1px;
		background: color-mix(in srgb, var(--box-ink) 22%, transparent);
	}
	.box.art {
		background: var(--gap);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.title {
		position: absolute;
		inset: 22% 9% 8%;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
		font-weight: 800;
		font-stretch: 78%;
		line-height: 1.05;
		letter-spacing: -0.005em;
		overflow-wrap: break-word;
		hyphens: manual;
		/* sized from the box's own width so long words fit on cubes of any size */
		font-size: clamp(0.5625rem, 15.5cqi, 1.875rem);
	}
	.mini .title {
		display: none;
	}
	.mini::before {
		top: 22%;
	}
	.hero .title {
		inset: 22% 10% 10%;
	}
</style>
