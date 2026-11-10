<!--
	Your own marks on your profile: favourites, Play soon or wants, each row with a way to take it off.
	A row taken off stays, faded and struck through, with Undo until you leave the page, as a night's
	"stayed home" rows do. Its button stays the same element throughout, so focus stays on it.
-->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import Heart from '@lucide/svelte/icons/heart';
	import type { OwnMark } from '#lib/profile.ts';

	type Item = { gameId: number; name: string; note?: string };
	let {
		kind,
		items,
		base,
		canEdit,
		first = Infinity,
		empty
	}: { kind: OwnMark; items: Item[]; base: string; canEdit: boolean; first?: number; empty?: Snippet } = $props();

	const LIST = { favourite: 'your favourites', playSoon: 'your Play soon list', want: 'your wants' } as const;

	// Rows taken off here, with where they stood, so they keep their place once the page's data no longer has them.
	let gone = $state<Array<{ item: Item; at: number }>>([]);
	const rows = $derived.by(() => {
		const live = new Set(items.map((i) => i.gameId));
		const out = items.map((i) => ({ ...i, gone: false }));
		for (const g of [...gone].sort((a, b) => a.at - b.at)) {
			if (!live.has(g.item.gameId)) out.splice(Math.min(g.at, out.length), 0, { ...g.item, gone: true });
		}
		return out;
	});
	let all = $state(false);
	const shown = $derived(all ? rows : rows.slice(0, first));

	let busy = $state<number | null>(null);
	let problem = $state<string | null>(null);
	let said = $state('');

	// One function for every row, reading the row from the form as sent: `use:enhance` keeps the
	// function it was first given, so a row captured at render would be stale after its first tap.
	const submit: SubmitFunction = ({ formData, submitter }) => {
		const gameId = Number(formData.get('gameId'));
		const putBack = formData.get('on') === '1';
		const at = rows.findIndex((r) => r.gameId === gameId);
		const { name, note } = rows[at] ?? { name: 'That game' };
		busy = gameId;
		problem = null;
		return async ({ result, update }) => {
			if (result.type === 'success' && !putBack) gone = [...gone.filter((g) => g.item.gameId !== gameId), { item: { gameId, name, note }, at }];
			await update({ reset: false, navigate: false });
			if (result.type === 'success') {
				if (putBack) gone = gone.filter((g) => g.item.gameId !== gameId);
				said = putBack ? `${name} is back on ${LIST[kind]}.` : `Took ${name} off ${LIST[kind]}.`;
			} else if (result.type === 'failure') {
				problem = (result.data?.markError as string | undefined) ?? 'That didn’t work. Try again.';
			}
			busy = null;
			// Disabling the button while it sent took focus off it, and SvelteKit moves focus to the page
			// after an action. It's the same button, now Undo or Remove, so focus goes back once it's enabled.
			await tick();
			if (submitter instanceof HTMLElement && submitter.isConnected) submitter.focus({ preventScroll: true });
		};
	};
</script>

{#if rows.length}
	<ul class="marks">
		{#each shown as row (row.gameId)}
			<li class:gone={row.gone}>
				<span class="what">
					{#if row.gone}<span class="name">{row.name}</span>{:else}<a class="name" href="{base}/game/{row.gameId}">{row.name}</a>{/if}
					{#if row.note && !row.gone}<span class="muted">{row.note}</span>{/if}
				</span>
				{#if canEdit}
					<form method="POST" action="?/mark" use:enhance={submit}>
						<input type="hidden" name="kind" value={kind} />
						<input type="hidden" name="gameId" value={row.gameId} />
						<input type="hidden" name="on" value={row.gone ? '1' : '0'} />
						{#if kind === 'favourite'}
							<button
								class="take"
								class:heart={!row.gone}
								disabled={busy === row.gameId}
								aria-label={row.gone ? `Undo, put ${row.name} back on ${LIST[kind]}` : `Remove ${row.name} from ${LIST[kind]}`}
								title={row.gone ? undefined : 'Remove from your favourites'}
							>
								{#if row.gone}Undo{:else}<Heart size={18} aria-hidden="true" />{/if}
							</button>
						{:else}
							<button class="take" disabled={busy === row.gameId} aria-label={row.gone ? `Undo, put ${row.name} back on ${LIST[kind]}` : `Remove ${row.name} from ${LIST[kind]}`}>
								{row.gone ? 'Undo' : 'Remove'}
							</button>
						{/if}
					</form>
				{/if}
			</li>
		{/each}
	</ul>
	{#if rows.length > first}
		<button type="button" class="link-button all" onclick={() => (all = !all)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>
	{/if}
{:else}
	{@render empty?.()}
{/if}
{#if problem}<p class="banner error" role="alert">{problem}</p>{/if}
<p class="visually-hidden" role="status">{said}</p>

<style>
	.marks {
		list-style: none;
		display: grid;
		margin: var(--s-2) 0 0;
		padding: 0;
	}
	.marks li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		min-height: 44px;
	}
	.what {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 8px;
		min-width: 0;
	}
	.name {
		font-weight: 650;
	}
	/* Taken off: faded and struck through, still there to put back. */
	.gone .what {
		opacity: 0.45;
		text-decoration: line-through;
	}
	.take {
		flex: none;
		min-width: 44px;
		min-height: 44px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--t-small);
		font-weight: 650;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}
	.take:hover {
		color: var(--ink);
	}
	.take.heart {
		display: grid;
		place-items: center;
		color: var(--ink);
		text-decoration: none;
	}
	.take.heart :global(svg) {
		fill: currentColor;
	}
	.take.heart:hover :global(svg) {
		fill: none;
	}
	.take:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.all {
		margin-top: var(--s-2);
		font-size: var(--t-small);
		font-weight: 650;
	}
	.banner {
		margin: var(--s-2) 0 0;
	}
</style>
