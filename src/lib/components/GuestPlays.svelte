<!--
	Guest plays to a member (DECISIONS D37): the owner or a co-admin picks the names this member used
	as a guest, sees every play and night that would move, and unticks any that were someone else with
	the same name. Shown in the member's row on the Group tab.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { GuestHistory } from '#lib/server/guest-plays.ts';

	let { member, guests, onclose, done }: { member: { id: string; name: string }; guests: GuestHistory[]; onclose: () => void; done: SubmitFunction } = $props();

	// When the panel opens, a guest name the same as theirs comes ticked; anything else waits to be picked.
	let picked = $state<string[]>(untrack(() => guests.filter((g) => g.key === member.name.toLocaleLowerCase()).map((g) => g.key)));
	const chosen = $derived(guests.filter((g) => picked.includes(g.key)));
	const plays = $derived(chosen.flatMap((g) => g.plays).sort((a, b) => b.on.localeCompare(a.on)));
	const nights = $derived(chosen.flatMap((g) => g.nights).filter((n, i, all) => all.findIndex((x) => x.id === n.id) === i).sort((a, b) => b.on.localeCompare(a.on)));
	// Everything starts ticked; unticked ids stay unticked when another name is added.
	let unticked = $state<string[]>([]);
	const toggle = (id: string, on: boolean) => (unticked = on ? unticked.filter((x) => x !== id) : [...unticked, id]);
	const count = $derived(plays.filter((p) => !unticked.includes(p.id)).length + nights.filter((n) => !unticked.includes(n.id)).length);
	const date = (on: string) => new Date(`${on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
</script>

<p>If {member.name} came as a guest before joining, their guest plays can count for them. Pick the names they used.</p>
<form method="POST" action="?/guestPlays" use:enhance={done} class="guest-form">
	<input type="hidden" name="userId" value={member.id} />
	<fieldset>
		<legend class="visually-hidden">Guest names</legend>
		<div class="names">
			{#each guests as g (g.key)}
				<label class="name">
					<input type="checkbox" value={g.key} bind:group={picked} />
					<span><strong>{g.name}</strong> <span class="muted num">· {plural(g.plays.length, 'play', 'plays')}, {plural(g.nights.length, 'night', 'nights')}</span></span>
				</label>
			{/each}
		</div>
	</fieldset>
	{#each chosen as g (g.key)}{#each g.spellings as s (s)}<input type="hidden" name="name" value={s} />{/each}{/each}

	{#if plays.length || nights.length}
		<p class="hint">These move to {member.name}. Untick any that were someone else.</p>
		<ul class="items">
			{#each plays as p (p.id)}
				<li>
					<label><input type="checkbox" name="play" value={p.id} checked={!unticked.includes(p.id)} onchange={(e) => toggle(p.id, e.currentTarget.checked)} />
						<span><span class="num">{date(p.on)}</span> · {p.game}</span></label>
				</li>
			{/each}
			{#each nights as n (n.id)}
				<li>
					<label><input type="checkbox" name="night" value={n.id} checked={!unticked.includes(n.id)} onchange={(e) => toggle(n.id, e.currentTarget.checked)} />
						<span><span class="num">{date(n.on)}</span> · {n.name} <span class="muted">(game night)</span></span></label>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="cbtns">
		<button class="btn small" disabled={count === 0}>Move {count === 0 ? 'them' : plural(count, 'item', 'items')} to {member.name}</button>
		<button type="button" class="link-button" onclick={onclose}>Cancel</button>
	</div>
</form>

<style>
	.guest-form {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.names {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.name,
	.items label {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: max(36px, var(--tap));
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.hint {
		margin: 0;
	}
	.cbtns {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
</style>
