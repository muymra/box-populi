<!--
	Required on every page by BGG's XML API terms (TECH.md "Attribution and public surface").
	It lives in the root layout so no page can drop it.
	TODO: replace the text badge with the official "Powered by BGG" logo file once its location
	is confirmed (STATUS.md, unverified assumptions). Don't redraw the logo.
-->
<footer class="credit">
	<div class="container">
		<p>
			Game data from <a href="https://boardgamegeek.com" rel="noopener">BoardGameGeek</a>.
			<a class="badge" href="https://boardgamegeek.com" rel="noopener">Powered by BGG</a>
		</p>
		<p class="muted">
			Box Populi is not affiliated with or endorsed by BoardGameGeek.
			<a href="/privacy">Privacy</a> ·
			<a href="https://github.com/muymra/box-populi" rel="noopener">Source</a>
		</p>
	</div>
</footer>

<style>
	.credit {
		margin-top: 3rem;
		padding: 1.25rem 0 2rem;
		border-top: 1px solid var(--border);
		font-size: 0.9rem;
	}
	p {
		margin: 0.25rem 0;
	}
	.badge {
		display: inline-block;
		margin-left: 0.4rem;
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-weight: 600;
		text-decoration: none;
	}
</style>
