<script lang="ts">
	// Where a signed-out visitor lands (D46). Most are members on a new or cleared device, so the
	// sign-in link is the main door; joining and the demo are the other ways in, and joining is not
	// the primary button, so nobody already in a group is nudged into joining twice.
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Not signed in · {data.instanceName}</title></svelte:head>

<div class="doors-page">
	<header>
		<h1>You’re not signed in on this device</h1>
		<p class="muted">There are no passwords. Each device remembers you once you’ve signed in on it.</p>
	</header>

	<div class="doors">
		<section class="form-panel" aria-labelledby="link-h">
			<div class="form-head">
				<div>
					<h2 id="link-h" class="with-icon"><KeyRound size={20} aria-hidden="true" /> Already in a group?</h2>
					<p>Open your <strong>sign-in link</strong> on this device. It was on the page you saw after you joined.</p>
				</div>
			</div>
			<div class="form-block">
				<p><strong>Lost it?</strong> On a device where you’re still signed in, go to Your account and make a new sign-in link. It replaces the old one.</p>
				<p><strong>No device left?</strong> Join again with your group’s code, and ask a group admin to remove your old entry.</p>
			</div>
		</section>

		<div class="other-door">
			<section aria-labelledby="new-h">
				<h2 id="new-h">New here?</h2>
				<p>Join with the code someone in your group shares, or start a group of your own.</p>
				<div class="row">
					<a class="btn" href="/join">Join with a code</a>
					<a class="btn" href="/groups/new">Create a group</a>
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
