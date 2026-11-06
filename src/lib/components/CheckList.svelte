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
	<legend>{label}{#if selected.length}<span class="muted"> · {selected.length} selected</span>{/if}</legend>
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
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.6rem 0.8rem;
		margin: 0;
		min-width: 0;
	}
	legend {
		font-weight: 600;
		padding: 0 0.25rem;
	}
	input[type='search'] {
		width: 100%;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		margin-bottom: 0.4rem;
	}
	.items {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 0.1rem 0.75rem;
	}
	label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-height: 2rem;
		font-size: 0.92rem;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent);
		padding: 0.25rem 0;
		margin-right: 0.75rem;
		cursor: pointer;
	}
</style>
