# 名簿Undo・削除モード・過去配置欄の幅修正 実装仕様（Terra向け）

## 1. 結論

いずれも現行の保存形式を変更せず実装できる。名簿Undoは、座席配置まで巻き戻す機能ではなく、名簿タブを開いている間の「名簿表の編集履歴」を戻す機能として実装する。名簿が座席表タブへの移動時に保存・反映された後はUndo履歴を破棄する。

この境界にする理由は、現行の `finishRosterCommitFromTable()` が名簿を `currentStudents` へ反映すると同時に、削除・番号変更された生徒を現在配置とプレビュー配置から除くためである。反映後までUndo対象にすると、名簿だけでなく `seatAssignment`、`previewAssignment` なども一括復元する別機能になり、単純な名簿Undoではデータ不整合を起こしうる。

過去配置欄のはみ出しは、長い選択肢文字列を持つ `select` がflex項目の既定の最小幅を持つことと、現行の `min-width: 0` / `width: 100%` が横画面にしか適用されないことが原因である。行を `minmax(0, 1fr) auto` のgridにし、入力・選択欄へ常時幅制約を付ければ解消できる。

## 2. 現行構造と対象ファイル

- `index.html`
  - 名簿表の1行目右端は、現在は空の操作列見出し `th.col-actions`。
  - 名簿表右上には「行を追加」だけがある。
  - 過去配置は `.flex-row.history-management-row` 内の `#history-select` と削除ボタン。
- `app.js`
  - `addRowToTable()` が7個の編集セルと、即時削除する行ごとのゴミ箱ボタンを作る。
  - TSV取込は追記・置換とも `addRowToTable()` を再利用する。
  - `finishRosterCommitFromTable()` は名簿保存時に現在配置・プレビュー配置を生徒番号で再マップする。
  - `loadCurrentClassData()` はクラス読込のたびに名簿表を作り直す。
  - `updateHistorySelect()` は `日付 │ 配置名 │ seed` を1個の長いoption文字列にする。
- `styles.css`
  - `.flex-row` は折返し可能なflex。
  - `#history-select` の縮小指定は現在 `body.ui-layout-landscape` 配下だけにある。
- `guide.html`
  - 名簿のUndoと削除モードの短い操作説明を追記する。
- `sample.html`
  - 画面を複製せず `index.html?sample=1` を共有する現行方式を維持する。原則としてファイル変更は不要。

## 3. 名簿Undo

### 3.1 UI

名簿表見出しの「行を追加」の左側へ、`元に戻す` ボタンを置く。

- 初期状態と履歴が空のときは `disabled`。
- 1回以上戻せるときだけ有効。
- `title` は直前操作を含めて、例として `セル編集を元に戻す`、`行削除を元に戻す` とする。
- 座席表の `#btn-undo-manual-swap` とは別ID・別スタックとし、状態を共有しない。
- `Ctrl+Z` / `Command+Z` を新規にページ全体で奪わない。contenteditableやOSの標準操作を壊さず、まずボタン操作を提供する。

### 3.2 Undo対象

次を1操作として、直前から順に複数回戻せるようにする。

1. 1セルの編集：フォーカス取得からフォーカス喪失までを1操作とする。
2. 「行を追加」：追加した1行を1操作とする。
3. 行のゴミ箱削除：削除した1行を1操作とする。
4. TSVの追記：貼り付けた全行をまとめて1操作とする。
5. TSVの置換：置換前の名簿全体へ1操作で戻せるようにする。

対象外は、TSV入力欄の文字そのもの、クラス名、全体ルール、優先ルール、座席配置、履歴である。

### 3.3 履歴データ

DOMの `innerHTML` は保存せず、名簿表の7項目だけをプレーンオブジェクト配列でスナップショットする。

```js
{
  label: '行削除',
  rows: [
    { id, name, kana, gender, attr1, attr2, flags }
  ],
  focus: { rowIndex, cellIndex } // 復元できる場合だけ
}
```

- スタック上限は50操作。超過時は古いものから破棄する。
- localStorageやバックアップJSONには保存しない。
- 同一内容は積まない。
- 復元は既存の `addRowToTable()` と `validateFlagsCell()` を通し、備考欄のエラー表示も再計算する。

### 3.4 記録タイミング

- セル編集は、tableの委譲イベントで `focusin` 時に表スナップショットを一時保持し、`focusout` 時に変更があった場合だけ変更前をpushする。日本語IMEの変換中の各 `input` を別操作として記録しない。
- 「行を追加」と削除は、DOM変更の直前に1回だけpushする。
- TSV追記・置換は `applyParsedRosterRows()` の直前に1回だけpushし、その内部の各 `addRowToTable()` では記録しない。
- 初期読込・クラス読込・Undo復元時の `addRowToTable()` は記録しない。`addRowToTable(data, { recordUndo: false })` のように明示できる形にする。

### 3.5 Undo境界

次の時点でスタックを空にし、Undoボタンを無効にする。

- `commitRosterFromTableToStoredState()` が正常終了し、名簿が `currentStudents` と保存データへ反映された直後。
- クラス切替、新規クラス作成、クラス削除、バックアップ読込、全データ削除、ページ再読込。
- `loadCurrentClassData()` による名簿表の再構築時。

入力エラーや警告モーダルのキャンセルにより反映されなかった場合は、Undo履歴を残す。これにより、誤入力を戻して修正できる。

Undo実行後は、可能なら操作対象だったセルまたは同じ行の最寄りセルへフォーカスを戻す。行がなくなった場合は名簿見出しまたは「行を追加」へ戻す。

## 4. ゴミ箱アクティブ化ボタン

### 4.1 配置と表示

