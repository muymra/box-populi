<script lang="ts">
	// "Your group is ready": the invite on the dark label (the group's, to share) and, for someone new,
	// their sign-in link on the cube (theirs, private), side by side so the difference shows (D46).
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { page } from '$app/state';
	import InviteCard from '#lib/components/InviteCard.svelte';
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const inviteLink = $derived(data.code ? `${page.url.origin}/join/${data.code}` : null);
</script>

<svelte:head><title>{data.group.name} is ready · {data.instanceName}</title></svelte:head>

<div class="ready">
	<header>
		<h1>{data.group.name} is ready</h1>
		<p class="muted">Invite your group, then put your games on the shelf.</p>
	</header>

	<div class="pair" class:single={!data.signInLink}>
		{#if data.code && inviteLink}
			<InviteCard
				code={data.code}
				link={inviteLink}
				heading="Invite your group"
				intro="Paste the link in your group chat, or read out the code. Anyone with it can join with just a name."
			/>
		{/if}
		{#if data.signInLink}
			<div class="mine">
				<PersonalLink link={data.signInLink} />
				<p class="muted">This device stays signed in. The link is for your other devices, or if this one forgets you.</p>
			</div>
		{/if}
	</div>

	<div class="next">
		<a class="btn primary" href="/g/{data.group.id}/add">Add your games <ArrowRight size={18} aria-hidden="true" /></a>
		<a href="/g/{data.group.id}">Go to the shelf</a>
	</div>
	<p class="muted later">The code and link stay on the Group tab, for whenever someone new comes along.</p>
</div>

<style>
	.ready {
		display: grid;
		gap: var(--s-5);
		max-width: 60rem;
		padding: var(--s-5) 0 var(--s-6);
	}
	header h1 {
		margin: 0;
	}
	header p,
	.later {
		margin: 0;
	}
	.pair {
		display: grid;
		gap: var(--s-5);
		align-items: start;
	}
	.mine {
		display: grid;
		gap: var(--s-2);
	}
	.mine p {
		margin: 0;
		font-size: var(--t-small);
	}
	.next {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-4);
	}
	.next a:not(.btn) {
		font-weight: 650;
	}
	.single {
		max-width: 28rem;
	}
	@media (min-width: 760px) {
		.pair:not(.single) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
