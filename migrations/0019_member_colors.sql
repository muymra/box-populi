-- Each member's colour, stored when they join (DECISIONS D69). Until now it was worked out from the
-- current members' join order on every read, so when someone left, everyone who joined after them
-- moved to the next colour down. Existing members keep the colour they have today: their place in
-- join order, ties by id, as colorIndexesByJoinOrder() had it.
ALTER TABLE memberships ADD COLUMN color_index INTEGER;

UPDATE memberships SET color_index = (
  SELECT COUNT(*) FROM memberships o
  WHERE o.group_id = memberships.group_id
    AND (o.joined_at < memberships.joined_at OR (o.joined_at = memberships.joined_at AND o.user_id < memberships.user_id))
);

-- A new member takes the lowest index nobody in the group holds, so a leaver's colour goes to the next
-- person to join and nobody else's moves. A trigger, so every way in (joining, creating a group, the
-- seeds) gets one; an insert that names a colour keeps it.
CREATE TRIGGER memberships_color AFTER INSERT ON memberships WHEN NEW.color_index IS NULL BEGIN
  UPDATE memberships SET color_index = (
    SELECT MIN(c.n) FROM (
      SELECT 0 AS n
      UNION ALL SELECT t.color_index + 1 FROM memberships t WHERE t.group_id = NEW.group_id AND t.color_index IS NOT NULL
    ) c
    WHERE NOT EXISTS (SELECT 1 FROM memberships u WHERE u.group_id = NEW.group_id AND u.color_index = c.n)
  )
  WHERE group_id = NEW.group_id AND user_id = NEW.user_id;
END;
