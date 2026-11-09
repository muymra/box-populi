-- Who came to a game night (DECISIONS D67), checked after it: NULL until someone does, so a night
-- nobody checked counts its going list. 1 came, 0 didn't. Anyone in a play logged on the night came,
-- whatever this says.
ALTER TABLE night_people ADD COLUMN came INTEGER;

-- Plays saved on the wrong day before 0.5.0 (STATUS item 42). A play logged from a past night's page
-- took today's date, so it sits after its night: it was played on the night. A play logged from a
-- game's page on a night's date, then moved to an earlier day, kept tonight's night: it was played on
-- that earlier day, so it leaves the night.
UPDATE groups SET catalog_version = catalog_version + 1
 WHERE id IN (SELECT p.group_id FROM plays p JOIN game_nights n ON n.id = p.night_id WHERE p.played_on <> n.night_on);
UPDATE plays SET played_on = (SELECT n.night_on FROM game_nights n WHERE n.id = plays.night_id)
 WHERE night_id IS NOT NULL AND played_on > (SELECT n.night_on FROM game_nights n WHERE n.id = plays.night_id);
UPDATE plays SET night_id = NULL
 WHERE night_id IS NOT NULL AND played_on < (SELECT n.night_on FROM game_nights n WHERE n.id = plays.night_id);
