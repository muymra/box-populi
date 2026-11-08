<!--
	The cube's front edge, painted in its owners' player colours: the shelf's signature.
	Up to four segments; any more owners show as a "+N" label beside the edge.
-->
<script lang="ts">
	import { playerColor } from '#lib/catalog/colors.ts';

	let { owners }: { owners: Array<{ name: string; colorIndex: number }> } = $props();
	const shown = $derived(owners.length > 4 ? owners.slice(0, 4) : owners);
	const extra = $derived(owners.length > 4 ? owners.length - 4 : 0);
	const label = $derived(owners.length ? `Owned by ${owners.map((o) => o.name).join(', ')}` : 'No owner in this group');
</script>

<div class="edge-row" role="img" aria-label={label} title={label}>
	<div class="edge">
		{#each shown as o, i (i)}
			<span style:background={playerColor(o.colorIndex).fill}></span>
		{/each}
	</div>
	{#if extra}<span class="more num" aria-hidden="true">+{extra}</span>{/if}
</div>

<style>
	.edge-row {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 6px; /* the "+N" label overflows this row instead of raising it, so every edge sits on one line */
	}
	.edge {
		flex: 1;
		display: flex;
		gap: 2px;
		height: 6px;
	}
	.edge span {
		flex: 1;
		border-radius: var(--r-cube);
	}
	.more {
		flex: none;
		font-size: 0.75rem;
		font-weight: 800;
		line-height: 6px;
		color: var(--ink-2);
	}
</style>
