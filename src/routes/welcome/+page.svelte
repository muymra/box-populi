<script lang="ts">
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Welcome · {data.instanceName}</title></svelte:head>

<section class="narrow">
	<h1>You're in, {data.name}</h1>
	<p>This device will remember you. To use another device, or if this one's browser data gets cleared, you'll need your personal link.</p>
	<PersonalLink link={data.link} />
	<a class="btn primary" href={data.next}>I've saved it, continue</a>
</section>
