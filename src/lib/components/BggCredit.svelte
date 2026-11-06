<!--
	Required on every page by BGG's XML API terms (TECH.md "Attribution and public surface").
	It lives in the root layout so no page can drop it.
	TODO: replace the text badge with the official "Powered by BGG" logo file once its location
	is confirmed (STATUS.md, unverified assumptions). Don't redraw the logo.
-->
<footer class="credit">
	<div class="container inner">
		<p>
			Game data from <a href="https://boardgamegeek.com" rel="noopener">BoardGameGeek</a>
			<a class="badge" href="https://boardgamegeek.com" rel="noopener">Powered by BGG</a>
		</p>
		<p class="small">
			Box Populi is not affiliated with or endorsed by BoardGameGeek.
			<a href="/privacy">Privacy</a> · <a href="https://github.com/muymra/box-populi" rel="noopener">Source</a>
		</p>
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
	.inner {
		display: flex;
		flex-direction: column;
		gap: 2px;
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
	.badge {
		display: inline-block;
		padding: 1px 8px;
		border: 1.5px solid currentColor;
		border-radius: 4px;
		font-weight: 700;
		text-decoration: none;
		color: var(--ink);
	}
	/* Group pages carry a bottom tab bar on phones; keep the credit clear of it. */
	:global(body:has(.tabbar)) .credit {
		padding-bottom: calc(var(--s-6) + 72px + env(safe-area-inset-bottom));
	}
	@media (min-width: 760px) {
		:global(body:has(.tabbar)) .credit {
			padding-bottom: var(--s-6);
		}
	}
</style>
