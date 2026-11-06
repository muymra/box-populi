-- A group's colour theme, set by its owner or co-admins (DESIGN.md "Themes"). NULL: the instance default.
ALTER TABLE groups ADD COLUMN theme TEXT;
