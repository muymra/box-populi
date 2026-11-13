import { describe, expect, it } from 'vitest';
import { lineParts, prose } from './prose.ts';

describe('prose', () => {
	it('splits paragraphs at blank lines and keeps line breaks', () => {
		expect(prose('Bring snacks.\nParking at the back.\n\n\nSee you there')).toEqual([
			[[{ text: 'Bring snacks.' }], [{ text: 'Parking at the back.' }]],
			[[{ text: 'See you there' }]]
		]);
		expect(prose('')).toEqual([]);
	});

	it('links web addresses, leaving the punctuation around them', () => {
		expect(lineParts('Map: https://maps.example.com/x?a=1&b=2. Bring it!')).toEqual([
			{ text: 'Map: ' },
			{ url: 'https://maps.example.com/x?a=1&b=2' },
			{ text: '. Bring it!' }
		]);
		expect(lineParts('(see https://example.com/rules)')).toEqual([{ text: '(see ' }, { url: 'https://example.com/rules' }, { text: ')' }]);
		expect(lineParts('https://en.wikipedia.org/wiki/Go_(game), anyone?')).toEqual([{ url: 'https://en.wikipedia.org/wiki/Go_(game)' }, { text: ', anyone?' }]);
		expect(lineParts('http://a.example and https://b.example')).toEqual([{ url: 'http://a.example' }, { text: ' and ' }, { url: 'https://b.example' }]);
	});

	it('leaves anything that isn’t a web address as text', () => {
		expect(lineParts('javascript:alert(1) www.example.com ftp://x.example')).toEqual([{ text: 'javascript:alert(1) www.example.com ftp://x.example' }]);
		expect(lineParts('https://localhost/x')).toEqual([{ text: 'https://localhost/x' }]);
		expect(lineParts('<https://a.example>')).toEqual([{ text: '<' }, { url: 'https://a.example' }, { text: '>' }]);
	});
});
