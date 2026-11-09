-- Complexity levels become BGG's five vote labels (DECISIONS D62, replacing D56). A member's level was
-- stored as the middle of one of three bands, 1.5, 3 or 4.5; it's now the BGG vote its level stands for,
-- 1 to 5. A stored 1.5 would round to Medium light, so a member's Light moves to 1, and Heavy to 5;
-- Medium stays 3. BGG's own weights are never touched: only games without BGG details, and groups'
-- corrections from before D54.
UPDATE games SET weight = CASE weight WHEN 1.5 THEN 1 ELSE 5 END
 WHERE (source <> 'bgg' OR is_manual = 1) AND weight IN (1.5, 4.5);
UPDATE game_corrections SET weight = CASE weight WHEN 1.5 THEN 1 ELSE 5 END
 WHERE weight IN (1.5, 4.5);
