<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import BggCredit from '#lib/components/BggCredit.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.instanceName}</title>
</svelte:head>

<header class="top">
	<div class="container bar">
		<a class="brand" href="/">{data.instanceName}</a>
		<nav>
			{#if data.user}
				<a href="/me" class="me">{data.user.name}</a>
			{:else}
				<a href="/join">Join a group</a>
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
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3.25rem;
	}
	.me {
		color: var(--text);
	}
	.brand {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
</style>
