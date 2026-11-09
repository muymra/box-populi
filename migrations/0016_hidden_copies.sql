-- Hiding games per group (DECISIONS D66, PRD open question 1). A member keeps some of their own games
-- out of one group while their other groups still see them.

-- One row per copy hidden from one group. Only the copy's owner hides it.
CREATE TABLE hidden_copies (
  group_id   TEXT NOT NULL REFERENCES groups(id),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    INTEGER NOT NULL REFERENCES games(id),
  hidden_at  INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id, game_id)
);
CREATE INDEX hidden_copies_copy ON hidden_copies(user_id, game_id);

-- "Hide new games here": a copy the person adds later starts hidden in this group.
ALTER TABLE memberships ADD COLUMN hide_new INTEGER NOT NULL DEFAULT 0;

-- The triggers keep hidden_copies in step with copies and memberships, whichever code changes them:
-- a new copy starts hidden where its owner has hide_new on (search, import, pasted lists, merges);
CREATE TRIGGER hidden_copies_new AFTER INSERT ON copies BEGIN
  INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at)
    SELECT m.group_id, new.user_id, new.game_id, new.added_at FROM memberships m WHERE m.user_id = new.user_id AND m.hide_new = 1
    ON CONFLICT DO NOTHING;
END;
-- a copy taken off the shelf takes its hides with it;
CREATE TRIGGER hidden_copies_gone AFTER DELETE ON copies BEGIN
  DELETE FROM hidden_copies WHERE user_id = old.user_id AND game_id = old.game_id;
END;
-- a copy moved to another game (Find on BoardGameGeek) or person (merging entries) keeps them;
CREATE TRIGGER hidden_copies_moved AFTER UPDATE OF user_id, game_id ON copies
  WHEN old.user_id <> new.user_id OR old.game_id <> new.game_id BEGIN
  INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at)
    SELECT group_id, new.user_id, new.game_id, hidden_at FROM hidden_copies WHERE user_id = old.user_id AND game_id = old.game_id
    ON CONFLICT DO NOTHING;
  DELETE FROM hidden_copies WHERE user_id = old.user_id AND game_id = old.game_id;
END;
-- and leaving a group, or being removed from it, clears what was hidden there.
CREATE TRIGGER hidden_copies_left AFTER DELETE ON memberships BEGIN
  DELETE FROM hidden_copies WHERE group_id = old.group_id AND user_id = old.user_id;
END;

-- A group's shelf: every copy owned by one of its members, apart from those hidden from it. Every
-- query about what a group holds reads this, so none can forget the hidden ones.
CREATE VIEW group_copies AS
  SELECT m.group_id, c.id, c.user_id, c.game_id, c.lent_to_user_id, c.lent_to_text, c.added_at
  FROM memberships m JOIN copies c ON c.user_id = m.user_id
  WHERE NOT EXISTS (SELECT 1 FROM hidden_copies h WHERE h.group_id = m.group_id AND h.user_id = c.user_id AND h.game_id = c.game_id);
