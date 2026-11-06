-- Each group's corrections to a hand-entered or Wikidata game (DECISIONS D35). A game is one row
-- shared by every group; a correction is seen only by the group that made it. NULL means "as the
-- game row says". Never applied to BGG games, whose data can't be changed.
CREATE TABLE game_corrections (
  group_id      TEXT NOT NULL REFERENCES groups(id),
  game_id       INTEGER NOT NULL REFERENCES games(id),
  name          TEXT,
  search_text   TEXT,              -- the corrected name, normalized, added to the group's search
  image_url     TEXT,
  min_players   INTEGER,
  max_players   INTEGER,
  min_playtime  INTEGER,
  max_playtime  INTEGER,
  weight        REAL,              -- the group's complexity, 1 to 5
  edited_by     TEXT REFERENCES users(id),
  edited_at     INTEGER NOT NULL,
  PRIMARY KEY (group_id, game_id)
);
CREATE INDEX game_corrections_game ON game_corrections(game_id);
