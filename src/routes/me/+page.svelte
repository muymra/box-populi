<script lang="ts">
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ROLE_LABELS = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
</script>

<svelte:head><title>Your account · {data.instanceName}</title></svelte:head>

<section class="narrow">
	<h1>Your account</h1>

	<h2>Name</h2>
	<form method="POST" action="?/rename" class="inline">
		<label class="visually-hidden" for="displayName">Display name</label>
		<input id="displayName" class="field" name="displayName" required maxlength="40" value={data.name} />
		<button class="btn">Save</button>
	</form>
	{#if form?.renameError}<p class="banner error" role="alert">{form.renameError}</p>{/if}
	{#if form?.renamed}<p class="muted" role="status">Saved.</p>{/if}

	<h2>Your groups</h2>
	{#if data.groups.length}
		<ul class="groups">
			{#each data.groups as g (g.id)}
				<li>
					<a href="/g/{g.id}">{g.name}</a>
					<span class="muted">{ROLE_LABELS[g.role]} · {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}</span>
					<form method="POST" action="?/leave">
						<input type="hidden" name="groupId" value={g.id} />
						<button class="link-button">Leave</button>
					</form>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">You're not in any groups. <a href="/join">Join one</a> or <a href="/groups/new">create one</a>.</p>
	{/if}
	{#if form?.leaveError}<p class="banner error" role="alert">{form.leaveError}</p>{/if}

	<h2 id="personal-link">Personal link</h2>
	{#if data.newLink}
		<PersonalLink link={data.newLink} />
	{:else}
		<p>Your personal link signs you in on another device. Lost it, or think someone else has it? Make a new one; the old one stops working straight away.</p>
		<form method="POST" action="?/newLink">
			<button class="btn">Make a new personal link</button>
		</form>
	{/if}

	<h2>Sign out</h2>
	<div class="row">
		<form method="POST" action="?/signOut"><button class="btn">Sign out of this device</button></form>
		<form method="POST" action="?/signOutEverywhere"><button class="btn">Sign out everywhere</button></form>
	</div>
	<p class="muted">Before signing out, make sure you have your personal link, or you'll need to rejoin your groups.</p>

	<h2>Delete your account</h2>
	<p class="muted">Removes your name, games, wishlist and group memberships. Links you added stay, credited to "former member."</p>
	<form method="POST" action="?/deleteAccount" class="inline">
		<label class="visually-hidden" for="confirm">Type delete to confirm</label>
		<input id="confirm" class="field" name="confirm" placeholder='Type "delete"' autocomplete="off" />
		<button class="btn">Delete account</button>
	</form>
	{#if form?.deleteError}<p class="banner error" role="alert">{form.deleteError}</p>{/if}
</section>

<style>
	h2 {
		font-size: var(--t-lead);
		margin-top: var(--s-6);
	}
	.inline .field {
		flex: 1;
		min-width: 12rem;
	}
	.groups {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.groups li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		padding: var(--s-3);
		background: var(--cube);
	}
	.groups li a {
		font-weight: 700;
	}
	.groups li form {
		margin-left: auto;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
</style>
