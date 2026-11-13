-- Migration number: 0024 	 2026-11-13T03:54:04.022Z
-- New members waiting for approval, and suspended members (D79). Off unless a group turns probation
-- on, so a group that doesn't works as it did.
-- groups.probation: 1 when people who join wait until the owner or a co-admin lets them in.
ALTER TABLE groups ADD COLUMN probation INTEGER NOT NULL DEFAULT 0 CHECK (probation IN (0, 1));
-- memberships.waiting_since: when they joined a group with probation on, until they're let in. NULL
-- for a full member. suspended_at, suspended_by and suspended_note: a member the owner or a co-admin
-- suspended, read-only in this group until reinstated; the note is optional and shown to them alone.
ALTER TABLE memberships ADD COLUMN waiting_since INTEGER;
ALTER TABLE memberships ADD COLUMN suspended_at INTEGER;
ALTER TABLE memberships ADD COLUMN suspended_by TEXT REFERENCES users(id);
ALTER TABLE memberships ADD COLUMN suspended_note TEXT CHECK (length(suspended_note) <= 200);
