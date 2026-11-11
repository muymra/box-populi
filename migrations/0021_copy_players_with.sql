-- Migration number: 0021 	 2026-11-11T06:53:01.981Z
-- The owner's count on their copy (D75): how many can play with the expansions they own, when those
-- stack in a way BGG's per-expansion counts can't say (Cosmic Encounter's two expansions that each add
-- a player). Null means none set: the game goes by BGG's counts. The group's shelf reads copies through
-- group_copies (D66), so the view is recreated with the new column.
ALTER TABLE copies ADD COLUMN max_players_with INTEGER CHECK (max_players_with BETWEEN 2 AND 30);
DROP VIEW group_copies;
CREATE VIEW group_copies AS
  SELECT m.group_id, c.id, c.user_id, c.game_id, c.lent_to_user_id, c.lent_to_text, c.added_at, c.max_players_with
  FROM memberships m JOIN copies c ON c.user_id = m.user_id
  WHERE NOT EXISTS (SELECT 1 FROM hidden_copies h WHERE h.group_id = m.group_id AND h.user_id = c.user_id AND h.game_id = c.game_id);
