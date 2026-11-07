<script lang="ts">
	// Logged plays, newest first (PRD "Play log"): the date, the game when it's a list of several,
	// and who finished where. Whoever logged a play, its players and co-admins can edit or delete it.
	import { enhance } from '$app/forms';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Modal from './Modal.svelte';
	import PlayForm from './PlayForm.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { isWin, ordinal, type Coop, type PlayPlayer } from '#lib/plays.ts';
	import type { Table } from '#lib/table/table.svelte.ts';

	type Member = { id: string; name: string; colorIndex: number };
	export type ListedPlay = {
		id: string;
		gameId: number;
		gameName: string;
		playedOn: string;
		coop: Coop | null;
		lowestWins: boolean;
		players: PlayPlayer[];
		canChange: boolean;
		night?: { id: string; name: string } | null;
	};
	let {
		plays,
		members,
		table,
		groupId,
		showGame = false
	}: { plays: ListedPlay[]; members: Member[]; table: Table; groupId: string; showGame?: boolean } = $props();

	const memberById = $derived(new Map(members.map((m) => [m.id, m])));
	let editing = $state<ListedPlay | null>(null);
	let editOpen = $state(false);
	let confirming = $state<string | null>(null);
	// Shown under the play, since the page the list sits on may not show the plays page's form errors.
	let deleteError = $state<{ id: string; message: string } | null>(null);

	const thisYear = new Date().getFullYear();
	function dateLabel(day: string): string {
		const d = new Date(`${day}T12:00:00`);
		return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === thisYear ? undefined : 'numeric' });
	}

	function nameOf(p: PlayPlayer): { name: string; color: string | null; guest: boolean } {
		if (p.guestName) return { name: p.guestName, color: null, guest: true };
		const m = p.userId ? memberById.get(p.userId) : undefined;
		return m ? { name: m.name, color: playerColor(m.colorIndex).bg, guest: false } : { name: 'a former member', color: null, guest: false };
	}

	/** Players in finishing order for a competitive play; as entered for co-op. */
	const ordered = (play: ListedPlay) => (play.coop ? play.players : [...play.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99)));
</script>

<ol class="plays">
	{#each plays as play (play.id)}
		{@const places = play.players.map((p) => p.place)}
		<li>
			<div class="head">
				<span class="when num">{dateLabel(play.playedOn)}</span>
				{#if showGame}<a class="game" href="/g/{groupId}/game/{play.gameId}">{play.gameName}</a>{/if}
				{#if play.coop}<span class="tag">Co-op, {play.coop}</span>{/if}
				{#if play.canChange}
					<span class="tools">
						<button
							type="button"
							class="icon"
							aria-label="Edit this play"
							onclick={() => {
								editing = play;
								editOpen = true;
							}}><Pencil size={16} aria-hidden="true" /></button
						>
						<button type="button" class="icon" aria-label="Delete this play" onclick={() => (confirming = confirming === play.id ? null : play.id)}
							><Trash2 size={16} aria-hidden="true" /></button
						>
					</span>
				{/if}
			</div>
			<ul class="result">
				{#each ordered(play) as p, i (i)}
					{@const who = nameOf(p)}
					<li class:winner={!play.coop && isWin(p.place, places)}>
						<span class="dot" class:guest={!who.color} style:background={who.color}></span>
						<span class="name">{who.name}</span>
						{#if !play.coop && p.place != null}<span class="num muted">{ordinal(p.place)}</span>{/if}
						{#if p.score != null}<span class="num muted">· {p.score}</span>{/if}
					</li>
				{/each}
			</ul>
			{#if deleteError?.id === play.id}<p class="banner error" role="alert">{deleteError.message}</p>{/if}
			{#if confirming === play.id}
				<form method="POST" action="/g/{groupId}/plays?/deletePlay" class="confirm" use:enhance={() => async ({ result, update }) => {
						confirming = null;
						deleteError =
							result.type === 'failure' ? { id: play.id, message: String(result.data?.playError ?? 'That play couldn’t be deleted. Reload and try again.') } : null;
						await update({ navigate: false });
					}}
				>
					<input type="hidden" name="playId" value={play.id} />
					<span>Delete this play of {play.gameName}?</span>
					<button type="submit" class="btn small danger">Delete</button>
					<button type="button" class="btn small" onclick={() => (confirming = null)}>Keep it</button>
				</form>
			{/if}
		</li>
	{/each}
</ol>

<Modal bind:open={editOpen} title="Edit play">
	{#if editOpen && editing}
		<PlayForm
			action="/g/{groupId}/plays?/editPlay"
			game={{ id: editing.gameId, name: editing.gameName }}
			{members}
			{table}
			initial={editing}
			ondone={() => (editOpen = false)}
		/>
	{/if}
</Modal>

<style>
	.plays {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.plays > li {
		padding: var(--s-3) 0;
		border-top: 1px solid var(--rule);
	}
	.plays > li:first-child {
		border-top: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px var(--s-3);
		min-height: 32px;
	}
	.when {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.game {
		font-weight: 650;
	}
	.tools {
		display: flex;
		margin-left: auto;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}
	.icon:hover {
		background: var(--gap);
		color: var(--ink);
	}
	.result {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px var(--s-4);
	}
	.result li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.result .winner .name {
		font-weight: 700;
	}
	.dot {
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.dot.guest {
		box-shadow: inset 0 0 0 2px var(--ink-3);
	}
	.btn.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
	.confirm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-2);
		font-size: var(--t-small);
	}
</style>
