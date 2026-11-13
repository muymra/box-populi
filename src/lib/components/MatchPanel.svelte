<!--
	Find on BoardGameGeek (D57, TECH.md "Find on BoardGameGeek"): the person's typed-in and Wikidata
	games are looked up on BGG one at a time, at BGG's pace, then they tick the right matches and each
	ticked game is merged into its BGG game, ten per call. Stopping part-way keeps what was found.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import BoxFront from './BoxFront.svelte';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import { formatPlaytime } from '#lib/catalog/buckets.ts';

	type Game = {
		gameId: number;
		name: string;
		source: 'manual' | 'wikidata';
		minPlayers: number | null;
		maxPlayers: number | null;
		minPlaytime: number | null;
		maxPlaytime: number | null;
	};
	type Candidate = {
		gameId: number;
		bggId: number;
		name: string;
		year: number | null;
		thumbUrl: string | null;
		isExpansion: boolean;
		minPlayers: number | null;
		maxPlayers: number | null;
		exact: boolean;
	};

	let { groupId, shelfHref, games }: { groupId: string; shelfHref: string; games: Game[] } = $props();

	const MERGE_CHUNK = 7; // MERGES_PER_CALL in bgg-match.ts: the confirm endpoint refuses more

	let phase = $state<'idle' | 'finding' | 'review' | 'saving' | 'done'>('idle');
	// Candidates per game, in the order games were looked up; a game not looked up yet has no entry.
	let found = $state<Record<number, Candidate[]>>({});
	let choice = $state<Record<number, number>>({});
	let include = $state<Record<number, boolean>>({});
	let merged = $state<Record<number, boolean>>({});
	let progress = $state({ done: 0, total: 0 });
	let waiting = $state<string | null>(null);
	let error = $state<string | null>(null);
	let stopRequested = false;

	const checked = $derived(games.filter((g) => found[g.gameId]));
	const remaining = $derived(games.filter((g) => !found[g.gameId]));
	const withMatches = $derived(checked.filter((g) => found[g.gameId].length > 0));
	const chosen = $derived(withMatches.filter((g) => include[g.gameId] && !merged[g.gameId] && choice[g.gameId] != null));
	const mergedCount = $derived(Object.values(merged).filter(Boolean).length);
	const left = $derived(games.filter((g) => !merged[g.gameId]).length);

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

	/** Looks up every game not looked up yet, one per request, waiting whenever BGG or the limit says so. */
	async function find() {
		error = null;
		stopRequested = false;
		phase = 'finding';
		const queue = [...remaining];
		progress = { done: checked.length, total: games.length };
		let backoff = 5_000;
		for (let i = 0; i < queue.length && !stopRequested; ) {
			const game = queue[i];
			let response: Response;
			let body: { candidates?: Candidate[]; error?: string; retryAfterMs?: number };
			try {
				response = await post('/api/bgg/match', { groupId, gameId: game.gameId });
				body = await response.json();
			} catch {
				error = 'Lost the connection. What was found so far is below; carry on when you’re back online.';
				break;
			}
			// 503: BGG is busy. 429: this person's limit is used up for now. Same game again after the wait.
			if ((response.status === 503 || response.status === 429) && body.retryAfterMs != null) {
				const wait = Math.max(body.retryAfterMs, backoff);
				waiting =
					response.status === 429
						? `That’s a lot of games at once. Carrying on in ${Math.ceil(wait / 1000)} seconds.`
						: `BoardGameGeek asked us to slow down. Carrying on in ${Math.ceil(wait / 1000)} seconds.`;
				await sleep(wait);
				backoff = Math.min(backoff * 2, 60_000);
				waiting = null;
				continue;
			}
			// 404: it no longer needs matching (removed, or matched from another tab). Nothing to offer.
			if (!response.ok && response.status !== 404) {
				error = body.error ?? 'Looking up games stopped.';
				break;
			}
			const candidates = response.ok ? (body.candidates ?? []) : [];
			found[game.gameId] = candidates;
			if (candidates.length) {
				choice[game.gameId] = candidates[0].gameId;
				// Only an exact title is ticked for the person; anything looser waits for their say.
				include[game.gameId] = candidates[0].exact;
			}
			progress = { done: checked.length, total: games.length };
			i++;
		}
		waiting = null;
		phase = 'review';
	}

	async function save() {
		const picked = chosen.map((g) => ({ gameId: g.gameId, targetId: choice[g.gameId] }));
		error = null;
		phase = 'saving';
		progress = { done: 0, total: picked.length };
		try {
			for (let i = 0; i < picked.length; i += MERGE_CHUNK) {
				const chunk = picked.slice(i, i + MERGE_CHUNK);
				const response = await post('/api/bgg/match/confirm', { groupId, pairs: chunk });
				const body = (await response.json().catch(() => ({}))) as { error?: string };
				if (!response.ok) throw new Error(body.error ?? 'Saving stopped.');
				for (const p of chunk) merged[p.gameId] = true;
				progress = { done: Math.min(i + MERGE_CHUNK, picked.length), total: picked.length };
			}
		} catch (e) {
			const done = progress.done;
			error = `${done ? `Saved ${done} of ${picked.length}. ` : ''}${(e as Error).message} The rest are still ticked: try again.`;
			phase = 'review';
			return;
		}
		phase = 'done';
	}

	const players = (min: number | null, max: number | null) => (formatPlayerRange(min, max) ? `${formatPlayerRange(min, max)} players` : '');
	const describeTyped = (g: Game) =>
		[g.source === 'wikidata' ? 'From Wikidata' : 'Typed in', players(g.minPlayers, g.maxPlayers), formatPlaytime(g.minPlaytime, g.maxPlaytime)].filter(Boolean).join(' · ');
	const describeCandidate = (c: Candidate) => [c.year ?? 'Year unknown', players(c.minPlayers, c.maxPlayers), c.isExpansion && 'Expansion'].filter(Boolean).join(' · ');
	const label = (c: Candidate) => `${c.name}${c.year ? ` (${c.year})` : ''}${c.isExpansion ? ', expansion' : ''}`;
	const selected = (g: Game) => found[g.gameId]?.find((c) => c.gameId === choice[g.gameId]) ?? null;
