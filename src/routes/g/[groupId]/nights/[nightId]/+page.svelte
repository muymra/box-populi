<script lang="ts">
	// One game night (PRD "Game night"): when and where, who's going, the bring list, suggestions of
	// what to bring, and on the night, what stayed home and the plays logged.
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import X from '@lucide/svelte/icons/x';
	import Dices from '@lucide/svelte/icons/dices';
	import Trophy from '@lucide/svelte/icons/trophy';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import NightFields from '#lib/components/NightFields.svelte';
	import PlayForm from '#lib/components/PlayForm.svelte';
	import PlayList from '#lib/components/PlayList.svelte';
	import { fetchCatalog } from '#lib/catalog/client.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { DEFAULT_FILTERS, filterGames } from '#lib/catalog/filter.ts';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import { formatPlaytime } from '#lib/catalog/buckets.ts';
	import { pick } from '#lib/catalog/pick.ts';
	import type { CatalogGame } from '#lib/catalog/types.ts';
	import { bringList, chatText, goingMembers, nightDate, nightGuests, nightPoolIds } from '#lib/nights.ts';
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
		const groups = new Map<string, { label: string; color: string | null; games: typeof list }>();
		for (const g of list) {
			const key = g.guestName ? `g:${g.guestName}` : `m:${g.broughtBy}`;
			const m = g.broughtBy ? memberById.get(g.broughtBy) : undefined;
			const label = g.guestName ?? m?.name ?? 'a former member';
			const entry = groups.get(key) ?? { label, color: m ? playerColor(m.colorIndex).bg : null, games: [] };
			entry.games = [...entry.games, g];
			groups.set(key, entry);
		}
		return [...groups.values()];
	});

	// The catalog, for suggestions, the host's shelf and game names; the page works without it.
	let catalog = $state<CatalogGame[] | null>(null);
	onMount(async () => {
		try {
			catalog = (await fetchCatalog(data.group.id)).games;
		} catch {
			catalog = [];
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
	function suggest() {
		const fit = filterGames(candidates, { ...DEFAULT_FILTERS, players, availableOnly: false }, memberIds);
		const result = pick(fit.length ? fit : candidates, players, Math.random, new Set(seen));
		suggestions = result.games;
		seen = result.reset ? result.games.map((g) => g.id) : [...seen, ...result.games.map((g) => g.id)];
	}
	let query = $state('');
	const found = $derived(query.trim().length < 2 ? [] : candidates.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8));

	// On the night: the pool Play tonight draws from, for logging a play.
	const pool = $derived.by(() => {
		const ids = nightPoolIds(night, catalog ?? [], memberIds);
		return [...ids].map((id) => ({ id, name: gameName(id) })).sort((a, b) => a.name.localeCompare(b.name));
	});
	let logOpen = $state(false);
	let logGame = $state<number | null>(null);
	let logged = $state(false);

	const chat = $derived(
		chatText(night, memberIds, { member: (id) => memberById.get(id)?.name ?? 'someone', game: gameName }, `${page.url.origin}${base}/nights/${night.id}`)
	);
	const when = $derived(`${nightDate(night.nightOn)}${night.startsAt ? `, ${night.startsAt}` : ''}`);
	let editing = $state(false);
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{night.name}, {nightDate(night.nightOn)} · {data.group.name}</title></svelte:head>

<a class="back" href="{base}/pick"><ArrowLeft size={18} aria-hidden="true" /> Game night</a>

<article class="night">
	<header>
		<h1>{night.name}</h1>
		<p class="lead">{when}</p>
		<p class="muted">
			{#if host}At {host.name}’s: their shelf counts on the night, plus whatever people bring.{:else}Somewhere else: only the games people bring.{/if}
		</p>
		<div class="row">
			<CopyButton text={chat} label="Copy for the chat" />
			{#if isTonight}<a class="btn primary" href="{base}/pick"><Dices size={18} aria-hidden="true" /> Play tonight</a>{/if}
		</div>
		{#if form?.nightError}<p class="banner error" role="alert">{form.nightError}</p>{/if}
	</header>

	{#if data.canAnswer && !isPast}
		<section class="answer" aria-label="Your answer">
			<span>{myAnswer === true ? 'You’re going.' : myAnswer === false ? 'You can’t make it.' : 'Are you going?'}</span>
			<form method="POST" action="?/going" use:enhance>
				<input type="hidden" name="going" value="1" />
				<button class="btn small" aria-pressed={myAnswer === true}>I’m going</button>
			</form>
			<form method="POST" action="?/going" use:enhance>
				<input type="hidden" name="going" value="0" />
				<button class="btn small" aria-pressed={myAnswer === false}>Can’t make it</button>
			</form>
		</section>
	{/if}

	<section aria-labelledby="who-h">
		<h2 id="who-h">Who's going <span class="muted num">{going.length + guests.length}</span></h2>
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
								<span class="dot" style:background={c.bg}></span>{m.name}
							</button>
						</form>
					{:else}
						<span class="person" class:going={a === true} class:no={a === false}><span class="dot" style:background={c.bg}></span>{m.name}</span>
					{/if}
				</li>
			{/each}
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
		<p class="hint">Filled in: going. Struck through: can’t make it. Plain: no answer yet.</p>
		{#if data.canAnswer && !isPast}
			<form method="POST" action="?/addGuest" class="inline" use:enhance>
				<label class="visually-hidden" for="guest-name">A guest’s name</label>
				<input id="guest-name" class="field" name="name" maxlength="30" placeholder="Add a guest by name" autocomplete="off" />
				<button class="btn">Add</button>
			</form>
		{/if}
	</section>

	<section aria-labelledby="bring-h">
		<h2 id="bring-h">Bringing <span class="muted num">{list.length}</span></h2>
		{#if host}<p class="muted">Plus {host.name}’s whole shelf, since it’s at their place.</p>{/if}
		{#if byBringer.length}
			<ul class="bring">
				{#each byBringer as b (b.label)}
					<li>
						<span class="who"><span class="dot" class:guest={!b.color} style:background={b.color}></span>{b.label}</span>
						<ul class="games">
							{#each b.games as g (g.gameId)}
								<li class:home={g.stayedHome}>
									{#if isTonight && data.canAnswer}
										<form method="POST" action="?/stayedHome" use:enhance>
											<input type="hidden" name="gameId" value={g.gameId} />
											<input type="hidden" name="stayedHome" value={g.stayedHome ? '0' : '1'} />
											<button class="here" aria-pressed={!g.stayedHome} title={g.stayedHome ? 'It came after all' : 'It stayed home'}>{g.stayedHome ? 'Stayed home' : 'Here'}</button>
										</form>
									{/if}
									<a href="{base}/game/{g.gameId}">{gameName(g.gameId)}</a>
									{#if data.canAnswer && (data.canChange || g.broughtBy === data.me || g.addedBy === data.me)}
										<form method="POST" action="?/unbring" use:enhance>
											<input type="hidden" name="gameId" value={g.gameId} />
											<button class="remove" aria-label="Take {gameName(g.gameId)} off the list"><X size={14} aria-hidden="true" /></button>
										</form>
									{/if}
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Nothing on the list yet.</p>
		{/if}
	</section>

	{#if mayAdd && !isPast}
		<section aria-labelledby="add-h" class="panel add">
			<h2 id="add-h">Add to the list</h2>
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
						<span class="muted small num">{formatPlayerRange(g.minPlayers, g.maxPlayers) ?? '?'}p{#if formatPlaytime(g.minPlaytime, g.maxPlaytime)} · {formatPlaytime(g.minPlaytime, g.maxPlaytime)}{/if}</span></span>
					{@render bringButton(g)}
				</li>
			{/snippet}

			<div class="suggest">
				<button type="button" class="btn" disabled={!catalog || candidates.length === 0} onclick={suggest}><Dices size={18} aria-hidden="true" /> Suggest three</button>
				<span class="muted small">From the shelves of the people going{players ? `, for ${players} players` : ''}.</span>
			</div>
			{#if suggestions.length}<ul class="found">{#each suggestions as g (g.id)}{@render gameRow(g)}{/each}</ul>{/if}

			<label class="find">
				<span>Or find one on their shelves</span>
				<input class="field" type="search" placeholder="Search {candidates.length} games" bind:value={query} autocomplete="off" />
			</label>
			{#if found.length}<ul class="found">{#each found as g (g.id)}{@render gameRow(g)}{/each}</ul>{/if}

			<details class="other">
				<summary class="link-button">A game that’s on nobody’s shelf…</summary>
				<p class="hint">A guest’s game, or one someone is bringing that isn’t in Box Populi. Players and time help Play tonight.</p>
				<form method="POST" action="?/bringOther" class="other-form" use:enhance>
					<label>Name <input class="field" name="title" required maxlength="120" autocomplete="off" /></label>
					<div class="nums">
						<label>Fewest players <input class="field num" name="minPlayers" inputmode="numeric" autocomplete="off" /></label>
						<label>Most players <input class="field num" name="maxPlayers" inputmode="numeric" autocomplete="off" /></label>
						<label>Minutes <input class="field num" name="maxPlaytime" inputmode="numeric" autocomplete="off" /></label>
					</div>
					<label
						>Who’s bringing it
						<select class="field" name="bringer" required>
							{#each going as id (id)}<option value="m:{id}">{memberById.get(id)?.name}</option>{/each}
							{#each guests as name (name)}<option value="g:{name}">{name} (guest)</option>{/each}
						</select>
					</label>
					<button class="btn">Add it</button>
				</form>
			</details>
		</section>
	{/if}

	{#if isTonight || isPast || data.plays.length}
		<section aria-labelledby="plays-h">
			<h2 id="plays-h">Plays <span class="muted num">{data.plays.length}</span></h2>
			{#if data.plays.length}
				<PlayList plays={data.plays} {members} {table} groupId={data.group.id} />
			{:else}
				<p class="muted">Nothing logged{isTonight ? ' yet' : ''}.</p>
			{/if}
			{#if logged}<p class="banner" role="status">Play logged.</p>{/if}
			{#if data.canAnswer}
				<div class="row">
					<button type="button" class="btn" onclick={() => (logOpen = true)}><Trophy size={18} aria-hidden="true" /> Log a play</button>
				</div>
			{/if}
		</section>
	{/if}

	{#if data.canChange}
		<section aria-labelledby="manage-h">
			<h2 id="manage-h" class="visually-hidden">Change the night</h2>
			<details bind:open={editing}>
				<summary class="link-button">Change the name, date or place…</summary>
				<form method="POST" action="?/edit" class="edit" use:enhance={() => async ({ update, result }) => {
						await update({ reset: false });
						if (result.type === 'success') editing = false;
					}}>
					<NightFields {members} values={{ name: night.name, nightOn: night.nightOn, startsAt: night.startsAt, host: night.hostId }} />
					<button class="btn primary">Save</button>
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

<Modal bind:open={logOpen} title="Log a play">
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
						people={{ members: going, guests }}
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
	.night {
		display: grid;
		gap: var(--s-6);
		max-width: 46rem;
		padding-block: var(--s-4) var(--s-6);
	}
	header {
		display: grid;
		gap: var(--s-2);
	}
	h1 {
		margin: 0;
	}
	.lead {
		margin: 0;
		font-size: var(--t-lead);
		font-weight: 650;
	}
	section {
		display: grid;
		gap: var(--s-3);
	}
	h2 {
		margin: 0;
	}
	.row,
	.inline,
	.suggest {
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
	.answer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-3);
		padding: var(--s-3) var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		font-weight: 650;
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
	.bring {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-3);
	}
	.bring > li {
		display: grid;
		grid-template-columns: minmax(7rem, 10rem) minmax(0, 1fr);
		gap: var(--s-3);
		align-items: start;
		padding-bottom: var(--s-3);
		border-bottom: 1px solid var(--rule);
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-weight: 700;
		min-height: 32px;
	}
	.games {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.games li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 32px;
	}
	.games li.home a {
		text-decoration: line-through;
		color: var(--ink-3);
	}
	.here {
		min-width: 6.5rem;
		padding: 2px 10px;
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
	.add {
		gap: var(--s-4);
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
	.find,
	.pick-game {
		display: grid;
		gap: 6px;
		max-width: 24rem;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.other-form,
	.edit {
		display: grid;
		gap: var(--s-3);
		max-width: 30rem;
		margin-top: var(--s-3);
	}
	.other-form label {
		display: grid;
		gap: 6px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
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
	@media (max-width: 520px) {
		.bring > li {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}
</style>
