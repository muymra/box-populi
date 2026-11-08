-- One-time sign-in codes a group's owner or a co-admin makes for a member who has lost their PIN
-- and every device (DECISIONS D48). One per person; works once, for ten minutes, at that group's
-- front door. Only the code's SHA-256 is stored.
CREATE TABLE sign_in_codes (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  group_id    TEXT NOT NULL REFERENCES groups(id),
  code_hash   TEXT NOT NULL,
  created_by  TEXT REFERENCES users(id),
  expires_at  INTEGER NOT NULL
);
