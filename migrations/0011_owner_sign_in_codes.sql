-- The host can make a one-time sign-in code for a group's owner (DECISIONS D52), logged with a reason
-- like suspending. SQLite can't change a CHECK constraint in place, so the log is rebuilt with the new
-- action and its rows copied over. Nothing references this table.
CREATE TABLE admin_actions_new (
  id            INTEGER PRIMARY KEY,
  action        TEXT NOT NULL CHECK (action IN ('suspend_group','unsuspend_group','delete_group','owner_sign_in_code')),
  target_id     TEXT NOT NULL,
  target_label  TEXT NOT NULL,
  reason        TEXT NOT NULL,
  at            INTEGER NOT NULL
);
INSERT INTO admin_actions_new (id, action, target_id, target_label, reason, at)
  SELECT id, action, target_id, target_label, reason, at FROM admin_actions;
DROP TABLE admin_actions;
ALTER TABLE admin_actions_new RENAME TO admin_actions;
