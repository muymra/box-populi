<!-- One cube of the shelf: the box front, the name under box art, a players/time caption, and the owner-colour edge. -->
<script lang="ts">
	import Compartment from './Compartment.svelte';
	import OwnerEdge from './OwnerEdge.svelte';
	import { formatPlaytime } from '#lib/catalog/buckets.ts';
	import { formatPlayersShort } from '#lib/catalog/players.ts';
	import { isCopyAvailable } from '#lib/catalog/filter.ts';
	import type { CatalogGame, CatalogMember } from '#lib/catalog/types.ts';

	/** `unknown`: an active filter let this game through only because it lacks that detail. */
	let {
		game,
		href,
		members,
		memberIds,
		unknown = false
	}: { game: CatalogGame; href: string; members: Map<string, CatalogMember>; memberIds: ReadonlySet<string>; unknown?: boolean } = $props();

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
	// One flag fits on a box: lent out first, then the filter note, then expansion.
	const flag = $derived(unavailable ? 'Lent out' : unknown ? 'Info missing' : game.isExpansion ? 'Expansion' : null);
	// The link is named by its contents, so a screen reader hears the caption and the owners too. The
	// name leads, with every flag that applies (only one fits on the box).
	const lead = $derived(
		[game.name, game.year, unavailable && 'lent out', unknown && 'info missing', game.isExpansion && 'expansion'].filter(Boolean).join(', ') + '.'
	);
</script>

<Compartment {href} name={game.name} src={game.thumbUrl} {lead} {flag} out={unavailable}>
	{#snippet caption()}{captionText || (game.isManual ? 'Hand-entered' : ' ')}{/snippet}
	{#snippet edge()}<OwnerEdge {owners} />{/snippet}
</Compartment>
