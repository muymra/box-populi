<script lang="ts">
	// The fields of a game night (PRD "Game night"): name, date, start time, where, and a description
	// with pictures (D77), as rows of a form panel (app.css). Shared by planning a night and editing
	// one; the caller supplies the panel and its foot.
	import { untrack } from 'svelte';
	import DayGrid from './DayGrid.svelte';
	import { startTimes } from '#lib/days.ts';
	import { MAX_NIGHT_DESCRIPTION, MAX_NIGHT_PICTURES } from '#lib/nights.ts';
	import { nightOf } from '#lib/table/regulars.ts';

	/** `active` false: waiting to be let in or suspended (D79), so not offered as a host. */
	type Member = { id: string; name: string; active?: boolean };
	let {
		members: everyone,
		values = {},
		planned = [],
		editing,
		me = null
	}: {
		members: Member[];
		values?: { name?: string; nightOn?: string; startsAt?: string | null; host?: string | null; description?: string | null; pictures?: string | null };
		/** The group's nights, shown on the day grid so a second one isn't planned over them unseen. */
		planned?: Array<{ id: string; name: string; nightOn: string }>;
		/** The night being edited, left off the grid's marks. */
		editing?: string;
		/** The viewer, offered first as the host. */
		me?: string | null;
	} = $props();
	const id = $props.id();
	// Hosts to pick from: members who can take part, and a night's own host when it's being edited.
	const members = $derived(everyone.filter((m) => m.active !== false || m.id === values.host));

	let nightOn = $state(untrack(() => values.nightOn ?? nightOf(Date.now())));
	// Planning looks ahead; an older night being edited can stay on its own date.
	const min = $derived(values.nightOn && values.nightOn < nightOf(Date.now()) ? values.nightOn : 'today');
	const marks = $derived(
		planned
			.filter((n) => n.id !== editing)
			.reduce<Record<string, string>>((all, n) => ({ ...all, [n.nightOn]: all[n.nightOn] ? `${all[n.nightOn]} and ${n.name}` : n.name }), {})
	);

	// Most nights start in the evening: three times one tap away, the rest of the half hours behind "Other time".
	const QUICK = ['19:00', '19:30', '20:00'];
	let startsAt = $state(untrack(() => values.startsAt ?? ''));
	let otherTime = $state(untrack(() => !['', ...QUICK].includes(values.startsAt ?? '')));

	// Where, as in Play tonight's "Whose games": two choices, then "Whose?" once it's someone's home.
	let host = $state(untrack(() => values.host ?? ''));
	let atHome = $state(untrack(() => !!values.host));
	const hostName = $derived(members.find((m) => m.id === host)?.name ?? null);
	function chooseHome() {
		atHome = true;
		if (!host) host = members.find((m) => m.id === me)?.id ?? members[0]?.id ?? '';
	}

	// Pictures are addresses of pictures already online (D77); folded until a night has some.
	let showPictures = $state(untrack(() => !!values.pictures));
</script>

<div class="form-row">
	<div class="form-label"><label class="form-q" for="{id}-name">Name</label></div>
	<div class="form-body">
		<input id="{id}-name" class="field" name="name" maxlength="60" required placeholder="Café" value={values.name ?? ''} autocomplete="off" />
	</div>
</div>
<div class="form-row" role="group" aria-labelledby="{id}-when">
	<div class="form-label"><span id="{id}-when" class="form-q">When</span></div>
	<div class="form-body when">
		<DayGrid name="nightOn" bind:value={nightOn} {min} {marks} look="ahead" label="Date of the night" required />
		<div class="form-sub">
			<span id="{id}-starts">Starts</span>
			<div class="choice-chips" role="radiogroup" aria-labelledby="{id}-starts">
				<label><input type="radio" name="{id}-time" value="" bind:group={startsAt} />No set time</label>
				{#each QUICK as t (t)}<label><input type="radio" name="{id}-time" value={t} bind:group={startsAt} /><span class="num">{t}</span></label>{/each}
				{#if !otherTime}<button type="button" aria-label="Other start time" onclick={() => (otherTime = true)}>Other…</button>{/if}
			</div>
			{#if otherTime}
				<select class="field time" aria-labelledby="{id}-starts" bind:value={startsAt}>
					<option value="">No set time</option>
					{#each startTimes(values.startsAt) as t (t)}<option value={t}>{t}</option>{/each}
				</select>
			{/if}
			<input type="hidden" name="startsAt" value={startsAt} />
		</div>
	</div>
</div>
<div class="form-row" role="group" aria-labelledby="{id}-where">
	<div class="form-label"><span id="{id}-where" class="form-q">Where</span></div>
	<div class="form-body">
		<div class="segments-row">
			<div class="segments" role="radiogroup" aria-labelledby="{id}-where" aria-describedby="{id}-where-hint">
				<label><input type="radio" name="{id}-where" checked={!atHome} onchange={() => (atHome = false)} /><span>Somewhere else</span></label>
				<label class:off={!members.length}
					><input type="radio" name="{id}-where" checked={atHome} disabled={!members.length} onchange={chooseHome} /><span>At someone’s home</span></label
				>
			</div>
			{#if atHome}
				<label class="segments-pick">
					<span>Whose?</span>
					<select class="field" bind:value={host}>
						{#each members as m (m.id)}<option value={m.id}>{m.name}’s</option>{/each}
					</select>
				</label>
			{/if}
		</div>
		<p class="hint" id="{id}-where-hint">
			{#if atHome && hostName}
				{hostName}’s whole shelf counts on the night, plus anything people bring.
			{:else}
				A café, a club, anywhere else: only the games people bring count.
			{/if}
		</p>
		<input type="hidden" name="host" value={atHome ? host : ''} />
	</div>
</div>
<div class="form-row">
	<div class="form-label">
		<label class="form-q" for="{id}-description">Description</label>
		<span class="hint">Optional</span>
	</div>
	<div class="form-body">
		<textarea
			id="{id}-description"
			class="field"
			name="description"
			rows="4"
			maxlength={MAX_NIGHT_DESCRIPTION}
			placeholder="What to bring, where to park, the doorbell…"
			value={values.description ?? ''}
		></textarea>
		{#if showPictures}
			<label class="form-sub">
				<span>Pictures</span>
				<textarea
					class="field"
					name="pictures"
					rows="2"
					placeholder="https://…"
					autocomplete="off"
					spellcheck="false"
					wrap="off"
					aria-describedby="{id}-pictures-hint"
					value={values.pictures ?? ''}
				></textarea>
			</label>
			<p class="hint" id="{id}-pictures-hint">The web address of each picture, one per line, up to {MAX_NIGHT_PICTURES}. They show on the night’s page, loaded from where they’re kept.</p>
		{:else}
			<button type="button" class="link-button add-pictures" onclick={() => (showPictures = true)}>Add pictures…</button>
		{/if}
	</div>
</div>

<style>
	.field {
		max-width: 28rem;
	}
	.when {
		gap: var(--s-4);
	}
	.time {
		max-width: 14rem;
		margin-top: var(--s-1);
	}
	textarea.field {
		padding: var(--s-2) var(--s-3);
		resize: vertical;
	}
	.add-pictures {
		justify-self: start;
	}
	.when .form-sub {
		gap: var(--s-2);
	}
</style>
