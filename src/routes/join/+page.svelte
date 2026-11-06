<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Join a group · {data.instanceName}</title></svelte:head>

<section class="narrow">
	<h1>Join a group</h1>
	<p class="muted">Enter the code someone in the group shared with you.</p>
	<form method="POST" class="stack">
		<label>
			Group code
			<input class="field code-input" name="code" required maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7M4P" value={form?.code ?? ''} />
		</label>
		{#if form?.error}<p class="banner error" role="alert">{form.error}</p>{/if}
		<button class="btn primary">Continue</button>
	</form>
</section>
