<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<section class="hero">
	<h1>Your group's board games, in one place</h1>
	<p class="lede">
		Everyone adds the games they own. Then search the whole group's shelf by player count, play time,
		complexity, mechanics and theme, see who owns what, and get three suggestions for the people who
		showed up tonight.
	</p>
	<div class="actions">
		{#if data.demoExists}
			<a class="btn primary" href="/demo">See a demo group</a>
		{/if}
		{#if !data.user}
			<a class="btn" href="/signin">Sign in</a>
		{/if}
	</div>
</section>

<style>
	.hero {
		padding: 3rem 0 1rem;
		max-width: 40rem;
	}
	h1 {
		font-size: clamp(1.8rem, 5vw, 2.6rem);
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
</style>
