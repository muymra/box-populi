<!--
	Required on every page by BGG's XML API terms (TECH.md "Attribution and public surface").
	It lives in the root layout so no page can drop it.
	TODO: replace the text badge with the official "Powered by BGG" logo file once its location
	is confirmed (STATUS.md, unverified assumptions). Don't redraw the logo.
-->
<script lang="ts">
	import { SOURCE_URL } from '#lib/project.ts';
	import ThemePicker from './ThemePicker.svelte';

	/** `bgg`: whether this instance shows BGG data and so must credit it (D30). */
	let { deviceTheme = $bindable(), custom, bgg, wikidata }: { deviceTheme: string; custom: boolean; bgg: boolean; wikidata: boolean } = $props();
</script>

<footer class="credit">
	<div class="container inner">
		<div class="text">
			{#if bgg}
				<p>
					Game data from <a href="https://boardgamegeek.com" rel="noopener">BoardGameGeek</a>
					<a class="badge" href="https://boardgamegeek.com" rel="noopener">Powered by BGG</a>
				</p>
			{/if}
			{#if wikidata}
				<p><span>Game details from <a href="https://www.wikidata.org" rel="noopener">Wikidata</a>, free to reuse (CC0).</span></p>
			{/if}
			<p class="small">
				{#if bgg}Box Populi is not affiliated with or endorsed by BoardGameGeek.{/if}
				<a href="/privacy">Privacy</a> · <a href={SOURCE_URL} rel="noopener">Source</a>
			</p>
		</div>
		<div class="theme"><ThemePicker bind:current={deviceTheme} {custom} /></div>
	</div>
</footer>

<style>
	.credit {
		margin-top: var(--s-7);
		border-top: 1px solid var(--rule);
		padding: var(--s-5) 0 var(--s-6);
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	/* The credit on the left, the theme picker at the far right; on a narrow screen the picker
	   wraps under the credit and stays at the right edge. */
	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3) var(--s-5);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	p {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.small {
		font-size: var(--t-small);
	}
	.theme {
		margin-left: auto;
	}
	.badge {
		display: inline-block;
		padding: 1px 8px;
		border: 1.5px solid currentColor;
		border-radius: 4px;
		font-weight: 700;
		text-decoration: none;
		color: var(--ink);
	}
	/* Group pages carry a bottom tab bar below 900px; keep the credit clear of it. */
	:global(body:has(.tabbar)) .credit {
		padding-bottom: calc(var(--s-6) + 72px + env(safe-area-inset-bottom));
	}
	@media (min-width: 900px) {
		:global(body:has(.tabbar)) .credit {
			padding-bottom: var(--s-6);
		}
	}
</style>
