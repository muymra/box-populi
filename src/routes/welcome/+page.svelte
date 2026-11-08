<script lang="ts">
	// After joining (D46): the sign-in link once, in the key panel, then on into the group.
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import PersonalLink from '#lib/components/PersonalLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Welcome · {data.instanceName}</title></svelte:head>

<div class="page-col">
	<header>
		<h1>You’re in, {data.name}</h1>
		<p class="muted">This device will remember you. Keep your sign-in link for your other devices, or for when this one forgets you.</p>
	</header>
	<PersonalLink link={data.link} />
	<div class="next"><a class="btn primary" href={data.next}>I’ve saved it, continue <ArrowRight size={18} aria-hidden="true" /></a></div>
</div>
