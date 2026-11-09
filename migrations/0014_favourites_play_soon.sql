-- Favourites (DECISIONS D63) and Play soon (D64). Both belong to the person, like the wishlist, so they
-- show in every group they're in. A Play soon mark counts until the first of: 8 weeks after marked_at,
-- a logged play of the game with the person in it, or a night they were going to with the game on its
-- bring list. That's worked out when read (`interest.ts`), since Pages has no cron.
CREATE TABLE favourites (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id   INTEGER NOT NULL REFERENCES games(id),
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);
CREATE INDEX favourites_game ON favourites(game_id);

CREATE TABLE play_soon (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    INTEGER NOT NULL REFERENCES games(id),
  marked_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);
CREATE INDEX play_soon_game ON play_soon(game_id);
