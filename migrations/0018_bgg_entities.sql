-- BGG writes an apostrophe in a name as &#039; (and the odd dash or quote as another character
-- reference), which the XML parser left in place before 0.5.0, so names read "Harbour&#039;s Light". The
-- parser now decodes them (bgg/parse.ts); this undoes them in what's already stored: names and their
-- search text, mechanics and themes, and the week's cached BGG searches. Quotes stay encoded inside
-- the JSON lists, where a bare " would break them.
UPDATE groups SET catalog_version = catalog_version + 1
 WHERE id IN (SELECT gc.group_id FROM group_copies gc JOIN games g ON g.id = gc.game_id
              WHERE instr(g.name, '&#') > 0 OR instr(g.mechanics, '&#') > 0 OR instr(g.categories, '&#') > 0);
UPDATE games SET
  name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, '&#039;', ''''), '&#39;', ''''), '&#x27;', ''''), '&#034;', '"'), '&#34;', '"'), '&#038;', '&'), '&#38;', '&'), '&#8211;', '–'), '&#8212;', '—'), '&#8216;', '‘'), '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8230;', '…'),
  search_text = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(search_text, '&#039;', ''''), '&#39;', ''''), '&#x27;', ''''), '&#034;', '"'), '&#34;', '"'), '&#038;', '&'), '&#38;', '&'), '&#8211;', '–'), '&#8212;', '—'), '&#8216;', '‘'), '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8230;', '…')
 WHERE instr(name, '&#') > 0 OR instr(search_text, '&#') > 0;
UPDATE games SET
  mechanics = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mechanics, '&#039;', ''''), '&#39;', ''''), '&#x27;', ''''), '&#038;', '&'), '&#38;', '&'), '&#8211;', '–'), '&#8212;', '—'), '&#8216;', '‘'), '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8230;', '…'),
  categories = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(categories, '&#039;', ''''), '&#39;', ''''), '&#x27;', ''''), '&#038;', '&'), '&#38;', '&'), '&#8211;', '–'), '&#8212;', '—'), '&#8216;', '‘'), '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8230;', '…')
 WHERE instr(mechanics, '&#') > 0 OR instr(categories, '&#') > 0;
UPDATE bgg_search_cache SET hits = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(hits, '&#039;', ''''), '&#39;', ''''), '&#x27;', ''''), '&#038;', '&'), '&#38;', '&'), '&#8211;', '–'), '&#8212;', '—'), '&#8216;', '‘'), '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8230;', '…') WHERE instr(hits, '&#') > 0;
