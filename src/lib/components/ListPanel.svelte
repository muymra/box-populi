<!--
	Paste a list of games (TECH.md "Paste a list"). Lines go to the server ten at a time for
	matching, the person ticks what to add, then rows are added twenty-five at a time.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import { formatPlaytime } from '#lib/catalog/buckets.ts';

	let { groupId, shelfHref, wikidata }: { groupId: string; shelfHref: string; wikidata: boolean } = $props();

	type Game = { gameId: number; name: string; year: number | null; minPlayers: number | null; maxPlayers: number | null; source: 'bgg' | 'wikidata' | 'manual' };
	type Entry = { title: string; minPlayers: number | null; maxPlayers: number | null; minPlaytime: number | null; maxPlaytime: number | null };
	type Row =
		| { line: string; status: 'error'; error: string }
		| { line: string; status: 'owned' | 'group' | 'stored' | 'wikidata'; game: Game }
		| { line: string; status: 'new'; entry: Entry; suggestion: Game | null };

	const MATCH_CHUNK = 10;
	const ADD_CHUNK = 25;

	let text = $state('');
	let phase = $state<'idle' | 'matching' | 'preview' | 'adding' | 'done'>('idle');
	let rows = $state<Row[]>([]);
	let include = $state<boolean[]>([]);
	let useSuggestion = $state<boolean[]>([]);
	let progress = $state({ done: 0, total: 0 });
	let error = $state<string | null>(null);
	let result = $state({ added: 0, skipped: 0 });

	const lines = $derived(
		text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l && !l.startsWith('#'))
	);
	const chosen = $derived(rows.map((r, i) => ({ r, i })).filter(({ r, i }) => include[i] && r.status !== 'error' && r.status !== 'owned'));

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const post = (url: string, body: unknown) =>
		fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

	async function call<T>(url: string, body: unknown): Promise<T> {
		for (let attempt = 0; attempt < 5; attempt++) {
			const response = await post(url, body);
			const json = (await response.json().catch(() => ({}))) as T & { error?: string; retryAfterMs?: number };
			if (response.status === 503 && json.retryAfterMs) {
				await sleep(json.retryAfterMs * (attempt + 1));
				continue;
			}
			if (!response.ok) throw new Error(json.error ?? 'Something went wrong. Try again.');
			return json;
		}
		throw new Error('Wikidata isn’t answering right now. Try again in a minute.');
	}

	async function check(event: SubmitEvent) {
		event.preventDefault();
		const all = lines.slice(0, 200);
		if (all.length === 0) return;
		error = null;
		phase = 'matching';
		progress = { done: 0, total: all.length };
		const found: Row[] = [];
		try {
			for (let i = 0; i < all.length; i += MATCH_CHUNK) {
				const { rows: chunk } = await call<{ rows: Row[] }>('/api/games/list/match', { groupId, lines: all.slice(i, i + MATCH_CHUNK) });
				found.push(...chunk);
				progress = { done: found.length, total: all.length };
			}
		} catch (e) {
			error = (e as Error).message;
			phase = 'idle';
			return;
		}
		rows = found;
		include = found.map((r) => r.status !== 'error' && r.status !== 'owned');
		useSuggestion = found.map(() => false);
		phase = 'preview';
	}

	async function add() {
		const items = chosen.map(({ r, i }) =>
			r.status === 'new' ? (useSuggestion[i] && r.suggestion ? { gameId: r.suggestion.gameId } : { line: r.line }) : { gameId: (r as { game: Game }).game.gameId }
		);
		error = null;
		phase = 'adding';
		progress = { done: 0, total: items.length };
		const total = { added: 0, skipped: 0 };
		try {
			for (let i = 0; i < items.length; i += ADD_CHUNK) {
				const r = await call<{ added: number; skipped: number }>('/api/games/list/add', { groupId, items: items.slice(i, i + ADD_CHUNK) });
				total.added += r.added;
				total.skipped += r.skipped;
				progress = { done: Math.min(i + ADD_CHUNK, items.length), total: items.length };
			}
		} catch (e) {
			error = (e as Error).message;
		}
		result = total;
		phase = 'done';
	}

	function reset() {
		text = '';
		rows = [];
		phase = 'idle';
		error = null;
	}

	const describe = (g: Game) => [g.year, formatPlayerRange(g.minPlayers, g.maxPlayers) && `${formatPlayerRange(g.minPlayers, g.maxPlayers)} players`].filter(Boolean).join(' · ');
	const describeEntry = (e: Entry) =>
		[formatPlayerRange(e.minPlayers, e.maxPlayers) && `${formatPlayerRange(e.minPlayers, e.maxPlayers)} players`, formatPlaytime(e.minPlaytime, e.maxPlaytime)].filter(Boolean).join(' · ');
</script>

