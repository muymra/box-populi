<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Dices from '@lucide/svelte/icons/dices';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import { fetchCatalog, storage } from '#lib/catalog/client.ts';
	import { WEIGHT_BUCKETS, formatPlaytime, type WeightBucket } from '#lib/catalog/buckets.ts';
	import { formatPlayerRange, maskHas } from '#lib/catalog/players.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { DEFAULT_FILTERS, filterGames } from '#lib/catalog/filter.ts';
	import { gamesAtHand, pick } from '#lib/catalog/pick.ts';
	import type { CatalogGame, CatalogPayload } from '#lib/catalog/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const storageKey = $derived(`bp:present:${data.group.id}`);

	let payload = $state<CatalogPayload | null>(null);
	let loadError = $state<string | null>(null);
	let present = $state<string[]>([]);
	let playersOverride = $state<number | null>(null);
	let minutes = $state<number | null>(null);
	let ceiling = $state<WeightBucket | null>(null);
	let suggestions = $state<CatalogGame[]>([]);
	let seen = $state<number[]>([]);
	let draw = $state(0);
	let note = $state<string | null>(null);
	let memberQuery = $state('');
	// True once the setup is read from the address or this device, so syncing doesn't erase it first.
	let restored = $state(false);
	const MINUTES = [30, 45, 60, 90, 120, 180];

	const players = $derived(playersOverride ?? (present.length || null));
	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	const shownMembers = $derived(
		(payload?.members ?? []).filter((m) => !memberQuery.trim() || m.name.toLowerCase().includes(memberQuery.trim().toLowerCase()))
	);

	const candidates = $derived.by(() => {
		if (!payload) return [];
		const weights = ceiling ? WEIGHT_BUCKETS.slice(0, WEIGHT_BUCKETS.indexOf(ceiling) + 1) : [];
		const filtered = filterGames(payload.games, { ...DEFAULT_FILTERS, players, minutes, weights, availableOnly: present.length === 0 }, memberIds);
		return present.length ? gamesAtHand(filtered, new Set(present)) : filtered;
	});

	/**
	 * The setup lives in the address (PRD "Picker"), so it can be shared or bookmarked: `here` (member
	 * ids), `n` (players), `t` (minutes) and `w` (complexity ceiling). Returns false when there's none.
	 */
	function readSetup(params: Pick<URLSearchParams, 'get' | 'has'>): boolean {
		if (!['here', 'n', 't', 'w'].some((k) => params.has(k))) return false;
		present = (params.get('here') ?? '').split(',').filter((id) => memberIds.has(id));
		const n = Number(params.get('n'));
		playersOverride = Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
		const t = Number(params.get('t'));
		minutes = MINUTES.includes(t) ? t : null;
		const w = params.get('w');
		ceiling = (WEIGHT_BUCKETS as readonly string[]).includes(w ?? '') ? (w as WeightBucket) : null;
		return true;
	}

	onMount(async () => {
		try {
			payload = await fetchCatalog(data.group.id);
			// A shared link wins; otherwise this device's last "who's here" for this group.
			if (!readSetup(page.url.searchParams)) {
				const remembered = JSON.parse(storage.get(storageKey) ?? '[]');
				if (Array.isArray(remembered)) present = remembered.filter((id) => memberIds.has(id));
			}
			restored = true;
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Couldn't load the shelf.";
		}
	});

	$effect(() => {
		if (!restored) return;
		storage.set(storageKey, JSON.stringify(present));
		const params = new URLSearchParams();
		if (present.length) params.set('here', present.join(','));
		if (playersOverride) params.set('n', String(playersOverride));
		if (minutes) params.set('t', String(minutes));
		if (ceiling) params.set('w', ceiling);
		const search = params.size ? `?${params}` : '';
		if (search !== page.url.search) goto(`${page.url.pathname}${search}`, { replace: true, reset: false });
	});

	function togglePresent(id: string) {
		present = present.includes(id) ? present.filter((p) => p !== id) : [...present, id];
	}

	function suggest(again = false) {
		const result = pick(candidates, players, Math.random, new Set(again ? seen : []));
		suggestions = result.games;
		seen = result.reset || !again ? result.games.map((g) => g.id) : [...seen, ...result.games.map((g) => g.id)];
		note = result.reset ? "That's every game that fits. Starting over." : null;
		draw += 1;
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
		<p class="muted">Loading the shelf…</p>
	{:else}
		<section class="setup" aria-label="Who's playing">
			<div class="who">
				<h2>Who's here?</h2>
				{#if payload.members.length > 12}
					<input class="field" type="search" placeholder="Find a name" bind:value={memberQuery} aria-label="Find a member" />
				{/if}
				<div class="people" role="group" aria-label="People at the table">
					{#each shownMembers as m (m.id)}
						{@const c = playerColor(m.colorIndex)}
						<button type="button" class="person" aria-pressed={present.includes(m.id)} onclick={() => togglePresent(m.id)}>
							<span class="dot" style:background={c.bg}></span>{m.name}
						</button>
					{/each}
				</div>
				<p class="hint">{present.length ? `Only games ${present.length === 1 ? 'they' : 'these people'} brought or borrowed.` : 'Nobody ticked: the whole shelf counts.'}</p>
			</div>

			<div class="limits">
				<label>
					Players
					<select class="field num" bind:value={playersOverride}>
						<option value={null}>{present.length ? `${present.length} here` : 'Any'}</option>
						{#each Array.from({ length: 12 }, (_, i) => i + 1) as n (n)}<option value={n}>{n}</option>{/each}
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

			<div class="go">
				<button type="button" class="btn primary big" disabled={candidates.length === 0} onclick={() => suggest(false)}>
					<Dices size={20} aria-hidden="true" /> Pull three games
				</button>
				<p class="muted num">{candidates.length} {candidates.length === 1 ? 'game fits' : 'games fit'}</p>
				{#if restored}<CopyButton text={page.url.href} label="Copy a link to this setup" />{/if}
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
								</div>
							</li>
						{/each}
					</ul>
				{/key}
				<div class="again">
					<button type="button" class="btn" onclick={() => suggest(true)}><RotateCcw size={18} aria-hidden="true" /> Pull three more</button>
					{#if note}<p class="muted">{note}</p>{/if}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.pick {
		display: grid;
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
	.who .field {
		max-width: 20rem;
		margin-bottom: var(--s-3);
	}
	.people {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.person {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 40px;
		padding: 0 14px 0 10px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		font-weight: 650;
		cursor: pointer;
	}
	.person .dot {
		width: 14px;
		height: 14px;
		border-radius: 4px;
	}
	.person[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
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
		.pulled li {
			animation: none;
		}
		.pulled-box {
			transform: none;
		}
	}
</style>
