<!--
	An error inside a group that did load: a removed game, a mistyped page, an action that isn't
	allowed. It renders under the group's bar and tabs, so the way back is always there.
-->
<script lang="ts">
	import { page } from '$app/state';

	const groupId = $derived(page.params.groupId);
	const notFound = $derived(page.status === 404);
	const onGame = $derived(page.route.id?.includes('/game/') ?? false);
	const heading = $derived(notFound ? (onGame ? 'Not on this shelf' : 'Page not found') : page.status === 403 ? 'Not allowed here' : 'Something went wrong');
</script>

<section class="narrow error-page">
	<h2>{heading}</h2>
	{#if notFound && onGame}
		<p>Nobody in this group has this game on their shelf or wishlist any more. It may have been removed, or the link came from another group.</p>
	{:else if notFound}
		<p>There's nothing at this address in the group.</p>
	{:else}
		<p>{page.error?.message ?? 'The server had a problem with that request.'}.</p>
	{/if}
	<p><a class="btn primary" href="/g/{groupId}">Back to the shelf</a></p>
</section>

<style>
	.error-page {
		padding-top: var(--s-6);
	}
</style>
