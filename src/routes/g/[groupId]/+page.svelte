<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto, snapshot } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import X from '@lucide/svelte/icons/x';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Modal from '#lib/components/Modal.svelte';
	import Cube from '#lib/components/Cube.svelte';
	import Compartment from '#lib/components/Compartment.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import CheckList from '#lib/components/CheckList.svelte';
	import { cachedCatalog, fetchCatalog, storage } from '#lib/catalog/client.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { foldMembers } from '#lib/table/regulars.ts';
	import { BUCKET_LABELS, WEIGHT_BUCKETS, type WeightBucket } from '#lib/catalog/buckets.ts';
	import {
		staleLabel,
		hiddenByDefault,
		keepMatching,
		parseFilters,
		passedOnUnknown,
		serializeFilters,
		sortGames,
		tagOptions,
		type SortKey
	} from '#lib/catalog/filter.ts';
	import { PLAYER_CHOICES, playerChoiceLabel } from '#lib/catalog/players.ts';
	import type { CatalogPayload } from '#lib/catalog/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 60;
	const TIME_OPTIONS = [20, 30, 45, 60, 90, 120, 180];
	const SORTS: Array<{ value: SortKey; label: string }> = [
		{ value: 'title', label: 'A–Z' },
		{ value: 'weight', label: 'Lightest' },
		{ value: 'time', label: 'Shortest' },
		{ value: 'added', label: 'Newest' },
		{ value: 'owned', label: 'Most owned' },
		{ value: 'loved', label: 'Most loved' }
	];

	// Coming back from a game, the shelf this tab already loaded draws at once; onMount revalidates it.
	// Raw state: the catalog is only ever replaced whole, and deep state would make each of its
	// thousands of games and copies a tracked proxy, which made typing in the search lag (D65).
	let payload = $state.raw<CatalogPayload | null>(cachedCatalog(page.params.groupId ?? ''));
	// The "not played lately" filter appears once the group has logged a play (PRD "Play log").
	const hasPlays = $derived(payload?.games.some((g) => g.lastPlayed != null) ?? false);
	let loadError = $state<string | null>(null);
	let filters = $state(parseFilters(page.url.searchParams));
	let limit = $state(PAGE_SIZE);
	let sentinel = $state<HTMLElement>();
	// How many columns the shelf has at this width, read from the grid itself, so its last row can be
	// filled with empty compartments once every result is drawn (not while more are still to come).
	let shelfEl = $state<HTMLElement>();
	let columns = $state(1);
	$effect(() => {
		const el = shelfEl;
		if (!el) return;
		const measure = () => (columns = Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});
	let view = $state<'cubes' | 'list'>('cubes');
	let moreOpen = $state(false);

	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	// The viewer's favourites and Play soon list (D63, D64) for the filters that are about them.
	const viewer = $derived({ id: data.myId, playSoon: new Set(data.myPlaySoon.map((m) => m.gameId)) });
	// Sorted once per catalog and sort order, then filtered, which keeps the order; the filters as a
	// plain object, since each game reads a dozen of them.
	const sortKey = $derived(filters.sort);
	const sorted = $derived(payload ? sortGames(payload.games, sortKey) : []);
	const plainFilters = $derived($state.snapshot(filters));
	const results = $derived(keepMatching(sorted, plainFilters, memberIds, Date.now(), viewer, data.staleDays));
	const spare = $derived(limit >= results.length ? (columns - (results.length % columns)) % columns : 0);
	// The favourites filters appear once someone has a favourite, Play soon once the viewer has a mark.
	const hasFavourites = $derived(payload?.games.some((g) => (g.favouredBy?.length ?? 0) > 0) ?? false);
	const hasPlaySoon = $derived(data.myPlaySoon.length > 0);
	const mechanicOptions = $derived(payload ? tagOptions(payload.games, 'mechanics').map((t) => ({ value: t, label: t })) : []);
	const categoryOptions = $derived(payload ? tagOptions(payload.games, 'categories').map((t) => ({ value: t, label: t })) : []);
	// Owners in join order, which is colour order, so the row reads as the shelf's colour key. Members
	// with nothing on the shelf have no colour on it and are left out, unless the URL picked them.
	const ownerChoices = $derived.by(() => {
		if (!payload) return [];
		const owning = new Set(payload.games.flatMap((g) => g.copies.map((c) => c.ownerId)));
		return payload.members.filter((m) => owning.has(m.id) || filters.owners.includes(m.id)).sort((a, b) => a.colorIndex - b.colorIndex);
	});
	let ownersExpanded = $state(false);
	// Anyone tapped while folded stays in view, so unticking someone past the fold doesn't hide them.
	let ownersTouched = $state<string[]>([]);
	const ownerFold = $derived(foldMembers(ownerChoices, new Set([...filters.owners, ...ownersTouched])));
	const ownersShown = $derived(ownersExpanded ? ownerChoices : ownerFold.shown);
	const hidden = $derived(payload ? hiddenByDefault(payload.games, plainFilters, memberIds, Date.now(), viewer, data.staleDays) : { lent: 0, expansions: 0 });
	const hiddenText = $derived(
		[
			hidden.lent && `${hidden.lent} lent-out ${hidden.lent === 1 ? 'game' : 'games'}`,
			hidden.expansions && `${hidden.expansions} ${hidden.expansions === 1 ? 'expansion' : 'expansions'}`
		]
			.filter(Boolean)
			.join(' and ')
	);
	const moreCount = $derived(
		filters.mechanics.length +
			filters.categories.length +
			filters.owners.length +
			(filters.availableOnly ? 0 : 1) +
			(filters.expansions ? 1 : 0) +
			(filters.stale ? 1 : 0) +
			(filters.favourites ? 1 : 0) +
			(filters.playSoon ? 1 : 0)
	);
	const anyFilter = $derived(serializeFilters({ ...filters, sort: 'title' }).toString() !== '');

	// Filters set in More, as removable chips in the strip, so a leftover one never hides games unseen.
	type Active = { key: string; label: string; color?: string; remove: () => void };
	const activeMore = $derived.by((): Active[] => {
		const list: Active[] = [];
		for (const id of filters.owners) {
			const m = memberMap.get(id);
			list.push({ key: `own:${id}`, label: m?.name ?? 'Someone', color: m ? playerColor(m.colorIndex).fill : undefined, remove: () => (filters.owners = filters.owners.filter((o) => o !== id)) });
		}
		for (const t of filters.mechanics) list.push({ key: `mech:${t}`, label: t, remove: () => (filters.mechanics = filters.mechanics.filter((x) => x !== t)) });
		for (const t of filters.categories) list.push({ key: `cat:${t}`, label: t, remove: () => (filters.categories = filters.categories.filter((x) => x !== t)) });
		if (filters.matchAll && filters.mechanics.length + filters.categories.length > 1) list.push({ key: 'all', label: 'Every tag', remove: () => (filters.matchAll = false) });
		if (!filters.availableOnly) list.push({ key: 'avail', label: 'Lent-out games', remove: () => (filters.availableOnly = true) });
		if (filters.expansions) list.push({ key: 'exp', label: 'Expansions', remove: () => (filters.expansions = false) });
		if (filters.stale) list.push({ key: 'stale', label: 'Not played lately', remove: () => (filters.stale = false) });
		if (filters.favourites) list.push({ key: 'fav', label: filters.favourites === 'mine' ? 'My favourites' : 'Favourites', remove: () => (filters.favourites = null) });
		if (filters.playSoon) list.push({ key: 'soon', label: 'My Play soon', remove: () => (filters.playSoon = false) });
		return list;
	});

	// Members without a PIN are asked to set one, so a new phone can't lock them out (D47, D48). Shown
	// once in the browser, and "Not now" hides it on this device for two weeks.
	const NUDGE_KEY = 'bp:pin-nudge';
	let pinNudge = $state(false);
	onMount(() => {
		const hiddenAt = Number(storage.get(NUDGE_KEY) ?? 0);
		pinNudge = !data.myPinSet && !data.readonly && Date.now() - hiddenAt > 14 * 86_400_000;
	});
	function notNow() {
		storage.set(NUDGE_KEY, String(Date.now()));
		pinNudge = false;
	}

	// On a phone More is a sheet from the bottom, with the count at hand; from 760px it opens under the strip.
	let phone = $state(false);
	onMount(() => {
		const query = matchMedia('(max-width: 759px)');
		phone = query.matches;
		const change = () => (phone = query.matches);
		query.addEventListener('change', change);
		return () => query.removeEventListener('change', change);
	});

	onMount(async () => {
		const saved = storage.get('bp:view');
		if (saved === 'list' || saved === 'cubes') view = saved;
		moreOpen = moreCount > 0 && !matchMedia('(max-width: 759px)').matches;
		try {
			const fresh = await fetchCatalog(data.group.id);
			if (fresh.version !== payload?.version) payload = fresh;
			restoreScroll();
		} catch (e) {
			// A shelf already on screen stays there (a dropped connection at the table), unless the
			// server said this tab may no longer see it.
			if (!payload || cachedCatalog(data.group.id) == null) {
				payload = null;
				loadError = e instanceof Error ? e.message : "Couldn't load the shelf.";
			}
		}
	});

	// Back from a game: how far down the shelf you were. SvelteKit restores the scroll before this
	// page has drawn that far, so the shelf puts back its length and then the scroll itself.
	let pendingScroll: number | null = null;
	// The filters come along too: leaving within 300ms of typing, before the URL caught up, Back would
	// otherwise bring back the shelf as the URL last had it.
	snapshot({
		capture: () => ({ limit, y: Math.round(window.scrollY), qs: serializeFilters(filters).toString() }),
		restore: (saved) => {
			if (saved.qs != null && saved.qs !== serializeFilters(filters).toString()) {
				filters = parseFilters(new URLSearchParams(saved.qs));
				lastQs = saved.qs; // a put-back filter isn't a new one, so the length stays
			}
			limit = Math.max(PAGE_SIZE, saved.limit);
			pendingScroll = saved.y;
			if (payload) restoreScroll();
		}
	});
	async function restoreScroll() {
		const y = pendingScroll;
		pendingScroll = null;
		if (y == null) return;
		await tick();
		window.scrollTo({ top: y, behavior: 'instant' });
	}

	// The URL follows the filters, so a filtered shelf can be shared in the group chat.
	let syncTimer: ReturnType<typeof setTimeout> | undefined;
	let lastQs: string | null = null;
	$effect(() => {
		const qs = serializeFilters(filters).toString();
		// A new filter starts the shelf from the top; the first run keeps a length put back from history.
		if (lastQs != null && qs !== lastQs) limit = PAGE_SIZE;
		lastQs = qs;
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			const search = qs ? `?${qs}` : '';
			if (search !== page.url.search) goto(`${page.url.pathname}${search}`, { replace: true, reset: false });
		}, 300);
		// Gone from the shelf before it ran, it must not rewrite the next page's address.
		return () => clearTimeout(syncTimer);
	});

	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) limit += PAGE_SIZE;
		}, { rootMargin: '800px' });
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	function setView(v: 'cubes' | 'list') {
		view = v;
		storage.set('bp:view', v);
	}

	function toggleWeight(bucket: WeightBucket) {
		filters.weights = filters.weights.includes(bucket) ? filters.weights.filter((w) => w !== bucket) : [...filters.weights, bucket];
	}

	function resetFilters() {
		filters = parseFilters(new URLSearchParams());
	}

	function toggleOwner(id: string) {
		if (!ownersTouched.includes(id)) ownersTouched = [...ownersTouched, id];
		filters.owners = filters.owners.includes(id) ? filters.owners.filter((o) => o !== id) : [...filters.owners, id];
	}

	function showHidden() {
		filters.availableOnly = false;
		filters.expansions = true;
	}
