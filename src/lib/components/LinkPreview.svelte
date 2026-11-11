<!--
	A page's link preview (TECH.md "Link previews", `#lib/link-preview.ts`): what a chat app shows for
	its link. The picture is the instance's, from the root layout's `preview`.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { previewMeta, type PreviewImage } from '#lib/link-preview.ts';

	let { siteName, preview, title, description }: { siteName: string; preview: PreviewImage; title: string; description: string } = $props();

	const tags = $derived(previewMeta({ origin: page.url.origin, path: page.url.pathname, siteName, title, description, preview }));
</script>

<svelte:head>
	{#each tags as t (t.key)}
		{#if t.attr === 'name'}<meta name={t.key} content={t.content} />{:else}<meta property={t.key} content={t.content} />{/if}
	{/each}
</svelte:head>
