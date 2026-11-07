<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Dices from '@lucide/svelte/icons/dices';
	import Plus from '@lucide/svelte/icons/plus';
	import Users from '@lucide/svelte/icons/users';
	import Gift from '@lucide/svelte/icons/gift';
	import Crown from '@lucide/svelte/icons/crown';
	import Dice5 from '@lucide/svelte/icons/dice-5';
	import Trophy from '@lucide/svelte/icons/trophy';
	import CubeMark from '#lib/components/CubeMark.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import StartPlayer from '#lib/components/StartPlayer.svelte';
	import DiceRoller from '#lib/components/DiceRoller.svelte';
	import { Table, setTable } from '#lib/table/table.svelte.ts';
	import { SOURCE_URL } from '#lib/project.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const base = $derived(`/g/${data.group.id}`);
	const current = $derived(page.url.pathname);
	const tabs = $derived(
		[
			{ href: base, label: 'Shelf', icon: LayoutGrid, show: true },
			{ href: `${base}/pick`, label: 'Play tonight', icon: Dices, show: true },
			{ href: `${base}/wanted`, label: 'Wanted', icon: Gift, show: true },
			{ href: `${base}/add`, label: 'Add games', icon: Plus, show: !!data.role && !data.readonly },
			{ href: `${base}/group`, label: 'Group', icon: Users, show: true }
		].filter((t) => t.show)
	);
	const isCurrent = (href: string) =>
		href === base ? current === base || current.startsWith(`${base}/game/`) : current.startsWith(href);

	// Who's here on this device, shared with the picker (PRD "At the table").
	const table = setTable(new Table());
	let startOpen = $state(false);
	let diceOpen = $state(false);
	$effect(() => {
		// Re-read when switching groups and each time the modal opens, so a table left overnight has reset.
		const groupId = data.group.id;
		void startOpen;
		untrack(() => table.load(groupId));
	});
</script>

<svelte:head><title>{data.group.name} · {data.instanceName}</title></svelte:head>

