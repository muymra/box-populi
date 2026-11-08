<script lang="ts">
	import { APP_VERSION, CHANGELOG_URL } from '#lib/project.ts';
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { lastActive } from '#lib/time.ts';
	import { normalizeHex } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// Each colour has a picker and a hex box kept in step; the hex box is what the form sends, so
	// typing a code works without JavaScript too. A half-typed code leaves the picker where it was.
	type ColorKey = keyof typeof data.look.colors;
	const COLOR_FIELDS: Array<[ColorKey, string]> = [
		['page', 'Page'],
		['surface', 'Cards and fields'],
		['ink', 'Text'],
		['strip', 'Filter strip'],
		['accent', 'Accent (chosen things)']
	];
	// svelte-ignore state_referenced_locally (seeded from the saved colours; the fields own them after)
	let colors = $state({ ...data.look.colors });
	// svelte-ignore state_referenced_locally
	let hexes = $state<Record<ColorKey, string>>({ ...data.look.colors });
	function typed(key: ColorKey, value: string) {
		hexes[key] = value;
		const hex = normalizeHex(value);
		if (hex) colors[key] = hex;
	}
	function picked(key: ColorKey, value: string) {
		colors[key] = value;
		hexes[key] = value;
	}

	const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
	const ACTION_LABELS: Record<string, string> = {
		suspend_group: 'Suspended',
		unsuspend_group: 'Unsuspended',
		delete_group: 'Deleted',
		owner_sign_in_code: 'Sign-in code for the owner of'
	};

	// A group's Manage: one confirmation well open at a time, as on the Group tab. After an action that
	// failed, its well reopens with the error beside the field; after one that worked, a status line says so.
	type Kind = 'suspend' | 'unsuspend' | 'ownerCode' | 'delete';
	let openFor = $state<{ id: string; kind: Kind } | null>(null);
	// Which group's Manage is open, kept here: Svelte sets `open` again on every update, which would fold
	// the row shut whenever a well opens.
	let openGroup = $state<string | null>(null);
	let typedName = $state('');
	function toggle(id: string, kind: Kind) {
		openFor = openFor?.id === id && openFor.kind === kind ? null : { id, kind };
		typedName = '';
	}
	const failure = $derived.by((): { id: string; kind: Kind; error: string } | null => {
		if (!form || !('action' in form) || !form.action || !form.groupId) return null;
		return { id: form.groupId, kind: form.action, error: form.error ?? '' };
	});
	// Runs when an action's result arrives, not when a well is opened by hand.
	$effect(() => {
		const failed = failure;
		const code = form?.ownerCode;
		const done = form?.done;
		untrack(() => {
			if (failed) openFor = { id: failed.id, kind: failed.kind };
			else if (code) openFor = { id: code.groupId, kind: 'ownerCode' };
			else if (done) openFor = null;
			if (openFor) openGroup = openFor.id;
		});
	});
	const done = $derived.by(() => {
		const d = form?.done;
		if (!d) return null;
		if (d.action === 'suspend') return `Suspended ${d.name}. Its members see your message on its banner.`;
		if (d.action === 'unsuspend') return `Lifted the suspension on ${d.name}.`;
		return `Deleted ${d.name} for good. It’s in the admin log.`;
	});
	// The delete button waits for the typed name once the page is running; without JavaScript the server checks it.
	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	const sameName = (typed: string, name: string) => typed.replace(/\s+/g, ' ').trim().toLocaleLowerCase() === name.toLocaleLowerCase();

	type SortKey = 'lastActive' | 'members' | 'copies' | 'createdAt' | 'name';
	const SORTS: Array<[SortKey, string]> = [
		['lastActive', 'Last active'],
		['members', 'Members'],
		['copies', 'Copies'],
		['createdAt', 'Newest'],
		['name', 'Name']
	];
	let sort = $state<SortKey>('lastActive');
	let query = $state('');

	const shown = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase();
		const list = q ? data.groups.filter((g) => g.name.toLocaleLowerCase().includes(q)) : [...data.groups];
		const key = sort;
		if (key === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
		return list.sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
	});

	const TOTALS: Array<[keyof typeof data.totals, string]> = [
		['people', 'People'],
		['groups', 'Groups'],
		['games', 'Cached games'],
		['copies', 'Copies'],
		['sessions', 'Device sessions'],
		['rateEvents', 'Rate-limit rows']
	];
