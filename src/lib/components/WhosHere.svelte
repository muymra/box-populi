<script lang="ts">
	// "Who's here" toggles plus guests typed in by name (PRD "Picker"). Used by the picker and the start
	// player modal; both edit the same Table, so ticking someone in one shows in the other. Regulars come
	// first; in a big group the rest fold behind "N more".
	import { untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import UserRoundPlus from '@lucide/svelte/icons/user-round-plus';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { MAX_GUESTS, MAX_GUEST_NAME, cleanGuestName } from '#lib/table/here.ts';
	import { foldMembers, nightOf, rankMembers } from '#lib/table/regulars.ts';
	import type { HereSelection } from '#lib/table/table.svelte.ts';

	type Member = { id: string; name: string; colorIndex: number };
	let { members, table }: { members: Member[]; table: HereSelection } = $props();
	const id = $props.id();

	let query = $state('');
	let guestName = $state('');
	let guestNote = $state<string | null>(null);

	let expanded = $state(false);
	// Anyone tapped while folded stays in view until the list loads again, even after unticking.
	let touched = $state<string[]>([]);
	$effect(() => {
		void table.loads;
		untrack(() => {
			expanded = false;
			touched = [];
			query = '';
		});
	});

	const ranked = $derived(rankMembers(members, table.regulars, nightOf(Date.now())));
	const folded = $derived(foldMembers(ranked, new Set([...table.members, ...touched])));
	const shown = $derived(
		expanded ? ranked.filter((m) => !query.trim() || m.name.toLowerCase().includes(query.trim().toLowerCase())) : folded.shown
	);

	function toggle(memberId: string) {
		if (!touched.includes(memberId)) touched = [...touched, memberId];
		table.toggleMember(memberId);
	}

	// Not a <form>: the play log puts these chips inside its own form, and forms can't nest.
	function addGuest() {
		const name = cleanGuestName(guestName);
		if (!name) return;
		if (table.guests.length >= MAX_GUESTS) guestNote = `That's ${MAX_GUESTS} guests, the most there's room for.`;
		else if (table.addGuest(name)) {
			guestName = '';
			guestNote = null;
		} else guestNote = `${name} is already here.`;
	}
</script>

<div class="whos-here">
	{#if expanded && members.length > 12}
		<!-- Enter only searches: inside the play log's form it would otherwise submit the play. -->
		<input
			class="field find"
			type="search"
			placeholder="Find a name"
			bind:value={query}
			aria-label="Find a member"
			onkeydown={(e) => {
				if (e.key === 'Enter') e.preventDefault();
			}}
		/>
	{/if}
	<div class="people" role="group" aria-label="People at the table">
		{#each shown as m (m.id)}
			{@const c = playerColor(m.colorIndex)}
			<button type="button" class="person" aria-pressed={table.members.includes(m.id)} onclick={() => toggle(m.id)}>
				<span class="dot" style:background={c.fill}></span>{m.name}
			</button>
		{/each}
		{#each table.guests as name (name)}
			<span class="person guest">
				<span class="dot"></span>{name}
				<button type="button" class="remove" aria-label="Remove {name}" onclick={() => table.removeGuest(name)}><X size={16} aria-hidden="true" /></button>
			</span>
		{/each}
		{#if folded.hidden > 0}
			<button type="button" class="person more" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
				{#if expanded}<ChevronUp size={18} aria-hidden="true" /> Fewer{:else}<ChevronDown size={18} aria-hidden="true" /> {folded.hidden} more{/if}
			</button>
		{/if}
	</div>
	<div class="add-guest">
		<label class="visually-hidden" for="{id}-guest">Add someone without an account</label>
		<input
			id="{id}-guest"
			class="field"
			type="text"
			autocomplete="off"
			maxlength={MAX_GUEST_NAME}
			placeholder="Add a guest by name"
			bind:value={guestName}
			oninput={() => (guestNote = null)}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					addGuest();
				}
			}}
		/>
		<button type="button" class="btn" disabled={!guestName.trim()} onclick={addGuest}><UserRoundPlus size={18} aria-hidden="true" /> Add</button>
	</div>
	{#if guestNote}<p class="hint" role="status">{guestNote}</p>{/if}
</div>

<style>
	.find {
		max-width: 20rem;
		margin-bottom: var(--s-3);
	}
	.people {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.person {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 40px;
		padding: 0 14px 0 10px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		color: var(--ink);
		font-weight: 650;
		cursor: pointer;
	}
	.person .dot {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		flex: none;
	}
	.person[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	/* A guest is at the table while listed, so the chip reads as ticked; no player colour, since those mean a member. */
	.guest {
		cursor: default;
		padding-right: 4px;
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	/* Unfolds the rest of the group: dashed and quiet, so it doesn't read as a person. */
	.more {
		padding: 0 14px 0 10px;
		border-style: dashed;
		background: none;
		color: var(--ink-2);
		gap: 4px;
	}
	.more:hover {
		border-color: var(--ink-3);
		color: var(--ink);
	}
	.guest .dot {
		box-shadow: inset 0 0 0 2px currentColor;
	}
	.remove {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.remove:hover {
		background: rgb(0 0 0 / 0.1);
	}
	.add-guest {
		display: flex;
		gap: var(--s-2);
		max-width: 24rem;
		margin-top: var(--s-3);
	}
	.add-guest .field {
		flex: 1;
		min-width: 0;
	}
	.add-guest .btn {
		flex: none;
	}
	.hint {
		margin: var(--s-2) 0 0;
	}
</style>
