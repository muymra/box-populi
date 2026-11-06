<!--
	The error page outside a group, and for a group that can't be shown (a wrong link, a group you
	aren't in, a deleted group). The root layout's top bar shows above it.
-->
<script lang="ts">
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
	const heading = $derived(notFound ? (page.route.id?.startsWith('/g/') ? 'Group not found' : 'Page not found') : 'Something went wrong');
</script>

<svelte:head><title>{heading}</title></svelte:head>

<section class="narrow error-page">
	<p class="code num">{page.status}</p>
	<h1>{heading}</h1>
	{#if notFound && page.route.id?.startsWith('/g/')}
		<p>The link may be old, the group may have been deleted, or you're not in it on this device. Sign in with your personal link, or ask someone in the group for its code.</p>
	{:else if notFound}
		<p>There's nothing at this address.</p>
	{:else}
		<p>{page.error?.message ?? 'The server had a problem with that request.'} Try again in a moment.</p>
	{/if}
	<p class="actions">
		<a class="btn primary" href="/">Go to your groups</a>
		{#if notFound && page.route.id?.startsWith('/g/')}<a class="btn" href="/join">Join with a code</a>{/if}
	</p>
</section>

<style>
	.error-page {
		padding-top: var(--s-6);
	}
	.code {
		margin: 0;
		color: var(--ink-3);
		font-weight: 700;
	}
	h1 {
		margin-top: var(--s-1);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-5);
	}
</style>
