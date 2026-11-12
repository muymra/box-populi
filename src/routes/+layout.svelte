<script lang="ts">
	import '@fontsource-variable/archivo/standard.css';
	import '../app.css';
	import '#lib/themes.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import BggCredit from '#lib/components/BggCredit.svelte';
	import CubeMark from '#lib/components/CubeMark.svelte';
	import { SOURCE_URL } from '#lib/project.ts';
	import { resolveTheme, themeBarColors } from '#lib/themes.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	// This device's theme setting, changed by the footer picker; the page's theme follows it, then the
	// group's theme (group layouts load `groupTheme`), then the instance's. The server renders the
	// same answer into <html data-theme>, so this only matters after client-side navigation.
	// svelte-ignore state_referenced_locally (seeded from the server, then kept in step with it below)
	let deviceTheme = $state(data.deviceTheme);
	// After any reload of data (the footer picker and the Group tab's button both trigger one), take
	// the server's view of this device's setting.
	$effect(() => {
		deviceTheme = data.deviceTheme;
	});
	const theme = $derived(resolveTheme(deviceTheme, (page.data as { groupTheme?: string | null }).groupTheme, data.instanceTheme));
	$effect(() => {
		document.documentElement.dataset.theme = theme;
	});
	// The browser's own bar around the installed app takes the page's colour (D76).
	const bar = $derived(themeBarColors(theme, data.customPage));

	// Group pages draw their own top bar with the group's name in it. When the group itself failed
	// to load (a wrong or removed group), there's no group bar, so this one shows with the error.
	const inGroup = $derived((page.route.id?.startsWith('/g/') ?? false) && (page.data as { group?: unknown }).group != null);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- In static/, so iPhones find it without asking the app for guessed names (D59). -->
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<!-- Installable (D76): app.html links the manifest; iPhones take the app's name from this. -->
	<meta name="apple-mobile-web-app-title" content={data.instanceName} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content={bar.light} />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content={bar.dark} />
	<title>{data.instanceName}</title>
	{#if data.customTheme != null}<link rel="stylesheet" href="/custom-theme.css?v={data.customTheme}" />{/if}
</svelte:head>

{#if !inGroup}
	<header class="top">
		<div class="container bar">
			<a class="brand" href="/">
				{#if data.logoUrl}<img class="logo" src={data.logoUrl} alt="" />{:else}<CubeMark size={24} />{/if}<span>{data.instanceName}</span>
			</a>
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

<BggCredit bind:deviceTheme custom={data.customTheme != null} bgg={data.bggCredit} wikidata={data.wikidataCredit} />

<style>
	.logo {
		display: block;
		height: 28px;
		width: auto;
		max-width: 140px;
		object-fit: contain;
	}
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
