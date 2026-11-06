<script lang="ts">
	import { enhance } from '$app/forms';
	import GameCover from '#lib/components/GameCover.svelte';
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
		<label class="search">
			<span class="visually-hidden">Search BoardGameGeek</span>
			<input type="search" placeholder="Search BoardGameGeek by title" bind:value={query} oninput={onInput} autocomplete="off" />
		</label>
		<p class="status muted" aria-live="polite">
			{#if status === 'searching'}Searching BoardGameGeek…{:else if status === 'done' && results.length === 0}No matches on BoardGameGeek. Try another spelling, or add it by hand below.{:else if query.trim().length > 0 && query.trim().length < 3}Keep typing…{/if}
		</p>
		{#if message}<p class="banner" role="alert">{message}</p>{/if}
		{#if form?.addError}<p class="banner" role="alert">{form.addError}</p>{/if}

		<ul class="results">
			{#each results as r (r.gameId)}
				<li>
					<GameCover src={r.thumbUrl} name={r.name} size={56} />
					<div class="info">
						<span class="name">{r.name}</span>
						<span class="muted">{r.year ?? 'Year unknown'}{#if r.isExpansion} · Expansion{/if}</span>
					</div>
					{#if r.owned}
						<span class="owned">In your games</span>
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
				<input name="name" required maxlength="120" value={form?.manual?.name ?? ''} />
			</label>
			<div class="pair">
				<label>Fewest players <input name="minPlayers" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.minPlayers ?? ''} /></label>
				<label>Most players <input name="maxPlayers" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.maxPlayers ?? ''} /></label>
			</div>
			<div class="pair">
				<label>Shortest play (min) <input name="minPlaytime" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.minPlaytime ?? ''} /></label>
				<label>Longest play (min) <input name="maxPlaytime" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.maxPlaytime ?? ''} /></label>
			</div>
			<label>
				Image address <span class="hint">optional, must start with https://</span>
				<input name="imageUrl" type="url" value={form?.manual?.imageUrl ?? ''} />
			</label>
			{#if form?.manualError}<p class="banner" role="alert">{form.manualError}</p>{/if}
			<p class="hint">Hand-entered games have no mechanics, themes or complexity, so some filters won't narrow them down.</p>
			<button class="btn">Add game</button>
		</form>
	</details>
</section>

<style>
	.add {
		margin-top: 1rem;
		max-width: 44rem;
	}
	.search input {
		width: 100%;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		font-size: 1.05rem;
		min-height: 3rem;
	}
	.status {
		min-height: 1.5rem;
		margin: 0.4rem 0;
	}
	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.results li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.6rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.owned {
		color: var(--muted);
		font-size: 0.9rem;
		white-space: nowrap;
	}
	.manual {
		margin-top: 1.75rem;
	}
	.manual summary {
		cursor: pointer;
		color: var(--accent);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
</style>
