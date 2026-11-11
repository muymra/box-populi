<!--
	Required on every page by BGG's XML API terms (TECH.md "Attribution and public surface").
	It lives in the root layout so no page can drop it. The logo is BGG's own file, as BGG provides it:
	the colour one on light themes, the reversed one on dark ones. Don't redraw or recolour it.
-->
<script lang="ts">
	import { APP_VERSION, CHANGELOG_URL, SOURCE_URL } from '#lib/project.ts';
	import poweredByBgg from '#lib/assets/powered-by-bgg-rgb.svg';
	import poweredByBggReversed from '#lib/assets/powered-by-bgg-reversed-rgb.svg';
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
					<a class="logo" href="https://boardgamegeek.com" rel="noopener">
						<img class="on-light" src={poweredByBgg} alt="Powered by BGG" width="126" height="28" />
						<img class="on-dark" src={poweredByBggReversed} alt="Powered by BGG" width="126" height="28" />
					</a>
				</p>
			{/if}
			{#if wikidata}
				<p><span>Game details from <a href="https://www.wikidata.org" rel="noopener">Wikidata</a>, free to reuse (CC0).</span></p>
			{/if}
			<p class="small">
				{#if bgg}Box Populi is not affiliated with or endorsed by BoardGameGeek.{/if}
				<a href="/privacy">Privacy</a> · <a href={SOURCE_URL} rel="noopener">Source</a> ·
				<a class="num" href={CHANGELOG_URL} rel="noopener" title="What changed in each version">v{APP_VERSION}</a>
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
	/* The credit's lines aren't reading text, so they drop app.css's 65ch cap on paragraphs, which
	   broke the version onto a third line of its own. */
	p {
		max-width: none;
	}
	.small {
		display: block;
		font-size: var(--t-small);
	}
	.theme {
		margin-left: auto;
	}
	/* 28px tall keeps the logo's small "by" readable on a phone, as BGG asks. */
	.logo {
		display: inline-flex;
		border-radius: 4px;
	}
	.logo img {
		height: 28px;
		width: auto;
	}
	.on-light {
		display: var(--on-light, block);
	}
	.on-dark {
		display: var(--on-dark, none);
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
