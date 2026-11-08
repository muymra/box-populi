<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import NightFields from '#lib/components/NightFields.svelte';
	import { nightOf } from '#lib/table/regulars.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let sending = $state(false);
</script>

<svelte:head><title>Plan a game night · {data.group.name}</title></svelte:head>

<div class="plan">
	<header>
		<h1>Plan a game night</h1>
		<p class="muted">Pick when and where first. Next you’ll mark who’s going and what they’ll bring; everyone in the group sees the plan.</p>
	</header>
	{#if form?.error}<p class="banner error" role="alert">{form.error}</p>{/if}
	<form method="POST" class="form-panel" onsubmit={() => (sending = true)}>
		<NightFields
			members={data.tableMembers}
			planned={data.nights}
			me={data.myId}
			values={form?.entered
				? { name: form.entered.name, nightOn: form.entered.nightOn, startsAt: form.entered.startsAt, host: form.entered.host }
				: { name: 'Game night', nightOn: nightOf(Date.now()) }}
		/>
		<div class="form-foot indent">
			<div><button class="btn primary" disabled={sending}>Next: who’s going <ArrowRight size={18} aria-hidden="true" /></button></div>
		</div>
	</form>
</div>

<style>
	.plan {
		display: grid;
		gap: var(--s-5);
		max-width: 46rem;
		padding: var(--s-5) 0 var(--s-6);
	}
	header p {
		margin: 0;
	}
</style>
