<!--
	Cover image linked from BGG's CDN (DECISIONS D12): lazy, async, fixed size, never prefetched,
	referrer left on so BGG can see where requests come from. Falls back to initials when there's
	no image or it fails to load, so a blocked URL never breaks the layout.
-->
<script lang="ts">
	let { src, name, size = 72 }: { src: string | null; name: string; size?: number } = $props();

	let failed = $state(false);
	const initials = $derived(
		name
			.replace(/[^\p{L}\p{N}\s]/gu, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('')
	);
</script>

{#if src && !failed}
	<img
		{src}
		alt=""
		width={size}
		height={size}
		loading="lazy"
		decoding="async"
		style:width="{size}px"
		style:height="{size}px"
		onerror={() => (failed = true)}
	/>
{:else}
	<div class="placeholder" style:width="{size}px" style:height="{size}px" style:font-size="{size / 2.8}px" aria-hidden="true">
		{initials}
	</div>
{/if}

<style>
	img,
	.placeholder {
		flex: none;
		border-radius: 8px;
		object-fit: cover;
		background: var(--surface-2);
	}
	.placeholder {
		display: grid;
		place-items: center;
		color: var(--muted);
		font-weight: 600;
		letter-spacing: 0.02em;
	}
</style>
