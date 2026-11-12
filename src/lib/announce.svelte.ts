// One status region for the whole app (the root layout draws it), so a message that appears after an
// action is read out. A region that's added to the page already holding its text often isn't, which is
// what `{#if saved}<p role="status">Saved.</p>{/if}` does. The message stays where it's drawn; the
// `announce` attachment copies its text here when it appears.

let current = $state('');
let timer: ReturnType<typeof setTimeout> | undefined;

/** What the root layout's status region says now. */
export const announcer = {
	get text() {
		return current;
	}
};

/**
 * Say `message` through the status region. It's cleared first and set a moment later, so the same
 * words twice in a row ("Saved." after "Saved.") are read both times.
 */
export function say(message: string): void {
	clearTimeout(timer);
	current = '';
	const text = message.replace(/\s+/g, ' ').trim();
	if (text) timer = setTimeout(() => (current = text), 60);
}

/** `{@attach announce}` on a message that appears after an action: says its text when it's drawn. */
export function announce(node: HTMLElement): void {
	say(node.textContent ?? '');
}
