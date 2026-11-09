<!--
	Your games in this group (D66): how many show here, the ones hidden from it, and "Hide new games
	here". Turning that on opens a pick list of your shelf: what's ticked shows, everything else and
	anything added later stays hidden from this group. Only you see this panel; the group just sees
	fewer games.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { normalize } from '#lib/catalog/normalize.ts';

	let {
		groupName,
		hideNew,
		games
	}: { groupName: string; hideNew: boolean; games: Array<{ id: number; name: string; hidden: boolean }> } = $props();

	const hidden = $derived(games.filter((g) => g.hidden));
	const shownCount = $derived(games.length - hidden.length);

	// The pick list: ticked games show here. Opened by turning the switch on, ticked with what shows now.
	let picking = $state(false);
	let picked = $state(new Set<number>());
	let filter = $state('');
	// The filter only hides rows, so ticks on games filtered out are kept and still sent.
	const visible = $derived.by(() => {
		const q = normalize(filter);
		return q ? new Set(games.filter((g) => normalize(g.name).includes(q)).map((g) => g.id)) : null;
	});
	function startPicking() {
		picked = new Set(games.filter((g) => !g.hidden).map((g) => g.id));
		filter = '';
		picking = true;
	}
	function tick(id: number, on: boolean) {
		const next = new Set(picked);
		if (on) next.add(id);
		else next.delete(id);
		picked = next;
	}
	const plural = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`;
</script>

<section class="form-panel shelf-here" aria-labelledby="shelf-here-h">
	<div class="form-head">
		<div>
			<h2 id="shelf-here-h">Your games in {groupName}</h2>
			<p>
				{#if hidden.length === 0}
					All {plural(games.length)} on your shelf show here. Hide any from their game page, or turn on “Hide new games here”.
				{:else}
					{shownCount} of your {plural(games.length)} show here. Nobody in {groupName} can see the other {hidden.length}, or that any are hidden.
				{/if}
			</p>
		</div>
	</div>

	{#if hidden.length > 0}
		<div class="form-row" role="group" aria-labelledby="hidden-q">
			<div class="form-label">
				<span id="hidden-q" class="form-q">Hidden here</span>
				<span class="hint">Your other groups still see them.</span>
			</div>
			<div class="form-body">
				<details class="fold">
					<summary class="link-button">See the {plural(hidden.length)}…</summary>
					<ul class="hidden-list">
						{#each hidden as g (g.id)}
							<li>
								<span class="name"><EyeOff size={16} aria-hidden="true" />{g.name}</span>
								<form method="POST" action="?/showHere" use:enhance>
									<input type="hidden" name="gameId" value={g.id} />
									<button class="btn small" aria-label="Show {g.name} in {groupName}">Show</button>
								</form>
							</li>
						{/each}
					</ul>
				</details>
			</div>
		</div>
	{/if}

	<div class="form-row" role="group" aria-labelledby="hide-new-q">
		<div class="form-label">
			<span id="hide-new-q" class="form-q">Hide new games here</span>
			<span class="hint">
				{hideNew ? 'On: games you add from now on start hidden in this group.' : 'Off: games you add show in every group you’re in.'}
			</span>
		</div>
		<div class="form-body">
			{#if hideNew}
				<form method="POST" action="?/hideNew" use:enhance class="inline">
					<input type="hidden" name="on" value="0" />
					<button class="btn">Turn off</button>
					<span class="hint">What’s hidden now stays hidden.</span>
				</form>
			{:else if !picking}
				<button type="button" class="btn" onclick={startPicking}>Turn on…</button>
			{/if}
			{#if picking && !hideNew}
				<form
					method="POST"
					action="?/hideNew"
					class="picker"
					use:enhance={() =>
						async ({ update }) => {
							await update({ reset: false });
							picking = false;
						}}
				>
					<input type="hidden" name="on" value="1" />
					<p>Which of your games should {groupName} see? Ticked games show. Everything else, and anything you add later, stays hidden here.</p>
					<div class="picker-tools">
						<input class="field" type="search" placeholder="Find a game" aria-label="Find a game" bind:value={filter} />
						<span class="ticks">
							<button type="button" class="link-button" onclick={() => (picked = new Set(games.map((g) => g.id)))}>Tick all</button>
							<button type="button" class="link-button" onclick={() => (picked = new Set())}>Untick all</button>
						</span>
					</div>
					<ul class="pick-list">
						{#each games as g (g.id)}
							<li hidden={visible != null && !visible.has(g.id)}>
								<label>
									<input type="checkbox" name="show" value={g.id} checked={picked.has(g.id)} onchange={(e) => tick(g.id, e.currentTarget.checked)} />
									{g.name}
								</label>
							</li>
						{/each}
					</ul>
					<div class="picker-foot">
						<button class="btn primary">Show {picked.size === 0 ? 'none' : `these ${picked.size}`} here</button>
						<button type="button" class="link-button" onclick={() => (picking = false)}>Cancel</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</section>

<style>
	.fold summary {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.hidden-list,
	.pick-list {
		list-style: none;
		margin: var(--s-3) 0 0;
		padding: 0;
		display: grid;
		gap: var(--s-2);
	}
	.hidden-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.name {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
		color: var(--ink-2);
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.picker {
		display: grid;
		gap: var(--s-3);
	}
	.picker p {
		margin: 0;
	}
	.picker-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.picker-tools .field {
		flex: 1 1 14rem;
		min-width: 0;
	}
	.ticks {
		display: inline-flex;
		gap: var(--s-3);
	}
	.pick-list {
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		padding: var(--s-2);
		border: 1px solid var(--rule);
		border-radius: 8px;
	}
	.pick-list label {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 32px;
	}
	.pick-list input {
		width: 18px;
		height: 18px;
		flex: none;
	}
	.picker-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
</style>
