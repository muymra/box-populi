<script lang="ts">
	// Creating a group: its name and, for someone new, theirs. Then the ready page, with the code to
	// invite people (D46).
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Create a group · {data.instanceName}</title></svelte:head>

<div class="create">
	<header>
		<h1>Create a group</h1>
		<p class="muted">One shelf for everything your group owns. Next you’ll get a code to invite them.</p>
	</header>
	{#if data.creationClosed}
		<p class="banner">On this site, only the host creates groups. Ask them for a join code, then <a href="/join">join here</a>.</p>
	{:else}
		<form method="POST" class="form-panel">
			<div class="form-row">
				<div class="form-label"><label class="form-q" for="groupName">Group name</label></div>
				<div class="form-body">
					<input id="groupName" class="field" name="groupName" required maxlength="60" autocomplete="off" placeholder="Thursday board game night" value={form?.groupName ?? ''} />
				</div>
			</div>
			{#if data.needsName}
				<div class="form-row">
					<div class="form-label">
						<label class="form-q" for="displayName">Your name</label>
						<span class="hint">How the group knows you. No email or password.</span>
					</div>
					<div class="form-body">
						<input id="displayName" class="field" name="displayName" required maxlength="40" autocomplete="nickname" placeholder="Ada" value={form?.displayName ?? ''} />
					</div>
				</div>
			{/if}
			{#if form?.error}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
			<div class="form-foot indent">
				<div><button class="btn primary">Next: invite people <ArrowRight size={18} aria-hidden="true" /></button></div>
			</div>
		</form>
	{/if}
</div>

<style>
	.create {
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
		max-width: 28rem;
	}
</style>
