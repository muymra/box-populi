<script lang="ts">
	import { page } from '$app/state';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Dices from '@lucide/svelte/icons/dices';
	import Plus from '@lucide/svelte/icons/plus';
	import Users from '@lucide/svelte/icons/users';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const base = $derived(`/g/${data.group.id}`);
	const current = $derived(page.url.pathname);
	const tabs = $derived(
		[
			{ href: base, label: 'Shelf', icon: LayoutGrid, show: true },
			{ href: `${base}/pick`, label: 'Play tonight', icon: Dices, show: true },
			{ href: `${base}/add`, label: 'Add games', icon: Plus, show: !!data.role && !data.readonly },
			{ href: `${base}/group`, label: 'Group', icon: Users, show: true }
		].filter((t) => t.show)
	);
	const isCurrent = (href: string) =>
		href === base ? current === base || current.startsWith(`${base}/game/`) : current.startsWith(href);
</script>

<svelte:head><title>{data.group.name} · {data.instanceName}</title></svelte:head>

<div class="group-head">
	<h1>{data.group.name}</h1>
	<nav class="tabbar" aria-label="Group">
		{#each tabs as t (t.href)}
			<a href={t.href} aria-current={isCurrent(t.href) ? 'page' : undefined}>
				<t.icon size={20} strokeWidth={2} aria-hidden="true" />
				<span>{t.label}</span>
			</a>
		{/each}
	</nav>
</div>

{#if data.group.isDemo}
	<p class="banner">A demo shelf: the games and people are invented, and nothing here can be changed.</p>
{:else if data.group.suspended}
	<p class="banner">
		The host has suspended this group{data.group.suspendedReason ? `: ${data.group.suspendedReason}` : ''}. It's read-only.
		Questions go to <a href={data.contact}>{data.contact.replace(/^mailto:/, '')}</a>.
	</p>
{/if}

<div class="group-body">
	{@render children()}
</div>

<style>
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-4);
		padding: var(--s-5) 0 var(--s-3);
	}
	h1 {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	/* Phones: a bottom tab bar within thumb reach. */
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
		padding-bottom: var(--s-4);
	}
	/* Wider screens: the same tabs sit in the group header. */
	@media (min-width: 760px) {
		.tabbar {
			position: static;
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
			font-size: 0.9375rem;
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
	}
</style>
