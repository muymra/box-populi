<script lang="ts">
	// "Your group is ready" (D46): the invite to share on the dark label, then putting games on the
	// shelf. Getting back in later is the group's link and your PIN (D47), so there's nothing else to save.
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { page } from '$app/state';
	import InviteCard from '#lib/components/InviteCard.svelte';
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

	{#if data.code && inviteLink}
		<div class="invite">
			<InviteCard
				code={data.code}
				link={inviteLink}
				heading="Invite your group"
				intro="Paste the link in your group chat, or read out the code. Anyone with it can join with a name and a PIN."
			/>
		</div>
	{/if}

	<div class="next">
		<a class="btn primary" href="/g/{data.group.id}/add">Add your games <ArrowRight size={18} aria-hidden="true" /></a>
		<a href="/g/{data.group.id}">Go to the shelf</a>
	</div>
	<p class="muted later">The same link gets you back in on another device: tap your name and type your PIN. The code and link stay on the Group tab.</p>
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
	.invite {
		max-width: 28rem;
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
	.later {
		max-width: 38rem;
	}
</style>
