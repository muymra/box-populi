<!--
	Picks this device's colour theme (DESIGN.md "Themes"). "Automatic" follows the group's theme on
	group pages and the instance's elsewhere. With JavaScript the page switches at once (the root
	layout applies `current`) and the choice is saved in the background; without, the form posts.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Palette from '@lucide/svelte/icons/palette';
	import { AUTO_THEME, THEME_IDS, THEME_LABELS } from '#lib/themes.ts';

	let { current = $bindable() }: { current: string } = $props();
	let enhanced = $state(false);

	$effect(() => {
		enhanced = true;
	});

	function pick(event: Event & { currentTarget: HTMLSelectElement }) {
		current = event.currentTarget.value;
		fetch('/theme', { method: 'POST', body: new FormData(event.currentTarget.form!), headers: { accept: 'application/json' } }).catch(() => {});
	}
</script>

<form method="POST" action="/theme" class="picker">
	<input type="hidden" name="returnTo" value={page.url.pathname + page.url.search} />
	<label>
		<Palette size={16} aria-hidden="true" />
		<span>Theme</span>
		<select name="theme" value={current} onchange={pick}>
			<option value={AUTO_THEME}>Automatic</option>
			{#each THEME_IDS as id (id)}<option value={id}>{THEME_LABELS[id]}</option>{/each}
		</select>
	</label>
	{#if !enhanced}<button class="link-button">Use</button>{/if}
</form>

<style>
	.picker {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	select {
		appearance: none;
		min-height: 36px;
		padding: 0 28px 0 var(--s-2);
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--cube) var(--chevron) no-repeat right 10px center;
		color: var(--ink);
		font: inherit;
		font-weight: 650;
	}
	select:focus {
		border-color: var(--ink-3);
	}
</style>
