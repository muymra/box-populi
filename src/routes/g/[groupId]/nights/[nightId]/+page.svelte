<script lang="ts">
	// One game night (PRD "Game night"): when and where, who's going, the bring list, suggestions of
	// what to bring, and on the night, what stayed home and the plays logged.
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import X from '@lucide/svelte/icons/x';
	import Dices from '@lucide/svelte/icons/dices';
	import Trophy from '@lucide/svelte/icons/trophy';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import NightFields from '#lib/components/NightFields.svelte';
	import PlayForm from '#lib/components/PlayForm.svelte';
	import PlayList from '#lib/components/PlayList.svelte';
	import { cachedCatalog, fetchCatalog } from '#lib/catalog/client.ts';
	import { normalize } from '#lib/catalog/normalize.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { DEFAULT_FILTERS, filterGames } from '#lib/catalog/filter.ts';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import { formatPlaytime } from '#lib/catalog/buckets.ts';
	import { favouritesAmong, pick, pickWeight, withInterest } from '#lib/catalog/pick.ts';
	import type { CatalogGame } from '#lib/catalog/types.ts';
	import { bringList, cameChecked, cameList, chatText, goingMembers, nightDate, nightGuests, nightPlayers, nightPoolIds, playOutcome, recapText } from '#lib/nights.ts';
	import { nightOf } from '#lib/table/regulars.ts';
	import { getTable } from '#lib/table/table.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const table = getTable();
	const base = $derived(`/g/${data.group.id}`);
	const night = $derived(data.night);
	const members = $derived(data.tableMembers);
	const memberIds = $derived(new Set(members.map((m) => m.id)));
	const memberById = $derived(new Map(members.map((m) => [m.id, m])));
	const today = nightOf(Date.now());
	const isTonight = $derived(night.nightOn === today);
	const isPast = $derived(night.nightOn < today);

	const answer = (id: string) => night.people.find((p) => p.userId === id)?.going ?? null;
	const going = $derived(goingMembers(night, memberIds));
	const guests = $derived(nightGuests(night));
	const myAnswer = $derived(data.me ? answer(data.me) : null);
	const mayAdd = $derived(data.canChange || (data.me != null && going.includes(data.me)));
	const host = $derived(night.hostId ? memberById.get(night.hostId) : undefined);
	const list = $derived(bringList(night, memberIds));
	const byBringer = $derived.by(() => {
		const groups = new Map<string, { label: string; id: string | null; color: string | null; games: typeof list }>();
		for (const g of list) {
			const key = g.guestName ? `g:${g.guestName}` : `m:${g.broughtBy}`;
			const m = g.broughtBy ? memberById.get(g.broughtBy) : undefined;
			const label = g.guestName ?? m?.name ?? 'a former member';
			const entry = groups.get(key) ?? { label, id: m?.id ?? null, color: m ? playerColor(m.colorIndex).fill : null, games: [] };
			entry.games = [...entry.games, g];
			groups.set(key, entry);
		}
		return [...groups.values()];
	});

	// The catalog, for suggestions, the host's shelf and game names; the page works without it.
	// This tab's copy, if the shelf loaded one, draws the suggestions at once while it's checked (D65).
	let catalog = $state.raw<CatalogGame[] | null>(untrack(() => cachedCatalog(data.group.id)?.games ?? null));
	onMount(async () => {
		try {
			const fresh = (await fetchCatalog(data.group.id)).games;
			if (fresh !== catalog) catalog = fresh;
		} catch {
			catalog = cachedCatalog(data.group.id)?.games ?? [];
		}
	});
	const gameById = $derived(new Map([...(catalog ?? []), ...data.otherGames].map((g) => [g.id, g])));
	const gameName = (id: number) => data.gameNames[id] ?? gameById.get(id)?.name ?? 'a game';
	const players = $derived(going.length + guests.length || null);

	const onList = $derived(new Set(night.games.map((g) => g.gameId)));
	/** Games the people going could bring: on their shelves, not lent out, not on the list yet. */
	const candidates = $derived(
		(catalog ?? []).filter((g) => !g.isExpansion && !onList.has(g.id) && g.copies.some((c) => going.includes(c.ownerId) && !c.lentOut && c.lentToUserId == null))
	);
	const goingOwners = (g: CatalogGame) => [...new Set(g.copies.filter((c) => going.includes(c.ownerId) && !c.lentOut).map((c) => c.ownerId))];
	let suggestions = $state<CatalogGame[]>([]);
	let seen = $state<number[]>([]);
	// Suggestions lean towards what the people going love (D63) and would like to play soon (D64), the
	// viewer's own marks included, so their Play soon games come up first when they pick what to bring.
	const soonOthers = $derived(new Set(data.playSoon.others));
	const soonMine = $derived(new Set(data.playSoon.mine));
	const interest = $derived({
		favourites: favouritesAmong(catalog ?? [], new Set(data.me ? [...going, data.me] : going)),
		playSoon: new Map([...new Set([...soonOthers, ...soonMine])].map((id) => [id, 1]))
	});
	/**
	 * A word on a game the viewer could bring. On their own copy, that someone going would like to play
	 * it, never who (D64); on any game, that it's on their own Play soon list.
	 */
	function soonNote(g: CatalogGame): string | null {
		if (data.me && soonOthers.has(g.id) && goingOwners(g).includes(data.me)) return 'Someone going would like to play this';
		if (soonMine.has(g.id)) return 'On your Play soon list';
		return null;
	}
	function suggest() {
		const fit = filterGames(candidates, { ...DEFAULT_FILTERS, players, availableOnly: false }, memberIds);
		const result = pick(fit.length ? fit : candidates, players, Math.random, new Set(seen), 3, withInterest(pickWeight, interest));
		suggestions = result.games;
		seen = result.reset ? result.games.map((g) => g.id) : [...seen, ...result.games.map((g) => g.id)];
	}
	let query = $state('');
	// Matched like the shelf's search: accents and case ignored, alternate names included.
	const found = $derived.by(() => {
		const q = normalize(query);
		return q.length < 2 ? [] : candidates.filter((g) => g.search.includes(q)).slice(0, 8);
	});

	// On the night: the pool Play tonight draws from, for logging a play.
	const pool = $derived.by(() => {
		const ids = nightPoolIds(night, catalog ?? [], memberIds);
		return [...ids].map((id) => ({ id, name: gameName(id) })).sort((a, b) => a.name.localeCompare(b.name));
	});
	let logOpen = $state(false);
	let logGame = $state<number | null>(null);
	let logged = $state(false);

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	// After the night (D67): who came (anyone in a play on it, then whoever was marked, or who said
	// they'd go), what got played and who won, and what was brought but not played.
	const played = $derived(nightPlayers(data.plays));
	const came = $derived(cameList(night, memberIds, played));
	const checked = $derived(cameChecked(night));
	const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
	const cameGuest = (name: string) => came.guests.some((g) => sameName(g, name));
	const playedGuest = (name: string) => [...played.guests].some((g) => sameName(g, name));
	// You can say whether you came; co-admins can for anyone, so they see everyone to mark.
	const mayMark = (id: string) => data.canMarkAll || id === data.me;
	const cameRows = $derived(members.filter((m) => came.members.includes(m.id) || (data.canAnswer && mayMark(m.id))));
	const guestRows = $derived([...guests, ...came.guests.filter((g) => !guests.some((x) => sameName(x, g)))]);
	const playedIds = $derived(new Set(data.plays.map((p) => p.gameId)));
	const broughtNotPlayed = $derived(list.filter((g) => !g.stayedHome && !playedIds.has(g.gameId)));
	const personName = (p: { userId: string | null; guestName: string | null }) => p.guestName ?? (p.userId ? (memberById.get(p.userId)?.name ?? 'a former member') : 'someone');
	const wentSummary = $derived(
		[
			checked
				? `${plural(came.members.length + came.guests.length, 'person', 'people')} came.`
				: `${going.length + guests.length} said they’d go. Nobody has checked who came yet.`,
			data.plays.length ? `${plural(data.plays.length, 'play', 'plays')} logged.` : ''
		]
			.filter(Boolean)
			.join(' ')
	);
	const cameHint = $derived(
		data.canMarkAll
			? checked
				? 'Tap anyone to change it. Anyone in a play logged on the night came.'
				: 'Filled in: said they’d go, or played. Tap anyone who didn’t come, or who came anyway.'
			: data.me
				? 'Tap your name if that’s not right. Anyone in a play logged on the night came.'
				: ''
	);

	const url = $derived(`${page.url.origin}${base}/nights/${night.id}`);
	const chat = $derived(
		isPast
			? recapText(night, came, data.plays, broughtNotPlayed.map((g) => gameName(g.gameId)), (id) => memberById.get(id)?.name ?? 'someone', url)
			: chatText(night, memberIds, { member: (id) => memberById.get(id)?.name ?? 'someone', game: gameName }, url)
	);
	const when = $derived(`${nightDate(night.nightOn)}${night.startsAt ? `, ${night.startsAt}` : ''}`);
	const whoSummary = $derived(
		`${going.length} of ${plural(members.length, 'member', 'members')} going${guests.length ? `, plus ${plural(guests.length, 'guest', 'guests')}` : ''}.`
	);
	const bringSummary = $derived(
		[
			list.length ? `${plural(list.length, 'game', 'games')} from ${plural(byBringer.length, 'person', 'people')}.` : 'Nothing on the list yet.',
			host ? `Plus ${host.name}’s whole shelf, since it’s at their place.` : '',
			isTonight && data.canAnswer && list.length ? 'Mark anything that stayed home.' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
	let editing = $state(false);
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{night.name}, {nightDate(night.nightOn)} · {data.group.name}</title></svelte:head>

<a class="back" href="{base}/pick"><ArrowLeft size={18} aria-hidden="true" /> Game night</a>

<article class="night">
	<header class="night-head">
		<div>
			<h1>{night.name}</h1>
			<p class="lead">{when}</p>
			<p class="muted">
				{#if host}At {host.name}’s: their shelf counts on the night, plus whatever people bring.{:else}Somewhere else: only the games people bring.{/if}
			</p>
		</div>
		<div class="row actions">
			<CopyButton text={chat} label="Copy for the chat" />
			{#if isTonight}<a class="btn primary" href="{base}/pick"><Dices size={18} aria-hidden="true" /> Play tonight</a>{/if}
		</div>
		{#if form?.nightError}<p class="banner error" role="alert">{form.nightError}</p>{/if}
	</header>

	{#if data.canAnswer && !isPast}
		<section class="form-panel" aria-labelledby="answer-q">
			<div class="form-row">
				<div class="form-label">
					<span id="answer-q" class="form-q">{myAnswer === true ? 'You’re going' : myAnswer === false ? 'You can’t make it' : 'Are you going?'}</span>
					{#if myAnswer == null}<span class="hint">Everyone in the group sees your answer.</span>{/if}
				</div>
				<div class="form-body answer">
					<form method="POST" action="?/going" use:enhance>
						<input type="hidden" name="going" value="1" />
						<button class="btn" aria-pressed={myAnswer === true}>I’m going</button>
					</form>
					<form method="POST" action="?/going" use:enhance>
						<input type="hidden" name="going" value="0" />
						<button class="btn" aria-pressed={myAnswer === false}>Can’t make it</button>
					</form>
				</div>
			</div>
		</section>
	{/if}

	{#if isPast}
		<!-- After the night (D67): who came, what got played, what was brought and not played. -->
		<section class="form-panel" aria-labelledby="went-h">
			<div class="form-head">
				<div>
					<h2 id="went-h">How it went</h2>
					<p>{wentSummary}</p>
				</div>
				{#if !checked && data.canMarkAll && night.people.length}
					<form method="POST" action="?/confirmCame" use:enhance><button class="btn small">That’s right</button></form>
				{/if}
			</div>
			<div class="form-row" role="group" aria-labelledby="came-q">
				<div class="form-label">
					<span id="came-q" class="form-q">Came</span>
					{#if cameHint}<span class="hint">{cameHint}</span>{/if}
				</div>
				<div class="form-body">
					{#if cameRows.length || guestRows.length}
						<ul class="people">
							{#each cameRows as m (m.id)}
								{@const c = came.members.includes(m.id)}
								{@const inPlay = played.members.has(m.id)}
								{@const col = playerColor(m.colorIndex)}
								<li>
									{#if data.canAnswer && mayMark(m.id) && !(c && inPlay)}
										<form method="POST" action="?/came" use:enhance>
											<input type="hidden" name="userId" value={m.id} />
											<input type="hidden" name="came" value={c ? '0' : '1'} />
											<button class="person" class:going={c} aria-pressed={c} title={c ? `Mark ${m.name} as not there` : `Mark ${m.name} as there`}>
												<span class="dot" style:background={col.fill}></span>{m.name}
											</button>
										</form>
									{:else}
										<a class="person" class:going={c} href="{base}/members/{m.id}" title={inPlay ? 'In a play logged on this night' : undefined}
											><span class="dot" style:background={col.fill}></span>{m.name}</a
										>
									{/if}
								</li>
							{/each}
							{#each guestRows as name (name)}
								{@const c = cameGuest(name)}
								<li>
									{#if data.canMarkAll && !playedGuest(name) && guests.includes(name)}
										<form method="POST" action="?/came" use:enhance>
											<input type="hidden" name="guestName" value={name} />
											<input type="hidden" name="came" value={c ? '0' : '1'} />
											<button class="person guest" class:going={c} aria-pressed={c} title={c ? `Mark ${name} as not there` : `Mark ${name} as there`}>
												<span class="dot"></span>{name}
											</button>
										</form>
									{:else}
										<span class="person guest" class:going={c}><span class="dot"></span>{name}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted quiet">Nobody said they’d go, and no plays are logged.</p>
					{/if}
					{#if data.canMarkAll}
						<form method="POST" action="?/addCameGuest" class="inline guest-form" use:enhance>
							<label class="visually-hidden" for="came-guest">A guest who came</label>
							<input id="came-guest" class="field" name="name" maxlength="30" placeholder="Add a guest who came" autocomplete="off" />
							<button class="btn">Add</button>
						</form>
					{/if}
				</div>
			</div>
			<div class="form-row" role="group" aria-labelledby="played-q">
				<div class="form-label"><span id="played-q" class="form-q">Played</span></div>
				<div class="form-body">
					{#if data.plays.length}
						<ul class="outcomes">
							{#each data.plays as p (p.id)}
								{@const outcome = playOutcome(p, personName)}
								<li><a href="{base}/game/{p.gameId}">{p.gameName}</a>{#if outcome}<span class="muted">{outcome}</span>{/if}</li>
							{/each}
						</ul>
					{:else}
						<p class="muted quiet">Nothing logged. Log what you played under Plays.</p>
					{/if}
				</div>
			</div>
			{#if broughtNotPlayed.length}
				<div class="form-row" role="group" aria-labelledby="unplayed-q">
					<div class="form-label"><span id="unplayed-q" class="form-q">Brought, not played</span></div>
					<div class="form-body">
						<ul class="outcomes">
							{#each broughtNotPlayed as g (g.gameId)}<li><a href="{base}/game/{g.gameId}">{gameName(g.gameId)}</a></li>{/each}
						</ul>
					</div>
				</div>
			{/if}
		</section>
	{:else}
		<section class="form-panel" aria-labelledby="who-h">
			<div class="form-head">
				<div>
					<h2 id="who-h">Who’s going</h2>
					<p>{whoSummary}</p>
				</div>
			</div>
			<div class="form-row" role="group" aria-labelledby="members-q">
				<div class="form-label">
					<span id="members-q" class="form-q">Members</span>
					<span class="hint">{data.canChange && !isPast ? 'Tap someone to change their answer. ' : ''}Filled in: going. Struck through: can’t make it.</span>
				</div>
				<div class="form-body">
					<ul class="people">
						{#each members as m (m.id)}
							{@const a = answer(m.id)}
							{@const c = playerColor(m.colorIndex)}
							<li>
								{#if data.canChange && !isPast}
									<form method="POST" action="?/going" use:enhance>
										<input type="hidden" name="userId" value={m.id} />
										<input type="hidden" name="going" value={a === true ? '0' : '1'} />
										<button class="person" class:going={a === true} class:no={a === false} title={a === true ? `Mark ${m.name} not going` : `Mark ${m.name} going`}>
											<span class="dot" style:background={c.fill}></span>{m.name}
										</button>
									</form>
								{:else}
									<a class="person" href="{base}/members/{m.id}" class:going={a === true} class:no={a === false}><span class="dot" style:background={c.fill}></span>{m.name}</a>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			</div>
			{#if guests.length || (data.canAnswer && !isPast)}
				<div class="form-row" role="group" aria-labelledby="guests-q">
					<div class="form-label">
						<span id="guests-q" class="form-q">Guests</span>
						<span class="hint">People coming who aren’t in the group.</span>
					</div>
					<div class="form-body">
						{#if guests.length}
							<ul class="people">
								{#each guests as name (name)}
									<li>
										<span class="person going guest">
											<span class="dot"></span>{name}
											{#if data.canAnswer}
												<form method="POST" action="?/removeGuest" use:enhance>
													<input type="hidden" name="name" value={name} />
													<button class="remove" aria-label="Take {name} off the night"><X size={14} aria-hidden="true" /></button>
												</form>
											{/if}
										</span>
									</li>
								{/each}
							</ul>
						{/if}
						{#if data.canAnswer && !isPast}
							<form method="POST" action="?/addGuest" class="inline guest-form" use:enhance>
								<label class="visually-hidden" for="guest-name">A guest’s name</label>
								<input id="guest-name" class="field" name="name" maxlength="30" placeholder="Add a guest by name" autocomplete="off" />
								<button class="btn">Add</button>
							</form>
						{/if}
					</div>
				</div>
			{/if}
		</section>

	{/if}

	<section class="form-panel" aria-labelledby="bring-h">
		<div class="form-head">
			<div>
				<h2 id="bring-h">Bringing</h2>
				<p>{bringSummary}</p>
			</div>
		</div>
		{#each byBringer as b (b.label)}
			<div class="form-row" role="group" aria-label="What {b.label} brings">
				<div class="form-label">
					<span class="form-q bringer"><span class="dot" class:guest={!b.color} style:background={b.color}></span>{#if b.id}<a href="{base}/members/{b.id}">{b.label}</a>{:else}{b.label}{/if}</span>
				</div>
				<ul class="form-body games">
					{#each b.games as g (g.gameId)}
						{@const game = gameById.get(g.gameId)}
						<li class:home={g.stayedHome}>
							{#if game}
								<ListRow {game} href="{base}/game/{g.gameId}" members={memberById} {memberIds} />
							{:else}
								<a class="plain" href="{base}/game/{g.gameId}">{gameName(g.gameId)}</a>
							{/if}
							{#if isTonight && data.canAnswer}
								<form method="POST" action="?/stayedHome" use:enhance>
									<input type="hidden" name="gameId" value={g.gameId} />
									<input type="hidden" name="stayedHome" value={g.stayedHome ? '0' : '1'} />
									<button class="here" aria-pressed={!g.stayedHome} title={g.stayedHome ? 'It came after all' : 'It stayed home'}>{g.stayedHome ? 'Stayed home' : 'Here'}</button>
								</form>
							{/if}
							{#if data.canAnswer && (data.canChange || g.broughtBy === data.me || g.addedBy === data.me)}
								<form method="POST" action="?/unbring" use:enhance>
									<input type="hidden" name="gameId" value={g.gameId} />
									<button class="remove" aria-label="Take {gameName(g.gameId)} off the list"><X size={16} aria-hidden="true" /></button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>

	{#if mayAdd && !isPast}
		<section aria-labelledby="add-h" class="form-panel add">
			<div class="form-head">
				<div>
					<h2 id="add-h">Add to the list</h2>
					<p>From the shelves of the people going{players ? `, for ${players} players` : ''}, or by name for anything else.</p>
				</div>
			</div>
			{#snippet bringButton(g: CatalogGame)}
				{@const owners = goingOwners(g)}
				<form method="POST" action="?/bring" class="bring-it" use:enhance>
					<input type="hidden" name="gameId" value={g.id} />
					{#if owners.length === 1}
						<input type="hidden" name="ownerId" value={owners[0]} />
						<button class="btn small">Bring it <span class="muted">({memberById.get(owners[0])?.name})</span></button>
					{:else}
						<label class="visually-hidden" for="owner-{g.id}">Whose copy</label>
						<select id="owner-{g.id}" class="field small-select" name="ownerId">
							{#each owners as o (o)}<option value={o}>{memberById.get(o)?.name}’s copy</option>{/each}
						</select>
						<button class="btn small">Bring it</button>
					{/if}
				</form>
			{/snippet}
			{#snippet gameRow(g: CatalogGame)}
				<li>
					<span class="title"><a href="{base}/game/{g.id}">{g.name}</a>
						<span class="muted small num">{formatPlayerRange(g.minPlayers, g.maxPlayers) ?? '?'}p{#if formatPlaytime(g.minPlaytime, g.maxPlaytime)} · {formatPlaytime(g.minPlaytime, g.maxPlaytime)}{/if}</span>
						{#if soonNote(g)}<span class="muted small soon-note">{soonNote(g)}</span>{/if}</span>
					{@render bringButton(g)}
				</li>
			{/snippet}

			<div class="form-row" role="group" aria-labelledby="suggest-q">
				<div class="form-label">
					<span id="suggest-q" class="form-q">Suggest</span>
					<span class="hint">Three at random from their shelves.</span>
				</div>
				<div class="form-body">
					<div><button type="button" class="btn" disabled={!catalog || candidates.length === 0} onclick={suggest}><Dices size={18} aria-hidden="true" /> Suggest three</button></div>
					{#if suggestions.length}<ul class="found">{#each suggestions as g (g.id)}{@render gameRow(g)}{/each}</ul>{/if}
				</div>
			</div>

			<div class="form-row">
				<div class="form-label"><label class="form-q" for="find-bring">Find one</label></div>
				<div class="form-body">
					<input id="find-bring" class="field find" type="search" placeholder="Search {candidates.length} games on their shelves" bind:value={query} autocomplete="off" />
					{#if found.length}<ul class="found">{#each found as g (g.id)}{@render gameRow(g)}{/each}</ul>{/if}
				</div>
			</div>

			<div class="form-row" role="group" aria-labelledby="other-q">
				<div class="form-label">
					<span id="other-q" class="form-q">On nobody’s shelf</span>
					<span class="hint">A guest’s game, or one that isn’t in Box Populi.</span>
				</div>
				<div class="form-body">
					<details class="other">
						<summary class="link-button">Add one by name…</summary>
						<form method="POST" action="?/bringOther" class="other-form" use:enhance>
							<label class="form-sub">Name <input class="field" name="title" required maxlength="120" autocomplete="off" /></label>
							<div class="nums">
								<label class="form-sub">Fewest players <input class="field num" name="minPlayers" inputmode="numeric" autocomplete="off" /></label>
								<label class="form-sub">Most players <input class="field num" name="maxPlayers" inputmode="numeric" autocomplete="off" /></label>
								<label class="form-sub">Minutes <input class="field num" name="maxPlaytime" inputmode="numeric" autocomplete="off" /></label>
							</div>
							<p class="hint">Players and time help Play tonight pick it.</p>
							<label class="form-sub"
								>Who’s bringing it
								<select class="field" name="bringer" required>
									{#each going as id (id)}<option value="m:{id}">{memberById.get(id)?.name}</option>{/each}
									{#each guests as name (name)}<option value="g:{name}">{name} (guest)</option>{/each}
								</select>
							</label>
							<div><button class="btn">Add it</button></div>
						</form>
					</details>
				</div>
			</div>
		</section>
	{/if}

	{#if isTonight || isPast || data.plays.length}
		<section class="form-panel" aria-labelledby="plays-h">
			<div class="form-head">
				<div>
					<h2 id="plays-h">Plays</h2>
					<p>{data.plays.length ? `${plural(data.plays.length, 'play', 'plays')} logged.` : `Nothing logged${isTonight ? ' yet' : ''}.`}</p>
				</div>
				{#if data.canAnswer}
					<button type="button" class="btn small" onclick={() => (logOpen = true)}><Trophy size={16} aria-hidden="true" /> Log a play</button>
				{/if}
			</div>
			{#if logged}<div class="form-block"><p class="banner" role="status">Play logged.</p></div>{/if}
			{#if data.plays.length}
				<div class="form-block"><PlayList plays={data.plays} {members} {table} groupId={data.group.id} nights={data.nightList} /></div>
			{/if}
		</section>
	{/if}

	{#if data.canChange}
		<section class="manage" aria-labelledby="manage-h">
			<h2 id="manage-h" class="visually-hidden">Change the night</h2>
			<details bind:open={editing}>
				<summary class="link-button">Change the name, date or place…</summary>
				<form
					method="POST"
					action="?/edit"
					class="form-panel edit"
					use:enhance={() =>
						async ({ update, result }) => {
							await update({ reset: false });
							if (result.type === 'success') editing = false;
						}}
				>
					<NightFields {members} values={{ name: night.name, nightOn: night.nightOn, startsAt: night.startsAt, host: night.hostId }} planned={data.nights} editing={night.id} me={data.myId} />
					<div class="form-foot indent"><div><button class="btn primary">Save</button></div></div>
				</form>
			</details>
			{#if confirmDelete}
				<form method="POST" action="?/delete" class="inline">
					<span>Delete {night.name}? Its plays stay in the play log.</span>
					<button class="btn small danger">Delete the night</button>
					<button type="button" class="btn small" onclick={() => (confirmDelete = false)}>Keep it</button>
				</form>
			{:else}
				<button type="button" class="link-button" onclick={() => (confirmDelete = true)}>Delete the night…</button>
			{/if}
		</section>
	{/if}
</article>

<Modal bind:open={logOpen} title={logGame != null ? `Log ${gameName(logGame)}` : 'Log a play'}>
	{#if logOpen}
		<div class="log">
			<label class="pick-game">
				<span>Which game</span>
				<select class="field" bind:value={logGame}>
					<option value={null}>Pick one</option>
					{#each pool as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
				</select>
			</label>
			{#if logGame != null}
				{#key logGame}
					<PlayForm
						action="{base}/plays?/logPlay"
						game={{ id: logGame, name: gameName(logGame) }}
						{members}
						{table}
						nightId={night.id}
						day={night.nightOn}
						nights={data.nightList}
						people={{ members: came.members, guests: came.guests }}
						ondone={(saved) => {
							logOpen = false;
							logged = saved;
							logGame = null;
						}}
					/>
				{/key}
			{/if}
		</div>
	{/if}
</Modal>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: var(--s-3);
		font-weight: 650;
		text-decoration: none;
	}
	/* As wide as Play tonight's panel, so the two pages read as one tab. */
	.night {
		display: grid;
		gap: var(--s-5);
		max-width: 56rem;
		padding-block: var(--s-4) var(--s-6);
	}
	.night-head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-2);
	}
	.night-head h1 {
		margin: 0 0 var(--s-2);
	}
	.night-head p {
		margin: 0;
	}
	.lead {
		font-size: var(--t-lead);
		font-weight: 650;
	}
	.night-head .muted {
		margin-top: 2px;
	}
	/* From 760px the night's actions sit beside its name, as a form panel's head does. */
	@media (min-width: 760px) {
		.night-head {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
		}
		.night-head .banner {
			grid-column: 1 / -1;
		}
	}
	section {
		display: grid;
		gap: var(--s-3);
	}
	h2 {
		margin: 0;
	}
	.row,
	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.inline .field {
		flex: 1;
		min-width: 0;
		max-width: 18rem;
	}
	section > .link-button,
	section > details {
		justify-self: start;
	}

	/* Two answers side by side, the pressed one marigold (it's the person's own choice). */
	.answer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.answer button[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.people {
		list-style: none;
		margin: 0;
		padding: 0;
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
		color: var(--ink-2);
		font: inherit;
		font-weight: 650;
	}
	button.person {
		cursor: pointer;
	}
	/* Read-only, each person is the way to their profile (D61); struck through stays struck through. */
	a.person:not(.no) {
		text-decoration: none;
	}
	a.person:hover {
		border-color: var(--ink-3);
	}
	.person.going {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.person.no {
		text-decoration: line-through;
		color: var(--ink-3);
	}
	.person.guest {
		padding-right: 4px;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		flex: none;
	}
	.dot.guest,
	.guest .dot {
		box-shadow: inset 0 0 0 2px currentColor;
	}
	.remove {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.remove:hover {
		background: rgb(0 0 0 / 0.1);
	}
	/* What got played, and what was brought but not: a game per line, the outcome after it. */
	.outcomes {
		list-style: none;
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
	}
	.outcomes li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: baseline;
	}
	.outcomes a {
		font-weight: 650;
	}
	.quiet {
		margin: 0;
	}
	.guest-form .field {
		flex: 1;
		min-width: 0;
		max-width: 18rem;
	}
	/* Who brings it: the question column holds the person, with their colour. */
	.bringer {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	/* Their games as spines, the same rows as the shelf's Spines view. */
	.games {
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 6px;
	}
	.games .remove {
		width: 36px;
		height: 36px;
	}
	.games li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--s-2);
	}
	/* Before the shelf loads, or a game it can't name: a plain spine-sized row. */
	.plain {
		display: flex;
		align-items: center;
		min-height: 46px;
		padding: 0 var(--s-3);
		border-radius: var(--r-cube);
		background: var(--gap);
		font-weight: 700;
		text-decoration: none;
	}
	/* Stayed home: faded and struck through, still there to tick back. */
	.games li.home :global(.spine),
	.games li.home .plain {
		opacity: 0.45;
	}
	.games li.home :global(.spine .title),
	.games li.home .plain {
		text-decoration: line-through;
	}
	.here {
		min-width: 7rem;
		min-height: 36px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		color: var(--ink-2);
		font: inherit;
		font-size: var(--t-small);
		font-weight: 650;
		cursor: pointer;
	}
	.here[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	/* A form panel is a grid of its own rows, not the sections' spaced stack. */
	section.form-panel {
		display: block;
	}
	.found {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-2);
	}
	.found li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2) var(--s-3);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
	}
	.title {
		display: grid;
		font-weight: 650;
	}
	.bring-it {
		display: flex;
		gap: var(--s-2);
		align-items: center;
	}
	.small-select {
		min-height: 36px;
		width: auto;
	}
	.find {
		max-width: 28rem;
	}
	.pick-game {
		display: grid;
		gap: 6px;
		max-width: 24rem;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.other-form {
		display: grid;
		gap: var(--s-3);
		max-width: 28rem;
		margin-top: var(--s-4);
	}
	.other summary {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.edit {
		margin-top: var(--s-3);
	}
	.nums {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-2);
	}
	.log {
		display: grid;
		gap: var(--s-5);
	}
	.btn.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
	.small {
		font-size: var(--t-small);
	}
	/* Changing and deleting the night: two quiet links on one line; the edit form takes the full width once open. */
	.manage {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-3) var(--s-5);
	}
	.manage details[open] {
		flex-basis: 100%;
	}
</style>
