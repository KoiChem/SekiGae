# Seat size prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 合意済み試作版をデータ隔離のうえ実装・検証・公開する。
**Architecture:** 既存静的アプリをprototype/に独立コピーし、既存構造内で寸法と履歴の責務を整合させる。専用dialogは共通部品1つを追加し確認の継続をawaitする。
**Tech Stack:** Vanilla JavaScript/CSS/HTML, Node test, Playwright MCP, GitHub Pages.
**Spec:** docs/superpowers/specs/2026-10-28-seat-size-prototype-design.md

## Global Constraints
- 本番index.html/app.js/styles.css/sample.htmlと既存ユーザー変更は変更しない。
- 最大8列10行、PC/タブレット、空席・名簿・履歴の保存安全性と旧版相互隔離。
- 検証後に承認済み公開を行い通常/サンプルの公開画面も確認。

## Review Focus
- 旧版全削除と旧キーfallbackで試作/本番が混ざらない。
- 同じ80枠でも8×10以外の寸法として誤解釈しない。
- 5/7列でペアが行をまたがず、履歴の列数で旧ペアを読む。
- 確認取消で選択値・配置・クラスが変化しない。
- 高密度盤面で長い氏名・表示全項目・タッチ操作が潰れない。

### Task 1: 分離・可変寸法・保存/復元
Files: prototype/index.html, app.js, styles.css, sample.html; tests/prototype-grid.test.cjs
Interfaces: setGridDimensions(cols,rows), planSeatResize(cols,rows), applySeatResize(), getHistoryDimensions(history).
- [x] real VMで旧保存分離・座標保持・縮小/人数/固定指定・奇数ペア・異寸法履歴の失敗テストを書く。
- [x] node --test tests/prototype-grid.test.cjsで失敗を確認。
- [x] 試作コピー、寸法変更・データ隔離・履歴と公平化・指定記法・印刷の動的化を実装。
- [x] 対象テストと既存全38テストを通す。

### Task 2: 中央確認dialogと可読性優先UI
Files: prototype/app.js, index.html, styles.css; tests/prototype-dialog.test.cjs
Interfaces: showAppDialog(message, options) Promise<boolean>, appConfirm(), appAlert().
- [x] 取消・復元後reload順・重複操作の失敗テストを書く。
- [x] node --test tests/prototype-dialog.test.cjsで失敗を確認。
- [x] 19経路を非同期dialogへ変更し、親モーダル/Esc/フォーカスを整合。
- [x] 座席設定、可変CSS、文字fit、画面向きごとの操作順を実装。
- [x] 全suiteとPlaywrightで通常/サンプル、4×4/5×7/7×7/8×10、取消/再読込/印刷/バックアップを確認。

### Task 3: レビュー・公開・公開確認
- [ ] 新しい文脈のレビューを依頼し重大な指摘を修正・検証する。
- [ ] git diff --check、構文検証、全テスト、本番ファイル不変を確認。
- [ ] 今回のファイルのみcommit、mainへ承認済み公開push、Pages完了を確認。
- [ ] 公開通常/サンプル、既存版隔離、console/networkとリリース一致をPlaywrightで確認。
