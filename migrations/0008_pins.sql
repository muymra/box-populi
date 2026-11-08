-- A PIN for getting back in through a group's front door (DECISIONS D47): six digits the person
-- chooses, stored as a salted SHA-256 fingerprint, never the digits themselves.
ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN pin_salt TEXT;
ALTER TABLE users ADD COLUMN pin_set_at INTEGER;
