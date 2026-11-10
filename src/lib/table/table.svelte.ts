// The device's "who's here" for one group, shared by the picker and the start player modal. The group
// layout creates it and puts it in context; storage is read and written only in the browser.
import { createContext } from 'svelte';
import { storage } from '#lib/catalog/client.ts';
import { addGuest, HERE_TTL_MS, parseHere, serializeHere, type Here } from './here.ts';
import { markNight, nightOf, parseRegulars, type Regulars } from './regulars.ts';

/** What the who's-here chips edit: tonight's Table, or a play's own list of players. */
export interface HereSelection {
	members: string[];
	guests: string[];
	regulars: Regulars;
	loads: number;
	toggleMember(id: string): void;
	addGuest(name: string): boolean;
	removeGuest(name: string): void;
}

/** A selection that lives only in memory, for the play log form: changing it leaves tonight's table alone. */
export class Selection implements HereSelection {
	members = $state<string[]>([]);
	guests = $state<string[]>([]);
	regulars = $state<Regulars>({});
	loads = $state(0);

	constructor(members: string[] = [], guests: string[] = [], regulars: Regulars = {}) {
		this.members = [...members];
		this.guests = [...guests];
		this.regulars = regulars;
	}
	toggleMember(id: string) {
		this.members = this.members.includes(id) ? this.members.filter((m) => m !== id) : [...this.members, id];
	}
	addGuest(name: string): boolean {
		const next = addGuest(this.guests, name);
		if (next.length === this.guests.length) return false;
		this.guests = next;
		return true;
	}
	removeGuest(name: string) {
		this.guests = this.guests.filter((g) => g !== name);
	}
}

export class Table implements HereSelection {
	groupId = $state<string | null>(null);
	members = $state<string[]>([]);
	guests = $state<string[]>([]);
	/**
	 * Past nights per member as of the last load, for ranking. Ticks write to storage but not to this
	 * snapshot, so the list doesn't reorder under someone's finger.
	 */
	regulars = $state<Regulars>({});
	/** Goes up on every load, so views can reset what they unfolded. */
	loads = $state(0);

	private get key() {
		return `bp:present:${this.groupId}`;
	}
	private get regularsKey() {
		return `bp:regulars:${this.groupId}`;
	}

	/** Which night's list last seeded this table, so a later change to the night reseeds it. */
	private seed: string | undefined;

	/** `resetMs`: how long after the last change the table resets, the instance's HERE_RESET_HOURS (D71). */
	constructor(readonly resetMs = HERE_TTL_MS) {}

	/**
	 * Reads this device's table for a group. Called again whenever a view opens, so a stale table
	 * expires. On a game night's date, `tonight` seeds it from the night's going list (D38) unless the
	 * device already holds that same list, so ticks made at the table stay until the night changes.
	 */
	load(groupId: string, tonight: { key: string; members: string[]; guests: string[] } | null = null) {
		this.groupId = groupId;
		const here = parseHere(storage.get(this.key), Date.now(), this.resetMs);
		this.regulars = parseRegulars(storage.get(this.regularsKey));
		if (tonight && here.seed !== tonight.key) {
			this.members = [...tonight.members];
			this.guests = [...tonight.guests];
			this.seed = tonight.key;
			this.save();
		} else {
			this.members = here.members;
			this.guests = here.guests;
			this.seed = here.seed;
		}
		this.loads += 1;
	}

	/** Replaces the whole table, as when a shared setup link is opened. */
	set(here: Here) {
		this.members = [...here.members];
		this.guests = [...here.guests];
		this.save();
		this.recordNights(here.members, true);
	}

	toggleMember(id: string) {
		const here = !this.members.includes(id);
		this.members = here ? [...this.members, id] : this.members.filter((m) => m !== id);
		this.save();
		this.recordNights([id], here);
	}

	/** True when the name was added. */
	addGuest(name: string): boolean {
		const next = addGuest(this.guests, name);
		if (next.length === this.guests.length) return false;
		this.guests = next;
		this.save();
		return true;
	}

	removeGuest(name: string) {
		this.guests = this.guests.filter((g) => g !== name);
		this.save();
	}

	private save() {
		if (this.groupId) storage.set(this.key, serializeHere({ members: this.members, guests: this.guests, seed: this.seed }, Date.now()));
	}

	private recordNights(ids: readonly string[], here: boolean) {
		if (!this.groupId || ids.length === 0) return;
		const night = nightOf(Date.now());
		let regulars = parseRegulars(storage.get(this.regularsKey));
		for (const id of ids) regulars = markNight(regulars, id, night, here);
		storage.set(this.regularsKey, JSON.stringify(regulars));
	}
}

export const [getTable, setTable] = createContext<Table>();
