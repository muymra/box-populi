-- Asking BGG less (DECISIONS D58). Search results are reused for a week instead of asking BGG again
-- for the same words, and every request this instance makes to BGG is counted per UTC day, so the
-- host can see on /admin how much it asks and how often BGG pushed back.
CREATE TABLE bgg_search_cache (
  query       TEXT PRIMARY KEY,   -- the search, normalized (case, accents and extra spaces set aside)
  hits        TEXT NOT NULL,      -- JSON: the top 20 hits, ranked, as { bggId, name, year, type }
  fetched_at  INTEGER NOT NULL
);
CREATE INDEX bgg_search_cache_at ON bgg_search_cache(fetched_at);

CREATE TABLE bgg_daily (
  day        TEXT PRIMARY KEY,           -- YYYY-MM-DD, UTC
  requests   INTEGER NOT NULL DEFAULT 0, -- requests sent to BGG
  throttled  INTEGER NOT NULL DEFAULT 0  -- answered 429, 500, 502 or 503
);
