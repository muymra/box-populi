<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Sign in · {data.instanceName}</title></svelte:head>

<section class="signin">
	<h1>Sign in</h1>
	{#if data.signInConfigured}
		<p>Sign in to create a group, join one with a code, and add your games.</p>
		<a class="btn primary" href="/auth/google?returnTo={encodeURIComponent(data.returnTo)}">Continue with Google</a>
	{:else}
		<p class="banner">
			Sign-in isn't set up on this instance yet. The host needs to add Google sign-in credentials.
		</p>
		<p><a href="/demo">Look around the demo group</a> in the meantime.</p>
	{/if}
</section>

<style>
	.signin {
		max-width: 28rem;
		padding-top: 2.5rem;
	}
</style>
