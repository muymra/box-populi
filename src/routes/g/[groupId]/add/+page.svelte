<script lang="ts">
	import { enhance } from '$app/forms';
	import Search from '@lucide/svelte/icons/search';
	import Check from '@lucide/svelte/icons/check';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Result = { gameId: number; bggId: number; name: string; year: number | null; thumbUrl: string | null; isExpansion: boolean; owned: boolean };

	let query = $state('');
	let results = $state<Result[]>([]);
	let status = $state<'idle' | 'searching' | 'done' | 'error'>('idle');
	let message = $state<string | null>(null);
	let added = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	const bggOn = $derived(data.bggMode !== 'off');
	const myGamesHref = $derived(`/g/${data.group.id}?own=${encodeURIComponent(data.userId)}&avail=0&exp=1`);

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 3) {
			results = [];
			status = 'idle';
			message = null;
			return;
		}
		timer = setTimeout(() => search(q), 400);
	}

	async function search(q: string) {
		controller?.abort();
		controller = new AbortController();
		status = 'searching';
		message = null;
		try {
			const response = await fetch(`/api/bgg/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
			const body = (await response.json()) as { results?: Result[]; error?: string };
			if (!response.ok) {
				status = 'error';
				message = body.error ?? 'Search failed. Try again.';
				return;
			}
			results = body.results ?? [];
			status = 'done';
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			status = 'error';
			message = 'Search failed. Check your connection and try again.';
		}
	}
</script>

<svelte:head><title>Add games · {data.group.name}</title></svelte:head>

<section class="add">
	<p class="muted">Games you add are yours: they show up in every group you're in. <a href={myGamesHref}>Your games ({data.myGameCount + added})</a></p>

	{#if bggOn}
		<div class="strip">
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<span class="visually-hidden">Search BoardGameGeek</span>
				<input type="search" placeholder="Search BoardGameGeek by title" bind:value={query} oninput={onInput} autocomplete="off" />
			</label>
		</div>
		<p class="status muted" aria-live="polite">
			{#if status === 'searching'}Searching BoardGameGeek…{:else if status === 'done' && results.length === 0}No matches on BoardGameGeek. Try another spelling, or add it by hand below.{:else if query.trim().length > 0 && query.trim().length < 3}Keep typing…{/if}
		</p>
		{#if message}<p class="banner error" role="alert">{message}</p>{/if}
		{#if form?.addError}<p class="banner error" role="alert">{form.addError}</p>{/if}

		<ul class="results">
			{#each results as r (r.gameId)}
				<li>
					<span class="mini"><BoxFront name={r.name} src={r.thumbUrl} size="mini" /></span>
					<div class="info">
						<span class="name">{r.name}</span>
						<span class="muted">{r.year ?? 'Year unknown'}{#if r.isExpansion} · Expansion{/if}</span>
					</div>
					{#if r.owned}
						<span class="owned"><Check size={16} aria-hidden="true" /> On your shelf</span>
					{:else}
						<form
							method="POST"
							action="?/add"
							use:enhance={() =>
								async ({ result }) => {
									if (result.type === 'success') {
										r.owned = true;
										added += 1;
									}
								}}
						>
							<input type="hidden" name="gameId" value={r.gameId} />
							<button class="btn primary">Add</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="banner">BoardGameGeek search isn't set up on this site yet, so games are added by hand for now.</p>
	{/if}

	<details class="manual" open={!bggOn || !!form?.manualError}>
		<summary>{bggOn ? "Can't find it? Add it by hand" : 'Add a game by hand'}</summary>
		<form method="POST" action="?/manual" class="stack">
			<label>
				Name
				<input class="field" name="name" required maxlength="120" value={form?.manual?.name ?? ''} />
			</label>
			<div class="pair">
				<label>Fewest players <input class="field" name="minPlayers" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.minPlayers ?? ''} /></label>
				<label>Most players <input class="field" name="maxPlayers" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.maxPlayers ?? ''} /></label>
			</div>
			<div class="pair">
				<label>Shortest play (min) <input class="field" name="minPlaytime" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.minPlaytime ?? ''} /></label>
				<label>Longest play (min) <input class="field" name="maxPlaytime" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.maxPlaytime ?? ''} /></label>
			</div>
			<label>
				Image address <span class="hint">optional, must start with https://</span>
				<input class="field" name="imageUrl" type="url" value={form?.manual?.imageUrl ?? ''} />
			</label>
			{#if form?.manualError}<p class="banner error" role="alert">{form.manualError}</p>{/if}
			<p class="hint">Hand-entered games have no mechanics, themes or complexity, so some filters won't narrow them down.</p>
			<button class="btn">Add game</button>
		</form>
	</details>
</section>

<style>
	.add {
		padding-top: var(--s-3);
		max-width: 46rem;
	}
	.strip {
		background: var(--label);
		border-radius: 10px;
		padding: var(--s-3);
		margin-bottom: var(--s-2);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: 0 var(--s-3);
		background: var(--label-field);
		border-radius: var(--r-ctl);
		color: var(--label-ink-2);
	}
	.search:focus-within {
		outline: 2px solid var(--mark);
		outline-offset: 1px;
	}
	.search input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		border: 0;
		background: none;
		color: var(--label-ink);
		font-size: 1.0625rem;
		outline: none;
	}
	.search input::placeholder {
		color: var(--label-ink-2);
	}
	.status {
		min-height: 1.5rem;
		margin: var(--s-2) 0;
	}
	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.results:empty {
		display: none;
	}
	.results li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-3);
		background: var(--cube);
	}
	.mini {
		flex: none;
		width: 40px;
		height: 42px;
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.info .muted {
		font-size: var(--t-small);
	}
	.owned {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--ink-2);
		font-size: var(--t-small);
		font-weight: 650;
		white-space: nowrap;
	}
	.manual {
		margin-top: var(--s-6);
		padding: var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.manual summary {
		cursor: pointer;
		font-weight: 700;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-3);
	}
</style>
