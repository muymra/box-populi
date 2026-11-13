<script lang="ts">
	import { say } from '#lib/announce.svelte.ts';

	let { text, label = 'Copy', small = false }: { text: string; label?: string; small?: boolean } = $props();
	let said = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** The older way, for where the clipboard API is missing or refused (a page served over http). */
	function copyByHand(): boolean {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		try {
			return document.execCommand('copy');
		} catch {
			return false;
		} finally {
			area.remove();
		}
	}

	async function copy() {
		let ok = false;
		try {
			await navigator.clipboard.writeText(text);
			ok = true;
		} catch {
			ok = copyByHand();
		}
		said = ok ? 'Copied' : 'Couldn’t copy';
		// Read out through the app's status region: a button's content is presentational, so a live
		// region on the button itself isn't reliably announced.
		say(said);
		clearTimeout(timer);
		timer = setTimeout(() => (said = null), ok ? 2000 : 4000);
		// Nothing reached the clipboard: show the text, so it can be copied from there by hand.
		if (!ok) window.prompt('Copy this:', text);
	}
</script>

<button type="button" class="btn" class:small onclick={copy}>{said ?? label}</button>
