<script lang="ts">
	import '@fontsource-variable/archivo/standard.css';
	import '../app.css';
	import '#lib/themes.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import BggCredit from '#lib/components/BggCredit.svelte';
	import CubeMark from '#lib/components/CubeMark.svelte';
	import { SOURCE_URL } from '#lib/project.ts';
	import { resolveTheme } from '#lib/themes.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	// This device's theme setting, changed by the footer picker; the page's theme follows it, then the
	// group's theme (group layouts load `groupTheme`), then the instance's. The server renders the
	// same answer into <html data-theme>, so this only matters after client-side navigation.
	// svelte-ignore state_referenced_locally (the server's value seeds it once; the picker owns it after)
	let deviceTheme = $state(data.deviceTheme);
	$effect(() => {
		const groupTheme = (page.data as { groupTheme?: string | null }).groupTheme;
		document.documentElement.dataset.theme = resolveTheme(deviceTheme, groupTheme, data.instanceTheme);
	});

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

<BggCredit bind:deviceTheme bgg={data.bggCredit} wikidata={data.wikidataCredit} />

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
