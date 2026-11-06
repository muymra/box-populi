<!-- A searchable list of checkboxes, built for lists of 50+ (members, mechanics, themes). -->
<script lang="ts">
	let {
		label,
		options,
		selected = $bindable([]),
		visible = 12
	}: {
		label: string;
		options: Array<{ value: string; label: string }>;
		selected: string[];
		visible?: number;
	} = $props();

	let query = $state('');
	let showAll = $state(false);

	const matches = $derived(
		query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options
	);
	const shown = $derived(showAll || query.trim() ? matches : matches.slice(0, visible));

	function toggle(value: string, on: boolean) {
		selected = on ? [...selected, value] : selected.filter((v) => v !== value);
	}
</script>

<fieldset>
	<legend>{label}{#if selected.length}<span class="muted">{' · '}{selected.length} selected</span>{/if}</legend>
	{#if options.length > visible}
		<input type="search" placeholder="Search {label.toLowerCase()}" bind:value={query} aria-label="Search {label}" />
	{/if}
	<div class="items">
		{#each shown as option (option.value)}
			<label>
				<input
					type="checkbox"
					checked={selected.includes(option.value)}
					onchange={(e) => toggle(option.value, e.currentTarget.checked)}
				/>
				{option.label}
			</label>
		{:else}
			<p class="muted">No matches.</p>
		{/each}
	</div>
	{#if !query.trim() && matches.length > visible}
		<button type="button" class="link" onclick={() => (showAll = !showAll)}>
			{showAll ? 'Show fewer' : `Show all ${matches.length}`}
		</button>
	{/if}
	{#if selected.length}
		<button type="button" class="link" onclick={() => (selected = [])}>Clear</button>
	{/if}
</fieldset>

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		font-weight: 700;
		padding: 0;
		margin-bottom: var(--s-2);
	}
	input[type='search'] {
		width: 100%;
		min-height: 40px;
		padding: 0 var(--s-3);
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--laminate);
		margin-bottom: var(--s-2);
	}
	.items {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 0 var(--s-4);
	}
	label {
		display: flex;
		gap: var(--s-2);
		align-items: center;
		min-height: 36px;
		font-size: 0.9375rem;
	}
	input[type='checkbox'] {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
		flex: none;
	}
	.link {
		background: none;
		border: none;
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		padding: var(--s-1) 0;
		margin-right: var(--s-4);
		cursor: pointer;
		font-size: var(--t-small);
		font-weight: 600;
	}
</style>
