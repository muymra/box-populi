<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import UsersRound from '@lucide/svelte/icons/users-round';
	import Clock from '@lucide/svelte/icons/clock';
	import Weight from '@lucide/svelte/icons/weight';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Play from '@lucide/svelte/icons/play';
	import LinkIcon from '@lucide/svelte/icons/link';
	import Search from '@lucide/svelte/icons/search';
	import Plus from '@lucide/svelte/icons/plus';
	import Gift from '@lucide/svelte/icons/gift';
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Modal from '#lib/components/Modal.svelte';
	import PlayForm from '#lib/components/PlayForm.svelte';
	import PlayList from '#lib/components/PlayList.svelte';
	import { getTable } from '#lib/table/table.svelte.ts';
	import { nightOn } from '#lib/nights.ts';
	import { nightOf } from '#lib/table/regulars.ts';
	import { guessKind, KIND_LABELS, LINK_KINDS, type LinkKind } from '#lib/link-kinds.ts';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import { BUCKET_LABELS, formatPlaytime, formatWeight, weightBucket } from '#lib/catalog/buckets.ts';
	import { countsFromMask, formatCounts, formatPlayerRange } from '#lib/catalog/players.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const g = $derived(data.game);
	const table = getTable();

	// Logging a play (PRD "Play log"). "We played this" in the picker links here with ?log=1.
	let logOpen = $state(false);
	let logged = $state(false);
	// Tonight's game night, when this game is in its pool: on its bring list, or the host's own copy.
	const tonight = $derived.by(() => {
		const night = nightOn(data.nights, nightOf(Date.now()));
		if (!night) return null;
		const brought = night.games.some((n) => n.gameId === data.game.id && !n.stayedHome);
		return brought || (night.hostId != null && data.ownerIds.includes(night.hostId)) ? night : null;
	});
	onMount(() => {
		if (page.url.searchParams.get('log') !== '1') return;
		if (data.canLog) logOpen = true;
		const url = new URL(page.url.href);
		url.searchParams.delete('log');
		goto(`${url.pathname}${url.search}`, { replace: true, reset: false });
	});
	const lastPlayed = $derived(
		data.plays[0] ? new Date(`${data.plays[0].playedOn}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
	);
	const base = $derived(`/g/${data.group.id}`);
	/** The rail shows the latest three plays; the plays page has them all. */
	const recentPlays = $derived(data.plays.slice(0, 3));

	const players = $derived(formatPlayerRange(g.minPlayers, g.maxPlayers));
	const best = $derived(formatCounts(countsFromMask(g.bestMask)));
	const recommended = $derived(formatCounts(countsFromMask(g.recMask)));
	const time = $derived(formatPlaytime(g.minPlaytime, g.maxPlaytime));
	// BGG games show BGG's weight; anything else shows the complexity a member set, as a whole number.
	const groupRated = $derived(g.source !== 'bgg');
	// What a hand-entered or Wikidata game still lacks, so members know what to fill in.
	const missing = $derived(
		g.source === 'bgg'
			? []
			: [
					g.minPlayers == null && g.maxPlayers == null && 'players',
					g.minPlaytime == null && g.maxPlaytime == null && 'play time',
					g.weight == null && 'complexity',
					!g.imageUrl && 'a box image'
				].filter((x): x is string => typeof x === 'string')
	);
	const weight = $derived(g.weight == null ? null : groupRated ? `${Math.round(g.weight)} / 5` : formatWeight(g.weight));
	const bucket = $derived(weightBucket(g.weight));
	const pollLabel = $derived(g.pollSource === 'votes' ? 'computed from BGG poll votes' : 'BGG voters');
	const youtube = $derived(`https://www.youtube.com/results?search_query=${encodeURIComponent(`how to play ${g.name}`)}`);

	let expanded = $state(false);

	// One form sends at a time, and its button stays disabled until the answer is in, so a second
	// tap on a slow phone doesn't send it twice. `after` runs once the page has the new data.
	let sending = $state<string | null>(null);
	const send =
		(name: string, after?: (ok: boolean) => void): SubmitFunction =>
		() => {
			sending = name;
			return async ({ result, update }) => {
				await update({ reset: false });
				sending = null;
				after?.(result.type === 'success');
			};
		};
	let editOpen = $state(false);
	$effect(() => {
		if (form?.editError) editOpen = true;
	});
	const longDescription = $derived((g.description?.length ?? 0) > 500);

	const KIND_ICONS = { rules: BookOpen, video: Play, other: LinkIcon };

	// The add-link form: picks a kind from the address as it's typed, until the person picks one.
	let adding = $state(false);
	let kind = $state<LinkKind | ''>('');
	let kindPicked = $state(false);
	$effect(() => {
		if (form?.linkError) {
			adding = true;
			kind = (LINK_KINDS as readonly string[]).includes(form.link?.kind ?? '') ? (form.link!.kind as LinkKind) : '';
		}
	});
	function guessFromAddress(raw: string) {
		if (kindPicked) return;
		try {
			const value = raw.trim();
			const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
			const guess = url.hostname.includes('.') ? guessKind(url) : 'other';
			kind = guess === 'other' ? '' : guess;
		} catch {
			kind = '';
		}
	}
</script>

<svelte:head><title>{g.name} · {data.group.name}</title></svelte:head>

<a class="back" href={base}><ArrowLeft size={18} aria-hidden="true" /> Shelf</a>

<article class="game">
	<!-- From 900px: the game and how to learn it on the left, who has it and its plays in a rail on the
	     right. On phones one column in the order people need it at the table: the game, the rules, who
	     has it, the plays, then the rest. -->
	<div class="layout">
		<div class="main">
		<header class="head">
			<div class="hero-box"><BoxFront name={g.name} src={g.imageUrl} size="hero" /></div>
			<div class="intro">
				<h2 class="title">{g.name} {#if g.year}<span class="year num">{g.year}</span>{/if}</h2>
				{#if g.isExpansion || g.isManual || g.source === 'wikidata' || g.detailsPending}
					<p class="tags">
						{#if g.isExpansion}<span class="tag">Expansion</span>{/if}
						{#if g.isManual}<span class="tag">Hand-entered</span>{/if}
						{#if g.source === 'wikidata'}<span class="tag">Details from Wikidata</span>{/if}
						{#if g.detailsPending}<span class="tag">Details still loading from BGG</span>{/if}
					</p>
				{/if}
				{#if data.bases.length}
					<p>Expansion for {#each data.bases as b, i (b.id)}{i ? ', ' : ''}<a href="{base}/game/{b.id}">{b.name}</a>{/each}</p>
				{/if}
			</div>
			<ul class="facts">
				{#if players}
					<li>
						<UsersRound size={20} aria-hidden="true" />
						<span><strong class="num">{players}</strong> players
							{#if best}<span class="muted">{' · '}best with <span class="num">{best}</span> ({pollLabel})</span>{/if}
							{#if recommended && recommended !== best}<span class="muted">{' · '}recommended <span class="num">{recommended}</span></span>{/if}
						</span>
					</li>
				{/if}
				{#if time}
					<li><Clock size={20} aria-hidden="true" /><span><strong class="num">{time}</strong></span></li>
				{/if}
				{#if weight}
					<li>
						<Weight size={20} aria-hidden="true" />
						<span>
							<strong class="num">{weight}</strong>
							<span class="muted">{groupRated ? 'complexity, set by the group' : 'BGG weight'}{#if bucket}{' · '}{BUCKET_LABELS[bucket].toLowerCase()} on Box Populi's scale{/if}</span>
						</span>
					</li>
				{/if}
				{#if g.bggId || g.wikidataId}
					<li class="bgg">
						{#if g.bggId}
							<a class="btn small" href="https://boardgamegeek.com/boardgame/{g.bggId}" rel="noopener" target="_blank">
								View on BoardGameGeek <ExternalLink size={14} aria-hidden="true" />
							</a>
						{/if}
						{#if g.wikidataId && g.source === 'wikidata'}
							<a class="btn small" href="https://www.wikidata.org/wiki/{g.wikidataId}" rel="noopener" target="_blank">
								View on Wikidata <ExternalLink size={14} aria-hidden="true" />
							</a>
						{/if}
					</li>
				{/if}
			</ul>
		</header>

		{#if data.canEditDetails || data.editedByName}
			<section class="details-edit" aria-label="Game details">
				{#if form?.detailsSaved}<p class="banner" role="status">Details saved. Only {data.group.name} sees them.</p>{/if}
				{#if data.editedByName}<p class="muted small">Details last edited by {data.editedByName}.</p>{/if}
				{#if data.canEditDetails}
					{#if missing.length}<p class="muted small">Missing: {missing.join(', ')}.</p>{/if}
					<details class="lend" bind:open={editOpen}>
						<summary class="link-button">{missing.length ? 'Fill in the details…' : 'Edit details…'}</summary>
						<form method="POST" action="?/editDetails" class="lend-form edit-form" use:enhance={send('details', (ok) => ok && (editOpen = false))}>
							<label>Name <input class="field" name="name" required maxlength="120" value={g.name} /></label>
							<div class="pair">
								<label>Fewest players <input class="field num" name="minPlayers" inputmode="numeric" pattern="[0-9]*" value={g.minPlayers ?? ''} /></label>
								<label>Most players <input class="field num" name="maxPlayers" inputmode="numeric" pattern="[0-9]*" value={g.maxPlayers ?? ''} /></label>
							</div>
							<div class="pair">
								<label>Shortest play (min) <input class="field num" name="minPlaytime" inputmode="numeric" pattern="[0-9]*" value={g.minPlaytime ?? ''} /></label>
								<label>Longest play (min) <input class="field num" name="maxPlaytime" inputmode="numeric" pattern="[0-9]*" value={g.maxPlaytime ?? ''} /></label>
							</div>
							<label>
								Complexity
								<select class="field" name="complexity" value={g.weight == null ? '' : String(Math.round(g.weight))}>
									<option value="">Not set</option>
									<!-- Labels follow the shelf's complexity filter: light under 2, medium 2 to under 3, heavy 3 and up. -->
									<option value="1">1, light</option>
									<option value="2">2, medium</option>
									<option value="3">3, heavy</option>
									<option value="4">4, heavy</option>
									<option value="5">5, very heavy</option>
								</select>
							</label>
							<label>
								<span>Image address <span class="hint">(optional, https://)</span></span>
								<input class="field" name="imageUrl" type="url" value={g.imageUrlRaw ?? ''} />
							</label>
							<p class="hint">Changes show only in this group. Other groups with this game keep their own details.</p>
							{#if form?.editError}<p class="banner error" role="alert">{form.editError}</p>{/if}
							<button class="btn primary small" disabled={sending === 'details'}>{sending === 'details' ? 'Saving…' : 'Save details'}</button>
						</form>
					</details>
				{/if}
			</section>
		{/if}

			<section class="form-panel rules" aria-labelledby="links-h">
				<div class="form-head"><div><h3 id="links-h">Rules and tutorials</h3></div></div>
				<div class="form-block">
				<ul class="links">
					{#each data.links as link (link.id)}
						{@const Icon = KIND_ICONS[link.kind]}
						<li>
							<span class="kind" aria-hidden="true"><Icon size={18} /></span>
							<span class="link-body">
								<a href={link.url} rel="noopener noreferrer nofollow" target="_blank">{link.title ?? link.host}</a>
								<span class="meta">
									{KIND_LABELS[link.kind]}{#if link.title}{' · '}{link.host}{/if}{' · '}added by {link.addedByName ?? 'a former member'}
								</span>
							</span>
							{#if link.canDelete}
								<form method="POST" action="?/deleteLink" use:enhance>
									<input type="hidden" name="id" value={link.id} />
									<button class="link-button remove" aria-label="Remove {link.title ?? link.host}">Remove</button>
								</form>
							{/if}
						</li>
					{/each}
					<li>
						<span class="kind" aria-hidden="true"><Search size={18} /></span>
						<span class="link-body">
							<a href={youtube} rel="noopener noreferrer" target="_blank">How to play {g.name}</a>
							<span class="meta">Video search on YouTube</span>
						</span>
					</li>
				</ul>
				{#if form?.deleteError}<p class="banner error" role="alert">{form.deleteError}</p>{/if}
				{#if form?.linkAdded}<p class="banner" role="status">Link added.</p>{/if}

				{#if data.canEdit}
					<details class="add-link" bind:open={adding}>
						<summary class="btn small"><Plus size={16} aria-hidden="true" /> Add a rulebook or video</summary>
						<form
							method="POST"
							action="?/addLink"
							class="link-form"
							use:enhance={() => {
								sending = 'link';
								return async ({ result, update }) => {
									await update();
									sending = null;
									if (result.type === 'success') {
										kind = '';
										kindPicked = false;
										adding = false;
									}
								};
							}}
						>
							<label>
								Address
								<input
									class="field"
									name="url"
									required
									inputmode="url"
									autocomplete="off"
									autocapitalize="none"
									spellcheck="false"
									maxlength="2000"
									placeholder="https://…"
									value={form?.link?.url ?? ''}
									oninput={(e) => guessFromAddress(e.currentTarget.value)}
								/>
							</label>
							<fieldset class="kinds">
								<legend>Kind</legend>
								<div class="seg">
									{#each LINK_KINDS as k (k)}
										<label>
											<input type="radio" name="kind" value={k} bind:group={kind} onchange={() => (kindPicked = true)} />
											<span>{KIND_LABELS[k]}</span>
										</label>
									{/each}
								</div>
							</fieldset>
							<label>
								<span>Title <span class="hint">(optional)</span></span>
								<input class="field" name="title" maxlength="100" placeholder="e.g. Official rulebook (PDF)" value={form?.link?.title ?? ''} />
							</label>
							{#if form?.linkError}<p class="banner error" role="alert">{form.linkError}</p>{/if}
							<div class="inline">
								<button class="btn primary small" disabled={sending === 'link'}>Add link</button>
								<button type="button" class="link-button" onclick={() => (adding = false)}>Cancel</button>
							</div>
						</form>
					</details>
				{/if}
				</div>
			</section>

		{#if data.expansions.length}
			<section class="exp" aria-labelledby="exp-h">
				<h3 id="exp-h">Expansions in the group</h3>
				<ul class="plain">
					{#each data.expansions as e (e.id)}<li><a href="{base}/game/{e.id}">{e.name}</a></li>{/each}
				</ul>
			</section>
		{/if}

		{#if g.description}
			<section class="about" aria-labelledby="about-h">
				<h3 id="about-h">About</h3>
				<p class="description" class:clamped={longDescription && !expanded}>{g.description}</p>
				{#if longDescription}
					<button type="button" class="link-button" onclick={() => (expanded = !expanded)}>{expanded ? 'Show less' : 'Read more'}</button>
				{/if}
			</section>
		{/if}
		</div>

		<div class="rail">
			<section class="form-panel owners" aria-labelledby="owners-h">
				<div class="form-head"><div><h3 id="owners-h">On whose shelf</h3></div></div>
				<div class="form-block">
				{#if data.owners.length}
					<ul class="people">
						{#each data.owners as o, i (i)}
							{@const c = playerColor(o.colorIndex)}
							<li>
								<span class="chip" style:background={c.fill} style:color={c.ink} aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
								<span class="who"><strong>{o.name}</strong></span>
								{#if o.status}<span class="tag">{o.status}</span>{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">Nobody in the group owns this yet.</p>
				{/if}
				{#if data.wishers.length}
					<p class="muted wanted">Wanted by {data.wishers.map((w) => w.name).join(', ')}</p>
				{/if}
				{#if data.canEdit}
					<div class="copy-actions">
						<form method="POST" action={data.mine ? '?/remove' : '?/add'}>
							<button class="btn">{data.mine ? 'Remove from my games' : data.owners.length ? 'I own this too' : 'I own this'}</button>
						</form>
						{#if data.mine && data.myLoan}
							<form method="POST" action="?/returned" use:enhance={send('returned')}>
								<button class="btn" disabled={sending === 'returned'}>Mark as returned</button>
							</form>
						{/if}
						{#if !data.mine}
							<form method="POST" action="?/want" use:enhance={send('want')}>
								<input type="hidden" name="on" value={data.wanted ? '0' : '1'} />
								<button class="btn want" aria-pressed={data.wanted} disabled={sending === 'want'}>
									<Gift size={18} aria-hidden="true" />
									{data.wanted ? 'On your wishlist' : 'I want this'}
								</button>
							</form>
						{/if}
					</div>
					{#if form?.lent}<p class="banner" role="status">Marked as lent.</p>{:else if form?.returned}<p class="banner" role="status">Marked as returned.</p>{/if}
					{#if data.mine && !data.myLoan}
						<details class="lend" open={!!form?.lendError}>
							<summary class="link-button">Lend your copy…</summary>
							<form method="POST" action="?/lend" class="lend-form" use:enhance={send('lend')}>
								{#if data.lendTo.length}
									<label>
										Someone in {data.group.name}
										<select class="field" name="toUser">
											<option value="">Pick a member</option>
											{#each data.lendTo as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
										</select>
									</label>
								{/if}
								<label>
									<span>Or someone outside the group</span>
									<input class="field" name="toText" maxlength="40" autocomplete="off" placeholder="e.g. my sister" />
								</label>
								<p class="hint">Lent to a member, it still counts as available here. Lent outside, it’s hidden when people look for available games.</p>
								{#if form?.lendError}<p class="banner error" role="alert">{form.lendError}</p>{/if}
								<button class="btn primary small" disabled={sending === 'lend'}>Mark as lent</button>
							</form>
						</details>
					{/if}
				{/if}
				</div>
			</section>

			<section class="form-panel plays" aria-labelledby="plays-h">
				<div class="form-head">
					<div>
						<h3 id="plays-h">Plays {#if data.playCount}<span class="muted num">{data.playCount}</span>{/if}</h3>
						{#if data.playCount}
							<p>Last played {lastPlayed}.{#if data.mostWins}{' '}Most wins: {data.mostWins.name} ({data.mostWins.wins}).{/if}</p>
						{:else}
							<p>Nobody has logged a play of this yet.</p>
						{/if}
					</div>
				</div>
				{#if data.playCount}
					<div class="form-block">
						<PlayList plays={recentPlays} members={data.tableMembers} {table} groupId={data.group.id} />
					</div>
				{/if}
				{#if logged}<div class="form-block"><p class="banner" role="status">Play logged.</p></div>{/if}
				{#if data.canLog || data.playCount > recentPlays.length}
					<div class="form-foot">
						<div class="foot-row">
							{#if data.canLog}<button type="button" class="btn" onclick={() => (logOpen = true)}><Trophy size={18} aria-hidden="true" /> Log a play</button>{/if}
							{#if data.playCount}<a href="{base}/plays">{data.playCount > recentPlays.length ? `All ${data.playCount} plays and the leaderboard` : 'Leaderboard'}</a>{/if}
						</div>
					</div>
				{/if}
			</section>
		</div>
	</div>

	<Modal bind:open={logOpen} title="Log {g.name}">
		{#if logOpen}
			<PlayForm
				action="{base}/plays?/logPlay"
				game={{ id: g.id, name: g.name }}
				members={data.tableMembers}
				{table}
				nightId={tonight?.id ?? null}
				ondone={(saved) => {
					logOpen = false;
					logged = saved;
				}}
			/>
		{/if}
	</Modal>
</article>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: var(--s-2) 0 var(--s-4);
		font-weight: 650;
		text-decoration: none;
		color: var(--ink-2);
	}
	.back:hover {
		color: var(--ink);
	}
	.game {
		max-width: 76rem;
	}
	/* One column on phones, in table order (the game, rules, who has it, plays, the rest): the two
	   columns' wrappers step aside and each block takes its place by `order`. */
	.layout {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}
	.main,
	.rail {
		display: contents;
	}
	.head {
		order: 1;
	}
	.details-edit {
		order: 2;
	}
	.rules {
		order: 3;
	}
	.owners {
		order: 4;
	}
	.plays {
		order: 5;
	}
	.exp {
		order: 6;
	}
	.about {
		order: 7;
	}
	@media (min-width: 900px) {
		.layout {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 22rem;
			gap: var(--s-6);
			align-items: start;
		}
		.main,
		.rail {
			display: grid;
			gap: var(--s-5);
			align-content: start;
		}
	}
	/* Panel titles inside the page: h3 in the outline, set like the other pages' panel titles. */
	.form-head h3 {
		margin: 0;
		font-size: var(--t-h2);
	}
	.form-head h3 .num {
		font-weight: 600;
		margin-left: 4px;
	}
	.form-block > :global(:first-child) {
		margin-top: 0;
	}
	.foot-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-4);
	}
	.foot-row a {
		font-weight: 650;
	}
	.head {
		display: grid;
		grid-template-columns: 9.5rem minmax(0, 1fr);
		grid-template-areas: 'box intro' 'facts facts';
		gap: var(--s-4) var(--s-5);
		align-items: start;
	}
	@media (min-width: 640px) {
		.head {
			grid-template-columns: 15rem minmax(0, 1fr);
			grid-template-areas: 'box intro' 'box facts';
			grid-template-rows: auto 1fr;
		}
	}
	.hero-box {
		grid-area: box;
		aspect-ratio: 1 / 1.04;
		box-shadow: var(--shadow-lift);
		border-radius: var(--r-cube);
		transform: rotate(-1.5deg);
	}
	.intro {
		grid-area: intro;
		min-width: 0;
	}
	.title {
		font-size: var(--t-h1);
		overflow-wrap: anywhere;
	}
	.year {
		font-weight: 500;
		font-size: 0.55em;
		color: var(--ink-2);
		margin-left: 4px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.facts {
		grid-area: facts;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.facts li {
		display: flex;
		gap: var(--s-2);
		align-items: flex-start;
	}
	.facts :global(svg) {
		flex: none;
		margin-top: 1px;
		color: var(--ink-2);
	}
	.facts .bgg {
		margin-top: var(--s-2);
		flex-wrap: wrap;
	}
	.facts .bgg :global(svg) {
		margin: 0;
		color: currentColor;
	}
	.exp h3,
	.about h3 {
		margin-bottom: var(--s-3);
	}
	.people {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.people li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		flex-wrap: wrap;
	}
	.chip {
		width: 30px;
		height: 30px;
		border-radius: 4px;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: var(--t-small);
	}
	.wanted {
		margin-top: var(--s-3);
	}
	.copy-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-4);
	}
	.want[aria-pressed='true'] {
		border-color: var(--ink);
	}
	.lend {
		margin-top: var(--s-3);
	}
	.lend summary {
		display: inline-block;
		min-height: 44px;
		line-height: 44px;
		font-weight: 650;
		list-style: none;
	}
	.lend summary::-webkit-details-marker {
		display: none;
	}
	.lend-form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
		max-width: 26rem;
	}
	.lend-form label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-self: stretch;
		font-weight: 650;
	}
	.lend-form .hint {
		margin: 0;
	}
	.details-edit {
		margin-top: calc(-1 * var(--s-4));
	}
	.details-edit .small {
		font-size: var(--t-small);
		margin: 0;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-3);
		align-self: stretch;
	}
	.pair label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 650;
	}
	.links {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.links li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.kind {
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--r-ctl);
		background: var(--gap);
		color: var(--ink-2);
	}
	.link-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.link-body a {
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.meta {
		font-size: var(--t-small);
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}
	.remove {
		min-height: 44px;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.add-link {
		margin-top: var(--s-4);
	}
	.add-link summary {
		list-style: none;
	}
	.add-link summary::-webkit-details-marker {
		display: none;
	}
	.add-link[open] summary {
		display: none;
	}
	.link-form {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		max-width: 34rem;
	}
	.link-form > label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 650;
	}
	.kinds {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.kinds legend {
		font-weight: 650;
		padding: 0;
		margin-bottom: 6px;
	}
	.seg {
		display: inline-flex;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.seg label {
		position: relative;
	}
	.seg input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	.seg span {
		display: grid;
		place-items: center;
		min-width: 76px;
		height: 40px;
		padding: 0 var(--s-3);
		background: var(--cube);
		color: var(--ink-2);
		font-weight: 650;
		font-size: var(--t-small);
	}
	.seg label + label span {
		border-left: 1.5px solid var(--rule);
	}
	.seg input:checked + span {
		background: var(--ink);
		color: var(--laminate);
	}
	.seg input:focus-visible + span {
		outline: 2px solid var(--focus);
		outline-offset: -4px;
	}
	.plain {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.description {
		white-space: pre-line;
	}
	.clamped {
		max-height: 9.5rem;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, black 55%, transparent);
	}
</style>