<div class="list-panel">
	{#if phase === 'idle' || phase === 'matching'}
		<form onsubmit={check} class="paste">
			<label>
				<span>One game per line</span>
				<textarea
					class="field"
					rows="7"
					bind:value={text}
					disabled={phase === 'matching'}
					spellcheck="false"
					placeholder={'Azul\nTicket to Ride | 2-5 | 30-60\nOur homemade quiz game | 3-8'}
				></textarea>
			</label>
			<p class="hint">
				Players and minutes are optional, after a <code>|</code> or a tab, so a column pasted from a spreadsheet works. Up to 200
				lines. Nothing is added until you check the list.
			</p>
			<button class="btn primary" disabled={phase === 'matching' || lines.length === 0}>
				{phase === 'matching' ? `Checked ${progress.done} of ${progress.total}…` : `Check ${lines.length || ''} ${lines.length === 1 ? 'line' : 'lines'}`}
			</button>
			{#if phase === 'matching'}
				<!-- The preview's shape while lines are checked, ten at a time. -->
				<ul class="rows ghost" aria-hidden="true">
					{#each [58, 72, 46, 64] as width, i (i)}
						<li style:--i={i}>
							<span class="main">
								<span class="skeleton tick"></span>
								<span class="text">
									<span class="skeleton bar" style:width="{width}%"></span>
									<span class="skeleton bar thin"></span>
								</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</form>
	{:else if phase === 'preview' || phase === 'adding'}
		<p class="summary">
			<strong class="num">{rows.length}</strong> lines checked. Untick anything you don't want.
			<button type="button" class="link-button" onclick={reset}>Start over</button>
		</p>
		<ul class="rows">
			{#each rows as row, i (i)}
				<li class:muted-row={row.status === 'error' || row.status === 'owned'}>
					<label class="main">
						<input type="checkbox" bind:checked={include[i]} disabled={row.status === 'error' || row.status === 'owned' || phase === 'adding'} />
						<span class="text">
							{#if row.status === 'error'}
								<span class="title">{row.line}</span>
								<span class="note">{row.error}</span>
							{:else if row.status === 'new'}
								<span class="title">{useSuggestion[i] && row.suggestion ? row.suggestion.name : row.entry.title}</span>
								<span class="note">
									{useSuggestion[i] && row.suggestion ? `From Wikidata · ${describe(row.suggestion)}` : ['New game, typed in', describeEntry(row.entry)].filter(Boolean).join(' · ')}
								</span>
							{:else}
								<span class="title">{row.game.name}</span>
								<span class="note">
									{#if row.status === 'owned'}<Check size={14} aria-hidden="true" /> Already on your shelf{:else if row.status === 'group'}Already in your group{:else if row.game.source === 'wikidata'}From Wikidata{:else if row.game.source === 'bgg'}From BoardGameGeek{:else}Matched{/if}{describe(row.game) ? ` · ${describe(row.game)}` : ''}
								</span>
							{/if}
						</span>
					</label>
					{#if row.status === 'new' && row.suggestion && wikidata}
						<label class="swap">
							<input type="checkbox" bind:checked={useSuggestion[i]} disabled={!include[i] || phase === 'adding'} />
							<span>Use Wikidata's “{row.suggestion.name}”{row.suggestion.year ? ` (${row.suggestion.year})` : ''} instead</span>
						</label>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="actions">
			<button type="button" class="btn primary" disabled={chosen.length === 0 || phase === 'adding'} onclick={add}>
				{phase === 'adding' ? `Adding ${progress.done} of ${progress.total}…` : `Add ${chosen.length} ${chosen.length === 1 ? 'game' : 'games'} to my shelf`}
			</button>
		</div>
	{:else}
		<p class="summary">
			<strong class="num">{result.added}</strong> {result.added === 1 ? 'game' : 'games'} added to your shelf{#if result.skipped}, {result.skipped} skipped{/if}.
		</p>
		<div class="inline">
			<a class="btn primary" href={shelfHref}>See the shelf</a>
			<button type="button" class="btn" onclick={reset}>Paste another list</button>
		</div>
	{/if}
	{#if error}<p class="banner error" role="alert">{error}</p>{/if}
</div>

<style>
	.list-panel {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.paste {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
	}
	.paste label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-self: stretch;
		font-weight: 650;
	}
	textarea.field {
		min-height: 9rem;
		padding: var(--s-2) var(--s-3);
		font: inherit;
		resize: vertical;
	}
	.paste .hint {
		margin: 0;
	}
	.summary {
		margin: 0;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 28rem;
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
	.main,
	.swap {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		cursor: pointer;
	}
	.main {
		min-height: 40px;
	}
	.swap {
		margin: var(--s-1) 0 0 calc(18px + var(--s-3));
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	input[type='checkbox'] {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
		flex: none;
		margin-top: 2px;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.title {
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.note {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.ghost {
		align-self: stretch;
	}
	.ghost .skeleton {
		animation-delay: calc(var(--i) * 110ms);
	}
	.ghost .text {
		flex: 1;
		gap: 6px;
	}
	.skeleton.tick {
		flex: none;
		width: 18px;
		height: 18px;
		margin-top: 2px;
	}
	.skeleton.bar {
		height: 12px;
		border-radius: 999px;
	}
	.skeleton.bar.thin {
		width: 34%;
		height: 9px;
	}
	.muted-row .title {
		color: var(--ink-2);
	}
	.actions {
		position: sticky;
		bottom: calc(76px + env(safe-area-inset-bottom));
		padding: var(--s-2) 0;
		background: linear-gradient(to top, var(--cube) 70%, transparent);
	}
	@media (min-width: 760px) {
		.actions {
			bottom: 0;
		}
	}
</style>
