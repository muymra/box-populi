<script lang="ts">
	import '@fontsource-variable/archivo/standard.css';
	import '../app.css';
	import '#lib/themes.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import BggCredit from '#lib/components/BggCredit.svelte';
	import CubeMark from '#lib/components/CubeMark.svelte';
	import { SOURCE_URL } from '#lib/project.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	// Group pages draw their own top bar with the group's name in it.
	const inGroup = $derived(page.route.id?.startsWith('/g/') ?? false);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.instanceName}</title>
</svelte:head>

{#if !inGroup}
	<header class="top">
		<div class="container bar">
			<a class="brand" href="/"><CubeMark size={24} /><span>{data.instanceName}</span></a>
			<nav aria-label="Account">
				{#if data.user}
					<a href="/me" class="me">{data.user.name}</a>
				{:else if data.demoMode}
					<a href={SOURCE_URL} class="me" rel="noopener">Run your own</a>
				{:else}
					<a href="/join" class="me">Join a group</a>
				{/if}
			</nav>
		</div>
	</header>
{/if}

<main class="container">
	{@render children()}
</main>

<BggCredit theme={data.theme} bgg={data.bggCredit} />

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
