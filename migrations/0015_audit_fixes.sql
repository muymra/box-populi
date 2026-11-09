-- Fixes from the 2026-11-09 audit (DECISIONS D65).

-- Indexes that were missing. Each was a full scan, measured on a database at the planned scale (TECH.md
-- "Scale and budget"):
-- a night's people, read by every group layout, night page and plays page: both indexes on night_id
-- were partial, so `night_id IN (...)` scanned every group's rows (about 6,200 rows a read);
CREATE INDEX night_people_night ON night_people(night_id);
-- a game's plays in a group, newest first, on the game page and the catalog's "last played"
-- (1,800 rows read to return none);
CREATE INDEX plays_group_game ON plays(group_id, game_id, played_on);
-- what a person has borrowed, on Your account, and the loan moves when merging or deleting a person
-- (every copy on the instance).
CREATE INDEX copies_lent_to ON copies(lent_to_user_id) WHERE lent_to_user_id IS NOT NULL;

-- Invite links carry a key after the code (/join/HQ6T8-<key>): a link with the right key skips the
-- instance-wide ceiling on wrong codes, so a flood of guesses can't lock members out of their own
-- group. 80 random bits as 20 hex characters; replaced with the code.
ALTER TABLE groups ADD COLUMN link_key TEXT;
UPDATE groups SET link_key = lower(hex(randomblob(10)));

-- Which base games each expansion is for, one row per pair, so a game page finds the group's
-- expansions of a game by index instead of reading every copy in the group and unpacking each
-- game's base_bgg_ids (8,800 rows read per view at the planned scale). Triggers keep it in step
-- with games.base_bgg_ids, whichever code writes it; no foreign key, since it's derived.
CREATE TABLE game_bases (
  base_bgg_id INTEGER NOT NULL,
  game_id     INTEGER NOT NULL,
  PRIMARY KEY (base_bgg_id, game_id)
);
CREATE INDEX game_bases_game ON game_bases(game_id);
INSERT INTO game_bases (base_bgg_id, game_id)
  SELECT DISTINCT j.value, g.id FROM games g, json_each(g.base_bgg_ids) j WHERE j.value IS NOT NULL;
CREATE TRIGGER game_bases_insert AFTER INSERT ON games BEGIN
  INSERT INTO game_bases (base_bgg_id, game_id) SELECT DISTINCT value, new.id FROM json_each(new.base_bgg_ids) WHERE value IS NOT NULL;
END;
CREATE TRIGGER game_bases_update AFTER UPDATE OF base_bgg_ids ON games BEGIN
  DELETE FROM game_bases WHERE game_id = old.id;
  INSERT INTO game_bases (base_bgg_id, game_id) SELECT DISTINCT value, new.id FROM json_each(new.base_bgg_ids) WHERE value IS NOT NULL;
END;
CREATE TRIGGER game_bases_delete AFTER DELETE ON games BEGIN
  DELETE FROM game_bases WHERE game_id = old.id;
END;
