<script lang="ts">
	// The host's sign-in for /admin, in the same form panel as the admin page.
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Admin sign-in</title></svelte:head>

<div class="admin-login">
	<header>
		<h1>Admin sign-in</h1>
		<p class="muted">For whoever runs this instance. Signing in here grants nothing inside groups.</p>
	</header>
	<form method="POST" class="form-panel">
		<div class="form-row">
			<div class="form-label">
				<label class="form-q" for="key">Admin key</label>
				<span class="hint">The <code>ADMIN_KEY</code> secret set when deploying.</span>
			</div>
			<div class="form-body">
				<input id="key" class="field" name="key" type="password" required autocomplete="current-password" spellcheck="false" />
			</div>
		</div>
		{#if form?.error}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
		<div class="form-foot indent">
			<div><button class="btn primary">Sign in</button></div>
			<p class="hint">Lasts {data.hours} {data.hours === 1 ? 'hour' : 'hours'} on this device.</p>
		</div>
	</form>
</div>

<style>
	.admin-login {
		display: grid;
		gap: var(--s-5);
		max-width: 46rem;
		padding: var(--s-5) 0 var(--s-6);
	}
	header h1 {
		margin: 0;
	}
	header p {
		margin: 6px 0 0;
	}
	.field {
		max-width: 22rem;
	}
	.form-foot .hint {
		margin: 0;
	}
</style>