</script>

<svelte:head><title>Instance admin</title></svelte:head>

<div class="admin">
	{#snippet head()}
		<header class="head">
			<h1>Instance admin</h1>
			<form method="POST" action="?/signOut"><button class="btn small">Sign out of admin</button></form>
		</header>
		<p class="muted intro">
			Counts and group names only. This page never shows who is in a group, their games or the join codes, and every action below is logged.
		</p>
		<p class="muted version">This instance runs Box Populi <span class="num">{APP_VERSION}</span>. <a href={CHANGELOG_URL} rel="noopener">What changed in each version</a></p>
	{/snippet}

	{#snippet banners()}
		{#if data.bggMode === 'off'}
			<p class="banner">
				BoardGameGeek search and import aren’t set up here (<code>BGG_MODE=off</code>).
				{#if data.gameSource === 'wikidata'}Groups find games on Wikidata or type them in (<code>GAME_SOURCE=wikidata</code>).{:else}Groups type their games in (<code>GAME_SOURCE=manual</code>).{/if}
			</p>
		{/if}
		{#if data.groupCreation === 'admins'}
			<p class="banner">
				Only you can create groups (<code>GROUP_CREATION=admins</code>). <a href="/groups/new">Create a group</a>
			</p>
		{/if}
	{/snippet}

	{#snippet lookIntro()}
		Five colours make a custom theme; the shades in between are worked out for you, and any text that would be hard to read is darkened or lightened until it isn't. It
		appears as "Custom" in the footer's Theme menu and the group theme menu.
	{/snippet}
	{#snippet swatches()}
		<div class="swatches">
			{#each COLOR_FIELDS as [key, label] (key)}
				<div class="swatch">
					<label for="hex-{key}">{label}</label>
					<div class="swatch-inputs">
						<input type="color" value={colors[key]} oninput={(e) => picked(key, e.currentTarget.value)} aria-label="{label}: pick a colour" />
						<input
							id="hex-{key}"
							class="field hex num"
							name={key}
							value={hexes[key]}
							oninput={(e) => typed(key, e.currentTarget.value)}
							required
							spellcheck="false"
							autocomplete="off"
							maxlength="7"
							pattern={'#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})'}
							aria-invalid={normalizeHex(hexes[key]) == null}
						/>
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
	{#snippet defaultCheck()}
		<label class="check">
			<input type="checkbox" name="customDefault" checked={data.look.customDefault} />
			<span>Show the custom theme to everyone by default (people can still pick another in the footer)</span>
		</label>
	{/snippet}
	{#snippet logoInput()}<input id="logo-url" class="field" name="logoUrl" type="url" value={data.look.logoUrl} placeholder="https://example.com/logo.svg" />{/snippet}
	{#snippet lookMessages()}
		{#if form?.lookError}<p class="banner error" role="alert">{form.lookError}</p>{/if}
		{#if form?.lookSaved}<p class="muted" role="status">Saved. Other pages pick it up within a minute.</p>{/if}
	{/snippet}
	{#snippet lookButtons()}
		<div class="inline">
			<button class="btn primary small">{data.look.hasCustom ? 'Save' : 'Create the custom theme'}</button>
			{#if data.look.hasCustom}<button class="btn small" name="remove" value="1" formnovalidate>Remove the custom theme</button>{/if}
		</div>
	{/snippet}
	<!-- The look of the site as a form panel with rows and a Save band. -->
	{#snippet lookPanel()}
		<form method="POST" action="?/look" class="form-panel look-panel" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<div class="form-head"><div><h2 id="look-h">Look of this site</h2><p>{@render lookIntro()}</p></div></div>
			<div class="form-row" role="group" aria-labelledby="colours-q">
				<div class="form-label"><span id="colours-q" class="form-q">Colours</span><span class="hint">The rest is mixed from these five.</span></div>
				<div class="form-body">{@render swatches()}</div>
			</div>
			<div class="form-row" role="group" aria-labelledby="default-q">
				<div class="form-label"><span id="default-q" class="form-q">For everyone</span></div>
				<div class="form-body">{@render defaultCheck()}</div>
			</div>
			<div class="form-row">
				<div class="form-label"><label class="form-q" for="logo-url">Logo</label><span class="hint">Optional, https://. Replaces the cube mark.</span></div>
				<div class="form-body">{@render logoInput()}</div>
			</div>
			<div class="form-foot indent">{@render lookMessages()}{@render lookButtons()}</div>
		</form>
	{/snippet}

	{#snippet totalsList()}
		<dl class="totals">
			{#each TOTALS as [key, label] (key)}
				<div>
					<dt>{label}</dt>
					<dd class="num">{data.totals[key].toLocaleString('en')}</dd>
				</div>
			{/each}
		</dl>
	{/snippet}

	{#snippet groupTools()}
		<div class="tools">
			{#if data.groups.length > 10}
				<label class="find">
					<Search size={18} aria-hidden="true" />
					<span class="visually-hidden">Find a group</span>
					<input class="field" type="search" placeholder="Find a group" bind:value={query} autocomplete="off" />
				</label>
			{/if}
			<label class="sort">
				Sort by
				<select class="field" bind:value={sort}>
					{#each SORTS as [key, label] (key)}<option value={key}>{label}</option>{/each}
				</select>
			</label>
		</div>
	{/snippet}
	{#snippet groupList()}
		{#if done}<p class="banner" role="status">{done}</p>{/if}
		{#if data.groups.length === 0}
			<p class="muted">No groups yet.</p>
		{:else}
			<ul class="groups">
				{#each shown as g (g.id)}
					{@const here = openFor?.id === g.id ? openFor.kind : null}
					{@const failed = failure?.id === g.id ? failure : null}
					{@const ownerCode = form?.ownerCode?.groupId === g.id ? form.ownerCode : null}
					{#snippet summary()}
						<span class="g-name">
							<strong>{g.name}</strong>
							{#if g.isDemo}<span class="tag">Demo</span>{/if}
							{#if g.suspendedAt}<span class="tag suspended">Suspended</span>{/if}
							{#if g.archivedAt}<span class="tag">Archived</span>{/if}
						</span>
						<span class="g-meta">
							<span><span class="num">{g.members}</span> {g.members === 1 ? 'member' : 'members'}</span>
							<span><span class="num">{g.copies.toLocaleString('en')}</span> {g.copies === 1 ? 'copy' : 'copies'}</span>
							<span>{g.lastActive ? lastActive(g.lastActive, data.now) : 'never active'}</span>
							<span>created <span class="num">{day(g.createdAt)}</span></span>
						</span>
					{/snippet}
					{#snippet cancel()}
						<button type="button" class="btn small" onclick={() => (openFor = null)}>Cancel</button>
					{/snippet}
					{#snippet reason(label: string, hint: string)}
						<label>
							{label}
							<span class="hint">{hint}</span>
							<textarea class="field" name="reason" required minlength="3" maxlength="500" rows="2"></textarea>
						</label>
					{/snippet}
					<li>
						{#if g.isDemo}
							<div class="row">{@render summary()}</div>
						{:else}
							<!-- One group's Manage open at a time, laid out like a member's Manage on the Group tab:
							     labelled rows, the irreversible one in a ruled foot, one confirmation well under them. -->
							<details
								class="manage"
								name="admin-groups"
								open={openGroup === g.id}
								ontoggle={(e) => {
									if (e.currentTarget.open) openGroup = g.id;
									else if (openGroup === g.id) openGroup = null;
								}}
							>
								<summary>
									{@render summary()}
									<span class="manage-label">Manage <ChevronDown size={16} aria-hidden="true" /></span>
								</summary>
								<div class="actions">
									<div class="arow">
										<span class="alabel">Access</span>
										<div class="abody">
											{#if g.suspendedAt}
												<span>Suspended on <span class="num">{day(g.suspendedAt)}</span>: “{g.suspendedReason}”</span>
												<button type="button" class="link-button" aria-expanded={here === 'unsuspend'} onclick={() => toggle(g.id, 'unsuspend')}>Unsuspend…</button>
											{:else}
												<span>{g.archivedAt ? 'Archived by its owner: read-only for its members.' : 'Open.'}</span>
												<button type="button" class="link-button" aria-expanded={here === 'suspend'} onclick={() => toggle(g.id, 'suspend')}>Suspend…</button>
											{/if}
										</div>
									</div>
									<!-- For an owner who lost their PIN and every device (D52): nobody in the group can reach them. -->
									<div class="arow">
										<span class="alabel">Owner’s way in</span>
										<div class="abody">
											<button type="button" class="btn small" aria-expanded={here === 'ownerCode'} onclick={() => toggle(g.id, 'ownerCode')}>Make a sign-in code</button>
										</div>
									</div>
									<div class="afoot">
										{#if g.suspendedAt}
											<button type="button" class="link-button danger-link" aria-expanded={here === 'delete'} onclick={() => toggle(g.id, 'delete')}>Delete {g.name} for good…</button>
										{:else}
											<span class="hint"
												>To delete it, <button type="button" class="link-button" aria-expanded={here === 'suspend'} onclick={() => toggle(g.id, 'suspend')}
													>suspend it first</button
												>. Suspending can be undone; deleting can’t.</span
											>
										{/if}
									</div>

									{#if here === 'suspend'}
										<form method="POST" action="?/suspend" class="well" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<p>
												{g.name} turns read-only for its members and its join link closes. Unsuspend undoes it.{#if g.archivedAt}{' '}It’s archived, so while
													it’s suspended its owner can’t restore it.{/if}
											</p>
											{@render reason('Message to members', 'On the group’s read-only banner, with your contact address. It goes in the admin log too.')}
											{#if failed}<p class="banner error" role="alert">{failed.error}</p>{/if}
											<div class="wbtns"><button class="btn small">Suspend {g.name}</button>{@render cancel()}</div>
										</form>
									{:else if here === 'unsuspend'}
										<form method="POST" action="?/unsuspend" class="well" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<p>{g.name} goes back to how it was{g.archivedAt ? ': archived, which its owner can restore' : ', open to its members'}.</p>
											{@render reason('Reason', 'For the admin log only.')}
											{#if failed}<p class="banner error" role="alert">{failed.error}</p>{/if}
											<div class="wbtns"><button class="btn small">Unsuspend {g.name}</button>{@render cancel()}</div>
										</form>
									{:else if here === 'ownerCode' && ownerCode}
										<div class="well owner-code" role="status">
											<p>Give this code to the owner:</p>
											<div class="code-line">
												<span class="code num">{ownerCode.code}</span>
												<CopyButton text={ownerCode.code} small />
											</div>
											<p class="hint">
												Works once, until {new Date(ownerCode.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. They open their
												group’s link (it’s in their group chat; you can’t see it here), tap their name, choose “use a sign-in code” and type it, then pick a new PIN.
												It won’t be shown again.
											</p>
											<div class="wbtns"><button type="button" class="btn small" onclick={() => (openFor = null)}>Done</button></div>
										</div>
									{:else if here === 'ownerCode'}
										<form method="POST" action="?/ownerCode" class="well" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<p>
												For an owner who forgot their PIN and has no signed-in device: nobody in the group can make them one. You won’t see their name, so make
												one only when you know who’s asking; the created date and member count above can help you check.
											</p>
											{@render reason('Reason', 'For the admin log only.')}
											{#if failed}<p class="banner error" role="alert">{failed.error}</p>{/if}
											<div class="wbtns"><button class="btn small">Make a code for the owner</button>{@render cancel()}</div>
										</form>
									{:else if here === 'delete'}
										<form method="POST" action="?/delete" class="well" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<p>
												Removes {g.name} with its <span class="num">{g.plays}</span>
												{g.plays === 1 ? 'play' : 'plays'} and <span class="num">{g.nights}</span>
												{g.nights === 1 ? 'game night' : 'game nights'}, its join code, and its rules and video links, for everyone. Members keep their accounts and
												their games, and nobody is told. It can’t be undone.
											</p>
											{@render reason('Reason', 'For the admin log only.')}
											<label>
												<span>Type <strong>{g.name}</strong> to confirm</span>
												<input class="field" name="confirmName" required autocomplete="off" bind:value={typedName} />
											</label>
											{#if failed}<p class="banner error" role="alert">{failed.error}</p>{/if}
											<div class="wbtns">
												<button class="btn small danger" disabled={hydrated && !sameName(typedName, g.name)}>Delete {g.name} for good</button>{@render cancel()}
											</div>
										</form>
									{/if}
								</div>
							</details>
						{/if}
					</li>
				{:else}
					<li class="muted none">No group by that name.</li>
				{/each}
			</ul>
		{/if}
	{/snippet}

	{#snippet adminLog()}
		{#if data.log.length === 0}
			<p class="muted">Nothing yet. What you do to a group appears here with its reason.</p>
		{:else}
			<ol class="log">
				{#each data.log as entry (entry.id)}
					<li>
						<span class="num muted">{day(entry.at)}</span>
						<span><strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong> {entry.targetLabel}: {entry.reason}</span>
					</li>
				{/each}
			</ol>
		{/if}
	{/snippet}

	{@render head()}
	{@render banners()}

	<!-- Everyday work first: totals, the groups, the log; the one-time setup (the site's look) last. -->
	<section class="form-panel" aria-labelledby="totals-h">
		<div class="form-head"><div><h2 id="totals-h">Totals</h2></div></div>
		<div class="form-block">{@render totalsList()}</div>
	</section>
	<section class="form-panel" aria-labelledby="groups-h">
		<div class="form-head">
			<div><h2 id="groups-h">Groups <span class="muted num">{data.groups.length}</span></h2><p>Suspend a group to make it read-only, make its owner a sign-in code, or delete a suspended group. Each needs a reason.</p></div>
			{@render groupTools()}
		</div>
		<div class="form-block">{@render groupList()}</div>
	</section>
	<section class="form-panel" aria-labelledby="log-h">
		<div class="form-head"><div><h2 id="log-h">Admin log</h2></div></div>
		<div class="form-block">{@render adminLog()}</div>
	</section>
	{@render lookPanel()}
</div>

<style>
	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
		gap: var(--s-3);
	}
	.swatch {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 650;
		font-size: var(--t-small);
	}
	.swatch-inputs {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.hex {
		width: 7.5rem;
		min-height: 44px;
		font-size: var(--t-small);
		text-transform: lowercase;
	}
	.hex[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.swatch input[type='color'] {
		flex: none;
		width: 44px;
		height: 44px;
		padding: 2px;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--cube);
		cursor: pointer;
	}
	.check {
		display: flex;
		align-items: flex-start;
		gap: var(--s-2);
	}
	.check input {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
		margin-top: 2px;
	}
	.admin {
		display: grid;
		gap: var(--s-5);
		max-width: 60rem;
		padding: var(--s-5) 0 var(--s-6);
	}
	.form-head .tools {
		align-self: end;
	}
	.form-block .totals {
		margin: 0;
	}
	/* A definite width, so auto-fill counts columns from the space there is rather than from the
	   36rem maximum (which put three 168px columns in a 324px row on phones). */
	.look-panel .swatches {
		width: 100%;
		max-width: 36rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
	}
	/* Inside a panel the hex box gives way, so a swatch never runs past its column. */
	.look-panel .swatch {
		min-width: 0;
	}
	.look-panel .hex {
		width: 100%;
		flex: 1 1 0;
		min-width: 0;
	}
	.look-panel #logo-url {
		max-width: 28rem;
	}
	.look-panel .form-foot :global(.inline) {
		display: flex;
		gap: var(--s-2);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.head h1 {
		margin: 0;
	}
	.intro {
		margin: calc(-1 * var(--s-3)) 0 0;
		max-width: 68ch;
	}
	/* Which release this is, tucked under the intro. */
	.version {
		margin: calc(-1 * var(--s-4)) 0 0;
		font-size: var(--t-small);
	}
	.banner {
		margin: 0;
	}
	h2 {
		margin-bottom: var(--s-3);
	}
	h2 .num {
		font-weight: 600;
		margin-left: 4px;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr));
		gap: 2px;
		margin: 0;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.totals div {
		background: var(--cube);
		padding: var(--s-3);
	}
	.totals dt {
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.totals dd {
		margin: 2px 0 0;
		font-size: var(--t-h2);
		font-weight: 750;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--s-3);
		margin-bottom: var(--s-3);
	}
	.find {
		position: relative;
		flex: 1 1 14rem;
		max-width: 22rem;
	}
	.find :global(svg) {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--ink-2);
	}
	.find .field {
		padding-left: 40px;
	}
	.sort {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		font-weight: 650;
		font-size: var(--t-small);
	}
	.sort .field {
		width: auto;
		min-height: 40px;
	}
	.groups {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.groups > li {
		background: var(--cube);
	}
	.row,
	.manage > summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px var(--s-4);
		padding: var(--s-3);
		min-height: 56px;
	}
	.manage > summary {
		cursor: pointer;
		list-style: none;
	}
	.manage > summary::-webkit-details-marker {
		display: none;
	}
	.g-name {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s-2);
		flex: 1 1 0;
		min-width: 0;
	}
	.g-name strong {
		overflow-wrap: anywhere;
	}
	.g-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 2px var(--s-3);
		font-size: var(--t-small);
		color: var(--ink-2);
		order: 2;
		flex-basis: 100%;
	}
	.tag.suspended {
		background: var(--danger-soft);
		color: var(--ink);
	}
	.manage-label {
		order: 1;
		margin-left: auto;
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.manage > summary:hover .manage-label {
		color: var(--ink);
	}
	.manage-label :global(svg) {
		transition: transform 0.2s var(--ease-out);
	}
	.manage[open] .manage-label :global(svg) {
		transform: rotate(180deg);
	}
	/* A group's Manage, as a member's on the Group tab: labelled rows, the irreversible one in a ruled
	   foot, and the open confirmation in a well under them. */
	.actions {
		display: grid;
		gap: var(--s-3);
		padding: var(--s-1) var(--s-3) var(--s-4);
	}
	.actions p {
		margin: 0;
	}
	.arow {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		align-items: center;
		gap: var(--s-1) var(--s-3);
	}
	.alabel {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.abody {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-4);
		min-width: 0;
	}
	.abody .link-button,
	.afoot .link-button {
		min-height: 36px;
		font-weight: 650;
	}
	.afoot {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-5);
		padding-top: var(--s-2);
		border-top: 1px solid var(--gap);
	}
	.afoot .hint {
		padding: 8px 0;
	}
	.danger-link {
		color: var(--danger);
	}
	.well {
		display: grid;
		gap: var(--s-3);
		max-width: 40rem;
		padding: var(--s-3) var(--s-4);
		background: var(--laminate);
		border-radius: var(--r-ctl);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.well label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 650;
	}
	.wbtns {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.code-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.btn.danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (max-width: 559px) {
		.arow {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	textarea.field {
		padding: var(--s-2) var(--s-3);
		min-height: 64px;
		resize: vertical;
		font: inherit;
	}
	/* A fresh code for a group's owner, set like the one on the Group tab. */
	.owner-code .code {
		font-size: var(--t-h2);
		font-weight: 800;
		letter-spacing: 0.14em;
	}
	.btn.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
	.btn.danger:hover {
		background: var(--danger-soft);
	}
	.none {
		padding: var(--s-3);
	}
	.log {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		max-width: 68ch;
	}
	.log li {
		display: flex;
		gap: var(--s-3);
		align-items: baseline;
	}
	.log li > .num {
		flex: none;
		font-size: var(--t-small);
	}
	/* From 960px the rows line up as columns: name, members, copies, activity, created, Manage. */
	@media (min-width: 960px) {
		.row,
		.manage > summary {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 33rem 5.5rem;
			gap: var(--s-4);
		}
		.g-meta {
			order: 0;
			display: grid;
			grid-template-columns: 6.5rem 6.5rem 9rem 8.5rem;
			gap: var(--s-3);
			white-space: nowrap;
		}
		.manage-label {
			order: 0;
			justify-self: end;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.manage-label :global(svg) {
			transition: none;
		}
	}
</style>
