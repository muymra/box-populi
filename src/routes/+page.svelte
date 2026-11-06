<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.groups.length}
	<section class="mine">
		<h1>Your groups</h1>
		<ul>
			{#each data.groups as g (g.id)}
				<li><a class="group" href="/g/{g.id}"><strong>{g.name}</strong><span class="muted">{g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}</span></a></li>
			{/each}
		</ul>
		<div class="actions">
			<a class="btn" href="/join">Join another group</a>
			{#if data.canCreate}<a class="btn" href="/groups/new">Create a group</a>{/if}
		</div>
	</section>
{:else}
	<section class="hero">
		<h1>Your group's board games, in one place</h1>
		<p class="lede">
			Everyone adds the games they own. Then search the whole group's shelf by player count, play time,
			complexity, mechanics and theme, see who owns what, and get three suggestions for the people who
			showed up tonight. No accounts or passwords: join with a code and your name.
		</p>
		<div class="actions">
			<a class="btn primary" href="/join">Join with a code</a>
			{#if data.canCreate}<a class="btn" href="/groups/new">Create a group</a>{/if}
			{#if data.demoExists}<a class="btn" href="/demo">See a demo group</a>{/if}
		</div>
	</section>
{/if}

<style>
	.hero {
		padding: 3rem 0 1rem;
		max-width: 40rem;
	}
	h1 {
		font-size: clamp(1.8rem, 5vw, 2.6rem);
	}
	.mine h1 {
		font-size: 1.6rem;
		margin-top: 1.5rem;
	}
	.lede {
		font-size: 1.1rem;
		color: var(--muted);
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 1.5rem;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: 0.6rem;
	}
	.group {
		display: flex;
		flex-direction: column;
		padding: 0.9rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	.group:hover {
		border-color: var(--accent);
	}
</style>
