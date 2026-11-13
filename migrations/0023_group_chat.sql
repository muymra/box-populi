-- Migration number: 0023 	 2026-11-13T03:35:47.071Z
-- A group's chat link (D78): where the group talks, such as a WhatsApp or Signal group or a Discord
-- server. Set by the owner and co-admins, shown to members only. An https address, or NULL for none.
ALTER TABLE groups ADD COLUMN chat_url TEXT CHECK (length(chat_url) <= 1000);
