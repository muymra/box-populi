<!--
	The cube's front edge, painted in its owners' player colours: the shelf's signature.
	Up to four segments; more owners show as a fourth "+N" segment.
-->
<script lang="ts">
	import { playerColor } from '#lib/catalog/colors.ts';

	let { owners }: { owners: Array<{ name: string; colorIndex: number }> } = $props();
	const shown = $derived(owners.length > 4 ? owners.slice(0, 3) : owners);
	const extra = $derived(owners.length > 4 ? owners.length - 3 : 0);
	const label = $derived(owners.length ? `Owned by ${owners.map((o) => o.name).join(', ')}` : 'No owner in this group');
</script>

<div class="edge" role="img" aria-label={label} title={label}>
	{#each shown as o, i (i)}
		<span style:background={playerColor(o.colorIndex).bg}></span>
	{/each}
	{#if extra}<span class="more">+{extra}</span>{/if}
</div>

<style>
	.edge {
		display: flex;
		gap: 2px;
		height: 6px;
	}
	span {
		flex: 1;
		border-radius: 1px;
	}
	.more {
		flex: 0.8;
		background: var(--ink-3);
		height: 6px;
		font-size: 0;
	}
</style>
