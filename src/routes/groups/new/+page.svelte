<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Create a group · {data.instanceName}</title></svelte:head>

<section class="narrow">
	<h1>Create a group</h1>
	{#if data.creationClosed}
		<p class="banner">On this site, only the host creates groups. Ask them for a join code, then <a href="/join">join here</a>.</p>
	{:else}
		<p class="muted">You'll get a five-letter code to share with your friends.</p>
		<form method="POST" class="stack">
			<label>
				Group name
				<input class="field" name="groupName" required maxlength="60" autocomplete="off" placeholder="Thursday board game night" value={form?.groupName ?? ''} />
			</label>
			{#if data.needsName}
				<label>
					Your name
					<input class="field" name="displayName" required maxlength="40" autocomplete="nickname" placeholder="How the group knows you" value={form?.displayName ?? ''} />
					<span class="hint">No account or email needed. This device will remember you.</span>
				</label>
			{/if}
			{#if form?.error}<p class="banner error" role="alert">{form.error}</p>{/if}
			<button class="btn primary">Create group</button>
		</form>
	{/if}
</section>
