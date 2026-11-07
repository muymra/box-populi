<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { lastActive } from '#lib/time.ts';
	import { invalidateAll } from '$app/navigation';
	import { AUTO_THEME, CUSTOM_THEME, THEME_IDS, THEME_LABELS } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ROLE = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
	const inviteLink = $derived(data.code ? `${page.url.origin}/join/${data.code}` : null);

	let query = $state('');

	// A theme picked by name in the footer overrides the group's theme on this device.
	const deviceOverrides = $derived(data.deviceTheme !== AUTO_THEME);
	async function useGroupTheme() {
		const body = new FormData();
		body.set('theme', AUTO_THEME);
		await fetch('/theme', { method: 'POST', body, headers: { accept: 'application/json' } });
		await invalidateAll();
	}
	const shown = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase();
		return q ? data.members.filter((m) => m.name.toLocaleLowerCase().includes(q)) : data.members;
	});
</script>

<div class="group-page">
	{#if data.code && inviteLink}
		<section class="invite panel" aria-labelledby="invite-h">
			<h2 id="invite-h">Invite people</h2>
			<p class="muted">Anyone with the code can join with just a name.</p>
			<div class="code num" aria-label="Join code {data.code.split('').join(' ')}">{data.code}</div>
			<p class="link">{inviteLink}</p>
			<CopyButton text={inviteLink} label="Copy invite link" />
			{#if data.canManage}
				<details class="confirm">
					<summary class="link-button">Make a new code…</summary>
					<div class="confirm-body">
						<p>The current code and invite link stop working. Everyone already in the group stays. Do this after removing someone who shouldn’t come back.</p>
						<form method="POST" action="?/newCode" use:enhance>
							<button class="btn small">Make a new code</button>
						</form>
					</div>
				</details>
				{#if form?.codeChanged}<p class="banner" role="status">New code made. The old one no longer works.</p>{/if}
				{#if form?.codeError}<p class="banner error" role="alert">{form.codeError}</p>{/if}
			{/if}
		</section>
	{/if}

	<section aria-labelledby="members-h">
		<h2 id="members-h">Members <span class="muted num">{data.members.length}</span></h2>
		<p class="muted">Each person’s colour runs along the bottom of the cubes holding their games. Most recently active first.</p>
		{#if data.members.length > 8}
			<label class="find">
				<Search size={18} aria-hidden="true" />
				<span class="visually-hidden">Find a member</span>
				<input class="field" type="search" placeholder="Find a member" bind:value={query} autocomplete="off" />
			</label>
		{/if}
		{#if form?.memberError}<p class="banner error" role="alert">{form.memberError}</p>{/if}

		<ul class="members">
			{#each shown as m (m.id)}
				{@const c = playerColor(m.colorIndex)}
				{#snippet person()}
					<span class="cube-chip" style:background={c.bg} style:color={c.ink} aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
					<span class="who">
						<strong>{m.name}{#if m.isMe}<span class="muted">{' (you)'}</span>{/if}</strong>
						<span class="muted">
							{ROLE[m.role]}{' · '}<span class="num">{m.games}</span> {m.games === 1 ? 'game' : 'games'}{' · '}{c.name.toLowerCase()}{' · '}<span class="nowrap">{lastActive(m.lastSeenAt, data.now)}</span>
						</span>
					</span>
				{/snippet}
				<li>
					{#if m.actions.length}
						<details class="manage">
							<summary>
								{@render person()}
								<span class="manage-label">Manage <ChevronDown size={16} aria-hidden="true" /></span>
							</summary>
							<div class="actions">
								{#if m.actions.includes('promote')}
									<form method="POST" action="?/promote" use:enhance>
										<input type="hidden" name="userId" value={m.id} />
										<button class="btn small">Make co-admin</button>
									</form>
								{/if}
								{#if m.actions.includes('demote')}
									<form method="POST" action="?/demote" use:enhance>
										<input type="hidden" name="userId" value={m.id} />
										<button class="btn small">Make a regular member</button>
									</form>
								{/if}
								{#if m.actions.includes('transfer_ownership')}
									<details class="confirm">
										<summary class="link-button">Hand over ownership…</summary>
										<div class="confirm-body">
											<p>{m.name} becomes the owner and can delete the group. You become a co-admin.</p>
											<form method="POST" action="?/transfer" use:enhance>
												<input type="hidden" name="userId" value={m.id} />
												<button class="btn small">Make {m.name} the owner</button>
											</form>
										</div>
									</details>
								{/if}
								{#if m.actions.includes('remove_member')}
									<details class="confirm">
										<summary class="link-button">Remove from the group…</summary>
										<div class="confirm-body">
											<p>{m.name}’s games leave the shelf. They can rejoin with the code unless you make a new one.</p>
											<form method="POST" action="?/remove" use:enhance>
												<input type="hidden" name="userId" value={m.id} />
												<button class="btn small danger">Remove {m.name}</button>
											</form>
										</div>
									</details>
								{/if}
							</div>
						</details>
					{:else}
						<div class="row">{@render person()}</div>
					{/if}
				</li>
			{:else}
				<li class="muted none">Nobody by that name.</li>
			{/each}
		</ul>
		{#if data.role}
			<p class="muted small">To leave this group, go to <a href="/me">your account</a>.</p>
		{/if}
	</section>

	{#if data.canManage}
		<section aria-labelledby="name-h">
			<h2 id="name-h">Group name</h2>
			<form method="POST" action="?/rename" class="rename" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<label class="visually-hidden" for="group-name">Group name</label>
				<input id="group-name" class="field" name="name" required maxlength="60" value={data.group.name} />
				<button class="btn">Rename</button>
			</form>
			{#if form?.renameError}<p class="banner error" role="alert">{form.renameError}</p>{/if}
		</section>

		<section aria-labelledby="nights-by-h">
			<h2 id="nights-by-h">Game nights</h2>
			<p class="muted">Who can plan a night. Everyone can still say whether they're going and what they'll bring.</p>
			<form method="POST" action="?/nightsBy" class="rename" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<label class="visually-hidden" for="nights-by">Who can plan game nights</label>
				<select id="nights-by" class="field" name="nightsBy" value={data.nightsBy}>
					<option value="members">Any member</option>
					<option value="admins">Only the owner and co-admins</option>
				</select>
				<button class="btn">Save</button>
			</form>
			{#if form?.nightsBySaved}<p class="muted small" role="status">Saved.</p>{/if}
			{#if form?.nightsByError}<p class="banner error" role="alert">{form.nightsByError}</p>{/if}
		</section>

		<section aria-labelledby="theme-h">
			<h2 id="theme-h">Group theme</h2>
			<p class="muted">Colours everyone sees on this group's pages, unless they've picked their own theme in the footer.</p>
			<form method="POST" action="?/theme" class="rename" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<label class="visually-hidden" for="group-theme">Group theme</label>
				<select id="group-theme" class="field" name="theme" value={data.groupTheme ?? ''}>
					<option value="">This site's default</option>
					{#if data.customTheme != null}<option value={CUSTOM_THEME}>{THEME_LABELS[CUSTOM_THEME]}</option>{/if}
					{#each THEME_IDS as id (id)}<option value={id}>{THEME_LABELS[id]}</option>{/each}
				</select>
				<button class="btn">Save</button>
			</form>
			{#if form?.themeSaved}<p class="muted small" role="status">Saved.</p>{/if}
			{#if deviceOverrides}
				<div class="banner override">
					<p>
						This device shows <strong>{THEME_LABELS[data.deviceTheme] ?? data.deviceTheme}</strong>, picked in the footer's
						Theme menu, so you won't see the group's theme here. Members on Automatic will.
					</p>
					<form method="POST" action="/theme" onsubmit={(e) => (e.preventDefault(), useGroupTheme())}>
						<input type="hidden" name="theme" value={AUTO_THEME} />
						<input type="hidden" name="returnTo" value="/g/{data.group.id}/group" />
						<button class="btn small">Use the group's theme on this device</button>
					</form>
				</div>
			{/if}
			{#if form?.themeError}<p class="banner error" role="alert">{form.themeError}</p>{/if}
		</section>
	{/if}

	{#if data.canDelete}
		<section aria-labelledby="delete-h">
			<h2 id="delete-h">Delete the group</h2>
			<details class="confirm" open={!!form?.deleteError}>
				<summary class="link-button">Delete {data.group.name}…</summary>
				<form method="POST" action="?/delete" class="confirm-body delete" use:enhance>
					<p>
						This removes the group, its code and its links for everyone. Members keep their accounts and their games. It can’t be undone.
					</p>
					<label>
						<span>Type <strong>{data.group.name}</strong> to confirm</span>
						<input class="field" name="confirmName" required autocomplete="off" />
					</label>
					{#if form?.deleteError}<p class="banner error" role="alert">{form.deleteError}</p>{/if}
					<button class="btn small danger">Delete the group</button>
				</form>
			</details>
		</section>
	{/if}
</div>

<style>
	.override {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-2);
		margin-top: var(--s-3);
	}
	.override p {
		margin: 0;
	}
	.group-page {
		display: grid;
		gap: var(--s-6);
		max-width: 46rem;
		padding-top: var(--s-3);
	}
	.code {
		font-size: clamp(2rem, 6vw, 3.25rem);
		font-weight: 800;
		letter-spacing: 0.22em;
		margin: var(--s-2) 0 var(--s-1);
	}
	.link {
		font-size: var(--t-small);
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}
	.invite .confirm {
		margin-top: var(--s-4);
	}
	h2 .num {
		font-weight: 600;
		margin-left: 4px;
	}
	.find {
		position: relative;
		display: block;
		max-width: 22rem;
		margin-top: var(--s-4);
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
	.members {
		list-style: none;
		margin: var(--s-4) 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.members li {
		background: var(--cube);
	}
	.row,
	.manage > summary {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-3);
		min-height: 56px;
	}
	.manage > summary {
		cursor: pointer;
		list-style: none;
	}
	.manage > summary::-webkit-details-marker {
		display: none;
	}
	.manage > summary:hover .manage-label {
		color: var(--ink);
	}
	.manage-label {
		margin-left: auto;
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
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
		align-items: flex-start;
		gap: var(--s-1);
		padding: var(--s-1) var(--s-3) var(--s-4) calc(34px + 2 * var(--s-3));
	}
	.cube-chip {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 4px;
		display: grid;
		place-items: center;
		font-weight: 800;
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-size: var(--t-small);
	}
	.who strong {
		font-size: var(--t-body);
	}
	.nowrap {
		white-space: nowrap;
	}
	.none {
		padding: var(--s-3);
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
	.confirm-body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
		max-width: 34rem;
	}
	.confirm-body p {
		margin: 0;
	}
	.delete label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-self: stretch;
		font-weight: 650;
	}
	.rename {
		display: flex;
		gap: var(--s-2);
		max-width: 30rem;
		margin-top: var(--s-3);
	}
	.btn.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
	.btn.danger:hover {
		background: var(--danger-soft);
	}
	.small {
		font-size: var(--t-small);
	}
	@media (prefers-reduced-motion: reduce) {
		.manage-label :global(svg) {
			transition: none;
		}
	}
</style>
