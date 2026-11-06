<!-- Shows a freshly made personal link once (DECISIONS D25). The page around it sends no-store and no-referrer. -->
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
	<ul class="muted">
		<li>Save it in your password manager or notes, or send it to yourself.</li>
		<li>Anyone with it can act as you. Don't post it in the group chat.</li>
		<li>This is the only time it's shown. You can make a new one from your account page, which stops this one working.</li>
	</ul>
</div>

<style>
	.personal-link {
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		margin: 1rem 0 1.25rem;
	}
	.label {
		font-weight: 600;
		margin: 0 0 0.4rem;
	}
	input {
		width: 100%;
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.6rem 0;
	}
	ul {
		margin: 0.25rem 0 0;
		padding-left: 1.1rem;
		font-size: 0.92rem;
	}
</style>