</script>

{#if pinNudge}
	<aside class="pin-nudge" aria-label="Set a PIN">
		<KeyRound size={20} aria-hidden="true" />
		<p><strong>Set a PIN</strong> so you can get back in on any device: open this group’s link, tap your name, type it.</p>
		<div class="nudge-actions">
			<a class="btn small" href="/me#pin-row">Set a PIN</a>
			<button type="button" class="link-button" onclick={notNow}>Not now</button>
		</div>
	</aside>
{/if}

<section class="strip" aria-label="Filters">
	<label class="search">
		<Search size={18} aria-hidden="true" />
		<span class="visually-hidden">Search titles</span>
		<input type="search" placeholder={payload ? `Search ${payload.games.length} games` : 'Search games'} bind:value={filters.q} />
	</label>
	<div class="controls">
		<select bind:value={filters.players} class:on={filters.players != null} aria-label="Players">
			<option value={null}>Any players</option>
			{#each PLAYER_CHOICES as n (n)}<option value={n}>{playerChoiceLabel(n)} {n === 1 ? 'player' : 'players'}</option>{/each}
		</select>
		<select bind:value={filters.minutes} class:on={filters.minutes != null} aria-label="Time available">
			<option value={null}>Any length</option>
			{#each TIME_OPTIONS as t (t)}<option value={t}>Fits in {t} min</option>{/each}
		</select>
		{#if filters.players != null}
			<button type="button" class="chip" aria-pressed={filters.best} onclick={() => (filters.best = !filters.best)}>Best at {filters.players}</button>
		{/if}
		<span class="weights" role="group" aria-label="Complexity">
			{#each WEIGHT_BUCKETS as bucket (bucket)}
				<button type="button" class="chip" aria-pressed={filters.weights.includes(bucket)} onclick={() => toggleWeight(bucket)}>{BUCKET_LABELS[bucket]}</button>
			{/each}
		</span>
		{#if anyFilter}<button type="button" class="chip clear" onclick={resetFilters}>Clear</button>{/if}
		<button type="button" class="chip more" aria-expanded={moreOpen} aria-controls="more-filters" onclick={() => (moreOpen = !moreOpen)}>
			<SlidersHorizontal size={16} aria-hidden="true" />
			More{#if moreCount}<span class="count num">{moreCount}</span>{/if}
		</button>
	</div>
	{#if activeMore.length}
		<div class="active" role="group" aria-label="Filters set in More">
			{#each activeMore as f (f.key)}
				<button type="button" class="chip on remove" aria-label="Remove filter: {f.label}" onclick={f.remove}>
					{#if f.color}<i style:background={f.color}></i>{/if}{f.label}<X size={14} aria-hidden="true" />
				</button>
			{/each}
		</div>
	{/if}
</section>

{#snippet moreFilters()}
		{#if ownerChoices.length > 1}
			<fieldset class="owners">
				<legend>Owners{#if filters.owners.length}<span class="muted">{' · '}{filters.owners.length} selected</span>{/if}</legend>
				<p class="hint">Each colour on the edge under a box is someone who owns it. Pick people to see only their games.</p>
				<div class="people">
					{#each ownersShown as m (m.id)}
						<button type="button" class="person" aria-pressed={filters.owners.includes(m.id)} onclick={() => toggleOwner(m.id)}>
							<span class="dot" style:background={playerColor(m.colorIndex).fill}></span>{m.name}
						</button>
					{/each}
					{#if ownerFold.hidden > 0}
						<button type="button" class="person fold" aria-expanded={ownersExpanded} onclick={() => (ownersExpanded = !ownersExpanded)}>
							{#if ownersExpanded}<ChevronUp size={18} aria-hidden="true" /> Fewer{:else}<ChevronDown size={18} aria-hidden="true" /> {ownerFold.hidden} more{/if}
						</button>
					{/if}
				</div>
				{#if filters.owners.length}<button type="button" class="link-button clear-owners" onclick={() => (filters.owners = [])}>Clear owners</button>{/if}
			</fieldset>
		{/if}
		<CheckList label="Mechanics" options={mechanicOptions} bind:selected={filters.mechanics} />
		<CheckList label="Themes and categories" options={categoryOptions} bind:selected={filters.categories} />
		<div class="toggles">
			{#if filters.mechanics.length + filters.categories.length > 1}
				<label><input type="checkbox" bind:checked={filters.matchAll} /> Match every selected tag, not any</label>
			{/if}
			<label><input type="checkbox" checked={!filters.availableOnly} onchange={(e) => (filters.availableOnly = !e.currentTarget.checked)} /> Include games lent outside the group</label>
			<label><input type="checkbox" bind:checked={filters.expansions} /> Include expansions</label>
			{#if hasPlays}<label><input type="checkbox" bind:checked={filters.stale} /> Not played in the last {staleLabel(data.staleDays)}</label>{/if}
			{#if hasFavourites || filters.favourites}
				<label><input type="checkbox" checked={filters.favourites === 'any'} onchange={(e) => (filters.favourites = e.currentTarget.checked ? 'any' : null)} /> Favourites of anyone in the group</label>
				<label><input type="checkbox" checked={filters.favourites === 'mine'} onchange={(e) => (filters.favourites = e.currentTarget.checked ? 'mine' : null)} /> My favourites</label>
			{/if}
			{#if hasPlaySoon || filters.playSoon}
				<label><input type="checkbox" bind:checked={filters.playSoon} /> My Play soon: games I’d like to try or play again</label>
			{/if}
		</div>
{/snippet}

{#if phone}
	<Modal bind:open={moreOpen} title="More filters">
		<div class="more-sheet" id="more-filters">
			{@render moreFilters()}
			<div class="sheet-foot">
				<button type="button" class="btn primary" onclick={() => (moreOpen = false)}>
					{payload ? `Show ${results.length} ${results.length === 1 ? 'game' : 'games'}` : 'Done'}
				</button>
			</div>
		</div>
	</Modal>
{:else if moreOpen}
	<section id="more-filters" class="more-panel" aria-label="More filters">
		{@render moreFilters()}
	</section>
{/if}

<div class="result-bar">
	<p class="count" aria-live="polite">
		{#if payload}
			<strong class="num">{results.length}</strong> of <span class="num">{payload.games.length}</span> games
		{:else if !loadError}
			Loading the shelf…
		{/if}
	</p>
	{#if hiddenText}
		<p class="hidden-note">Hiding <span class="num">{hiddenText}</span>. <button type="button" class="link-button" onclick={showHidden}>Show them</button></p>
	{/if}
	<div class="bar-actions">
		<select bind:value={filters.sort} class="sort" aria-label="Sort">
			{#each SORTS as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
		</select>
		<div class="seg" role="group" aria-label="View">
			<button type="button" aria-pressed={view === 'cubes'} onclick={() => setView('cubes')} title="Cubes"><LayoutGrid size={18} aria-hidden="true" /><span class="visually-hidden">Cubes</span></button>
			<button type="button" aria-pressed={view === 'list'} onclick={() => setView('list')} title="Spines"><Rows3 size={18} aria-hidden="true" /><span class="visually-hidden">Spines</span></button>
		</div>
	</div>
</div>

{#if loadError}
	<p class="banner error">{loadError} Reload the page to try again.</p>
{:else if payload && payload.games.length === 0}
	<div class="empty">
		<h2>The shelf is empty</h2>
		<p class="muted">Nobody in this group has added a game yet.</p>
		{#if data.role && !data.readonly}<a class="btn primary" href="/g/{data.group.id}/add">Add your games</a>{/if}
	</div>
{:else if payload && results.length === 0}
	<div class="empty">
		<h2>Nothing on the shelf fits</h2>
		<p class="muted">No game matches all of these filters.</p>
		<button type="button" class="btn" onclick={resetFilters}>Clear filters</button>
	</div>
{/if}

{#if !payload && !loadError}
	<div class="shelf" aria-hidden="true">
		{#each Array.from({ length: 12 }) as _, i (i)}
			<div class="cube-empty compartment" style:--i={i}>
				<span class="skeleton box"></span>
				<span class="skeleton line"></span>
			</div>
		{/each}
	</div>
	<p class="visually-hidden" role="status">Loading the shelf…</p>
{:else if view === 'cubes' && results.length}
	<ul class="shelf" bind:this={shelfEl}>
		{#each results.slice(0, limit) as game (game.id)}
			<li><Cube {game} href="/g/{data.group.id}/game/{game.id}" members={memberMap} {memberIds} unknown={passedOnUnknown(game, plainFilters)} /></li>
		{/each}
		<!-- Empty compartments fill out the last row, so the shelf never stops short. -->
		{#each { length: spare } as _, k (k)}
			<li aria-hidden="true">
				<Compartment empty>
					{#snippet edge()}<OwnerEdge owners={[]} />{/snippet}
				</Compartment>
			</li>
		{/each}
	</ul>
{:else if results.length}
	<ul class="list">
		{#each results.slice(0, limit) as game (game.id)}
			<li><ListRow {game} href="/g/{data.group.id}/game/{game.id}" members={memberMap} {memberIds} unknown={passedOnUnknown(game, plainFilters)} /></li>
		{/each}
	</ul>
{/if}
{#if results.length > limit}
	<div bind:this={sentinel} class="sentinel">
		<button type="button" class="btn" onclick={() => (limit += PAGE_SIZE)}>Show more</button>
	</div>
{/if}

<style>
	/* The PIN nudge: a note above the strip, its actions at the right (under the words on phones). */
	.pin-nudge {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-3);
		margin-bottom: var(--s-3);
		padding: var(--s-3) var(--s-4);
		background: var(--note);
		border-radius: 10px;
	}
	.pin-nudge p {
		flex: 1;
		min-width: 14rem;
		margin: 0;
	}
	.nudge-actions {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.nudge-actions .link-button {
		min-height: 36px;
		font-weight: 650;
	}

	/* The dark shelf label strip holding search and filters */
	.strip {
		background: var(--label);
		color: var(--label-ink);
		border-radius: 10px;
		padding: var(--s-3);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
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
	.search input {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		border: 0;
		background: none;
		color: var(--label-ink);
		outline: none;
	}
	.search:focus-within {
		outline: 2px solid var(--mark);
		outline-offset: 1px;
	}
	.search input::placeholder {
		color: var(--label-ink-2);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.weights {
		display: contents;
	}
	@media (max-width: 759px) {
		.controls {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			margin: 0 calc(-1 * var(--s-3));
			padding: 2px var(--s-3);
			scroll-padding-inline: var(--s-3);
		}
		.controls::-webkit-scrollbar {
			display: none;
		}
		.controls > *,
		.controls select {
			flex: none;
		}
		/* More stays at the strip's right edge while the chips scroll under it. */
		.chip.more {
			margin-left: 0;
			position: sticky;
			right: 0;
			background: var(--label);
		}
		.chip.more::before {
			content: '';
			position: absolute;
			top: -2px;
			bottom: -2px;
			right: calc(100% + 1.5px);
			width: 18px;
			background: linear-gradient(to right, transparent, var(--label));
			pointer-events: none;
		}
		/* the strip's padding beside it, covered, so no chip shows through on its right */
		.chip.more::after {
			content: '';
			position: absolute;
			top: -2px;
			bottom: -2px;
			left: calc(100% + 1.5px);
			width: calc(var(--s-3) + 2px);
			background: var(--label);
			pointer-events: none;
		}
	}
	.controls select,
	.chip {
		min-height: 38px;
		border-radius: 4px;
		border: 1.5px solid var(--label-line);
		background: transparent;
		color: var(--label-ink);
		font-size: var(--t-small);
		font-weight: 650;
		padding: 0 12px;
		cursor: pointer;
	}
	.controls select {
		appearance: none;
		padding-right: 30px;
		max-width: 11rem;
		background-image: var(--chevron-label);
		background-repeat: no-repeat;
		background-position: right 10px center;
	}
	.controls select.on {
		background-image: var(--chevron-mark);
	}
	.controls select option {
		color: var(--ink);
		background: var(--cube);
	}
	.controls select.on,
	.chip[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.chip.more {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}
	.chip.clear {
		color: var(--label-ink-2);
	}
	.chip.more[aria-expanded='true'] {
		border-color: var(--label-ink-2);
	}
	/* Filters set in More, each removable; on their own row so a phone shows them without scrolling. */
	.active {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip.remove {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.chip.remove i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		box-shadow: 0 0 0 1px var(--mark-ink);
	}
	.chip .count {
		background: var(--mark);
		color: var(--mark-ink);
		border-radius: 999px;
		padding: 0 6px;
		font-size: 0.75rem;
	}

	.more-panel {
		margin-top: var(--s-2);
		padding: var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		display: grid;
		gap: var(--s-4);
	}
	/* The sheet: the same filters, with the count as the button that closes it, kept in reach at the bottom. */
	.more-sheet {
		display: grid;
		gap: var(--s-4);
	}
	.sheet-foot {
		position: sticky;
		bottom: calc(-1 * var(--s-5));
		margin: 0 calc(-1 * var(--s-5)) calc(-1 * var(--s-5));
		padding: var(--s-3) var(--s-5) var(--s-4);
		background: var(--cube);
		border-top: 1px solid var(--rule);
	}
	.sheet-foot .btn {
		width: 100%;
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.toggles label {
		display: flex;
		gap: var(--s-2);
		align-items: center;
		min-height: 32px;
	}
	input[type='checkbox'] {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
	}
	/* Owners: the person toggles from Who's here, so the row doubles as the shelf's colour key. */
	.owners {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.owners legend {
		font-weight: 700;
		padding: 0;
	}
	.owners .hint {
		margin: 2px 0 var(--s-3);
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
		color: var(--ink);
		font-weight: 650;
		cursor: pointer;
	}
	.person .dot {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		flex: none;
	}
	.person[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.person.fold {
		gap: 4px;
		border-style: dashed;
		background: none;
		color: var(--ink-2);
	}
	.person.fold:hover {
		border-color: var(--ink-3);
		color: var(--ink);
	}
	.clear-owners {
		margin-top: var(--s-2);
		font-size: var(--t-small);
		font-weight: 600;
		min-height: 32px;
	}

	/* The count and the view controls on one line; what the default hides leave out goes under them
	   on phones and between them from 760px. */
	.result-bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--s-1) var(--s-3);
		margin: var(--s-4) 0 var(--s-3);
	}
	.result-bar .count {
		grid-area: 1 / 1;
		margin: 0;
		color: var(--ink-2);
	}
	.hidden-note {
		grid-area: 2 / 1 / 3 / -1;
		margin: 0;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.hidden-note .link-button {
		font-weight: 650;
		/* a 44px target without raising the line */
		padding: 12px 0;
		margin: -12px 0;
	}
	@media (min-width: 760px) {
		.result-bar {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}
		.hidden-note {
			grid-area: 1 / 2;
		}
	}
	.result-bar .count strong {
		color: var(--ink);
		font-size: var(--t-lead);
	}
	.bar-actions {
		grid-area: 1 / -2;
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.sort {
		appearance: none;
		min-height: 38px;
		border-radius: var(--r-ctl);
		border: 1.5px solid var(--rule);
		background: var(--cube) var(--chevron) no-repeat right 10px center;
		padding: 0 30px 0 10px;
		font-size: var(--t-small);
		font-weight: 600;
	}
	.seg {
		display: inline-flex;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.seg button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 36px;
		border: 0;
		background: var(--cube);
		color: var(--ink-2);
		cursor: pointer;
	}
	.seg button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--laminate);
	}

	/* The shelf: grey shelf gaps between cubes */
	.shelf {
		list-style: none;
		margin: 0;
		padding: 6px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 6px;
		background: var(--gap);
		border-radius: 6px;
	}
	.shelf > li {
		display: contents;
	}
	.cube-empty {
		aspect-ratio: 1 / 1.3;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 12px 10px;
	}
	/* The sweep runs cube by cube, so it ripples along the shelf instead of flashing at once. */
	.cube-empty .skeleton {
		animation-delay: calc(var(--i) * 90ms);
	}
	.cube-empty .box {
		width: 78%;
		flex: 1;
	}
	.cube-empty .line {
		width: 58%;
		height: 9px;
		border-radius: 999px;
	}
	@media (min-width: 760px) {
		.shelf {
			grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
			padding: 8px;
			gap: 8px;
		}
	}

	/* Spines: boxes lying on their sides, stacked on one shelf */
	.list {
		list-style: none;
		margin: 0;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--gap);
		border-radius: 6px;
	}

	.empty {
		padding: var(--s-6) var(--s-4);
		text-align: center;
		background: var(--cube);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-2);
	}
	.empty p {
		margin: 0 0 var(--s-2);
	}
	.sentinel {
		display: flex;
		justify-content: center;
		padding: var(--s-5) 0;
	}
</style>
