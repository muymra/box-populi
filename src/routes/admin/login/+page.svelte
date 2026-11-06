<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Admin sign-in</title></svelte:head>

<div class="narrow">
	<h1>Admin sign-in</h1>
	<p class="muted">For whoever runs this instance. Enter the <code>ADMIN_KEY</code> secret you set when deploying.</p>
	<form method="POST" class="stack">
		<label>
			Admin key
			<input class="field" name="key" type="password" required autocomplete="current-password" spellcheck="false" />
		</label>
		{#if form?.error}<p class="banner error" role="alert">{form.error}</p>{/if}
		<button class="btn primary">Sign in</button>
	</form>
	<p class="hint">Signing in here grants nothing inside groups. It lasts 12 hours on this device.</p>
</div>
