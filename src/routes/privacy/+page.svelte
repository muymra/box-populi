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
		<li>The games you add, your notes on them, loans, wishlist and the groups you're in.</li>
		<li>Links you add to games, credited to you within that group.</li>
		<li>A cookie that keeps this device signed in. The server stores only a scrambled fingerprint of it, and the same for your personal link.</li>
		<li>Network addresses that tried wrong join codes or links, kept for at most a day to slow down guessing.</li>
	</ul>
	<p>There are no accounts, emails or passwords. If you import from BoardGameGeek, your BGG username is used for that one request and not stored.</p>

	<h2>Who can see it</h2>
	<p>
		Members of a group see that group's catalog and each other's names and pictures. Nobody outside a
		group can see inside it. The demo group is the exception: it's public and contains no real people.
	</p>
	<p>
		The host's admin page shows totals and, per group, its name, size and last activity. It doesn't show
		members, join codes or collections. The host does run the database, though, and could read
		it directly. Every action the host takes through the admin page is logged.
	</p>

	<h2>Deleting your data</h2>
	<p>
		You can delete your account from your account page. That removes your name, games, wishlist,
		memberships and sessions; links you added stay, credited to "former member." The host has no email or
		other way to find you, so do it from a device where you're signed in.
	</p>

	<h2>Game data</h2>
	<p>
		Game information and images come from <a href="https://boardgamegeek.com">BoardGameGeek</a> and are
		shown as BGG provides them. Box Populi is not affiliated with or endorsed by BoardGameGeek.
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
