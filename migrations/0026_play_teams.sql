-- Migration number: 0026 	 2026-11-22T03:50:40.894Z
-- Teams in the play log (D87). play_players.team: the player's team in a team play, numbered 1 up
-- without gaps; NULL in a play without teams. A team play stores each player's place as their team's,
-- so the leaderboard, its kept counts and the profiles read places as before.
ALTER TABLE play_players ADD COLUMN team INTEGER CHECK (team BETWEEN 1 AND 30);
