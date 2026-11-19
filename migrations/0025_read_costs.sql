-- Migration number: 0025 	 2026-11-19T06:05:25.886Z
-- Fewer rows read per request (D82). On 2026-11-19 one query used up the account's 5 million free D1
-- reads a day; an audit at the planned scale (50 members, 1,500 games, 4,000 copies, 2,900 plays)
-- found pages reading 17,000 to 35,000 rows each. Nothing here changes what anyone sees.

-- Indexes on the foreign keys that point at games, which had none starting with game_id: with
-- foreign keys on, deleting a game (a "Find on BoardGameGeek" merge, a typed-in game nobody has any
-- more) scanned all three tables.
CREATE INDEX wishlist_game ON wishlist(game_id);
CREATE INDEX game_links_game ON game_links(game_id);
CREATE INDEX hidden_copies_game ON hidden_copies(game_id);

-- Games still waiting for their BGG details (importer.ts NEEDS_BGG_DETAILS, word for word, so SQLite
-- can use it): nearly always none, where the count on every group page read each of the viewer's copies.
CREATE INDEX games_needs_details ON games(id)
  WHERE bgg_id IS NOT NULL AND (fetched_at IS NULL OR source <> 'bgg' OR is_manual = 1);

-- BGG's games, for the footer's credit check: one row read, where it read every game when there
-- were none (BGG off).
CREATE INDEX games_from_bgg ON games(id) WHERE source = 'bgg' AND is_manual = 0 AND bgg_id IS NOT NULL;

-- When the group's next BGG game turns 30 days old (D80), so the shelf's refresh call costs one row
-- until then instead of gathering the group's games (19,400 rows at the planned scale) every time.
-- 0: look at the next call.
ALTER TABLE groups ADD COLUMN next_refresh_at INTEGER NOT NULL DEFAULT 0;

-- Guests' seats and the games guests bring, for the Group tab's "Plays as a guest…" (D37): its guest
-- history starts from these few rows, where reading every seat of the group's plays cost 25,000 rows at
-- the planned scale. Partial, so only guest rows are written to them. Guests' night answers already
-- have night_people_guest (0007).
CREATE INDEX play_players_guest ON play_players(play_id) WHERE guest_name IS NOT NULL;
CREATE INDEX night_games_guest ON night_games(night_id) WHERE guest_name IS NOT NULL;

-- A counter for everything the leaderboard counts: plays, their seats and the group's members.
-- Triggers keep it, whichever code writes (a play logged, edited or deleted, a merge, a night moved,
-- an account deleted, someone joining or leaving).
ALTER TABLE groups ADD COLUMN standings_version INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER standings_play_insert AFTER INSERT ON plays BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = new.group_id;
END;
CREATE TRIGGER standings_play_update AFTER UPDATE ON plays BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id IN (old.group_id, new.group_id);
END;
CREATE TRIGGER standings_play_delete AFTER DELETE ON plays BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = old.group_id;
END;
CREATE TRIGGER standings_seat_insert AFTER INSERT ON play_players BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = (SELECT group_id FROM plays WHERE id = new.play_id);
END;
CREATE TRIGGER standings_seat_update AFTER UPDATE ON play_players BEGIN
  UPDATE groups SET standings_version = standings_version + 1
  WHERE id IN (SELECT group_id FROM plays WHERE id IN (old.play_id, new.play_id));
END;
CREATE TRIGGER standings_seat_delete AFTER DELETE ON play_players BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = (SELECT group_id FROM plays WHERE id = old.play_id);
END;
CREATE TRIGGER standings_member_insert AFTER INSERT ON memberships BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = new.group_id;
END;
CREATE TRIGGER standings_member_update AFTER UPDATE OF group_id, user_id ON memberships BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id IN (old.group_id, new.group_id);
END;
CREATE TRIGGER standings_member_delete AFTER DELETE ON memberships BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = old.group_id;
END;

-- Figures counted from a group's plays, as JSON, kept while standings_version stands: the
-- leaderboard's counts per member for a period ("standings <since> <before>", before the group's points
-- rules are applied) and a member's play history for their profile ("outcomes <user id>"). Deleted with
-- the group and with any member's account.
CREATE TABLE plays_cache (
  group_id TEXT NOT NULL REFERENCES groups(id),
  key      TEXT NOT NULL,
  version  INTEGER NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (group_id, key)
);

-- The catalog as the JSON the endpoint sends, for one version and build, so a server instance that
-- didn't build it reads one row instead of the whole shelf. game_count, copy_count and member_counts
-- (copies on the shelf per member, as a JSON object) serve the home page, the join page, /admin and the
-- Group tab. One row per group, replaced by the next build. Deleted with the group and with any
-- member's account.
CREATE TABLE catalog_cache (
  group_id      TEXT PRIMARY KEY REFERENCES groups(id),
  version       INTEGER NOT NULL,
  build         TEXT NOT NULL,
  game_count    INTEGER NOT NULL,
  copy_count    INTEGER NOT NULL,
  member_counts TEXT NOT NULL,
  body          TEXT NOT NULL
);
