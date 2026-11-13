<script lang="ts">
	// One group setting as a folding row of a form panel: its name and current value, opening to the
	// hint and the form (DESIGN.md "Group tab"). Opens by itself when the form comes back with an
	// error, and stays as the person left it after a save, so "Saved." can show.
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		label,
		value,
		hint,
		error = false,
		children
	}: { label: string; value: string; hint?: string; error?: boolean; children: Snippet } = $props();
	let open = $state(false);
	$effect(() => {
		if (error) open = true;
	});
</script>

<div class="form-row">
	<details class="setting" bind:open>
		<summary>
			<span class="text">
				<span class="form-q">{label}</span>
				<span class="value">{value}</span>
			</span>
			<ChevronDown size={18} aria-hidden="true" />
		</summary>
		<div class="form-body">
			{#if hint}<p class="hint">{hint}</p>{/if}
			{@render children()}
		</div>
	</details>
</div>

<style>
	/* Folded rows sit closer than a question with its controls, and the fold spans the row's columns. */
	.form-row {
		padding-block: var(--s-3);
	}
	.setting {
		grid-column: 1 / -1;
	}
	summary {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		min-height: 44px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.text {
		display: grid;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.value {
		font-size: var(--t-small);
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}
	summary :global(svg) {
		flex: none;
		color: var(--ink-2);
		transition: transform 0.2s var(--ease-out);
	}
	summary:hover :global(svg) {
		color: var(--ink);
	}
	.setting[open] summary :global(svg) {
		transform: rotate(180deg);
	}
	.form-body {
		padding-top: var(--s-3);
	}
</style>
