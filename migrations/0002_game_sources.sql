-- Where each game's details came from (DECISIONS D31). 0001 is frozen: it's applied in production.
--   bgg:      fetched from BoardGameGeek; never edited by people (BGG's terms).
--   wikidata: from Wikidata in the public-sources mode; members can correct and complete it.
--   manual:   typed in by a member; members can edit it.
ALTER TABLE games ADD COLUMN source TEXT NOT NULL DEFAULT 'bgg' CHECK (source IN ('bgg', 'wikidata', 'manual'));
UPDATE games SET source = 'manual' WHERE is_manual = 1;

ALTER TABLE games ADD COLUMN wikidata_id TEXT;
CREATE UNIQUE INDEX games_wikidata ON games(wikidata_id) WHERE wikidata_id IS NOT NULL;

-- The last person to edit a non-BGG game's details, shown on its page.
ALTER TABLE games ADD COLUMN edited_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN edited_at INTEGER;
