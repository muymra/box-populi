<script lang="ts">
	// Where a signed-out visitor lands (D46, D47). Most are members on a new or cleared device, so
	// getting back in is the main door: the group's link, your name, your PIN. Joining and the demo
	// are the other ways in, and joining is not the primary button.
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Not signed in · {data.instanceName}</title></svelte:head>

<div class="doors-page">
	<header>
		<h1>You’re not signed in on this device</h1>
		<p class="muted">No email or password: your name and a PIN. Each device remembers you once you’ve signed in on it.</p>
	</header>

	<div class="doors">
		<section class="form-panel" aria-labelledby="link-h">
			<div class="form-head">
				<div>
					<h2 id="link-h" class="with-icon"><KeyRound size={20} aria-hidden="true" /> Already in a group?</h2>
					<p>Open your group’s link, the one in your group chat, then <strong>tap your name and type your PIN</strong>.</p>
				</div>
			</div>
			<div class="form-block">
				<p><strong>No link to hand?</strong> <a href="/join">Type the group’s code</a> instead; it opens the same page.</p>
				<p><strong>Forgot your PIN?</strong> On a device where you’re still signed in, Your account sets a new one. Saved a sign-in link? Open it here.</p>
			</div>
		</section>

		<div class="other-door">
			<section aria-labelledby="new-h">
				<h2 id="new-h">New here?</h2>
				<p>{data.canCreate ? 'Join with the code someone in your group shares, or start a group of your own.' : 'Join with the code someone in your group shares.'}</p>
				<div class="row">
					<a class="btn" href="/join">Join with a code</a>
					{#if data.canCreate}<a class="btn" href="/groups/new">Create a group</a>{/if}
				</div>
			</section>
			<section aria-labelledby="look-h">
				<h2 id="look-h">Just looking?</h2>
				<p><a href="/demo">Open the demo group</a>: invented games and people, read-only.</p>
			</section>
		</div>
	</div>
</div>

<style>
	.with-icon {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.form-block p {
		margin: 0;
	}
	.form-block p + p {
		margin-top: var(--s-2);
	}
	.form-block strong {
		color: var(--ink);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-1);
	}
</style>
