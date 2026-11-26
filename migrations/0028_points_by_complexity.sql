-- Migration number: 0028 	 2026-11-26T13:29:02.555Z
-- Points that follow a game's complexity (D89). Off unless a group turns it on, so a group that doesn't
-- scores as it did. When it's on, every point a play gives is multiplied by its game's level, 1 to 5:
-- the weight rounded to the nearest whole number (weightBucket in buckets.ts, D62), 1 with no weight.
ALTER TABLE groups ADD COLUMN points_by_complexity INTEGER NOT NULL DEFAULT 0 CHECK (points_by_complexity IN (0, 1));

-- The leaderboard's kept counts (plays_cache, 0025) are counted with the setting and the levels as
-- they were, so turning it on or off counts them again...
CREATE TRIGGER standings_by_complexity AFTER UPDATE OF points_by_complexity ON groups
WHEN old.points_by_complexity <> new.points_by_complexity BEGIN
  UPDATE groups SET standings_version = standings_version + 1 WHERE id = new.id;
END;

-- ...and so does a played game's level changing (a member's edit, BGG's refresh), in the groups that
-- have the setting on. The CASE is LEVEL_OR_ONE in src/lib/server/plays.ts.
CREATE TRIGGER standings_game_level AFTER UPDATE OF weight ON games
WHEN (CASE WHEN old.weight IS NULL OR old.weight < 1.5 THEN 1 WHEN old.weight < 2.5 THEN 2 WHEN old.weight < 3.5 THEN 3 WHEN old.weight < 4.5 THEN 4 ELSE 5 END)
  <> (CASE WHEN new.weight IS NULL OR new.weight < 1.5 THEN 1 WHEN new.weight < 2.5 THEN 2 WHEN new.weight < 3.5 THEN 3 WHEN new.weight < 4.5 THEN 4 ELSE 5 END) BEGIN
  UPDATE groups SET standings_version = standings_version + 1
  WHERE points_by_complexity = 1 AND id IN (SELECT group_id FROM plays WHERE game_id = new.id);
END;
