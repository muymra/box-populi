<script lang="ts">
	// Where an invite lands (PRD "Identity"). Two doors, because the commonest mix-up is someone who's
	// already in the group, on a new phone, joining again and becoming a second person: "New to the
	// group?" joins; "Already in it on another device?" sends them to their sign-in link instead (D46).
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Join {data.state === 'ok' || data.state === 'refused' ? data.groupName : 'a group'} · {data.instanceName}</title></svelte:head>

{#if data.state === 'limited'}
	<section class="narrow">
		<h1>Too many tries</h1>
		<p>{data.message}</p>
	</section>
{:else if data.state === 'not_found'}
	<section class="narrow">
		<h1>No group with that code</h1>
		<p>Check the code with whoever shared it. Codes are five letters and numbers, like K7M4P.</p>
		<a class="btn" href="/join">Try another code</a>
	</section>
{:else if data.state === 'refused'}
	<section class="narrow">
		<h1>{data.groupName}</h1>
		<p class="banner">{data.refusal}</p>
	</section>
{:else}
	<div class="doors-page">
		<header>
			<h1>Join {data.groupName}</h1>
			<p class="muted num">
				{data.memberCount} {data.memberCount === 1 ? 'member' : 'members'} · {data.gameCount} {data.gameCount === 1 ? 'game' : 'games'} on the shelf
			</p>
		</header>

		<div class="doors">
			<form method="POST" class="form-panel" aria-labelledby="new-h">
				<div class="form-head">
					<div>
						<h2 id="new-h">New to {data.groupName}?</h2>
						{#if data.you}
							<p>You’ll join as {data.you}, and your games go on the group’s shelf.</p>
						{:else}
							<p>Pick the name the group knows you by. There’s no email or password.</p>
						{/if}
					</div>
				</div>
				{#if !data.you}
					<div class="form-row">
						<div class="form-label"><label class="form-q" for="displayName">Your name</label></div>
						<div class="form-body">
							<input id="displayName" class="field" name="displayName" required maxlength="40" autocomplete="nickname" placeholder="Ada" value={form?.displayName ?? ''} />
						</div>
					</div>
				{/if}
				{#if form?.error}<div class="form-block"><p class="banner error" role="alert">{form.error}</p></div>{/if}
				<div class="form-foot">
					<div><button class="btn primary">{data.you ? `Join as ${data.you}` : `Join ${data.groupName}`}</button></div>
				</div>
			</form>

			<section class="other-door" aria-labelledby="other-h">
				{#if data.you}
					<h2 id="other-h">Not {data.you}?</h2>
					<p>This device is signed in as {data.you}. To join as someone else, sign out on <a href="/me">your account</a> first.</p>
				{:else}
					<h2 id="other-h">Already in {data.groupName} on another device?</h2>
					<p>Don’t join again, or you’ll be in the group twice. Open your <strong>sign-in link</strong> on this device instead. It was on the page you saw after you joined.</p>
					<p>Lost it? On a device where you’re still signed in, go to Your account and make a new sign-in link.</p>
				{/if}
			</section>
		</div>
	</div>
{/if}

