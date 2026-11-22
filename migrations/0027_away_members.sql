-- Migration number: 0027 	 2026-11-22T04:02:27.848Z
-- Members who've been away (D86). Off unless a group turns it on, so a group that doesn't works as it did.
-- groups.away_months: how many months (of 30 days) without being around before a member counts as
-- away, 1 to 24; NULL while it's off. groups.away_hides: 1 when an away member's games leave the
-- group's shelf. groups.away_checked_at: when memberships.off_shelf was last brought up to date; with
-- no cron, a visit to the group does it at most once a day.
ALTER TABLE groups ADD COLUMN away_months INTEGER CHECK (away_months BETWEEN 1 AND 24);
ALTER TABLE groups ADD COLUMN away_hides INTEGER NOT NULL DEFAULT 0 CHECK (away_hides IN (0, 1));
ALTER TABLE groups ADD COLUMN away_checked_at INTEGER NOT NULL DEFAULT 0;

-- memberships.active_at: the latest play they were in, night they came to or said they'd go to, or
-- time the owner or a co-admin marked them as around (ms). Being around is the latest of it,
-- last_seen_at and joined_at, so visits and joining need no write here. memberships.off_shelf: 1 while
-- they're away in a group whose away members' games leave the shelf; group_copies leaves those out.
ALTER TABLE memberships ADD COLUMN active_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN off_shelf INTEGER NOT NULL DEFAULT 0 CHECK (off_shelf IN (0, 1));

-- Filled from the plays and nights already logged: a night they came to, or said they'd go to and
-- weren't marked as missing. A night still to come counts from now.
UPDATE memberships SET active_at = MAX(
  COALESCE((SELECT MAX(CAST(strftime('%s', p.played_on) AS INTEGER)) * 1000
            FROM play_players pp JOIN plays p ON p.id = pp.play_id
            WHERE pp.user_id = memberships.user_id AND p.group_id = memberships.group_id), 0),
  COALESCE((SELECT MIN(MAX(CAST(strftime('%s', n.night_on) AS INTEGER)), CAST(strftime('%s', 'now') AS INTEGER)) * 1000
            FROM night_people np JOIN game_nights n ON n.id = np.night_id
            WHERE np.user_id = memberships.user_id AND n.group_id = memberships.group_id AND (np.came = 1 OR (np.going = 1 AND np.came IS NOT 0))), 0)
);

-- A member's games leaving or coming back changes the shelf, so the catalog's version moves (D65).
CREATE TRIGGER memberships_off_shelf AFTER UPDATE OF off_shelf ON memberships WHEN old.off_shelf <> new.off_shelf BEGIN
  UPDATE groups SET catalog_version = catalog_version + 1 WHERE id = new.group_id;
END;

-- The group's shelf (D66) without the games of members who are away in a group that takes them off it.
DROP VIEW group_copies;
CREATE VIEW group_copies AS
  SELECT m.group_id, c.id, c.user_id, c.game_id, c.lent_to_user_id, c.lent_to_text, c.added_at, c.max_players_with
  FROM memberships m JOIN copies c ON c.user_id = m.user_id
  WHERE m.off_shelf = 0
    AND NOT EXISTS (SELECT 1 FROM hidden_copies h WHERE h.group_id = m.group_id AND h.user_id = c.user_id AND h.game_id = c.game_id);
