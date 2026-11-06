<!--
	The Spines view: each game drawn as a box spine lying on its side, in its box-front colour,
	with the title set along it and the owners' colours on the spine's end. Dense, for scanning
	long shelves at the table.
-->
<script lang="ts">
	import { boxColor, playerColor } from '#lib/catalog/colors.ts';
	import { BUCKET_LABELS, formatPlaytime, weightBucket } from '#lib/catalog/buckets.ts';
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

	const color = $derived(boxColor(game.name));
	const owners = $derived([...new Set(game.copies.map((c) => c.ownerId))].map((id) => members.get(id)).filter((m) => m != null));
	const shown = $derived(owners.length > 4 ? owners.slice(0, 3) : owners);
	const players = $derived(formatPlayersShort(game.minPlayers, game.maxPlayers));
	const time = $derived(formatPlaytime(game.minPlaytime, game.maxPlaytime));
	const bucket = $derived(weightBucket(game.weight));
	const unavailable = $derived(!game.copies.some((c) => isCopyAvailable(c, memberIds)));
	const facts = $derived(
		[players, time, bucket && BUCKET_LABELS[bucket], owners.length > 4 ? `${owners.length} owners` : null]
			.filter(Boolean)
			.join(' · ')
	);
	const ownerLabel = $derived(`Owned by ${owners.map((o) => o.name).join(', ')}`);
</script>

<a class="spine" class:out={unavailable} {href} style:--spine-bg={color.bg} style:--spine-ink={color.ink}>
	<span class="title">{game.name}</span>
	<span class="facts num">
		{facts}
		{#if game.isExpansion}<span class="flag">Expansion</span>{/if}
		{#if unavailable}<span class="flag">Lent out</span>{/if}
		{#if unknown}<span class="flag">Info missing</span>{/if}
	</span>
	<span class="end" role="img" aria-label={ownerLabel} title={ownerLabel}>
		{#each shown as o (o.id)}<span style:background={playerColor(o.colorIndex).bg}></span>{/each}
		{#if owners.length > 4}<span class="rest"></span>{/if}
	</span>
</a>

<style>
	.spine {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--s-3);
		min-height: 46px;
		padding-left: var(--s-3);
		background: var(--spine-bg);
		color: var(--spine-ink);
		text-decoration: none;
		border-radius: var(--r-cube);
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
		transition: transform 0.18s var(--ease-out);
	}
	.spine:hover,
	.spine:focus-visible {
		transform: translateX(4px);
	}
	.out {
		opacity: 0.55;
	}
	.title {
		font-weight: 800;
		font-stretch: 80%;
		font-size: 1.0625rem;
		letter-spacing: -0.005em;
		line-height: 1.1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: var(--s-2) 0;
	}
	.facts {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--t-small);
		font-weight: 600;
		white-space: nowrap;
	}
	.flag {
		padding: 0 6px;
		border-radius: 4px;
		background: var(--cube);
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 700;
	}
	/* the spine's end, painted in the owners' colours */
	.end {
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 12px;
		padding: 0;
	}
	.end > span {
		flex: 1;
	}
	.end > .rest {
		background: var(--ink-3);
	}
	@media (max-width: 480px) {
		.spine {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-rows: auto auto;
			row-gap: 0;
			padding-block: 6px;
		}
		.title {
			padding: 0;
		}
		.facts {
			grid-row: 2;
		}
		.end {
			grid-row: 1 / 3;
			grid-column: 2;
		}
	}
</style>
