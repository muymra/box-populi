<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import InviteCard from '#lib/components/InviteCard.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { lastActive } from '#lib/time.ts';
	import { invalidateAll } from '$app/navigation';
	import { AUTO_THEME, CUSTOM_THEME, THEME_IDS, THEME_LABELS } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ROLE = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
	const inviteLink = $derived(data.code ? `${page.url.origin}/join/${data.code}` : null);
	let query = $state('');
	// The owner, and how long since they were last here, for the 60-day rule on archiving (D50).
	const owner = $derived(data.members.find((m) => m.role === 'owner') ?? null);
	const ownerDaysAgo = $derived(owner ? Math.floor((data.now - owner.lastSeenAt) / 86_400_000) : 0);
	const daysLeft = $derived(Math.max(1, data.ownerAwayDays - ownerDaysAgo));
	// Which Manage panels are open, kept here so an action's reload doesn't fold them shut.
	let openRows = $state<string[]>([]);
	function keepOpen(id: string, open: boolean) {
		if (open !== openRows.includes(id)) openRows = open ? [...openRows, id] : openRows.filter((r) => r !== id);
	}
	// The one confirmation open in the members list: whose, and for what.
	type Confirm = 'role' | 'owner' | 'code' | 'merge' | 'remove';
	let confirmFor = $state<{ id: string; kind: Confirm } | null>(null);
	// What's typed to confirm a new owner; cleared whenever another confirmation opens.
	let ownerTyped = $state('');
	function toggle(id: string, kind: Confirm) {
		confirmFor = confirmFor?.id === id && confirmFor.kind === kind ? null : { id, kind };
		ownerTyped = '';
	}
	const closeAfter: SubmitFunction = () => async ({ update }) => {
		await update();
		confirmFor = null;
	};

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
	{#snippet newCode()}
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
	{/snippet}

	{#snippet memberList()}
		{#if data.members.length > 8}
			<label class="find">
				<Search size={18} aria-hidden="true" />
				<span class="visually-hidden">Find a member</span>
				<input class="field" type="search" placeholder="Find a member" bind:value={query} autocomplete="off" />
			</label>
		{/if}
		{#if form?.memberError}<p class="banner error" role="alert">{form.memberError}</p>{/if}
		{#if form?.merged}<p class="banner" role="status">Merged. The older entry is gone; everything it had is on the new one.</p>{/if}
		<ul class="members">
			{#each shown as m (m.id)}
				{@const c = playerColor(m.colorIndex)}
				{#snippet person()}
					<span class="cube-chip" style:background={c.fill} style:color={c.ink} aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
					<span class="who">
						<strong>{m.name}{#if m.isMe}<span class="muted">{' (you)'}</span>{/if}{#if m.noPin}{' '}<span class="tag">No PIN yet</span>{/if}</strong>
						<span class="muted">
							{ROLE[m.role]}{' · '}<span class="num">{m.games}</span> {m.games === 1 ? 'game' : 'games'}{' · '}{c.hatched ? 'striped ' : ''}{c.name.toLowerCase()}{' · '}<span class="nowrap">{lastActive(m.lastSeenAt, data.now)}</span>
						</span>
					</span>
				{/snippet}
				<li>
					{#if m.actions.length || m.tools.length}
						{@const roleChange = m.actions.includes('promote') || m.actions.includes('demote')}
						{@const codeHere = form?.signInCode?.userId === m.id ? form.signInCode : null}
						{@const mine = confirmFor?.id === m.id && !(confirmFor.kind === 'code' && codeHere) ? confirmFor.kind : null}
						<details class="manage" open={openRows.includes(m.id) || !!codeHere} ontoggle={(e) => keepOpen(m.id, e.currentTarget.open)}>
							<summary>
								{@render person()}
								<span class="manage-label">Manage <ChevronDown size={16} aria-hidden="true" /></span>
							</summary>
							<!-- One panel in three parts (Carlo's pick): the role, getting in, and the irreversible ones in the foot; one confirmation open at a time. -->
							<div class="manage-panel">
								<div class="prow">
									<span class="plabel" id="role-{m.id}">Role</span>
									<div class="pbody">
										{#if roleChange}
											<!-- The other segment asks first (Carlo: too easy to make someone a co-admin by accident). -->
											<div class="role-seg" role="group" aria-labelledby="role-{m.id}">
												{#each [['member', 'Member'], ['admin', 'Co-admin']] as const as [role, label] (role)}
													{#if m.role === role}
														<span class="seg on" aria-current="true">{label}</span>
													{:else}
														<button type="button" class="seg" aria-expanded={mine === 'role'} onclick={() => toggle(m.id, 'role')}
															>{label}<span class="visually-hidden">: make {m.name} {role === 'admin' ? 'a co-admin' : 'a regular member'}…</span></button
														>
													{/if}
												{/each}
											</div>
										{:else}
											<span>{ROLE[m.role]}</span>
										{/if}
										{#if m.actions.includes('transfer_ownership')}
											<button type="button" class="link-button" aria-expanded={mine === 'owner'} onclick={() => toggle(m.id, 'owner')}>Make owner…</button>
										{/if}
									</div>
								</div>
								<div class="prow">
									<span class="plabel">Getting in</span>
									<div class="pbody">
										{#if codeHere}
											<span class="sign-in-code num">{codeHere.code}</span>
											<span class="muted code-note">
												Works once, until {new Date(codeHere.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Give it to {m.name}
												yourself: at the group’s link they tap their name and choose “use a code from an admin”.
											</span>
										{:else}
											<span>{m.noPin ? 'No PIN yet.' : 'Has a PIN.'}</span>
											{#if m.tools.includes('sign_in_code')}
												<button type="button" class="btn small" aria-expanded={mine === 'code'} onclick={() => toggle(m.id, 'code')}>Make a sign-in code</button>
											{:else if m.helpNote === 'other_group'}
												<span class="muted">In another group too, so only {m.name} can change how they get in.</span>
											{:else if m.helpNote === 'role'}
												<span class="muted">Only the owner can help a co-admin back in.</span>
											{/if}
										{/if}
									</div>
								</div>
								{#if m.tools.includes('merge') || m.actions.includes('remove_member')}
									<div class="pfoot">
										{#if m.tools.includes('merge')}
											<button type="button" class="link-button" aria-expanded={mine === 'merge'} onclick={() => toggle(m.id, 'merge')}>Merge into another entry…</button>
										{/if}
										{#if m.actions.includes('remove_member')}
											<button type="button" class="link-button danger-link" aria-expanded={mine === 'remove'} onclick={() => toggle(m.id, 'remove')}>Remove from the group…</button>
										{/if}
									</div>
								{/if}
								{#if mine}
									<div class="confirm-well">
										{#if mine === 'role' && m.role === 'member'}
											<p>
												Make {m.name} a co-admin? Co-admins can rename the group, make a new join code, remove members, change any play or night, and help
												members back in. If you’re away for {data.ownerAwayDays} days, they can also archive or restore the group.
											</p>
											<div class="cbtns">
												<form method="POST" action="?/promote" use:enhance={closeAfter}>
													<input type="hidden" name="userId" value={m.id} />
													<button class="btn small">Make {m.name} a co-admin</button>
												</form>
												<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
											</div>
										{:else if mine === 'role'}
											<p>Make {m.name} a regular member? They’ll no longer be able to manage the group.</p>
											<div class="cbtns">
												<form method="POST" action="?/demote" use:enhance={closeAfter}>
													<input type="hidden" name="userId" value={m.id} />
													<button class="btn small">Make {m.name} a regular member</button>
												</form>
												<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
											</div>
										{:else if mine === 'owner'}
											<p>
												{m.name} becomes the owner: they can delete the group and hand it on again. You become a co-admin, and only {m.name} can make you the
												owner again.
											</p>
											<form method="POST" action="?/transfer" use:enhance={closeAfter} class="cbtns">
												<input type="hidden" name="userId" value={m.id} />
												<label class="into">
													<span>Type <strong>{m.name}</strong> to confirm</span>
													<input class="field" name="confirmName" required autocomplete="off" bind:value={ownerTyped} />
												</label>
												<button class="btn small" disabled={ownerTyped.replace(/\s+/g, ' ').trim().toLocaleLowerCase() !== m.name.toLocaleLowerCase()}>Make {m.name} the owner</button>
												<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
											</form>
										{:else if mine === 'code'}
											<p>
												For when {m.name} has lost their PIN and every device. The code works once, for 10 minutes, and signs in as {m.name}, so give it to
												them yourself.
											</p>
											<div class="cbtns">
												<form method="POST" action="?/signInCode" use:enhance={closeAfter}>
													<input type="hidden" name="userId" value={m.id} />
													<button class="btn small">Make the code</button>
												</form>
												<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
											</div>
										{:else if mine === 'merge'}
											{@const others = data.members
												.filter((o) => o.id !== m.id && !o.isMe)
												.sort((a, b) => Number(b.name === m.name) - Number(a.name === m.name) || b.joinedAt - a.joinedAt)}
											<p>
												If {m.name} joined again as someone new, this moves this entry’s games, plays, nights and wishlist to the new one and deletes this one.
												The new one keeps this entry’s colour.
											</p>
											<form method="POST" action="?/merge" use:enhance={closeAfter} class="cbtns">
												<input type="hidden" name="userId" value={m.id} />
												<label class="into">
													<span>Into</span>
													<select class="field" name="intoId" required>
														{#each others as o (o.id)}
															<option value={o.id}>{o.name}, joined {new Date(o.joinedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</option>
														{/each}
													</select>
												</label>
												<button class="btn small danger">Merge and delete this entry</button>
												<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
											</form>
										{:else if mine === 'remove'}
											<p>{m.name}’s games leave the shelf. They can rejoin with the code unless you make a new one.</p>
											<div class="cbtns">
												<form method="POST" action="?/remove" use:enhance={closeAfter}>
													<input type="hidden" name="userId" value={m.id} />
													<button class="btn small danger">Remove {m.name}</button>
												</form>
												<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
											</div>
										{/if}
									</div>
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
	{/snippet}

	{#snippet nameForm()}
		<form method="POST" action="?/rename" class="rename" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<label class="visually-hidden" for="group-name">Group name</label>
			<input id="group-name" class="field" name="name" required maxlength="60" value={data.group.name} />
			<button class="btn">Rename</button>
		</form>
		{#if form?.renameError}<p class="banner error" role="alert">{form.renameError}</p>{/if}
	{/snippet}
	{#snippet nightsForm()}
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
	{/snippet}
	{#snippet themeForm()}
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
					This device shows <strong>{THEME_LABELS[data.deviceTheme] ?? data.deviceTheme}</strong>, picked in the footer's Theme menu, so you won't see the group's
					theme here. Members on Automatic will.
				</p>
				<form method="POST" action="/theme" onsubmit={(e) => (e.preventDefault(), useGroupTheme())}>
					<input type="hidden" name="theme" value={AUTO_THEME} />
					<input type="hidden" name="returnTo" value="/g/{data.group.id}/group" />
					<button class="btn small">Use the group's theme on this device</button>
				</form>
			</div>
		{/if}
		{#if form?.themeError}<p class="banner error" role="alert">{form.themeError}</p>{/if}
	{/snippet}
	{#snippet deleteBlock()}
		<details class="confirm" open={!!form?.deleteError}>
			<summary class="link-button">Delete {data.group.name} for good…</summary>
			<form method="POST" action="?/delete" class="confirm-body delete" use:enhance>
				<p>This removes the group, its code and its links for everyone. Members keep their accounts and their games. It can’t be undone.</p>
				<label>
					<span>Type <strong>{data.group.name}</strong> to confirm</span>
					<input class="field" name="confirmName" required autocomplete="off" />
				</label>
				{#if form?.deleteError}<p class="banner error" role="alert">{form.deleteError}</p>{/if}
				<button class="btn small danger">Delete the group</button>
			</form>
		</details>
	{/snippet}

	<!-- The settings as form-panel rows, every question above its controls in the narrow column. -->
	{#snippet settingsRows()}
		<div class="form-row">
			<div class="form-label"><label class="form-q" for="group-name">Name</label></div>
			<div class="form-body">{@render nameForm()}</div>
		</div>
		<div class="form-row">
			<div class="form-label">
				<label class="form-q" for="nights-by">Game nights</label>
				<span class="hint">Who can plan one. Everyone can still answer and bring games.</span>
			</div>
			<div class="form-body">{@render nightsForm()}</div>
		</div>
		<div class="form-row">
			<div class="form-label">
				<label class="form-q" for="group-theme">Theme</label>
				<span class="hint">What everyone sees here, unless they picked their own in the footer.</span>
			</div>
			<div class="form-body">{@render themeForm()}</div>
		</div>
		{#if data.archiveWaits}
			<div class="form-row">
				<div class="form-label">
					<span class="form-q">Archive</span>
					<span class="hint">
						The owner archives the group. A co-admin can too once the owner hasn’t been here for {data.ownerAwayDays} days.
						{#if owner}{owner.name} was here {ownerDaysAgo === 0 ? 'today' : ownerDaysAgo === 1 ? 'yesterday' : `${ownerDaysAgo} days ago`}, so that’s in {daysLeft}
							{daysLeft === 1 ? 'day' : 'days'} if they stay away.{/if}
					</span>
				</div>
			</div>
		{:else if data.canArchive}
			<div class="form-row">
				<div class="form-label">
					<span class="form-q">Archive</span>
					<span class="hint">
						Stop using it and keep its history. Only the owner can delete it, once it’s archived.
						{#if data.ownerIsAway && owner}
							You can archive it because {owner.name}, the owner, hasn’t been here for {data.ownerAwayDays} days.
						{:else}
							If you’re away for {data.ownerAwayDays} days, a co-admin can archive or restore it too.
						{/if}
					</span>
				</div>
				<div class="form-body">
					<details class="confirm" open={!!form?.archiveError}>
						<summary class="link-button">Archive {data.group.name}…</summary>
						<div class="confirm-body">
							<p>
								{data.group.name} becomes read-only for everyone: its shelf, plays and nights stay to look back on, nothing can change, and its join link
								closes. It moves to Archived in everyone’s list of groups. Restore it any time.
							</p>
							<form method="POST" action="?/archive" use:enhance>
								<button class="btn small">Archive {data.group.name}</button>
							</form>
							{#if form?.archiveError}<p class="banner error" role="alert">{form.archiveError}</p>{/if}
						</div>
					</details>
				</div>
			</div>
		{/if}
	{/snippet}

	<!-- From 900px: the invite and the settings in a left column, the people filling the right. On phones: invite, people, settings. -->
	<div class="two">
		{#if data.code && inviteLink}
			<div class="invite-slot">
				<InviteCard code={data.code} link={inviteLink}>
					{#if data.canManage}{@render newCode()}{/if}
				</InviteCard>
			</div>
		{/if}
		<section class="people" aria-labelledby="members-h">
			<h2 id="members-h">Members <span class="muted num">{data.members.length}</span></h2>
			<p class="muted">Each person’s colour runs along the bottom of the cubes holding their games. Most recently active first.</p>
			{@render memberList()}
		</section>
		{#if data.canManage}
			<section class="form-panel side-settings" aria-labelledby="settings-h">
				<div class="form-head"><div><h2 id="settings-h">Settings</h2></div></div>
				{@render settingsRows()}
			</section>
		{:else if data.restoreWaits}
			<section class="form-panel side-settings" aria-labelledby="closed-h">
				<div class="form-head">
					<div>
						<h2 id="closed-h">Archived</h2>
						<p>
							{owner ? `${owner.name}, the owner,` : 'The owner'} restores or deletes it. A co-admin can restore it once the owner hasn’t been here for
							{data.ownerAwayDays} days{#if owner}: that’s in {daysLeft} {daysLeft === 1 ? 'day' : 'days'} if they stay away{/if}.
						</p>
					</div>
				</div>
			</section>
		{:else if data.canRestore || data.canDelete}
			<!-- An archived (or host-suspended) group: bring it back, or delete it for good (D50). -->
			<section class="form-panel side-settings" aria-labelledby="closed-h">
				<div class="form-head">
					<div>
						<h2 id="closed-h">{data.group.archived ? 'Archived' : 'Suspended by the host'}</h2>
						<p>
							{#if data.group.archived && data.group.archivedAt}
								Read-only since {new Date(data.group.archivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Its join link is closed.
							{:else}
								Read-only, and its join link is closed.
							{/if}
						</p>
					</div>
				</div>
				{#if data.canRestore}
					<div class="form-row">
						<div class="form-label">
							<span class="form-q">Restore</span>
							<span class="hint">
								Back into use, with the same join code.{#if data.ownerIsAway && owner}{' '}You can, as {owner.name}, the owner, hasn’t been here for {data.ownerAwayDays}
									days.{/if}
							</span>
						</div>
						<div class="form-body">
							<form method="POST" action="?/restore" use:enhance>
								<button class="btn small">Restore {data.group.name}</button>
							</form>
							{#if form?.archiveError}<p class="banner error" role="alert">{form.archiveError}</p>{/if}
						</div>
					</div>
				{/if}
				{#if data.canDelete}
					<div class="form-row danger-row">
						<div class="form-label">
							<span class="form-q">Delete for good</span>
							<span class="hint">For everyone. Members keep their games.</span>
						</div>
						<div class="form-body">{@render deleteBlock()}</div>
					</div>
				{/if}
			</section>
		{/if}
	</div>
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
		max-width: 46rem;
		padding-top: var(--s-3);
	}
	.danger-row .btn.danger {
		justify-self: start;
	}
	/* Invite and settings on the left, the people on the right, from 900px. */
	.two {
		display: grid;
		gap: var(--s-5);
		grid-template-columns: minmax(0, 1fr);
	}
	@media (min-width: 900px) {
		.group-page {
			max-width: 76rem;
		}
		.two {
			grid-template-columns: 22rem minmax(0, 1fr);
			grid-template-areas: 'invite people' 'settings people';
			/* The members column's extra height goes to the second row, so opening Manage never moves the settings. */
			grid-template-rows: auto 1fr;
			align-items: start;
			column-gap: var(--s-6);
		}
		.invite-slot {
			grid-area: invite;
		}
		.people {
			grid-area: people;
			grid-row: 1 / span 2;
		}
		.side-settings {
			grid-area: settings;
		}
	}
	/* The settings in the narrow column: every question above its controls. */
	.side-settings .form-row {
		grid-template-columns: minmax(0, 1fr);
		gap: var(--s-3);
	}
	.side-settings .form-label {
		padding-top: 0;
	}
	.people h2 {
		margin-bottom: var(--s-2);
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
	/* The Manage panel: Role and Getting in as labelled rows, the irreversible ones in a ruled foot, and
	   the one open confirmation in a well under them. Lined up with the name, not the colour square. */
	.manage-panel {
		display: grid;
		gap: var(--s-3);
		padding: var(--s-1) var(--s-3) var(--s-4) calc(34px + 2 * var(--s-3));
	}
	.prow {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		align-items: center;
		gap: var(--s-1) var(--s-3);
	}
	.plabel {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.pbody {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-4);
		min-width: 0;
	}
	.pbody .link-button,
	.pfoot .link-button {
		min-height: 36px;
		font-weight: 650;
	}
	/* Role as segments, as elsewhere: the current one sits on the cube; the other is the button that changes it. */
	.role-seg {
		display: inline-flex;
		gap: 4px;
		padding: 4px;
		background: var(--gap);
		border-radius: calc(var(--r-ctl) + 4px);
	}
	.seg {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--t-small);
		font-weight: 650;
		cursor: pointer;
	}
	.seg:hover {
		color: var(--ink);
	}
	.seg.on {
		background: var(--cube);
		color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--rule);
		cursor: default;
	}
	.code-note {
		flex-basis: 100%;
		max-width: 38rem;
		font-size: var(--t-small);
	}
	.pfoot {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-5);
		padding-top: var(--s-2);
		border-top: 1px solid var(--gap);
	}
	.danger-link {
		color: var(--danger);
	}
	.confirm-well {
		display: grid;
		gap: var(--s-3);
		max-width: 40rem;
		padding: var(--s-3) var(--s-4);
		background: var(--laminate);
		border-radius: var(--r-ctl);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.confirm-well p {
		margin: 0;
	}
	.cbtns {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--s-2) var(--s-3);
	}
	.into {
		display: grid;
		gap: 4px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.into .field {
		min-width: 15rem;
	}
	@media (max-width: 559px) {
		.manage-panel {
			padding-left: var(--s-3);
		}
		.prow {
			grid-template-columns: minmax(0, 1fr);
		}
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
	.sign-in-code {
		margin: 0;
		font-size: var(--t-h2);
		font-weight: 800;
		letter-spacing: 0.14em;
	}
</style>
