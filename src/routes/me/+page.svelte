<script lang="ts">
	// Your account (PRD "Identity"): your name, how you sign in elsewhere, your groups and loans, and
	// deleting the account, as form panels like the rest of the app (DESIGN.md "Form panel").
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import { PIN_LENGTH } from '#lib/pin.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ROLE_LABELS = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
	const loanCount = $derived(data.loans.lent.length + data.loans.borrowed.length);
</script>

<svelte:head><title>Your account · {data.instanceName}</title></svelte:head>

<div class="account">
	<header>
		<h1>Your account</h1>
		<p class="muted">A name and the devices you use. There’s no email or password.</p>
	</header>

	<section class="form-panel" aria-labelledby="you-h">
		<div class="form-head">
			<div>
				<h2 id="you-h">You</h2>
				<p>How the group sees you, and how you get back in on another device.</p>
			</div>
		</div>
		<div class="form-row">
			<div class="form-label"><label class="form-q" for="displayName">Name</label></div>
			<div class="form-body">
				<form method="POST" action="?/rename" class="inline">
					<input id="displayName" class="field" name="displayName" required maxlength="40" value={data.name} />
					<button class="btn">Save</button>
				</form>
				{#if form?.renameError}<p class="banner error" role="alert">{form.renameError}</p>{/if}
				{#if form?.renamed}<p class="muted" role="status">Saved.</p>{/if}
			</div>
		</div>
		{#if data.viaCode && !form?.pinSaved}
			<div class="form-block">
				<p class="banner" role="status">You’re in with a code from your group’s admin. Pick a new PIN now, so next time you can get back in on your own.</p>
			</div>
		{/if}
		<div class="form-row" id="pin-row">
			<div class="form-label">
				<label class="form-q" for="pin">PIN</label>
				<span class="hint">With a group’s link and your PIN you can get back in on any device: tap your name, type your PIN.</span>
			</div>
			<div class="form-body">
				<form method="POST" action="?/setPin" class="inline">
					<input id="pin" class="field pin" name="pin" required inputmode="numeric" pattern={`[0-9]{${PIN_LENGTH}}`} maxlength={PIN_LENGTH} autocomplete="off" placeholder="123456" />
					<button class="btn">{data.pinSetAt ? 'Change PIN' : 'Set PIN'}</button>
				</form>
				{#if form?.pinError}<p class="banner error" role="alert">{form.pinError}</p>{/if}
				{#if form?.pinSaved}
					<p class="muted" role="status">PIN saved.</p>
				{:else if data.pinSetAt}
					<p class="muted">Set {new Date(data.pinSetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Six digits, not your bank card’s.</p>
				{:else}
					<p class="muted">Not set yet. Without one, getting in on another device needs your sign-in link.</p>
				{/if}
			</div>
		</div>
		<div class="form-row text-row" id="personal-link">
			<div class="form-label">
				<span class="form-q">Sign-in link</span>
				<span class="hint">A backup way in, for a password manager.</span>
			</div>
			<div class="form-body">
				{#if data.newLink}
					<PersonalLink link={data.newLink} />
				{:else}
					<p>
						Make one to keep in a password manager, for getting in without a group’s link. A new one replaces the last straight away and signs out every
						other device; sign them back in with your PIN or the new link.
					</p>
					<form method="POST" action="?/newLink">
						<button class="btn">Make a new sign-in link</button>
					</form>
				{/if}
			</div>
		</div>
		<div class="form-row">
			<div class="form-label">
				<span class="form-q">Sign out</span>
				<span class="hint">Know your PIN first, or have a sign-in link, or you’ll need to rejoin your groups.</span>
			</div>
			<div class="form-body">
				<div class="row">
					<form method="POST" action="?/signOut"><button class="btn">Sign out of this device</button></form>
					<form method="POST" action="?/signOutEverywhere"><button class="btn">Sign out everywhere</button></form>
				</div>
			</div>
		</div>
	</section>

	<section class="form-panel" aria-labelledby="groups-h">
		<div class="form-head">
			<div><h2 id="groups-h">Your groups <span class="muted num">{data.groups.length}</span></h2></div>
		</div>
		<div class="form-block">
			{#if data.groups.length}
				<ul class="list">
					{#each data.groups as g (g.id)}
						<li>
							<div class="item">
								<a class="name" href="/g/{g.id}">{g.name}</a>
								<span class="muted">{ROLE_LABELS[g.role]} · {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}</span>
							</div>
							<details class="confirm">
								<summary class="link-button">Leave<span class="visually-hidden"> {g.name}</span>…</summary>
								<div class="confirm-body">
									{#if g.memberCount === 1}
										<p>You’re its only member, so leaving deletes {g.name}: its code stops working and its links are gone. Your games stay with you.</p>
									{:else if g.role === 'owner'}
										<p>You own {g.name}. Hand ownership to someone on its <a href="/g/{g.id}/group">Group tab</a> first, or delete the group there.</p>
									{:else}
										<p>Your games leave {g.name}’s shelf. You can rejoin with its code.</p>
									{/if}
									{#if g.memberCount === 1 || g.role !== 'owner'}
										<form method="POST" action="?/leave">
											<input type="hidden" name="groupId" value={g.id} />
											<button class="btn small danger">{g.memberCount === 1 ? `Leave and delete ${g.name}` : `Leave ${g.name}`}</button>
										</form>
									{/if}
								</div>
							</details>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">You’re not in any groups. <a href="/join">Join one</a> or <a href="/groups/new">create one</a>.</p>
			{/if}
			{#if form?.leaveError}<p class="banner error" role="alert">{form.leaveError}</p>{/if}
		</div>
	</section>

	{#if loanCount}
		<section class="form-panel" aria-labelledby="loans-h">
			<div class="form-head">
				<div>
					<h2 id="loans-h">Loans <span class="muted num">{loanCount}</span></h2>
					<p>Games of yours that are with someone else, and games you’ve borrowed.</p>
				</div>
			</div>
			<div class="form-block">
				<ul class="list">
					{#each data.loans.lent as l (l.gameId)}
						<li>
							<div class="item">
								<span class="name">{l.game}</span>
								<span class="muted">With {l.who}</span>
							</div>
							<form method="POST" action="?/returned">
								<input type="hidden" name="gameId" value={l.gameId} />
								<button class="link-button">Mark as returned<span class="visually-hidden">: {l.game}</span></button>
							</form>
						</li>
					{/each}
					{#each data.loans.borrowed as l (l.gameId + l.who)}
						<li>
							<div class="item">
								<span class="name">{l.game}</span>
								<span class="muted">Borrowed from {l.who}</span>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	<!-- Deleting: its own panel at the end, edged in the danger colour, so it never reads as one more setting. -->
	<section class="form-panel delete" aria-labelledby="delete-h">
		<div class="form-head">
			<div>
				<h2 id="delete-h">Delete your account</h2>
				<p>
					Removes your name, shelf, wishlist and group memberships, and the games you typed in unless another member has them too. Links you added stay,
					credited to “former member.”
				</p>
			</div>
		</div>
		<div class="form-block">
			<form method="POST" action="?/deleteAccount" class="inline">
				<label class="visually-hidden" for="confirm">Type delete to confirm</label>
				<input id="confirm" class="field" name="confirm" placeholder="Type “delete”" autocomplete="off" />
				<button class="btn danger">Delete account</button>
			</form>
			{#if form?.deleteError}<p class="banner error" role="alert">{form.deleteError}</p>{/if}
		</div>
	</section>
</div>

<style>
	.account {
		display: grid;
		gap: var(--s-5);
		max-width: 46rem;
		padding-top: var(--s-3);
	}
	header h1 {
		margin: 0;
	}
	header p {
		margin: 6px 0 0;
	}
	.form-head h2 .num {
		font-weight: 600;
		margin-left: 4px;
	}
	.form-body p,
	.form-block p {
		margin: 0;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.inline .field {
		flex: 1;
		min-width: 12rem;
	}
	.inline .field.pin {
		flex: none;
		min-width: 0;
		width: 10rem;
		letter-spacing: 0.3em;
		font-variant-numeric: tabular-nums;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	/* A freshly made link sits in its row; the panel is its frame, so it drops its own. */
	.form-body :global(.personal-link) {
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
	}
	/* Groups and loans: one ruled list in the panel, the name first, the action at the right. */
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-1) var(--s-3);
		min-height: 56px;
		padding: var(--s-2) 0;
	}
	.list li + li {
		border-top: 1px solid var(--rule);
	}
	.item {
		display: grid;
		gap: 1px;
		min-width: 0;
	}
	.name {
		font-weight: 700;
		color: var(--ink);
	}
	.item .muted {
		font-size: var(--t-small);
	}
	.list .link-button {
		min-height: 44px;
	}
	.confirm summary {
		display: inline-block;
		min-height: 44px;
		line-height: 44px;
		font-weight: 650;
		list-style: none;
		cursor: pointer;
	}
	.confirm summary::-webkit-details-marker {
		display: none;
	}
	.confirm[open] {
		flex-basis: 100%;
	}
	.confirm-body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-3);
		max-width: 34rem;
		padding-bottom: var(--s-2);
	}
	.btn.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
	.btn.danger:hover {
		background: var(--danger-soft);
	}
	.form-panel.delete {
		border-color: var(--danger);
	}
	/* Rows line their question up with a control; a row that opens with a paragraph lines it up with the text. */
	@media (min-width: 760px) {
		.text-row > .form-label {
			padding-top: 2px;
		}
	}
</style>
