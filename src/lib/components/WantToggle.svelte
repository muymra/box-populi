<script lang="ts">
	// "Me too" on the Wanted page: puts the game on your wishlist, or on your Play soon list (D83), or
	// takes it off. Marigold once it's on your list (Marigold Means Chosen). A full Play soon list leaves
	// the pill disabled; the page says why.
	import { enhance } from '$app/forms';
	let {
		id,
		name,
		mine,
		action = 'want',
		disabled = false
	}: { id: number; name: string; mine: boolean; action?: 'want' | 'playSoon'; disabled?: boolean } = $props();

	const soon = $derived(action === 'playSoon');
	const label = $derived(mine ? (soon ? 'On Play soon' : 'On your list') : 'Me too');
	const said = $derived(
		soon ? (mine ? 'Take off my Play soon list' : 'I’d like to play this soon too') : mine ? 'Take off my wishlist' : 'I want this too'
	);
</script>

<form method="POST" action="?/{action}" use:enhance>
	<input type="hidden" name="gameId" value={id} />
	<input type="hidden" name="on" value={mine ? '0' : '1'} />
	<button class="want" aria-pressed={mine} aria-label="{said}: {name}" disabled={disabled && !mine}>{label}</button>
</form>

<style>
	.want {
		min-height: max(36px, var(--tap));
		padding: 0 14px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		color: var(--ink);
		font-size: var(--t-small);
		font-weight: 650;
		white-space: nowrap;
		cursor: pointer;
	}
	.want:hover:not(:disabled) {
		border-color: var(--ink-3);
	}
	.want:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.want[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
</style>
