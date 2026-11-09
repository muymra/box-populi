<script lang="ts">
	// The group's code opens its front door (D46, D47), for joining and for coming back on a new device.
	import { tidyCode } from '#lib/codes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Join a group · {data.instanceName}</title></svelte:head>

<div class="doors-page">
	<header>
		<h1>Join a group</h1>
		<p class="muted">Someone in the group can find its code on the Group tab.</p>
	</header>

	<div class="doors">
		<form method="POST" class="form-panel" aria-labelledby="code-h">
			<div class="form-head">
				<div>
					<h2 id="code-h">Got a code?</h2>
					<p>Five letters and numbers, like K7M4P. An invite link has it built in.</p>
				</div>
			</div>
			<div class="form-row">
				<div class="form-label"><label class="form-q" for="code">Group code</label></div>
				<div class="form-body">
					<input
						id="code"
						class="field code-input"
						name="code"
						required
						maxlength="9"
						autocomplete="off"
						autocapitalize="characters"
						spellcheck="false"
						placeholder="K7M4P"
						value={form?.code ?? ''}
						oninput={(e) => (e.currentTarget.value = tidyCode(e.currentTarget.value))}
					/>
				</div>
			</div>
			{#if form?.error}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
			<div class="form-foot">
				<div><button class="btn primary">Continue</button></div>
			</div>
		</form>

		<section class="other-door" aria-labelledby="other-h">
			<h2 id="other-h">Already in the group, on a new device?</h2>
			<p>Use the code here too. On the next page, <strong>tap your name and type your PIN</strong>.</p>
			<p>Saved a sign-in link instead? Open it on this device.</p>
		</section>
	</div>
</div>

<style>
	.code-input {
		max-width: 12rem;
	}
</style>
