<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Not signed in · {data.instanceName}</title></svelte:head>

<section class="narrow">
	<h1>You're not signed in on this device</h1>
	<p>There are no passwords here. Each device remembers who you are.</p>
	<ul class="options">
		<li><strong>Already in a group?</strong> Open your personal link on this device. You got it when you joined, and any device where you're still signed in can make a new one from its account page.</li>
		<li><strong>New here?</strong> <a href="/join">Join with a group code</a> or <a href="/groups/new">create a group</a>.</li>
		<li><strong>Just looking?</strong> <a href="/demo">Open the demo group</a>.</li>
	</ul>
</section>

<style>
	.options {
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
</style>
