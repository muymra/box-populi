<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Dices from '@lucide/svelte/icons/dices';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import WhosHere from '#lib/components/WhosHere.svelte';
	import { fetchCatalog } from '#lib/catalog/client.ts';
	import { WEIGHT_BUCKETS, formatPlaytime, type WeightBucket } from '#lib/catalog/buckets.ts';
	import { MANY_PLAYERS, PLAYER_CHOICES, formatPlayerRange, maskHas, playerChoiceLabel } from '#lib/catalog/players.ts';
	import { DEFAULT_FILTERS, filterGames } from '#lib/catalog/filter.ts';
	import { FILLER_MAX_MINUTES, fillerWeight, fitsPlayers, gamesAtHand, isFiller, needsSplit, pick, splitFillers, type TableFiller } from '#lib/catalog/pick.ts';
	import type { CatalogGame, CatalogPayload } from '#lib/catalog/types.ts';
	import { cleanGuests } from '#lib/table/here.ts';
	import { getTable } from '#lib/table/table.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// Who's here lives on this device, shared with the start player modal in the group bar.
	const table = getTable();

	let payload = $state<CatalogPayload | null>(null);
	let loadError = $state<string | null>(null);
	let playersOverride = $state<number | null>(null);
	let minutes = $state<number | null>(null);
	let ceiling = $state<WeightBucket | null>(null);
	let suggestions = $state<CatalogGame[]>([]);
	let seen = $state<number[]>([]);
	let draw = $state(0);
	let note = $state<string | null>(null);
	// Fillers (PRD "Picker"): a few short, light games pulled alongside, with their own re-roll.
	let includeFillers = $state(false);
	let fillers = $state<CatalogGame[]>([]);
	// When no filler takes everyone: one filler per table, for the fewest tables that work.
	let tableFillers = $state<TableFiller[] | null>(null);
	let fillerSeen = $state<number[]>([]);
	let fillerDraw = $state(0);
	let fillerNote = $state<string | null>(null);
	// True once the setup is read from the address or this device, so syncing doesn't erase it first.
	let restored = $state(false);
	const MINUTES = [30, 45, 60, 90, 120, 180];

	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	// Ticked members bring their games; guests only count as players.
	const present = $derived(table.members.filter((id) => memberIds.has(id)));
	const atTable = $derived(present.length + table.guests.length);
	const players = $derived(playersOverride ?? (atTable || null));
	// Members of a writable group can log what they ended up playing (PRD "Play log").
	const canLog = $derived(!!data.role && !data.readonly);

	const candidates = $derived.by(() => {
		if (!payload) return [];
		const weights = ceiling ? WEIGHT_BUCKETS.slice(0, WEIGHT_BUCKETS.indexOf(ceiling) + 1) : [];
		const filtered = filterGames(payload.games, { ...DEFAULT_FILTERS, players, minutes, weights, availableOnly: present.length === 0 }, memberIds);
		return present.length ? gamesAtHand(filtered, new Set(present)) : filtered;
	});

	// Fillers ignore the time and complexity limits (they have their own) but come from the same table
	// and never repeat a game in the main pull. They fit the whole group when any can; otherwise the
	// group splits across tables (`splitFillers`).
	const fillerPool = $derived.by(() => {
		if (!payload) return [];
		const filtered = filterGames(payload.games, { ...DEFAULT_FILTERS, availableOnly: present.length === 0 }, memberIds);
		const atHand = present.length ? gamesAtHand(filtered, new Set(present)) : filtered;
		const main = new Set(suggestions.map((g) => g.id));
		return atHand.filter((g) => isFiller(g) && !main.has(g.id));
	});
	const fillerCandidates = $derived(players ? fillerPool.filter((g) => fitsPlayers(g, players)) : fillerPool);
	const splitting = $derived(needsSplit(fillerPool, players));

	/**
	 * The setup lives in the address (PRD "Picker"): `n` (players), `t` (minutes), `w` (complexity
	 * ceiling) and `f` (fillers). A copied link adds who's here, `here` (member ids) and `guest` (one per
	 * name); opening one replaces who's here on this device, and the address then drops them again, so
	 * reloading the page next week can't bring back last week's table (D36). Returns false when there's none.
	 */
	function readSetup(params: Pick<URLSearchParams, 'get' | 'getAll' | 'has'>): boolean {
		if (!['here', 'guest', 'n', 't', 'w', 'f'].some((k) => params.has(k))) return false;
		includeFillers = params.get('f') === '1';
		if (params.has('here') || params.has('guest')) {
			table.set({
				members: (params.get('here') ?? '').split(',').filter((id) => memberIds.has(id)),
				guests: cleanGuests(params.getAll('guest'))
			});
		}
		const n = Number(params.get('n'));
		playersOverride = Number.isInteger(n) && n >= 1 && n <= MANY_PLAYERS ? n : null;
		const t = Number(params.get('t'));
		minutes = MINUTES.includes(t) ? t : null;
		const w = params.get('w');
		ceiling = (WEIGHT_BUCKETS as readonly string[]).includes(w ?? '') ? (w as WeightBucket) : null;
		return true;
	}

	onMount(async () => {
		try {
			payload = await fetchCatalog(data.group.id);
			// A shared link wins; otherwise this device's "who's here" for this group, if it's from tonight.
			table.load(data.group.id);
			readSetup(page.url.searchParams);
			restored = true;
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Couldn't load the shelf.";
		}
	});

	const setupParams = $derived.by(() => {
		const params = new URLSearchParams();
		if (playersOverride) params.set('n', String(playersOverride));
		if (minutes) params.set('t', String(minutes));
		if (ceiling) params.set('w', ceiling);
		if (includeFillers) params.set('f', '1');
		return params;
	});
	// The link "Copy a link to this setup" copies: the setup plus who's here.
	const shareUrl = $derived.by(() => {
		const params = new URLSearchParams();
		if (present.length) params.set('here', present.join(','));
		for (const name of table.guests) params.append('guest', name);
		for (const [k, v] of setupParams) params.append(k, v);
		return `${page.url.origin}${page.url.pathname}${params.size ? `?${params}` : ''}`;
	});

	$effect(() => {
		if (!restored) return;
		const search = setupParams.size ? `?${setupParams}` : '';
		if (search !== page.url.search) goto(`${page.url.pathname}${search}`, { replace: true, reset: false });
	});

	function suggest(again = false) {
		const result = pick(candidates, players, Math.random, new Set(again ? seen : []));
		suggestions = result.games;
		seen = result.reset || !again ? result.games.map((g) => g.id) : [...seen, ...result.games.map((g) => g.id)];
		note = result.reset ? "That's every game that fits. Starting over." : null;
		draw += 1;
		// A fresh pull brings fresh fillers; "Pull three more" keeps them unless one is now a main pick.
		const isMain = (id: number) => result.games.some((g) => g.id === id);
		if (includeFillers && (!again || (fillers.length === 0 && !tableFillers) || tableFillers?.some((t) => isMain(t.game.id)))) pullFillers(false);
		else fillers = fillers.filter((f) => !isMain(f.id));
	}

	function pullFillers(again: boolean) {
		if (splitting && players) {
			tableFillers = splitFillers(fillerPool, players, Math.random, new Set(again ? fillerSeen : []));
			fillers = [];
			const ids = tableFillers?.map((t) => t.game.id) ?? [];
			fillerSeen = again ? [...fillerSeen, ...ids] : ids;
			fillerNote = null;
			fillerDraw += 1;
			return;
		}
		tableFillers = null;
		const result = pick(fillerCandidates, players, Math.random, new Set(again ? fillerSeen : []), 3, fillerWeight);
		fillers = result.games;
		fillerSeen = result.reset || !again ? result.games.map((g) => g.id) : [...fillerSeen, ...result.games.map((g) => g.id)];
		fillerNote = result.reset ? "That's every filler that fits. Starting over." : null;
		fillerDraw += 1;
	}

	function toggleFillers() {
		if (includeFillers && suggestions.length) pullFillers(false);
		if (!includeFillers) {
			fillers = [];
			tableFillers = null;
		}
	}

	function ownersOf(game: CatalogGame) {
		return [...new Set(game.copies.map((c) => c.ownerId))]
			.map((id) => memberMap.get(id))
			.filter((m) => m != null)
			.map((m) => ({ name: m.name, colorIndex: m.colorIndex }));
	}

	const TILTS = [-2.5, 1.75, -1.25];
