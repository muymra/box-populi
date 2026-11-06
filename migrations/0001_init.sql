-- Box Populi initial schema. See TECH.md "Data model" for the reasoning behind each choice.
-- Timestamps are Unix milliseconds. JSON columns hold arrays of strings or numbers.
-- Never edit this file once applied anywhere; add a new migration instead.

-- identity: a person is a display name; no accounts, no emails (DECISIONS D25)
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- the reusable personal link for signing in on another device; one per person, hash only
CREATE TABLE personal_links (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,   -- hex sha256 of the cookie token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- groups
CREATE TABLE groups (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  code              TEXT NOT NULL UNIQUE,
  is_demo           INTEGER NOT NULL DEFAULT 0,
  catalog_version   INTEGER NOT NULL DEFAULT 0,
  suspended_at      INTEGER,
  suspended_reason  TEXT,
  created_at        INTEGER NOT NULL
);

CREATE TABLE memberships (
  group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at     INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX memberships_user ON memberships(user_id);
CREATE UNIQUE INDEX memberships_one_owner ON memberships(group_id) WHERE role = 'owner';

-- shared game cache: one row per game
CREATE TABLE games (
  id            INTEGER PRIMARY KEY,
  bgg_id        INTEGER UNIQUE,
  name          TEXT NOT NULL,
  search_text   TEXT NOT NULL,
  year          INTEGER,
  description   TEXT,
  image_url     TEXT,
  thumb_url     TEXT,
  min_players   INTEGER,
  max_players   INTEGER,
  best_mask     INTEGER NOT NULL DEFAULT 0,
  rec_mask      INTEGER NOT NULL DEFAULT 0,
  poll_source   TEXT CHECK (poll_source IN ('summary','votes')),
  min_playtime  INTEGER,
  max_playtime  INTEGER,
  weight        REAL,
  users_rated   INTEGER,
  mechanics     TEXT NOT NULL DEFAULT '[]',
  categories    TEXT NOT NULL DEFAULT '[]',
  base_bgg_ids  TEXT NOT NULL DEFAULT '[]',
  is_expansion  INTEGER NOT NULL DEFAULT 0,
  is_manual     INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  fetched_at    INTEGER
);

-- ownership
CREATE TABLE copies (
  id               INTEGER PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id          INTEGER NOT NULL REFERENCES games(id),
  note             TEXT,
  lent_to_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  lent_to_text     TEXT,
  added_at         INTEGER NOT NULL,
  UNIQUE (user_id, game_id),
  CHECK (lent_to_user_id IS NULL OR lent_to_text IS NULL)
);
CREATE INDEX copies_game ON copies(game_id);

CREATE TABLE wishlist (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id   INTEGER NOT NULL REFERENCES games(id),
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE game_links (
  id        INTEGER PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_id   INTEGER NOT NULL REFERENCES games(id),
  kind      TEXT NOT NULL CHECK (kind IN ('rules','video','other')),
  title     TEXT,
  url       TEXT NOT NULL,
  added_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at  INTEGER NOT NULL
);
CREATE INDEX game_links_lookup ON game_links(group_id, game_id);

-- rate limiting; subject is a user id or 'ip:<address>'
CREATE TABLE rate_events (
  subject  TEXT NOT NULL,
  kind     TEXT NOT NULL,
  at       INTEGER NOT NULL
);
CREATE INDEX rate_events_lookup ON rate_events(subject, kind, at);

-- instance-wide BGG request pacing (exactly one row)
CREATE TABLE bgg_pace (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  next_at  INTEGER NOT NULL
);
INSERT INTO bgg_pace (id, next_at) VALUES (1, 0);

-- instance administration log
CREATE TABLE admin_actions (
  id            INTEGER PRIMARY KEY,
  action        TEXT NOT NULL CHECK (action IN ('suspend_group','unsuspend_group','delete_group')),
  target_id     TEXT NOT NULL,
  target_label  TEXT NOT NULL,
  reason        TEXT NOT NULL,
  at            INTEGER NOT NULL
);
