<script lang="ts">
	import { page } from '$app/state';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ROLE = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
	const inviteLink = $derived(data.code ? `${page.url.origin}/join/${data.code}` : null);
</script>

<div class="group-page">
	{#if data.code && inviteLink}
		<section class="invite panel" aria-labelledby="invite-h">
			<h2 id="invite-h">Invite people</h2>
			<p class="muted">Anyone with the code can join with just a name.</p>
			<div class="code num" aria-label="Join code {data.code.split('').join(' ')}">{data.code}</div>
			<p class="link">{inviteLink}</p>
			<CopyButton text={inviteLink} label="Copy invite link" />
		</section>
	{/if}

	<section aria-labelledby="members-h">
		<h2 id="members-h">Members and their colours</h2>
		<p class="muted">Each person's colour runs along the bottom of the cubes holding their games.</p>
		<ul class="members">
			{#each data.members as m (m.id)}
				{@const c = playerColor(m.colorIndex)}
				<li>
					<span class="cube-chip" style:background={c.bg} style:color={c.ink} aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
					<span class="who">
						<strong>{m.name}{#if m.isMe}<span class="muted">{' (you)'}</span>{/if}</strong>
						<span class="muted">{ROLE[m.role]} · <span class="num">{m.games}</span> {m.games === 1 ? 'game' : 'games'} · {c.name}</span>
					</span>
				</li>
			{/each}
		</ul>
		{#if data.role}
			<p class="muted small">To leave this group, go to <a href="/me">your account</a>.</p>
		{/if}
	</section>
</div>

<style>
	.group-page {
		display: grid;
		gap: var(--s-6);
		max-width: 46rem;
		padding-top: var(--s-3);
	}
	.code {
		font-size: 2.5rem;
		font-weight: 800;
		letter-spacing: 0.22em;
		margin: var(--s-2) 0 var(--s-1);
	}
	.link {
		font-size: var(--t-small);
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}
	.members {
		list-style: none;
		margin: var(--s-4) 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--s-2);
	}
	.members li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-3);
		background: var(--cube);
		border-radius: var(--r-ctl);
	}
	.cube-chip {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 4px;
		display: grid;
		place-items: center;
		font-weight: 800;
		box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.18);
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-size: var(--t-small);
	}
	.who strong {
		font-size: var(--t-body);
	}
	.small {
		font-size: var(--t-small);
	}
</style>
