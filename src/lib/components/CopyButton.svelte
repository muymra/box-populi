<script lang="ts">
	let { text, label = 'Copy' }: { text: string; label?: string } = $props();
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

<button type="button" class="btn" onclick={copy} aria-live="polite">{copied ? 'Copied' : label}</button>