`#students-table thead` の1行目・一番右側、現在空の `th.col-actions` にゴミ箱のトグルボタンを置く。`aria-hidden="true"` は外す。

- 初期値はOFF。
- OFF：中立色、`aria-pressed="false"`、ラベル `行削除を有効にする`。
- ON：赤系の背景・枠・文字で明確に強調し、`aria-pressed="true"`、ラベル `行削除を無効にする`。
- 狭い操作列に収めるため、表示は既存と同系統のSVGゴミ箱アイコンだけでよい。ON/OFFは色と押下状態で示し、ツールチップとアクセシブル名にも明記する。
- ONは複数行を続けて削除できるまで維持する。ただし名簿タブを離れる、クラスを切り替える、名簿を再読込する時は必ずOFFへ戻す。

### 4.2 行削除ボタン

- 各行の既存ゴミ箱ボタンは、削除モードOFF中は `disabled` にする。
- ONへの切替時、既存行すべてのボタンを有効化する。ON中に追加・取込された行も有効状態を引き継ぐ。
- クリック処理側でも削除モードを再確認し、DOM属性を書き換えられてもOFF中は削除しない。
- ON中の行削除は追加確認ダイアログを出さず即時実行し、直前スナップショットをUndoへ積む。明示的な削除モードとUndoを安全策とする。
- Undoで行を戻しても削除モード自体のON/OFFは巻き戻さない。

## 5. 過去配置リストのはみ出し修正

### 5.1 CSS方針

`.history-management-row` を折返しflexではなく2列gridにする。

```css
.history-management-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.history-management-row > input,
.history-management-row > select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

#history-select {
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-management-row > .btn {
  white-space: nowrap;
}
```

- 横画面だけの現行 `#history-select` 幅指定は、上記の共通指定へ統合する。ただし横画面用の小さい文字サイズは残してよい。
- `.settings-bottom .panel` に一般の `min-width: 0` を付け、縦画面・横画面の双方でgrid子要素が内容幅に押し広げられないようにする。
- `index.html` の `style="flex-grow:1;"` は削除し、幅責務をCSSへ寄せる。
- 配置名入力行にも同じgridを使うため、長い入力やボタンでも幅が安定する。

### 5.2 選択肢文字列

`updateHistorySelect()` の `日付 │ 配置名 │ seed` は情報を落とさず維持する。閉じたselectは利用可能幅で省略表示してよい。選択中の全文を `historySelect.title` に設定し、`change` 後にも同期する。

ネイティブselectを開いたときのOS管理ポップアップ幅は、ブラウザにより枠外へ広がる場合がありCSSでは完全制御できない。今回の受入対象は、閉じたselect・削除ボタン・親パネルが常に画面内に収まり、ページや設定欄に横スクロールを発生させないこととする。ポップアップ自体も親枠内へ固定する要件なら、別途カスタムlistbox化が必要だが、今回は行わない。

## 6. 実装順序

1. 名簿行をプレーンデータへ変換・復元する補助関数を追加する。
2. Undoスタック、ボタン状態更新、セル編集の委譲イベントを追加する。
3. 行追加・削除・TSV追記/置換へ1操作単位の記録を組み込む。
4. 表見出し右端へ削除モードトグルを置き、全行の削除ボタンと同期する。
5. commit/load/class関連の境界でUndoクリア・削除モードOFFを徹底する。
6. 過去配置行をgrid化し、長い履歴名でも幅が収まるようにする。
7. `guide.html` を更新する。
8. `index.html` の `styles.css` / `app.js` のクエリ版を新しい同一値へ更新する。

## 7. 受入確認

### 7.1 名簿

- セルを日本語IMEで編集し、1回のUndoでフォーカス前の値へ戻る。
- 値を変えずにフォーカスを外してもUndo履歴が増えない。
- 行追加、行削除、TSV追記、TSV置換がそれぞれ1回のUndoで戻る。
- 複数操作を行い、逆順に最大50件まで戻せる。
- Undo復元後も備考欄の構文エラー表示が正しく再計算される。
- 削除モードOFFでは、マウス、タッチ、Enter/Spaceのいずれでも行を削除できない。
- 削除モードONだけ削除でき、削除後にUndoで行・全7項目・行順が戻る。
- クラス切替、再読込、正常な名簿反映後はUndo不能かつ削除モードOFFになる。
- 検証エラーまたは警告キャンセル後はUndo可能なまま残る。
- 名簿反映前後で、既存の生徒番号による座席再マップ挙動を変えない。

### 7.2 過去配置欄

- 長い日時、全角10文字の配置名、10桁seed、`手動変更あり` が同居する履歴を用意する。
- 1366×768、1024×768、844×390、390×844程度で、縦レイアウト・横レイアウトの双方を確認する。
- `#history-select` と隣の削除ボタンの矩形が親パネル内に収まる。
- `.history-management-row`、親パネル、`#tab-main` について `scrollWidth <= clientWidth` であり、意図しない横スクロールがない。
- 履歴選択、盤面復元、履歴削除、配置名保存の既存動作が変わらない。

### 7.3 共通回帰

- 通常版と `sample.html` → `index.html?sample=1` の双方で確認する。
- サンプル名簿に実在人物の情報を追加しない。
- `app.js` の構文確認、既存テスト、追加したUndoの単体確認、`git diff --check` を通す。
- 実装・公開が依頼された段階で、commit/push後にGitHub Pagesの通常版とサンプル版をキャッシュ回避URLで確認する。

## 8. 今回変更しないもの

- 反映済み名簿と座席配置をまとめて過去状態へ戻す永続Undo。
- Redo機能。
- クラスをまたぐUndo履歴。
- バックアップJSONの保存形式。
- ネイティブselectのポップアップを独自UIへ置き換えること。
