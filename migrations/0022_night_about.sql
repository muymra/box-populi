-- Migration number: 0022 	 2026-11-13T03:14:38.907Z
-- A game night's description and pictures (D77). The description is plain text from whoever can change
-- the night; pictures are up to four https addresses, one per line, shown on the night's page from
-- wherever they're hosted; the files are never downloaded or stored here. NULL for none.
ALTER TABLE game_nights ADD COLUMN description TEXT CHECK (length(description) <= 2000);
ALTER TABLE game_nights ADD COLUMN pictures TEXT;
