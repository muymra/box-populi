<script lang="ts">
	import NightFields from '#lib/components/NightFields.svelte';
	import { nightOf } from '#lib/table/regulars.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let sending = $state(false);
</script>

<svelte:head><title>Plan a game night · {data.group.name}</title></svelte:head>

<div class="narrow plan">
	<h1>Plan a game night</h1>
	<p class="muted">Pick when and where. Then mark who's going and what they'll bring; everyone in the group sees the plan.</p>
	{#if form?.error}<p class="banner error" role="alert">{form.error}</p>{/if}
	<form method="POST" onsubmit={() => (sending = true)}>
		<NightFields
			members={data.tableMembers}
			values={form?.entered
				? { name: form.entered.name, nightOn: form.entered.nightOn, startsAt: form.entered.startsAt, host: form.entered.host }
				: { name: 'Game night', nightOn: nightOf(Date.now()) }}
		/>
		<button class="btn primary" disabled={sending}>Plan it</button>
	</form>
</div>

<style>
	.plan {
		display: grid;
		gap: var(--s-4);
		padding-top: var(--s-4);
	}
	form {
		display: grid;
		gap: var(--s-5);
		justify-items: start;
	}
</style>
