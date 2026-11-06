<!-- Shows a freshly made personal link once (DECISIONS D25). The page around it sends no-store and a same-origin referrer policy. -->
<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	let { link }: { link: string } = $props();
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
</script>

<div class="personal-link">
	<p class="label">Your personal link</p>
	<input readonly value={link} aria-label="Your personal link" onfocus={(e) => e.currentTarget.select()} />
	<div class="actions">
		<CopyButton text={link} label="Copy link" />
		{#if canShare}
			<button type="button" class="btn" onclick={() => navigator.share({ title: 'My Box Populi link', url: link }).catch(() => {})}>Share to myself</button>
		{/if}
	</div>
	<ul >
		<li>Save it in your password manager or notes, or send it to yourself.</li>
		<li>Anyone with it can act as you. Don't post it in the group chat.</li>
		<li>This is the only time it's shown. You can make a new one from your account page, which stops this one working.</li>
	</ul>
</div>

<style>
	.personal-link {
		border: 1px solid var(--rule);
		background: var(--cube);
		border-radius: 10px;
		padding: var(--s-4);
		margin: var(--s-4) 0 var(--s-5);
	}
	.label {
		font-weight: 700;
		margin: 0 0 var(--s-2);
	}
	input {
		width: 100%;
		font-size: var(--t-small);
		min-height: 42px;
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
