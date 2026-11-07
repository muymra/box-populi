<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Dices from '@lucide/svelte/icons/dices';
	import Pin from '@lucide/svelte/icons/pin';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import ChooseList from '#lib/components/ChooseList.svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import NightFields from '#lib/components/NightFields.svelte';
	import WhosHere from '#lib/components/WhosHere.svelte';
	import { fetchCatalog, storage } from '#lib/catalog/client.ts';
	import { BUCKET_LABELS, WEIGHT_BUCKETS, formatPlaytime, weightBucket, type WeightBucket } from '#lib/catalog/buckets.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { MANY_PLAYERS, PLAYER_CHOICES, formatPlayerRange, maskHas, playerChoiceLabel } from '#lib/catalog/players.ts';
	import { DEFAULT_FILTERS, filterGames } from '#lib/catalog/filter.ts';
	import {
		FILLER_MAX_MINUTES,
		LINEUP_SIZE,
		MAX_CHOSEN,
		SPREAD_BANDS,
		assignBands,
		chooseInto,
		fillerWeight,
		fitsPlayers,
		gamesAtHand,
		isFiller,
		misfits,
		needsSplit,
		pick,
		pickSpread,
		placeFiller,
		refill,
		roomIsBig,
		splitFillers,
		type BandId,
		type TableFiller
	} from '#lib/catalog/pick.ts';
	import type { CatalogGame, CatalogPayload } from '#lib/catalog/types.ts';
	import { cleanGuests } from '#lib/table/here.ts';
	import { cleanVenue, parseIdList, parseLineup, serializeLineup, type Lineup } from '#lib/table/lineup.ts';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { goingMembers, nightDate, nightGuests, nightOn, nightPoolIds, tonightSeed } from '#lib/nights.ts';
	import { nightOf } from '#lib/table/regulars.ts';
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
	// Tonight's lineup (PRD "Picker"): up to three games, pulled at random or chosen, some of them kept.
	let lineup = $state<CatalogGame[]>([]);
	let kept = $state<number[]>([]);
	let seen = $state<number[]>([]);
	let note = $state<string | null>(null);
	// Fillers: a few short, light games in their own row, with their own pull, Keep and Choose.
	let includeFillers = $state(false);
	let fillers = $state<CatalogGame[]>([]);
	let keptFillers = $state<number[]>([]);
	// When no filler takes everyone: one filler per table, for the fewest tables that work.
	let tableFillers = $state<TableFiller[] | null>(null);
	let fillerSeen = $state<number[]>([]);
	let fillerPulled = $state(false);
	let fillerNote = $state<string | null>(null);
	// True once the setup is read from the address or this device, so syncing doesn't erase it first.
	let restored = $state(false);
	const MINUTES = [30, 45, 60, 90, 120, 180];
	const WORDS = ['no', 'one', 'two', 'three'];

	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	// Ticked members bring their games; guests only count as players.
	const present = $derived(table.members.filter((id) => memberIds.has(id)));
	const atTable = $derived(present.length + table.guests.length);
	// Members of a writable group can log what they ended up playing (PRD "Play log").
	const canLog = $derived(!!data.role && !data.readonly);

	// Game nights (PRD "Game night"): on a night's date, the games are that night's pool.
	const today = nightOf(Date.now());
	const tonight = $derived(nightOn(data.nights, today));
	const upcoming = $derived(data.nights.filter((n) => n.nightOn > today));
	const tableIds = $derived(new Set(data.tableMembers.map((m) => m.id)));
	const nameOf = (id: string | null) => data.tableMembers.find((m) => m.id === id)?.name ?? null;
	/** What's in the room: tonight's bring list and the host's shelf, or with no night, every shelf of the people here. */
	const pool = $derived.by(() => {
		if (!payload || !tonight) return null;
		const ids = nightPoolIds(tonight, payload.games, memberIds);
		const onShelves = payload.games.filter((g) => ids.has(g.id));
		const shelfIds = new Set(payload.games.map((g) => g.id));
		return [...onShelves, ...data.nightGames.filter((g) => ids.has(g.id) && !shelfIds.has(g.id))];
	});
	const gameById = $derived(new Map([...(payload?.games ?? []), ...data.nightGames].map((g) => [g.id, g])));

	// Whose games count when no night is planned (PRD "Picker", D40): everything the people here own, or
	// a member's home, where pulls come from their shelf. A night's own place wins on its date.
	let venue = $state<string | null>(null);
	const host = $derived(!tonight && venue && memberIds.has(venue) ? venue : null);
	const hostName = $derived(host ? (memberMap.get(host)?.name ?? null) : null);
	/** "At someone's home": you if you're here, otherwise the first person ticked. */
	function chooseHome() {
		venue = data.myId && present.includes(data.myId) ? data.myId : (present[0] ?? null);
		saveLineup();
	}
	/** The hosts "Whose?" offers: the people here, and the chosen host even once they're unticked. */
	const venueChoices = $derived.by(() => {
		const ids = new Set(present);
		if (host) ids.add(host);
		return (payload?.members ?? []).filter((m) => ids.has(m.id));
	});

	/**
	 * Every game in the room, the limits aside, for choosing by hand. Tonight's pool is in the room, so
	 * lending and owners don't matter; at a member's home, their shelf and anything the people here bring.
	 */
	const room = $derived.by(() => {
		if (!payload) return [];
		if (pool) return filterGames(pool, { ...DEFAULT_FILTERS, availableOnly: false }, memberIds);
		const people = host ? [...present, host] : present;
		if (people.length) return gamesAtHand(filterGames(payload.games, { ...DEFAULT_FILTERS, availableOnly: false }, memberIds), new Set(people));
		return filterGames(payload.games, DEFAULT_FILTERS, memberIds);
	});
	const roomIds = $derived(new Set(room.map((g) => g.id)));
	/** What a pull draws from: tonight's pool, the host's shelf at a member's home, or the room. */
	const shelfToPull = $derived.by(() => {
		if (!payload || pool || !host) return room;
		return gamesAtHand(filterGames(payload.games, { ...DEFAULT_FILTERS, availableOnly: false }, memberIds), new Set([host]));
	});
	/** More people here than three in four of the games take: the evening runs as several groups (D41). */
	const bigRoom = $derived(roomIsBig(atTable, shelfToPull));
	// In a big room nobody is put at a table (D41): Players stays "Any" until someone says how many are starting.
	const players = $derived(playersOverride ?? (bigRoom ? null : atTable || null));
	const weights = $derived(ceiling ? WEIGHT_BUCKETS.slice(0, WEIGHT_BUCKETS.indexOf(ceiling) + 1) : []);
	const candidates = $derived(filterGames(shelfToPull, { ...DEFAULT_FILTERS, players, minutes, weights, availableOnly: false }, memberIds));
	const keptSet = $derived(new Set(kept));
	/** A pull covers group sizes instead of one table: a big room, with nobody saying how many are starting. */
	const spreadMode = $derived(bigRoom && playersOverride == null);
	const QUICK_COUNTS = [2, 3, 4, 5, 6];
	// The band each pulled game was drawn for, so its label stays while it's in the lineup.
	let bandOf = $state<Record<number, BandId>>({});
	let fillerBandOf = $state<Record<number, BandId>>({});
	const bandLabel = (id: BandId | undefined | null) => SPREAD_BANDS.find((b) => b.id === id)?.label ?? null;
	const keptGames = $derived(lineup.filter((g) => keptSet.has(g.id)));
	const coveredBands = $derived(spreadMode ? assignBands(keptGames, bandOf) : new Map<number, BandId>());
	/** Places in the lineup a pull fills: the bands not covered by a kept game, or the three places. */
	const open = $derived(
		spreadMode ? SPREAD_BANDS.filter((b) => ![...coveredBands.values()].includes(b.id)).length : Math.max(0, LINEUP_SIZE - kept.length)
	);
	const mainLabel = (game: CatalogGame) => (spreadMode ? bandLabel(keptSet.has(game.id) ? coveredBands.get(game.id) : bandOf[game.id]) : null);
	const drawable = $derived(candidates.filter((g) => !keptSet.has(g.id)));
	const whyMain = (game: CatalogGame) => misfits(game, { players, minutes, ceiling }, roomIds.has(game.id));
	const mainFull = $derived(kept.length >= MAX_CHOSEN ? `That’s ${MAX_CHOSEN} games, the most the lineup holds. Let one go to choose another.` : null);

	// Fillers ignore the time and complexity limits (they have their own) but come from the same table
	// and never repeat a game in the lineup. They fit the whole group when any can; otherwise the group
	// splits across tables (`splitFillers`).
	const fillerPool = $derived.by(() => {
		const main = new Set(lineup.map((g) => g.id));
		return shelfToPull.filter((g) => isFiller(g) && !main.has(g.id));
	});
	const fillerCandidates = $derived(players ? fillerPool.filter((g) => fitsPlayers(g, players)) : fillerPool);
	const splitting = $derived(needsSplit(fillerPool, players));
	const keptFillerSet = $derived(new Set(keptFillers));
	const keptFillerGames = $derived(keptFillers.map((id) => gameById.get(id)).filter((g): g is CatalogGame => g != null));
	/** Kept fillers that fit none of the tables, shown after them. */
	const strayFillers = $derived(tableFillers ? keptFillerGames.filter((g) => !tableFillers!.some((t) => t.game.id === g.id)) : []);
	const fillerDrawable = $derived(splitting || spreadMode ? fillerPool.some((g) => !keptFillerSet.has(g.id)) : fillerCandidates.some((g) => !keptFillerSet.has(g.id)));
	const coveredFillerBands = $derived(spreadMode ? assignBands(keptFillerGames, fillerBandOf) : new Map<number, BandId>());
	const fillerOpen = $derived(
		spreadMode ? SPREAD_BANDS.filter((b) => ![...coveredFillerBands.values()].includes(b.id)).length : Math.max(0, LINEUP_SIZE - keptFillers.length)
	);
	const fillerLabel = (game: CatalogGame) =>
		spreadMode ? bandLabel(keptFillerSet.has(game.id) ? coveredFillerBands.get(game.id) : fillerBandOf[game.id]) : null;
	const whyFiller = (game: CatalogGame) => misfits(game, { players: splitting ? null : players, minutes: null, ceiling: null }, roomIds.has(game.id));
	const fillerFull = $derived(!splitting && keptFillers.length >= MAX_CHOSEN ? `That’s ${MAX_CHOSEN} fillers, the most the row holds. Let one go to choose another.` : null);
	function fillerBlocked(game: CatalogGame): string | null {
		if (!tableFillers || tableFillers.some((t) => t.game.id === game.id)) return null;
		return placeFiller(tableFillers, game, keptFillerSet) ? null : 'Fits no open table';
	}

	/**
	 * The setup lives in the address (PRD "Picker"): `n` (players), `t` (minutes), `w` (complexity
	 * ceiling) and `f` (fillers). A copied link adds who's here, `here` (member ids) and `guest` (one per
	 * name), the kept games, `keep` and `fkeep` (game ids), and whose home it is, `at`; opening one
	 * replaces them on this device, and the address then drops them again, so reloading the page next
	 * week can't bring back last week's table (D36). Returns false when there's none.
	 */
	function readSetup(params: Pick<URLSearchParams, 'get' | 'getAll' | 'has'>): boolean {
		if (!['here', 'guest', 'n', 't', 'w', 'f', 'keep', 'fkeep', 'at'].some((k) => params.has(k))) return false;
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

	const lineupKey = () => `bp:lineup:${data.group.id}`;
	/** Kept games stay on this device until 12 hours after the last change, like who's here. */
	function saveLineup() {
		storage.set(lineupKey(), serializeLineup({ main: kept, fillers: keptFillers, at: venue }, Date.now()));
	}

	/** Puts kept games back in the lineup, from this device or a shared link. Games no longer on any shelf are dropped. */
	function applyLineup(saved: Lineup) {
		const resolve = (ids: number[]) => ids.map((id) => gameById.get(id)).filter((g): g is CatalogGame => g != null);
		venue = saved.at && memberIds.has(saved.at) ? saved.at : null;
		lineup = resolve(saved.main);
		kept = lineup.map((g) => g.id);
		const restoredFillers = resolve(saved.fillers).filter((g) => !keptSet.has(g.id));
		keptFillers = restoredFillers.map((g) => g.id);
		if (restoredFillers.length) {
			includeFillers = true;
			if (splitting && players) pullFillers(false);
			else fillers = restoredFillers;
		}
	}

	onMount(async () => {
		try {
			payload = await fetchCatalog(data.group.id);
			// A shared link wins; otherwise this device's "who's here" for this group, if it's from tonight.
			table.load(data.group.id, tonightSeed(nightOn(data.nights, nightOf(Date.now())), new Set(data.tableMembers.map((m) => m.id))));
			const params = page.url.searchParams;
			readSetup(params);
			const linked = ['keep', 'fkeep', 'at'].some((k) => params.has(k));
			applyLineup(
				linked
					? { main: parseIdList(params.get('keep')), fillers: parseIdList(params.get('fkeep')), at: cleanVenue(params.get('at')) }
					: parseLineup(storage.get(lineupKey()), Date.now())
			);
			if (linked) saveLineup();
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
	// The link "Copy a link to this setup" copies: the setup plus who's here and the kept games.
	const shareUrl = $derived.by(() => {
		const params = new URLSearchParams();
		if (present.length) params.set('here', present.join(','));
		for (const name of table.guests) params.append('guest', name);
		if (kept.length) params.set('keep', kept.join(','));
		if (keptFillers.length) params.set('fkeep', keptFillers.join(','));
		if (host) params.set('at', host);
		for (const [k, v] of setupParams) params.append(k, v);
		return `${page.url.origin}${page.url.pathname}${params.size ? `?${params}` : ''}`;
	});

	$effect(() => {
		if (!restored) return;
		const search = setupParams.size ? `?${setupParams}` : '';
		if (search !== page.url.search) goto(`${page.url.pathname}${search}`, { replace: true, reset: false });
	});

	/** What the one pull button says: the first pull, then what another pull would fill. */
	const pullLabel = $derived.by(() => {
		if (spreadMode) return !lineup.length || open === 0 ? 'Pull a spread' : open === SPREAD_BANDS.length ? 'Pull another spread' : `Pull ${WORDS[open]} more`;
		if (!lineup.length || open === 0) return 'Pull three games';
		return open === LINEUP_SIZE ? 'Pull three others' : `Pull ${WORDS[open]} more`;
	});
	let resultsEl = $state<HTMLElement | null>(null);
	let fillersEl = $state<HTMLElement | null>(null);
	/** On a phone the results can sit below the fold, so a pull brings them into view. */
	async function reveal(el: HTMLElement | null) {
		await tick();
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		el?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
	}

	/** Fills every place in the lineup that isn't kept, or in a big room the group sizes not yet covered. `again` avoids games already shown. */
	function pullMain(again: boolean) {
		pullMainNow(again);
		reveal(resultsEl);
	}
	function pullMainNow(again: boolean) {
		if (spreadMode) {
			const spread = pickSpread(drawable, keptGames, bandOf, Math.random, new Set(again ? seen : []));
			lineup = spread.slots.map((s) => s.game);
			bandOf = Object.fromEntries(spread.slots.filter((s) => s.band).map((s) => [s.game.id, s.band as BandId]));
			const drawn = spread.slots.filter((s) => !keptSet.has(s.game.id)).map((s) => s.game.id);
			seen = spread.reset || !again ? drawn : [...seen, ...drawn];
			note = spread.reset ? "That's every game that suits. Starting over." : null;
			settleFillers(true);
			return;
		}
		const result = pick(drawable, players, Math.random, new Set(again ? seen : []), open);
		lineup = refill(lineup, keptSet, result.games);
		const drawn = result.games.map((g) => g.id);
		seen = result.reset || !again ? drawn : [...seen, ...drawn];
		note = result.reset ? "That's every game that fits. Starting over." : null;
		settleFillers(true);
	}

	/**
	 * A game can't be in the lineup and among the fillers, so one that just joined the lineup leaves the
	 * fillers. A pull also brings fillers while their row is empty.
	 */
	function settleFillers(pulled: boolean) {
		if (!includeFillers) return;
		const inLineup = new Set(lineup.map((g) => g.id));
		if (keptFillers.some((id) => inLineup.has(id))) {
			keptFillers = keptFillers.filter((id) => !inLineup.has(id));
			saveLineup();
		}
		if (tableFillers?.some((t) => inLineup.has(t.game.id))) pullFillers(true);
		else if (pulled && fillers.length === 0 && !tableFillers) pullFillers(false);
		else fillers = fillers.filter((g) => !inLineup.has(g.id));
	}

	function toggleKeep(id: number) {
		kept = keptSet.has(id) ? kept.filter((k) => k !== id) : [...kept, id];
		saveLineup();
	}

	/** Choosing puts a game in the lineup as kept; unchoosing takes it out. */
	function chooseMain(game: CatalogGame) {
		if (keptSet.has(game.id)) {
			lineup = lineup.filter((g) => g.id !== game.id);
			kept = kept.filter((id) => id !== game.id);
		} else {
			const next = chooseInto(lineup, keptSet, game);
			if (!next) return;
			lineup = next;
			kept = [...kept, game.id];
		}
		saveLineup();
		settleFillers(false);
	}

	function pullFillers(again: boolean) {
		const keptNow = new Set(keptFillers);
		fillerPulled = true;
		if (spreadMode) {
			const spread = pickSpread(
				fillerPool.filter((g) => !keptNow.has(g.id)),
				keptFillerGames,
				fillerBandOf,
				Math.random,
				new Set(again ? fillerSeen : []),
				fillerWeight
			);
			tableFillers = null;
			fillers = spread.slots.map((s) => s.game);
			fillerBandOf = Object.fromEntries(spread.slots.filter((s) => s.band).map((s) => [s.game.id, s.band as BandId]));
			const drawn = spread.slots.filter((s) => !keptNow.has(s.game.id)).map((s) => s.game.id);
			fillerSeen = spread.reset || !again ? drawn : [...fillerSeen, ...drawn];
			fillerNote = spread.reset ? "That's every filler that suits. Starting over." : null;
			return;
		}
		if (splitting && players) {
			tableFillers = splitFillers(fillerPool, players, Math.random, new Set(again ? fillerSeen : []), keptFillerGames);
			fillers = [];
			const drawn = tableFillers?.map((t) => t.game.id).filter((id) => !keptNow.has(id)) ?? [];
			fillerSeen = again ? [...fillerSeen, ...drawn] : drawn;
			fillerNote = null;
			return;
		}
		// Coming back from tables, the kept fillers are the row to refill around.
		const base = tableFillers ? keptFillerGames : fillers;
		tableFillers = null;
		const result = pick(
			fillerCandidates.filter((g) => !keptNow.has(g.id)),
			players,
			Math.random,
			new Set(again ? fillerSeen : []),
			Math.max(0, LINEUP_SIZE - keptFillers.length),
			fillerWeight
		);
		fillers = refill(base, keptNow, result.games);
		const drawn = result.games.map((g) => g.id);
		fillerSeen = result.reset || !again ? drawn : [...fillerSeen, ...drawn];
		fillerNote = result.reset ? "That's every filler that fits. Starting over." : null;
	}

	function toggleKeepFiller(id: number) {
		keptFillers = keptFillerSet.has(id) ? keptFillers.filter((k) => k !== id) : [...keptFillers, id];
		saveLineup();
	}

	/** Draws a new filler for one table, as when its chosen filler is unchosen. */
	function redrawTable(index: number) {
		if (!tableFillers) return;
		const size = tableFillers[index].players;
		const used = new Set(tableFillers.map((t) => t.game.id));
		const fits = fillerPool.filter((g) => !used.has(g.id) && fitsPlayers(g, size));
		const [game] = pick(fits, size, Math.random, new Set(fillerSeen), 1, fillerWeight).games;
		if (!game) return;
		tableFillers = tableFillers.map((t, j) => (j === index ? { players: t.players, game } : t));
		fillerSeen = [...fillerSeen, game.id];
	}

	/** Like `chooseMain`; with the group split, a chosen filler goes to the largest open table it fits. */
	function chooseFiller(game: CatalogGame) {
		if (keptFillerSet.has(game.id)) {
			keptFillers = keptFillers.filter((id) => id !== game.id);
			const index = tableFillers?.findIndex((t) => t.game.id === game.id) ?? -1;
			if (index >= 0) redrawTable(index);
			else fillers = fillers.filter((g) => g.id !== game.id);
		} else if (tableFillers) {
			const next = placeFiller(tableFillers, game, keptFillerSet);
			if (!next) return;
			tableFillers = next;
			keptFillers = [...keptFillers, game.id];
		} else if (splitting && players) {
			keptFillers = [...keptFillers, game.id];
			pullFillers(false);
		} else {
			const next = chooseInto(fillers, keptFillerSet, game);
			if (!next) return;
			fillers = next;
			keptFillers = [...keptFillers, game.id];
		}
		fillerPulled = true;
		saveLineup();
	}

	function toggleFillers() {
		if (includeFillers && lineup.length) pullFillers(false);
		if (!includeFillers) {
			fillers = [];
			tableFillers = null;
			keptFillers = [];
			fillerPulled = false;
			saveLineup();
		}
	}

	function ownersOf(game: CatalogGame) {
		return [...new Set(game.copies.map((c) => c.ownerId))]
			.map((id) => memberMap.get(id))
			.filter((m) => m != null)
			.map((m) => ({ name: m.name, colorIndex: m.colorIndex }));
	}

	// Play tonight and Plan a night share one panel as two tabs (D43). Play tonight stays mounted while
	// hidden, so a lineup survives a look at the planning form.
	let tab = $state<'play' | 'plan'>('play');
	let planning = $state(false);
	function tabKeys(event: KeyboardEvent) {
		const next = { ArrowRight: 'plan', ArrowLeft: 'play', Home: 'play', End: 'plan' }[event.key] as 'play' | 'plan' | undefined;
		if (!next) return;
		event.preventDefault();
		tab = next;
		document.getElementById(`tab-${next}`)?.focus();
	}

	/** "3–8 players · 45 min · Medium", as a result row's facts. */
	function factsOf(game: CatalogGame) {
		const bucket = weightBucket(game.weight);
		const range = formatPlayerRange(game.minPlayers, game.maxPlayers);
		return [range ? `${range} players` : null, formatPlaytime(game.minPlaytime, game.maxPlaytime), bucket && BUCKET_LABELS[bucket]].filter(Boolean).join(' · ');
	}
	/** Whose copy it is, by name: "Ada’s", "Ada’s or Dewi’s", "Ada’s, Dewi’s or 2 others". */
	function ownerText(owners: { name: string }[]) {
		const names = owners.map((o) => `${o.name}’s`);
		if (names.length <= 2) return names.join(' or ');
		return `${names.slice(0, 2).join(', ')} or ${names.length - 2} ${names.length === 3 ? 'other' : 'others'}`;
	}
</script>

<div class="pick">
	<section class="nights" aria-labelledby="nights-h">
		<h2 id="nights-h">Game nights</h2>
		{#if tonight || upcoming.length}
			<!-- One grid for every night, tonight's first, so the cards share a width. -->
			<ul class="night-list">
				{#if tonight}
					{@const host = nameOf(tonight.hostId)}
					<li>
						<a class="night-card tonight" href="/g/{data.group.id}/nights/{tonight.id}">
							<span class="when"><span class="now">Tonight</span>{tonight.startsAt ?? ''}</span>
							<strong>{tonight.name}</strong>
							<span class="muted"
								>{goingMembers(tonight, tableIds).length + nightGuests(tonight).length} going · {tonight.games.filter((g) => !g.stayedHome).length} games
								brought{host ? ` · at ${host}’s` : ''}</span
							>
						</a>
					</li>
				{/if}
				{#each upcoming as n (n.id)}
					{@const me = data.myId ? n.people.find((p) => p.userId === data.myId) : undefined}
					<li>
						<a class="night-card" href="/g/{data.group.id}/nights/{n.id}">
							<span class="when">{nightDate(n.nightOn)}{n.startsAt ? `, ${n.startsAt}` : ''}</span>
							<strong>{n.name}</strong>
							<span class="muted"
								>{goingMembers(n, tableIds).length + nightGuests(n).length} going · {n.games.length} to bring{me
									? me.going
										? ' · you’re going'
										: ' · you can’t make it'
									: ''}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		{#if !tonight && !upcoming.length}
			<p class="muted">
				No nights planned.{data.mayPlanNights ? ' Plan one under Plan a night to say who’s coming and what they’ll bring;' : ''} On a planned night, Play tonight picks from what people bring.
			</p>
		{/if}
	</section>

	<div class="tabbed" class:has-tabs={data.mayPlanNights}>
	{#if data.mayPlanNights}
		<div class="tabs" role="tablist" aria-label="Play tonight or plan a night" tabindex="-1" onkeydown={tabKeys}>
			<button type="button" role="tab" id="tab-play" class="tab" aria-selected={tab === 'play'} aria-controls="panel-play" tabindex={tab === 'play' ? 0 : -1} onclick={() => (tab = 'play')}
				><Dices size={18} aria-hidden="true" /> Play tonight</button
			>
			<button type="button" role="tab" id="tab-plan" class="tab" aria-selected={tab === 'plan'} aria-controls="panel-plan" tabindex={tab === 'plan' ? 0 : -1} onclick={() => (tab = 'plan')}
				><CalendarPlus size={18} aria-hidden="true" /> Plan a night</button
			>
		</div>
	{/if}
	<div id="panel-play" role={data.mayPlanNights ? 'tabpanel' : undefined} aria-labelledby={data.mayPlanNights ? 'tab-play' : undefined} hidden={tab !== 'play'}>
	{#if loadError}
		<p class="banner error">{loadError}</p>
	{:else if !payload}
		<!-- The setup's shape while the shelf loads: the head, people, the three limits, the button. -->
		<section class="setup form-panel" aria-hidden="true">
			<div class="form-head"><span class="skeleton heading"></span></div>
			<div class="form-row">
				<span class="skeleton label"></span>
				<div class="people">
					{#each [72, 88, 64, 96, 80] as width, i (i)}<span class="skeleton chip" style:width="{width}px" style:--i={i}></span>{/each}
				</div>
			</div>
			<div class="form-row">
				<span class="skeleton label" style:--i={5}></span>
				<div class="limits">
					{#each [0, 1, 2] as i (i)}<span class="skeleton select" style:--i={i + 6}></span>{/each}
				</div>
			</div>
			<div class="form-foot indent"><span class="skeleton pull" style:--i={9}></span></div>
		</section>
		<p class="visually-hidden" role="status">Loading the shelf…</p>
	{:else}
		<section class="setup form-panel" aria-labelledby="setup-h">
			<div class="form-head">
				<div>
					<h2 id="setup-h" class:visually-hidden={data.mayPlanNights}>{tonight ? `Play tonight: ${tonight.name}` : 'Play tonight'}</h2>
					<p>
						{#if tonight && !pool?.length}
							{tonight.name} tonight: nothing’s on its bring list yet. Add games on <a href="/g/{data.group.id}/nights/{tonight.id}">the night’s page</a>.
						{:else if tonight}
							{@const host = nameOf(tonight.hostId)}
							{tonight.name} tonight: picking from its {pool?.length ?? 0} games, what people brought{host ? ` and ${host}’s shelf` : ''}. Untick anything that stayed home on
							<a href="/g/{data.group.id}/nights/{tonight.id}">the night’s page</a>.
						{:else if hostName}
							No night planned, so pick from the games at {hostName}’s. Nothing here is saved for the group.
						{:else if present.length}
							No night planned, so pick from everything the people here own. Nothing here is saved for the group.
						{:else}
							No night planned and nobody ticked, so the whole shelf counts. Nothing here is saved for the group.
						{/if}
					</p>
				</div>
				{#if restored}<CopyButton text={shareUrl} label="Copy a link to this setup" small />{/if}
			</div>

			<div class="form-row" role="group" aria-labelledby="who-q">
				<div class="form-label">
					<span id="who-q" class="form-q">Who’s here</span>
					<span class="hint">{bigRoom ? 'Nobody is put at a table.' : 'Guests count as players.'}</span>
				</div>
				<div class="form-body"><WhosHere members={payload.members} {table} /></div>
			</div>

			{#if !tonight}
				<div class="form-row" role="group" aria-labelledby="whose-q">
					<div class="form-label"><span id="whose-q" class="form-q">Whose games</span></div>
					<div class="form-body">
						<!-- Two choices that always fit one line; which home is a dropdown of the people here (D43). -->
						<div class="whose">
							<div class="seg" role="radiogroup" aria-labelledby="whose-q" aria-describedby="venue-hint">
								<label><input type="radio" name="whose" checked={!host} onchange={() => ((venue = null), saveLineup())} /><span>Everything they own</span></label>
								<label class:off={!present.length && !host}
									><input type="radio" name="whose" checked={!!host} disabled={!present.length && !host} onchange={chooseHome} /><span>At someone’s home</span></label
								>
							</div>
							{#if host}
								<label class="host">
									<span>Whose?</span>
									<select class="field" bind:value={venue} onchange={saveLineup}>
										{#each venueChoices as m (m.id)}<option value={m.id}>{m.name}’s</option>{/each}
									</select>
								</label>
							{/if}
						</div>
						<p class="hint" id="venue-hint">
							{#if hostName}
								{hostName}’s shelf. Anything else someone brought can be chosen by hand below.
							{:else if present.length}
								Every game the people here own, wherever it is tonight.
							{:else}
								Tick who’s here to pick from their games, or from a host’s shelf.
							{/if}
						</p>
					</div>
				</div>
			{/if}

			<div class="form-row" role="group" aria-labelledby="limits-q">
				<div class="form-label"><span id="limits-q" class="form-q">Limits</span></div>
				<div class="form-body">
					<div class="limits">
						<label class="limit">
							<span>Players</span>
							<select class="field num" bind:value={playersOverride}>
								<option value={null}>{bigRoom ? 'Any' : atTable ? `${atTable} here` : 'Any'}</option>
								{#each PLAYER_CHOICES as n (n)}<option value={n}>{playerChoiceLabel(n)}</option>{/each}
							</select>
						</label>
						<label class="limit">
							<span>Time</span>
							<select class="field" bind:value={minutes}>
								<option value={null}>Any</option>
								{#each MINUTES as t (t)}<option value={t}>{t} min</option>{/each}
							</select>
						</label>
						<label class="limit">
							<span>Complexity</span>
							<select class="field" bind:value={ceiling}>
								<option value={null}>Any</option>
								<option value="light">Light only</option>
								<option value="medium">Up to medium</option>
								<option value="heavy">Up to heavy</option>
							</select>
						</label>
						<label class="fillers-check">
							<input type="checkbox" bind:checked={includeFillers} onchange={toggleFillers} />
							Fillers too
						</label>
					</div>
					{#if bigRoom}
						<!-- Someone's starting a game: how many, in one tap. Tapping it again goes back to the spread. -->
						<div class="counts" role="group" aria-labelledby="counts-l">
							<span id="counts-l" class="counts-label">Starting a game?</span>
							{#each QUICK_COUNTS as n (n)}
								<button
									type="button"
									class="count num"
									aria-pressed={playersOverride === n}
									aria-label="{n === 6 ? '6 or more' : n} players starting"
									onclick={() => (playersOverride = playersOverride === n ? null : n)}>{n === 6 ? '6+' : n}</button
								>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="form-foot indent">
				{#snippet keep(isKept: boolean, name: string, toggle: () => void)}
					<button type="button" class="keep" aria-pressed={isKept} aria-label="Keep {name}" onclick={toggle}>
						<Pin size={16} aria-hidden="true" />
						{isKept ? 'Kept' : 'Keep'}
					</button>
				{/snippet}
				<!-- One pulled or chosen game as a compact row: the box, its facts, whose it is, and what to do with it. -->
				{#snippet result(game: CatalogGame, i: number, label: string | null, tags: string[], isKept: boolean, toggle: () => void)}
					{@const owners = ownersOf(game)}
					<li class="result" class:kept={isKept} style:--delay="{i * 60}ms">
						<a class="thumb" href="/g/{data.group.id}/game/{game.id}" tabindex="-1" aria-hidden="true"
							><BoxFront name={game.name} src={game.thumbUrl} size="mini" /></a
						>
						<div class="facts">
								<a class="name" href="/g/{data.group.id}/game/{game.id}">{game.name}</a>
							<span class="meta num">{factsOf(game)}</span>
							<span class="owners">
								{#if owners.length}
									<span class="squares" aria-hidden="true">{#each owners.slice(0, 3) as o (o.name)}<i style:background={playerColor(o.colorIndex).bg}></i>{/each}</span>
									{ownerText(owners)}
								{/if}
								{#if label}<span class="tag best num">{label}</span>{/if}
								{#each tags as tag (tag)}<span class="tag best">{tag}</span>{/each}
							</span>
						</div>
						<div class="acts">
							{#if canLog}<a class="played" href="/g/{data.group.id}/game/{game.id}?log=1">We played this</a>{/if}
							{@render keep(isKept, game.name, toggle)}
						</div>
					</li>
				{/snippet}

				<div class="go">
					<button type="button" class="btn primary big" disabled={open === 0 || drawable.length === 0} onclick={() => pullMain(lineup.length > 0)}>
						<Dices size={20} aria-hidden="true" />
						{pullLabel}
					</button>
					<p class="muted num">
						{#if lineup.length && open === 0}
							{spreadMode
								? 'Every group size has a kept game. Let one go to pull again.'
								: kept.length === LINEUP_SIZE
									? 'All three are kept. Let one go to pull again.'
									: `${kept.length} games are kept, more than a pull fills.`}
						{:else if spreadMode}
							{candidates.length} {candidates.length === 1 ? 'game' : 'games'} {hostName ? `on ${hostName}’s shelf` : 'to pick from'}
						{:else}
							{candidates.length} {candidates.length === 1 ? 'game fits' : 'games fit'}
						{/if}
					</p>
				</div>
				{#if payload.games.length === 0}
					<p class="hint">The shelf is empty, so there’s nothing to pull yet.{#if data.role && !data.readonly}{' '}<a href="/g/{data.group.id}/add">Add your games</a>{/if}</p>
				{:else if tonight && !pool?.length}
					<p class="hint">Nothing to pull from until someone adds a game to tonight’s list.</p>
				{:else if candidates.length === 0}
					<p class="hint">Nothing fits. Allow more time, raise the complexity, or change who’s here.</p>
				{/if}

				<div class="results" bind:this={resultsEl} aria-live="polite">
					{#if lineup.length}
						<!-- Keyed by game, so a pull animates only the games it brings and kept ones stay put. -->
						<ul class="result-list" aria-label="Tonight’s pick">
							{#each lineup as game, i (game.id)}
								{@const isKept = keptSet.has(game.id)}
								{@render result(
									game,
									i,
									mainLabel(game),
									[...(players && maskHas(game.bestMask, players) ? [`Best at ${players}`] : []), ...(isKept ? whyMain(game) : [])],
									isKept,
									() => toggleKeep(game.id)
								)}
							{/each}
						</ul>
						{#if note}<p class="muted">{note}</p>{/if}
					{/if}
				</div>

				{#if room.length}
					<ChooseList
						fits={candidates}
						{room}
						chosen={kept}
						{players}
						why={whyMain}
						full={mainFull}
						onchoose={chooseMain}
						groupId={data.group.id}
						members={memberMap}
						{memberIds}
						heading="Or choose one yourself"
						placeholder="Find a game…"
					/>
				{/if}

				{#if includeFillers}
					<section class="fillers" bind:this={fillersEl} aria-labelledby="fillers-h" aria-live="polite">
						<h3 id="fillers-h">Fillers</h3>
						<p class="hint">{FILLER_MAX_MINUTES} minutes or less and light, for while people arrive or between longer games.</p>
						{#if tableFillers}
							{@const total = tableFillers.reduce((sum, t) => sum + t.players, 0)}
							<p class="muted split-note">No filler here takes {total} players, so split into {tableFillers.length} tables.</p>
							<ul class="result-list">
								{#each tableFillers as t, i (t.game.id)}
									{@render result(t.game, i, `Table ${i + 1} · ${t.players} players`, [], keptFillerSet.has(t.game.id), () => toggleKeepFiller(t.game.id))}
								{/each}
								{#each strayFillers as game, i (game.id)}
									{@render result(game, tableFillers.length + i, null, ['Fits no table', ...whyFiller(game)], true, () => toggleKeepFiller(game.id))}
								{/each}
							</ul>
						{:else if fillers.length}
							<ul class="result-list">
								{#each fillers as game, i (game.id)}
									{@const isKept = keptFillerSet.has(game.id)}
									{@render result(
										game,
										i,
										fillerLabel(game),
										[...(game.weight == null ? ['Complexity unknown'] : []), ...(isKept ? whyFiller(game) : [])],
										isKept,
										() => toggleKeepFiller(game.id)
									)}
								{/each}
							</ul>
						{:else if fillerPulled || fillerPool.length === 0}
							<p class="muted">No short, light games{players ? ` for ${players} players` : ''} here. Fillers list {FILLER_MAX_MINUTES} minutes or less and are light, or nobody has set how complex they are.</p>
						{/if}
						<div class="again">
							{#if splitting || fillerOpen > 0}
								<button type="button" class="btn" disabled={!fillerDrawable} onclick={() => pullFillers(fillers.length > 0 || tableFillers != null)}>
									<RotateCcw size={18} aria-hidden="true" />
									{fillers.length || tableFillers ? 'Other fillers' : 'Pull fillers'}
								</button>
							{:else}
								<p class="muted">
									{spreadMode
										? 'Every group size has a kept filler. Let one go to pull again.'
										: keptFillers.length === LINEUP_SIZE
											? 'All three fillers are kept. Let one go to pull again.'
											: `${keptFillers.length} fillers are kept, more than a pull fills.`}
								</p>
							{/if}
							{#if fillerNote}<p class="muted">{fillerNote}</p>{/if}
						</div>
						{#if fillerPool.length}
							<ChooseList
								fits={splitting ? fillerPool : fillerCandidates}
								room={fillerPool}
								chosen={keptFillers}
								{players}
								why={whyFiller}
								blocked={fillerBlocked}
								full={fillerFull}
								onchoose={chooseFiller}
								groupId={data.group.id}
								members={memberMap}
								{memberIds}
								heading="Choose a filler yourself"
								placeholder="Find a filler…"
							/>
						{/if}
					</section>
				{/if}
			</div>
		</section>
	{/if}
	</div>
	{#if data.mayPlanNights}
		<div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== 'plan'}>
			<!-- The planning form, posted to its own page: that page redirects to the new night, or shows what to fix. -->
			<form method="POST" action="/g/{data.group.id}/nights/new" class="form-panel" onsubmit={() => (planning = true)}>
				<div class="form-head">
					<div>
						<h2 class="visually-hidden">Plan a night</h2>
						<p>Pick when and where first. Next you’ll mark who’s going and what they’ll bring; everyone in the group sees the plan.</p>
					</div>
				</div>
				<NightFields members={data.tableMembers} values={{ name: 'Game night', nightOn: today }} />
				<div class="form-foot indent">
					<div><button class="btn primary" disabled={planning}>Next: who’s going <ArrowRight size={18} aria-hidden="true" /></button></div>
				</div>
			</form>
		</div>
	{/if}
	</div>
</div>

<style>
	/* As wide as the Play tonight panel under it. */
	.nights {
		display: grid;
		gap: var(--s-3);
		max-width: 56rem;
	}
	.nights h2 {
		margin: 0;
	}
	/* Play tonight and Plan a night: one panel with its tabs along the top edge, inside it. The tab row
	   sits on the shelf-gap colour and the open tab is cut from the panel, white and joined to it, like a
	   cube on the shelf; nothing sits above the panel and nothing is marigold. The two tab panels drop
	   their own frame, so it's one panel rather than a panel inside a panel. */
	.tabbed {
		max-width: 56rem;
	}
	.has-tabs {
		--tab-pad: var(--s-4);
		--form-radius: 10px;
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: var(--form-radius);
	}
	/* The row starts 16px early, the tab's own padding, so the open tab's label lines up with the content. */
	.tabs {
		display: flex;
		gap: 4px;
		padding: 6px max(6px, calc(var(--tab-pad) - 16px)) 0;
		background: var(--gap);
		border-bottom: 1px solid var(--rule);
		/* the panel's corner less its 1px border, like the form panel's foot band */
		border-radius: calc(var(--form-radius) - 1px) calc(var(--form-radius) - 1px) 0 0;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 46px;
		margin-bottom: -1px;
		padding: 0 16px 1px;
		border: 1px solid transparent;
		border-bottom: 0;
		border-radius: var(--r-ctl) var(--r-ctl) 0 0;
		background: none;
		color: var(--ink-2);
		font-size: var(--t-lead);
		font-weight: 700;
		cursor: pointer;
	}
	.tab:hover {
		color: var(--ink);
	}
	.tab[aria-selected='true'] {
		background: var(--cube);
		border-color: var(--rule);
		color: var(--ink);
	}
	.tab:focus-visible {
		outline-offset: -4px;
	}
	.has-tabs .form-panel {
		border: 0;
		background: none;
	}
	.has-tabs .form-panel > :global(.form-head) {
		padding-top: var(--s-4);
	}
	.form-head h2.visually-hidden + p {
		margin-top: 0;
	}
	/* While the shelf loads under the tabs, the head is one line of text, not a title. */
	.has-tabs .skeleton.heading {
		width: min(24rem, 100%);
		height: 18px;
	}
	@media (min-width: 760px) {
		.has-tabs {
			--tab-pad: var(--s-5);
		}
	}
	@media (max-width: 560px) {
		.tabs {
			padding: 4px 4px 0;
		}
		.tab {
			flex: 1;
			justify-content: center;
			padding: 0 var(--s-2) 1px;
		}
	}
	.night-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--s-3);
	}
	.night-card {
		display: grid;
		align-content: start;
		gap: 2px;
		height: 100%;
		padding: var(--s-3) var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		color: var(--ink);
		text-decoration: none;
		transition: border-color 0.15s;
	}
	.night-card:hover {
		border-color: var(--ink-3);
	}
	.night-card strong {
		font-size: var(--t-lead);
		line-height: 1.25;
	}
	.night-card:hover strong {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}
	.night-card .when {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 22px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	/* Tonight is the night in use, so it carries the state colour: an even 2px ring (the padding gives
	   back the extra pixel, so its text lines up with the other cards) and a marigold "Tonight". */
	.night-card.tonight,
	.night-card.tonight:hover {
		border: 2px solid var(--mark);
		padding: calc(var(--s-3) - 1px) calc(var(--s-4) - 1px);
	}
	.now {
		padding: 1px 8px;
		border-radius: 999px;
		background: var(--mark);
		color: var(--mark-ink);
		font-weight: 700;
	}
	.pick {
		display: grid;
		/* One column the width of the screen: without minmax(0, …) the widest result row stretches it. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--s-6);
		padding-top: var(--s-3);
	}
	/* The form panel (app.css) at a width where the rows read as one form, not a banner across the page. */
	.setup {
		max-width: 56rem;
	}
	/* the skeleton's row of people; the real toggles are WhosHere's */
	.people {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}

	/* Whose games: two segments that always fit one line, and a "Whose?" dropdown once it's someone's
	   home. The chosen segment lifts onto the cube; it's a setting rather than a pick, so no marigold. */
	.whose {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-3);
	}
	.seg {
		display: inline-flex;
		gap: 4px;
		padding: 4px;
		background: var(--gap);
		border-radius: calc(var(--r-ctl) + 4px);
	}
	.seg label {
		position: relative;
		cursor: pointer;
	}
	.seg input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.seg span {
		display: flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: var(--r-ctl);
		font-weight: 650;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.seg label:hover span {
		color: var(--ink);
	}
	.seg input:checked + span {
		background: var(--cube);
		color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.seg input:focus-visible + span {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.seg .off,
	.seg .off input {
		cursor: not-allowed;
	}
	.seg .off span {
		opacity: 0.5;
	}
	.host {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.host .field {
		width: auto;
		min-width: 10rem;
		font-size: var(--t-body);
		color: var(--ink);
	}
	.whose + .hint {
		margin: 0;
	}
	/* On a phone the two segments split the width and may take two lines each, rather than run off the panel. */
	@media (max-width: 560px) {
		.seg {
			display: flex;
			width: 100%;
		}
		.seg label {
			flex: 1 1 0;
			min-width: 0;
		}
		.seg span {
			justify-content: center;
			height: 100%;
			padding: 6px 10px;
			text-align: center;
			white-space: normal;
			line-height: 1.2;
		}
	}
	/* Limits on one line: each select carries its own label inside the box. */
	.limits {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.limit {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding-left: 10px;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--cube);
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
		cursor: pointer;
	}
	.limit:focus-within {
		border-color: var(--ink-3);
	}
	.limit .field {
		width: auto;
		min-height: 40px;
		border: 0;
		padding-left: 6px;
		padding-right: 28px;
		background-color: transparent;
		background-position: right 8px center;
		font-size: var(--t-body);
		font-weight: 650;
		color: var(--ink);
	}
	.fillers-check {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 44px;
		padding: 0 4px;
		font-weight: 650;
		cursor: pointer;
	}
	.fillers-check input {
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--ink);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: var(--s-3);
	}

	/* Quick counts: who's starting a game, in one tap; the chosen count fills marigold (it's the person's choice). */
	.counts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.counts-label {
		margin-right: 4px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}

	.count {
		min-width: 44px;
		min-height: 40px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.count:hover {
		border-color: var(--ink-3);
	}

	.count[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}

	.setup .skeleton {
		animation-delay: calc(var(--i, 0) * 90ms);
	}

	.skeleton.heading {
		width: 9rem;
		height: 26px;
	}

	.skeleton.label {
		width: 6rem;
		height: 20px;
		align-self: start;
	}

	.skeleton.chip {
		height: 40px;
		border-radius: 999px;
	}

	.skeleton.select {
		width: 9rem;
		height: 44px;
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

	/* a fact about the game, not a choice, so it stays neutral (Marigold Means Chosen) */
	.tag.best {
		align-self: flex-start;
		background: var(--cube);
		color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--rule);
		margin-top: 4px;
	}

	.played {
		font-size: var(--t-small);
		font-weight: 650;
	}

	/* Keep: a toggle like a person in who's here, marigold once kept (Marigold Means Chosen). */
	.keep {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 12px 0 10px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		color: var(--ink);
		font-size: var(--t-small);
		font-weight: 650;
		cursor: pointer;
	}

	.keep:hover {
		border-color: var(--ink-3);
	}

	.keep[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}


	.split-note {
		margin: var(--s-2) 0 0;
	}

	/* The results, right under the button: compact rows so three fit on a phone screen (D43). */
	.results:empty {
		display: none;
	}
	.results {
		display: grid;
		gap: var(--s-2);
		max-width: 44rem;
	}
	.fillers h3 {
		margin: 0;
		font-size: var(--t-body);
		font-weight: 700;
	}
	.results p,
	.fillers p {
		margin: 0;
	}
	.result-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-2);
	}
	.result {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--s-3);
		padding: 8px 12px 8px 8px;
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		animation: pull 0.45s var(--ease-out) var(--delay) both;
	}
	/* Kept: a marigold ring, the same mark as a kept box had (Marigold Means Chosen). */
	.result.kept {
		border: 2px solid var(--mark);
		padding: 7px 11px 7px 7px;
	}
	.thumb {
		display: block;
		width: 56px;
		aspect-ratio: 1 / 1.04;
		box-shadow: var(--shadow-lift);
		border-radius: var(--r-cube);
	}
	.facts {
		display: grid;
		gap: 1px;
		min-width: 0;
	}
	.name {
		font-size: var(--t-lead);
		font-weight: 700;
		line-height: 1.2;
		color: var(--ink);
		text-decoration: none;
	}
	.name:hover {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}
	.meta {
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.owners {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		font-size: var(--t-small);
		margin-top: 2px;
	}
	.squares {
		display: inline-flex;
		gap: 2px;
	}
	.squares i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.owners .tag.best {
		margin-top: 0;
	}
	.acts {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	/* On a phone the actions go under the facts, so the name keeps the width. */
	@media (max-width: 560px) {
		.result {
			grid-template-columns: 56px minmax(0, 1fr);
			row-gap: var(--s-2);
		}
		.acts {
			grid-column: 2;
		}
	}
	.again {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.fillers {
		display: grid;
		gap: var(--s-3);
		max-width: 44rem;
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}
	@keyframes pull {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.result {
			animation: none;
		}
	}
</style>
