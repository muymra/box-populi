-- Migration number: 0020 	 2026-11-10T14:05:12.879Z
-- Play rules and fillers per group (D71): what a co-op win scores and whether it counts as a win on the
-- leaderboard, what Play tonight calls a filler, and how far back the shelf's "Not played lately" looks.
-- The defaults are what every group had before.
ALTER TABLE groups ADD COLUMN coop_win_points INTEGER NOT NULL DEFAULT 1 CHECK (coop_win_points BETWEEN 0 AND 100);
ALTER TABLE groups ADD COLUMN coop_wins_count INTEGER NOT NULL DEFAULT 1 CHECK (coop_wins_count IN (0, 1));
ALTER TABLE groups ADD COLUMN filler_max_minutes INTEGER NOT NULL DEFAULT 30 CHECK (filler_max_minutes BETWEEN 5 AND 240);
ALTER TABLE groups ADD COLUMN filler_max_weight REAL NOT NULL DEFAULT 2 CHECK (filler_max_weight BETWEEN 1 AND 5);
ALTER TABLE groups ADD COLUMN stale_days INTEGER NOT NULL DEFAULT 90 CHECK (stale_days BETWEEN 7 AND 730);
