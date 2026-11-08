<script lang="ts">
	// A sign-in link's landing (D25, D46). Opening the link only asks; the button signs in, so a chat
	// app's preview can't. The panel says whose link it is and which groups it opens.
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
</script>

<svelte:head>
	<title>Sign in · {data.instanceName}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-col">
	{#if data.state === 'limited'}
		<header>
			<h1>Too many tries</h1>
			<p class="muted">This network tried too many links that didn’t work. Wait an hour, then try again.</p>
		</header>
	{:else if data.state === 'invalid'}
		<header>
			<h1>This link doesn’t work</h1>
			<p class="muted">It may have been replaced by a newer one.</p>
		</header>
		<div class="steps">
			<p>Open your group’s link instead, tap your name and type your PIN. Or make a new sign-in link on a device where you’re still signed in.</p>
			<p>Otherwise, <a href="/join">join your group again with its code</a> and ask a group admin to remove your old entry.</p>
		</div>
	{:else if data.alreadyYou}
		<header>
			<h1>You’re already signed in as {data.name}</h1>
			<p class="muted">This device remembers you; the link isn’t needed here.</p>
		</header>
		<div class="next"><a class="btn primary" href="/">Go to your groups</a></div>
	{:else}
		<header>
			<h1>Sign in as {data.name}?</h1>
			<p class="muted">Nothing changes until you press the button.</p>
		</header>
		<form method="POST" class="form-panel">
			<div class="form-head">
				<div class="who">
					<span class="key" aria-hidden="true"><KeyRound size={22} /></span>
					<div>
						<h2>{data.name}</h2>
						<p>{data.groups.length ? `In ${list(data.groups)}` : 'Not in a group yet'}</p>
					</div>
				</div>
			</div>
			{#if data.switchingFrom}
				<div class="form-block"><p class="banner">This device is signed in as {data.switchingFrom}. Signing in switches it to {data.name}.</p></div>
			{/if}
			{#if form?.error}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
			<div class="form-foot">
				<div><button class="btn primary">Sign in as {data.name} on this device</button></div>
				<p class="hint">This device will remember you after this.</p>
			</div>
		</form>
		<p class="muted not-you">
			Not {data.name}? Close this page. If someone sent you their link by mistake, they should make a new one on their account page, which stops this one working.
		</p>
	{/if}
</div>

<style>
	.who {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.who h2,
	.who p {
		margin: 0;
	}
	/* The key on the cube, as on every sign-in link panel: this is a person's own way in. */
	.key {
		display: grid;
		place-items: center;
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: var(--r-ctl);
		background: var(--laminate);
		box-shadow: inset 0 0 0 1px var(--rule);
		color: var(--ink);
	}
	.form-foot .hint,
	.not-you,
	.steps p {
		margin: 0;
	}
	.steps {
		display: grid;
		gap: var(--s-2);
	}
	.not-you {
		font-size: var(--t-small);
	}
</style>
