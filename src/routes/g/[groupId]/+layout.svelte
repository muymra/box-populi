<script lang="ts">
	import { page } from '$app/state';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const base = $derived(`/g/${data.group.id}`);
	const current = $derived(page.url.pathname);
	const inviteLink = $derived(data.code ? `${page.url.origin}/join/${data.code}` : null);
</script>

<svelte:head><title>{data.group.name} · {data.instanceName}</title></svelte:head>

<div class="group-head">
	<h1>{data.group.name}</h1>
	<nav aria-label="Group">
		<a href={base} aria-current={current === base ? 'page' : undefined}>Catalog</a>
		<a href="{base}/pick" aria-current={current === `${base}/pick` ? 'page' : undefined}>What should we play?</a>
	</nav>
</div>

{#if data.code && inviteLink}
	<details class="invite">
		<summary>Invite people · code <strong class="code">{data.code}</strong></summary>
		<p>Share the code, or this link: <span class="link">{inviteLink}</span></p>
		<CopyButton text={inviteLink} label="Copy invite link" />
	</details>
{/if}

{#if data.group.isDemo}
	<p class="banner">
		This is a demo group with invented games and people. Look around; nothing here can be changed.
	</p>
{:else if data.group.suspended}
	<p class="banner">
		This group has been suspended by the host{data.group.suspendedReason ? `: ${data.group.suspendedReason}` : ''}.
		It's read-only. Questions go to <a href={data.contact}>{data.contact.replace(/^mailto:/, '')}</a>.
	</p>
{/if}

{@render children()}

<style>
	.group-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		padding-top: 1.25rem;
	}
	h1 {
		font-size: 1.5rem;
		margin: 0;
	}
	nav {
		display: flex;
		gap: 1rem;
	}
	nav a {
		text-decoration: none;
		color: var(--muted);
		padding: 0.25rem 0;
		border-bottom: 2px solid transparent;
	}
	.invite {
		margin-top: 0.6rem;
	}
	.invite summary {
		cursor: pointer;
		color: var(--muted);
	}
	.code {
		font-family: ui-monospace, monospace;
		letter-spacing: 0.08em;
		color: var(--text);
	}
	.link {
		font-family: ui-monospace, monospace;
		font-size: 0.88rem;
		overflow-wrap: anywhere;
	}
	nav a[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--accent);
	}
</style>
