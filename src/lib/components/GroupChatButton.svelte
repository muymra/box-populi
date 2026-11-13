<script lang="ts">
	// The group's chat link as a button (D78): "Open WhatsApp group", in a new tab. Used on the Group
	// tab, a night's page and the new member's note on the shelf.
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import { chatLink } from '#lib/group-chat.ts';

	let { url, small = false, onclick }: { url: string; small?: boolean; onclick?: () => void } = $props();
	const link = $derived(chatLink(url));
</script>

<a class="btn" class:small href={url} target="_blank" rel="noopener noreferrer" {onclick}><MessageCircle size={small ? 16 : 18} aria-hidden="true" /> Open {link.label}</a>