<header class="group-bar">
	<a class="home" href="/" aria-label="{data.instanceName}: all your groups">
		{#if data.logoUrl}<img class="logo" src={data.logoUrl} alt="" />{:else}<CubeMark size={24} />{/if}
	</a>
	<h1 title={data.group.name}>{data.group.name}</h1>
	<nav class="tabbar" aria-label="Group">
		{#each tabs as t (t.href)}
			<a href={t.href} aria-current={isCurrent(t.href) ? 'page' : undefined}>
				<t.icon size={20} strokeWidth={2} aria-hidden="true" />
				<span>{t.label}</span>
			</a>
		{/each}
	</nav>
	<div class="tools">
		<button type="button" class="tool" aria-label="Who goes first?" title="Who goes first?" aria-haspopup="dialog" onclick={() => (startOpen = true)}>
			<Crown size={22} strokeWidth={2} aria-hidden="true" />
		</button>
		<button type="button" class="tool" aria-label="Roll dice" title="Roll dice" aria-haspopup="dialog" onclick={() => (diceOpen = true)}>
			<Dice5 size={22} strokeWidth={2} aria-hidden="true" />
		</button>
		<!-- The play log is a page of its own (leaderboard, plays, export), so this one is a link, not a modal. -->
		<a class="tool" href="{base}/plays" aria-label="Plays and leaderboard" title="Plays and leaderboard" aria-current={current.startsWith(`${base}/plays`) ? 'page' : undefined}>
			<Trophy size={22} strokeWidth={2} aria-hidden="true" />
		</a>
	</div>
	{#if data.user}
		<a href="/me" class="me">{data.user.name}</a>
	{:else if data.demoMode}
		<a href={SOURCE_URL} class="me" rel="noopener">Run your own</a>
	{:else}
		<a href="/join" class="me">Join a group</a>
	{/if}
</header>

{#if data.pendingDetails > 0 && !current.startsWith(`${base}/add`)}
	<p class="note">
		Details are still loading for <span class="num">{data.pendingDetails}</span> of your games. <a href="{base}/add">Finish loading them</a>
	</p>
{/if}
{#if data.group.isDemo}
	<p class="note">
		Demo shelf: invented games and people, read-only. Box Populi is free and open source;
		<a href={SOURCE_URL} rel="noopener">run your own from GitHub</a>.
	</p>
{:else if data.group.suspended}
	<p class="banner">
		The host has suspended this group{data.group.suspendedReason ? `: ${data.group.suspendedReason}` : ''}. It's read-only.
		Questions go to <a href={data.contact}>{data.contact.replace(/^mailto:/, '')}</a>.
	</p>
{/if}

<div class="group-body">
	{@render children()}
</div>

<Modal bind:open={startOpen} title="Who goes first?">
	{#key data.group.id}<StartPlayer members={data.tableMembers} {table} />{/key}
</Modal>
<Modal bind:open={diceOpen} title="Dice">
	<DiceRoller />
</Modal>

<style>
	.logo {
		display: block;
		height: 28px;
		width: auto;
		max-width: 120px;
		object-fit: contain;
	}
	.group-bar {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		min-height: 56px;
		margin: 0 calc(-1 * var(--s-4));
		padding: 0 var(--s-4);
		border-bottom: 1px solid var(--rule);
	}
	.home {
		display: grid;
		place-items: center;
		color: var(--ink);
		flex: none;
	}
	h1 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--t-lead);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Start player and dice: icon-only buttons that open modals, beside the person's name. */
	.tools {
		display: flex;
		flex: none;
		gap: 2px;
	}
	.tool {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}
	.tool:hover {
		background: var(--gap);
		color: var(--ink);
	}
	.tool[aria-current='page'] {
		background: var(--mark);
		color: var(--mark-ink);
	}
	.me {
		flex: none;
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		text-decoration: none;
		padding: 8px 2px;
	}
	.me:hover {
		text-decoration: underline;
	}
	.note {
		margin: var(--s-3) 0 0;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	/* Phones and narrow tablets: a bottom tab bar within thumb reach. It moves up at 900px, not the
	   760px most layouts use, because the top bar needs that much room for five tabs, three icons and the
	   group name. */
	.tabbar {
		position: fixed;
		z-index: 20;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-around;
		background: var(--laminate);
		border-top: 1px solid var(--rule);
		padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
	}
	.tabbar a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 6px 2px;
		border-radius: var(--r-ctl);
		color: var(--ink-2);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 650;
		min-height: 52px;
	}
	.tabbar a[aria-current='page'] {
		color: var(--ink);
	}
	.tabbar a[aria-current='page'] :global(svg) {
		color: var(--mark-ink);
		background: var(--mark);
		border-radius: 6px;
		padding: 2px 10px;
		box-sizing: content-box;
	}
	.group-body {
		padding: var(--s-3) 0 var(--s-4);
	}
	/* Below that the bar holds the mark, the name, three 44px icons and the person's link. The link
	   stays short and can shrink further, and a hoster's logo is capped, so nothing pushes the bar wider
	   than a 320px phone. */
	@media (max-width: 899px) {
		.group-bar {
			gap: var(--s-2);
		}
		.logo {
			max-width: 72px;
		}
		.me {
			flex: 0 1 auto;
			min-width: 2.5rem;
			max-width: 6rem;
		}
	}
	/* Wider screens: the same tabs sit in the top bar. */
	@media (min-width: 900px) {
		.group-bar {
			min-height: 64px;
		}
		h1 {
			flex: 0 1 auto;
			font-size: 1.375rem;
		}
		/* The tabs keep their width; the group name is what shortens when the bar is full. */
		.tabbar {
			flex: none;
			position: static;
			margin-left: auto;
			background: none;
			border: 0;
			padding: 0;
			gap: 4px;
		}
		.tabbar a {
			flex: none;
			flex-direction: row;
			gap: 8px;
			padding: 0 14px;
			min-height: 42px;
			font-size: var(--t-body);
		}
		.tabbar a[aria-current='page'] {
			background: var(--mark);
			color: var(--mark-ink);
		}
		.tabbar a[aria-current='page'] :global(svg) {
			background: none;
			padding: 0;
		}
		.tabbar a:not([aria-current='page']):hover {
			background: var(--gap);
			color: var(--ink);
		}
		.me {
			margin-left: var(--s-3);
			padding-left: var(--s-4);
			border-left: 1px solid var(--rule);
		}
	}
	/* Five tabs and the three icons don't fit beside the group name with tab icons until about 1100px;
	   drop the tab icons and tighten the spacing until then. */
	@media (min-width: 900px) and (max-width: 1099px) {
		.group-bar {
			gap: var(--s-2);
		}
		.tabbar a {
			padding: 0 8px;
		}
		.tools {
			gap: 0;
		}
		.tool {
			width: 40px;
		}
		.me {
			margin-left: 0;
			padding-left: var(--s-3);
		}
		.tabbar a :global(svg) {
			display: none;
		}
	}
</style>
