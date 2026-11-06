<!-- The Box Populi mark: a 2×2 cube shelf with one box in it. Authored SVG. -->
<script lang="ts">
	let { size = 26 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
	<rect x="1.5" y="1.5" width="29" height="29" rx="2" fill="none" stroke="currentColor" stroke-width="3" />
	<path d="M16 2.5v27M2.5 16h27" stroke="currentColor" stroke-width="2.5" />
	<rect x="5.5" y="18.5" width="7" height="8.5" rx="0.8" fill="#c8402e" />
	<rect x="19.5" y="5" width="7.5" height="8" rx="0.8" fill="#e9b44c" />
</svg>
