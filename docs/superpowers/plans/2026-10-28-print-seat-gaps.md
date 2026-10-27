# Print Seat Gaps Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User has approved implementation and publication; proceed continuously.

**Goal:** 印刷プレビューから行間・列間を個別に1/1.5/2倍へ変更し、クラス単位で保存する。

**Architecture:** 既存CSS Gridに隙間トラックを追加し、間隔合計から等寸の座席を計算する。紙面外の画面専用ボタンは印刷寸法と独立させる。

**Tech Stack:** Vanilla JS/CSS/HTML, node:test, Playwright MCP, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-28-print-seat-gaps-design.md`

## Global Constraints

- 標準1mm。倍率は1 → 1.5 → 2 → 1。
- 境界は元の6列×7行の物理インデックスで保持する。
- 通常盤面と履歴データには適用しない。既存データ・未コミットのガイドを保護する。
- 通常版・サンプル版・A4縦横・教員／生徒視点・印刷を確認する。

## Review Focus

- 空席を隠した後の境界ずれ、再表示時の設定喪失。
- 連打とキーボード操作後のフォーカス喪失、表示倍率によるボタンの重なり。
- クラス切替・新規クラス・旧バックアップ・履歴復元による設定混入。
- 印刷直前の再計算で隙間が戻る、操作ボタンがPDFに残る。
- 最大間隔・長い氏名での不要な縮小と文字切れ。

### Task 1: Data and variable gap layout

**Files:** `app.js`, `tests/print-seat-gaps.test.cjs`, `tests/print-portrait-layout.test.cjs`.

**Interfaces:** `normalizePrintSeatGaps(value)`, `getVisiblePrintGaps(bounds)`, `cyclePrintGap(axis,index)`; existing `fitPrintGridLayout(grid,rows,cols)` consumes current visible gap sums.

- [x] Write tests for legacy/invalid values, independent cyclic changes, cropped boundary identity, and per-gap sum calculations in A4縦横.
- [x] Run tests; confirm new behavior fails before implementation.
- [x] Implement normalized class state, save/load/reset, alternating tracks, and gap-aware dimensions.
- [x] Run focused tests; expect all pass.

### Task 2: Controls and browser verification

**Files:** `app.js`, `styles.css`, `index.html`, `tests/print-seat-gaps.browser.js`.

**Interfaces:** `renderPrintLayout(focusGap)`, screen-scale calculation and screen-only boundary controls.

- [x] Add paper-external wedges with state/accessible labels, safe spacing and focus restoration; update existing cache identifiers.
- [x] Verify local normal/sample, persistence/backups/history, viewpoint, empty-seat cropping, keyboard and repeated clicks in desktop/tablet layouts.
- [x] Verify one-page PDFs in both orientations, exact gap ratios, hidden controls, stable seat/text sizing and no clipping.
- [x] Run whole test suite, JS syntax and git diff --check; expect all pass.

### Task 3: Review and publication

- [x] Review full requested diff against spec; address material findings and verify.
- [ ] Commit only feature files and design/plan; push configured Pages source main without rewriting remote history.
- [ ] Verify deployed SHA/Pages status and live normal/sample behavior and assets through MCP.

## Verification record

- Unit suite: 38 tests, 0 failures. Added eight tests; the original seven failed before implementation, and the cropped-portrait regression failed before its fix.
- `tests/print-seat-gaps.browser.js`: run via Playwright MCP `browser_run_code_unsafe` after starting the local HTTP server. Uses an isolated context and the sample fixture, including downloaded backup export/import, 20 geometry cases and A4 PDF checks. A resize/render race reproduced unnecessary shrink; restoring natural dimensions immediately before measurement fixes it.
- Separate sample-route smoke: defaults, click, exact gap/button center alignment in both views, and reload reset passed.
- PDFs: A4 landscape and portrait, one page each; rendered and visually inspected. No controls in print. Baseline name font21.1px; row-only enlarged gaps21.1px; all gaps2x20.5px; reset21.1px.
- Reviewer: one Important finding (cropped portrait shrank seats despite spare width), fixed with RED→GREEN regression. No Critical/Minor findings.
