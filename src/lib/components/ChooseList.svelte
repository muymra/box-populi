<!--
	Choosing games by hand in Play tonight (PRD "Picker"), search first: a room of 12 games or fewer is
	listed whole; in a bigger one nothing shows until someone types, then the best 8 matches. Games
	outside the limits come last, tagged with why, so the group can still choose one.
-->
<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import ListRow from '#lib/components/ListRow.svelte';
	import { normalize } from '#lib/catalog/normalize.ts';
	import { chooseOrder } from '#lib/catalog/pick.ts';
	import type { CatalogGame, CatalogMember } from '#lib/catalog/types.ts';

	let {
		fits,
		room,
		chosen,
		players,
		why,
		blocked = () => null,
		addingOf = () => [],
		full = null,
		onchoose,
		groupId,
		members,
		memberIds,
		heading,
		placeholder
	}: {
		/** Games that fit the limits; they come first. */
		fits: CatalogGame[];
		/** Everything that can be chosen, the limits aside. */
		room: CatalogGame[];
		/** Ids chosen or kept; their toggle is pressed. */
		chosen: readonly number[];
		players: number | null;
		/** Why a game is outside the limits, as tags. */
		why: (game: CatalogGame) => string[];
		/** Why this one game can't be chosen now, shown as a tag. */
		blocked?: (game: CatalogGame) => string | null;
		/** The expansions here that add to the game's range, each shown with its own count (D74). */
		addingOf?: (game: CatalogGame) => readonly CatalogGame[];
		/** Why nothing more can be chosen, shown above the matches. */
		full?: string | null;
		onchoose: (game: CatalogGame) => void;
		groupId: string;
		members: Map<string, CatalogMember>;
		memberIds: ReadonlySet<string>;
		heading: string;
		placeholder: string;
	} = $props();

	/** At most this many matches show, and a room this small is listed whole. */
	const SHOWN = 8;
	const WHOLE = 12;
	const id = $props.id();
	let query = $state('');
	const q = $derived(normalize(query));
	const searchable = $derived(room.length > WHOLE);
	const fitIds = $derived(new Set(fits.map((g) => g.id)));
	const fitsLimits = (g: CatalogGame) => fitIds.has(g.id);
	const shown = $derived(
		!searchable ? chooseOrder(room, players, fitsLimits) : q ? chooseOrder(room.filter((g) => g.search.includes(q)), players, fitsLimits).slice(0, SHOWN) : []
	);
</script>

<div class="choose">
	{#if searchable}
		<label class="find-label" for="{id}-find">{heading}</label>
		<div class="find">
			<Search size={18} aria-hidden="true" />
			<input id="{id}-find" class="field" type="search" {placeholder} autocomplete="off" bind:value={query} />
		</div>
	{:else}
		<h3 class="find-label">{heading}</h3>
	{/if}
	{#if full && shown.length}<p class="hint">{full}</p>{/if}
	{#if shown.length}
		<ul aria-label={heading}>
			{#each shown as game (game.id)}
				{@const isChosen = chosen.includes(game.id)}
				{@const reason = isChosen ? null : (blocked(game) ?? (full ? 'full' : null))}
				{@const tags = [...why(game), ...(reason && reason !== 'full' ? [reason] : [])]}
				<li>
					<ListRow {game} href="/g/{groupId}/game/{game.id}" {members} {memberIds} adding={addingOf(game)} />
					<button
						type="button"
						class="toggle"
						aria-pressed={isChosen}
						disabled={!!reason}
						onclick={() => onchoose(game)}
						aria-label="{isChosen ? 'Unchoose' : 'Choose'} {game.name}">{isChosen ? 'Chosen' : 'Choose'}</button
					>
					{#if tags.length}<span class="tags">{#each tags as tag (tag)}<span class="tag">{tag}</span>{/each}</span>{/if}
				</li>
			{/each}
		</ul>
	{:else if q}
		<p class="muted">Nothing here matches “{query.trim()}”.</p>
	{/if}
</div>

<style>
	.choose {
		display: grid;
		gap: var(--s-2);
		max-width: 44rem;
	}
	.find-label {
		margin: 0;
		font-size: var(--t-body);
		font-weight: 700;
	}
	.find {
		position: relative;
		max-width: 24rem;
	}
	.find :global(svg) {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--ink-3);
		pointer-events: none;
	}
	.find .field {
		width: 100%;
		padding-left: 38px;
	}
	.hint {
		margin: 0;
	}
	ul {
		list-style: none;
		margin: var(--s-1, 4px) 0 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		column-gap: var(--s-2);
	}
	.tags {
		grid-column: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}
	/* A toggle like a person in who's here: marigold once chosen (Marigold Means Chosen). */
	.toggle {
		min-height: 40px;
		min-width: 6rem;
		padding: 0 14px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		color: var(--ink);
		font-weight: 650;
		cursor: pointer;
	}
	.toggle:hover:not(:disabled) {
		border-color: var(--ink-3);
	}
	.toggle[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
