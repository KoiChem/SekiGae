# Shuffle candidate history implementation plan

> Execute inline using executing-plans, test-driven-development and verification-before-completion.

**Goal:** Replace user-facing seed controls with the latest ten actual shuffle candidates, retaining internal seeded randomness.

**Approved design:** The user approved implementation and publication of the comparison in this chat. Store candidate arrangements and inactive seats independently of the twenty confirmed histories. Restore candidates as unconfirmed previews. Keep seed metadata internal, including in detailed-log and history UI.

**Architecture:** Extend the existing shared app.js / index.html / styles.css; no new dependencies. Persist candidates per class in existing local storage and backups. Ignore legacy seed input, preserve old confirmed histories, and accept old backups without candidates. Candidate navigation preserves manual edits; changes to roster or rules block stale candidates. Restored candidates are rescored using current confirmed history.

**Workspace:** A dedicated codex/shuffle-candidate-history branch in the existing checkout; preserve unrelated guide.html, assets/ and output/ edits. Publication is already authorized. No further design/permission checkpoint is needed.

## Review focus

- Ten-item bound and immutable arrangements, including manual changes and inactive seats.
- Reload / class switching / backup round trips, with legacy backups and malformed candidates.
- Navigation never confirms a candidate or changes fairness history; confirming an older candidate updates that candidate.
- Stale roster/rules, checkerboard exceptions, cancellation, sorting and confirmed-history selection cannot corrupt preview state.
- No seed in user UI, narrow-screen button gaps, normal/sample isolation and deployed asset freshness.

## Task 1: Implement and test candidate lifecycle

- [x] Add behavioral tests in tests/shuffle-candidates.test.cjs; observe failure before implementation.
- [x] Implement candidate snapshot validation, ten-item bound, restoration and per-class persistence in app.js. Preserve seeded search unchanged and create automatic seeds for normal operations.
- [x] Remove seed UI/log/history text; add candidate navigation next to shuffle actions with explicit button gaps. Update sample schema/help only as needed.
- [x] Run the complete node test suite and git diff --check.

## Task 2: Verify, review and publish

- [x] Use Playwright MCP for normal and sample interactions, reload, backup and narrow/portrait layout.
- [x] Review the whole change, fix material findings and rerun affected checks.
- [ ] Commit only this task's files, push authorized changes to main and inspect GitHub Pages deployment via GitHub MCP.
- [ ] Verify deployed normal/sample flows and served asset versions; report outcome and evidence boundaries.

## Verification record

- Node: 30/30 tests passed; app.js syntax and git diff --check passed.
- Playwright: actual sample shuffles and candidate back/forward preserve arrangements/empty seats and confirmed history. Normal-mode 12 shuffles retain latest ten; reload, class switching and sample reset/isolation checked.
- Actual downloaded backup imported under a new verification-only class ID: candidate snapshots identical and restore as previews.
- Portrait widths 375/390 and desktop inspected: no horizontal overflow or touching action buttons. Final browser console has no application errors; an earlier fresh-session favicon.ico 404 also occurs on the pre-change public page.
- Independent reviewer found empty-seat click persistence omission. Regression test failed before fixing; clicks now capture candidate/committed empty-seat states, and commit updates snapshots before clearing preview. Suite green after fix.
- Initial requested reviewer model was unavailable due usage limit; a fresh reviewer using the available model completed the review.
- Sample fixture needs no data change: legacy backups without candidates load as an empty candidate list; shared sample UI resets on reload. Preexisting guide.html/assets/output edits remain excluded from release.
