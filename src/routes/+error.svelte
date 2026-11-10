<!--
	The error page outside a group, and for a group that can't be shown (a wrong link, a group you
	aren't in, a deleted group). The root layout's top bar shows above it. An empty cube stands for
	what isn't there: the Wanted tab's "empty place on the shelf", a cube with a dashed edge.
-->
<script lang="ts">
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
	const inGroup = $derived(page.route.id?.startsWith('/g/') ?? false);
	const heading = $derived(notFound ? (inGroup ? 'Group not found' : 'Page not found') : 'Something went wrong');
</script>

<svelte:head><title>{heading} ({page.status})</title></svelte:head>

<section class="error-page">
	<div class="empty-cube" aria-hidden="true"><span class="edge"></span></div>
	<div class="words">
		<h1>{heading}</h1>
		{#if notFound && inGroup}
			<p>The link may be old, the group may have been deleted, or you're not in it on this device. Open your group's link and tap your name, or ask someone in the group for its code.</p>
		{:else if notFound}
			<p>There's nothing at this address.</p>
		{:else}
			<p>{page.error?.message ?? 'The server had a problem with that request'}. Try again in a moment.</p>
			<p class="ref num">Error {page.status}{#if page.error?.ref}{' · ref '}{page.error.ref}{/if}</p>
		{/if}
		<p class="actions">
			<a class="btn primary" href="/">Go to your groups</a>
			{#if notFound && inGroup}<a class="btn" href="/join">Join with a code</a>{/if}
		</p>
	</div>
</section>

<style>
	.ref {
		font-size: var(--t-small);
		color: var(--ink-2);
		user-select: all;
	}
	.error-page {
		display: grid;
		gap: var(--s-5);
		align-items: start;
		max-width: 46rem;
		padding: var(--s-6) 0;
	}
	/* One cube on the shelf-gap ground, nothing standing in it, its edge dashed where an owner's colour would be. */
	.empty-cube {
		width: 128px;
		padding: 6px;
		background: var(--gap);
		border-radius: 6px;
	}
	.empty-cube::before {
		content: '';
		display: block;
		aspect-ratio: 1 / 1.1;
		background: var(--cube);
	}
	.edge {
		display: block;
		height: 0;
		margin: -12px 10px 6px;
		border-top: 3px dashed color-mix(in srgb, var(--ink-3) 60%, transparent);
	}
	h1 {
		margin: 0;
	}
	.words p {
		margin: var(--s-2) 0 0;
		max-width: 38rem;
	}
	.words .actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-5);
	}
	@media (min-width: 640px) {
		.error-page {
			grid-template-columns: auto minmax(0, 1fr);
			gap: var(--s-6);
		}
	}
</style>
