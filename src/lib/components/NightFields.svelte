<script lang="ts">
	// The fields of a game night (PRD "Game night"): name, date, start time and where. Shared by
	// planning a night and editing one.
	type Member = { id: string; name: string };
	let {
		members,
		values = {}
	}: { members: Member[]; values?: { name?: string; nightOn?: string; startsAt?: string | null; host?: string | null } } = $props();
	const id = $props.id();
</script>

<div class="fields">
	<label for="{id}-name">Name</label>
	<input id="{id}-name" class="field" name="name" maxlength="60" required placeholder="Café" value={values.name ?? ''} autocomplete="off" />
	<div class="pair">
		<div>
			<label for="{id}-date">Date</label>
			<input id="{id}-date" class="field" type="date" name="nightOn" required value={values.nightOn ?? ''} />
		</div>
		<div>
			<label for="{id}-time">Starts <span class="muted">(optional)</span></label>
			<input id="{id}-time" class="field" type="time" name="startsAt" value={values.startsAt ?? ''} />
		</div>
	</div>
	<label for="{id}-host">Where</label>
	<select id="{id}-host" class="field" name="host" value={values.host ?? ''}>
		<option value="">Somewhere else: only brought games</option>
		{#each members as m (m.id)}<option value={m.id}>At {m.name}’s: their shelf counts too</option>{/each}
	</select>
</div>

<style>
	.fields {
		display: grid;
		gap: 6px;
		max-width: 30rem;
	}
	label {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
		margin-top: var(--s-2);
	}
	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-3);
	}
	.pair > div {
		display: grid;
		gap: 6px;
	}
</style>
