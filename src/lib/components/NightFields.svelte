<script lang="ts">
	// The fields of a game night (PRD "Game night"): name, date, start time and where, as rows of a
	// form panel (app.css). Shared by planning a night and editing one; the caller supplies the panel
	// and its foot.
	type Member = { id: string; name: string };
	let {
		members,
		values = {}
	}: { members: Member[]; values?: { name?: string; nightOn?: string; startsAt?: string | null; host?: string | null } } = $props();
	const id = $props.id();
</script>

<div class="form-row">
	<div class="form-label"><label class="form-q" for="{id}-name">Name</label></div>
	<div class="form-body">
		<input id="{id}-name" class="field" name="name" maxlength="60" required placeholder="Café" value={values.name ?? ''} autocomplete="off" />
	</div>
</div>
<div class="form-row" role="group" aria-labelledby="{id}-when">
	<div class="form-label"><span id="{id}-when" class="form-q">When</span></div>
	<div class="form-body pair">
		<label class="form-sub">
			Date
			<input class="field" type="date" name="nightOn" required value={values.nightOn ?? ''} />
		</label>
		<label class="form-sub">
			<span>Starts <span class="optional">(optional)</span></span>
			<input class="field" type="time" name="startsAt" value={values.startsAt ?? ''} />
		</label>
	</div>
</div>
<div class="form-row">
	<div class="form-label">
		<label class="form-q" for="{id}-host">Where</label>
		<span class="hint">At someone’s home, their whole shelf counts on the night.</span>
	</div>
	<div class="form-body">
		<select id="{id}-host" class="field" name="host" value={values.host ?? ''}>
			<option value="">Somewhere else: only brought games</option>
			{#each members as m (m.id)}<option value={m.id}>At {m.name}’s: their shelf counts too</option>{/each}
		</select>
	</div>
</div>

<style>
	.field {
		max-width: 28rem;
	}
	.pair {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		max-width: 28rem;
	}
	.optional {
		font-weight: 400;
	}
</style>
