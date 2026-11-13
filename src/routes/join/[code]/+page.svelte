<script lang="ts">
	// A group's front door (D46, D47): the link in the group chat does both jobs. "New to Sandbox?"
	// joins with a name and a PIN; "Already in Sandbox?" is the members' names: tap yours, type your
	// PIN, on any device. Signed in, it's one tap: "Join as Ada".
	import { untrack } from 'svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { PIN_LENGTH } from '#lib/pin.ts';
	import { GROUP_CODE_EXAMPLE, SIGN_IN_CODE_EXAMPLE, tidySignInCode } from '#lib/codes.ts';
	import LinkPreview from '#lib/components/LinkPreview.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// After a wrong PIN or code, the name stays picked, and so does the way in that was tried.
	let picked = $state(untrack(() => (form?.door === 'back' ? form.userId : '')));
	let useCode = $state(untrack(() => form?.door === 'back' && form.usedCode));
	let query = $state('');
	const members = $derived(data.state === 'ok' || data.state === 'refused' ? data.members : []);
	const shown = $derived(query.trim() ? members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase())) : members);
	const pickedMember = $derived(members.find((m) => m.id === picked) ?? null);
	// Someone without a PIN can only come in with a code from the group's owner or a co-admin (D48).
	const codeMode = $derived(useCode || (pickedMember != null && !pickedMember.hasPin));
	const canJoin = $derived(data.state === 'ok');
</script>

