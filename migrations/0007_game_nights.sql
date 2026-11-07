-- Game nights (PRD "Game night", DECISIONS D38): a planned evening, who's going, what they'll bring.
CREATE TABLE game_nights (
  id          TEXT PRIMARY KEY,                     -- random, made by the app
  group_id    TEXT NOT NULL REFERENCES groups(id),
  name        TEXT NOT NULL,                        -- "Café", "At Ada's"
  night_on    TEXT NOT NULL,                        -- YYYY-MM-DD
  starts_at   TEXT,                                 -- HH:MM, optional
  host_id     TEXT REFERENCES users(id),            -- at a member's home: their shelf counts; NULL: somewhere else
  created_by  TEXT REFERENCES users(id),
  created_at  INTEGER NOT NULL
);
CREATE INDEX game_nights_group ON game_nights(group_id, night_on);

-- Who's going: members by id (going 0 when they said no), guests by name.
CREATE TABLE night_people (
  night_id    TEXT NOT NULL REFERENCES game_nights(id),
  user_id     TEXT REFERENCES users(id),
  guest_name  TEXT,
  going       INTEGER NOT NULL DEFAULT 1,
  CHECK ((user_id IS NULL) <> (guest_name IS NULL))
);
CREATE UNIQUE INDEX night_people_member ON night_people(night_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX night_people_guest ON night_people(night_id, guest_name) WHERE guest_name IS NOT NULL;
CREATE INDEX night_people_user ON night_people(user_id);

-- The bring list: a game and who brings it, a member (their copy, or one they're carrying) or a
-- guest. stayed_home is ticked on the night for a game that didn't come.
CREATE TABLE night_games (
  night_id    TEXT NOT NULL REFERENCES game_nights(id),
  game_id     INTEGER NOT NULL REFERENCES games(id),
  brought_by  TEXT REFERENCES users(id),
  guest_name  TEXT,
  added_by    TEXT REFERENCES users(id),
  stayed_home INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (night_id, game_id),
  CHECK ((brought_by IS NULL) <> (guest_name IS NULL))
);
CREATE INDEX night_games_game ON night_games(game_id);
CREATE INDEX night_games_brought ON night_games(brought_by);

-- A play logged on a night belongs to it.
ALTER TABLE plays ADD COLUMN night_id TEXT REFERENCES game_nights(id);
CREATE INDEX plays_night ON plays(night_id);

-- Who may plan nights: any member (the default) or only the owner and co-admins.
ALTER TABLE groups ADD COLUMN nights_by TEXT NOT NULL DEFAULT 'members' CHECK (nights_by IN ('members', 'admins'));
