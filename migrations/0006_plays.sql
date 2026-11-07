-- The play log (PRD "Play log", DECISIONS D37). A play is one game on one night in one group.
CREATE TABLE plays (
  id           TEXT PRIMARY KEY,                       -- random, made by the app
  group_id     TEXT NOT NULL REFERENCES groups(id),
  game_id      INTEGER NOT NULL REFERENCES games(id),
  played_on    TEXT NOT NULL,                          -- the night, YYYY-MM-DD
  coop         TEXT CHECK (coop IN ('won', 'lost')),   -- NULL for a competitive play
  lowest_wins  INTEGER NOT NULL DEFAULT 0,             -- scores were ranked low to high
  logged_by    TEXT REFERENCES users(id),
  created_at   INTEGER NOT NULL
);
CREATE INDEX plays_group ON plays(group_id, played_on);
CREATE INDEX plays_game ON plays(game_id);

-- Who played: a member by id or a guest by name. Place 1 is first and ties share a place; co-op
-- plays have no places. Scores are optional.
CREATE TABLE play_players (
  play_id      TEXT NOT NULL REFERENCES plays(id),
  seat         INTEGER NOT NULL,                       -- the order they were entered in
  user_id      TEXT REFERENCES users(id),
  guest_name   TEXT,
  place        INTEGER,
  score        INTEGER,
  PRIMARY KEY (play_id, seat),
  CHECK ((user_id IS NULL) <> (guest_name IS NULL))
);
CREATE INDEX play_players_user ON play_players(user_id);

-- Podium points for the leaderboard, comma-separated from first place down. NULL: 3,2,1.
ALTER TABLE groups ADD COLUMN podium_points TEXT;
