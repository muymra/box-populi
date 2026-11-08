-- Archiving a group (DECISIONS D50): read-only for its members, its join link closed, kept until an
-- owner or co-admin restores it or the owner deletes it for good.
ALTER TABLE groups ADD COLUMN archived_at INTEGER;
ALTER TABLE groups ADD COLUMN archived_by TEXT REFERENCES users(id);