</script>

<div class="pick">
	{#if loadError}
		<p class="banner error">{loadError}</p>
	{:else if !payload}
		<!-- The setup's shape while the shelf loads: people, the three limits, the button. -->
		<section class="setup" aria-hidden="true">
			<div class="who">
				<span class="skeleton heading"></span>
				<div class="people">
					{#each [72, 88, 64, 96, 80] as width, i (i)}<span class="skeleton chip" style:width="{width}px" style:--i={i}></span>{/each}
				</div>
			</div>
			<div class="limits">
				{#each [0, 1, 2] as i (i)}<span class="skeleton select" style:--i={i + 5}></span>{/each}
			</div>
			<span class="skeleton pull"></span>
		</section>
		<p class="visually-hidden" role="status">Loading the shelf…</p>
	{:else}
		<section class="setup" aria-label="Who's playing">
			<div class="who">
				<h2>Who's here?</h2>
				<WhosHere members={payload.members} {table} />
				<p class="hint">
					{present.length
						? `Only games ${present.length === 1 ? 'they' : 'these members'} brought or borrowed.`
						: `No members ticked: the whole shelf counts.`}{table.guests.length ? ' Guests count as players.' : ''}
				</p>
			</div>

			<div class="limits">
				<label>
					Players
					<select class="field num" bind:value={playersOverride}>
						<option value={null}>{atTable ? `${atTable} here` : 'Any'}</option>
						{#each PLAYER_CHOICES as n (n)}<option value={n}>{playerChoiceLabel(n)}</option>{/each}
					</select>
				</label>
				<label>
					Time
					<select class="field" bind:value={minutes}>
						<option value={null}>Any</option>
						{#each MINUTES as t (t)}<option value={t}>{t} min</option>{/each}
					</select>
				</label>
				<label>
					Complexity
					<select class="field" bind:value={ceiling}>
						<option value={null}>Any</option>
						<option value="light">Light only</option>
						<option value="medium">Up to medium</option>
						<option value="heavy">Up to heavy</option>
					</select>
				</label>
			</div>

			<label class="fillers-check">
				<input type="checkbox" bind:checked={includeFillers} onchange={toggleFillers} />
				<span>
					<strong>Add fillers</strong>
					<span class="muted"
						>Short, light games ({FILLER_MAX_MINUTES} min or less) for while people arrive or between longer ones.
						{#if splitting}None take {players}, so they'll be split across tables.{:else}<span class="num">{fillerCandidates.length}</span> at the table.{/if}</span
					>
				</span>
			</label>

			<div class="go">
				<button type="button" class="btn primary big" disabled={candidates.length === 0} onclick={() => suggest(false)}>
					<Dices size={20} aria-hidden="true" /> Pull three games
				</button>
				<p class="muted num">{candidates.length} {candidates.length === 1 ? 'game fits' : 'games fit'}</p>
				{#if restored}<CopyButton text={shareUrl} label="Copy a link to this setup" />{/if}
				{#if payload.games.length === 0}
					<p class="hint">The shelf is empty, so there’s nothing to pull yet.{#if data.role && !data.readonly}{' '}<a href="/g/{data.group.id}/add">Add your games</a>{/if}</p>
				{:else if candidates.length === 0}
					<p class="hint">Nothing fits. Allow more time, raise the complexity, or change who’s here.</p>
				{/if}
			</div>
		</section>

		{#if suggestions.length}
			<section class="table" aria-label="Suggestions" aria-live="polite">
				{#key draw}
					<ul class="pulled">
						{#each suggestions as game, i (game.id)}
							<li style:--tilt="{TILTS[i]}deg" style:--delay="{i * 70}ms">
								<a href="/g/{data.group.id}/game/{game.id}" class="pulled-box">
									<span class="art"><BoxFront name={game.name} src={game.thumbUrl} size="hero" /></span>
									<OwnerEdge owners={ownersOf(game)} />
								</a>
								<div class="facts">
									<strong>{game.name}</strong>
									<span class="muted num">
										{formatPlayerRange(game.minPlayers, game.maxPlayers) ?? '?'} players
										{#if formatPlaytime(game.minPlaytime, game.maxPlaytime)}· {formatPlaytime(game.minPlaytime, game.maxPlaytime)}{/if}
									</span>
									{#if players && maskHas(game.bestMask, players)}<span class="tag best">Best at {players}</span>{/if}
									{#if canLog}<a class="played" href="/g/{data.group.id}/game/{game.id}?log=1">We played this</a>{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/key}
				<div class="again">
					<button type="button" class="btn" onclick={() => suggest(true)}><RotateCcw size={18} aria-hidden="true" /> Pull three more</button>
					{#if note}<p class="muted">{note}</p>{/if}
				</div>

				{#if includeFillers}
					<section class="fillers" aria-labelledby="fillers-h">
						<h2 id="fillers-h">Fillers</h2>
						{#snippet filler(game: CatalogGame, i: number, tableLabel: string | null)}
							<li style:--delay="{i * 70}ms">
								{#if tableLabel}<span class="table-label num">{tableLabel}</span>{/if}
								<a href="/g/{data.group.id}/game/{game.id}" class="filler-box">
									<span class="art small"><BoxFront name={game.name} src={game.thumbUrl} /></span>
									<OwnerEdge owners={ownersOf(game)} />
								</a>
								<div class="facts">
									<strong>{game.name}</strong>
									<span class="muted num">
										{formatPlayerRange(game.minPlayers, game.maxPlayers) ?? '?'} players
										{#if formatPlaytime(game.minPlaytime, game.maxPlaytime)}· {formatPlaytime(game.minPlaytime, game.maxPlaytime)}{/if}
									</span>
									{#if game.weight == null}<span class="tag best">Complexity unknown</span>{/if}
									{#if canLog}<a class="played" href="/g/{data.group.id}/game/{game.id}?log=1">We played this</a>{/if}
								</div>
							</li>
						{/snippet}
						{#if tableFillers}
							{@const total = tableFillers.reduce((sum, t) => sum + t.players, 0)}
							<p class="muted split-note">No filler here takes {total} players, so split into {tableFillers.length} tables.</p>
							{#key fillerDraw}
								<ul class="filler-list">
									{#each tableFillers as t, i (t.game.id)}{@render filler(t.game, i, `Table ${i + 1} · ${t.players} players`)}{/each}
								</ul>
							{/key}
							<div class="again">
								<button type="button" class="btn" onclick={() => pullFillers(true)}><RotateCcw size={18} aria-hidden="true" /> Other fillers</button>
							</div>
						{:else if fillers.length}
							{#key fillerDraw}
								<ul class="filler-list">
									{#each fillers as game, i (game.id)}{@render filler(game, i, null)}{/each}
								</ul>
							{/key}
							<div class="again">
								<button type="button" class="btn" onclick={() => pullFillers(true)}><RotateCcw size={18} aria-hidden="true" /> Other fillers</button>
								{#if fillerNote}<p class="muted">{fillerNote}</p>{/if}
							</div>
						{:else}
							<p class="muted">
								No short, light games at the table{players ? ` for ${players} players` : ''}. Fillers list {FILLER_MAX_MINUTES} minutes or less and
								are light, or nobody has set how complex they are.
							</p>
						{/if}
					</section>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.pick {
		display: grid;
		/* One column the width of the screen: without minmax(0, …) the widest result row stretches it. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--s-6);
		padding-top: var(--s-3);
	}
	.setup {
		display: grid;
		gap: var(--s-5);
		padding: var(--s-5);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.who h2 {
		margin-bottom: var(--s-3);
	}
	/* the skeleton's row of people; the real toggles are WhosHere's */
	.people {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.hint {
		margin-top: var(--s-2);
	}
	.limits {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-2);
		max-width: 36rem;
	}
	.limits .field {
		padding-left: 10px;
		min-width: 0;
	}
	.limits label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.setup .skeleton {
		animation-delay: calc(var(--i, 0) * 90ms);
	}
	.skeleton.heading {
		width: 9rem;
		height: 22px;
		margin-bottom: var(--s-3);
	}
	.skeleton.chip {
		height: 40px;
		border-radius: 999px;
	}
	.skeleton.select {
		height: 46px;
		border-radius: var(--r-ctl);
	}
	.skeleton.pull {
		width: 13rem;
		height: 52px;
		border-radius: var(--r-ctl);
	}
	.go {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.go p {
		margin: 0;
	}
	.big {
		min-height: 52px;
		padding: 0 var(--s-5);
		font-size: var(--t-lead);
	}

	/* Three boxes pulled off the shelf onto the table */
	.pulled {
		list-style: none;
		margin: 0;
		padding: var(--s-4) 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
		gap: var(--s-6) var(--s-5);
	}
	.pulled li {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		animation: pull 0.55s var(--ease-out) var(--delay) both;
	}
	.pulled-box {
		display: flex;
		flex-direction: column;
		gap: 6px;
		transform: rotate(var(--tilt));
		transition: transform 0.25s var(--ease-out);
		text-decoration: none;
	}
	.pulled-box:hover,
	.pulled-box:focus-visible {
		transform: rotate(0deg) translateY(-4px);
	}
	.art {
		display: block;
		aspect-ratio: 1 / 1.04;
		box-shadow: var(--shadow-lift);
		border-radius: var(--r-cube);
	}
	.facts {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.facts strong {
		font-size: var(--t-lead);
		line-height: 1.2;
	}
	/* a fact about the game, not a choice, so it stays neutral (Marigold Means Chosen) */
	.tag.best {
		align-self: flex-start;
		background: var(--cube);
		color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--rule);
		margin-top: 4px;
	}
	.again {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
		margin-top: var(--s-5);
	}
	.again p {
		margin: 0;
	}
	.fillers-check {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		max-width: 36rem;
		cursor: pointer;
	}
	.fillers-check input {
		width: 20px;
		height: 20px;
		margin: 2px 0 0;
		flex: none;
		accent-color: var(--ink);
	}
	.fillers-check > span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.fillers-check .muted {
		font-size: var(--t-small);
	}
	/* Fillers: a smaller row under the main pull, straight rather than tilted, since they're the side dish */
	.fillers {
		margin-top: var(--s-6);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}
	.fillers h2 {
		margin: 0;
	}
	.played {
		align-self: flex-start;
		margin-top: 4px;
		font-size: var(--t-small);
		font-weight: 650;
	}
	.split-note {
		margin: var(--s-2) 0 0;
	}
	/* Which table a split filler is for, above its box. */
	.table-label {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.filler-list {
		list-style: none;
		margin: 0;
		padding: var(--s-4) 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr));
		gap: var(--s-5) var(--s-4);
		max-width: 40rem;
	}
	.filler-list li {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		animation: pull 0.55s var(--ease-out) var(--delay) both;
	}
	.filler-box {
		display: flex;
		flex-direction: column;
		gap: 6px;
		text-decoration: none;
		transition: transform 0.25s var(--ease-out);
	}
	.filler-box:hover,
	.filler-box:focus-visible {
		transform: translateY(-3px);
	}
	.art.small {
		box-shadow: var(--shadow-lift);
	}
	.filler-list .facts strong {
		font-size: var(--t-body);
	}
	@keyframes pull {
		from {
			opacity: 0;
			transform: translateY(28px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulled li,
		.filler-list li {
			animation: none;
		}
		.pulled-box {
			transform: none;
		}
	}
</style>
