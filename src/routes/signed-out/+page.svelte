<script lang="ts">
	// After "Sign out everywhere": the replacement sign-in link once, and the way back in on this device.
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Signed out · {data.instanceName}</title></svelte:head>

<div class="page-col">
	<header>
		<h1>Signed out everywhere</h1>
		<p class="muted">Every device is signed out, and your old sign-in link no longer works. Here’s your new one.</p>
	</header>
	<PersonalLink link={data.link} />
	<div class="next">
		<a class="btn primary" href={data.link}>Sign in again on this device</a>
		<span class="muted">Or open the link on any other device.</span>
	</div>
</div>
