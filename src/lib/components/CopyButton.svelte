<script lang="ts">
	let { text, label = 'Copy', small = false }: { text: string; label?: string; small?: boolean } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked (http, old browser): the text stays selectable on the page.
		}
	}
</script>

<button type="button" class="btn" class:small onclick={copy} aria-live="polite">{copied ? 'Copied' : label}</button>
