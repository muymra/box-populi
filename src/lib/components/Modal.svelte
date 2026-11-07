<script lang="ts">
	// A native <dialog> above the current page (DESIGN.md "Modals"): a sheet from the bottom on phones,
	// a centred panel from 760px. Escape, the close button and a tap outside close it. The content stays
	// mounted while closed, so a roll or a pick is still there when it opens again.
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';

	let { open = $bindable(false), title, children }: { open: boolean; title: string; children: Snippet } = $props();
	const id = $props.id();
	let dialog: HTMLDialogElement;
	// A press that starts inside and ends outside (selecting text, dragging a finger) shouldn't close it.
	let pressedOutside = false;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="{id}-title"
	onclose={() => (open = false)}
	onpointerdown={(e) => (pressedOutside = e.target === dialog)}
	onclick={(e) => {
		if (e.target === dialog && pressedOutside) open = false;
	}}
>
	<div class="sheet">
		<header>
			<h2 id="{id}-title">{title}</h2>
			<button type="button" class="close" aria-label="Close" onclick={() => (open = false)}><X size={22} aria-hidden="true" /></button>
		</header>
		<div class="content">{@render children()}</div>
	</div>
</dialog>

<style>
	dialog {
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		/* phones: a sheet on the bottom edge, within thumb reach */
		margin: auto 0 0;
		width: 100%;
		max-width: 100%;
		max-height: 88dvh;
	}
	dialog::backdrop {
		background: rgb(20 18 16 / 0.5);
	}
	:global(html:has(dialog[open])) {
		overflow: hidden;
	}
	.sheet {
		display: flex;
		flex-direction: column;
		max-height: 88dvh;
		background: var(--cube);
		border: 1px solid var(--rule);
		border-bottom: 0;
		border-radius: 10px 10px 0 0;
		padding-bottom: env(safe-area-inset-bottom);
	}
	dialog[open] .sheet {
		animation: rise 0.28s var(--ease-out);
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-3) var(--s-2) var(--s-5);
	}
	h2 {
		flex: 1;
		margin: 0;
	}
	.close {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}
	.close:hover {
		background: var(--gap);
		color: var(--ink);
	}
	.content {
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--s-2) var(--s-5) var(--s-5);
	}
	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}
	@media (min-width: 760px) {
		dialog {
			margin: auto;
			width: min(30rem, 100% - 2 * var(--s-4));
		}
		.sheet {
			border-bottom: 1px solid var(--rule);
			border-radius: 10px;
			padding-bottom: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		dialog[open] .sheet {
			animation: none;
		}
	}
</style>
