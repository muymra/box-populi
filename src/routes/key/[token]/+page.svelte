<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in · {data.instanceName}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="narrow">
	{#if data.state === 'limited'}
		<h1>Too many tries</h1>
		<p>This network tried too many links that didn't work. Wait an hour, then try again.</p>
	{:else if data.state === 'invalid'}
		<h1>This link doesn't work</h1>
		<p>It may have been replaced by a newer one. If you have another device that's still signed in, make a new link from its account page.</p>
		<p>Otherwise, <a href="/join">join your group again with its code</a> and ask a group admin to remove your old entry.</p>
	{:else if data.alreadyYou}
		<h1>You're already signed in as {data.name}</h1>
		<a class="btn primary" href="/">Go to your groups</a>
	{:else}
		<h1>Sign in as {data.name}?</h1>
		{#if data.switchingFrom}
			<p class="banner">This device is signed in as {data.switchingFrom}. Continuing switches it to {data.name}.</p>
		{:else}
			<p>This device will remember you after this.</p>
		{/if}
		<form method="POST">
			{#if form?.error}<p class="banner" role="alert">{form.error}</p>{/if}
			<button class="btn primary">Sign in as {data.name} on this device</button>
		</form>
	{/if}
</section>
