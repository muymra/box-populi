<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Privacy · {data.instanceName}</title></svelte:head>

<article class="prose">
	<h1>Privacy</h1>
	<p>
		{data.instanceName} is an instance of Box Populi, open-source software anyone can run. This instance
		is run by its host, who you can reach at <a href={data.contact}>{data.contactLabel}</a>.
	</p>

	<h2>What's stored</h2>
	<ul>
		<li>The display name you choose. Members of your groups see it, and you can change it.</li>
		<li>
			The games you add, what you've lent or borrowed, your wishlist and the groups you're in. If you fill in a game's details, your
			name shows beside them to the groups you're in.
		</li>
		<li>Links you add to games, credited to you within that group.</li>
		<li>A cookie that keeps this device signed in. The server stores only a scrambled fingerprint of it, and the same for your personal link.</li>
		<li>
			Network addresses that tried a wrong join code, sign-in link or admin key, or created a group, and how often you searched
			for games, matched a pasted list or imported from BoardGameGeek. These are kept for about a day, to slow down guessing
			and to stay within the game sources' limits.
		</li>
	</ul>
	<p>
		There are no accounts, emails or passwords.{#if data.bggOn}{' '}If you import from BoardGameGeek, your BGG username is used for that
			lookup and not stored.{/if}
	</p>

	<h2>Who can see it</h2>
	<p>
		Members of a group see each other's names, games, loans and wishlists, and the links added to games. Nobody outside a
		group can see inside it. The demo group is the exception: it's public and contains no real people.
	</p>
	<p>
		The host's admin page shows totals and, per group, its name, number of members and games, and last activity. It
		doesn't show who is in a group, join codes or collections. The host can suspend or delete a group, giving a reason,
		and every such action is logged. The host does run the database, though, and could read it directly.
	</p>

	<h2>Deleting your data</h2>
	<p>
		You can delete your account from your account page. That removes your name, your shelf, wishlist, memberships and
		sessions, and the games you typed in yourself. A typed-in game that another member also has stays, without your
		name. Links you added stay, credited to "former member." The host has no email or other way to find you, so do it
		from a device where you're signed in.
	</p>

	<h2>Game data</h2>
	{#if data.bggOn}
		<p>
			Game information and images come from <a href="https://boardgamegeek.com">BoardGameGeek</a> and are shown as BGG
			provides them. Box Populi is not affiliated with or endorsed by BoardGameGeek.
		</p>
		<p>When you search for a game, the search text is sent to BoardGameGeek.</p>
	{:else if data.wikidataOn}
		<p>
			Game titles, years and player counts come from <a href="https://www.wikidata.org">Wikidata</a>, which anyone may reuse.
			When you search for a game or match a pasted list, the titles are sent to Wikidata. Nothing is fetched from
			BoardGameGeek.
		</p>
	{:else}
		<p>Games on this instance are entered by their owners. Nothing is fetched from BoardGameGeek.</p>
	{/if}
	<p>
		Box pictures load in your browser straight from where they're kept, such as BoardGameGeek's image servers or a web
		address a member typed in. That server sees your network address, as any website you visit does.
	</p>
</article>

<style>
	.prose {
		max-width: 42rem;
		padding-top: 1.5rem;
	}
	h2 {
		margin-top: 1.75rem;
		font-size: var(--t-lead);
	}
	li {
		margin: 0.35rem 0;
	}
</style>
