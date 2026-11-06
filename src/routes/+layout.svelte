<script lang="ts">
	import '@fontsource-variable/archivo/standard.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import BggCredit from '#lib/components/BggCredit.svelte';
	import CubeMark from '#lib/components/CubeMark.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.instanceName}</title>
</svelte:head>

<header class="top">
	<div class="container bar">
		<a class="brand" href="/"><CubeMark size={24} /><span>{data.instanceName}</span></a>
		<nav aria-label="Account">
			{#if data.user}
				<a href="/me" class="me">{data.user.name}</a>
			{:else}
				<a href="/join" class="me">Join a group</a>
			{/if}
		</nav>
	</div>
</header>

<main class="container">
	{@render children()}
</main>

<BggCredit />

<style>
	.top {
		background: var(--laminate);
		border-bottom: 1px solid var(--rule);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 56px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--ink);
		text-decoration: none;
		font-weight: 800;
		font-stretch: 85%;
		font-size: 1.125rem;
		letter-spacing: -0.01em;
	}
	.me {
		font-weight: 600;
		text-decoration: none;
		padding: 8px 2px;
	}
	.me:hover {
		text-decoration: underline;
	}
</style>
