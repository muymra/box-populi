-- Look of the instance, set on /admin (DESIGN.md "Themes"): a custom theme from five colours and
-- an optional logo. One row. custom_colors is JSON {page, surface, ink, strip, accent}, or NULL.
CREATE TABLE instance_settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  custom_colors   TEXT,
  custom_default  INTEGER NOT NULL DEFAULT 0,
  logo_url        TEXT,
  updated_at      INTEGER NOT NULL DEFAULT 0
);
INSERT INTO instance_settings (id) VALUES (1);
