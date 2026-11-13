import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announcer, say } from './announce.svelte.ts';

describe('say', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('empties the region first and sets the message a moment later, whitespace collapsed', () => {
		say('  Link\n added. ');
		expect(announcer.text).toBe('');
		vi.advanceTimersByTime(60);
		expect(announcer.text).toBe('Link added.');
	});

	it('makes a repeat differ by a no-break space, so VoiceOver reads it again', () => {
		say('Copied');
		vi.advanceTimersByTime(60);
		say('Copied');
		vi.advanceTimersByTime(60);
		expect(announcer.text).toBe('Copied ');
		say('Copied');
		vi.advanceTimersByTime(60);
		expect(announcer.text).toBe('Copied');
		say('Saved.');
		vi.advanceTimersByTime(60);
		expect(announcer.text).toBe('Saved.');
	});

	it('says nothing for an empty message', () => {
		say('Saved.');
		vi.advanceTimersByTime(60);
		say('   ');
		vi.advanceTimersByTime(60);
		expect(announcer.text).toBe('');
	});
});
