<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Dices from '@lucide/svelte/icons/dices';
	import Plus from '@lucide/svelte/icons/plus';
	import Users from '@lucide/svelte/icons/users';
	import Gift from '@lucide/svelte/icons/gift';
	import Crown from '@lucide/svelte/icons/crown';
	import Dice5 from '@lucide/svelte/icons/dice-5';
	import Trophy from '@lucide/svelte/icons/trophy';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Check from '@lucide/svelte/icons/check';
	import CubeMark from '#lib/components/CubeMark.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import StartPlayer from '#lib/components/StartPlayer.svelte';
	import DiceRoller from '#lib/components/DiceRoller.svelte';
	import { Table, setTable } from '#lib/table/table.svelte.ts';
	import { nightOn, tonightSeed } from '#lib/nights.ts';
	import { nightOf } from '#lib/table/regulars.ts';
	import { SOURCE_URL } from '#lib/project.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const base = $derived(`/g/${data.group.id}`);
	const current = $derived(page.url.pathname);
	const tabs = $derived(
		[
			{ href: base, label: 'Shelf', icon: LayoutGrid, show: true },
			{ href: `${base}/pick`, label: 'Game night', icon: Dices, show: true },
			{ href: `${base}/wanted`, label: 'Wanted', icon: Gift, show: true },
			{ href: `${base}/add`, label: 'Add games', icon: Plus, show: !!data.role && !data.readonly },
			{ href: `${base}/group`, label: 'Group', icon: Users, show: true }
		].filter((t) => t.show)
	);
	const isCurrent = (href: string) =>
		href === base
			? current === base || current.startsWith(`${base}/game/`)
			: current.startsWith(href) ||
				(href === `${base}/pick` && current.startsWith(`${base}/nights`)) ||
				(href === `${base}/group` && current.startsWith(`${base}/members/`));

	// The group switcher (PRD "Groups and codes"): for someone in two or more live groups, the group
	// name opens a list of them. Switching keeps the tab you're on, so Game night leads to Game night.
	let switchOpen = $state(false);
	let switchEl = $state<HTMLElement>();
	let switchButton = $state<HTMLButtonElement>();
	const TABS = ['pick', 'wanted', 'add', 'group', 'plays'];
	const keepTab = $derived.by(() => {
		const first = current.slice(base.length).split('/')[1] ?? '';
		if (first === 'nights') return '/pick';
		return TABS.includes(first) ? `/${first}` : '';
	});
	// Your name opens a small menu (Carlo's pick, 2026-11-09): your profile in this group (D61), or
	// your account. Outside a group, and for someone just looking at the demo, it's a plain link.
	let meOpen = $state(false);
	let meEl = $state<HTMLElement>();
	let meButton = $state<HTMLButtonElement>();
	afterNavigate(() => {
		switchOpen = false;
		meOpen = false;
	});
	function closeOutside(e: PointerEvent) {
		if (switchOpen && switchEl && !switchEl.contains(e.target as Node)) switchOpen = false;
		if (meOpen && meEl && !meEl.contains(e.target as Node)) meOpen = false;
	}
	function closeOnEscape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (switchOpen) {
			switchOpen = false;
			switchButton?.focus();
		}
		if (meOpen) {
			meOpen = false;
			meButton?.focus();
		}
	}

	// Who's here on this device, shared with the picker (PRD "At the table").
	// The reset is the instance's, so it's read once, before any page under this layout reads the table.
	const table = setTable(new Table(untrack(() => data.hereResetMs)));
	let startOpen = $state(false);
	let diceOpen = $state(false);
	$effect(() => {
		// Re-read when switching groups and each time the modal opens, so a table left overnight has reset.
		const groupId = data.group.id;
		const seed = tonightSeed(nightOn(data.nights, nightOf(Date.now())), new Set(data.tableMembers.map((m) => m.id)));
		void startOpen;
		untrack(() => table.load(groupId, seed));
	});
</script>

<svelte:head><title>{data.group.name} · {data.instanceName}</title></svelte:head>
<svelte:window onpointerdown={closeOutside} onkeydown={closeOnEscape} />

