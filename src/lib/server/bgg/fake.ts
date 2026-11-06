// BGG_MODE=fake: serves the committed fixtures, for development and tests only. Fixtures are
// bundled through Vite because Workers have no file system.
import { parseCollection, parseSearch, parseThings } from './parse.ts';
import type { BggClient, BggCollectionResult, BggSearchHit, BggThing } from './types.ts';

const fixtures = import.meta.glob('./fixtures/*.xml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const fixture = (name: string) => {
	const xml = fixtures[`./fixtures/${name}`];
	if (!xml) throw new Error(`Missing BGG fixture ${name}`);
	return xml;
};

export class FakeBggClient implements BggClient {
	async search(query: string): Promise<BggSearchHit[]> {
		const q = query.trim().toLowerCase();
		return parseSearch(fixture('search.xml')).filter((hit) => hit.name.toLowerCase().includes(q));
	}

	async things(bggIds: number[]): Promise<BggThing[]> {
		const wanted = new Set(bggIds);
		return parseThings(fixture('thing-batch.xml')).filter((t) => wanted.has(t.bggId));
	}

	/** Usernames "pending" and "nobody" simulate BGG's 202 and unknown-user answers. */
	async collection(username: string): Promise<BggCollectionResult> {
		if (username === 'pending') return { status: 'pending' };
		if (username === 'nobody') return parseCollection(fixture('collection-error.xml'));
		return parseCollection(fixture('collection.xml'));
	}
}
