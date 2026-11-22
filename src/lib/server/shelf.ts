// "On the group's shelf" as SQL (D66, D82): the rows of the `group_copies` view, checked from the
// game's side.
//
// `EXISTS (... FROM group_copies gc WHERE gc.group_id = ?1 AND gc.game_id = w.game_id)` reads the same,
// but SQLite plans the view from the group's memberships, so each check probed every member's copies:
// about 100 rows a game at 50 members, 16,000 for the Wanted tab at the planned scale. These start
// from a game's few copies (`copies_game`) and ask whether each owner is in the group. They're the
// one place outside the view that joins copies to memberships to mean a shelf (AGENTS.md "SQL"), and
// they keep the view's hidden-copies check. `group`, `game` and `copy` are SQL: a parameter such as
// `?1`, a column such as `w.game_id`, a table alias such as `c`.

/** The copy `copy` (an alias of `copies`) counts for group `group`: its owner is a member whose games are on the shelf (D86), and it isn't hidden there. */
export function copyOnShelf(group: string, copy: string): string {
	return `EXISTS (SELECT 1 FROM memberships shelf_m WHERE shelf_m.group_id = ${group} AND shelf_m.user_id = ${copy}.user_id AND shelf_m.off_shelf = 0)
	 AND NOT EXISTS (SELECT 1 FROM hidden_copies shelf_h WHERE shelf_h.group_id = ${group} AND shelf_h.user_id = ${copy}.user_id AND shelf_h.game_id = ${copy}.game_id)`;
}

/** Game `game` is on group `group`'s shelf: some member has a copy that isn't hidden from the group. */
export function onShelf(group: string, game: string): string {
	return `EXISTS (SELECT 1 FROM copies shelf_c WHERE shelf_c.game_id = ${game} AND ${copyOnShelf(group, 'shelf_c')})`;
}