<header class="group-bar">
	<a class="home" class:mark={!data.logoUrl} href="/" aria-label="{data.instanceName}: all your groups">
		{#if data.logoUrl}<img class="logo" src={data.logoUrl} alt="" />{:else}<CubeMark size={24} />{/if}
	</a>
	<div class="title" bind:this={switchEl}>
		{#if data.myGroups.length}
			<h1 class="switchable">
				<button type="button" class="switch" aria-expanded={switchOpen} aria-controls="group-switch" title={data.group.name} bind:this={switchButton} onclick={() => (switchOpen = !switchOpen)}>
					<span class="name">{data.group.name}</span><span class="visually-hidden">, switch group</span>
					<ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />
				</button>
			</h1>
			{#if switchOpen}
				<nav class="switch-menu" id="group-switch" aria-label="Your groups">
					<ul>
						{#each data.myGroups as g (g.id)}
							<li>
								<a href="/g/{g.id}{keepTab}" aria-current={g.id === data.group.id ? 'true' : undefined}>
									<span class="name">{g.name}</span>
									{#if g.id === data.group.id}<Check size={18} strokeWidth={2.25} aria-hidden="true" />{/if}
								</a>
							</li>
						{/each}
					</ul>
					<div class="foot"><a href="/">All your groups</a></div>
				</nav>
			{/if}
		{:else}
			<h1 title={data.group.name}>{data.group.name}</h1>
		{/if}
	</div>
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
	{#if data.user && data.role}
		<div class="me-wrap" bind:this={meEl}>
			<button type="button" class="me" aria-expanded={meOpen} aria-controls="me-menu" bind:this={meButton} onclick={() => (meOpen = !meOpen)}
				><span class="me-name">{data.user.name}</span><ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" /></button
			>
			{#if meOpen}
				<nav class="switch-menu me-menu" id="me-menu" aria-label="You">
					<ul>
						<li><a href="{base}/members/{data.myId}" aria-current={current === `${base}/members/${data.myId}` ? 'page' : undefined}><span class="name">Your profile in {data.group.name}</span></a></li>
						<li><a href="/me"><span class="name">Your account</span></a></li>
					</ul>
				</nav>
			{/if}
		</div>
	{:else if data.user}
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
{:else if data.group.archived && !data.group.suspended}
	<p class="banner">
		Archived{data.group.archivedByName ? ` by ${data.group.archivedByName}` : ''}{data.group.archivedAt
			? ` on ${new Date(data.group.archivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
			: ''}. It’s read-only: look back at the shelf, plays and nights, but nothing can change, and its join link is closed.
		{#if data.role === 'owner'}<a href="/g/{data.group.id}/group">Restore it or delete it on the Group tab</a>.{:else if data.role === 'admin'}<a
				href="/g/{data.group.id}/group">What co-admins can do is on the Group tab</a
			>.{/if}
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
		position: relative;
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
		min-width: var(--tap);
		min-height: var(--tap);
		color: var(--ink);
		flex: none;
	}
	/* The 24px mark keeps its 24px in the bar on a touch screen; the 44px target reaches into the gaps. */
	.home.mark {
		margin-inline: min(0px, calc((24px - var(--tap)) / 2));
	}
	.title {
		flex: 1;
		min-width: 0;
		align-self: stretch;
		display: flex;
		align-items: center;
	}
	h1 {
		min-width: 0;
		margin: 0;
		font-size: var(--t-lead);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* The switcher: the group name is the button, with a chevron after it. Its focus ring needs room,
	   so the heading doesn't clip; the name inside it shortens instead. */
	h1.switchable {
		overflow: visible;
		display: flex;
		margin-left: -8px;
	}
	.switch {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		max-width: 100%;
		min-height: max(40px, var(--tap));
		padding: 0 6px 0 8px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.switch:hover,
	.switch[aria-expanded='true'] {
		background: var(--gap);
	}
	.switch :global(svg) {
		flex: none;
		color: var(--ink-2);
		transition: transform 0.15s var(--ease-out);
	}
	.switch[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* A card under the bar: cube white, 1px rule, 10px corners, flat. Below 900px it hangs from the bar's
	   left gutter, since the name can sit too far right for it to fit under it on a small phone. */
	.switch-menu {
		position: absolute;
		z-index: 30;
		top: 100%;
		left: var(--s-4);
		width: max-content;
		min-width: 14rem;
		max-width: calc(100% - 2 * var(--s-4));
		margin-top: 6px;
		padding: 6px;
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.switch-menu ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.switch-menu a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		min-height: 44px;
		padding: 0 12px;
		border-radius: var(--r-ctl);
		color: var(--ink);
		font-weight: 650;
		text-decoration: none;
	}
	.switch-menu a:hover {
		background: var(--gap);
	}
	.switch-menu a[aria-current='true'] {
		background: var(--mark);
		color: var(--mark-ink);
	}
	.switch-menu a :global(svg) {
		flex: none;
	}
	.switch-menu .foot {
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid var(--rule);
	}
	.switch-menu .foot a {
		color: var(--ink-2);
		font-weight: 600;
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
		padding-block: max(8px, calc((var(--tap) - 1lh) / 2));
	}
	.me:hover {
		text-decoration: underline;
	}
	/* Your name as the menu's button: plain text like the link it replaced, with the switcher's fill while open. */
	.me-wrap {
		display: flex;
		flex: none;
		min-width: 0;
	}
	button.me {
		display: flex;
		align-items: center;
		gap: 2px;
		margin: 0;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		padding: 8px 4px 8px 8px;
		min-height: var(--tap);
		cursor: pointer;
	}
	button.me:hover,
	button.me[aria-expanded='true'] {
		background: var(--gap);
		text-decoration: none;
	}
	.me-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.me :global(svg) {
		flex: none;
		color: var(--ink-2);
		transition: transform 0.15s var(--ease-out);
	}
	button.me[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}
	/* The switcher's card, hung from the bar's right gutter under your name. */
	.switch-menu.me-menu {
		left: auto;
		right: var(--s-4);
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
		.me,
		.me-wrap {
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
		.title {
			flex: 0 1 auto;
			position: relative;
		}
		h1 {
			font-size: 1.375rem;
		}
		.switch-menu {
			left: 0;
			max-width: 22rem;
			margin-top: 2px;
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
		.me,
		.me-wrap {
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
		.me,
		.me-wrap {
			margin-left: 0;
			padding-left: var(--s-3);
		}
		.tabbar a :global(svg) {
			display: none;
		}
	}
</style>
