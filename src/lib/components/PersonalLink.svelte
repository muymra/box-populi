<!-- Shows a freshly made sign-in link (the "personal link" of DECISIONS D25) once. The page around it sends no-store and a same-origin referrer policy. -->
<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import CopyButton from './CopyButton.svelte';

	let { link }: { link: string } = $props();
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
</script>

<div class="personal-link">
	<p class="label"><KeyRound size={18} aria-hidden="true" /> Your sign-in link <span class="tag">Only for you</span></p>
	<input readonly value={link} aria-label="Your sign-in link" onfocus={(e) => e.currentTarget.select()} />
	<div class="actions">
		<CopyButton text={link} label="Copy link" />
		{#if canShare}
			<button type="button" class="btn" onclick={() => navigator.share({ title: 'My Box Populi sign-in link', url: link }).catch(() => {})}>Share to myself</button>
		{/if}
	</div>
	<ul >
		<li>Save it in your password manager or notes, or send it to yourself.</li>
		<li>It signs in as you, so keep it out of the group chat. To invite people, share the group's code.</li>
		<li>It's shown only now. Your account page can make a new one, which stops this one working.</li>
	</ul>
</div>

<style>
	.personal-link {
		border: 1px solid var(--rule);
		background: var(--cube);
		border-radius: 10px;
		padding: var(--s-4);
	}
	.label {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		font-weight: 700;
		margin: 0 0 var(--s-2);
	}
	input {
		width: 100%;
		font-size: var(--t-small);
		min-height: max(42px, var(--tap));
		padding: 0 var(--s-3);
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--laminate);
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin: var(--s-3) 0;
	}
	ul {
		margin: 0;
		padding-left: 1.1rem;
		font-size: var(--t-body);
		color: var(--ink-2);
	}
	li + li {
		margin-top: 4px;
	}
</style>
