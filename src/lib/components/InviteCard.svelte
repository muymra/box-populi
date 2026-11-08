<!--
	A group's invite: its join code large and the invite link with Copy, on the dark label surface,
	because it's the group's to share. The private sign-in link always sits on the cube instead, so
	the two never look alike (D46). Used on the Group tab and the page after creating a group.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CopyButton from './CopyButton.svelte';

	let {
		code,
		link,
		heading = 'Invite people',
		intro = 'Anyone with the code can join with just a name.',
		children
	}: { code: string; link: string; heading?: string; intro?: string; children?: Snippet } = $props();
	const id = $props.id();
</script>

<section class="invite-card" aria-labelledby="{id}-h">
	<h2 id="{id}-h">{heading}</h2>
	<p class="muted">{intro}</p>
	<div class="code num" aria-label="Join code {code.split('').join(' ')}">{code}</div>
	<p class="link">{link}</p>
	<div><CopyButton text={link} label="Copy invite link" /></div>
	{@render children?.()}
</section>

<style>
	.invite-card {
		display: grid;
		gap: var(--s-2);
		padding: var(--s-5);
		background: var(--label);
		color: var(--label-ink);
		border-radius: 10px;
	}
	h2,
	p {
		margin: 0;
	}
	.muted,
	.link {
		color: var(--label-ink-2);
	}
	.code {
		font-size: var(--t-display);
		font-weight: 800;
		letter-spacing: 0.22em;
		margin: var(--s-2) 0;
	}
	.link {
		font-size: var(--t-small);
		overflow-wrap: anywhere;
	}
	.invite-card :global(.link-button) {
		color: var(--label-ink);
	}
	.invite-card :global(:focus-visible) {
		outline-color: var(--mark);
	}
	.invite-card :global(.confirm) {
		margin-top: var(--s-4);
	}
</style>
