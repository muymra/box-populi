<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Join a group · {data.instanceName}</title></svelte:head>

<section class="narrow">
	{#if data.state === 'limited'}
		<h1>Too many tries</h1>
		<p>This network tried too many codes that didn't match. Wait ten minutes, then try again.</p>
	{:else if data.state === 'not_found'}
		<h1>No group with that code</h1>
		<p>Check the code with whoever shared it. Codes are five letters and numbers, like K7M4P.</p>
		<a class="btn" href="/join">Try another code</a>
	{:else if data.state === 'refused'}
		<h1>{data.groupName}</h1>
		<p class="banner">{data.refusal}</p>
	{:else}
		<h1>Join {data.groupName}</h1>
		<p class="muted">{data.memberCount} {data.memberCount === 1 ? 'member' : 'members'} so far.</p>
		<form method="POST" class="stack">
			{#if data.needsName}
				<label>
					Your name
					<input class="field" name="displayName" required maxlength="40" autocomplete="nickname" placeholder="How the group knows you" value={form?.displayName ?? ''} />
					<span class="hint">No account or email needed. This device will remember you.</span>
				</label>
			{/if}
			{#if form?.error}<p class="banner error" role="alert">{form.error}</p>{/if}
			<button class="btn primary">Join group</button>
		</form>
	{/if}
</section>
