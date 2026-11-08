<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Privacy · {data.instanceName}</title></svelte:head>

<div class="privacy">
<article class="prose">
	<h1>Privacy</h1>
	<p>
		{data.instanceName} is an instance of Box Populi, open-source software anyone can run. This instance
		is run by its host, who you can reach at <a href={data.contact}>{data.contactLabel}</a>.
	</p>

	<!-- The short version: the four things people ask, each answered in full below. -->
	<section class="short" aria-labelledby="short-h">
		<h2 id="short-h">The short version</h2>
		<ul>
			<li>No accounts, emails or passwords: a name you choose, a six-digit PIN, and a cookie on each device you use.</li>
			<li>The people in your groups see your name, games, loans, wishlist, plays and game nights. Nobody else does.</li>
			<li>The host's admin page shows counts, not people or collections. The host runs the database, though.</li>
			<li>You can delete your account at any time from your account page.</li>
		</ul>
	</section>

	<h2 id="stored">What's stored</h2>
	<ul>
		<li>The display name you choose. Members of your groups see it, and you can change it.</li>
		<li>
			The games you add, what you've lent or borrowed, your wishlist and the groups you're in. If you fill in a game's details, your
			name shows beside them to the groups you're in.
		</li>
		<li>Links you add to games, credited to you within that group.</li>
		<li>
			Plays logged in a group: the game, the date, who played, and places or scores. That includes the names of guests at
			the table who aren't members, as typed by whoever logged the play.
		</li>
		<li>
			Game nights planned in a group: the date and place, who's going or not, guests' names, and which games each person
			is bringing, including titles typed in for games that aren't on anyone's shelf.
		</li>
		<li>
			The six-digit PIN you choose, for getting back in through a group's link. The server stores only a scrambled fingerprint of
			it, never the digits.
		</li>
		<li>
			If your group's owner or a co-admin makes you a one-time sign-in code (or the host does, for a group's owner), its
			fingerprint, until you use it or ten minutes pass.
		</li>
		<li>A cookie that keeps this device signed in. The server stores only a scrambled fingerprint of it, and the same for your sign-in link.</li>
		<li>
			Network addresses that tried a wrong join code, PIN, sign-in link or admin key, or created a group, and how often you searched
			for games, matched a pasted list or imported from BoardGameGeek. These are kept for about a day, to slow down guessing
			and to stay within the game sources' limits.
		</li>
	</ul>
	<p>
		There are no accounts, emails or passwords.{#if data.bggOn}{' '}If you import from BoardGameGeek, your BGG username is used for that
			lookup and not stored.{/if}
	</p>

	<h2 id="who">Who can see it</h2>
	<p>
		Members of a group see each other's names, games, loans and wishlists, the links added to games, the group's game nights and its plays.
		Any member can download the plays and game nights as spreadsheet files, which name everyone in them. Anyone with a group's code sees
		its members' names on its join page, so they can tap their own. A group's owner and co-admins see who hasn't set a PIN yet.
		Nobody outside a group can see inside it. The demo group is the exception: it's public and contains no real people.
	</p>
	<p>
		The host's admin page shows totals and, per group, its name, the number of members, games, plays and game nights, and
		last activity. It doesn't show who is in a group, join codes or collections. The host can suspend a group, and delete one
		they have suspended, giving a reason,
		and every such action is logged. The host can also make a one-time sign-in code for a group's owner who has lost their
		way in, without seeing their name; that is logged with its reason too. The host does run the database, though, and could read it directly.
	</p>

	<h2 id="deleting">Taking and deleting your data</h2>
	<p>
		Your account page downloads your games and wishlist, and the plays and game nights you were in for each of your groups, as spreadsheet files. The games file
		pastes into any other Box Populi.
	</p>
	<p>
		You can delete your account from your account page. That removes your name, your shelf, wishlist, memberships and
		sessions, your results in logged plays, your answers and bring lists on game nights, and the games you typed in yourself. A typed-in game that another member also
		has, or that a logged play names, stays, without your name. Plays you were in stay for the others in them. Links you added stay, credited to "former member." The host has no email or other way to find you, so do it
		from a device where you're signed in.
	</p>

	<h2 id="games">Game data</h2>
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
<nav class="contents" aria-label="On this page">
	<p>On this page</p>
	<ul>
		<li><a href="#stored">What's stored</a></li>
		<li><a href="#who">Who can see it</a></li>
		<li><a href="#deleting">Taking and deleting your data</a></li>
		<li><a href="#games">Game data</a></li>
	</ul>
</nav>
</div>

<style>
	/* Read mode: one column of text at about 65 characters, the contents beside it from 900px. */
	.privacy {
		display: grid;
		gap: var(--s-5);
		padding: var(--s-5) 0 var(--s-6);
	}
	.prose {
		max-width: 42rem;
	}
	h1 {
		margin: 0 0 var(--s-3);
	}
	h2 {
		margin: var(--s-6) 0 var(--s-2);
		font-size: var(--t-lead);
		scroll-margin-top: var(--s-5);
	}
	li {
		margin: 0.35rem 0;
	}
	/* The short version: a laminate well, the same answers in a sentence each. */
	.short {
		margin-top: var(--s-5);
		padding: var(--s-4) var(--s-5);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.short h2 {
		margin: 0 0 var(--s-1);
	}
	.short ul {
		margin: 0;
		padding-left: 1.1rem;
	}
	.contents {
		display: none;
	}
	@media (min-width: 900px) {
		.privacy {
			grid-template-columns: minmax(0, 42rem) 12rem;
			column-gap: var(--s-7);
			align-items: start;
		}
		.contents {
			display: block;
			position: sticky;
			top: var(--s-5);
			padding-top: 3.5rem;
			font-size: var(--t-small);
		}
		.contents p {
			margin: 0 0 var(--s-2);
			font-weight: 700;
			color: var(--ink-2);
		}
		.contents ul {
			list-style: none;
			margin: 0;
			padding: 0;
			display: grid;
			gap: var(--s-1);
		}
	}
</style>
