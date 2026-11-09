// The shelf draws itself in the browser from the catalog endpoint anyway, and it has no forms, so
// rendering it on the server only spent CPU time: about 37ms against the free plan's 10ms (D59).
// Other group pages keep server rendering: several post forms without JavaScript enhancement,
// whose errors only show when the server renders the page.
export const ssr = false;
