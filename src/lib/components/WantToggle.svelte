<script lang="ts">
	// "Me too" on the Wanted page: puts the game on your wishlist or takes it off. Marigold once it's on
	// your list (Marigold Means Chosen).
	import { enhance } from '$app/forms';
	let { id, name, mine }: { id: number; name: string; mine: boolean } = $props();
</script>

<form method="POST" action="?/want" use:enhance>
	<input type="hidden" name="gameId" value={id} />
	<input type="hidden" name="on" value={mine ? '0' : '1'} />
	<button class="want" aria-pressed={mine} aria-label="{mine ? 'Take off my wishlist' : 'I want this too'}: {name}">{mine ? 'On your list' : 'Me too'}</button>
</form>

<style>
	.want {
		min-height: 36px;
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
	.want:hover {
		border-color: var(--ink-3);
	}
	.want[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
</style>