<svelte:head><title>{data.state === 'ok' || data.state === 'refused' ? data.groupName : 'Join a group'} · {data.instanceName}</title></svelte:head>
<!-- The group's link in its chat (STATUS item 26): the card names the group, as the page does for anyone with the code, but never its members. -->
{#if data.state === 'ok'}
	<LinkPreview
		siteName={data.instanceName}
		preview={data.preview}
		title="Join {data.groupName} on {data.instanceName}"
		description="Everyone’s board games on one shelf, so you can find something that fits tonight. Join with your name and a PIN, or tap your name if you’re already in."
	/>
{:else if data.state === 'refused'}
	<LinkPreview siteName={data.instanceName} preview={data.preview} title="{data.groupName} on {data.instanceName}" description={data.refusal ?? ''} />
{/if}

{#if data.state === 'limited'}
	<section class="narrow">
		<h1>Too many tries</h1>
		<p>{data.message}</p>
	</section>
{:else if data.state === 'not_found'}
	<section class="narrow">
		<h1>No group with that code</h1>
		<p>Check the code with whoever shared it. Codes are five letters and numbers, like {GROUP_CODE_EXAMPLE}.</p>
		<a class="btn" href="/join">Try another code</a>
	</section>
{:else}
	<div class="doors-page">
		<header>
			<h1>{data.groupName}</h1>
			<p class="muted num">
				{data.memberCount} {data.memberCount === 1 ? 'member' : 'members'}{#if data.gameCount}{' · '}{data.gameCount} {data.gameCount === 1 ? 'game' : 'games'} on the shelf{/if}
			</p>
		</header>
		{#if data.refusal}<p class="banner">{data.refusal}</p>{/if}

		<div class="doors" class:even={members.length > 0}>
			{#if canJoin}
				<form method="POST" action="?/join" class="form-panel" aria-labelledby="new-h">
					<div class="form-head">
						<div>
							<h2 id="new-h">{data.you ? `Join ${data.groupName}` : `New to ${data.groupName}?`}</h2>
							{#if data.you}
								<p>You’ll join as {data.you}{data.yourGames > 0 ? `, and your ${data.yourGames === 1 ? 'game goes' : `${data.yourGames} games go`} on the group’s shelf unless you keep them hidden` : ''}.</p>
							{:else}
								<p>Pick the name the group knows you by, and a PIN. There’s no email or password.</p>
							{/if}
							{#if data.probation}
								<!-- Probation (D79): said before joining, so nobody's surprised by the wait. -->
								<p>
									In {data.groupName}, the owner or a co-admin lets new members in. Until they do, you can add your games and look around. Let them know
									you’ve joined.
								</p>
							{/if}
						</div>
					</div>
					{#if !data.you}
						<div class="form-row">
							<div class="form-label"><label class="form-q" for="displayName">Your name</label></div>
							<div class="form-body">
								<input id="displayName" class="field" name="displayName" required maxlength="40" autocomplete="nickname" placeholder="Ada" value={form?.door === 'new' ? (form.displayName ?? '') : ''} />
							</div>
						</div>
						<div class="form-row">
							<div class="form-label">
								<label class="form-q" for="newPin">Pick a PIN</label>
								<span class="hint">Six digits. With this group’s link and your PIN you can get back in on any device. Not your bank card’s.</span>
							</div>
							<div class="form-body">
								<input id="newPin" class="field pin" name="pin" required inputmode="numeric" pattern={`[0-9]{${PIN_LENGTH}}`} maxlength={PIN_LENGTH} autocomplete="off" placeholder="123456" />
							</div>
						</div>
					{/if}
					{#if data.you && data.yourGames > 0}
						<!-- Hiding per group (D66): for a work group, say, where only a few of your games belong. -->
						<div class="form-row">
							<div class="form-label">
								<span class="form-q">Your games</span>
								<span class="hint">Your other groups aren’t affected.</span>
							</div>
							<div class="form-body">
								<label class="check">
									<input type="checkbox" name="hideMine" value="1" />
									<span>Keep my games hidden here for now. I’ll pick which to show on Add games, and games I add later start hidden here too.</span>
								</label>
							</div>
						</div>
					{/if}
					{#if form?.error && form.door === 'new'}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
					<div class="form-foot">
						<div><button class="btn primary">{data.you ? `Join as ${data.you}` : `Join ${data.groupName}`}</button></div>
					</div>
				</form>
			{/if}

			{#if members.length}
				<form method="POST" action="?/signin" class="form-panel" aria-labelledby="back-h">
					<div class="form-head">
						<div>
							<h2 id="back-h">Already in {data.groupName}?</h2>
							<p>Tap your name and type your PIN. It works on any device.</p>
						</div>
					</div>
					<div class="form-block names-block">
						{#if members.length > 12}
							<input class="field find" type="search" placeholder="Find your name" aria-label="Find your name" bind:value={query} />
						{/if}
						<div class="names" role="radiogroup" aria-label="Your name">
							{#each shown as m (m.id)}
								<label class="name">
									<input class="visually-hidden" type="radio" name="userId" value={m.id} bind:group={picked} />
									<span class="dot" style:background={playerColor(m.colorIndex).fill}></span>{m.name}
								</label>
							{:else}
								<p class="muted">Nobody here by that name.</p>
							{/each}
						</div>
					</div>
					{#if codeMode}
						{#if pickedMember && !pickedMember.hasPin}
							<div class="form-block">
								<p class="note">
									{pickedMember.name} hasn’t set a PIN yet. On a device where you’re signed in, Your account sets one. From here, ask the group’s owner or a
									co-admin for a sign-in code, or open your sign-in link if you saved one. The owner asks
									<a href={data.contact}>whoever runs this site</a>.
								</p>
							</div>
						{/if}
						<div class="form-row">
							<div class="form-label">
								<label class="form-q" for="adminCode">Sign-in code</label>
								<span class="hint">Eight letters and numbers, from the group’s owner or a co-admin. It works once; next you pick a new PIN.</span>
							</div>
							<div class="form-body">
								<input
									id="adminCode"
									class="field code"
									name="adminCode"
									required
									maxlength="9"
									autocomplete="off"
									autocapitalize="characters"
									spellcheck="false"
									placeholder={SIGN_IN_CODE_EXAMPLE}
									oninput={(e) => (e.currentTarget.value = tidySignInCode(e.currentTarget.value))}
								/>
							</div>
						</div>
					{:else}
						<div class="form-row">
							<div class="form-label"><label class="form-q" for="pin">Your PIN</label></div>
							<div class="form-body">
								<input id="pin" class="field pin" name="pin" type="password" required inputmode="numeric" maxlength={PIN_LENGTH} autocomplete="current-password" />
							</div>
						</div>
					{/if}
					{#if form?.error && form.door === 'back'}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
					<div class="form-foot">
						<div><button class="btn primary">{pickedMember ? `Sign in as ${pickedMember.name}` : 'Sign in'}</button></div>
						{#if !pickedMember || pickedMember.hasPin}
							<p class="hint">
								{#if useCode}
									<button type="button" class="link-button" onclick={() => (useCode = false)}>Use my PIN</button>
								{:else}
									Forgot it? Your account sets a new one on a signed-in device, or
									<button type="button" class="link-button" onclick={() => (useCode = true)}>use a sign-in code</button>. The owner gets one from
									<a href={data.contact}>whoever runs this site</a>.
								{/if}
							</p>
						{/if}
					</div>
				</form>
			{:else if data.you}
				<section class="other-door" aria-labelledby="other-h">
					<h2 id="other-h">Not {data.you}?</h2>
					<p>This device is signed in as {data.you}. To join as someone else, sign out on <a href="/me">your account</a> first.</p>
				</section>
			{/if}
		</div>
	</div>
{/if}

<style>
	.check {
		display: flex;
		gap: var(--s-2);
		align-items: flex-start;
	}
	.check input {
		width: 20px;
		height: 20px;
		flex: none;
		margin-top: 2px;
	}
	@media (min-width: 900px) {
		.doors.even {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--s-5);
		}
	}
	/* Two forms side by side: their rows stack, question over answer, so neither column is cramped. */
	.doors.even .form-row {
		grid-template-columns: minmax(0, 1fr);
		gap: var(--s-2);
	}
	.doors.even .form-label {
		padding-top: 0;
	}
	.code {
		max-width: 14rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.pin {
		max-width: 12rem;
		letter-spacing: 0.3em;
		font-variant-numeric: tabular-nums;
	}
	.find {
		max-width: 20rem;
		margin-bottom: var(--s-3);
	}
	.names {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	/* The person toggles from Who's here: a colour square and the name; marigold once picked. */
	.name {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: max(40px, var(--tap));
		padding: 0 14px 0 10px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		font-weight: 650;
		cursor: pointer;
	}
	.name:hover {
		border-color: var(--ink-3);
	}
	.name:has(:checked) {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.name:has(:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		flex: none;
	}
	.note {
		margin: 0;
		padding: var(--s-3) var(--s-4);
		border-radius: var(--r-ctl);
		background: var(--note);
	}
	.form-foot .hint {
		margin: 0;
	}
	.names-block .muted {
		margin: 0;
	}
</style>
