---
target: delete for good and admin manage group
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/carlo/personal/box-populi/src/routes/admin/+page.svelte"
target_fingerprint: "sha256:1b184e19e52b21d58e6916b7cf3501a83770db631f75f28aaaada43ecd79c9ea"
target_path: /home/carlo/personal/box-populi/src/routes/admin/+page.svelte
timestamp: 2026-11-08T08-59-20Z
slug: src-routes-admin-page-svelte
---
# Delete for good (Group tab, archived panel) and the admin per-group Manage fold

Method: dual-agent (A: design review · B: detector and measurements)

## Design health: 27/40
1 Visibility 2 (silent end: owner lands on /me with no message; admin row vanishes, `done` never rendered) · 2 Real world 3 ("Reason" labels three fields with different readers) · 3 Control 3 (host has delete one fold from suspend, no "suspend instead") · 4 Consistency 2 (two Manage grammars; Make-owner disabled until match, Delete live) · 5 Error prevention 3 (host copy omits plays and nights) · 6 Recognition 2 ("with the group's link" that /admin never shows) · 7 Efficiency 3 (no Copy for a one-time code) · 8 Minimalist 3 (owner panel repeats; admin fold monotonous) · 9 Recovery 3 (admin error at top of fold, off-screen on phone) · 10 Help 3 (no guidance to verify who asks).

## Specificity
Owner panel authored; admin fold category-interchangeable (three stacked Reason/textarea/button forms, ignoring the Group tab's Manage grammar). Detector: CLI 0 (regex-only on .svelte); browser overlay 1 per page, both outside the targets (hatched player colours, by design; a straggler word in the admin theme text). Contrast all ≥ 5.74:1, focus visible, no overflow at 390. Action buttons 36px.

## Priority issues
1. [P1] Host delete copy understates: "Removes the group, its code and its links" omits plays and game nights. Fix: name them with counts, offer suspend instead. (clarify)
2. [P1] Admin fold has no structure; first field is the member-facing suspend reason, unnamed. Fix: rows Access / Owner's way in / danger foot, one open at a time; label "Message to members" vs "Reason (admin log only)". (layout)
3. [P1] Owner-code handoff: "with the group's link" the host can't see; no clock time; no Copy. Fix: wording, "until 23:47", Copy button. (clarify)
4. [P2] Deleting ends silently, members not told. Fix: status lines after delete on /me and /admin; tell the owner nobody is notified and members can export their own plays. (harden)
5. [P2] Owner's guards inconsistent: Delete live before the name matches, summary in ink not danger, no Cancel, button "Delete the group". (polish)

## Persona red flags
Owner on a phone: panel below 50 member rows; export link 17px tall; no nights export. Host at night on a phone: unnamed member-facing box first; error off-screen; several folds open at once. First-time host by email: 10 minutes, no clock, code expires, second code.

## Minor
Archived banner tells co-admins "Restore it or delete it" (they can't delete). Suspending an archived group silently removes the owner's Restore. Empty suspend textarea above a fresh code. 36px action buttons.

## Questions
Host reversible first step? A week's notice to members before delete? Is the host code a slower co-admin path when the owner has the link?
