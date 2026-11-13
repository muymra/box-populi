<script lang="ts">
	import { profileHref } from '#lib/profiles.svelte.ts';
	import { MAX_SUSPENDED_NOTE } from '#lib/standing.ts';
	import { announce } from '#lib/announce.svelte.ts';
	import GuestPlays from '#lib/components/GuestPlays.svelte';
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import InviteCard from '#lib/components/InviteCard.svelte';
	import SettingRow from '#lib/components/SettingRow.svelte';
	import GroupChatButton from '#lib/components/GroupChatButton.svelte';
	import { chatLink } from '#lib/group-chat.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { lastActive } from '#lib/time.ts';
	import { refreshAll } from '$app/navigation';
	import { AUTO_THEME, CUSTOM_THEME, THEME_IDS, THEME_LABELS } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ROLE = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
	const inviteLink = $derived(data.invite ? `${page.url.origin}/join/${data.invite}` : null);
	const chat = $derived(data.groupChat ? chatLink(data.groupChat) : null);
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
	type Confirm = 'role' | 'owner' | 'code' | 'merge' | 'guest' | 'remove' | 'suspend' | 'decline';
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
		await refreshAll();
	}
	// Someone waiting to be let in (D79) is listed apart, above the members.
	const waitingList = $derived(data.members.filter((m) => m.standing === 'waiting').sort((a, b) => (a.since ?? 0) - (b.since ?? 0)));
	const inGroup = $derived(data.members.filter((m) => m.standing !== 'waiting'));
	const shown = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase();
		return q ? inGroup.filter((m) => m.name.toLocaleLowerCase().includes(q)) : inGroup;
	});
	const sinceDay = (at: number | null) => (at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
	// New members (D79): turning probation off with people waiting lets them in, so the form says so first.
	let probationChoice = $state(untrack(() => (data.probationOn ? 'on' : 'off')));
	const letsIn = $derived(data.probationOn && probationChoice === 'off' ? waitingList.length : 0);
	// Deleting for good (D50): the button waits for the typed name once the page is running; without
	// JavaScript the server checks it.
	let deleteOpen = $state(false);
	$effect(() => {
		if (form?.deleteError) deleteOpen = true;
	});
	let deleteTyped = $state('');
	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	const sameName = (typed: string, name: string) => typed.replace(/\s+/g, ' ').trim().toLocaleLowerCase() === name.toLocaleLowerCase();
</script>

<svelte:head><title>Members and settings · {data.group.name}</title></svelte:head>

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
		{#if form?.codeChanged}<p class="banner" {@attach announce}>New code made. The old one no longer works.</p>{/if}
		{#if form?.codeError}<p class="banner error" role="alert">{form.codeError}</p>{/if}
	{/snippet}

	{#snippet waitingBlock()}
		<!-- New members waiting to be let in (D79): everyone sees who, the owner and co-admins let them in or decline. -->
		<section class="waiting" aria-labelledby="waiting-h">
			<h2 id="waiting-h">Waiting to be let in <span class="muted num">{waitingList.length}</span></h2>
			<p class="muted">They joined while new members wait to be let in. Until then they can add their games and look around.</p>
			<ul class="members">
				{#each waitingList as m (m.id)}
					{@const c = playerColor(m.colorIndex)}
					{@const mine = confirmFor?.id === m.id ? confirmFor.kind : null}
					<li>
						<div class="row">
							<span class="cube-chip" style:background={c.fill} style:color={c.ink} aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
							<span class="who">
								<strong><a class="profile-link" href={profileHref(m.id)}>{m.name}</a>{#if m.isMe}<span class="muted">{' (you)'}</span>{/if}</strong>
								<span class="muted">Joined {sinceDay(m.since)}{' · '}<span class="num">{m.games}</span> {m.games === 1 ? 'game' : 'games'}</span>
							</span>
							{#if m.actions.includes('let_in')}
								<div class="wait-actions">
									<form method="POST" action="?/letIn" use:enhance={closeAfter}>
										<input type="hidden" name="userId" value={m.id} />
										<button class="btn small">Let in</button>
									</form>
									<button type="button" class="link-button" aria-expanded={mine === 'decline'} onclick={() => toggle(m.id, 'decline')}>Decline…</button>
								</div>
							{/if}
						</div>
						{#if mine === 'decline'}
							<div class="confirm-well decline">
								<p>{m.name} leaves the group and their games come off the shelf. They can ask again with the code unless you make a new one.</p>
								<div class="cbtns">
									<form method="POST" action="?/remove" use:enhance={closeAfter}>
										<input type="hidden" name="userId" value={m.id} />
										<button class="btn small danger">Decline {m.name}</button>
									</form>
									<button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/snippet}

	{#snippet memberList()}
		{#if inGroup.length > 8}
			<label class="find">
				<Search size={18} aria-hidden="true" />
				<span class="visually-hidden">Find a member</span>
				<input class="field" type="search" placeholder="Find a member" bind:value={query} autocomplete="off" />
			</label>
		{/if}
		{#if form?.memberError}<p class="banner error" role="alert">{form.memberError}</p>{/if}
		{#if form?.merged}<p class="banner" {@attach announce}>Merged. The older entry is gone; everything it had is on the new one.</p>{/if}
		{#if form?.guestLinked}
			{@const g = form.guestLinked}
			<p class="banner" {@attach announce}>
				{g.plays} {g.plays === 1 ? 'play' : 'plays'} and {g.nights} {g.nights === 1 ? 'night' : 'nights'} now count for {g.name}.
				{#if g.skipped.length}Skipped, since {g.name} or another of those names was already in them: {g.skipped.map((s) => `${s.label} (${s.on})`).join(', ')}.{/if}
			</p>
		{/if}
		<ul class="members">
			{#each shown as m (m.id)}
				{@const c = playerColor(m.colorIndex)}
				{#snippet person()}
					<span class="cube-chip" style:background={c.fill} style:color={c.ink} aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
					<span class="who">
						<strong
							><a class="profile-link" href={profileHref(m.id)}>{m.name}</a>{#if m.isMe}<span class="muted">{' (you)'}</span>{/if}{#if m.standing === 'suspended'}{' '}<span
									class="tag"
									title="Suspended {sinceDay(m.since)}">Suspended</span
								>{/if}{#if m.noPin}{' '}<span class="tag">No PIN yet</span>{/if}</strong
						>
						<span class="muted">
							{ROLE[m.role]}{' · '}<span class="num">{m.games}</span> {m.games === 1 ? 'game' : 'games'}{' · '}{c.pattern === 'solid' ? '' : `${c.pattern} `}{c.name.toLowerCase()}{' · '}<span class="nowrap">{lastActive(m.lastSeenAt, data.now)}</span>
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
												yourself: at the group’s link they tap their name and choose “use a sign-in code”.
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
								{#if m.tools.includes('merge') || m.canLinkGuests || m.actions.includes('remove_member') || m.actions.includes('suspend_member')}
									<div class="pfoot">
										<!-- Suspending (D79): a step before removing someone, undone with Reinstate. -->
										{#if m.actions.includes('suspend_member') && m.standing === 'suspended'}
											<form method="POST" action="?/reinstate" use:enhance={closeAfter}>
												<input type="hidden" name="userId" value={m.id} />
												<button class="btn small">Reinstate {m.name}</button>
											</form>
										{:else if m.actions.includes('suspend_member')}
											<button type="button" class="link-button" aria-expanded={mine === 'suspend'} onclick={() => toggle(m.id, 'suspend')}>Suspend…</button>
										{/if}
										{#if m.tools.includes('merge')}
											<button type="button" class="link-button" aria-expanded={mine === 'merge'} onclick={() => toggle(m.id, 'merge')}>Merge into another entry…</button>
										{/if}
										{#if m.canLinkGuests}
											<button type="button" class="link-button" aria-expanded={mine === 'guest'} onclick={() => toggle(m.id, 'guest')}>Plays as a guest…</button>
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
												members back in. If you’re away for {data.ownerAwayDays} days, they can also archive or restore the group, or take over as owner.
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
												.filter((o) => o.id !== m.id && !o.isMe && o.onlyHere)
												.sort((a, b) => Number(b.name === m.name) - Number(a.name === m.name) || b.joinedAt - a.joinedAt)}
											<p>
												If {m.name} joined again as someone new, this moves this entry’s games, plays, nights and wishlist to the new one and deletes this one.
												The new one keeps this entry’s colour.
											</p>
											{#if others.length === 0}
												<p class="muted">There’s no entry to merge into. The new entry has to be in this group only, since its games show in every group it’s in.</p>
												<div class="cbtns"><button type="button" class="link-button" onclick={() => (confirmFor = null)}>Cancel</button></div>
											{:else}
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
											{/if}
										{:else if mine === 'guest'}
											<GuestPlays member={m} guests={data.guests} onclose={() => (confirmFor = null)} done={closeAfter} />
										{:else if mine === 'suspend'}
											<p>
												{m.name} can still sign in and look around, but can’t change anything here: no plays, nights, loans or marks, and no shelf changes
												from this group. Their games stay on the shelf and their plays in the log. They see that you suspended them and when, with your note
												if you leave one. Reinstate them, or remove them, later.
											</p>
											<form method="POST" action="?/suspend" use:enhance={closeAfter} class="cbtns">
												<input type="hidden" name="userId" value={m.id} />
												<label class="into">
													<span>A note for {m.name} (optional)</span>
													<input class="field" name="note" maxlength={MAX_SUSPENDED_NOTE} autocomplete="off" />
												</label>
												<button class="btn small danger">Suspend {m.name}</button>
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
	{#snippet chatForm()}
		<form method="POST" action="?/chat" class="rename" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<label class="visually-hidden" for="group-chat">Link to the group chat</label>
			<input
				id="group-chat"
				class="field"
				name="chatUrl"
				inputmode="url"
				autocomplete="off"
				spellcheck="false"
				placeholder="https://chat.whatsapp.com/…"
				value={data.groupChat ?? ''}
			/>
			<button class="btn">Save</button>
		</form>
		{#if form?.chatSaved}<p class="muted small" {@attach announce}>Saved.</p>{/if}
		{#if form?.chatError}<p class="banner error" role="alert">{form.chatError}</p>{/if}
		<p class="hint">
			{#if chat}
				Members see it as “{chat.label}” here, beside Copy for the chat on game nights, and once on the shelf after they join. Empty the field to remove it.
			{:else}
				Members see it here, beside Copy for the chat on game nights, and once on the shelf after they join.
			{/if}
		</p>
	{/snippet}
	{#snippet probationForm()}
		<form id="probation-form" method="POST" action="?/probation" class="rename" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<label class="visually-hidden" for="probation">When new members can take part</label>
			<select id="probation" class="field" name="probation" bind:value={probationChoice}>
				<option value="off">Straight away</option>
				<option value="on">Once they’re let in</option>
			</select>
			{#if letsIn}
				<input type="hidden" name="letEveryoneIn" value="1" />
			{:else}
				<button class="btn">Save</button>
			{/if}
		</form>
		{#if letsIn}
			<!-- Turning probation off with people waiting lets them in (D79): said, then confirmed with its own button. -->
			<div class="banner probation-off">
				<p>
					{letsIn === 1 ? `${waitingList[0].name} is waiting. Turning this off lets them in now, as a full member.` : `${letsIn} people are waiting. Turning this off lets them all in now, as full members.`}
				</p>
				<button class="btn small" form="probation-form">{letsIn === 1 ? `Let ${waitingList[0].name} in and turn it off` : `Let all ${letsIn} in and turn it off`}</button>
			</div>
		{/if}
		{#if form?.probationSaved}<p class="muted small" {@attach announce}>Saved.{form.letIn ? ` ${form.letIn === 1 ? 'One person' : `${form.letIn} people`} let in.` : ''}</p>{/if}
		{#if form?.probationError}<p class="banner error" role="alert">{form.probationError}</p>{/if}
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
		{#if form?.nightsBySaved}<p class="muted small" {@attach announce}>Saved.</p>{/if}
		{#if form?.nightsByError}<p class="banner error" role="alert">{form.nightsByError}</p>{/if}
	{/snippet}
	{#snippet fillerForm()}
		<form method="POST" action="?/filler" class="rename filler" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<label class="filler-field">
				<span>Up to</span>
				<input id="filler-minutes" class="field num" name="fillerMinutes" value={data.filler.maxMinutes} inputmode="numeric" autocomplete="off" />
				<span>minutes</span>
			</label>
			<label class="filler-field">
				<span>Complexity under</span>
				<input class="field num" name="fillerWeight" value={data.filler.maxWeight} inputmode="decimal" autocomplete="off" />
				<span>/ 5</span>
			</label>
			<button class="btn">Save</button>
		</form>
		{#if form?.fillerSaved}<p class="muted small" {@attach announce}>Saved.</p>{/if}
		{#if form?.fillerError}<p class="banner error" role="alert">{form.fillerError}</p>{/if}
	{/snippet}
	{#snippet staleForm()}
		<form method="POST" action="?/stale" class="rename filler" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<label class="filler-field">
				<span>The last</span>
				<input id="stale-days" class="field num" name="staleDays" value={data.staleDays} inputmode="numeric" autocomplete="off" />
				<span>days</span>
			</label>
			<button class="btn">Save</button>
		</form>
		{#if form?.staleSaved}<p class="muted small" {@attach announce}>Saved.</p>{/if}
		{#if form?.staleError}<p class="banner error" role="alert">{form.staleError}</p>{/if}
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
		{#if form?.themeSaved}<p class="muted small" {@attach announce}>Saved.</p>{/if}
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
		<details class="confirm" bind:open={deleteOpen}>
			<summary class="link-button danger-link">Delete {data.group.name} for good…</summary>
			<form method="POST" action="?/delete" class="confirm-body delete" use:enhance>
				<p>
					This removes {data.group.name} with its plays, game nights, join code and links, for everyone. Members keep their accounts and their games. It can’t be
					undone.
				</p>
				<p>
					Nobody is told, so let the group know first. Each member can download the plays and nights they were in from Your account, and you can
					download everyone’s here.
				</p>
				<div class="cbtns">
					<a class="btn" href="/g/{data.group.id}/plays/export.csv?what=plays&who=all&period=all" download>Download the plays</a>
					<a class="btn" href="/g/{data.group.id}/plays/export.csv?what=nights&who=all&period=all" download>Download the game nights</a>
				</div>
				<label>
					<span>Type <strong>{data.group.name}</strong> to confirm</span>
					<input class="field" name="confirmName" required autocomplete="off" bind:value={deleteTyped} />
				</label>
				{#if form?.deleteError}<p class="banner error" role="alert">{form.deleteError}</p>{/if}
				<div class="cbtns">
					<button class="btn small danger" disabled={hydrated && !sameName(deleteTyped, data.group.name)}>Delete {data.group.name} for good</button>
					<button type="button" class="btn small" onclick={() => ((deleteOpen = false), (deleteTyped = ''))}>Cancel</button>
				</div>
			</form>
		</details>
	{/snippet}

	<!-- The settings as form-panel rows, every question above its controls in the narrow column. -->
	{#snippet settingsRows()}
		<!-- Each setting folds to its name and value, so the panel stays short; one opens to its form. -->
		<SettingRow label="Name" value={data.group.name} error={!!form?.renameError}>{@render nameForm()}</SettingRow>
		<SettingRow
			label="Group chat"
			value={chat?.label ?? 'None yet'}
			hint="Where the group talks: a WhatsApp or Signal group, a Discord server, a Facebook group. Only members see it."
			error={!!form?.chatError}>{@render chatForm()}</SettingRow
		>
		<SettingRow
			label="New members"
			value={data.probationOn ? 'Wait to be let in by the owner or a co-admin' : 'Take part straight away'}
			hint="Anyone with the code can join. Turn this on and new people wait until the owner or a co-admin lets them in; meanwhile they can add their games and look around."
			error={!!form?.probationError}>{@render probationForm()}</SettingRow
		>
		<SettingRow
			label="Game nights"
			value={data.nightsBy === 'admins' ? 'The owner and co-admins plan them' : 'Any member plans them'}
			hint="Who can plan one. Everyone can still answer and bring games."
			error={!!form?.nightsByError}>{@render nightsForm()}</SettingRow
		>
		<SettingRow
			label="Fillers"
			value="Up to {data.filler.maxMinutes} minutes, complexity under {data.filler.maxWeight}"
			hint="What Play tonight offers while people arrive or between longer games. A game nobody has set a complexity for still counts."
			error={!!form?.fillerError}>{@render fillerForm()}</SettingRow
		>
		<SettingRow
			label="Not played lately"
			value="The last {data.staleDays} days"
			hint="How far back the shelf’s filter looks. Games never logged here always count."
			error={!!form?.staleError}>{@render staleForm()}</SettingRow
		>
		<SettingRow
			label="Theme"
			value={data.groupTheme ? (THEME_LABELS[data.groupTheme] ?? data.groupTheme) : 'This site’s default'}
			hint="What everyone sees here, unless they picked their own in the footer."
			error={!!form?.themeError}>{@render themeForm()}</SettingRow
		>
		{#if data.archiveWaits}
			<div class="form-row">
				<div class="form-label">
					<span class="form-q">If the owner’s away</span>
					<span class="hint">
						Once the owner hasn’t been here for {data.ownerAwayDays} days, a co-admin can archive the group or take over as owner.
						{#if owner}{owner.name} was here {ownerDaysAgo === 0 ? 'today' : ownerDaysAgo === 1 ? 'yesterday' : `${ownerDaysAgo} days ago`}, so that’s in {daysLeft}
							{daysLeft === 1 ? 'day' : 'days'} if they stay away.{/if}
					</span>
				</div>
			</div>
		{/if}
		{#if data.canClaim}
			<div class="form-row">
				<div class="form-label">
					<span class="form-q">Owner</span>
					<span class="hint">
						{owner ? `${owner.name}, the owner,` : 'The owner'} hasn’t been here for {ownerDaysAgo} days, so a co-admin can take over.
					</span>
				</div>
				<div class="form-body">
					<details class="confirm" open={!!form?.claimError}>
						<summary class="link-button">Take over as owner…</summary>
						<div class="confirm-body">
							<p>
								You become the owner of {data.group.name}{#if owner}, and {owner.name} becomes a co-admin{/if}. If {owner?.name ?? 'they'} lost their way in, you can then
								make them a sign-in code from Manage.
							</p>
							<form method="POST" action="?/claim" use:enhance>
								<button class="btn small">Make me the owner</button>
							</form>
							{#if form?.claimError}<p class="banner error" role="alert">{form.claimError}</p>{/if}
						</div>
					</details>
				</div>
			</div>
		{/if}
		{#if data.canArchive}
			<div class="form-row">
				<div class="form-label">
					<span class="form-q">Archive</span>
					<span class="hint">
						Stop using it and keep its history. Only the owner can delete it, once it’s archived.
						{#if data.ownerIsAway && owner}
							You can archive it because {owner.name}, the owner, hasn’t been here for {data.ownerAwayDays} days.
						{:else}
							If you’re away for {data.ownerAwayDays} days, a co-admin can archive or restore it too, or take over as owner.
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
		{#if (data.code && inviteLink) || (data.groupChat && chat)}
			<div class="invite-slot">
				{#if data.code && inviteLink}
					<InviteCard code={data.code} link={inviteLink}>
						{#if data.canManage}{@render newCode()}{/if}
					</InviteCard>
				{/if}
				<!-- Where the group talks (D78), for every member: the setting is under Settings. -->
				{#if data.groupChat && chat}
					<section class="chat-card" aria-labelledby="chat-h">
						<h2 id="chat-h">Group chat</h2>
						<p class="muted">Where {data.group.name} talks between game nights.</p>
						<div><GroupChatButton url={data.groupChat} /></div>
						{#if chat.service}<p class="where">{chat.host}</p>{/if}
					</section>
				{/if}
			</div>
		{/if}
		<section class="people" aria-labelledby="members-h">
			{#if waitingList.length}{@render waitingBlock()}{/if}
			<h2 id="members-h">Members <span class="muted num">{inGroup.length}</span></h2>
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
							{#if data.group.suspended}
								{data.group.archived ? 'The host has also suspended it, so it can’t be restored until they lift that.' : 'Only the host can lift it:'}
								<a href={data.contact}>write to them</a>.
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
							<span class="hint">Takes its plays and game nights with it. Only the owner can.</span>
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
	/* New members waiting to be let in (D79), above the members. */
	.waiting {
		margin-bottom: var(--s-5);
	}
	.waiting h2 {
		margin-bottom: var(--s-2);
	}
	.wait-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--s-3);
		flex: none;
	}
	.probation-off {
		display: grid;
		gap: var(--s-2);
		justify-items: start;
	}
	.probation-off p {
		margin: 0;
	}
	.confirm-well.decline {
		margin: 0 var(--s-3) var(--s-3);
	}
	/* The group chat (D78) under the invite, as a plain panel: the invite keeps the dark label surface. */
	.invite-slot {
		display: grid;
		gap: var(--s-4);
	}
	.chat-card {
		display: grid;
		gap: var(--s-2);
		padding: var(--s-5);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.chat-card h2,
	.chat-card p {
		margin: 0;
	}
	.chat-card .where {
		font-size: var(--t-small);
		color: var(--ink-2);
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
		min-height: max(36px, var(--tap));
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
		min-height: max(36px, var(--tap));
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
	.filler {
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-4);
	}
	.filler-field {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	.filler .field {
		width: 4.5rem;
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