</script>

<!-- The count stays live as games are saved, so the page needn't reload (which would drop this panel
     once nothing is left, before the person sees what happened). -->
<p class="line">
	{#if left > 0}
		<strong class="num">{left}</strong> of your games {left === 1 ? 'has' : 'have'} no BoardGameGeek details: typed in, or from Wikidata.
	{:else}
		<Check size={16} aria-hidden="true" /> All your games have BoardGameGeek details now.
	{/if}
</p>
<div class="match-panel">
	{#if phase === 'idle'}
		<details class="fold">
			<summary class="link-button">Find {games.length === 1 ? 'it' : 'them'} on BoardGameGeek…</summary>
			<div class="start">
				<p class="lede">
					Look each one up on BoardGameGeek and choose the right match. Its copies, links and plays move to the BoardGameGeek game, which
					brings complexity, mechanics and best-at counts with it.
				</p>
				<button type="button" class="btn primary" onclick={find}>Find {games.length} {games.length === 1 ? 'game' : 'games'} on BoardGameGeek</button>
				<p class="hint">About ten seconds a game: it goes slowly on purpose, to be easy on BoardGameGeek. Nothing changes until you choose.</p>
			</div>
		</details>
	{:else if phase === 'finding'}
		<p class="count"><span class="num">Checked {progress.done} of {progress.total}…</span></p>
		<div class="track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Games looked up">
			<div class="fill" style:width="{progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%"></div>
		</div>
		{#if waiting}<p class="banner">{waiting}</p>{/if}
		<button type="button" class="link-button" onclick={() => (stopRequested = true)}>Stop and choose from what’s found</button>
	{:else if phase === 'review' || phase === 'saving'}
		<p class="summary">
			Matches for <strong class="num">{withMatches.length}</strong> of {checked.length} checked. Exact titles are ticked; tick any other match that's
			right.
			{#if remaining.length && phase === 'review'}
				<button type="button" class="link-button" onclick={find}>Look up the other {remaining.length}</button>
			{/if}
		</p>
		<ul class="rows">
			{#each checked as g (g.gameId)}
				{@const candidates = found[g.gameId]}
				{@const pick = selected(g)}
				<li class:muted-row={candidates.length === 0 || merged[g.gameId]}>
					<label class="main">
						<input type="checkbox" bind:checked={include[g.gameId]} disabled={candidates.length === 0 || merged[g.gameId] || phase === 'saving'} />
						<span class="text">
							<span class="title">{g.name}</span>
							<span class="note">{describeTyped(g)}</span>
							{#if merged[g.gameId]}<span class="note"><Check size={14} aria-hidden="true" /> Now uses BoardGameGeek’s details</span>{/if}
						</span>
					</label>
					{#if candidates.length === 0}
						<p class="none">Not found on BoardGameGeek. It stays as it is.</p>
					{:else if pick && !merged[g.gameId]}
						<div class="pick">
							<span class="mini"><BoxFront name={pick.name} src={pick.thumbUrl} size="mini" /></span>
							<div class="pick-text">
								{#if candidates.length > 1}
									<label class="visually-hidden" for="pick-{g.gameId}">Match for {g.name}</label>
									<select id="pick-{g.gameId}" class="field" bind:value={choice[g.gameId]} disabled={phase === 'saving'}>
										{#each candidates as c (c.gameId)}<option value={c.gameId}>{label(c)}</option>{/each}
									</select>
								{:else}
									<span class="pick-name">{pick.name}</span>
								{/if}
								<span class="note">
									{describeCandidate(pick)} ·
									<a href="https://boardgamegeek.com/boardgame/{pick.bggId}" rel="noopener" target="_blank">View on BoardGameGeek</a>
								</span>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="actions">
			<button type="button" class="btn primary" disabled={chosen.length === 0 || phase === 'saving'} onclick={save}>
				{phase === 'saving' ? `Saving ${progress.done} of ${progress.total}…` : `Use BoardGameGeek for ${chosen.length} ${chosen.length === 1 ? 'game' : 'games'}`}
			</button>
		</div>
	{:else}
		<p class="summary">
			<strong class="num">{mergedCount}</strong>
			{mergedCount === 1 ? 'game now uses' : 'games now use'} BoardGameGeek’s details.
		</p>
		<div class="inline">
			<a class="btn primary" href={shelfHref}>See the shelf</a>
			{#if withMatches.some((g) => !merged[g.gameId]) || remaining.length}
				<button type="button" class="btn" onclick={() => (phase = 'review')}>Back to the list</button>
			{/if}
		</div>
	{/if}
	{#if error}<p class="banner error" role="alert">{error}</p>{/if}
</div>

<style>
	.match-panel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
	}
	.lede,
	.summary,
	.count,
	.start .hint {
		margin: 0;
	}
	.count {
		font-weight: 650;
	}
	.track {
		align-self: stretch;
		height: 10px;
		background: var(--gap);
		border-radius: var(--r-cube);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--ink);
		transition: width 0.4s var(--ease-out);
	}
	.rows {
		align-self: stretch;
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 32rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
	}
	.rows li {
		background: var(--cube);
		padding: var(--s-2) var(--s-3);
	}
	.main {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		min-height: max(40px, var(--tap));
		cursor: pointer;
	}
	input[type='checkbox'] {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
		flex: none;
		margin: 2px 0 0;
	}
	.text,
	.pick-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.pick-text {
		flex: 1;
		gap: 2px;
	}
	.title,
	.pick-name {
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.note {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	/* The match sits under the typed title, in line with its text rather than the checkbox. */
	.pick,
	.none {
		margin: var(--s-1) 0 0 calc(18px + var(--s-3));
	}
	.pick {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
	}
	.none {
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.mini {
		flex: none;
		width: 40px;
		height: 42px;
	}
	.pick select {
		max-width: 100%;
		min-height: max(40px, var(--tap));
	}
	.muted-row .title {
		color: var(--ink-2);
	}
	.line {
		margin: 0 0 var(--s-2);
	}
	.line :global(svg) {
		vertical-align: -3px;
		margin-right: 4px;
	}
	.fold summary {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.start {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
		margin-top: var(--s-2);
	}
	.actions {
		align-self: stretch;
		position: sticky;
		bottom: calc(76px + env(safe-area-inset-bottom));
		padding: var(--s-2) 0;
		background: linear-gradient(to top, var(--cube) 70%, transparent);
	}
	/* Clear of the bottom tab bar until it moves to the top bar at 900px. */
	@media (min-width: 900px) {
		.actions {
			bottom: 0;
		}
	}
</style>
