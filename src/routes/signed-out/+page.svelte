<script lang="ts">
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Signed out · {data.instanceName}</title></svelte:head>

<section class="narrow">
	<h1>Signed out everywhere</h1>
	<p>Every device is signed out and your old personal link no longer works. Here's your new one. Open it to sign back in on any device, this one included.</p>
	<PersonalLink link={data.link} />
</section>
