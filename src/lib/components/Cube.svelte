<!-- One cube of the shelf: the box front, the name under box art, a players/time caption, and the owner-colour edge. -->
<script lang="ts">
	import Compartment from './Compartment.svelte';
	import OwnerEdge from './OwnerEdge.svelte';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import { formatPlaytime, spokenPlaytime } from '#lib/catalog/buckets.ts';
	import { formatPlayersShort, spokenPlayers, spokenRanges } from '#lib/catalog/players.ts';
	import { isCopyAvailable } from '#lib/catalog/filter.ts';
	import { addedCounts } from '#lib/catalog/extensions.ts';
	import type { CatalogGame, CatalogMember, CubeGame } from '#lib/catalog/types.ts';

	/**
	 * `unknown`: an active filter let this game through only because it lacks that detail. `via`: the
	 * players filter let it through with an expansion, as "With the 5-6 Player Extension" (STATUS item 30).
	 * `adding`: the group's expansions that add to its range, each shown with its own count from BGG after a
	 * puzzle piece, "3–4p · 🧩5–6" (D74), or an owner's own count, "3–5p · 🧩7" (D75).
	 */
	let {
		game,
		href,
		members,
		memberIds,
		unknown = false,
		via = null,
		adding = []
	}: {
		game: CubeGame;
		href: string;
		members: Map<string, CatalogMember>;
		memberIds: ReadonlySet<string>;
		unknown?: boolean;
		via?: string | null;
		adding?: readonly CatalogGame[];
	} = $props();

	const owners = $derived(
		[...new Set(game.copies.map((c) => c.ownerId))]
			.map((id) => members.get(id))
			.filter((m) => m != null)
			.map((m) => ({ name: m.name, colorIndex: m.colorIndex }))
	);
	const players = $derived(formatPlayersShort(game.minPlayers, game.maxPlayers));
	const time = $derived(formatPlaytime(game.minPlaytime, game.maxPlaytime));
	const unavailable = $derived(!game.copies.some((c) => isCopyAvailable(c, memberIds)));
	const captionText = $derived([players, time].filter(Boolean).join(' · '));
	// "3–4 players; 5–6 with the 5-6 Player Extension": each count BGG's, next to the game it's for; or whose count it is.
	const added = $derived(addedCounts(game, adding, (id) => members.get(id)?.name ?? 'Someone'));
	const addedTitle = $derived(added?.title ?? null);
	// One flag fits on a box: lent out first, then the filter notes, then expansion. An expansion's name
	// is too long for the pill, so the pill says "With expansion" and its title names it.
	const flag = $derived(unavailable ? 'Lent out' : via ? 'With expansion' : unknown ? 'Info missing' : game.isExpansion ? 'Expansion' : null);
	// The link is named by its contents: this lead, then the owners from the edge. The name leads, with
	// every flag that applies (only one fits on the box), then the caption in words, since "3–4p · 🧩7"
	// reads badly aloud; Compartment hides the drawn caption from screen readers when there's a lead.
	const lead = $derived.by(() => {
		const head = [game.name, game.year, unavailable && 'lent out', via?.toLowerCase(), unknown && 'info missing', game.isExpansion && 'expansion'];
		const facts = [
			spokenPlayers(game.minPlayers, game.maxPlayers),
			added && spokenRanges(added.line).replace(/^Up to/, 'up to'),
			spokenPlaytime(game.minPlaytime, game.maxPlaytime),
			!captionText && game.isManual && 'hand-entered'
		];
		const said = facts.filter(Boolean).join(', ');
		return `${head.filter(Boolean).join(', ')}.${said ? ` ${said}.` : ''}`;
	});
</script>

<Compartment {href} name={game.name} src={game.thumbUrl} {lead} {flag} flagTitle={!unavailable ? via : null} out={unavailable}>
	{#snippet caption()}
		{#if added}{players}{' · '}<span class="added" title={addedTitle}><Puzzle size={12} aria-hidden="true" />{added.text}</span
			>{#if time}<span class="time">{' · '}{time}</span>{/if}
		{:else}{captionText || (game.isManual ? 'Hand-entered' : ' ')}{/if}
	{/snippet}
	{#snippet edge()}<OwnerEdge {owners} />{/snippet}
</Compartment>

<style>
	.added :global(svg) {
		vertical-align: -1px;
		margin-right: 1px;
	}
	/* Three cubes across a phone: the expansion's count keeps its room, the play time gives way (D74). */
	@media (max-width: 759px) {
		.time {
			display: none;
		}
	}
</style>
