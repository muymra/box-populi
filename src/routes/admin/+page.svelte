<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { lastActive } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
	const ACTION_LABELS: Record<string, string> = { suspend_group: 'Suspended', unsuspend_group: 'Unsuspended', delete_group: 'Deleted' };

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
	<header class="head">
		<h1>Instance admin</h1>
		<form method="POST" action="?/signOut"><button class="btn small">Sign out of admin</button></form>
	</header>
	<p class="muted intro">
		Counts and group names only. This page never shows who is in a group, their games or the join codes, and every action
		below is logged.
	</p>

	{#if data.bggMode === 'off'}
		<p class="banner">BoardGameGeek search and import aren’t set up here (<code>BGG_MODE=off</code>). Groups add games by hand.</p>
	{/if}
	{#if data.groupCreation === 'admins'}
		<p class="banner">
			Only you can create groups (<code>GROUP_CREATION=admins</code>). <a href="/groups/new">Create a group</a>
		</p>
	{/if}

	<section aria-labelledby="totals-h">
		<h2 id="totals-h">Totals</h2>
		<dl class="totals">
			{#each TOTALS as [key, label] (key)}
				<div>
					<dt>{label}</dt>
					<dd class="num">{data.totals[key].toLocaleString('en')}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section aria-labelledby="groups-h">
		<h2 id="groups-h">Groups <span class="muted num">{data.groups.length}</span></h2>
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

		{#if data.groups.length === 0}
			<p class="muted">No groups yet.</p>
		{:else}
			<ul class="groups">
				{#each shown as g (g.id)}
					{@const failed = form?.groupId === g.id ? form.error : null}
					{#snippet summary()}
						<span class="g-name">
							<strong>{g.name}</strong>
							{#if g.isDemo}<span class="tag">Demo</span>{/if}
							{#if g.suspendedAt}<span class="tag suspended">Suspended</span>{/if}
						</span>
						<span class="g-meta">
							<span><span class="num">{g.members}</span> {g.members === 1 ? 'member' : 'members'}</span>
							<span><span class="num">{g.copies.toLocaleString('en')}</span> {g.copies === 1 ? 'copy' : 'copies'}</span>
							<span>{g.lastActive ? lastActive(g.lastActive, data.now) : 'never active'}</span>
							<span>created <span class="num">{day(g.createdAt)}</span></span>
						</span>
					{/snippet}
					<li>
						{#if g.isDemo}
							<div class="row">{@render summary()}</div>
						{:else}
							<details class="manage" open={failed != null}>
								<summary>
									{@render summary()}
									<span class="manage-label">Manage <ChevronDown size={16} aria-hidden="true" /></span>
								</summary>
								<div class="actions">
									{#if failed}<p class="banner error" role="alert">{failed}</p>{/if}
									{#if g.suspendedAt}
										<p>Suspended on <span class="num">{day(g.suspendedAt)}</span>: {g.suspendedReason}</p>
										<form method="POST" action="?/unsuspend" class="act" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<label>Reason for lifting it <textarea class="field" name="reason" required minlength="3" maxlength="500" rows="2"></textarea></label>
											<button class="btn small">Unsuspend</button>
										</form>
									{:else}
										<form method="POST" action="?/suspend" class="act" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<label>
												Reason
												<span class="hint">Members see it on a read-only banner, with your contact address.</span>
												<textarea class="field" name="reason" required minlength="3" maxlength="500" rows="2"></textarea>
											</label>
											<button class="btn small">Suspend the group</button>
										</form>
									{/if}
									<details class="confirm">
										<summary class="link-button">Delete this group…</summary>
										<form method="POST" action="?/delete" class="act" use:enhance>
											<input type="hidden" name="groupId" value={g.id} />
											<p>Removes the group, its code and its links. Members keep their accounts and their games. It can’t be undone.</p>
											<label>Reason <textarea class="field" name="reason" required minlength="3" maxlength="500" rows="2"></textarea></label>
											<label>
												<span>Type <strong>{g.name}</strong> to confirm</span>
												<input class="field" name="confirmName" required autocomplete="off" />
											</label>
											<button class="btn small danger">Delete the group</button>
										</form>
									</details>
								</div>
							</details>
						{/if}
					</li>
				{:else}
					<li class="muted none">No group by that name.</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="log-h">
		<h2 id="log-h">Admin log</h2>
		{#if data.log.length === 0}
			<p class="muted">Nothing yet. Suspensions and deletions appear here with their reasons.</p>
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
	</section>
</div>

<style>
	.admin {
		display: grid;
		gap: var(--s-5);
		max-width: 60rem;
		padding: var(--s-5) 0 var(--s-6);
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
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: 0 var(--s-3) var(--s-4);
		max-width: 36rem;
	}
	.actions p {
		margin: 0;
	}
	.act {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
	}
	.act label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-self: stretch;
		font-weight: 650;
	}
	textarea.field {
		padding: var(--s-2) var(--s-3);
		min-height: 64px;
		resize: vertical;
		font: inherit;
	}
	.confirm summary {
		display: inline-block;
		min-height: 44px;
		line-height: 44px;
		font-weight: 650;
		list-style: none;
	}
	.confirm summary::-webkit-details-marker {
		display: none;
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
