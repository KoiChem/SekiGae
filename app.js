// --- 第3段階リファクタ要点（2026-05） ---
// executeSmartShuffle の可読性向上のため、以下をファイルスコープへ分離:
// - buildPastConstraintMaps / buildNgPairsMap / buildPlacementContext / buildScoreContext
// - buildInitialByBacktracking / runPhaseBSimulatedAnnealing
// - analyzeSoftConstraintsWithContext / formatConstraintProgressHtml
// - createSwapValidators（swap判定の共通化）
// 目的: 見た目・挙動を維持したまま、責務分離と依存の明示化を進める。
// --- 文字列の正規化 ---
function normalizeInputText(str) {
    if(!str) return '';
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    }).replace(/（/g, '(').replace(/）/g, ')').replace(/、/g, ',').replace(/。/g, '.').toLowerCase();
}
const normalizeStr = normalizeInputText;

/** 性別: 男・女に加え m / f（大小無視）を受け付け */
function normalizeGender(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    if (s === '男' || s === '男子' || lower === 'm') return '男';
    if (s === '女' || s === '女子' || lower === 'f') return '女';
    return '';
}

// --- 定数・システム管理 ---
const PREFIX = 'SekigaeKun_v6_'; 
const NUM_COLS = 6, NUM_ROWS = 7, TOTAL_SEATS = 42;
const COLS_LABELS = ['a','b','c','d','e','f'];

/** 座席枠内固定レイアウト（上から順・詰め表示） */
const SEAT_LAYOUT_FIXED_META = [
    { key: 'id', label: '番号', size: 'S', align: 'R', colorDefault: 2 },
    { key: 'kana', label: 'かな', size: 'M', align: 'C', colorDefault: 2 },
    { key: 'name', label: '氏名', size: 'L', align: 'C', colorDefault: 1 },
    { key: 'attr1', label: '属性1', size: 'S', align: 'C', colorDefault: 2 },
    { key: 'attr2', label: '属性2', size: 'S', align: 'C', colorDefault: 2 }
];
/** 項目ごとのフォント（CSS の .font-* と対応） */
const SEAT_LAYOUT_FONT_KEYS = ['gothic', 'mincho', 'maru', 'kyokasho'];
const SEAT_LAYOUT_FONT_CLASS = {
    gothic: 'font-gothic',
    mincho: 'font-mincho',
    maru: 'font-maru',
    kyokasho: 'font-kyokasho'
};
const SEAT_SIZE_MAX_PX = { S: 28, M: 40, L: 100 };
/** Canvas 計測の参照フォントサイズ（線形スケールの基準）と最終フォントサイズの最小値 */
const SEAT_PROBE_FONT_PX = 100;
const SEAT_FIT_EPS_PX = 0.25;
/** 行の line-height（CSSと一致させる） */
const SEAT_ROW_LINE_HEIGHT = 1.05;
/** bold のはみ出し・サブピクセル丸めを吸収する横方向の安全マージン（px） */
const SEAT_FIT_SAFETY_PX = 1.5;
/** 氏名の基準フォントを決める参照文字列（全角5文字） */
const SEAT_NAME_PROBE_TEXT = '壱弐参肆伍';

/** 端列属性（教卓行トグルと一致） */
const EDGE_WINDOW = 'window';
const EDGE_CORRIDOR = 'corridor';
/** 既定は「廊下・窓」（両方窓は禁止のため） */
const DEFAULT_EDGE_MIN = EDGE_CORRIDOR;
const DEFAULT_EDGE_MAX = EDGE_WINDOW;

/** 新規クラス・データ未保存時のデフォルト値（公平化 0–5 行は最大5、過去座席行は8–15の最大15） */
const DEFAULT_FAIR_FB = 5;
const DEFAULT_FAIR_WIN = 5;
const DEFAULT_FAIR_COR = 5;
const DEFAULT_FAIR_PAIR = 5;
const DEFAULT_FAIR_SEAT = 15;
const DEFAULT_FAIR_SEAT_NEAR = 5;
const DEFAULT_SOFT_FRONT_BASE = 1000;
const DEFAULT_SOFT_FRONT_STEP = 50;
const DEFAULT_SOFT_BACK_BASE = 1000;
const DEFAULT_SOFT_BACK_STEP = 50;
const DEFAULT_SOFT_PAIR_BASE = 200;
const DEFAULT_SOFT_PAIR_STEP = 20;
const DEFAULT_SOFT_WINDOW_BASE = 900;
const DEFAULT_SOFT_WINDOW_STEP = 45;
const DEFAULT_SOFT_CORRIDOR_BASE = 300;
const DEFAULT_SOFT_CORRIDOR_STEP = 0;
const DEFAULT_SOFT_SEAT_BASE = 600;
const DEFAULT_SOFT_SEAT_STEP = 15;
const PAST_SEAT_NEAR_RATIO = 0.2;
const FAIRNESS_KINDS = ['fb', 'win', 'cor', 'pair', 'seat', 'seatNear'];
const FAIRNESS_CONTAINER_ID = {
    fb: 'fair-btns-fb',
    win: 'fair-btns-win',
    cor: 'fair-btns-cor',
    pair: 'fair-btns-pair',
    seat: 'fair-btns-seat',
    seatNear: 'fair-btns-seat-near'
};
const SOFT_SCORE_FIELDS = [
    'frontBase', 'frontStep',
    'backBase', 'backStep',
    'pairBase', 'pairStep',
    'windowBase', 'windowStep',
    'corridorBase', 'corridorStep',
    'seatBase', 'seatStep'
];
const COLOR_PALETTE_PRESET = [
    // Black / Gray
    '#2C3E50', '#4A4E69', '#6C7A89', '#7F8C8D', '#95A5A6',
    // Navy
    '#1F456E', '#283747', '#34495E', '#21618C', '#1A5276',
    // Blue
    '#5499C7', '#5DADE2', '#4A90E2', '#7FB3D5', '#5C88DA',
    // Teal / Turquoise
    '#0E6655', '#117864', '#16A085', '#1ABC9C', '#48C9B0',
    // Green
    '#52BE80', '#45B39D', '#609966', '#7DCEA0', '#58D68D',
    // Red
    '#CD5C5C', '#D9534F', '#C0392B', '#CB4335', '#A93226',
    // Purple
    '#9B59B6', '#8E44AD', '#AF7AC5', '#7D3C98', '#884EA0',
    // Brown
    '#8D6E63', '#A1887F', '#873600', '#A04000', '#6E2C00',
    // Pink
    '#D98880', '#F1948A', '#C27BA0', '#D288A3', '#E56B6F',
    // Orange
    '#E67E22', '#EB984E', '#CA6F1E', '#D35400', '#E07A5F'
];

/** 履歴の深さ depth (0=直前回, 1=前々回, 2=3回前, ...) を日本語ラベルへ */
function depthLabel(d) {
    if (d === 0) return '直前回';
    if (d === 1) return '前々回';
    return `${d + 1}回前`;
}
function depthsLabel(depthArr) {
    return [...new Set(depthArr)].sort((a, b) => a - b).map(depthLabel).join('・');
}

/** ソフト制約テーブル内の入力（上から・左→右）。横移動は Tab のみ・縦は上下矢印 */
const SOFT_SCORE_INPUT_IDS = [
    'soft-front-base', 'soft-front-step',
    'soft-back-base', 'soft-back-step',
    'soft-pair-base', 'soft-pair-step',
    'soft-window-base', 'soft-window-step',
    'soft-corridor-base', 'soft-corridor-step',
    'soft-seat-base', 'soft-seat-step'
];

function coerceSoftIntFromInput(id, defaultVal) {
    const el = document.getElementById(id);
    if (!el) return defaultVal;
    const n = parseInt(String(el.value).trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

function getNextSoftScoreIndex(fromIndex, delta) {
    let j = fromIndex + delta;
    const step = Math.sign(delta);
    while (j >= 0 && j < SOFT_SCORE_INPUT_IDS.length) {
        const el = document.getElementById(SOFT_SCORE_INPUT_IDS[j]);
        if (el && !el.disabled) return j;
        j += step;
    }
    return -1;
}

function onSoftScoreTableKeydown(e) {
    if (!e.target.classList || !e.target.classList.contains('soft-score-input')) return;
    const i = SOFT_SCORE_INPUT_IDS.indexOf(e.target.id);
    if (i < 0) return;
    let delta = 0;
    if (e.key === 'ArrowDown') delta = 2;
    else if (e.key === 'ArrowUp') delta = -2;
    else return;
    e.preventDefault();
    const next = getNextSoftScoreIndex(i, delta);
    if (next < 0) return;
    const nextEl = document.getElementById(SOFT_SCORE_INPUT_IDS[next]);
    nextEl.focus();
    if (typeof nextEl.select === 'function') nextEl.select();
}

function onSoftScoreTableInput(e) {
    if (!e.target.classList || !e.target.classList.contains('soft-score-input')) return;
    const cleaned = e.target.value.replace(/\D/g, '');
    if (e.target.value !== cleaned) e.target.value = cleaned;
}

function onSoftScoreTableFocusOut(e) {
    if (!e.target.classList || !e.target.classList.contains('soft-score-input')) return;
    persistSoftScoresFromInputs();
}

function selectionCaretAtStart(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return true;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer)) return true;
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length === 0;
}

function selectionCaretAtEnd(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return true;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer)) return true;
    const post = document.createRange();
    post.selectNodeContents(el);
    post.setStart(r.endContainer, r.endOffset);
    return post.toString().length === 0;
}

function focusRosterEditableCell(rowIndex, cellIndex) {
    const tbody = document.querySelector('#students-table tbody');
    if (!tbody || rowIndex < 0 || rowIndex >= tbody.rows.length) return;
    const tr = tbody.rows[rowIndex];
    if (cellIndex < 0 || cellIndex >= tr.cells.length || cellIndex >= 7) return;
    const td = tr.cells[cellIndex];
    if (!td || td.contentEditable !== 'true') return;
    td.focus();
    const range = document.createRange();
    range.selectNodeContents(td);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function onStudentsTableKeydown(e) {
    let n = e.target;
    while (n && n.nodeType !== Node.ELEMENT_NODE) n = n.parentNode;
    const td = n && typeof n.closest === 'function' ? n.closest('td') : null;
    if (!td || td.contentEditable !== 'true') return;
    const tr = td.parentElement;
    const tbody = tr && tr.parentElement;
    const hostTable = document.getElementById('students-table');
    if (!tbody || tbody.tagName !== 'TBODY' || !hostTable || tbody.parentElement !== hostTable) return;

    const rowIndex = Array.from(tbody.rows).indexOf(tr);
    const cellIndex = Array.from(tr.cells).indexOf(td);
    if (cellIndex < 0 || cellIndex > 6) return;

    const rowsLen = tbody.rows.length;

    if (e.key === 'ArrowDown') {
        if (!selectionCaretAtEnd(td)) return;
        e.preventDefault();
        if (rowIndex + 1 < rowsLen) focusRosterEditableCell(rowIndex + 1, cellIndex);
        return;
    }
    if (e.key === 'ArrowUp') {
        if (!selectionCaretAtStart(td)) return;
        e.preventDefault();
        if (rowIndex > 0) focusRosterEditableCell(rowIndex - 1, cellIndex);
        return;
    }
}

function initFormArrowNavigation() {
    const scoreTable = document.querySelector('.soft-score-table');
    if (scoreTable) {
        scoreTable.addEventListener('keydown', onSoftScoreTableKeydown, true);
        scoreTable.addEventListener('input', onSoftScoreTableInput, true);
        scoreTable.addEventListener('focusout', onSoftScoreTableFocusOut, true);
    }
    const studentsTable = document.getElementById('students-table');
    if (studentsTable) {
        studentsTable.addEventListener('keydown', onStudentsTableKeydown, true);
    }
    const historySelect = document.getElementById('history-select');
    if (historySelect) {
        historySelect.addEventListener('change', () => {
            applyHistorySelectionToBoard();
            syncHistoryMemoInput();
            updateDeskTitleDisplay();
        });
    }
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.addEventListener('change', onImportBackupFileChange);
    }
}

function coerceStoredNonNegInt(v, def) {
    if (v === undefined || v === null || v === '') return def;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) && n >= 0 ? n : def;
}

function coerceEdgeAttr(v, def) {
    if (v === EDGE_WINDOW || v === EDGE_CORRIDOR) return v;
    return def;
}

function getSoftScoreValue(field) {
    if (field === 'frontBase') return softFrontBase;
    if (field === 'frontStep') return softFrontStep;
    if (field === 'backBase') return softBackBase;
    if (field === 'backStep') return softBackStep;
    if (field === 'pairBase') return softPairBase;
    if (field === 'pairStep') return softPairStep;
    if (field === 'windowBase') return softWindowBase;
    if (field === 'windowStep') return softWindowStep;
    if (field === 'corridorBase') return softCorridorBase;
    if (field === 'corridorStep') return softCorridorStep;
    if (field === 'seatBase') return softSeatBase;
    if (field === 'seatStep') return softSeatStep;
    return 0;
}
function setSoftScoreValue(field, value) {
    if (field === 'frontBase') softFrontBase = value;
    else if (field === 'frontStep') softFrontStep = value;
    else if (field === 'backBase') softBackBase = value;
    else if (field === 'backStep') softBackStep = value;
    else if (field === 'pairBase') softPairBase = value;
    else if (field === 'pairStep') softPairStep = value;
    else if (field === 'windowBase') softWindowBase = value;
    else if (field === 'windowStep') softWindowStep = value;
    else if (field === 'corridorBase') softCorridorBase = value;
    else if (field === 'corridorStep') softCorridorStep = value;
    else if (field === 'seatBase') softSeatBase = value;
    else if (field === 'seatStep') softSeatStep = value;
}
function getDefaultSoftScoreValue(field) {
    if (field === 'frontBase') return DEFAULT_SOFT_FRONT_BASE;
    if (field === 'frontStep') return DEFAULT_SOFT_FRONT_STEP;
    if (field === 'backBase') return DEFAULT_SOFT_BACK_BASE;
    if (field === 'backStep') return DEFAULT_SOFT_BACK_STEP;
    if (field === 'pairBase') return DEFAULT_SOFT_PAIR_BASE;
    if (field === 'pairStep') return DEFAULT_SOFT_PAIR_STEP;
    if (field === 'windowBase') return DEFAULT_SOFT_WINDOW_BASE;
    if (field === 'windowStep') return DEFAULT_SOFT_WINDOW_STEP;
    if (field === 'corridorBase') return DEFAULT_SOFT_CORRIDOR_BASE;
    if (field === 'corridorStep') return DEFAULT_SOFT_CORRIDOR_STEP;
    if (field === 'seatBase') return DEFAULT_SOFT_SEAT_BASE;
    if (field === 'seatStep') return DEFAULT_SOFT_SEAT_STEP;
    return 0;
}
function getSoftScoreInputId(field) {
    if (field === 'frontBase') return 'soft-front-base';
    if (field === 'frontStep') return 'soft-front-step';
    if (field === 'backBase') return 'soft-back-base';
    if (field === 'backStep') return 'soft-back-step';
    if (field === 'pairBase') return 'soft-pair-base';
    if (field === 'pairStep') return 'soft-pair-step';
    if (field === 'windowBase') return 'soft-window-base';
    if (field === 'windowStep') return 'soft-window-step';
    if (field === 'corridorBase') return 'soft-corridor-base';
    if (field === 'corridorStep') return 'soft-corridor-step';
    if (field === 'seatBase') return 'soft-seat-base';
    if (field === 'seatStep') return 'soft-seat-step';
    return '';
}
function resetSoftScoresStateToDefaults() {
    SOFT_SCORE_FIELDS.forEach(field => setSoftScoreValue(field, getDefaultSoftScoreValue(field)));
}
function exportSoftScoreSettings() {
    return {
        softFrontBase, softFrontStep, softBackBase, softBackStep,
        softPairBase, softPairStep,
        softWindowBase, softWindowStep, softCorridorBase, softCorridorStep,
        softSeatBase, softSeatStep
    };
}
function importSoftScoreSettings(data) {
    softFrontBase = coerceStoredNonNegInt(data.softFrontBase, DEFAULT_SOFT_FRONT_BASE);
    softFrontStep = coerceStoredNonNegInt(data.softFrontStep, DEFAULT_SOFT_FRONT_STEP);
    softBackBase = coerceStoredNonNegInt(data.softBackBase, DEFAULT_SOFT_BACK_BASE);
    softBackStep = coerceStoredNonNegInt(data.softBackStep, DEFAULT_SOFT_BACK_STEP);
    softPairBase = coerceStoredNonNegInt(data.softPairBase, DEFAULT_SOFT_PAIR_BASE);
    softPairStep = coerceStoredNonNegInt(data.softPairStep, DEFAULT_SOFT_PAIR_STEP);
    if (data.softWindowBase !== undefined || data.softCorridorBase !== undefined) {
        softWindowBase = coerceStoredNonNegInt(data.softWindowBase, DEFAULT_SOFT_WINDOW_BASE);
        softWindowStep = coerceStoredNonNegInt(data.softWindowStep, DEFAULT_SOFT_WINDOW_STEP);
        softCorridorBase = coerceStoredNonNegInt(data.softCorridorBase, DEFAULT_SOFT_CORRIDOR_BASE);
        softCorridorStep = coerceStoredNonNegInt(data.softCorridorStep, DEFAULT_SOFT_CORRIDOR_STEP);
    } else {
        const legacyBase = coerceStoredNonNegInt(data.softSideBase, DEFAULT_SOFT_WINDOW_BASE);
        const legacyStep = coerceStoredNonNegInt(data.softSideStep, DEFAULT_SOFT_WINDOW_STEP);
        softWindowBase = legacyBase;
        softCorridorBase = legacyBase;
        softWindowStep = legacyStep;
        softCorridorStep = legacyStep;
    }
    softSeatBase = coerceStoredNonNegInt(data.softSeatBase, DEFAULT_SOFT_SEAT_BASE);
    softSeatStep = coerceStoredNonNegInt(data.softSeatStep, DEFAULT_SOFT_SEAT_STEP);
}

function writeSoftScoresToInputs() {
    for (const field of SOFT_SCORE_FIELDS) {
        const id = getSoftScoreInputId(field);
        const v = getSoftScoreValue(field);
        const el = document.getElementById(id);
        if (el) el.value = String(v);
    }
}

function syncSoftScoresFromInputs() {
    SOFT_SCORE_FIELDS.forEach(field => {
        const id = getSoftScoreInputId(field);
        const fallback = getDefaultSoftScoreValue(field);
        setSoftScoreValue(field, coerceSoftIntFromInput(id, fallback));
    });
}

/** 入力欄の値をグローバルに取り込み保存（アラートなし）※saveCurrentClassData 先頭で同期 */
function persistSoftScoresFromInputs() {
    saveCurrentClassData();
}

/** ソフト制約スコアをビルトイン初期値に戻し、保存する */
function resetSoftScoresToDefaults() {
    resetSoftScoresStateToDefaults();
    writeSoftScoresToInputs();
    saveCurrentClassData();
    showAlert('ソフト制約スコアを初期値に戻しました。', 'success');
}

function coerceFairSeat(v) {
    const n = parseInt(String(v), 10);
    if (!Number.isFinite(n)) return DEFAULT_FAIR_SEAT;
    return Math.max(8, Math.min(15, n));
}
function coerceFairSeatNear(v) {
    const n = parseInt(String(v), 10);
    if (!Number.isFinite(n)) return DEFAULT_FAIR_SEAT_NEAR;
    return Math.max(0, Math.min(8, n));
}

function coerceFairCommon(v, fallback = 0) {
    const n = parseInt(String(v), 10);
    if (!Number.isFinite(n)) return Math.max(0, Math.min(5, fallback));
    return Math.max(0, Math.min(5, n));
}

function getFairnessValue(kind) {
    if (kind === 'fb') return fairFB;
    if (kind === 'win') return fairWin;
    if (kind === 'cor') return fairCor;
    if (kind === 'pair') return fairPair;
    if (kind === 'seat') return fairSeat;
    if (kind === 'seatNear') return fairSeatNear;
    return 0;
}
function setFairnessValue(kind, value) {
    if (kind === 'fb') fairFB = value;
    else if (kind === 'win') fairWin = value;
    else if (kind === 'cor') fairCor = value;
    else if (kind === 'pair') fairPair = value;
    else if (kind === 'seat') fairSeat = value;
    else if (kind === 'seatNear') fairSeatNear = value;
}
function getDefaultFairnessValue(kind) {
    if (kind === 'fb') return DEFAULT_FAIR_FB;
    if (kind === 'win') return DEFAULT_FAIR_WIN;
    if (kind === 'cor') return DEFAULT_FAIR_COR;
    if (kind === 'pair') return DEFAULT_FAIR_PAIR;
    if (kind === 'seat') return DEFAULT_FAIR_SEAT;
    if (kind === 'seatNear') return DEFAULT_FAIR_SEAT_NEAR;
    return 0;
}
function coerceFairnessValue(kind, value, fallback) {
    if (kind === 'seat') return coerceFairSeat(value);
    if (kind === 'seatNear') return coerceFairSeatNear(value);
    return coerceFairCommon(value, fallback);
}
function resetFairnessToDefaults() {
    FAIRNESS_KINDS.forEach(kind => setFairnessValue(kind, getDefaultFairnessValue(kind)));
}
function exportFairnessSettings() {
    return {
        fairFB: fairFB,
        fairWin: fairWin,
        fairCor: fairCor,
        fairPair: fairPair,
        fairSeat: fairSeat,
        fairSeatNear: fairSeatNear
    };
}
function importFairnessSettings(data) {
    fairFB = coerceFairCommon(coerceStoredNonNegInt(data.fairFB, DEFAULT_FAIR_FB), DEFAULT_FAIR_FB);
    if (data.fairWin !== undefined || data.fairCor !== undefined) {
        fairWin = coerceFairCommon(coerceStoredNonNegInt(data.fairWin, DEFAULT_FAIR_WIN), DEFAULT_FAIR_WIN);
        fairCor = coerceFairCommon(coerceStoredNonNegInt(data.fairCor, DEFAULT_FAIR_COR), DEFAULT_FAIR_COR);
    } else {
        const legacy = coerceFairCommon(coerceStoredNonNegInt(data.fairLR, DEFAULT_FAIR_WIN), DEFAULT_FAIR_WIN);
        fairWin = legacy;
        fairCor = legacy;
    }
    fairPair = coerceFairCommon(coerceStoredNonNegInt(data.fairPair, DEFAULT_FAIR_PAIR), DEFAULT_FAIR_PAIR);
    fairSeat = data.fairSeat !== undefined ? coerceFairSeat(data.fairSeat) : DEFAULT_FAIR_SEAT;
    fairSeatNear = data.fairSeatNear !== undefined ? coerceFairSeatNear(data.fairSeatNear) : DEFAULT_FAIR_SEAT_NEAR;
}

function updateFairnessButtonUI(kind, value) {
    const container = document.getElementById(FAIRNESS_CONTAINER_ID[kind]);
    const v = coerceFairnessValue(kind, value, 0);
    if (container) {
        container.querySelectorAll('.fairness-btn').forEach(btn => {
            btn.classList.toggle('fairness-btn-active', parseInt(btn.dataset.value, 10) === v);
        });
    }
}

function setFairnessFromButton(kind, value) {
    const v = coerceFairnessValue(kind, value, getDefaultFairnessValue(kind));
    setFairnessValue(kind, v);
    updateFairnessButtonUI(kind, v);
    saveCurrentClassData();
}

function syncFairnessButtonsFromGlobals() {
    FAIRNESS_KINDS.forEach(kind => updateFairnessButtonUI(kind, getFairnessValue(kind)));
}

function boardHasWindowEdge() {
    return edgeMin === EDGE_WINDOW || edgeMax === EDGE_WINDOW;
}

function boardHasCorridorEdge() {
    return edgeMin === EDGE_CORRIDOR || edgeMax === EDGE_CORRIDOR;
}
function normalizeEdgePair(minEdge, maxEdge) {
    let min = coerceEdgeAttr(minEdge, DEFAULT_EDGE_MIN);
    let max = coerceEdgeAttr(maxEdge, DEFAULT_EDGE_MAX);
    if (min === EDGE_WINDOW && max === EDGE_WINDOW) max = EDGE_CORRIDOR;
    return { min, max };
}
function setEdgeAttrs(minEdge, maxEdge) {
    const normalized = normalizeEdgePair(minEdge, maxEdge);
    edgeMin = normalized.min;
    edgeMax = normalized.max;
}
function applyEdgeAttrsRaw(minEdge, maxEdge) {
    edgeMin = coerceEdgeAttr(minEdge, DEFAULT_EDGE_MIN);
    edgeMax = coerceEdgeAttr(maxEdge, DEFAULT_EDGE_MAX);
}
function isBothEdgesWindow() {
    return edgeMin === EDGE_WINDOW && edgeMax === EDGE_WINDOW;
}
function syncEdgeControlsFromGlobals() {
    updateEdgeToggleButtons();
    syncEdgeDependentControls();
}
function syncClassScopedControlsFromGlobals() {
    writeSoftScoresToInputs();
    syncFairnessButtonsFromGlobals();
    syncEdgeControlsFromGlobals();
}
function exportEdgeSettings() {
    return { edgeMin: edgeMin, edgeMax: edgeMax };
}
function importEdgeSettings(data) {
    applyEdgeAttrsRaw(data.edgeMin, data.edgeMax);
}

function edgeAttrBtnLabel(e) {
    return e === EDGE_WINDOW ? '[窓]' : '[廊下]';
}

function updateEdgeToggleButtons() {
    const bMin = document.getElementById('edge-btn-min');
    const bMax = document.getElementById('edge-btn-max');
    if (bMin) bMin.textContent = edgeAttrBtnLabel(edgeMin);
    if (bMax) bMax.textContent = edgeAttrBtnLabel(edgeMax);
}

/** 盤面に存在しない端属性に対応するソフトスコア行・公平化行を無効化 */
function syncEdgeDependentControls() {
    const winAvail = boardHasWindowEdge();
    const corAvail = boardHasCorridorEdge();

    const setSoftRow = (baseId, stepId, enabled) => {
        const b = document.getElementById(baseId);
        const s = document.getElementById(stepId);
        const tr = b ? b.closest('tr') : s ? s.closest('tr') : null;
        if (b) b.disabled = !enabled;
        if (s) s.disabled = !enabled;
        if (tr) tr.classList.toggle('soft-row-disabled', !enabled);
    };
    const setFairRow = (kind, enabled) => {
        const idMap = { win: 'fair-btns-win', cor: 'fair-btns-cor' };
        const wrap = document.getElementById(idMap[kind]);
        if (wrap) {
            wrap.querySelectorAll('.fairness-btn').forEach(btn => { btn.disabled = !enabled; });
            const row = wrap.closest('.fairness-row');
            if (row) row.classList.toggle('fairness-row-disabled', !enabled);
        }
    };

    setSoftRow('soft-window-base', 'soft-window-step', winAvail);
    setSoftRow('soft-corridor-base', 'soft-corridor-step', corAvail);
    setFairRow('win', winAvail);
    setFairRow('cor', corAvail);
}

let edgeAttrShuffleProceedCallback = null;
let edgeAttrShuffleCancelCallback = null;
let edgeAttrShuffleEscListener = null;

function dismissEdgeAttrShuffleModal() {
    const modal = document.getElementById('edge-attr-warning-modal');
    if (modal) modal.style.display = 'none';
    edgeAttrShuffleProceedCallback = null;
    edgeAttrShuffleCancelCallback = null;
    if (edgeAttrShuffleEscListener) {
        document.removeEventListener('keydown', edgeAttrShuffleEscListener);
        edgeAttrShuffleEscListener = null;
    }
}

function showEdgeAttrShuffleConfirm(onProceed, onCancel) {
    hideAlert();
    const modal = document.getElementById('edge-attr-warning-modal');
    if (!modal) {
        if (onProceed) onProceed();
        return;
    }
    edgeAttrShuffleProceedCallback = onProceed;
    edgeAttrShuffleCancelCallback = onCancel;
    modal.style.display = 'flex';
    if (!edgeAttrShuffleEscListener) {
        edgeAttrShuffleEscListener = e => {
            if (e.key === 'Escape' || e.key === 'Esc') cancelEdgeAttrShuffleConfirm();
        };
        document.addEventListener('keydown', edgeAttrShuffleEscListener);
    }
}

function proceedEdgeAttrShuffleConfirm() {
    const cb = edgeAttrShuffleProceedCallback;
    dismissEdgeAttrShuffleModal();
    if (cb) cb();
}

function cancelEdgeAttrShuffleConfirm() {
    const cb = edgeAttrShuffleCancelCallback;
    dismissEdgeAttrShuffleModal();
    if (cb) cb();
}

function guardBothEdgesWindowForShuffle(onProceed) {
    if (!isBothEdgesWindow()) {
        onProceed();
        return;
    }
    showEdgeAttrShuffleConfirm(onProceed, () => {});
}

function cycleEdgeAttr(which) {
    const flip = e => (e === EDGE_WINDOW ? EDGE_CORRIDOR : EDGE_WINDOW);
    let newMin = edgeMin;
    let newMax = edgeMax;
    if (which === 'min') newMin = flip(edgeMin);
    else newMax = flip(edgeMax);
    hideAlert();
    applyEdgeAttrsRaw(newMin, newMax);
    syncEdgeControlsFromGlobals();
    saveCurrentClassData();
}

/** 履歴プルダウンで選択中の履歴メモ（教卓・印刷に併記） */
function getSelectedHistoryMemoForDesk() {
    const sel = document.getElementById('history-select');
    if (!sel || sel.value === '' || !histories[sel.value]) return '';
    return (histories[sel.value].memo || '').trim();
}

/** `[クラス名] メモ`（クラス名のみ strong / メモは通常の太さ想定で HTML） */
function buildDeskTitleInnerHtml() {
    const cls = getCurrentClassName() || '';
    const memo = getSelectedHistoryMemoForDesk();
    if (!cls && !memo) return '';
    const clsEsc = escapeHtml(cls);
    const memoEsc = escapeHtml(memo);
    if (!memoEsc) {
        return `<span class="desk-title-inner"><span class="desk-class-bracket">[</span><strong class="desk-class-name-part">${clsEsc}</strong><span class="desk-class-bracket">]</span></span>`;
    }
    if (!cls) {
        return `<span class="desk-title-inner"><span class="desk-history-memo-part">${memoEsc}</span></span>`;
    }
    return `<span class="desk-title-inner"><span class="desk-class-bracket">[</span><strong class="desk-class-name-part">${clsEsc}</strong><span class="desk-class-bracket">]</span><span class="desk-history-memo-part"> ${memoEsc}</span></span>`;
}

function measureDeskTitleWidth(px, fontFamily) {
    const cls = getCurrentClassName() || '';
    const memo = getSelectedHistoryMemoForDesk();
    const ctx = getSeatMeasureCtx();
    let w = 0;
    const bracketPart = cls ? `[${cls}]` : '';
    const memoPart = memo ? (cls ? ` ${memo}` : memo) : '';
    if (bracketPart) {
        ctx.font = `bold ${px}px ${fontFamily}`;
        w += ctx.measureText(bracketPart).width;
    }
    if (memoPart) {
        ctx.font = `${px}px ${fontFamily}`;
        w += ctx.measureText(memoPart).width;
    }
    return w;
}

function updateDeskTitleDisplay() {
    const span = document.getElementById('class-name-in-desk');
    if (!span) return;
    span.innerHTML = buildDeskTitleInnerHtml();
    scheduleFitDeskClassName();
}

/** 教卓枠内クラス名の最大フォント（px）。旧「教卓」表示と同程度の大きさに抑える */
const DESK_CLASS_TITLE_MAX_PX = 16;

function fitDeskClassName() {
    const wrap = document.getElementById('desk-class-title');
    const span = document.getElementById('class-name-in-desk');
    if (!wrap || !span) return;
    span.innerHTML = buildDeskTitleInnerHtml();
    const cls = getCurrentClassName() || '';
    const memo = getSelectedHistoryMemoForDesk();
    if (!cls && !memo) {
        span.innerHTML = '';
        span.style.fontSize = '';
        return;
    }

    const maxW = wrap.getBoundingClientRect().width - 10;
    if (maxW <= 0) return;

    const fontFamily = getComputedStyle(span).fontFamily;
    let low = 6;
    let high = DESK_CLASS_TITLE_MAX_PX;
    const fits = px => measureDeskTitleWidth(px, fontFamily) <= maxW;
    if (fits(high)) {
        span.style.fontSize = `${high}px`;
        return;
    }
    for (let i = 0; i < 28; i++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid;
        else high = mid;
    }
    span.style.fontSize = `${Math.max(4, low)}px`;
}

function scheduleFitDeskClassName() {
    requestAnimationFrame(() => fitDeskClassName());
}

/** Canvas.measureText 用キャンバス（ページ生存期間で使い回す） */
let _seatMeasureCanvas = null;
let _seatMeasureCtx = null;
function getSeatMeasureCtx() {
    if (!_seatMeasureCtx) {
        _seatMeasureCanvas = document.createElement('canvas');
        _seatMeasureCtx = _seatMeasureCanvas.getContext('2d');
    }
    return _seatMeasureCtx;
}

let appData = { classes: [{ id: 'class_default', name: '新しいクラス' }], currentClassId: 'class_default' };
let currentStudents = [], inactiveSeats = new Set(), seatAssignment = new Array(TOTAL_SEATS).fill(null), previewAssignment = null, histories = [];
/** 名簿タブ：全体ルール・備考の未保存検知用（load / 保存直後に同期） */
let constraintsBaselineRulesRaw = '';
let constraintsBaselineFlagsJson = '{}';
let isStudentView = false, isCalculating = false;
let fairFB = DEFAULT_FAIR_FB, fairWin = DEFAULT_FAIR_WIN, fairCor = DEFAULT_FAIR_COR, fairPair = DEFAULT_FAIR_PAIR, fairSeat = DEFAULT_FAIR_SEAT, fairSeatNear = DEFAULT_FAIR_SEAT_NEAR;
let softFrontBase = DEFAULT_SOFT_FRONT_BASE, softFrontStep = DEFAULT_SOFT_FRONT_STEP;
let softBackBase = DEFAULT_SOFT_BACK_BASE, softBackStep = DEFAULT_SOFT_BACK_STEP;
let softPairBase = DEFAULT_SOFT_PAIR_BASE, softPairStep = DEFAULT_SOFT_PAIR_STEP;
let softWindowBase = DEFAULT_SOFT_WINDOW_BASE, softWindowStep = DEFAULT_SOFT_WINDOW_STEP;
let softCorridorBase = DEFAULT_SOFT_CORRIDOR_BASE, softCorridorStep = DEFAULT_SOFT_CORRIDOR_STEP;
let softSeatBase = DEFAULT_SOFT_SEAT_BASE, softSeatStep = DEFAULT_SOFT_SEAT_STEP;
let edgeMin = DEFAULT_EDGE_MIN;
let edgeMax = DEFAULT_EDGE_MAX;
// 空席トグルで一時退避した生徒データ（キー: seat index）
let inactiveSeatBackup = new Map();
let exceptionMode = false, requiredExceptions = 0, targetExceptionGender = '', currentExceptions = new Set(), pendingStudents = null;
let lastShuffleLog = null;
let isShuffleCancelled = false;
// 市松シャッフルの「左上席」性別オフセット。0: 左上=男子, 1: 左上=女子
let checkerboardOffset = 0;
/** 印刷プレビューでの空席表示: 'hide' 非表示 | 'frame' 枠のみ（ラベルなし） */
let printInactiveMode = 'hide';
// 例外席選択中、座席固定により反転禁止となっている席のインデックス集合
let protectedExceptionSeats = new Set();
/** バックアップ読込で選択モーダルを出すまで保持する解析済み JSON オブジェクト */
let pendingImportBackupData = null;
let seatTrackTouchTimer = null;
let seatTrackLongPressTriggered = false;
let suppressSeatClickUntil = 0;
let activeColorPaletteTarget = 0;

// 盤面のDOM参照を統一し、同じquerySelector文字列の重複を減らす。
function getSeatElement(index) {
    return document.querySelector(`.seat[data-index='${index}']`);
}

function clearSeatTrackTouchTimer() {
    if (seatTrackTouchTimer) {
        clearTimeout(seatTrackTouchTimer);
        seatTrackTouchTimer = null;
    }
}

function findSeatIndexByStudentId(assignment, studentId) {
    if (!Array.isArray(assignment) || !studentId) return -1;
    for (let i = 0; i < TOTAL_SEATS; i++) {
        if (assignment[i] && assignment[i].id === studentId) return i;
    }
    return -1;
}

function findPairPartnerName(assignment, studentId) {
    const targetIdx = findSeatIndexByStudentId(assignment, studentId);
    if (targetIdx < 0) return 'なし';
    for (let j = 0; j < TOTAL_SEATS; j++) {
        if (j === targetIdx) continue;
        if (isPair(targetIdx, j)) {
            return assignment[j] && assignment[j].name ? assignment[j].name : 'なし';
        }
    }
    return 'なし';
}

function buildSeatTrackHistoryMap(studentId) {
    const bySeat = new Map();
    const capped = histories;
    capped.forEach((h, idx) => {
        const seatIdx = findSeatIndexByStudentId(h.assignment || [], studentId);
        if (seatIdx < 0) return;
        const arr = bySeat.get(seatIdx) || [];
        arr.push(idx + 1); // 1 = 最直近過去履歴
        bySeat.set(seatIdx, arr);
    });
    return bySeat;
}

function closeSeatTrackModal() {
    const modal = document.getElementById('seat-track-modal');
    if (modal) modal.style.display = 'none';
}

/** 座席追跡モーダル「制約ルール」欄：備考・NG隣接・全体@指定をまとめて HTML 化 */
function buildSeatTrackConstraintsHtml(student, ngPeerIds) {
    const rulesText = document.getElementById('overall-rules') ? document.getElementById('overall-rules').value.trim() : '';
    const parsed = parseOverallRulesText(rulesText);
    const sid = String(student.id ?? '');

    let html = '';

    const flags = (student.flags || '').trim();
    html += `<div class="seat-track-c-block"><span class="seat-track-c-label">備考欄・個人指定</span>`;
    html += `<div class="seat-track-c-val">${flags ? escapeHtml(flags).replace(/\n/g, '<br>') : '<span class="seat-track-c-muted">なし</span>'}</div></div>`;

    html += `<div class="seat-track-c-block"><span class="seat-track-c-label">NG隣接禁止（全体ルール）</span>`;
    if (ngPeerIds.length === 0) {
        html += `<div class="seat-track-c-val"><span class="seat-track-c-muted">該当なし</span></div></div>`;
    } else {
        const idToStudent = new Map(currentStudents.map(s => [s.id, s]));
        const sorted = [...ngPeerIds].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
        const items = sorted.map(oid => {
            const o = idToStudent.get(oid);
            const label = o ? `${o.name || '（無氏名）'}（${oid}）` : String(oid);
            return `<li>${escapeHtml(label)}</li>`;
        }).join('');
        html += `<ul class="seat-track-c-nglist">${items}</ul></div>`;
    }

    const sidLower = sid.toLowerCase();
    const atLines = parsed.placementRules
        .filter(r => r.prefix && sidLower.startsWith(String(r.prefix).toLowerCase()))
        .map(r => r.rawFlag);
    html += `<div class="seat-track-c-block"><span class="seat-track-c-label">全体ルール（@席・行・列など）</span>`;
    if (atLines.length === 0) {
        html += `<div class="seat-track-c-val"><span class="seat-track-c-muted">該当なし</span></div></div>`;
    } else {
        html += `<ul class="seat-track-c-atlist">${atLines.map(line => `<li><code>${escapeHtml(line)}</code></li>`).join('')}</ul></div>`;
    }

    return html;
}

function openSeatTrackModal(seatIdx) {
    const currentAssign = previewAssignment || seatAssignment;
    const student = currentAssign[seatIdx];
    if (!student) {
        showAlert('この席に生徒がいません。', 'info');
        return;
    }
    const modal = document.getElementById('seat-track-modal');
    const nameEl = document.getElementById('seat-track-name');
    const constraintsEl = document.getElementById('seat-track-constraints');
    const pairListEl = document.getElementById('seat-track-pairs');
    const gridEl = document.getElementById('seat-track-grid');
    const stackEl = document.getElementById('seat-track-main-stack');
    if (!modal || !nameEl || !constraintsEl || !pairListEl || !gridEl) return;

    if (stackEl) {
        stackEl.classList.remove('seat-track-stack--teacher', 'seat-track-stack--student');
        stackEl.classList.add(isStudentView ? 'seat-track-stack--student' : 'seat-track-stack--teacher');
    }

    nameEl.textContent = student.name || student.id || '(名称未設定)';

    const rulesText = document.getElementById('overall-rules') ? document.getElementById('overall-rules').value.trim() : '';
    const ngMap = buildNgPairsMap(currentStudents, rulesText);
    const ngPeerIds = ngMap[student.id] ? Array.from(ngMap[student.id]) : [];
    constraintsEl.innerHTML = buildSeatTrackConstraintsHtml(student, ngPeerIds);

    const pairRows = [];
    pairRows.push({ label: '今回', partner: findPairPartnerName(currentAssign, student.id) });
    const pairHistoryList = previewAssignment ? histories : histories.slice(1);
    pairHistoryList.forEach((h, idx) => {
        pairRows.push({ label: `${idx + 1}回前`, partner: findPairPartnerName(h.assignment || [], student.id) });
    });
    pairListEl.innerHTML = pairRows.map(row =>
        `<li><span class="track-pair-label">${escapeHtml(row.label)}</span><span class="track-pair-name">${escapeHtml(row.partner)}</span></li>`
    ).join('');

    const historyBySeat = buildSeatTrackHistoryMap(student.id);
    const currentSeatIdx = findSeatIndexByStudentId(currentAssign, student.id);
    gridEl.innerHTML = '';
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const cell = document.createElement('div');
        cell.className = 'track-cell';
        const nums = historyBySeat.get(i) || [];
        if (nums.length > 0) {
            const youngest = Math.min(...nums);
            cell.classList.add('track-cell-hit');
            if (nums.length >= 2) cell.classList.add('track-cell-hit-multi');
            cell.textContent = String(youngest);
            cell.title = `履歴: ${nums.join(', ')}（1=最直近過去）`;
        }
        if (currentSeatIdx === i) {
            cell.classList.add('track-cell-current');
            const curBadge = document.createElement('span');
            curBadge.className = 'track-cell-current-badge';
            curBadge.textContent = '今';
            cell.appendChild(curBadge);
        }
        gridEl.appendChild(cell);
    }

    modal.style.display = 'flex';
}

function handleSeatTrackTouchStart(e, seatIdx) {
    if (document.body.classList.contains('print-mode')) return;
    clearSeatTrackTouchTimer();
    seatTrackLongPressTriggered = false;
    seatTrackTouchTimer = setTimeout(() => {
        seatTrackLongPressTriggered = true;
        suppressSeatClickUntil = Date.now() + 800;
        openSeatTrackModal(seatIdx);
    }, 550);
}

function handleSeatTrackTouchEnd(e) {
    clearSeatTrackTouchTimer();
    if (seatTrackLongPressTriggered) {
        e.preventDefault();
        e.stopPropagation();
        seatTrackLongPressTriggered = false;
    }
}


function setActionButtons(commitVisible, logVisible) {
    document.getElementById('btn-commit').style.display = commitVisible ? 'block' : 'none';
    const cancelBtn = document.getElementById('btn-cancel-preview');
    if (cancelBtn) cancelBtn.style.display = commitVisible ? 'block' : 'none';
    document.getElementById('btn-show-log').style.display = logVisible ? 'block' : 'none';
}

function getCheckedRadioValue(name) {
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(name) : String(name).replace(/(["\\])/g, '\\$1');
    const el = document.querySelector(`input[name="${escaped}"]:checked`);
    return el ? el.value : '';
}

// --- 初期化 ---
window.onload = () => {
    initSeatLayoutTable();
    initColorPaletteUI();
    initGrid(); loadAppSystemData(); loadCurrentClassData();
    updatePrintInactiveToggleUi();
    initFormArrowNavigation();
    window.addEventListener('resize', () => {
        if (document.body.classList.contains('print-mode')) updatePrintToolbarInset();
        scheduleFitDeskClassName();
    });
    let resizeFitTimer = null;
    window.addEventListener('resize', () => {
        if (resizeFitTimer) clearTimeout(resizeFitTimer);
        resizeFitTimer = setTimeout(() => {
            if (document.body.classList.contains('print-mode')) return;
            autoFitText();
        }, 120);
    });
};

/** テーブル DOM 変更時はバージョンを上げる（古いキャッシュでフォント列が欠けるのを防ぐ） */
const SEAT_LAYOUT_TABLE_DOM_VERSION = '3';

function initSeatLayoutTable() {
    const tbody = document.getElementById('seat-layout-tbody');
    if (!tbody) return;
    if (tbody.dataset.domVersion !== SEAT_LAYOUT_TABLE_DOM_VERSION) {
        tbody.innerHTML = '';
        tbody.dataset.domVersion = SEAT_LAYOUT_TABLE_DOM_VERSION;
        tbody.dataset.inited = '0';
    }
    if (tbody.dataset.inited === '1') return;
    tbody.dataset.inited = '1';
    const fontLabels = { gothic: 'ゴシック', mincho: '明朝', maru: '丸ゴシック', kyokasho: '教科書' };
    tbody.innerHTML = SEAT_LAYOUT_FIXED_META.map(meta => `
        <tr data-layout-key="${meta.key}">
            <td style="padding:6px 8px; border:1px solid #ddd;">${meta.label}</td>
            <td style="text-align:center;border:1px solid #ddd;"><input type="checkbox" id="sl-print-${meta.key}" checked onchange="saveAndRender()"></td>
            <td style="padding:4px;border:1px solid #ddd;">
                <select id="sl-color-${meta.key}" onchange="saveAndRender()" style="width:100%;">
                    ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === meta.colorDefault ? ' selected' : ''}>${n}</option>`).join('')}
                </select>
            </td>
            <td style="padding:4px 6px;border:1px solid #ddd; white-space:nowrap;">
                <input type="hidden" id="sl-font-${meta.key}" value="gothic">
                <div class="seat-layout-font-btns" role="group" aria-label="${meta.label}のフォント">
                    ${SEAT_LAYOUT_FONT_KEYS.map(fk => `
                        <button type="button" class="btn btn-outline seat-layout-font-btn${fk === 'gothic' ? ' seat-layout-font-btn--active' : ''}"
                            data-font="${fk}" data-layout-key="${meta.key}" onclick="setSeatLayoutRowFont('${meta.key}','${fk}')" style="padding:2px 6px;font-size:0.72em;margin:0 2px 0 0;">${fontLabels[fk]}</button>
                    `).join('')}
                </div>
            </td>
        </tr>`).join('');
}

function syncSeatLayoutFontButtons(metaKey, fontKey) {
    if (!SEAT_LAYOUT_FONT_KEYS.includes(fontKey)) fontKey = 'gothic';
    const hid = document.getElementById(`sl-font-${metaKey}`);
    if (hid) hid.value = fontKey;
    const row = document.querySelector(`#seat-layout-tbody tr[data-layout-key="${metaKey}"]`);
    if (row) {
        row.querySelectorAll('.seat-layout-font-btn').forEach(btn => {
            btn.classList.toggle('seat-layout-font-btn--active', btn.getAttribute('data-font') === fontKey);
        });
    }
}

function setSeatLayoutRowFont(metaKey, fontKey) {
    if (!SEAT_LAYOUT_FONT_KEYS.includes(fontKey)) return;
    syncSeatLayoutFontButtons(metaKey, fontKey);
    saveAndRender();
}

function normalizeSeatLayoutFields(saved) {
    return SEAT_LAYOUT_FIXED_META.map(meta => {
        const prev = Array.isArray(saved) ? saved.find(x => x.key === meta.key) : null;
        let fontKey = prev && prev.fontKey && SEAT_LAYOUT_FONT_KEYS.includes(prev.fontKey) ? prev.fontKey : 'gothic';
        return {
            key: meta.key,
            screen: true,
            print: prev ? !!prev.print : true,
            colorNum: Math.min(6, Math.max(1, parseInt(prev && prev.colorNum, 10) || meta.colorDefault)),
            fontKey
        };
    });
}

function collectSeatLayoutFromUI() {
    return SEAT_LAYOUT_FIXED_META.map(meta => {
        const hid = document.getElementById(`sl-font-${meta.key}`);
        let fontKey = hid && SEAT_LAYOUT_FONT_KEYS.includes(hid.value) ? hid.value : 'gothic';
        return {
            key: meta.key,
            screen: true,
            print: document.getElementById(`sl-print-${meta.key}`) ? document.getElementById(`sl-print-${meta.key}`).checked : true,
            colorNum: Math.min(6, Math.max(1, parseInt(document.getElementById(`sl-color-${meta.key}`) && document.getElementById(`sl-color-${meta.key}`).value, 10) || meta.colorDefault)),
            fontKey
        };
    });
}

function applySeatLayoutToUI(fields) {
    const norm = normalizeSeatLayoutFields(fields || null);
    norm.forEach(f => {
        const p = document.getElementById(`sl-print-${f.key}`);
        const c = document.getElementById(`sl-color-${f.key}`);
        if (p) p.checked = f.print;
        if (c) c.value = String(f.colorNum);
        syncSeatLayoutFontButtons(f.key, f.fontKey || 'gothic');
    });
}

function studentFieldValue(student, key) {
    if (!student) return '';
    if (key === 'id') return student.id != null ? String(student.id) : '';
    return student[key] != null ? String(student[key]) : '';
}

function buildFixedSeatContentHtml(student, cfg, forPrint) {
    const layout = cfg.seatLayoutFields || normalizeSeatLayoutFields(null);
    let rowsHtml = '';
    for (const meta of SEAT_LAYOUT_FIXED_META) {
        const rule = layout.find(r => r.key === meta.key) || { print: true, colorNum: meta.colorDefault, fontKey: 'gothic' };
        if (forPrint && !rule.print) continue;
        const rawText = studentFieldValue(student, meta.key);
        if (!String(rawText).trim()) continue;
        const safe = escapeHtml(rawText);
        const printOff = !rule.print;
        const rowClass = (!forPrint && printOff) ? ' seat-row-print-off' : '';
        const colorNum = Math.min(6, Math.max(1, rule.colorNum || meta.colorDefault));
        const fontClass = SEAT_LAYOUT_FONT_CLASS[rule.fontKey] || 'font-gothic';
        rowsHtml += `<div class="seat-fixed-row${rowClass}" data-row-key="${meta.key}" data-size="${meta.size}" data-align="${meta.align}">`
            + `<span class="seat-fixed-text ${fontClass}" style="color:var(--c${colorNum});">${safe}</span>`
            + `</div>`;
    }
    return `<div class="seat-fixed-rows-wrap">${rowsHtml}</div>`;
}

/**
 * Canvas を用いて、指定フォントで text が「幅 w・高さ h」に収まる最大 px を解析的に求める。
 * w は「コンテンツ幅（行 padding を除いた値）」を渡すこと。
 * bold の glyph はみ出し / サブピクセル丸めを吸収するため横方向に SEAT_FIT_SAFETY_PX を引いて計算する。
 */
function computeMaxFontPxByCanvas(text, w, h, fontFamily, fontWeight) {
    if (!text || w <= 0 || h <= 0) return SEAT_FIT_EPS_PX;
    const ctx = getSeatMeasureCtx();
    ctx.font = `${fontWeight || 'bold'} ${SEAT_PROBE_FONT_PX}px ${fontFamily}`;
    const measuredW = ctx.measureText(text).width || 1;
    const safeW = Math.max(1, w - SEAT_FIT_SAFETY_PX);
    const fontByWidth = (safeW / measuredW) * SEAT_PROBE_FONT_PX;
    const fontByHeight = h / SEAT_ROW_LINE_HEIGHT;
    return Math.max(SEAT_FIT_EPS_PX, Math.min(fontByWidth, fontByHeight));
}

/** 行のコンテンツ幅（左右 padding を除いた幅）を返す */
function getRowContentBox(row) {
    const cs = getComputedStyle(row);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return {
        w: Math.max(0, row.clientWidth - padX),
        h: Math.max(0, row.clientHeight - padY)
    };
}

/**
 * 現在のレイアウトで参照文字列が収まる最大 px を、サンプル1席の氏名行で求めて返す。
 * 全座席は同サイズなので 1 回の計測で十分。
 */
function computeGlobalNameRefPx(rowSelector) {
    const sample = document.querySelector(rowSelector);
    if (!sample) return null;
    const box = getRowContentBox(sample);
    if (box.w <= 0 || box.h <= 0) return null;
    const fontFamily = getComputedStyle(sample).fontFamily;
    const px = computeMaxFontPxByCanvas(SEAT_NAME_PROBE_TEXT, box.w, box.h, fontFamily, 'bold');
    return Math.min(px, SEAT_SIZE_MAX_PX.L);
}

function computeMainGridNameRefPx() {
    return computeGlobalNameRefPx('#seat-grid .seat-content .seat-fixed-row[data-row-key="name"]');
}

function computePrintGridNameRefPx() {
    return computeGlobalNameRefPx('#print-root .print-seat-content .seat-fixed-row[data-row-key="name"]');
}

/** key ごとの上限 px（globalNRef ベースの比率 × 絶対上限） */
function computeRowHiPx(key, globalNRef) {
    const meta = SEAT_LAYOUT_FIXED_META.find(m => m.key === key);
    const absCap = meta ? SEAT_SIZE_MAX_PX[meta.size] : 28;
    let hiPx = absCap;
    if (globalNRef != null) {
        if (key === 'name') hiPx = Math.min(hiPx, globalNRef);
        else if (key === 'kana') hiPx = Math.min(hiPx, 0.55 * globalNRef);
        else if (key === 'id' || key === 'attr1' || key === 'attr2') hiPx = Math.min(hiPx, 0.45 * globalNRef);
    }
    return Math.max(SEAT_FIT_EPS_PX, hiPx);
}

/**
 * globalNRef は「大谷 翔平」で決めた全席共通の基準。
 * Canvas 計測で全席分を解析的に計算するため二分探索を使わない。
 * 1 席分の row サイズは外から渡してもらう（全席同レイアウト前提でサンプリング）。
 */
function fitFixedSeatRows(contentEl, globalNRef, rowSizeByKey, fontFamily) {
    if (!contentEl) return;
    const rows = contentEl.querySelectorAll('.seat-fixed-row');
    if (!rows.length) return;

    rows.forEach(row => {
        const key = row.getAttribute('data-row-key');
        const textEl = row.querySelector('.seat-fixed-text');
        if (!textEl) return;
        const sz = (rowSizeByKey && rowSizeByKey[key]) || getRowContentBox(row);
        if (!sz || sz.w <= 0 || sz.h <= 0) return;

        const hiPx = computeRowHiPx(key, globalNRef);
        const text = textEl.textContent || '';
        const ff = getComputedStyle(textEl).fontFamily || fontFamily || getComputedStyle(contentEl).fontFamily;
        const naturalPx = computeMaxFontPxByCanvas(text, sz.w, sz.h, ff, 'bold');
        const finalPx = Math.max(SEAT_FIT_EPS_PX, Math.min(naturalPx, hiPx));
        textEl.style.fontSize = `${finalPx}px`;
    });
}

/** 全席同レイアウト前提：1 席のみ row のコンテンツ幅・高さをサンプルして全席に使い回す */
function sampleRowSizesByKey(contentSelector) {
    const sample = document.querySelector(contentSelector);
    if (!sample) return null;
    const sizes = {};
    sample.querySelectorAll('.seat-fixed-row').forEach(row => {
        const k = row.getAttribute('data-row-key');
        if (!sizes[k]) sizes[k] = getRowContentBox(row);
    });
    return sizes;
}

function syncConstraintsBaselineFromPersisted() {
    const rulesEl = document.getElementById('overall-rules');
    constraintsBaselineRulesRaw = rulesEl ? String(rulesEl.value) : '';
    const flagsMap = {};
    currentStudents.forEach(s => {
        if (s.id) flagsMap[s.id] = s.flags || '';
    });
    constraintsBaselineFlagsJson = JSON.stringify(flagsMap);
}

function assignPlacementRulesToStudents(students, parsedRuleSet) {
    students.forEach(s => {
        s.appliedOverallRules = [];
        parsedRuleSet.placementRules.forEach(r => {
            const p = String(r.prefix || '').toLowerCase();
            if (String(s.id || '').toLowerCase().startsWith(p)) s.appliedOverallRules.push(r);
        });
        s.appliedGlobalNgRules = parsedRuleSet.ngRules;
    });
}

/** 備考欄 @（…）が論理的に許す座席インデックス集合。hasHardRule が false のときは null（交差チェック対象外）。 */
function buildPersonalLogicalAllowedSeatSet(personal) {
    if (!personal.hasHardRule) return null;
    if (personal.seats.length > 0) {
        return new Set(personal.seats);
    }
    const set = new Set();
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const r = Math.floor(i / NUM_COLS);
        const c = i % NUM_COLS;
        const rowOk = personal.rows.length === 0 || personal.rows.includes(r);
        const colOk = personal.cols.length === 0 || personal.cols.includes(c);
        if (rowOk && colOk) set.add(i);
    }
    return set;
}

/**
 * 該当生徒に適用される全体ルールの行・列指定のみを満たす座席の集合。行/列ルールが1件も無ければ null。
 * prefix 照合は assignPlacementRulesToStudents と同様（大小無視・前方一致）。
 */
function buildOverallRowColLogicalAllowedSeatSet(studentId, placementRules) {
    const sid = String(studentId || '').toLowerCase();
    const applicable = placementRules.filter(r => {
        if (r.kind !== 'row' && r.kind !== 'col') return false;
        const p = String(r.prefix || '').toLowerCase();
        return sid.startsWith(p);
    });
    if (applicable.length === 0) return null;
    const set = new Set();
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const r = Math.floor(i / NUM_COLS);
        const c = i % NUM_COLS;
        const ok = applicable.every(rule => {
            if (rule.kind === 'row') return rule.values.includes(r);
            if (rule.kind === 'col') return rule.values.includes(c);
            return true;
        });
        if (ok) set.add(i);
    }
    return set;
}

function logicalSeatSetsDisjoint(a, b) {
    if (a.size === 0 || b.size === 0) return true;
    if (a.size < b.size) {
        for (const x of a) if (b.has(x)) return false;
    } else {
        for (const x of b) if (a.has(x)) return false;
    }
    return true;
}

/**
 * 名簿→座席表切替時：記法エラーと、全体ルールの行/列と備考欄 @ の論理交差のみ検証。
 * @returns {{ ok: true } | { ok: false, html?: string }}
 */
function validateRosterSaveConstraints(tempStudents, rulesText) {
    const parsedRuleSet = parseOverallRulesText(rulesText);
    if (parsedRuleSet.errors.length > 0) {
        return { ok: false, html: `全体ルールの記法エラー：<br>${parsedRuleSet.errors.join('<br>')}` };
    }

    const parseErrStudents = [];
    tempStudents.forEach(s => {
        const personal = parsePersonalRuleConstraints(s.flags);
        if (personal.errors.length > 0) parseErrStudents.push({ ...s, _parseErrors: personal.errors });
    });
    if (parseErrStudents.length > 0) {
        const detail = parseErrStudents.slice(0, 5).map(s => `${s.id} ${s.name}: ${s._parseErrors.join(' / ')}`).join('<br>');
        return { ok: false, html: `備考欄の記法エラー：<br>${detail}${parseErrStudents.length > 5 ? '<br>…' : ''}` };
    }

    const placementRules = parsedRuleSet.placementRules;
    const conflicts = [];
    for (let si = 0; si < tempStudents.length; si++) {
        const s = tempStudents[si];
        const personal = parsePersonalRuleConstraints(s.flags);
        const pSet = buildPersonalLogicalAllowedSeatSet(personal);
        const oSet = buildOverallRowColLogicalAllowedSeatSet(s.id, placementRules);
        if (pSet === null || oSet === null) continue;
        if (logicalSeatSetsDisjoint(pSet, oSet)) conflicts.push(s);
    }
    if (conflicts.length > 0) {
        const detail = conflicts.slice(0, 8).map(x => `${x.id} ${x.name}`).join('、');
        return {
            ok: false,
            html: `全体ルールの行・列指定と備考欄の座席指定が論理的に矛盾しています。<br>${detail}${conflicts.length > 8 ? ' ほか' : ''}`
        };
    }
    return { ok: true };
}

function countActiveSeatsInRow(row) {
    let n = 0;
    for (let c = 0; c < NUM_COLS; c++) {
        if (!inactiveSeats.has(row * NUM_COLS + c)) n++;
    }
    return n;
}

function countActiveSeatsInCol(col) {
    let n = 0;
    for (let r = 0; r < NUM_ROWS; r++) {
        if (!inactiveSeats.has(r * NUM_COLS + col)) n++;
    }
    return n;
}

/** 複数行にまたがる有効席数（空席除く・重複なし） */
function countActiveSeatsInRowSet(rows) {
    const set = new Set();
    rows.forEach(row => {
        for (let c = 0; c < NUM_COLS; c++) {
            const i = row * NUM_COLS + c;
            if (!inactiveSeats.has(i)) set.add(i);
        }
    });
    return set.size;
}

/** 複数列にまたがる有効席数（空席除く・重複なし） */
function countActiveSeatsInColSet(cols) {
    const set = new Set();
    cols.forEach(col => {
        for (let r = 0; r < NUM_ROWS; r++) {
            const i = r * NUM_COLS + col;
            if (!inactiveSeats.has(i)) set.add(i);
        }
    });
    return set.size;
}

function studentIdMatchesPrefix(studentId, prefix) {
    return String(studentId || '').toLowerCase().startsWith(String(prefix || '').toLowerCase());
}

function formatSoftValidationStudentList(students, maxShow) {
    maxShow = maxShow == null ? 5 : maxShow;
    const slice = students.slice(0, maxShow);
    const names = slice.map(s => `${s.id} ${s.name}`.trim()).join('、');
    return students.length > maxShow ? `${names} ほか${students.length - maxShow}名` : names;
}

/** 全体ルール1件が占有する有効席（空席除く） */
function buildRuleZoneSeatSet(rule) {
    const set = new Set();
    for (let i = 0; i < TOTAL_SEATS; i++) {
        if (inactiveSeats.has(i)) continue;
        const r = Math.floor(i / NUM_COLS);
        const c = i % NUM_COLS;
        if (rule.kind === 'seat' && rule.values.includes(i)) set.add(i);
        else if (rule.kind === 'row' && rule.values.includes(r)) set.add(i);
        else if (rule.kind === 'col' && rule.values.includes(c)) set.add(i);
    }
    return set;
}

/**
 * 名簿保存前ソフトバリデーション（警告のみ）。ハード検証通過後に呼ぶこと。
 * @returns {{ warnings: string[] }}
 */
function checkSoftConstraintsWarning(tempStudents, rulesText) {
    const warnings = [];
    const parsedRuleSet = parseOverallRulesText(rulesText);
    const placementRules = parsedRuleSet.placementRules;
    const fullGridBounds = { currMinR: 0, currMaxR: NUM_ROWS - 1, currMinC: 0, currMaxC: NUM_COLS - 1 };

    // 1. 全体ルールの行・列定員超過（同一ルール内の複数行/列は有効席を合算）
    placementRules.forEach(rule => {
        if (rule.kind !== 'row' && rule.kind !== 'col') return;
        const matched = tempStudents.filter(s => studentIdMatchesPrefix(s.id, rule.prefix));
        if (matched.length === 0) return;
        const cap = buildRuleZoneSeatSet(rule).size;
        if (matched.length > cap) {
            warnings.push(
                `【定員超過】${rule.rawFlag}：指定領域の有効席は${cap}席ですが、対象生徒は${matched.length}名です（${formatSoftValidationStudentList(matched)}）`
            );
        }
    });

    // 2. 相乗り（全体ルール領域への prefix 外の備考侵入）
    placementRules.forEach(rule => {
        const zone = buildRuleZoneSeatSet(rule);
        if (zone.size === 0) return;
        tempStudents.forEach(s => {
            if (studentIdMatchesPrefix(s.id, rule.prefix)) return;
            const personal = parsePersonalRuleConstraints(s.flags);
            if (!personal.hasHardRule) return;
            const pSet = buildPersonalLogicalAllowedSeatSet(personal);
            if (!pSet) return;
            for (const seatIdx of pSet) {
                if (zone.has(seatIdx)) {
                    warnings.push(
                        `【相乗り】${s.id} ${s.name}：備考欄の指定が全体ルール「${rule.rawFlag}」の領域（${getSeatLabel(seatIdx)} 付近）と重なっています`
                    );
                    break;
                }
            }
        });
    });

    // 3. 同一席の奪い合い
    const seatClaimants = new Map();
    const addSeatClaim = (seatIdx, student) => {
        if (!seatClaimants.has(seatIdx)) seatClaimants.set(seatIdx, []);
        const list = seatClaimants.get(seatIdx);
        if (!list.some(x => x.id === student.id)) list.push(student);
    };
    tempStudents.forEach(s => {
        const personal = parsePersonalRuleConstraints(s.flags);
        personal.seats.forEach(seatIdx => addSeatClaim(seatIdx, s));
    });
    placementRules.forEach(rule => {
        if (rule.kind !== 'seat') return;
        tempStudents.forEach(s => {
            if (!studentIdMatchesPrefix(s.id, rule.prefix)) return;
            rule.values.forEach(seatIdx => addSeatClaim(seatIdx, s));
        });
    });
    seatClaimants.forEach((list, seatIdx) => {
        if (list.length < 2) return;
        warnings.push(
            `【席の重複】${getSeatLabel(seatIdx)}に複数の生徒が指定されています（${formatSoftValidationStudentList(list, 8)}）`
        );
    });

    // 4. 行・列の合算キャパ超過（1人1行・1人1列で最大1回）
    // 複数行/列の全体ルールはチェック1、備考の複数行/列は下記グループで合算判定
    const rowStudentIds = Array.from({ length: NUM_ROWS }, () => new Set());
    const colStudentIds = Array.from({ length: NUM_COLS }, () => new Set());
    const personalMultiRowGroups = new Map();
    const personalMultiColGroups = new Map();
    const markRow = (studentId, row) => { if (studentId) rowStudentIds[row].add(studentId); };
    const markCol = (studentId, col) => { if (studentId) colStudentIds[col].add(studentId); };
    const addPersonalMultiRowGroup = (studentId, rows) => {
        const key = [...rows].sort((a, b) => a - b).join(',');
        if (!personalMultiRowGroups.has(key)) personalMultiRowGroups.set(key, new Set());
        personalMultiRowGroups.get(key).add(studentId);
    };
    const addPersonalMultiColGroup = (studentId, cols) => {
        const key = [...cols].sort((a, b) => a - b).join(',');
        if (!personalMultiColGroups.has(key)) personalMultiColGroups.set(key, new Set());
        personalMultiColGroups.get(key).add(studentId);
    };
    tempStudents.forEach(s => {
        const sid = s.id;
        if (!sid) return;
        const personal = parsePersonalRuleConstraints(s.flags);
        if (personal.rows.length > 1) addPersonalMultiRowGroup(sid, personal.rows);
        else if (personal.rows.length === 1) markRow(sid, personal.rows[0]);
        if (personal.cols.length > 1) addPersonalMultiColGroup(sid, personal.cols);
        else if (personal.cols.length === 1) markCol(sid, personal.cols[0]);
        personal.seats.forEach(i => {
            const r = Math.floor(i / NUM_COLS);
            const c = i % NUM_COLS;
            if (personal.rows.length <= 1 || !personal.rows.includes(r)) markRow(sid, r);
            if (personal.cols.length <= 1 || !personal.cols.includes(c)) markCol(sid, c);
        });
        placementRules.forEach(rule => {
            if (!studentIdMatchesPrefix(sid, rule.prefix)) return;
            if (rule.kind === 'row') {
                if (rule.values.length > 1) return;
                rule.values.forEach(r => markRow(sid, r));
            } else if (rule.kind === 'col') {
                if (rule.values.length > 1) return;
                rule.values.forEach(c => markCol(sid, c));
            } else if (rule.kind === 'seat') {
                rule.values.forEach(i => {
                    markRow(sid, Math.floor(i / NUM_COLS));
                    markCol(sid, i % NUM_COLS);
                });
            }
        });
    });
    personalMultiRowGroups.forEach((idSet, key) => {
        const rows = key.split(',').map(Number);
        const cap = countActiveSeatsInRowSet(rows);
        const n = idSet.size;
        if (n > cap) {
            const matched = tempStudents.filter(st => idSet.has(st.id));
            const rowLabels = rows.map(r => `${r + 1}行目`).join('・');
            warnings.push(
                `【行の溢れ】備考欄で${rowLabels}を指定した生徒が${n}名いますが、指定領域の有効席は${cap}席です（${formatSoftValidationStudentList(matched)}）`
            );
        }
    });
    personalMultiColGroups.forEach((idSet, key) => {
        const cols = key.split(',').map(Number);
        const cap = countActiveSeatsInColSet(cols);
        const n = idSet.size;
        if (n > cap) {
            const matched = tempStudents.filter(st => idSet.has(st.id));
            const colLabels = cols.map(c => `${COLS_LABELS[c] || c + 1}列`).join('・');
            warnings.push(
                `【列の溢れ】備考欄で${colLabels}を指定した生徒が${n}名いますが、指定領域の有効席は${cap}席です（${formatSoftValidationStudentList(matched)}）`
            );
        }
    });
    for (let r = 0; r < NUM_ROWS; r++) {
        const cap = countActiveSeatsInRow(r);
        const n = rowStudentIds[r].size;
        if (n > cap) {
            const ids = [...rowStudentIds[r]];
            const matched = tempStudents.filter(s => ids.includes(s.id));
            warnings.push(
                `【行の溢れ】${r + 1}行目を指定した生徒が${n}名いますが、有効席は${cap}席です（${formatSoftValidationStudentList(matched)}）`
            );
        }
    }
    for (let c = 0; c < NUM_COLS; c++) {
        const cap = countActiveSeatsInCol(c);
        const n = colStudentIds[c].size;
        if (n > cap) {
            const colLabel = COLS_LABELS[c] || String(c + 1);
            const ids = [...colStudentIds[c]];
            const matched = tempStudents.filter(s => ids.includes(s.id));
            warnings.push(
                `【列の溢れ】${colLabel}列を指定した生徒が${n}名いますが、有効席は${cap}席です（${formatSoftValidationStudentList(matched)}）`
            );
        }
    }

    // 5. 固定席同士の NG + 8近傍
    const studentsClone = JSON.parse(JSON.stringify(tempStudents));
    assignPlacementRulesToStudents(studentsClone, parsedRuleSet);
    const fixed = [];
    studentsClone.forEach(s => {
        const allowed = calcAllowedSeatsForStudent(s, false, fullGridBounds);
        if (allowed.length === 1) fixed.push({ student: s, seat: allowed[0] });
    });
    if (fixed.length >= 2) {
        const ngMap = buildNgPairsMap(studentsClone, rulesText);
        for (let i = 0; i < fixed.length; i++) {
            for (let j = i + 1; j < fixed.length; j++) {
                const a = fixed[i];
                const b = fixed[j];
                if (!ngMap[a.student.id] || !ngMap[a.student.id].has(b.student.id)) continue;
                if (!isAdjacentIncludingDiagonal(a.seat, b.seat)) continue;
                warnings.push(
                    `【NG隣接×固定席】${a.student.id} ${a.student.name}（${getSeatLabel(a.seat)}）と ${b.student.id} ${b.student.name}（${getSeatLabel(b.seat)}）はNG指定かつ隣接する固定席です`
                );
            }
        }
    }

    return { warnings };
}

let softValidationProceedCallback = null;
let softValidationCancelCallback = null;
let softValidationEscListener = null;

let rosterHardValidationCloseCallback = null;
let rosterHardValidationEscListener = null;
let rosterImportModeAppendCallback = null;
let rosterImportModeReplaceCallback = null;
let rosterImportModeCancelCallback = null;
let rosterImportModeEscListener = null;

/** validateRosterSaveConstraints の html（<br>区切り）をエスケープしてモーダル本文に表示 */
function setRosterHardValidationBodyHtml(html) {
    const body = document.getElementById('roster-hard-validation-body');
    if (!body) return;
    const parts = String(html || '').split(/<br\s*\/?>/gi).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
        body.innerHTML = '<p class="roster-hard-validation-item">座席表に切り替えられません。</p>';
        return;
    }
    body.innerHTML = parts.map(p => `<p class="roster-hard-validation-item">${escapeHtml(p)}</p>`).join('');
}

function dismissRosterHardValidationModal() {
    const modal = document.getElementById('roster-hard-validation-modal');
    if (modal) modal.style.display = 'none';
    rosterHardValidationCloseCallback = null;
    if (rosterHardValidationEscListener) {
        document.removeEventListener('keydown', rosterHardValidationEscListener);
        rosterHardValidationEscListener = null;
    }
}

function closeRosterHardValidationModal() {
    const cb = rosterHardValidationCloseCallback;
    dismissRosterHardValidationModal();
    if (cb) cb();
}

function showRosterHardValidationModal(html, onClose) {
    dismissSoftValidationModal();
    const modal = document.getElementById('roster-hard-validation-modal');
    if (!modal) {
        if (onClose) onClose();
        return;
    }
    setRosterHardValidationBodyHtml(html);
    rosterHardValidationCloseCallback = onClose;
    modal.style.display = 'flex';
    if (!rosterHardValidationEscListener) {
        rosterHardValidationEscListener = e => {
            if (e.key === 'Escape' || e.key === 'Esc') closeRosterHardValidationModal();
        };
        document.addEventListener('keydown', rosterHardValidationEscListener);
    }
}

function dismissSoftValidationModal() {
    const modal = document.getElementById('soft-validation-modal');
    if (modal) modal.style.display = 'none';
    softValidationProceedCallback = null;
    softValidationCancelCallback = null;
    if (softValidationEscListener) {
        document.removeEventListener('keydown', softValidationEscListener);
        softValidationEscListener = null;
    }
}

function closeSoftValidationModal() {
    const cb = softValidationCancelCallback;
    dismissSoftValidationModal();
    if (cb) cb();
}

function showSoftValidationConfirm(warnings, onProceed, onCancel) {
    dismissRosterHardValidationModal();
    const listEl = document.getElementById('soft-validation-warning-list');
    const modal = document.getElementById('soft-validation-modal');
    if (!listEl || !modal) {
        if (onProceed) onProceed();
        return;
    }
    listEl.innerHTML = warnings.map(w =>
        `<p class="soft-validation-item">${escapeHtml(w)}</p>`
    ).join('');
    softValidationProceedCallback = onProceed;
    softValidationCancelCallback = onCancel;
    modal.style.display = 'flex';
    if (!softValidationEscListener) {
        softValidationEscListener = e => {
            if (e.key === 'Escape' || e.key === 'Esc') cancelSoftValidationConfirm();
        };
        document.addEventListener('keydown', softValidationEscListener);
    }
}

function proceedSoftValidationConfirm() {
    const cb = softValidationProceedCallback;
    dismissSoftValidationModal();
    if (cb) cb();
}

function cancelSoftValidationConfirm() {
    const cb = softValidationCancelCallback;
    dismissSoftValidationModal();
    if (cb) cb();
}

function dismissRosterImportModeModal() {
    const modal = document.getElementById('roster-import-mode-modal');
    if (modal) modal.style.display = 'none';
    rosterImportModeAppendCallback = null;
    rosterImportModeReplaceCallback = null;
    rosterImportModeCancelCallback = null;
    if (rosterImportModeEscListener) {
        document.removeEventListener('keydown', rosterImportModeEscListener);
        rosterImportModeEscListener = null;
    }
}

function showRosterImportModeConfirm(onAppend, onReplace, onCancel) {
    const modal = document.getElementById('roster-import-mode-modal');
    if (!modal) {
        if (onReplace) onReplace();
        return;
    }
    rosterImportModeAppendCallback = onAppend;
    rosterImportModeReplaceCallback = onReplace;
    rosterImportModeCancelCallback = onCancel;
    modal.style.display = 'flex';
    if (!rosterImportModeEscListener) {
        rosterImportModeEscListener = e => {
            if (e.key === 'Escape' || e.key === 'Esc') cancelRosterImportMode();
        };
        document.addEventListener('keydown', rosterImportModeEscListener);
    }
}

function appendRosterImportMode() {
    const cb = rosterImportModeAppendCallback;
    dismissRosterImportModeModal();
    if (cb) cb();
}

function replaceRosterImportMode() {
    const cb = rosterImportModeReplaceCallback;
    dismissRosterImportModeModal();
    if (cb) cb();
}

function cancelRosterImportMode() {
    const cb = rosterImportModeCancelCallback;
    dismissRosterImportModeModal();
    if (cb) cb();
}

function finishRosterCommitFromTable(tempStudents) {
    invalidateManualSwapEvalCache();
    currentStudents = tempStudents;
    const studentMap = new Map();
    currentStudents.forEach(student => {
        if (student.id) studentMap.set(student.id, student);
    });
    const remapAssignment = assignment => assignment.map(seatStudent => {
        if (!seatStudent || !seatStudent.id) return null;
        return studentMap.get(seatStudent.id) || null;
    });
    seatAssignment = remapAssignment(seatAssignment);
    if (previewAssignment) previewAssignment = remapAssignment(previewAssignment);
    saveCurrentClassData();
    syncConstraintsBaselineFromPersisted();
    updateCounters();
}

function switchTab(tabId, ev, navOpts) {
    navOpts = navOpts || {};
    if (exceptionMode) return;
    const applyTabSwitch = () => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');
        const trigger = (ev && ev.currentTarget)
            || (typeof window !== 'undefined' && window.event && window.event.currentTarget)
            || Array.from(document.querySelectorAll('.tab-btn')).find(btn => (btn.getAttribute('onclick') || '').includes(`'${tabId}'`));
        if (trigger && trigger.classList) trigger.classList.add('active');
        if (tabId === 'tab-main') { updateCounters(); if (currentStudents.length > 0) renderAssignments(); }
    };
    if (!navOpts.skipRosterDirtyPrompt && tabId === 'tab-main') {
        const studentsTab = document.getElementById('tab-students');
        if (studentsTab && studentsTab.classList.contains('active')) {
            commitRosterFromTableToStoredState(ok => {
                if (ok) applyTabSwitch();
            });
            return;
        }
    }
    applyTabSwitch();
}

function updateCounters() {
    document.getElementById('counter-students').innerText = currentStudents.length;
    document.getElementById('counter-seats').innerText = TOTAL_SEATS - inactiveSeats.size;

    const wrap = document.getElementById('counter-gender-wrap');
    const boysEl = document.getElementById('counter-boys');
    const girlsEl = document.getElementById('counter-girls');
    if (!wrap || !boysEl || !girlsEl) return;

    const hasAnyGender = currentStudents.some(s => s.gender === '男' || s.gender === '女');
    if (!hasAnyGender) {
        wrap.style.display = 'none';
        return;
    }
    let boys = 0, girls = 0;
    currentStudents.forEach(s => {
        if (s.gender === '男') boys++;
        else if (s.gender === '女') girls++;
    });
    boysEl.innerText = boys;
    girlsEl.innerText = girls;
    wrap.style.display = 'inline';
}

// --- クラス管理 ---
function loadAppSystemData() {
    const systemDataString = localStorage.getItem(`${PREFIX}system`);
    if(systemDataString) { try { appData = JSON.parse(systemDataString); } catch(e) {} }
    if(!appData || typeof appData !== 'object') appData = { classes: [], currentClassId: '' };
    if(!Array.isArray(appData.classes) || appData.classes.length === 0) {
        appData.classes = [{ id: 'class_default', name: '新しいクラス' }];
        appData.currentClassId = 'class_default';
    }
    // currentClassId が classes 内のどれにも一致しないバックアップ／旧データに対する補正
    if (!appData.classes.some(c => c && c.id === appData.currentClassId)) {
        appData.currentClassId = appData.classes[0].id;
    }
    updateClassSelects();
}

function saveAppSystemData() { localStorage.setItem(`${PREFIX}system`, JSON.stringify(appData)); updateClassSelects(); }

function updateClassSelects() {
    const classSelects = [
        document.getElementById('class-select'),
        document.getElementById('class-select-students')
    ].filter(Boolean);

    classSelects.forEach(selectEl => {
        selectEl.innerHTML = '';
        appData.classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.text = c.name;
            if(c.id === appData.currentClassId) option.selected = true;
            selectEl.appendChild(option);
        });
    });

    const currentClass = appData.classes.find(c => c.id === appData.currentClassId);
    if (currentClass) document.getElementById('class-name-input').value = currentClass.name;
    updateClassNameDisplay();
}

/** 現在クラスの名前を取得（無ければ空文字） */
function getCurrentClassName() {
    const c = appData.classes.find(c => c.id === appData.currentClassId);
    return c ? (c.name || '') : '';
}

/** メイン画面（教卓枠内）のクラス名＋選択履歴メモ表示を更新 */
function updateClassNameDisplay() {
    updateDeskTitleDisplay();
}

function switchClass(selectId = 'class-select') {
    const sourceSelect = document.getElementById(selectId) || document.getElementById('class-select') || document.getElementById('class-select-students');
    if (!sourceSelect) return;
    if(sourceSelect.value === appData.currentClassId) return;
    saveCurrentClassData(); 
    appData.currentClassId = sourceSelect.value; 
    saveAppSystemData(); loadCurrentClassData();
}

function saveClassName() {
    const cls = appData.classes.find(c => c.id === appData.currentClassId);
    if (!cls) { showAlert("クラスが見つかりません。ページを再読み込みしてください。"); return; }
    cls.name = document.getElementById('class-name-input').value.trim() || '名称未設定';
    saveAppSystemData();
    updateClassNameDisplay();
    showAlert("クラス名を変更しました。", "success");
}

function createNewClass() {
    saveCurrentClassData(); const newId = 'class_' + Date.now();
    appData.classes.push({ id: newId, name: '新しいクラス' });
    appData.currentClassId = newId; saveAppSystemData(); loadCurrentClassData();
}

/** クラス単位の設定（全体ルール・公平化）を UI ごとデフォルトに戻す */
function resetClassScopedSettingsUI() {
    const rulesEl = document.getElementById('overall-rules');
    if (rulesEl) rulesEl.value = '';
    resetFairnessToDefaults();
    softFrontBase = DEFAULT_SOFT_FRONT_BASE; softFrontStep = DEFAULT_SOFT_FRONT_STEP;
    softBackBase = DEFAULT_SOFT_BACK_BASE; softBackStep = DEFAULT_SOFT_BACK_STEP;
    softPairBase = DEFAULT_SOFT_PAIR_BASE; softPairStep = DEFAULT_SOFT_PAIR_STEP;
    softWindowBase = DEFAULT_SOFT_WINDOW_BASE; softWindowStep = DEFAULT_SOFT_WINDOW_STEP;
    softCorridorBase = DEFAULT_SOFT_CORRIDOR_BASE; softCorridorStep = DEFAULT_SOFT_CORRIDOR_STEP;
    softSeatBase = DEFAULT_SOFT_SEAT_BASE; softSeatStep = DEFAULT_SOFT_SEAT_STEP;
    setEdgeAttrs(DEFAULT_EDGE_MIN, DEFAULT_EDGE_MAX);
    syncClassScopedControlsFromGlobals();
}

function deleteCurrentClass() {
    if(appData.classes.length <= 1) return alert("最後のクラスは削除できません。");
    if(confirm(`本当に「${document.getElementById('class-name-input').value}」を削除しますか？\n履歴もすべて消去されます。`)) {
        localStorage.removeItem(`${PREFIX}data_${appData.currentClassId}`);
        appData.classes = appData.classes.filter(c => c.id !== appData.currentClassId);
        appData.currentClassId = appData.classes[0].id; saveAppSystemData(); loadCurrentClassData();
    }
}

// --- グリッド初期化 ---
function initGrid() {
    const grid = document.getElementById('seat-grid'); grid.innerHTML = '';
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat'; seat.dataset.index = i; seat.onclick = () => handleSeatClick(i);
        seat.draggable = true; seat.ondragstart = (e) => dragStart(e, i); seat.ondragover = (e) => dragOver(e);
        seat.ondragleave = (e) => dragLeave(e, i); seat.ondrop = (e) => drop(e, i);
        seat.oncontextmenu = (e) => { e.preventDefault(); openSeatTrackModal(i); };
        seat.addEventListener('touchstart', (e) => handleSeatTrackTouchStart(e, i), { passive: true });
        seat.addEventListener('touchend', handleSeatTrackTouchEnd, { passive: false });
        seat.addEventListener('touchcancel', () => { clearSeatTrackTouchTimer(); seatTrackLongPressTriggered = false; }, { passive: true });
        seat.addEventListener('touchmove', () => { clearSeatTrackTouchTimer(); seatTrackLongPressTriggered = false; }, { passive: true });

        const label = document.createElement('div'); label.className = 'seat-label'; label.innerText = getSeatLabel(i);
        const content = document.createElement('div'); content.className = 'seat-content'; content.id = `seat-content-${i}`;
        seat.appendChild(label); seat.appendChild(content); grid.appendChild(seat);
    }
}

function toggleView() {
    isStudentView = !isStudentView;
    document.getElementById('classroom').classList.toggle('student-view');
    renderAssignments();
    scheduleFitDeskClassName();
}

function updatePrintToolbarInset() {
    const overlay = document.getElementById('print-overlay');
    if (!overlay || overlay.style.display === 'none') {
        document.documentElement.style.removeProperty('--print-toolbar-h');
        return;
    }
    const h = Math.ceil(overlay.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--print-toolbar-h', `${h}px`);
}

function updatePrintInactiveToggleUi() {
    const btn = document.getElementById('btn-print-inactive-toggle');
    if (!btn) return;
    const isFrame = printInactiveMode === 'frame';
    btn.textContent = isFrame ? '空席: 枠表示' : '空席: 非表示';
    btn.classList.toggle('btn-success', isFrame);
    btn.classList.toggle('btn-outline', !isFrame);
}

function togglePrintInactiveDisplay() {
    printInactiveMode = printInactiveMode === 'frame' ? 'hide' : 'frame';
    updatePrintInactiveToggleUi();
    if (document.body.classList.contains('print-mode')) {
        renderPrintLayout();
        requestAnimationFrame(() => {
            requestAnimationFrame(updatePrintToolbarInset);
        });
    }
    saveCurrentClassData();
}

function togglePrintMode() {
    document.body.classList.toggle('print-mode');
    const isPrintMode = document.body.classList.contains('print-mode');
    document.getElementById('print-overlay').style.display = isPrintMode ? 'block' : 'none';
    if (isPrintMode) {
        updatePrintInactiveToggleUi();
        renderPrintLayout();
        requestAnimationFrame(() => {
            requestAnimationFrame(updatePrintToolbarInset);
        });
    } else {
        document.documentElement.style.removeProperty('--print-toolbar-h');
        const printRoot = document.getElementById('print-root');
        if (printRoot) printRoot.innerHTML = '';
    }
    renderAssignments();
}

function getRenderConfig() {
    return {
        seatLayoutFields: normalizeSeatLayoutFields(collectSeatLayoutFromUI()),
        currentData: previewAssignment || seatAssignment,
        isGbActive: document.getElementById('btn-gender-border') ? document.getElementById('btn-gender-border').classList.contains('btn-success') : false,
        gbBoy: document.getElementById('gb-boy-color') ? document.getElementById('gb-boy-color').value : '6',
        gbGirl: document.getElementById('gb-girl-color') ? document.getElementById('gb-girl-color').value : '5',
        gbStyleVal: document.getElementById('gb-style') ? document.getElementById('gb-style').value : 'solid'
    };
}

function getGenderBorderStyle(student, cfg, forPrint) {
    if (!cfg.isGbActive || !student || !student.gender) return null;
    const borderColor = student.gender === '男' ? `var(--c${cfg.gbBoy})` : student.gender === '女' ? `var(--c${cfg.gbGirl})` : '';
    if (!borderColor) return null;

    if (forPrint) {
        if (cfg.gbStyleVal === 'double') return { border: `3px double ${borderColor}` };
        if (cfg.gbStyleVal === 'thick') return { border: `2px solid ${borderColor}` };
        return { border: `1.2px solid ${borderColor}` };
    }

    let gbBorderWidth = '2px';
    let gbBorderStyle = 'solid';
    if (cfg.gbStyleVal === 'thick') gbBorderWidth = '4px';
    if (cfg.gbStyleVal === 'double') { gbBorderWidth = '4px'; gbBorderStyle = 'double'; }
    return { border: `${gbBorderWidth} ${gbBorderStyle} ${borderColor}` };
}

function buildSeatContentHtml(student, cfg, forPrint = false) {
    return buildFixedSeatContentHtml(student, cfg, forPrint);
}

function renderPrintLayout() {
    const printRoot = document.getElementById('print-root');
    if (!printRoot) return;
    const cfg = getRenderConfig();
    const bounds = getGridBoundaries();
    const visibleCols = Math.max(1, bounds.currMaxC - bounds.currMinC + 1);
    const visibleRows = Math.max(1, bounds.currMaxR - bounds.currMinR + 1);

    printRoot.classList.toggle('student-view', Boolean(isStudentView));
    const printDeskHtml = buildDeskTitleInnerHtml();
    printRoot.innerHTML = `
        <div class="print-page">
            <div class="print-classroom">
                <div class="print-desk-row">
                    <div class="print-desk print-desk-class"><span class="print-class-name-in-desk" id="print-class-name-in-desk">${printDeskHtml}</span></div>
                </div>
                <div id="print-seat-grid" class="print-seat-grid"></div>
            </div>
        </div>
    `;
    const grid = document.getElementById('print-seat-grid');
    grid.style.gridTemplateColumns = `repeat(${visibleCols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${visibleRows}, 1fr)`;

    const showInactiveFrames = printInactiveMode === 'frame';

    for (let i = 0; i < TOTAL_SEATS; i++) {
        const isInactive = inactiveSeats.has(i);
        if (isInactive && !showInactiveFrames) continue;
        const row = Math.floor(i / NUM_COLS);
        const col = i % NUM_COLS;
        const isInsideBounds = row >= bounds.currMinR && row <= bounds.currMaxR && col >= bounds.currMinC && col <= bounds.currMaxC;
        if (!isInsideBounds) continue;

        const seatEl = document.createElement('div');
        seatEl.className = 'print-seat';
        seatEl.style.gridColumn = String(col - bounds.currMinC + 1);
        seatEl.style.gridRow = String(row - bounds.currMinR + 1);

        if (isInactive) {
            seatEl.classList.add('print-seat-inactive');
            grid.appendChild(seatEl);
            continue;
        }

        const student = cfg.currentData[i];
        if (student) {
            const borderStyle = getGenderBorderStyle(student, cfg, true);
            if (borderStyle && borderStyle.border) seatEl.style.border = borderStyle.border;
            seatEl.innerHTML = `<div class="print-seat-content">${buildSeatContentHtml(student, cfg, true)}</div>`;
        } else {
            seatEl.innerHTML = `<div class="print-seat-label">${getSeatLabel(i)}</div>`;
        }
        grid.appendChild(seatEl);
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fitPrintDeskClassName();
            fitPrintGridLayout(grid, visibleRows, visibleCols);
            autoFitPrintText();
        });
    });
}

function fitPrintDeskClassName() {
    const wrap = document.querySelector('#print-root .print-desk-class');
    const span = document.getElementById('print-class-name-in-desk');
    if (!wrap || !span) return;
    span.innerHTML = buildDeskTitleInnerHtml();
    const cls = getCurrentClassName() || '';
    const memo = getSelectedHistoryMemoForDesk();
    if (!cls && !memo) {
        span.innerHTML = '';
        span.style.fontSize = '';
        return;
    }
    const maxW = wrap.getBoundingClientRect().width - 6;
    if (maxW <= 0) return;
    const fontFamily = getComputedStyle(span).fontFamily;
    let low = 5;
    let high = 15;
    const fits = px => measureDeskTitleWidth(px, fontFamily) <= maxW;
    if (fits(high)) {
        span.style.fontSize = `${high}px`;
        return;
    }
    for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid;
        else high = mid;
    }
    span.style.fontSize = `${Math.max(4, low)}px`;
}

function fitPrintGridLayout(grid, rows, cols) {
    if (!grid || rows <= 0 || cols <= 0) return;
    const classroom = grid.closest('.print-classroom');
    const desk = classroom ? classroom.querySelector('.print-desk') : null;
    if (!classroom || !desk) return;

    const gridStyle = window.getComputedStyle(grid);
    const gapX = parseFloat(gridStyle.columnGap) || 0;
    const gapY = parseFloat(gridStyle.rowGap) || gapX || 0;

    const classroomRect = classroom.getBoundingClientRect();
    const deskRect = desk.getBoundingClientRect();
    const classStyle = window.getComputedStyle(classroom);
    const availableW = Math.max(50, classroomRect.width - (parseFloat(classStyle.paddingLeft) || 0) - (parseFloat(classStyle.paddingRight) || 0) - 2);
    const availableH = Math.max(50, classroomRect.height - deskRect.height - (parseFloat(classStyle.paddingTop) || 0) - (parseFloat(classStyle.paddingBottom) || 0) - gapY - 2);

    // 行数が多い印刷では席をやや横長にし、左右余白を有効活用する
    const seatHeightRatio = rows >= 7 ? 0.62 : rows >= 6 ? 0.68 : 0.75;

    // 列数/行数に応じて最大サイズを計算
    const maxCellWByWidth = (availableW - (cols - 1) * gapX) / cols;
    let low = 1;
    let high = Math.max(1, maxCellWByWidth);
    for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        const gridH = rows * (mid * seatHeightRatio) + (rows - 1) * gapY;
        if (gridH <= availableH) low = mid;
        else high = mid;
    }

    const cellW = Math.max(1, Math.min(low, maxCellWByWidth));
    const cellH = cellW * seatHeightRatio;
    const gridW = cols * cellW + (cols - 1) * gapX;
    const gridH = rows * cellH + (rows - 1) * gapY;

    grid.style.width = `${gridW}px`;
    grid.style.height = `${gridH}px`;
}

function autoFitPrintText() {
    document.querySelectorAll('.print-seat-content').forEach(el => el.classList.remove('is-fitted'));
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fitAllPrintSeatsSync();
        });
    });
}

/** 同期フィット（印刷ボタン押下時など、即座に確定したいケース用） */
function fitAllPrintSeatsSync() {
    const nRef = computePrintGridNameRefPx();
    const rowSizes = sampleRowSizesByKey('#print-root .print-seat-content');
    const sample = document.querySelector('#print-root .print-seat-content');
    const fontFamily = sample ? getComputedStyle(sample).fontFamily : null;
    document.querySelectorAll('.print-seat-content').forEach(el => {
        fitFixedSeatRows(el, nRef, rowSizes, fontFamily);
        el.classList.add('is-fitted');
    });
}

/** 印刷を実行（フィット未完のまま空白で印刷されないよう、押下時に同期フィット → 印刷） */
function executePrint() {
    if (!document.body.classList.contains('print-mode')) {
        window.print();
        return;
    }
    const grid = document.getElementById('print-seat-grid');
    if (grid) {
        const bounds = getGridBoundaries();
        const visibleCols = Math.max(1, bounds.currMaxC - bounds.currMinC + 1);
        const visibleRows = Math.max(1, bounds.currMaxR - bounds.currMinR + 1);
        fitPrintDeskClassName();
        fitPrintGridLayout(grid, visibleRows, visibleCols);
    }
    fitAllPrintSeatsSync();
    window.print();
}

function updateGridRowsVisibility() {
    const grid = document.getElementById('seat-grid');
    const bounds = getGridBoundaries();
    const visibleCols = Math.max(1, bounds.currMaxC - bounds.currMinC + 1);
    const visibleRows = Math.max(1, bounds.currMaxR - bounds.currMinR + 1);

    grid.style.gridTemplateColumns = `repeat(${visibleCols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${visibleRows}, 1fr)`;
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const seatEl = getSeatElement(i);
        const row = Math.floor(i / NUM_COLS);
        const col = i % NUM_COLS;
        const isInsideBounds = row >= bounds.currMinR && row <= bounds.currMaxR && col >= bounds.currMinC && col <= bounds.currMaxC;

        if (!isInsideBounds) {
            seatEl.style.display = 'none';
            continue;
        }

        seatEl.style.display = 'flex';
        seatEl.style.gridColumn = String(col - bounds.currMinC + 1);
        seatEl.style.gridRow = String(row - bounds.currMinR + 1);
    }
}

// --- UI連携関連 ---
function toggleGenderBorder() {
    const btn = document.getElementById('btn-gender-border');
    const panel = document.getElementById('gender-border-settings');
    if (btn.classList.contains('btn-outline')) {
        btn.classList.replace('btn-outline', 'btn-success');
        btn.innerText = 'ON'; panel.style.display = 'block';
    } else {
        btn.classList.replace('btn-success', 'btn-outline');
        btn.innerText = 'OFF'; panel.style.display = 'none';
    }
    saveAndRender();
}

function saveAndRender() { saveCurrentClassData(); if(currentStudents.length > 0) renderAssignments(); }

function getColorInput(index) {
    return document.getElementById(`color-${index}`);
}

function getColorPalettePanel() {
    return document.getElementById('color-palette-panel');
}

function refreshColorPaletteSwatches() {
    for (let i = 1; i <= 6; i++) {
        const swatch = document.getElementById(`color-swatch-${i}`);
        const input = getColorInput(i);
        if (!swatch || !input) continue;
        swatch.style.backgroundColor = input.value;
        swatch.title = `${i}: ${input.value.toUpperCase()}`;
    }
}

function closeColorPalette() {
    const panel = getColorPalettePanel();
    if (!panel) return;
    panel.style.display = 'none';
    panel.innerHTML = '';
    activeColorPaletteTarget = 0;
}

function applyColorToIndex(index, colorHex) {
    const input = getColorInput(index);
    if (!input) return;
    input.value = colorHex;
    updateColors();
    closeColorPalette();
}

function openColorPalette(index) {
    const panel = getColorPalettePanel();
    const anchor = document.getElementById(`color-swatch-${index}`);
    if (!panel || !anchor) return;
    if (activeColorPaletteTarget === index && panel.style.display === 'grid') {
        closeColorPalette();
        return;
    }
    activeColorPaletteTarget = index;
    panel.innerHTML = COLOR_PALETTE_PRESET.map(color =>
        `<button type="button" class="color-palette-chip" data-color="${color}" style="background:${color};" title="${color.toUpperCase()}"></button>`
    ).join('');
    panel.style.display = 'grid';
    panel.querySelectorAll('.color-palette-chip').forEach(btn => {
        btn.addEventListener('click', () => applyColorToIndex(index, btn.dataset.color));
    });
}

function openNativeColorPicker(index) {
    const input = getColorInput(index);
    if (!input) return;
    closeColorPalette();
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
}

function initColorPaletteUI() {
    refreshColorPaletteSwatches();
    document.addEventListener('click', (e) => {
        const panel = getColorPalettePanel();
        if (!panel || panel.style.display === 'none') return;
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.color-swatch-btn') || target.closest('.color-palette-panel')) return;
        closeColorPalette();
    });
}

function updateColors() {
    for(let i=1; i<=6; i++) document.documentElement.style.setProperty(`--c${i}`, document.getElementById(`color-${i}`).value);
    refreshColorPaletteSwatches();
    saveAndRender();
}

function resetPlacement() {
    if (previewAssignment) {
        previewAssignment = null;
        pendingHistoryMemoOnCommit = null;
        if (previewInactiveSeatsBackup) {
            inactiveSeats = previewInactiveSeatsBackup;
            previewInactiveSeatsBackup = null;
            updateCounters();
        }
        setActionButtons(false, false);
    }
    seatAssignment = new Array(TOTAL_SEATS).fill(null);
    renderAssignments(); showAlert("配置をクリアしました。（空席設定は保持されています）", "info");
}

// --- 名簿管理 ---
function addRowToTable(data = {id:'', name:'', kana:'', gender:'', attr1:'', attr2:'', flags:''}) {
    const tbody = document.querySelector('#students-table tbody'); const tr = document.createElement('tr');
    const editableCells = {};
    ['id', 'name', 'kana', 'gender', 'attr1', 'attr2', 'flags'].forEach(k => {
        const td = document.createElement('td');
        td.contentEditable = "true";
        td.innerText = data[k] || '';
        if (k === 'flags') {
            td.addEventListener('input', () => validateFlagsCell(td));
            td.addEventListener('blur', () => validateFlagsCell(td));
        }
        editableCells[k] = td;
        tr.appendChild(td);
    });
    const opTd = document.createElement('td');
    opTd.className = 'col-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icon-trash';
    btn.setAttribute('aria-label', 'この行を削除');
    btn.title = '削除';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    btn.onclick = () => tr.remove();
    opTd.appendChild(btn);
    tr.appendChild(opTd);
    tbody.appendChild(tr);
    validateFlagsCell(editableCells.flags);
}

function validateFlagsCell(td) {
    if (!td) return true;
    const raw = td.innerText || '';
    const normalizedFlags = raw.replace(/ /g, '').trim();
    if (!normalizedFlags) {
        td.classList.remove('input-error');
        td.removeAttribute('title');
        return true;
    }
    const parsed = parsePersonalRuleConstraints(normalizedFlags);
    if (parsed.errors.length > 0) {
        td.classList.add('input-error');
        td.title = parsed.errors.join(' / ');
        return false;
    }
    td.classList.remove('input-error');
    td.removeAttribute('title');
    return true;
}

function parseRosterTsvRows(text) {
    return text.split('\n').map(line => {
        const columns = line.split('\t').map(x => x.trim());
        return {
            id: columns[0], name: columns[1], kana: columns[2],
            gender: normalizeGender(columns[3]),
            attr1: columns[4], attr2: columns[5], flags: columns[6]
        };
    });
}

function applyParsedRosterRows(rows, mode) {
    const tbody = document.querySelector('#students-table tbody');
    if (!tbody) return;
    if (mode === 'replace') tbody.innerHTML = '';
    rows.forEach(row => addRowToTable(row));
    const ta = document.getElementById('import-tsv');
    if (ta) ta.value = '';
}

function applyTSVToTable() {
    const ta = document.getElementById('import-tsv');
    const text = ta ? ta.value.trim() : '';
    if (!text) return;
    const rows = parseRosterTsvRows(text);
    const tbody = document.querySelector('#students-table tbody');
    const hasExistingRows = !!(tbody && tbody.querySelector('tr'));
    if (!hasExistingRows) {
        applyParsedRosterRows(rows, 'replace');
        return;
    }
    showRosterImportModeConfirm(
        () => applyParsedRosterRows(rows, 'append'),
        () => applyParsedRosterRows(rows, 'replace'),
        () => {}
    );
}

/** 名簿テーブル tbody から生徒配列を組み立てる */
function buildTempStudentsFromRosterTable() {
    const tempStudents = [];
    document.querySelectorAll('#students-table tbody tr').forEach(tr => {
        const tds = tr.querySelectorAll('td[contenteditable="true"]');
        const normalizedGender = normalizeGender(tds[3].innerText);
        if (tds[0].innerText || tds[1].innerText) {
            tempStudents.push({
                id: tds[0].innerText.trim(), name: tds[1].innerText.trim(), kana: tds[2].innerText.trim(),
                gender: normalizedGender, attr1: tds[4].innerText.trim(), attr2: tds[5].innerText.trim(), flags: tds[6].innerText.replace(/ /g, '')
            });
        }
    });
    return tempStudents;
}

/**
 * 名簿テーブル・全体ルールを検証し、問題なければ currentStudents と localStorage に反映。
 * ハードNG時は確認モーダル（OKのみ）。ソフト警告時は確認モーダル（done 必須）。
 * @param {(ok: boolean) => void} [done] 非同期完了時（タブ切替の続行など）
 * @returns {boolean} done 未指定時のみ。警告待ちのときは false。
 */
function commitRosterFromTableToStoredState(done) {
    const tempStudents = buildTempStudentsFromRosterTable();
    const rulesText = document.getElementById('overall-rules') ? document.getElementById('overall-rules').value.trim() : '';
    const v = validateRosterSaveConstraints(tempStudents, rulesText);
    if (!v.ok) {
        showRosterHardValidationModal(v.html, () => { if (done) done(false); });
        return false;
    }
    const soft = checkSoftConstraintsWarning(tempStudents, rulesText);
    if (soft.warnings.length === 0) {
        finishRosterCommitFromTable(tempStudents);
        if (done) done(true);
        return true;
    }
    const onProceed = () => {
        finishRosterCommitFromTable(tempStudents);
        if (done) done(true);
    };
    const onCancel = () => { if (done) done(false); };
    if (done) {
        showSoftValidationConfirm(soft.warnings, onProceed, onCancel);
        return false;
    }
    showSoftValidationConfirm(soft.warnings, onProceed, onCancel);
    return false;
}

// --- 座席クリック・例外選択 ---
function handleSeatClick(index) {
    if (Date.now() < suppressSeatClickUntil) return;
    if (document.body.classList.contains('print-mode')) return;
    if (exceptionMode) {
        if (inactiveSeats.has(index)) return;
        const seatEl = getSeatElement(index);
        if (currentExceptions.has(index)) {
            currentExceptions.delete(index);
            seatEl.className = `seat ${getDefaultSeatGender(index) === '男' ? 'gender-boy' : 'gender-girl'}`;
            // 解除後は元の保護状態を復元
            if (protectedExceptionSeats.has(index)) seatEl.classList.add('protected-exception');
        } else {
            if (getDefaultSeatGender(index) !== targetExceptionGender) {
                // 座席固定で保護されている席は反転禁止
                if (protectedExceptionSeats.has(index)) {
                    flashProtectedSeat(seatEl);
                    return;
                }
                currentExceptions.add(index);
                seatEl.className = `seat ${targetExceptionGender === '男' ? 'gender-boy' : 'gender-girl'}`;
            }
        }
        updateExceptionMessage(); return;
    }

    const seatEl = getSeatElement(index);
    if (inactiveSeats.has(index)) {
        inactiveSeats.delete(index);
        seatEl.classList.remove('inactive');
        const restoreTarget = previewAssignment || seatAssignment;
        if (restoreTarget[index] == null && inactiveSeatBackup.has(index)) {
            restoreTarget[index] = inactiveSeatBackup.get(index);
        }
        inactiveSeatBackup.delete(index);
    } else {
        const target = previewAssignment || seatAssignment;
        const backupStudent = target[index];
        inactiveSeats.add(index);
        seatEl.classList.add('inactive');
        if (backupStudent) {
            inactiveSeatBackup.set(index, backupStudent);
            target[index] = null;
        } else {
            inactiveSeatBackup.delete(index);
        }
    }
    invalidateManualSwapEvalCache();
    updateCounters(); renderAssignments(); saveCurrentClassData();
}

function getSeatLabel(index) { return `${COLS_LABELS[index % NUM_COLS]}${Math.floor(index / NUM_COLS) + 1}`; }
function getIndexFromLabel(label) {
    label = label.toLowerCase();
    const cIdx = COLS_LABELS.indexOf(label.charAt(0)), r = parseInt(label.substring(1));
    return (cIdx === -1 || isNaN(r)) ? -1 : (r - 1) * NUM_COLS + cIdx;
}
function isPair(i, j) { return Math.floor(i / NUM_COLS) === Math.floor(j / NUM_COLS) && Math.floor((i % NUM_COLS) / 2) === Math.floor((j % NUM_COLS) / 2); }
function isOrthogonallyAdjacent(i, j) {
    const r1 = Math.floor(i / NUM_COLS), c1 = i % NUM_COLS;
    const r2 = Math.floor(j / NUM_COLS), c2 = j % NUM_COLS;
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}
function isAdjacentIncludingDiagonal(i, j) {
    if (i === j) return false;
    const r1 = Math.floor(i / NUM_COLS), c1 = i % NUM_COLS;
    const r2 = Math.floor(j / NUM_COLS), c2 = j % NUM_COLS;
    return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}
function getDefaultSeatGender(idx) { return (Math.floor(idx / NUM_COLS) + (idx % NUM_COLS) + checkerboardOffset) % 2 === 0 ? '男' : '女'; }

function parsePlacementItems(rawItems) {
    const items = rawItems.split(',').map(x => x.trim()).filter(Boolean);
    if (items.length === 0) return null;
    const allSeat = items.every(x => /^[a-f][1-7]$/.test(x));
    const allCol = items.every(x => /^[a-f]$/.test(x));
    const allRow = items.every(x => /^[1-7]$/.test(x));
    if (allSeat) return { kind: 'seat', values: items.map(getIndexFromLabel).filter(i => i !== -1) };
    if (allCol) return { kind: 'col', values: items.map(x => COLS_LABELS.indexOf(x)).filter(i => i !== -1) };
    if (allRow) return { kind: 'row', values: items.map(x => parseInt(x, 10) - 1).filter(r => r >= 0 && r < NUM_ROWS) };
    return null;
}

function parsePersonalRuleConstraints(flagsText) {
    const parsed = { seats: [], cols: [], rows: [], hasHardRule: false, errors: [] };
    if (!flagsText) return parsed;
    const normalized = normalizeStr(flagsText);

    let match;
    const atRegex = /@\(([^)]+)\)/g;
    while ((match = atRegex.exec(normalized)) !== null) {
        const placement = parsePlacementItems(match[1]);
        if (!placement) {
            parsed.errors.push(`無効な備考欄記法: @(${match[1]})`);
            continue;
        }
        parsed.hasHardRule = true;
        if (placement.kind === 'seat') parsed.seats.push(...placement.values);
        if (placement.kind === 'col') parsed.cols.push(...placement.values);
        if (placement.kind === 'row') parsed.rows.push(...placement.values);
    }

    const stripped = normalized
        .replace(/@\(([^)]+)\)/g, '')
        .replace(/[\s,;\/]+/g, '');
    if (stripped.length > 0) parsed.errors.push(`無効な備考欄記法: ${flagsText}`);
    return parsed;
}

function parseOverallRulesText(rulesText) {
    const placementRules = [];
    const ngRules = [];
    const errors = [];
    if (!rulesText) return { placementRules, ngRules, errors };
    rulesText.split('\n').forEach((rawLine, idx) => {
        const line = normalizeStr(rawLine.trim());
        if (!line) return;
        let match = line.match(/^@([A-Za-z0-9]+)\(([^)]+)\)$/);
        if (match) {
            const placement = parsePlacementItems(match[2]);
            if (!placement) {
                errors.push(`${idx + 1}行目: @${match[1]}(${match[2]}) の指定が不正です`);
            } else {
                placementRules.push({ prefix: match[1], kind: placement.kind, values: placement.values, rawFlag: line });
            }
            return;
        }
        match = line.match(/^ng\(([^,()]+),([^()]+)\)$/);
        if (match) {
            ngRules.push([match[1].trim(), match[2].trim()]);
            return;
        }
        errors.push(`${idx + 1}行目: 記法エラー (${rawLine.trim()})`);
    });
    return { placementRules, ngRules, errors };
}

// --- 整列アルゴリズム ---
function openSortModal() {
    hideAlert();
    if (!validateForSort()) return;
    const activeCount = TOTAL_SEATS - inactiveSeats.size;
    if (currentStudents.length > activeCount) return showAlert(`エラー：生徒数（${currentStudents.length}）が有効座席（${activeCount}）を上回っています。`);
    document.getElementById('sort-modal-overlay').style.display = 'flex'; updateSortHighlight();
}

function closeSortModal() {
    document.getElementById('sort-modal-overlay').style.display = 'none';
    document.querySelectorAll('.seat').forEach(el => el.classList.remove('start-highlight'));
}

function updateSortHighlight() {
    document.querySelectorAll('.seat').forEach(el => el.classList.remove('start-highlight'));
    const startPos = getCheckedRadioValue('sort-start');
    const targetIdx = startPos === 'left' ? 0 : NUM_COLS - 1;
    const seat = getSeatElement(targetIdx);
    if (seat) seat.classList.add('start-highlight');
}

function validateForSort() {
    if (currentStudents.length === 0) { showAlert('名簿が空です。名簿管理タブから入力してください。'); return false; }
    const idSet = new Set(); const duplicates = []; let hasEmpty = false;
    currentStudents.forEach(s => {
        const id = s.id.trim();
        if (!id) hasEmpty = true;
        else if (idSet.has(id)) { if(!duplicates.includes(id)) duplicates.push(id); } 
        else idSet.add(id);
    });
    if (hasEmpty) { showAlert('エラー：番号が空欄の生徒がいます。名簿を修正してから実行してください。'); return false; }
    if (duplicates.length > 0) { showAlert(`エラー：番号が重複している生徒がいます（${duplicates.join(', ')}）。名簿を修正してください。`); return false; }
    return true;
}

function executeSort() {
    closeSortModal(); hideAlert();
    const startPos = getCheckedRadioValue('sort-start');
    const dir = getCheckedRadioValue('sort-dir');
    const pattern = getCheckedRadioValue('sort-pattern');

    const scanOrder = [];
    if (dir === 'side') {
        for (let r = 0; r < NUM_ROWS; r++) {
            let cols = []; for (let c = 0; c < NUM_COLS; c++) cols.push(c);
            let fromLeft = (startPos === 'left');
            if (pattern === 's' && r % 2 !== 0) fromLeft = !fromLeft;
            if (!fromLeft) cols.reverse();
            cols.forEach(c => scanOrder.push(r * NUM_COLS + c));
        }
    } else {
        let colsToScan = []; for (let c = 0; c < NUM_COLS; c++) colsToScan.push(c);
        if (startPos === 'right') colsToScan.reverse();
        colsToScan.forEach((c, index) => {
            let rows = []; for (let r = 0; r < NUM_ROWS; r++) rows.push(r);
            if (pattern === 's' && index % 2 !== 0) rows.reverse();
            rows.forEach(r => scanOrder.push(r * NUM_COLS + c));
        });
    }

    const validScanOrder = scanOrder.filter(idx => !inactiveSeats.has(idx));
    const sortedStudents = [...currentStudents].sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
    const tempAssign = new Array(TOTAL_SEATS).fill(null);
    for (let i = 0; i < sortedStudents.length; i++) tempAssign[validScanOrder[i]] = sortedStudents[i];

    previewAssignment = tempAssign;
    setActionButtons(true, false);
    showAlert(`整列が完了しました。プレビューを確認し、「座席を確定」を押してください。`, "success");
    renderAssignments();
}

// --- 制約計算関連 ---
function getGridBoundaries() {
    if (!document.body.classList.contains('print-mode')) {
        return { currMinR: 0, currMaxR: NUM_ROWS - 1, currMinC: 0, currMaxC: NUM_COLS - 1 };
    }

    const includeInactiveInPrint = printInactiveMode === 'frame';
    let currMinR = NUM_ROWS - 1, currMaxR = 0, currMinC = NUM_COLS - 1, currMaxC = 0;
    let hasActiveSeat = false;
    for(let i=0; i<TOTAL_SEATS; i++) {
        if (inactiveSeats.has(i) && !includeInactiveInPrint) continue;
        hasActiveSeat = true;
        let r = Math.floor(i/NUM_COLS), c = i%NUM_COLS;
        if(r < currMinR) currMinR = r; if(r > currMaxR) currMaxR = r;
        if(c < currMinC) currMinC = c; if(c > currMaxC) currMaxC = c;
    }
    if (!hasActiveSeat) return { currMinR: 0, currMaxR: 0, currMinC: 0, currMaxC: 0 };
    return { currMinR, currMaxR, currMinC, currMaxC };
}

/** 備考の絶対制約、または全体ルールの席名指し → 前列などの公平化は掛けず、過去ペアのみソフト適用 */
function studentSkipsNonPairFairness(student) {
    const personal = parsePersonalRuleConstraints(student.flags || '');
    if (personal.hasHardRule) return true;
    if (student.appliedOverallRules && student.appliedOverallRules.some(r => r.kind === 'seat')) return true;
    return false;
}

function calcAllowedSeatsForStudent(s, isCheckerboard, bounds) {
    const personal = parsePersonalRuleConstraints(s.flags);
    const specificSeatsP = personal.seats;
    const reqColsP = personal.cols;
    const reqRowsP = personal.rows;
    const hasFixedP = personal.hasHardRule;

    let cands = [];
    for(let i=0; i<TOTAL_SEATS; i++) {
        if(inactiveSeats.has(i)) continue;
        let r = Math.floor(i/NUM_COLS), c = i % NUM_COLS;
        let valid = true;

        if(hasFixedP) {
            let pValid = false;
            if(specificSeatsP.length > 0) { if(specificSeatsP.includes(i)) pValid = true; } 
            else {
                let rowValid = reqRowsP.length === 0 || reqRowsP.includes(r);
                let colValid = reqColsP.length === 0 || reqColsP.includes(c);
                if (rowValid && colValid) pValid = true;
            }
            if(!pValid) valid = false;
        }
        if(valid && s.appliedOverallRules && s.appliedOverallRules.length > 0) {
            const overallValid = s.appliedOverallRules.every(rule => {
                if (rule.kind === 'row') return rule.values.includes(r);
                if (rule.kind === 'col') return rule.values.includes(c);
                if (rule.kind === 'seat') return rule.values.includes(i);
                return true;
            });
            if (!overallValid) valid = false;
        }
        if(isCheckerboard && s.gender && valid) {
            let expGender = getDefaultSeatGender(i);
            if(currentExceptions.has(i)) expGender = expGender === '男' ? '女' : '男';
            if(s.gender !== expGender) valid = false;
        }
        if(valid) cands.push(i);
    }
    return cands;
}

function yieldToBrowser() { return new Promise(resolve => setTimeout(resolve, 0)); }

function shuffleArray(arr) {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
}

function buildAdjacentIncludingDiagonalMap() {
    return Array.from({ length: TOTAL_SEATS }, (_, idx) => {
        const neighbors = [];
        for (let j = 0; j < TOTAL_SEATS; j++) if (isAdjacentIncludingDiagonal(idx, j)) neighbors.push(j);
        return neighbors;
    });
}
function buildPastConstraintMaps(students, historyList) {
    const maps = {
        pastPairsMap: {},
        pastSeatsMap: {},
        pastFront: {},
        pastBack: {},
        pastWindow: {},
        pastCorridor: {}
    };
    students.forEach(student => {
        maps.pastPairsMap[student.id] = [];
        maps.pastSeatsMap[student.id] = [];
        maps.pastFront[student.id] = [];
        maps.pastBack[student.id] = [];
        maps.pastWindow[student.id] = [];
        maps.pastCorridor[student.id] = [];
    });

    historyList.forEach((history, depth) => {
        const historyMinRowByCol = Array(NUM_COLS).fill(NUM_ROWS);
        const historyMaxRowByCol = Array(NUM_COLS).fill(-1);
        let historyMinCol = 5, historyMaxCol = 0;
        for (let i = 0; i < TOTAL_SEATS; i++) {
            if (history.assignment[i]) {
                const row = Math.floor(i / NUM_COLS);
                const col = i % NUM_COLS;
                if (row < historyMinRowByCol[col]) historyMinRowByCol[col] = row;
                if (row > historyMaxRowByCol[col]) historyMaxRowByCol[col] = row;
                if (col < historyMinCol) historyMinCol = col;
                if (col > historyMaxCol) historyMaxCol = col;
            }
        }
        const singleHistCol = historyMinCol === historyMaxCol;
        for (let i = 0; i < TOTAL_SEATS; i++) {
            if (!history.assignment[i]) continue;
            const studentId = history.assignment[i].id;
            // 現在の名簿に存在しない過去の生徒は無視する（名簿変更後の旧履歴に対する防御）
            if (!maps.pastSeatsMap[studentId]) continue;
            maps.pastSeatsMap[studentId].push({ seatIdx: i, depth: depth });
            const row = Math.floor(i / NUM_COLS);
            const col = i % NUM_COLS;
            if (row === historyMinRowByCol[col]) maps.pastFront[studentId].push(depth);
            if (row === historyMaxRowByCol[col]) maps.pastBack[studentId].push(depth);
            if (col === historyMinCol) {
                if (edgeMin === EDGE_WINDOW) maps.pastWindow[studentId].push(depth);
                else maps.pastCorridor[studentId].push(depth);
            }
            if (!singleHistCol && col === historyMaxCol) {
                if (edgeMax === EDGE_WINDOW) maps.pastWindow[studentId].push(depth);
                else maps.pastCorridor[studentId].push(depth);
            }
            for (let j = i + 1; j < TOTAL_SEATS; j++) {
                if (history.assignment[j] && isPair(i, j)) {
                    const partnerId = history.assignment[j].id;
                    if (!maps.pastPairsMap[studentId] || !maps.pastPairsMap[partnerId]) continue;
                    maps.pastPairsMap[studentId].push({ partnerId: partnerId, depth: depth });
                    maps.pastPairsMap[partnerId].push({ partnerId: studentId, depth: depth });
                }
            }
        }
    });
    return maps;
}
/** NG 全体ルールの片側パターン（* のみワイルドカード）を RegExp にする。英字の大文字小文字は無視。 */
function ngWildcardPatternToRegex(pattern) {
    const raw = String(pattern || '');
    const segments = raw.split('*');
    const escaped = segments.map(seg => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${escaped.join('.*')}$`, 'i');
}

function buildNgPairsMap(students, rulesText) {
    const map = {};
    students.forEach(student => { map[student.id] = new Set(); });
    const addNgPair = (idA, idB) => {
        if (!idA || !idB || idA === idB) return;
        if (!map[idA] || !map[idB]) return;
        map[idA].add(idB);
        map[idB].add(idA);
    };
    const globalNgRules = parseOverallRulesText(rulesText).ngRules;
    globalNgRules.forEach(pair => {
        const [left, right] = pair;
        const leftRegex = ngWildcardPatternToRegex(left);
        const rightRegex = ngWildcardPatternToRegex(right);
        students.forEach(a => {
            students.forEach(b => {
                if (a.id === b.id) return;
                const aid = String(a.id ?? '');
                const bid = String(b.id ?? '');
                if ((leftRegex.test(aid) && rightRegex.test(bid)) || (leftRegex.test(bid) && rightRegex.test(aid))) {
                    addNgPair(a.id, b.id);
                }
            });
        });
    });
    return map;
}
function collectActiveSeats() {
    const seats = [];
    for (let i = 0; i < TOTAL_SEATS; i++) if (!inactiveSeats.has(i)) seats.push(i);
    return seats;
}
function prepareStudentSeatConstraints(students, checkerboard, gridBounds) {
    for (const student of students) {
        const allowedSeats = calcAllowedSeatsForStudent(student, checkerboard, gridBounds);
        if (allowedSeats.length === 0) {
            hideProgressModal();
            isCalculating = false;
            showAlert(`【競合エラー】例外席の指定などにより、${student.name}さんが座れる席が0件になりました。`);
            return false;
        }
        student.allowedSeats = allowedSeats;
        student.skipNonPairFairness = studentSkipsNonPairFairness(student);
        student.hasFixed = allowedSeats.length <= 1;
    }
    return true;
}
function createPlacementGuards(students, checkerboard, gridBounds, context) {
    const ready = prepareStudentSeatConstraints(students, checkerboard, gridBounds);
    if (!ready) return null;
    return {
        canPlaceAt: (assignment, student, seatIdx) => {
            if (!student.allowedSeats.includes(seatIdx)) return false;
            for (const nIdx of context.adjacentNeighbors[seatIdx]) {
                const other = assignment[nIdx];
                if (!other) continue;
                if (context.ngPairsMap[student.id].has(other.id)) return false;
            }
            return true;
        }
    };
}
function buildPlacementContext(students, rulesText) {
    return {
        ngPairsMap: buildNgPairsMap(students, rulesText),
        adjacentNeighbors: buildAdjacentIncludingDiagonalMap()
    };
}
function createSwapValidators(isCheckerboard, canPlaceAt) {
    const isSwapHardValid = (arr, idx1, idx2, s1, s2) => {
        if (s2 && !s2.allowedSeats.includes(idx1)) return false;
        if (s1 && !s1.allowedSeats.includes(idx2)) return false;
        if (s2 && !canPlaceAt(arr, s2, idx1)) return false;
        if (s1 && !canPlaceAt(arr, s1, idx2)) return false;
        return true;
    };
    const canSwapByCheckerboardRule = (s1, s2) => {
        if (!isCheckerboard) return true;
        if (!s1 || !s2) return true;
        if (!s1.gender || !s2.gender) return true;
        return s1.gender === s2.gender;
    };
    return { isSwapHardValid, canSwapByCheckerboardRule };
}
function abortShuffleWithMessage(message = "シャッフルを中止しました。", type = "info") {
    hideProgressModal();
    isCalculating = false;
    isShuffleCancelled = false;
    return showAlert(message, type);
}
function handleShuffleUnexpectedError(error) {
    console.error(error);
    hideProgressModal();
    showAlert("予期せぬエラーが発生しました。設定を見直すかリロードしてください。");
    cancelExceptionMode();
    isCalculating = false;
    isShuffleCancelled = false;
}
function finalizeShuffleSuccess(bestAssign, finalScore) {
    previewAssignment = bestAssign;
    setActionButtons(true, true);
    if (finalScore > 0) {
        showAlert(`シャッフル完了。\n絶対制約を守ったうえで、優先ルール違反を最小化しました。詳細は「詳細ログ」を確認してください。`, "warning");
    } else {
        showAlert(`完璧な配置が完了しました。（絶対制約順守 + スコア0）`, "success");
    }
    isCalculating = false;
    isShuffleCancelled = false;
    renderAssignments();
}
function buildScoreContext(bounds, pastMaps) {
    const currMinRByCol = Array(NUM_COLS).fill(-1);
    const currMaxRByCol = Array(NUM_COLS).fill(-1);
    for (let c = 0; c < NUM_COLS; c++) {
        let minR = NUM_ROWS;
        let maxR = -1;
        for (let r = 0; r < NUM_ROWS; r++) {
            const idx = r * NUM_COLS + c;
            if (inactiveSeats.has(idx)) continue;
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
        }
        if (minR <= maxR) {
            currMinRByCol[c] = minR;
            currMaxRByCol[c] = maxR;
        }
    }
    return {
        bounds,
        currMinRByCol,
        currMaxRByCol,
        pastPairsMap: pastMaps.pastPairsMap,
        pastSeatsMap: pastMaps.pastSeatsMap,
        pastFront: pastMaps.pastFront,
        pastBack: pastMaps.pastBack,
        pastWindow: pastMaps.pastWindow,
        pastCorridor: pastMaps.pastCorridor,
        edgeMin, edgeMax,
        fairFB, fairWin, fairCor, fairPair, fairSeat, fairSeatNear,
        softFrontBase, softFrontStep, softBackBase, softBackStep,
        softPairBase, softPairStep,
        softWindowBase, softWindowStep, softCorridorBase, softCorridorStep,
        softSeatBase, softSeatStep
    };
}
function buildShuffleExecutionContext(tempStudents, isCheckerboard, timelineContext) {
    const bounds = getGridBoundaries();
    const pastMaps = buildPastConstraintMaps(tempStudents, histories);
    const scoreContext = buildScoreContext(bounds, pastMaps);
    const placementContext = buildPlacementContext(tempStudents, document.getElementById('overall-rules').value.trim());
    const placementGuards = createPlacementGuards(tempStudents, isCheckerboard, bounds, placementContext);
    if (!placementGuards) return null;
    const canPlaceAt = placementGuards.canPlaceAt;
    const swapValidators = createSwapValidators(isCheckerboard, canPlaceAt);
    const evaluateAssignment = (assignment) => analyzeSoftConstraintsWithContext(assignment, scoreContext);
    const hasWindowEdge = boardHasWindowEdge();
    const hasCorridorEdge = boardHasCorridorEdge();
    const activeSeats = collectActiveSeats();
    const backtrackingContext = {
        activeSeats,
        tempStudents,
        canPlaceAt,
        totalEndDeadline: timelineContext.totalEndDeadline,
        phaseAEnd: timelineContext.phaseAEnd,
        totalStartTime: timelineContext.totalStartTime
    };
    const annealingContext = {
        totalEndDeadline: timelineContext.totalEndDeadline,
        evaluateAssignment,
        isSwapHardValid: swapValidators.isSwapHardValid,
        canSwapByCheckerboardRule: swapValidators.canSwapByCheckerboardRule,
        showProgress: (opts, progress, details) => showProgressModal(opts, progress, details),
        formatProgressDetails: (details) => formatConstraintProgressHtml(details, hasWindowEdge, hasCorridorEdge)
    };
    return { evaluateAssignment, swapValidators, backtrackingContext, annealingContext, hasWindowEdge, hasCorridorEdge };
}
function collectSwappableIndices(assignment) {
    const indices = [];
    for (let i = 0; i < TOTAL_SEATS; i++) {
        if (!inactiveSeats.has(i) && (!assignment[i] || !assignment[i].hasFixed)) indices.push(i);
    }
    return indices;
}
function weightedSoftScore(depth, base, stepPerDepth) {
    return Math.max(0, base - stepPerDepth * depth);
}
function createSoftConstraintDetails() {
    return {
        frontDupRows: [], backDupRows: [], windowDupRows: [], corridorDupRows: [], pastPairStrs: [], pastSeatStrs: [],
        scoreFront: 0, scorePair: 0, scoreBack: 0, scoreWindow: 0, scoreCorridor: 0, scoreSeat: 0
    };
}
function addDupRow(details, key, studentId, pts, scored, displayText) {
    details[key].push({ studentId: studentId, sortScore: pts, scored: scored, displayText: displayText });
}
function buildSoftRuleHints(context) {
    return {
        front: `基準${context.softFrontBase}点・1段階ごとに${context.softFrontStep}点減算`,
        back: `基準${context.softBackBase}点・1段階ごとに${context.softBackStep}点減算`,
        pair: `基準${context.softPairBase}点・1段階ごとに${context.softPairStep}点減算`,
        window: `基準${context.softWindowBase}点・1段階ごとに${context.softWindowStep}点減算`,
        corridor: `基準${context.softCorridorBase}点・1段階ごとに${context.softCorridorStep}点減算`,
        seat: `同じ座席: 基準${context.softSeatBase}点・1段階ごとに${context.softSeatStep}点減算（直近${context.fairSeat}段階の履歴・最大15） / 近傍8マス: 同点の20%（上限${context.fairSeatNear}回）`
    };
}
function analyzeSoftConstraintsWithContext(assignment, context) {
    const details = createSoftConstraintDetails();
    const totalScoreRef = { value: 0 };
    const checkedPairs = new Set();
    const b = context.bounds;
    const singleColBounds = b.currMinC === b.currMaxC;

    const applyEdgePenalty = (stu, pastArr, base, step, fairLim, dupRowsKey, scoreKey, labelJa) => {
        pastArr[stu.id].filter(d => fairLim > 0 && d < fairLim).forEach(d => {
            const pts = weightedSoftScore(d, base, step);
            if (pts <= 0) return;
            const scored = fairLim > 0 && d < fairLim;
            if (scored) {
                totalScoreRef.value += pts;
                details[scoreKey] += pts;
            }
            const dl = depthLabel(d);
            const displayText = scored
                ? `[${stu.id} ${stu.name}] ${labelJa}（${dl} +${pts}点）`
                : `[${stu.id} ${stu.name}] ${labelJa}（${dl}・スコア対象外）`;
            addDupRow(details, dupRowsKey, stu.id, pts, scored, displayText);
        });
    };

    const applyFrontPenalty = (student) => {
        context.pastFront[student.id].filter(d => context.fairFB > 0 && d < context.fairFB).forEach(d => {
            const pts = weightedSoftScore(d, context.softFrontBase, context.softFrontStep);
            if (pts <= 0) return;
            const scored = context.fairFB > 0 && d < context.fairFB;
            if (scored) {
                totalScoreRef.value += pts;
                details.scoreFront += pts;
            }
            const dl = depthLabel(d);
            const displayText = scored
                ? `[${student.id} ${student.name}] 前列側（${dl} +${pts}点）`
                : `[${student.id} ${student.name}] 前列側（${dl}・スコア対象外）`;
            addDupRow(details, 'frontDupRows', student.id, pts, scored, displayText);
        });
    };

    const applyBackPenalty = (student) => {
        context.pastBack[student.id].filter(d => context.fairFB > 0 && d < context.fairFB).forEach(d => {
            const pts = weightedSoftScore(d, context.softBackBase, context.softBackStep);
            if (pts <= 0) return;
            const scored = context.fairFB > 0 && d < context.fairFB;
            if (scored) {
                totalScoreRef.value += pts;
                details.scoreBack += pts;
            }
            const dl = depthLabel(d);
            const displayText = scored
                ? `[${student.id} ${student.name}] 後列側（${dl} +${pts}点）`
                : `[${student.id} ${student.name}] 後列側（${dl}・スコア対象外）`;
            addDupRow(details, 'backDupRows', student.id, pts, scored, displayText);
        });
    };

    const applySeatPenalty = (student, seatIndex) => {
        context.pastSeatsMap[student.id].filter(h => h.depth < context.fairSeat).forEach(h => {
            const basePts = weightedSoftScore(h.depth, context.softSeatBase, context.softSeatStep);
            if (basePts <= 0) return;
            if (h.seatIdx === seatIndex) {
                totalScoreRef.value += basePts;
                details.scoreSeat += basePts;
                details.pastSeatStrs.push(`[${student.id} ${student.name}] 同じ座席（${depthLabel(h.depth)} +${basePts}点）`);
                return;
            }
            if (h.depth >= context.fairSeatNear) return;
            if (!isAdjacentIncludingDiagonal(seatIndex, h.seatIdx)) return;
            const nearPts = Math.round(basePts * PAST_SEAT_NEAR_RATIO);
            if (nearPts <= 0) return;
            totalScoreRef.value += nearPts;
            details.scoreSeat += nearPts;
            details.pastSeatStrs.push(`[${student.id} ${student.name}] 過去座席の近傍8マス（${depthLabel(h.depth)} +${nearPts}点）`);
        });
    };

    const applyPairPenalty = (student, partner) => {
        context.pastPairsMap[student.id].filter(h => h.partnerId === partner.id).forEach(h => {
            if (context.fairPair <= 0 || h.depth >= context.fairPair) return;
            const pts = weightedSoftScore(h.depth, context.softPairBase, context.softPairStep);
            if (pts <= 0) return;
            totalScoreRef.value += pts;
            details.scorePair += pts;
            details.pastPairStrs.push(`該当ペア：[${student.id} ${student.name}] ＆ [${partner.id} ${partner.name}]（${depthLabel(h.depth)} +${pts}点）`);
        });
    };

    for (let i = 0; i < TOTAL_SEATS; i++) {
        if (!assignment[i]) continue;
        const student = assignment[i], row = Math.floor(i / NUM_COLS), col = i % NUM_COLS;

        if (!student.skipNonPairFairness) {
            const colMinR = context.currMinRByCol[col];
            const colMaxR = context.currMaxRByCol[col];
            if (colMinR >= 0 && (row === colMinR || row === colMinR + 1)) applyFrontPenalty(student);
            if (colMaxR >= 0 && (row === colMaxR || row === colMaxR - 1)) applyBackPenalty(student);
            if (col === b.currMinC) {
                if (context.edgeMin === EDGE_WINDOW) {
                    applyEdgePenalty(student, context.pastWindow, context.softWindowBase, context.softWindowStep, context.fairWin, 'windowDupRows', 'scoreWindow', '窓側');
                } else {
                    applyEdgePenalty(student, context.pastCorridor, context.softCorridorBase, context.softCorridorStep, context.fairCor, 'corridorDupRows', 'scoreCorridor', '廊下側');
                }
            }
            if (!singleColBounds && col === b.currMaxC) {
                if (context.edgeMax === EDGE_WINDOW) {
                    applyEdgePenalty(student, context.pastWindow, context.softWindowBase, context.softWindowStep, context.fairWin, 'windowDupRows', 'scoreWindow', '窓側');
                } else {
                    applyEdgePenalty(student, context.pastCorridor, context.softCorridorBase, context.softCorridorStep, context.fairCor, 'corridorDupRows', 'scoreCorridor', '廊下側');
                }
            }
            applySeatPenalty(student, i);
        }

        const pairIdx = i % 2 === 0 ? i + 1 : i - 1;
        if (pairIdx >= 0 && pairIdx < TOTAL_SEATS && assignment[pairIdx]) {
            const partner = assignment[pairIdx];
            const pairKey = student.id < partner.id ? student.id + '_' + partner.id : partner.id + '_' + student.id;
            if (!checkedPairs.has(pairKey)) {
                checkedPairs.add(pairKey);
                applyPairPenalty(student, partner);
            }
        }
    }

    details.totalScore = totalScoreRef.value;
    details.ruleHints = buildSoftRuleHints(context);
    return details;
}
function formatConstraintProgressHtml(details, hasWindowEdge, hasCorridorEdge) {
    const rows = [
        ['前列', details.scoreFront],
        ['後列', details.scoreBack],
        ['過去ペア', details.scorePair]
    ];
    if (hasWindowEdge) rows.push(['窓側', details.scoreWindow]);
    if (hasCorridorEdge) rows.push(['廊下側', details.scoreCorridor]);
    rows.push(['過去座席', details.scoreSeat]);
    let html = '<div class="progress-constraint-rows">';
    for (const [label, n] of rows) {
        const num = Number(n) || 0;
        const resolved = num === 0;
        html += `<div class="progress-constraint-row${resolved ? ' resolved' : ''}">`;
        html += `<span class="progress-con-mark">${resolved ? '✓' : ''}</span>`;
        html += `<span class="progress-con-label">${label}</span>`;
        html += `<span class="progress-con-num">${num}</span>`;
        html += '</div>';
    }
    html += '</div>';
    return html;
}
/** attemptIndex ごとに生徒の試行順を変え、複数の初期解に差を付ける */
async function buildInitialByBacktracking(attemptIndex, context) {
    const assignment = new Array(TOTAL_SEATS).fill(null);
    const availableSeats = new Set(context.activeSeats);
    let seedList = shuffleArray([...context.tempStudents]);
    for (let r = 0; r < attemptIndex; r++) seedList = shuffleArray(seedList);
    const unassigned = seedList;
    let loopCounter = 0;

    async function dfs() {
        if (isShuffleCancelled) return false;
        if (performance.now() > context.totalEndDeadline) return false;
        if (performance.now() > context.phaseAEnd) return false;
        if (unassigned.length === 0) return true;

        let bestIdx = -1;
        let bestDomain = null;
        for (let i = 0; i < unassigned.length; i++) {
            const s = unassigned[i];
            const domain = [];
            for (const seat of s.allowedSeats) {
                if (!availableSeats.has(seat)) continue;
                if (context.canPlaceAt(assignment, s, seat)) domain.push(seat);
            }
            if (bestDomain === null || domain.length < bestDomain.length) {
                bestIdx = i;
                bestDomain = domain;
                if (bestDomain.length <= 1) break;
            }
        }

        if (!bestDomain || bestDomain.length === 0) return false;
        const selected = unassigned.splice(bestIdx, 1)[0];
        const seatsToTry = shuffleArray(bestDomain);

        for (const seatIdx of seatsToTry) {
            assignment[seatIdx] = selected;
            availableSeats.delete(seatIdx);

            let forwardOK = true;
            for (const s of unassigned) {
                let hasCandidate = false;
                for (const seat of s.allowedSeats) {
                    if (!availableSeats.has(seat)) continue;
                    if (context.canPlaceAt(assignment, s, seat)) { hasCandidate = true; break; }
                }
                if (!hasCandidate) { forwardOK = false; break; }
            }

            if (forwardOK && await dfs()) return true;

            assignment[seatIdx] = null;
            availableSeats.add(seatIdx);
        }

        unassigned.splice(bestIdx, 0, selected);
        loopCounter++;
        if (loopCounter % 100 === 0) {
            const progress = Math.min(25, ((performance.now() - context.totalStartTime) / 5000) * 25);
            showProgressModal("初期解を構築中...", progress);
            await yieldToBrowser();
        }
        return false;
    }

    const ok = await dfs();
    return ok ? assignment : null;
}
async function runPhaseAInitialSolutions(maxStarts, timelineContext, backtrackingContext) {
    const initialSolutions = [];
    for (let attempt = 0; attempt < maxStarts; attempt++) {
        if (isShuffleCancelled) return null;
        if (performance.now() >= timelineContext.phaseAEnd || performance.now() >= timelineContext.totalEndDeadline) break;
        const progressA = Math.min(22, ((performance.now() - timelineContext.totalStartTime) / 5000) * 22);
        showProgressModal(`初期解を構築中 (${attempt + 1}/${maxStarts})...`, progressA);
        await yieldToBrowser();
        const sol = await buildInitialByBacktracking(attempt, backtrackingContext);
        if (sol) initialSolutions.push([...sol]);
    }
    return initialSolutions;
}
/**
 * 1本の初期解に対し、[localStart, localEnd) を独立した時間窓として焼きなましを実行。
 * 温度は localStart→localEnd に合わせて減衰する。
 */
async function runPhaseBSimulatedAnnealing(initialAssign, localStart, localEnd, runIdx, runTotal, context) {
    let currentAssign = [...initialAssign];
    let currentScore = context.evaluateAssignment(currentAssign).totalScore;
    let finalScore = currentScore;
    let bestAssign = [...currentAssign];
    const swappableIndicesLocal = collectSwappableIndices(currentAssign);

    let swapTrials = 0, swapImprovements = 0, acceptedWorse = 0, loopCount = 0;

    while (performance.now() < localEnd && performance.now() < context.totalEndDeadline && currentScore > 0) {
        if (isShuffleCancelled) return null;
        if (swappableIndicesLocal.length < 2) break;

        let r1 = Math.floor(Math.random() * swappableIndicesLocal.length);
        let r2 = Math.floor(Math.random() * swappableIndicesLocal.length);
        if (r1 === r2) continue;
        const idx1 = swappableIndicesLocal[r1], idx2 = swappableIndicesLocal[r2];
        const s1 = currentAssign[idx1], s2 = currentAssign[idx2];
        if (!context.canSwapByCheckerboardRule(s1, s2)) continue;

        swapTrials++;
        currentAssign[idx1] = s2;
        currentAssign[idx2] = s1;
        if (!context.isSwapHardValid(currentAssign, idx1, idx2, s1, s2)) {
            currentAssign[idx1] = s1;
            currentAssign[idx2] = s2;
            continue;
        }

        const newScore = context.evaluateAssignment(currentAssign).totalScore;
        const elapsedRatio = Math.max(0, Math.min(1,
            (performance.now() - localStart) / Math.max(1, (localEnd - localStart))
        ));
        const t0 = 1800, t1 = 1;
        const temperature = Math.max(t1, t0 * Math.pow(t1 / t0, elapsedRatio));
        const delta = newScore - currentScore;
        const acceptWorse = delta > 0 && Math.random() < Math.exp(-delta / temperature);

        if (delta <= 0 || acceptWorse) {
            currentScore = newScore;
            if (delta > 0) acceptedWorse++;
            if (newScore < finalScore) {
                finalScore = newScore;
                bestAssign = [...currentAssign];
                swapImprovements++;
            }
        } else {
            currentAssign[idx1] = s1;
            currentAssign[idx2] = s2;
        }

        loopCount++;
        if (loopCount % 3000 === 0) {
            const slotSpan = Math.max(1e-6, localEnd - localStart);
            const withinSlot = Math.max(0, Math.min(1, (performance.now() - localStart) / slotSpan));
            const progress = 25 + Math.min(65, ((runIdx + withinSlot) / runTotal) * 65);
            const detailsNow = context.evaluateAssignment(bestAssign);
            context.showProgress({
                phase: `焼きなまし ${runIdx + 1}/${runTotal}`,
                trials: swapTrials,
                score: finalScore
            }, progress, context.formatProgressDetails(detailsNow));
            await yieldToBrowser();
        }
    }

    return {
        bestAssign,
        finalScore,
        swapTrials,
        swapImprovements,
        acceptedWorse
    };
}
async function runPhaseBMultiStart(initialSolutions, phaseBStart, phaseBHardEnd, annealingContext) {
    let swapTrials = 0, swapImprovements = 0, acceptedWorse = 0;
    const saResults = [];
    const k = initialSolutions.length;
    let timeCursor = phaseBStart;
    for (let i = 0; i < k; i++) {
        if (isShuffleCancelled) return null;
        await yieldToBrowser();
        const remainingRuns = k - i;
        const budgetLeft = phaseBHardEnd - timeCursor;
        if (budgetLeft <= 0) break;
        const thisSlot = budgetLeft / remainingRuns;
        const localStart = timeCursor;
        const localEnd = timeCursor + thisSlot;
        timeCursor = localEnd;

        const res = await runPhaseBSimulatedAnnealing(initialSolutions[i], localStart, localEnd, i, k, annealingContext);
        if (!res) return null;
        saResults.push(res);
        swapTrials += res.swapTrials;
        swapImprovements += res.swapImprovements;
        acceptedWorse += res.acceptedWorse;
    }
    return { saResults, swapTrials, swapImprovements, acceptedWorse, k };
}
async function runPhaseCHillClimb(bestAssign, finalScore, timelineContext, evaluateAssignment, swapValidators, hasWindowEdge, hasCorridorEdge) {
    const swappableIndices = collectSwappableIndices(bestAssign);
    let hillLoop = 0;
    while (performance.now() < timelineContext.totalEndDeadline && finalScore > 0) {
        if (isShuffleCancelled) return null;
        if (swappableIndices.length < 2) break;
        let r1 = Math.floor(Math.random() * swappableIndices.length), r2 = Math.floor(Math.random() * swappableIndices.length);
        if (r1 === r2) continue;
        const idx1 = swappableIndices[r1], idx2 = swappableIndices[r2];
        const s1 = bestAssign[idx1], s2 = bestAssign[idx2];
        if (!swapValidators.canSwapByCheckerboardRule(s1, s2)) continue;
        bestAssign[idx1] = s2; bestAssign[idx2] = s1;
        if (!swapValidators.isSwapHardValid(bestAssign, idx1, idx2, s1, s2)) {
            bestAssign[idx1] = s1; bestAssign[idx2] = s2;
            continue;
        }
        const newScore = evaluateAssignment(bestAssign).totalScore;
        if (newScore < finalScore) {
            finalScore = newScore;
        } else {
            bestAssign[idx1] = s1; bestAssign[idx2] = s2;
        }
        hillLoop++;
        if (hillLoop % 3000 === 0) {
            const detailsNow = evaluateAssignment(bestAssign);
            showProgressModal({ phase: '最終微調整中', score: finalScore }, 95, formatConstraintProgressHtml(detailsNow, hasWindowEdge, hasCorridorEdge));
            await yieldToBrowser();
        }
    }
    return { bestAssign, finalScore };
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildProgressMainInner(textOrOpts) {
    if (typeof textOrOpts === 'string') {
        return `<div class="progress-main">${escapeHtml(textOrOpts).replace(/\n/g, '<br>')}</div>`;
    }
    const phase = escapeHtml(textOrOpts.phase || '');
    let stats = '';
    if (textOrOpts.trials != null || textOrOpts.score != null) {
        stats += '<div class="progress-stats-row">';
        if (textOrOpts.trials != null) {
            const t = Number(textOrOpts.trials);
            const trialsStr = Number.isFinite(t) ? t.toLocaleString() : String(textOrOpts.trials);
            stats += `<div class="progress-stat"><span class="progress-stat-label">試行スワップ</span><div class="progress-stat-value-line"><span class="progress-stat-value">${escapeHtml(trialsStr)}</span><span class="progress-stat-unit">回</span></div></div>`;
        }
        if (textOrOpts.score != null) {
            stats += `<div class="progress-stat"><span class="progress-stat-label">スコア</span><div class="progress-stat-value-line"><span class="progress-stat-value">${escapeHtml(String(textOrOpts.score))}</span><span class="progress-stat-unit">点</span></div></div>`;
        }
        stats += '</div>';
    }
    return `<div class="progress-main progress-main-structured"><div class="progress-phase-title">${phase}</div>${stats}</div>`;
}

function showProgressModal(textOrOpts, percent, detailHtml = null) {
    document.getElementById('progress-modal').style.display = 'flex';
    document.getElementById('progress-bar').style.width = percent + '%';
    const el = document.getElementById('progress-text');
    el.classList.add('progress-text-block');
    const mainInner = buildProgressMainInner(textOrOpts);
    el.innerHTML = detailHtml ? `${mainInner}${detailHtml}` : mainInner;
}
function hideProgressModal() { document.getElementById('progress-modal').style.display = 'none'; }
function cancelShuffleCalculation() { isShuffleCancelled = true; }
function toggleLogDetail(id, btnEl) {
    const el = document.getElementById(id);
    if (!el) return;
    const hidden = getComputedStyle(el).display === 'none';
    el.style.display = hidden ? 'block' : 'none';
    if (btnEl) btnEl.textContent = hidden ? '[ ▲ 詳細 ]' : '[ ▼ 詳細 ]';
}
function closeLogModal() { document.getElementById('log-modal').style.display = 'none'; }

// --- 市松シャッフル: 左上席の性別（オフセット）を選ぶモーダル ---

/**
 * 指定オフセット（0/1）における市松モードでの「候補席0件」となる生徒を列挙する。
 * 副作用なしで動作するよう、checkerboardOffset を一時退避→復元する。
 */
function computeCheckerboardConflictsAt(offset, tempStudents, parsedOverallRules, parsedRuleSet, bounds) {
    const prevOffset = checkerboardOffset;
    checkerboardOffset = offset;
    try {
        const localConflicts = [];
        tempStudents.forEach(s => {
            const personal = parsePersonalRuleConstraints(s.flags);
            if (personal.errors.length > 0) {
                localConflicts.push({ ...s, _parseErrors: personal.errors });
                return;
            }
            s.appliedOverallRules = [];
            parsedOverallRules.forEach(r => { if (s.id.startsWith(r.prefix)) s.appliedOverallRules.push(r); });
            s.appliedGlobalNgRules = parsedRuleSet.ngRules;
            const cands = calcAllowedSeatsForStudent(s, true, bounds);
            if (cands.length === 0) localConflicts.push(s);
        });
        return localConflicts;
    } finally {
        checkerboardOffset = prevOffset;
    }
}

/** モーダル内ミニグリッド（教卓 + 市松配色 + a1バッジ + 空席反映） */
function buildCheckerboardMiniGrid(offset) {
    let html = `<div class="cb-mini-wrap">`;
    html += `<div class="cb-mini-desk">教卓</div>`;
    html += `<div class="cb-mini-grid" style="grid-template-columns: repeat(${NUM_COLS}, 22px); grid-template-rows: repeat(${NUM_ROWS}, 18px);">`;
    html += `<span class="cb-a1-badge" title="左上=a1席（教卓側 左端）">a1</span>`;
    for (let i = 0; i < TOTAL_SEATS; i++) {
        if (inactiveSeats.has(i)) {
            html += `<span class="cb-mini-cell cb-inactive"></span>`;
        } else {
            const g = (Math.floor(i / NUM_COLS) + (i % NUM_COLS) + offset) % 2 === 0 ? '男' : '女';
            html += `<span class="cb-mini-cell ${g === '男' ? 'cb-boy' : 'cb-girl'}"></span>`;
        }
    }
    html += `</div></div>`;
    return html;
}

function renderCheckerboardPatternModal({ ok0, ok1, conflicts0, conflicts1 }) {
    const fmt = (arr) => {
        if (!arr.length) return '';
        const lines = arr.slice(0, 4).map(s =>
            s._parseErrors ? `${s.id} ${s.name}: 備考欄記法エラー`
                           : `${s.id} ${s.name}（${s.gender || '?'}）: 候補席0`
        ).join('<br>');
        return lines + (arr.length > 4 ? `<br>…他 ${arr.length - 4} 名` : '');
    };

    const card = (offset, ok, conflicts) => {
        const labelGender = offset === 0 ? '男子' : '女子';
        const labelColor = offset === 0 ? '青' : '赤';
        const cls = ok ? '' : 'cb-disabled';
        const status = ok
            ? `<div class="cb-status-ok">✓ 配置可能</div>`
            : `<div class="cb-status-ng">⚠ 配置不能<br>${fmt(conflicts)}</div>`;
        const button = ok
            ? `<button class="btn" onclick="selectCheckerboardPattern(${offset})">この枠で実行</button>`
            : `<button class="btn btn-outline" disabled style="cursor:not-allowed;">使用不可</button>`;
        return `
          <div class="cb-option-card ${cls}">
            <div class="cb-option-title">左上=${labelGender}（${labelColor}）</div>
            ${buildCheckerboardMiniGrid(offset)}
            ${status}
            ${button}
          </div>`;
    };

    document.getElementById('checkerboard-pattern-options').innerHTML =
        card(0, ok0, conflicts0) + card(1, ok1, conflicts1);
}

function openCheckerboardPatternModal() {
    if (isCalculating) return;
    guardBothEdgesWindowForShuffle(() => openCheckerboardPatternModalImpl());
}

function openCheckerboardPatternModalImpl() {
    hideAlert();

    if (currentStudents.length === 0) return showAlert('名簿が空です。名簿管理タブから入力してください。');

    // 番号の空欄・重複チェック（prepareShuffle と同等）
    const idSet = new Set(); const dups = []; let hasEmpty = false;
    currentStudents.forEach(s => {
        const id = (s.id || '').trim();
        if (!id) { hasEmpty = true; return; }
        if (idSet.has(id)) { if (!dups.includes(id)) dups.push(id); } else idSet.add(id);
    });
    if (hasEmpty) return showAlert('番号が空欄の生徒がいます。名簿を修正してから実行してください。');
    if (dups.length > 0) return showAlert(`番号が重複している生徒がいます（${dups.join(', ')}）。名簿を修正してください。`);

    const rulesText = document.getElementById('overall-rules').value.trim();
    const parsedRuleSet = parseOverallRulesText(rulesText);
    if (parsedRuleSet.errors.length > 0) {
        return showAlert(`全体ルールの記法エラー：<br>${parsedRuleSet.errors.join('<br>')}`);
    }

    const activeCount = TOTAL_SEATS - inactiveSeats.size;
    const tempStudents = JSON.parse(JSON.stringify(currentStudents));
    if (tempStudents.length > activeCount) {
        return showAlert(`エラー：生徒数（${tempStudents.length}）が有効座席（${activeCount}）を上回っています。`);
    }

    const bounds = getGridBoundaries();
    const conflicts0 = computeCheckerboardConflictsAt(0, tempStudents, parsedRuleSet.placementRules, parsedRuleSet, bounds);
    const conflicts1 = computeCheckerboardConflictsAt(1, tempStudents, parsedRuleSet.placementRules, parsedRuleSet, bounds);
    const ok0 = conflicts0.length === 0;
    const ok1 = conflicts1.length === 0;

    renderCheckerboardPatternModal({ ok0, ok1, conflicts0, conflicts1 });
    document.getElementById('checkerboard-pattern-modal').style.display = 'flex';
}

function selectCheckerboardPattern(offset) {
    document.getElementById('checkerboard-pattern-modal').style.display = 'none';
    checkerboardOffset = offset;
    invalidateManualSwapEvalCache();
    prepareShuffle(true, { skipEdgeGuard: true });
}

function cancelCheckerboardPattern() {
    document.getElementById('checkerboard-pattern-modal').style.display = 'none';
}

/**
 * 例外席選択中に「反転を禁止すべき座席」を算出する。
 * 条件：
 *   - その席が個人備考欄 @(席,...) または全体ルール @prefix(席,...) で名指しされている
 *   - かつ、その指定先の生徒の性別が、現在の市松配色での席のデフォルト性別と一致する
 * （列指定 @(a) や行指定 @(1) は反転しても他席で代替可能なケースが多いので保護対象外）
 */
function computeProtectedExceptionSeats() {
    const result = new Set();
    const rulesEl = document.getElementById('overall-rules');
    const parsedRuleSet = parseOverallRulesText(rulesEl ? rulesEl.value.trim() : '');
    currentStudents.forEach(s => {
        if (!s.gender) return;
        const personal = parsePersonalRuleConstraints(s.flags || '');
        personal.seats.forEach(seatIdx => {
            if (getDefaultSeatGender(seatIdx) === s.gender) result.add(seatIdx);
        });
        parsedRuleSet.placementRules.forEach(rule => {
            if (rule.kind !== 'seat') return;
            if (!s.id || !s.id.startsWith(rule.prefix)) return;
            rule.values.forEach(seatIdx => {
                if (getDefaultSeatGender(seatIdx) === s.gender) result.add(seatIdx);
            });
        });
    });
    return result;
}

/** 保護席をクリックした時の短時間フラッシュ（不可を視覚的に伝える） */
function flashProtectedSeat(seatEl) {
    if (!seatEl) return;
    seatEl.classList.remove('protected-flash');
    void seatEl.offsetWidth; // reflow を強制してアニメーションを再起動
    seatEl.classList.add('protected-flash');
}

// NOTE: 既存挙動を維持するため、以降のロジックは元実装を保っています。
// --- 以降は元の関数をそのまま配置 ---
// (prepareShuffle 〜 hideAlert)

async function prepareShuffle(isCheckerboard, opts = {}) {
    if (isCalculating) return;
    if (!opts.skipEdgeGuard) {
        guardBothEdgesWindowForShuffle(() => { prepareShuffle(isCheckerboard, { skipEdgeGuard: true }); });
        return;
    }
    isShuffleCancelled = false;
    isCalculating = true; hideAlert(); setActionButtons(false, false);
    // 非市松シャッフルではオフセットを使わないため確実に0へ。市松モードは openCheckerboardPatternModal が事前にセット済み。
    if (!isCheckerboard) checkerboardOffset = 0;
    invalidateManualSwapEvalCache();
    if(currentStudents.length === 0) { isCalculating = false; return showAlert('名簿が空です。名簿管理タブから入力してください。'); }

    // 番号の空欄・重複チェック（履歴突き合わせやNG処理が同一IDで衝突するのを防ぐ）
    {
        const idSet = new Set();
        const dups = [];
        let hasEmpty = false;
        currentStudents.forEach(s => {
            const id = (s.id || '').trim();
            if (!id) { hasEmpty = true; return; }
            if (idSet.has(id)) { if (!dups.includes(id)) dups.push(id); }
            else idSet.add(id);
        });
        if (hasEmpty) { isCalculating = false; return showAlert('番号が空欄の生徒がいます。名簿を修正してから実行してください。'); }
        if (dups.length > 0) { isCalculating = false; return showAlert(`番号が重複している生徒がいます（${dups.join(', ')}）。名簿を修正してください。`); }
    }

    cancelExceptionMode(); 
    
    const tempStudents = JSON.parse(JSON.stringify(currentStudents));
    const rulesText = document.getElementById('overall-rules').value.trim();
    const parsedRuleSet = parseOverallRulesText(rulesText);
    const parsedOverallRules = parsedRuleSet.placementRules;
    if (parsedRuleSet.errors.length > 0) {
        isCalculating = false;
        return showAlert(`全体ルールの記法エラー：<br>${parsedRuleSet.errors.join('<br>')}`);
    }

    const activeCount = TOTAL_SEATS - inactiveSeats.size;
    if (tempStudents.length > activeCount) { isCalculating = false; return showAlert(`エラー：生徒数（${tempStudents.length}）が有効座席（${activeCount}）を上回っています。`); }

    const bounds = getGridBoundaries(); let conflicts = [];
    tempStudents.forEach(s => {
        const personal = parsePersonalRuleConstraints(s.flags);
        if (personal.errors.length > 0) {
            conflicts.push({ ...s, _parseErrors: personal.errors });
            return;
        }
        s.appliedOverallRules = [];
        parsedOverallRules.forEach(r => { if (s.id.startsWith(r.prefix)) s.appliedOverallRules.push(r); });
        s.appliedGlobalNgRules = parsedRuleSet.ngRules;
        let cands = calcAllowedSeatsForStudent(s, isCheckerboard, bounds);
        if (cands.length === 0) conflicts.push(s);
    });

    if (conflicts.length > 0) {
        isCalculating = false;
        const parseErrorStudents = conflicts.filter(s => s._parseErrors);
        if (parseErrorStudents.length > 0) {
            const parseDetail = parseErrorStudents.slice(0, 3).map(s => `${s.id} ${s.name}: ${s._parseErrors.join(' / ')}`).join('<br>');
            return showAlert(`備考欄の記法エラー：<br>${parseDetail}`);
        }
        const detail = conflicts.slice(0, 5).map(s => `${s.id} ${s.name}`).join('、');
        showAlert(`配置不能：絶対制約（備考欄/全体ルール/市松）により候補席が0件の生徒がいます。<br>${detail}${conflicts.length > 5 ? ' ほか' : ''}`);
        return;
    }
    if (isCheckerboard) checkGenderBalance(tempStudents); else await executeSmartShuffle(tempStudents, false);
}

function checkGenderBalance(tempStudents) {
    let boys = 0, girls = 0, boySeats = 0, girlSeats = 0;
    tempStudents.forEach(s => { if (s.gender === '男') boys++; if (s.gender === '女') girls++; });
    for (let i = 0; i < TOTAL_SEATS; i++) if (!inactiveSeats.has(i)) { getDefaultSeatGender(i) === '男' ? boySeats++ : girlSeats++; }
    const boyDiff = boys - boySeats, girlDiff = girls - girlSeats;
    if (boyDiff > 0) showExceptionModal('男', boyDiff, tempStudents);
    else if (girlDiff > 0) showExceptionModal('女', girlDiff, tempStudents);
    else executeSmartShuffle(tempStudents, true);
}

function showExceptionModal(targetGender, count, tempStudents) {
    isCalculating = false; exceptionMode = true; document.body.classList.add('exception-mode-active');
    targetExceptionGender = targetGender; requiredExceptions = count; currentExceptions.clear(); pendingStudents = tempStudents;
    const oppColor = targetGender === '男' ? '赤色（女子枠）' : '青色（男子枠）';
    document.getElementById('modal-text').innerHTML = `${targetGender}子が <b>${count}名</b> 多いです。<br><br>盤面の ${oppColor} をクリックし、<br>本来は異性の席ですが ${targetGender}子が座る<br>「例外席」を ${count}つ 選んでください。`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function cancelExceptionMode() {
    // startExceptionSelection() が呼ばれていた場合、座席DOMの子要素（.seat-content / .seat-label）が
    // クリアされた状態のまま残る。renderAssignments は子要素が無い座席をスキップするため、
    // gender-boy/gender-girl クラスが残ってピンク・水色のままになってしまう。
    // ここで initGrid して構造を再生成することで、市松シャッフル前の状態に確実に戻す。
    const wasExceptionPhase = exceptionMode || document.body.classList.contains('exception-mode-active');
    document.getElementById('modal-overlay').style.display = 'none';
    exceptionMode = false;
    document.body.classList.remove('exception-mode-active');
    targetExceptionGender = '';
    requiredExceptions = 0;
    currentExceptions.clear();
    protectedExceptionSeats.clear();
    pendingStudents = null;
    isCalculating = false;
    hideAlert();
    if (wasExceptionPhase) {
        initGrid();
        inactiveSeats.forEach(idx => {
            const el = getSeatElement(idx);
            if (el) el.classList.add('inactive');
        });
    }
    renderAssignments();
}

function startExceptionSelection() {
    document.getElementById('modal-overlay').style.display = 'none';
    protectedExceptionSeats = computeProtectedExceptionSeats();
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const seatElement = getSeatElement(i);
        seatElement.innerHTML = ''; seatElement.className = 'seat';
        if (!inactiveSeats.has(i)) seatElement.classList.add(getDefaultSeatGender(i) === '男' ? 'gender-boy' : 'gender-girl');
        if (protectedExceptionSeats.has(i)) seatElement.classList.add('protected-exception');
    }
    updateExceptionMessage();
}

function updateExceptionMessage() {
    const remain = requiredExceptions - currentExceptions.size;
    if (remain > 0) {
        const lockNote = protectedExceptionSeats.size > 0
            ? `<div style="margin-top:8px; font-size:0.85em; color:#856404;">🔒 マークの席は座席固定指定のため反転できません</div>`
            : '';
        showAlert(`【市松モード例外選択】 盤面をクリックして、例外席をあと ${remain}つ 選んでください。${lockNote}<br><button class="btn btn-outline" style="margin-top:10px; background:#fff;" onclick="cancelExceptionMode()">中止して戻る</button>`, 'info');
    } else {
        exceptionMode = false; document.body.classList.remove('exception-mode-active'); hideAlert();
        initGrid();
        inactiveSeats.forEach(idx => { getSeatElement(idx).classList.add('inactive'); });
        isCalculating = true; executeSmartShuffle(pendingStudents, true);
    }
}

function showLogModal() {
    if(!lastShuffleLog) return;
    const log = lastShuffleLog;
    let html = `
        <div class="log-section">
            <h3>AI最適化プロセス</h3>
            <ul class="log-list">
                <li>・総計算時間：<b>${log.totalTime.toFixed(2)} 秒</b> （最大20秒）</li>
                <li>・初期解生成（MRVバックトラッキング）：<b>${(log.phaseATime || 0).toFixed(2)} 秒</b>${log.multiStartRuns != null ? `（生成 <b>${log.multiStartRuns}</b> 通り）` : ''}</li>
                <li>・焼きなまし探索（SA）：<b>${(log.phaseBTime || 0).toFixed(2)} 秒</b>${log.multiStartRuns != null ? `（エリートは<b>第 ${(log.eliteIndex ?? 0) + 1}</b> 通り）` : ''}</li>
                <li>・最終微調整（山登り）：<b>${(log.phaseCTime || 0).toFixed(2)} 秒</b></li>
                <li>・試行スワップ：<b>${(log.swapTrials || 0).toLocaleString()}回</b>（悪化受理 ${(log.acceptedWorse || 0).toLocaleString()}回）</li>
                <li style="padding-left: 15px; font-weight:bold;">最終スコア：<span style="color:${log.finalScore > 0 ? '#e74c3c' : '#27ae60'}">${log.finalScore} 点</span></li>
            </ul>
        </div>
        <div class="log-section">
            <h3>最終スコア内訳（合計：${log.finalScore} 点）</h3>
    `;
    const parsePenaltyPoint = txt => {
        const m = String(txt).match(/\+(\d+)点/);
        return m ? parseInt(m[1], 10) : 0;
    };
    const parsePenaltyPrimaryId = txt => {
        const m = String(txt).match(/\[([^\]\s]+)\s/);
        return m ? m[1] : '';
    };
    const sortPenaltyStrings = arr => arr.slice().sort((a, b) => {
        const ds = parsePenaltyPoint(b) - parsePenaltyPoint(a);
        if (ds !== 0) return ds;
        return parsePenaltyPrimaryId(a).localeCompare(parsePenaltyPrimaryId(b), undefined, { numeric: true });
    });
    const renderPenalty = (title, ruleHint, arr, idBase, categoryScore) => {
        const sc = Number(categoryScore) || 0;
        const sortedArr = sortPenaltyStrings(arr);
        const penaltyCount = sortedArr.length;
        const status = penaltyCount === 0 ? `<span class="log-success">0件</span>` : `<span class="log-highlight">${penaltyCount}件（合計 ${sc}点）</span>`;
        const icon = penaltyCount === 0 ? 'OK' : (sc >= 500 ? '注意' : '要確認');
        let res = `<div class="penalty-item"><span>${icon} <b>${title}</b> <span style="font-size:0.82em;color:#666;font-weight:normal;">${ruleHint}</span>：${status}</span>`;
        if (penaltyCount > 0) {
            res += `<button class="toggle-btn" onclick="toggleLogDetail('${idBase}', this)">[ ▼ 詳細 ]</button></div>
            <div id="${idBase}" class="penalty-details"><ul>`;
            sortedArr.forEach(item => { res += `<li>${item}</li>`; });
            res += `</ul></div>`;
        } else res += `</div>`;
        return res;
    };
    /** 前列・後列・窓側/廊下側：構造化行（ソート・グレー）または旧ログの文字列配列 */
    const renderRotationDupPenalty = (title, ruleHint, detailsBlock, rowsKey, legacyStrsKey, idBase, categoryScore) => {
        const sc = Number(categoryScore) || 0;
        const raw = detailsBlock[rowsKey];
        const legacy = detailsBlock[legacyStrsKey];
        let items;
        if (raw && raw.length) {
            items = raw.slice();
            items.sort((a, b) => {
                const ds = (b.sortScore || 0) - (a.sortScore || 0);
                if (ds !== 0) return ds;
                return String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true });
            });
        } else if (legacy && legacy.length) {
            items = legacy.map(s => ({ displayText: s, scored: true }));
        } else {
            items = [];
        }
        const hasStructuredRows = !!(raw && raw.length);
        const scoredOnlyCount = hasStructuredRows
            ? items.filter(it => it.scored === true).length
            : items.length;
        const status = scoredOnlyCount === 0 ? `<span class="log-success">0件</span>` : `<span class="log-highlight">${scoredOnlyCount}件（合計 ${sc}点）</span>`;
        const icon = scoredOnlyCount === 0 ? 'OK' : (sc >= 500 ? '注意' : '要確認');
        let res = `<div class="penalty-item"><span>${icon} <b>${title}</b> <span style="font-size:0.82em;color:#666;font-weight:normal;">${ruleHint}</span>：${status}</span>`;
        if (items.length > 0) {
            res += `<button class="toggle-btn" onclick="toggleLogDetail('${idBase}', this)">[ ▼ 詳細 ]</button></div>
            <div id="${idBase}" class="penalty-details"><ul>`;
            items.forEach(item => {
                const text = item.displayText != null ? item.displayText : item;
                const cls = item.scored === false ? ' class="log-line-muted"' : '';
                res += `<li${cls}>${text}</li>`;
            });
            res += `</ul></div>`;
        } else res += `</div>`;
        return res;
    };
    html += `<div style="font-size:0.85em; margin-bottom:10px; color:#555;">NGペア（8近傍隣接）は絶対制約として探索段階で除外しています。</div>`;
    const d = log.details;
    const rh = d.ruleHints || {};
    const hintFront = rh.front || '基準1000点・1段階ごとに100点減算';
    const hintBack = rh.back || '基準1000点・1段階ごとに100点減算';
    const hintPair = rh.pair || '基準330点・1段階ごとに33点減算';
    const hintWin = rh.window || '基準330点・1段階ごとに33点減算';
    const hintCor = rh.corridor || '基準330点・1段階ごとに33点減算';
    const hintSeat = rh.seat || `同じ座席: 基準600点・1段階ごとに15点減算（直近15段階） / 近傍8マス: 同点の20%（上限5回）`;
    html += renderRotationDupPenalty('前列重複（currMinR/currMinR+1）', hintFront, d, 'frontDupRows', 'frontDupStrs', 'log-det-front', d.scoreFront);
    html += renderRotationDupPenalty('後列重複（currMaxR/currMaxR-1）', hintBack, d, 'backDupRows', 'backDupStrs', 'log-det-back', d.scoreBack);
    html += renderPenalty('過去の机ペア重複（a-b/c-d/e-f）', hintPair, d.pastPairStrs, 'log-det-pp', d.scorePair);
    if (boardHasWindowEdge()) {
        html += renderRotationDupPenalty('窓側重複（端列・窓トグル）', hintWin, d, 'windowDupRows', 'legacyWinStrs', 'log-det-win', d.scoreWindow != null ? d.scoreWindow : 0);
    }
    if (boardHasCorridorEdge()) {
        html += renderRotationDupPenalty('廊下側重複（端列・廊下トグル）', hintCor, d, 'corridorDupRows', 'legacyCorStrs', 'log-det-cor', d.scoreCorridor != null ? d.scoreCorridor : 0);
    }
    html += renderPenalty('過去の座席重複', hintSeat, d.pastSeatStrs, 'log-det-ps', d.scoreSeat);
    html += `</div><div class="log-section" style="background:#fff3cd; border-color:#ffeeba;">
        <h3 style="color:#856404; border-bottom-color:#ffeeba;">AIからのレポート</h3>
        <p style="font-size:0.9em; line-height:1.6; color:#555; margin:0;">`;
    if (log.finalScore === 0) html += `<b>最適化が完了しました。</b><br>絶対制約を守ったうえで、優先ルール上のスコア0を達成しています。`;
    else html += `絶対制約はすべて満たしています。<br>優先ルール（前列/後列/机ペア/窓側/廊下側/同席）のトレードオフを最小化した配置です。`;
    html += `</p></div>`;
    document.getElementById('log-content-area').innerHTML = html; document.getElementById('log-modal').style.display = 'flex';
}

// ここから後半は既存ロジック（挙動維持のため変更最小）
// eslint-disable-next-line no-inner-declarations
async function executeSmartShuffle(tempStudents, isCheckerboard) {
    try {
        const totalStartTime = performance.now();
        const maxDurationMs = 20000;
        const timelineContext = {
            totalStartTime,
            phaseAEnd: totalStartTime + 5000,
            phaseBEnd: totalStartTime + 18000,
            totalEndDeadline: totalStartTime + maxDurationMs
        };
        showProgressModal("準備中...", 0);
        await yieldToBrowser();
        if (isShuffleCancelled) {
            return abortShuffleWithMessage();
        }

        // 1) 準備フェーズ（入力同期・評価/配置コンテキスト構築）
        syncSoftScoresFromInputs();
        const executionContext = buildShuffleExecutionContext(tempStudents, isCheckerboard, timelineContext);
        if (!executionContext) return;
        const { evaluateAssignment, swapValidators, backtrackingContext, annealingContext, hasWindowEdge, hasCorridorEdge } = executionContext;

        const MULTI_START_TARGET = 5;
        // 2) 初期解構築フェーズ（複数スタート候補をバックトラックで生成）

        const timelineMetrics = { phaseAStart: performance.now(), phaseAEndActual: 0, tAfterA: 0, phaseBEndActual: 0 };
        const initialSolutions = await runPhaseAInitialSolutions(MULTI_START_TARGET, timelineContext, backtrackingContext);
        if (initialSolutions == null) return abortShuffleWithMessage();
        timelineMetrics.phaseAEndActual = performance.now();

        if (initialSolutions.length === 0) {
            return abortShuffleWithMessage("ハード制約を満たす初期解を生成できませんでした。条件を緩めて再実行してください。", "error");
        }

        timelineMetrics.tAfterA = performance.now();
        const phaseBGlobalEnd = timelineContext.phaseBEnd;
        const phaseBHardEnd = Math.min(phaseBGlobalEnd, timelineContext.totalEndDeadline);

        // 3) 焼きなましフェーズ（各初期解を時間スロットで改善）
        const phaseBRun = await runPhaseBMultiStart(initialSolutions, timelineMetrics.tAfterA, phaseBHardEnd, annealingContext);
        if (!phaseBRun) return abortShuffleWithMessage();
        const { saResults, swapTrials, swapImprovements, acceptedWorse, k } = phaseBRun;

        let eliteIdx = 0;
        let bestAssign;
        let finalScore;
        if (saResults.length === 0) {
            bestAssign = [...initialSolutions[0]];
            finalScore = evaluateAssignment(bestAssign).totalScore;
        } else {
            for (let i = 1; i < saResults.length; i++) {
                if (saResults[i].finalScore < saResults[eliteIdx].finalScore) eliteIdx = i;
            }
            bestAssign = [...saResults[eliteIdx].bestAssign];
            finalScore = saResults[eliteIdx].finalScore;
        }

        timelineMetrics.phaseBEndActual = performance.now();

        // 4) 最終微調整フェーズ（短時間ヒルクライム）
        const phaseCRun = await runPhaseCHillClimb(bestAssign, finalScore, timelineContext, evaluateAssignment, swapValidators, hasWindowEdge, hasCorridorEdge);
        if (!phaseCRun) return abortShuffleWithMessage();
        bestAssign = phaseCRun.bestAssign;
        finalScore = phaseCRun.finalScore;
        const totalEndTime = performance.now();
        hideProgressModal();

        // 5) 結果反映フェーズ（ログ保存・プレビュー反映・通知）
        lastShuffleLog = {
            totalTime: (totalEndTime - timelineContext.totalStartTime) / 1000,
            phaseATime: (timelineMetrics.phaseAEndActual - timelineMetrics.phaseAStart) / 1000,
            phaseBTime: (timelineMetrics.phaseBEndActual - timelineMetrics.tAfterA) / 1000,
            phaseCTime: (totalEndTime - timelineMetrics.phaseBEndActual) / 1000,
            swapTrials: swapTrials,
            swapImprovements: swapImprovements,
            acceptedWorse: acceptedWorse,
            finalScore: finalScore,
            details: evaluateAssignment(bestAssign),
            multiStartRuns: k,
            eliteIndex: saResults.length > 0 ? eliteIdx : 0
        };

        finalizeShuffleSuccess(bestAssign, finalScore);
    } catch (e) {
        handleShuffleUnexpectedError(e);
    }
}

function renderAssignments() {
    if(exceptionMode) return;
    updateGridRowsVisibility();
    const seatGridElement = document.getElementById('seat-grid');
    if (seatGridElement) seatGridElement.classList.toggle('previewing', Boolean(previewAssignment));
    const cfg = getRenderConfig();
    const currentData = cfg.currentData;

    for (let i = 0; i < TOTAL_SEATS; i++) {
        const contentEl = document.getElementById(`seat-content-${i}`);
        const seatEl = getSeatElement(i);
        const labelEl = seatEl.querySelector('.seat-label');
        
        if(!contentEl || !labelEl) continue;
        contentEl.innerHTML = ''; seatEl.style.border = ''; seatEl.style.boxShadow = ''; seatEl.style.outline = ''; seatEl.style.outlineOffset = ''; // inlineスタイルリセット
        
        if (previewAssignment) seatEl.classList.add('uncommitted'); else seatEl.classList.remove('uncommitted');
        seatEl.classList.remove('inactive');
        seatEl.classList.remove('inactive-hidden');
        seatEl.classList.remove('gender-boy', 'gender-girl');
        if (inactiveSeats.has(i)) {
            seatEl.classList.add('inactive');
            seatEl.classList.add('inactive-hidden');
            labelEl.style.display = 'none';
            if (document.body.classList.contains('print-mode')) {
                seatEl.style.display = 'none';
            } else {
                seatEl.style.display = 'flex';
            }
            continue;
        }

        const student = currentData[i];
        if (student) {
            const borderStyle = getGenderBorderStyle(student, cfg, false);
            if (borderStyle && borderStyle.border) seatEl.style.border = borderStyle.border;

            labelEl.style.display = 'none';
            contentEl.innerHTML = buildSeatContentHtml(student, cfg, false);
        } else {
            labelEl.style.display = 'block';
        }
    }
    autoFitText();
    if (document.body.classList.contains('print-mode')) renderPrintLayout();
}

function autoFitText() {
    document.querySelectorAll('.seat-content').forEach(el => el.classList.remove('is-fitted'));
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const nRef = computeMainGridNameRefPx();
            const rowSizes = sampleRowSizesByKey('#seat-grid .seat-content');
            const sample = document.querySelector('#seat-grid .seat-content');
            const fontFamily = sample ? getComputedStyle(sample).fontFamily : null;
            document.querySelectorAll('.seat-content').forEach(el => {
                fitFixedSeatRows(el, nRef, rowSizes, fontFamily);
                el.classList.add('is-fitted');
            });
        });
    });
}

function commitSeats() {
    if(!previewAssignment) return;
    invalidateManualSwapEvalCache();
    seatAssignment = [...previewAssignment]; previewAssignment = null;
    const memo = pendingHistoryMemoOnCommit || '';
    pendingHistoryMemoOnCommit = null;
    previewInactiveSeatsBackup = null;
    setActionButtons(false, false);
    histories.unshift({
        date: new Date().toLocaleString(),
        assignment: [...seatAssignment],
        memo,
        inactiveSeats: Array.from(inactiveSeats)
    });
    if(histories.length > 20) histories.pop();
    saveCurrentClassData(); updateHistorySelect(); renderAssignments(); showAlert("座席を確定し、履歴に保存しました。", "success");
}

function cancelPreview() {
    if (!previewAssignment) return;
    previewAssignment = null;
    pendingHistoryMemoOnCommit = null;
    if (previewInactiveSeatsBackup) {
        inactiveSeats = previewInactiveSeatsBackup;
        previewInactiveSeatsBackup = null;
        updateCounters();
    }
    setActionButtons(false, false);
    renderAssignments();
    showAlert("未確定の変更をキャンセルしました。", "info");
}

/** 選択した履歴に保存されている「その時点の空席」と同一視（無ければ空セット＝全席有効として解釈） */
function getInactiveSetForHistoryEntry(entry) {
    if (entry && Array.isArray(entry.inactiveSeats)) return new Set(entry.inactiveSeats.map(Number));
    return new Set();
}

/** 座席表を 7x6 の TSV 文字列にする（1席=1セル、値は番号下2桁）。 */
function buildSeatLastTwoDigitsGridTsv(assignment, inactiveSet) {
    const rows = [];
    // 教員視点固定（教卓が下）でコピーするため、後列→前列の順で出力
    for (let r = NUM_ROWS - 1; r >= 0; r--) {
        const rowCells = [];
        for (let c = 0; c < NUM_COLS; c++) {
            const i = r * NUM_COLS + c;
            if (inactiveSet.has(i)) {
                rowCells.push('');
                continue;
            }
            const st = assignment[i];
            const id = st && st.id != null ? String(st.id).trim() : '';
            if (!id) {
                rowCells.push('');
                continue;
            }
            rowCells.push(id.length <= 2 ? id.padStart(2, '0') : id.slice(-2));
        }
        rows.push(rowCells.join('\t'));
    }
    return rows.join('\n');
}

function getSelectedHistoryEntry() {
    const sel = document.getElementById('history-select');
    if (!sel || sel.value === '') return null;
    const idx = parseInt(sel.value, 10);
    if (Number.isNaN(idx) || !histories[idx]) return null;
    return histories[idx];
}

/** 番号下2桁出力：履歴が選べればそれを使用。無ければ現在の盤面（確定 or プレビュー） */
function getTailExportSource() {
    const h = getSelectedHistoryEntry();
    if (h && Array.isArray(h.assignment) && h.assignment.length >= TOTAL_SEATS) {
        return {
            assignment: h.assignment,
            inactiveSet: getInactiveSetForHistoryEntry(h),
            memo: (h.memo || '').trim(),
            sourceLabel: '選択した履歴'
        };
    }
    const assignment = previewAssignment || seatAssignment;
    if (!Array.isArray(assignment) || assignment.length < TOTAL_SEATS) return null;
    const inactiveSet = inactiveSeats instanceof Set ? inactiveSeats : new Set(Array.isArray(inactiveSeats) ? inactiveSeats : []);
    return {
        assignment,
        inactiveSet,
        memo: '',
        sourceLabel: previewAssignment ? '現在のプレビュー盤面' : '現在の確定盤面'
    };
}

function copyTextToClipboardSafe(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

function exportHistoryLastTwoDigitsToClipboard() {
    const src = getTailExportSource();
    if (!src) {
        showAlert('出力できる配置がありません。座席に生徒がいる状態にするか、履歴を選択してください。', 'warning');
        return;
    }
    const text = buildSeatLastTwoDigitsGridTsv(src.assignment, src.inactiveSet);
    copyTextToClipboardSafe(text).then(
        () => showAlert(`クリップボードにコピーしました（${src.sourceLabel}・7x6席表）。Excel にそのまま貼り付けできます。`, 'success'),
        () => showAlert('コピーに失敗しました。ブラウザの権限を確認してください。', 'error')
    );
}

// --- Excelインポート ---
const EXCEL_IMPORT_MEMO = 'Excel取込';
let excelImportState = null;
let excelImportEscListener = null;
/** インポートプレビュー時の空席設定復元用（キャンセル時） */
let previewInactiveSeatsBackup = null;
/** commitSeats 時に履歴メモへ使う（Excelインポート後プレビュー時） */
let pendingHistoryMemoOnCommit = null;

function resetExcelImportState() {
    excelImportState = {
        step: 1,
        rawGrid: [],
        resolved: [],
        rows: 0,
        cols: 0,
        startR: 0,
        startC: 0
    };
}

/** Excel貼り付け行の左右端の空セル（末尾タブ等）を除く */
function trimEmptyEdgeCells(row) {
    const r = [...row];
    while (r.length > 0 && !String(r[0] ?? '').trim()) r.shift();
    while (r.length > 0 && !String(r[r.length - 1] ?? '').trim()) r.pop();
    return r;
}

function parseExcelSeatTsv(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return { rows: 0, cols: 0, grid: [] };
    const lines = trimmed.split(/\r?\n/).map(line => {
        const cells = line.includes('\t')
            ? line.split('\t').map(cell => cell.trim())
            : line.trim().split(/\s+/).map(cell => cell.trim());
        return trimEmptyEdgeCells(cells);
    });
    while (lines.length > 0 && lines[lines.length - 1].every(cell => !String(cell ?? '').trim())) lines.pop();
    const rows = lines.length;
    const cols = rows ? Math.max(...lines.map(row => row.length)) : 0;
    return { rows, cols, grid: lines };
}

/** インポート用ミニグリッドの表示行（上=後列 r=6、下=前列 r=0＝教卓側。本番 seat-grid の scaleY(-1) と同じ見え方） */
function excelImportVisualRowToDataR(visualRow) {
    return NUM_ROWS - 1 - visualRow;
}

function resolveRosterStudentForImportCell(raw, students) {
    const v = String(raw ?? '').trim();
    if (!v) return { ok: true, student: null };
    const exact = students.filter(s => (s.id || '').trim() === v);
    if (exact.length === 1) return { ok: true, student: exact[0] };
    if (exact.length > 1) return { ok: false };
    const tail = /^\d+$/.test(v) ? v.padStart(2, '0') : v.slice(-2);
    const byTail = students.filter(s => {
        const id = (s.id || '').trim();
        return id.length >= 2 && id.slice(-2) === tail;
    });
    if (byTail.length === 1) return { ok: true, student: byTail[0] };
    return { ok: false };
}

function validateExcelImportStep1(grid, rows, cols, students) {
    if (rows === 0 || cols === 0) {
        return { ok: false, error: '座席表のデータを貼り付けてください。' };
    }
    if (cols > NUM_COLS || rows > NUM_ROWS) {
        return { ok: false, error: '教室の最大サイズ（横6×縦7）を超えています' };
    }
    const seen = new Set();
    for (let er = 0; er < rows; er++) {
        for (let ec = 0; ec < cols; ec++) {
            const cell = (grid[er][ec] ?? '').trim();
            if (!cell) continue;
            if (seen.has(cell)) {
                return { ok: false, error: '表内に重複する番号が含まれています' };
            }
            seen.add(cell);
        }
    }
    if (!students.length) {
        return { ok: false, error: '名簿が空です。名簿管理タブで生徒を登録してください。' };
    }
    const resolved = [];
    const badValues = [];
    let studentCount = 0;
    let emptyInTable = 0;
    for (let er = 0; er < rows; er++) {
        resolved[er] = [];
        for (let ec = 0; ec < cols; ec++) {
            const raw = grid[er][ec] ?? '';
            const cellTrim = String(raw).trim();
            const match = resolveRosterStudentForImportCell(raw, students);
            if (!match.ok) {
                if (cellTrim && !badValues.includes(cellTrim)) badValues.push(cellTrim);
            } else {
                resolved[er][ec] = match.student;
                if (match.student) studentCount++;
                else if (!cellTrim) emptyInTable++;
            }
        }
    }
    if (badValues.length) {
        const list = badValues.slice(0, 12).join(', ');
        const suffix = badValues.length > 12 ? ' ほか' : '';
        return {
            ok: false,
            error: `名簿と一致しない、または複数該当する番号があります: ${list}${suffix}`
        };
    }
    const matchedIds = new Set();
    for (let er = 0; er < rows; er++) {
        for (let ec = 0; ec < cols; ec++) {
            const st = resolved[er][ec];
            if (st && (st.id || '').trim()) matchedIds.add((st.id || '').trim());
        }
    }
    const missingIds = [];
    for (const s of students) {
        const id = (s.id || '').trim();
        if (!id) continue;
        if (!matchedIds.has(id)) missingIds.push(id);
    }
    if (missingIds.length) {
        const list = missingIds.slice(0, 12).join(', ');
        const suffix = missingIds.length > 12 ? ' ほか' : '';
        return {
            ok: false,
            error: `選択クラスの名簿のうち、貼り付けた表に含まれていない番号があります: ${list}${suffix}`
        };
    }
    return { ok: true, resolved, studentCount, emptyInTable };
}

function setExcelImportStep1NextEnabled(enabled) {
    const nextBtn = document.getElementById('excel-import-step1-next');
    if (!nextBtn) return;
    nextBtn.disabled = !enabled;
}

function isValidExcelImportAnchor(sr, sc, R, C) {
    return sr >= 0 && sc >= 0 && sr + R <= NUM_ROWS && sc + C <= NUM_COLS;
}

function setExcelImportStep(step) {
    if (excelImportState) excelImportState.step = step;
    [1, 2, 3].forEach(n => {
        const el = document.getElementById(`excel-import-step-${n}`);
        if (el) el.style.display = n === step ? 'block' : 'none';
    });
}

function showExcelImportModal() {
    const modal = document.getElementById('excel-import-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    if (!excelImportEscListener) {
        excelImportEscListener = e => {
            if (e.key === 'Escape' || e.key === 'Esc') cancelExcelImportModal();
        };
        document.addEventListener('keydown', excelImportEscListener);
    }
}

function closeExcelImportModal() {
    const modal = document.getElementById('excel-import-modal');
    if (modal) modal.style.display = 'none';
    excelImportState = null;
    if (excelImportEscListener) {
        document.removeEventListener('keydown', excelImportEscListener);
        excelImportEscListener = null;
    }
}

function cancelExcelImportModal() {
    closeExcelImportModal();
}

function openExcelImportModal() {
    hideAlert();
    resetExcelImportState();
    const ta = document.getElementById('excel-import-tsv');
    if (ta) ta.value = '';
    setExcelImportStep(1);
    runExcelImportStep1Parse();
    showExcelImportModal();
}

function runExcelImportStep1Parse() {
    const ta = document.getElementById('excel-import-tsv');
    const errEl = document.getElementById('excel-import-error');
    const sumEl = document.getElementById('excel-import-summary');
    const nextBtn = document.getElementById('excel-import-step1-next');
    if (!ta || !errEl || !sumEl || !nextBtn || !excelImportState) return;

    const { rows, cols, grid } = parseExcelSeatTsv(ta.value);
    excelImportState.rawGrid = grid;
    excelImportState.rows = rows;
    excelImportState.cols = cols;

    const result = validateExcelImportStep1(grid, rows, cols, currentStudents);
    if (!result.ok) {
        errEl.textContent = result.error;
        errEl.style.display = 'block';
        sumEl.style.display = 'none';
        setExcelImportStep1NextEnabled(false);
        excelImportState.resolved = [];
        return;
    }

    excelImportState.resolved = result.resolved;
    errEl.style.display = 'none';
    sumEl.textContent = `${cols}列 × ${rows}行の表を認識しました（生徒${result.studentCount}名、空席${result.emptyInTable}マス）`;
    sumEl.style.display = 'block';
    setExcelImportStep1NextEnabled(true);
}

function goExcelImportStep1() {
    if (!excelImportState) return;
    setExcelImportStep(1);
    runExcelImportStep1Parse();
}

function goExcelImportStep2() {
    if (!excelImportState || !excelImportState.resolved.length) return;
    const nextBtn = document.getElementById('excel-import-step1-next');
    if (nextBtn && nextBtn.disabled) return;
    setExcelImportStep(2);
    renderExcelImportAnchorGrid();
}

function renderExcelImportAnchorGrid() {
    const host = document.getElementById('excel-import-anchor-grid');
    if (!host || !excelImportState) return;
    const { rows: R, cols: C } = excelImportState;
    let html = '<div class="excel-import-mini-wrap">';
    html += `<div class="excel-import-mini-grid" style="grid-template-columns: repeat(${NUM_COLS}, 28px);">`;
    for (let vr = 0; vr < NUM_ROWS; vr++) {
        const r = excelImportVisualRowToDataR(vr);
        for (let c = 0; c < NUM_COLS; c++) {
            const ok = isValidExcelImportAnchor(r, c, R, C);
            const cls = ok
                ? 'excel-import-cell excel-import-cell--pickable'
                : 'excel-import-cell excel-import-cell--disabled';
            const disabled = ok ? '' : ' disabled';
            const click = ok ? ` onclick="onExcelImportAnchorPick(${r},${c})"` : '';
            const a1Mark = r === 0 && c === 0 ? ' excel-import-cell--a1' : '';
            html += `<button type="button" class="${cls}${a1Mark}"${disabled}${click} title="${getSeatLabel(r * NUM_COLS + c)}"></button>`;
        }
    }
    html += '</div>';
    html += '<div class="excel-import-mini-desk">教卓</div>';
    html += '<p class="excel-import-note">※エクセルの最下行（例: 1,2,3…）を、教卓直上行の左端（a1付近）に合わせてクリックしてください</p>';
    html += '</div>';
    host.innerHTML = html;
}

function onExcelImportAnchorPick(sr, sc) {
    if (!excelImportState) return;
    const { rows: R, cols: C } = excelImportState;
    if (!isValidExcelImportAnchor(sr, sc, R, C)) return;
    excelImportState.startR = sr;
    excelImportState.startC = sc;
    goExcelImportStep3();
}

function goExcelImportStep2FromPreview() {
    if (!excelImportState) return;
    setExcelImportStep(2);
    renderExcelImportAnchorGrid();
}

function getExcelImportMappedCell(er, ec) {
    const { rows: R, cols: C, startR, startC } = excelImportState;
    if (er < 0 || ec < 0 || er >= R || ec >= C) return null;
    const r = startR + (R - 1 - er);
    const c = startC + ec;
    return { r, c, idx: r * NUM_COLS + c, student: excelImportState.resolved[er][ec], inTable: true };
}

function getExcelImportPreviewAtSeat(idx) {
    const { rows: R, cols: C } = excelImportState;
    for (let er = 0; er < R; er++) {
        for (let ec = 0; ec < C; ec++) {
            const m = getExcelImportMappedCell(er, ec);
            if (m && m.idx === idx) return m;
        }
    }
    return { inTable: false, student: null };
}

function renderExcelImportPreviewGrid() {
    const host = document.getElementById('excel-import-preview-grid');
    if (!host || !excelImportState) return;
    let html = '<div class="excel-import-mini-wrap">';
    html += `<div class="excel-import-mini-grid" style="grid-template-columns: repeat(${NUM_COLS}, 28px);">`;
    for (let vr = 0; vr < NUM_ROWS; vr++) {
        const r = excelImportVisualRowToDataR(vr);
        for (let c = 0; c < NUM_COLS; c++) {
            const i = r * NUM_COLS + c;
            const info = getExcelImportPreviewAtSeat(i);
            let cls = 'excel-import-cell';
            let label = '';
            if (!info.inTable) {
                cls += ' excel-import-cell--preview-outside';
                label = '—';
            } else if (info.student) {
                cls += ' excel-import-cell--preview-student';
                label = escapeHtml((info.student.id || '').trim());
            } else {
                cls += ' excel-import-cell--preview-empty';
                label = '空';
            }
            html += `<span class="${cls}" title="${escapeHtml(getSeatLabel(i))}">${label}</span>`;
        }
    }
    html += '</div><div class="excel-import-mini-desk">教卓</div></div>';
    host.innerHTML = html;
}

function goExcelImportStep3() {
    if (!excelImportState) return;
    setExcelImportStep(3);
    renderExcelImportPreviewGrid();
}

function buildAssignmentFromExcelImport(state) {
    const { rows: R, cols: C, resolved, startR, startC } = state;
    const assignment = new Array(TOTAL_SEATS).fill(null);
    const inactive = new Set();
    for (let i = 0; i < TOTAL_SEATS; i++) inactive.add(i);
    for (let er = 0; er < R; er++) {
        for (let ec = 0; ec < C; ec++) {
            const r = startR + (R - 1 - er);
            const c = startC + ec;
            const idx = r * NUM_COLS + c;
            const st = resolved[er][ec];
            if (st) {
                inactive.delete(idx);
                assignment[idx] = st;
            }
            // 表の長方形内で番号が空のマスは inactive のまま（空席設定）
        }
    }
    return { assignment, inactiveSeats: inactive };
}

function confirmExcelImport() {
    if (!excelImportState || !excelImportState.resolved.length) return;
    const { assignment, inactiveSeats: inactive } = buildAssignmentFromExcelImport(excelImportState);
    previewInactiveSeatsBackup = new Set(inactiveSeats);
    inactiveSeats = inactive;
    previewAssignment = assignment;
    pendingHistoryMemoOnCommit = EXCEL_IMPORT_MEMO;
    setActionButtons(true, false);
    closeExcelImportModal();
    updateCounters();
    renderAssignments();
    showAlert('インポート内容を盤面に反映しました。メイン画面の「座席を確定」で履歴に保存してください。', 'success');
}

// --- D&D（手動スワップ・事前確認） ---
let draggedIdx = null;
let manualSwapEvalCache = null;
let manualSwapEvalCacheKeyStored = '';
let swapConfirmProceedCallback = null;
let swapConfirmCancelCallback = null;
let swapConfirmEscListener = null;

function invalidateManualSwapEvalCache() {
    manualSwapEvalCache = null;
    manualSwapEvalCacheKeyStored = '';
}

function manualSwapCacheKey() {
    const rulesEl = document.getElementById('overall-rules');
    const rules = rulesEl ? rulesEl.value : '';
    return `${currentStudents.length}|${inactiveSeats.size}|${histories.length}|${checkerboardOffset}|${rules}`;
}

function prepareStudentSeatConstraintsSilent(students, checkerboard, gridBounds) {
    for (const student of students) {
        const allowedSeats = calcAllowedSeatsForStudent(student, checkerboard, gridBounds);
        if (allowedSeats.length === 0) return false;
        student.allowedSeats = allowedSeats;
        student.skipNonPairFairness = studentSkipsNonPairFairness(student);
        student.hasFixed = allowedSeats.length <= 1;
    }
    return true;
}

function buildManualSwapEvalContext() {
    const key = manualSwapCacheKey();
    if (manualSwapEvalCache && manualSwapEvalCacheKeyStored === key) return manualSwapEvalCache;

    const students = JSON.parse(JSON.stringify(currentStudents));
    const rulesEl = document.getElementById('overall-rules');
    const rulesText = rulesEl ? rulesEl.value.trim() : '';
    const parsedRuleSet = parseOverallRulesText(rulesText);
    assignPlacementRulesToStudents(students, parsedRuleSet);
    const bounds = getGridBoundaries();
    const isCheckerboard = checkerboardOffset !== 0;
    if (!prepareStudentSeatConstraintsSilent(students, isCheckerboard, bounds)) return null;

    const preparedById = new Map(students.map(s => [s.id, s]));
    const placementContext = buildPlacementContext(students, rulesText);
    const canPlaceAt = (assignment, student, seatIdx) => {
        const prep = preparedById.get(student.id);
        if (!prep || !prep.allowedSeats.includes(seatIdx)) return false;
        for (const nIdx of placementContext.adjacentNeighbors[seatIdx]) {
            const other = assignment[nIdx];
            if (!other) continue;
            if (placementContext.ngPairsMap[student.id].has(other.id)) return false;
        }
        return true;
    };
    const swapValidators = createSwapValidators(isCheckerboard, canPlaceAt);
    const pastMaps = buildPastConstraintMaps(students, histories);
    const scoreContext = buildScoreContext(bounds, pastMaps);
    const evaluateAssignment = (a) => analyzeSoftConstraintsWithContext(a, scoreContext);

    manualSwapEvalCache = {
        swapValidators,
        evaluateAssignment,
        preparedById,
        placementContext,
        canPlaceAt,
        isCheckerboard
    };
    manualSwapEvalCacheKeyStored = key;
    return manualSwapEvalCache;
}

function formatSwapStudentBrief(student) {
    if (!student) return '（不明）';
    const id = (student.id || '').trim();
    const name = (student.name || '').trim();
    if (id && name) return `${id} ${name}`;
    return id || name || '（不明）';
}

function collectNgAdjacencyViolationsForSeat(assignment, student, seatIdx, placementContext) {
    const msgs = [];
    const ngSet = placementContext.ngPairsMap[student.id];
    if (!ngSet || ngSet.size === 0) return msgs;
    const seen = new Set();
    for (const nIdx of placementContext.adjacentNeighbors[seatIdx]) {
        const other = assignment[nIdx];
        if (!other || !ngSet.has(other.id)) continue;
        const key = [student.id, other.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        msgs.push(
            `${formatSwapStudentBrief(student)} と ${formatSwapStudentBrief(other)} が ${getSeatLabel(seatIdx)}・${getSeatLabel(nIdx)} で隣接します（NG指定）`
        );
    }
    return msgs;
}

function collectSwapHardViolations(assignment, idx1, idx2, s1, s2, ctx) {
    const msgs = [];
    const swapped = assignment.slice();
    const t = swapped[idx1];
    swapped[idx1] = swapped[idx2];
    swapped[idx2] = t;

    if (s2 && !s2.allowedSeats.includes(idx1)) {
        const hint = s2.hasFixed ? '固定席' : '席指定';
        msgs.push(`${formatSwapStudentBrief(s2)} は ${getSeatLabel(idx1)} 席に座れません（${hint}）`);
    }
    if (s1 && !s1.allowedSeats.includes(idx2)) {
        const hint = s1.hasFixed ? '固定席' : '席指定';
        msgs.push(`${formatSwapStudentBrief(s1)} は ${getSeatLabel(idx2)} 席に座れません（${hint}）`);
    }

    if (s2 && s2.allowedSeats.includes(idx1) && !ctx.canPlaceAt(swapped, s2, idx1)) {
        msgs.push(...collectNgAdjacencyViolationsForSeat(swapped, s2, idx1, ctx.placementContext));
    }
    if (s1 && s1.allowedSeats.includes(idx2) && !ctx.canPlaceAt(swapped, s1, idx2)) {
        msgs.push(...collectNgAdjacencyViolationsForSeat(swapped, s1, idx2, ctx.placementContext));
    }

    if (ctx.isCheckerboard && s1 && s2 && s1.gender && s2.gender && s1.gender !== s2.gender) {
        msgs.push(
            `${formatSwapStudentBrief(s1)}（${s1.gender}）と ${formatSwapStudentBrief(s2)}（${s2.gender}）は市松模様のため入れ替えできません`
        );
    }

    return msgs;
}

function swapEvalStudent(student, preparedById) {
    if (!student) return null;
    const prep = preparedById.get(student.id);
    if (!prep) return student;
    return Object.assign({}, student, {
        allowedSeats: prep.allowedSeats,
        hasFixed: prep.hasFixed,
        skipNonPairFairness: prep.skipNonPairFairness
    });
}

const SWAP_SCORE_CATEGORY_SPECS = [
    { scoreKey: 'scoreFront', label: '前列重複', rowsKey: 'frontDupRows' },
    { scoreKey: 'scoreBack', label: '後列重複', rowsKey: 'backDupRows' },
    { scoreKey: 'scorePair', label: '過去ペア', strKey: 'pastPairStrs' },
    { scoreKey: 'scoreWindow', label: '窓側', rowsKey: 'windowDupRows', needsWindow: true },
    { scoreKey: 'scoreCorridor', label: '廊下側', rowsKey: 'corridorDupRows', needsCorridor: true },
    { scoreKey: 'scoreSeat', label: '過去座席', strKey: 'pastSeatStrs' }
];

function swapDetailLineInvolvesStudents(line, studentIds) {
    if (!studentIds || studentIds.size === 0) return true;
    for (const id of studentIds) {
        if (!id) continue;
        if (line.includes(`[${id} `)) return true;
    }
    return false;
}

function diffScoredDupRows(beforeRows, afterRows) {
    const beforeByText = new Map();
    (beforeRows || []).forEach(row => {
        if (!row || !row.scored) return;
        const prev = beforeByText.get(row.displayText);
        if (prev == null || row.sortScore > prev) beforeByText.set(row.displayText, row.sortScore);
    });
    const out = [];
    (afterRows || []).forEach(row => {
        if (!row || !row.scored || !row.displayText) return;
        const prev = beforeByText.get(row.displayText);
        if (prev == null || row.sortScore > prev) out.push(row.displayText);
    });
    return out;
}

function diffNewStrings(beforeArr, afterArr) {
    const beforeSet = new Set(beforeArr || []);
    return (afterArr || []).filter(s => s && !beforeSet.has(s));
}

function buildSwapScoreWorsenMessage(beforeDetails, afterDetails, swapStudents) {
    const studentIds = new Set(
        (swapStudents || []).filter(Boolean).map(s => (s.id || '').trim()).filter(Boolean)
    );
    const sections = [];

    const catLines = [];
    for (const spec of SWAP_SCORE_CATEGORY_SPECS) {
        if (spec.needsWindow && !boardHasWindowEdge()) continue;
        if (spec.needsCorridor && !boardHasCorridorEdge()) continue;
        const b = Number(beforeDetails[spec.scoreKey]) || 0;
        const a = Number(afterDetails[spec.scoreKey]) || 0;
        const d = a - b;
        if (d > 0) catLines.push(`・${spec.label}: +${d}点（${b} → ${a}）`);
    }
    if (catLines.length) {
        sections.push('【増加した項目】\n' + catLines.join('\n'));
    }

    const detailSet = new Set();
    const detailLines = [];
    const addDetail = (line, swapOnly) => {
        if (!line || detailSet.has(line)) return;
        if (swapOnly && studentIds.size > 0 && !swapDetailLineInvolvesStudents(line, studentIds)) return;
        detailSet.add(line);
        detailLines.push(line);
    };

    for (const spec of SWAP_SCORE_CATEGORY_SPECS) {
        const b = Number(beforeDetails[spec.scoreKey]) || 0;
        const a = Number(afterDetails[spec.scoreKey]) || 0;
        if (a <= b) continue;
        if (spec.rowsKey) {
            diffScoredDupRows(beforeDetails[spec.rowsKey], afterDetails[spec.rowsKey])
                .forEach(line => addDetail(line, true));
        }
        if (spec.strKey) {
            diffNewStrings(beforeDetails[spec.strKey], afterDetails[spec.strKey])
                .forEach(line => addDetail(line, true));
        }
    }

    if (detailLines.length === 0 && catLines.length > 0) {
        for (const spec of SWAP_SCORE_CATEGORY_SPECS) {
            const b = Number(beforeDetails[spec.scoreKey]) || 0;
            const a = Number(afterDetails[spec.scoreKey]) || 0;
            if (a <= b) continue;
            if (spec.rowsKey) {
                diffScoredDupRows(beforeDetails[spec.rowsKey], afterDetails[spec.rowsKey])
                    .forEach(line => addDetail(line, false));
            }
            if (spec.strKey) {
                diffNewStrings(beforeDetails[spec.strKey], afterDetails[spec.strKey])
                    .forEach(line => addDetail(line, false));
            }
        }
    }

    const MAX_DETAIL_LINES = 12;
    if (detailLines.length) {
        const shown = detailLines.slice(0, MAX_DETAIL_LINES);
        let block = '【該当の詳細】\n' + shown.map(l => `・${l}`).join('\n');
        if (detailLines.length > MAX_DETAIL_LINES) {
            block += `\n…他 ${detailLines.length - MAX_DETAIL_LINES} 件`;
        }
        sections.push(block);
    }

    return sections.join('\n\n');
}

function evaluateSwapBeforeConfirm(assignment, idx1, idx2) {
    const ctx = buildManualSwapEvalContext();
    if (!ctx) return { kind: 'error' };

    const s1 = swapEvalStudent(assignment[idx1], ctx.preparedById);
    const s2 = swapEvalStudent(assignment[idx2], ctx.preparedById);
    const hardMsgs = collectSwapHardViolations(assignment, idx1, idx2, s1, s2, ctx);
    if (hardMsgs.length) {
        return {
            kind: 'hard',
            message: '【警告】\n' + hardMsgs.map(m => `・${m}`).join('\n')
        };
    }

    const beforeDetails = ctx.evaluateAssignment(assignment);
    const swapped = assignment.slice();
    const t = swapped[idx1];
    swapped[idx1] = swapped[idx2];
    swapped[idx2] = t;
    const afterDetails = ctx.evaluateAssignment(swapped);
    const beforeScore = beforeDetails.totalScore;
    const afterScore = afterDetails.totalScore;

    if (afterScore > beforeScore) {
        const delta = afterScore - beforeScore;
        let message = `スコアが悪化します（${beforeScore}点 → ${afterScore}点、+${delta}点）。`;
        const detailBlock = buildSwapScoreWorsenMessage(beforeDetails, afterDetails, [s1, s2]);
        if (detailBlock) message += '\n\n' + detailBlock;
        return { kind: 'soft', message };
    }
    return { kind: 'ok' };
}

function dismissSwapConfirmModal() {
    const modal = document.getElementById('swap-confirm-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('swap-confirm-modal--hard', 'swap-confirm-modal--soft');
    }
    swapConfirmProceedCallback = null;
    swapConfirmCancelCallback = null;
    if (swapConfirmEscListener) {
        document.removeEventListener('keydown', swapConfirmEscListener);
        swapConfirmEscListener = null;
    }
}

function showSwapConfirmModal(mode, message, proceedLabel, onProceed, onCancel) {
    const modal = document.getElementById('swap-confirm-modal');
    const titleEl = document.getElementById('swap-confirm-title');
    const msgEl = document.getElementById('swap-confirm-message');
    const proceedBtn = document.getElementById('swap-confirm-proceed-btn');
    if (!modal || !msgEl || !proceedBtn) {
        if (onProceed) onProceed();
        return;
    }
    modal.classList.remove('swap-confirm-modal--hard', 'swap-confirm-modal--soft');
    modal.classList.add(mode === 'hard' ? 'swap-confirm-modal--hard' : 'swap-confirm-modal--soft');
    if (titleEl) titleEl.textContent = mode === 'hard' ? '入れ替えの警告' : '入れ替えの確認';
    msgEl.textContent = message;
    proceedBtn.textContent = proceedLabel;
    swapConfirmProceedCallback = onProceed;
    swapConfirmCancelCallback = onCancel;
    modal.style.display = 'flex';
    if (!swapConfirmEscListener) {
        swapConfirmEscListener = e => {
            if (e.key === 'Escape' || e.key === 'Esc') cancelSwapConfirm();
        };
        document.addEventListener('keydown', swapConfirmEscListener);
    }
}

function proceedSwapConfirm() {
    const cb = swapConfirmProceedCallback;
    dismissSwapConfirmModal();
    if (cb) cb();
}

function cancelSwapConfirm() {
    const cb = swapConfirmCancelCallback;
    dismissSwapConfirmModal();
    if (cb) cb();
}

function getCurrentAssignmentForDrag() {
    return previewAssignment || seatAssignment;
}

function applyPreviewSwap(idx1, idx2) {
    if (!previewAssignment) {
        previewAssignment = [...seatAssignment];
        setActionButtons(true, false);
    }
    const arr = previewAssignment;
    const temp = arr[idx1];
    arr[idx1] = arr[idx2];
    arr[idx2] = temp;
    renderAssignments();
}

function dragStart(e, i) {
    if (document.body.classList.contains('print-mode') || exceptionMode || inactiveSeats.has(i)) {
        e.preventDefault();
        return;
    }
    const assignment = getCurrentAssignmentForDrag();
    if (!assignment[i]) {
        e.preventDefault();
        return;
    }
    draggedIdx = i;
    e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
    if (document.body.classList.contains('print-mode') || exceptionMode) return;
    e.preventDefault();
    const targetIdx = parseInt(e.currentTarget.dataset.index, 10);
    if (draggedIdx === null || Number.isNaN(targetIdx) || inactiveSeats.has(targetIdx)) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    const assignment = getCurrentAssignmentForDrag();
    if (!assignment[draggedIdx] || !assignment[targetIdx]) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function dragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

function drop(e, targetIdx) {
    if (document.body.classList.contains('print-mode') || exceptionMode) return;
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const fromIdx = draggedIdx;
    draggedIdx = null;
    if (fromIdx === null || fromIdx === targetIdx || inactiveSeats.has(targetIdx) || inactiveSeats.has(fromIdx)) return;

    const assignment = getCurrentAssignmentForDrag();
    if (!assignment[fromIdx] || !assignment[targetIdx]) return;

    const evalResult = evaluateSwapBeforeConfirm(assignment, fromIdx, targetIdx);
    const doSwap = () => applyPreviewSwap(fromIdx, targetIdx);

    if (evalResult.kind === 'ok') {
        doSwap();
        return;
    }
    if (evalResult.kind === 'error') return;

    if (evalResult.kind === 'hard') {
        showSwapConfirmModal('hard', evalResult.message, '入れ替えを実行する', doSwap, () => {});
        return;
    }
    showSwapConfirmModal('soft', evalResult.message, '入れ替える', doSwap, () => {});
}

// --- データ保存・復元拡張 ---
function saveCurrentClassData() {
    syncSoftScoresFromInputs();
    const colors = {};
    for(let i=1;i<=6;i++) colors[`c${i}`] = document.getElementById(`color-${i}`).value;
    const genderBorderButton = document.getElementById('btn-gender-border');
    const genderBorderData = {
        active: genderBorderButton ? genderBorderButton.classList.contains('btn-success') : false,
        boy: document.getElementById('gb-boy-color') ? document.getElementById('gb-boy-color').value : '6',
        girl: document.getElementById('gb-girl-color') ? document.getElementById('gb-girl-color').value : '5',
        style: document.getElementById('gb-style') ? document.getElementById('gb-style').value : 'solid'
    };
    const data = {
        students: currentStudents, rulesRaw: document.getElementById('overall-rules').value, layoutRaw: document.getElementById('layout-rules').value,
        seatLayoutFields: collectSeatLayoutFromUI(),
        ...exportFairnessSettings(),
        ...exportSoftScoreSettings(),
        ...exportEdgeSettings(),
        inactiveSeats: Array.from(inactiveSeats), assignment: seatAssignment, histories: histories, colors: colors,
        genderBorderData: genderBorderData,
        printInactiveMode: printInactiveMode === 'frame' ? 'frame' : 'hide'
    };
    localStorage.setItem(`${PREFIX}data_${appData.currentClassId}`, JSON.stringify(data));
}

function loadCurrentClassData() {
    invalidateManualSwapEvalCache();
    let dataStr = localStorage.getItem(`${PREFIX}data_${appData.currentClassId}`);
    if (!dataStr) dataStr = localStorage.getItem(`SekigaeKun_v5_data_${appData.currentClassId}`);
    if (!dataStr) dataStr = localStorage.getItem(`SekigaeKun_v4_data_${appData.currentClassId}`);
    if (!dataStr) dataStr = localStorage.getItem(`SekigaeKun_v3_data_${appData.currentClassId}`);
    if (!dataStr) dataStr = localStorage.getItem(`SekigaeKun_v2_data_${appData.currentClassId}`);
    if (!dataStr) dataStr = localStorage.getItem(`SekigaeKun_v1_data_${appData.currentClassId}`);
    if (!dataStr) dataStr = localStorage.getItem(`SekigaeApp_v4_data_${appData.currentClassId}`);
    
    previewAssignment = null;
    previewInactiveSeatsBackup = null;
    pendingHistoryMemoOnCommit = null;
    setActionButtons(false, false);
    if (dataStr) {
        try {
            const data = JSON.parse(dataStr);
            currentStudents = (data.students || []).map(s => ({
                id: s.id || '',
                name: s.name || '',
                kana: s.kana || '',
                gender: normalizeGender(s.gender) || String(s.gender || '').trim(),
                attr1: s.attr1 || '',
                attr2: s.attr2 || '',
                flags: s.flags || ''
            }));
            document.getElementById('overall-rules').value = data.rulesRaw || '';
            document.getElementById('layout-rules').value = data.layoutRaw || '';
            applySeatLayoutToUI(data.seatLayoutFields);
            importFairnessSettings(data);
            importSoftScoreSettings(data);
            importEdgeSettings(data);
            syncClassScopedControlsFromGlobals();
            inactiveSeats = new Set(data.inactiveSeats || []); seatAssignment = data.assignment || new Array(TOTAL_SEATS).fill(null);
            printInactiveMode = data.printInactiveMode === 'frame' ? 'frame' : 'hide';
            histories = (data.histories || []).map(h => ({
                date: h.date || '',
                assignment: h.assignment || [],
                memo: h.memo || '',
                inactiveSeats: Array.isArray(h.inactiveSeats) ? h.inactiveSeats : undefined
            }));
            if(data.colors) {
                const colorFallback = ['#000000','#666666','#000080','#0000ff','#008000','#ff0000'];
                for(let i=1;i<=6;i++) {
                    const v = data.colors[`c${i}`];
                    const el = document.getElementById(`color-${i}`);
                    if (el) el.value = (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : colorFallback[i-1];
                }
            }
            
            if(data.genderBorderData) {
                document.getElementById('gb-boy-color').value = data.genderBorderData.boy || 6;
                document.getElementById('gb-girl-color').value = data.genderBorderData.girl || 5;
                document.getElementById('gb-style').value = data.genderBorderData.style || 'solid';
                const btn = document.getElementById('btn-gender-border'); const panel = document.getElementById('gender-border-settings');
                if(data.genderBorderData.active) {
                    btn.classList.replace('btn-outline', 'btn-success'); btn.innerText = 'ON'; panel.style.display = 'block';
                } else {
                    btn.classList.replace('btn-success', 'btn-outline'); btn.innerText = 'OFF'; panel.style.display = 'none';
                }
            }
        } catch(e) { console.error("データ読み込みエラー", e); }
    } else {
        currentStudents = []; inactiveSeats.clear(); seatAssignment = new Array(TOTAL_SEATS).fill(null); histories = [];
        printInactiveMode = 'hide';
        resetClassScopedSettingsUI();
        applySeatLayoutToUI(null);
    }
    document.querySelector('#students-table tbody').innerHTML = ''; currentStudents.forEach(s => addRowToTable(s));
    updateColors(); updateHistorySelect(); updateCounters();
    updateClassNameDisplay();
    updatePrintInactiveToggleUi();
    renderAssignments();
    syncConstraintsBaselineFromPersisted();
}

function updateHistorySelect() {
    const historySelect = document.getElementById('history-select');
    const prevValue = historySelect ? historySelect.value : '';
    historySelect.innerHTML = '';
    if(histories.length === 0) {
        historySelect.innerHTML = '<option value="">履歴なし</option>';
        const memoInput = document.getElementById('history-memo-input');
        if (memoInput) memoInput.value = '';
        updateDeskTitleDisplay();
        return;
    }
    histories.forEach((historyEntry, index) => {
        const option = document.createElement('option');
        option.value = index;
        const memo = (historyEntry.memo || '').trim();
        option.text = memo ? `${historyEntry.date} │ ${memo}` : historyEntry.date;
        historySelect.appendChild(option);
    });
    if (prevValue !== '' && histories[prevValue]) historySelect.value = prevValue;
    syncHistoryMemoInput();
    updateDeskTitleDisplay();
}

/** プルダウンで選んだ履歴の座席・空席を確定盤面として反映（グレー予約状態にはしない） */
function applyHistorySelectionToBoard() {
    invalidateManualSwapEvalCache();
    const sel = document.getElementById('history-select');
    if (!sel) return;
    const selectedIndex = sel.value;
    if (selectedIndex === '' || !histories[selectedIndex]) {
        previewAssignment = null;
        previewInactiveSeatsBackup = null;
        pendingHistoryMemoOnCommit = null;
        setActionButtons(false, false);
        renderAssignments();
        return;
    }
    const history = histories[selectedIndex];
    seatAssignment = [...history.assignment];
    previewAssignment = null;
    previewInactiveSeatsBackup = null;
    pendingHistoryMemoOnCommit = null;
    if (Array.isArray(history.inactiveSeats)) {
        inactiveSeats = new Set(history.inactiveSeats);
    } else {
        inactiveSeats = new Set();
    }
    setActionButtons(false, false);
    saveCurrentClassData();
    updateCounters();
    renderAssignments();
}

/** 履歴選択に合わせてメモ入力欄を同期（プログラム更新時は座席は触らない） */
function syncHistoryMemoInput() {
    const memoInput = document.getElementById('history-memo-input');
    if (!memoInput) return;
    const selectedIndex = document.getElementById('history-select').value;
    if (selectedIndex === '' || !histories[selectedIndex]) {
        memoInput.value = '';
        return;
    }
    memoInput.value = histories[selectedIndex].memo || '';
}

/** 入力欄のメモを選択中の履歴に保存 */
function saveHistoryMemo() {
    const memoInput = document.getElementById('history-memo-input');
    const sel = document.getElementById('history-select');
    if (!memoInput || !sel) return;
    const selectedIndex = sel.value;
    if (selectedIndex === '' || !histories[selectedIndex]) {
        return showAlert('メモを保存する履歴を選択してください。', 'info');
    }
    const memo = (memoInput.value || '').slice(0, 10);
    histories[selectedIndex].memo = memo;
    saveCurrentClassData();
    updateHistorySelect();
    showAlert(memo ? 'メモを保存しました。' : 'メモを削除しました。', 'success');
}
function deleteSelectedHistory() {
    const selectedIndex = document.getElementById('history-select').value;
    if(selectedIndex === "" || !histories[selectedIndex]) return alert("削除する履歴がありません。");
    if(confirm(`選択した履歴（${histories[selectedIndex].date}）を削除しますか？`)) {
        histories.splice(selectedIndex, 1);
        invalidateManualSwapEvalCache();
        saveCurrentClassData(); updateHistorySelect();
        applyHistorySelectionToBoard();
        showAlert("指定した履歴を削除しました。", "success");
    }
}
function clearAllHistories() {
    if(histories.length === 0) return alert("削除する履歴がありません。");
    if(confirm("【確認】過去の座席履歴をすべて削除します。\nペアの重複制限やローテーション制限もクリアされます。\n（新学期や席替えルールのリセットに最適です）\nよろしいですか？")) {
        histories = [];
        invalidateManualSwapEvalCache();
        saveCurrentClassData(); updateHistorySelect();
        applyHistorySelectionToBoard();
        showAlert("全履歴をリセットしました。", "success");
    }
}
/** 旧バージョンの localStorage キーを現在の PREFIX に正規化 */
function normalizeBackupStorageKey(k) {
    return String(k).replace(/^Sekigae(Kun|App)_v\d+_/, PREFIX);
}

/** バックアップ JSON からクラス一覧を取得（system 優先、無ければ data_* キーから推定） */
function getClassesFromBackupFile(obj) {
    if (!obj || typeof obj !== 'object') return [];
    const sysKey = `${PREFIX}system`;
    if (obj[sysKey]) {
        try {
            const d = JSON.parse(obj[sysKey]);
            if (d.classes && Array.isArray(d.classes) && d.classes.length > 0) {
                return d.classes.map(c => ({
                    id: c.id || '',
                    name: ((c.name != null ? String(c.name) : '') || c.id || '').trim() || (c.id || '')
                })).filter(c => c.id);
            }
        } catch (e) {}
    }
    const out = [];
    const prefixData = `${PREFIX}data_`;
    Object.keys(obj).forEach(k => {
        if (k.startsWith(prefixData)) {
            const id = k.slice(prefixData.length);
            if (id) out.push({ id, name: id });
        }
    });
    return out;
}

function buildFilteredSystemForExport(selectedIds) {
    const set = new Set(selectedIds);
    const filteredClasses = appData.classes.filter(c => c && set.has(c.id));
    let currentClassId = appData.currentClassId;
    if (!set.has(currentClassId)) {
        currentClassId = filteredClasses.length ? filteredClasses[0].id : '';
    }
    return { classes: filteredClasses, currentClassId };
}

function openExportBackupModal() {
    const container = document.getElementById('export-class-checkboxes');
    if (!container) return;
    container.innerHTML = '';
    if (!appData.classes || appData.classes.length === 0) {
        alert('クラスがありません。');
        return;
    }
    appData.classes.forEach(c => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.value = c.id;
        cb.className = 'export-class-cb';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${c.name || c.id}`));
        container.appendChild(label);
    });
    document.getElementById('export-backup-modal').style.display = 'flex';
}

function closeExportBackupModal() {
    const el = document.getElementById('export-backup-modal');
    if (el) el.style.display = 'none';
}

function toggleExportClasses(checked) {
    document.querySelectorAll('.export-class-cb').forEach(cb => { cb.checked = checked; });
}

function confirmExportBackup() {
    const selectedIds = Array.from(document.querySelectorAll('.export-class-cb:checked')).map(cb => cb.value).filter(Boolean);
    if (selectedIds.length === 0) {
        alert('1つ以上クラスを選択してください。');
        return;
    }
    const filteredSystem = buildFilteredSystemForExport(selectedIds);
    const backupData = {};
    backupData[`${PREFIX}system`] = JSON.stringify(filteredSystem);
    selectedIds.forEach(id => {
        const key = `${PREFIX}data_${id}`;
        const val = localStorage.getItem(key);
        if (val !== null) backupData[key] = val;
    });
    const d = new Date();
    const yymmdd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData));
    a.download = `sekigaekun_${yymmdd}.json`;
    a.click();
    closeExportBackupModal();
}

function openImportBackupModal() {
    if (!pendingImportBackupData || typeof pendingImportBackupData !== 'object') {
        alert('読み込みデータがありません。');
        return;
    }
    const classes = getClassesFromBackupFile(pendingImportBackupData);
    if (classes.length === 0) {
        alert('バックアップにクラス情報が見つかりません。');
        pendingImportBackupData = null;
        return;
    }
    const container = document.getElementById('import-class-checkboxes');
    if (!container) return;
    container.innerHTML = '';
    classes.forEach(c => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.value = c.id;
        cb.className = 'import-class-cb';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${c.name || c.id}`));
        container.appendChild(label);
    });
    document.getElementById('import-backup-modal').style.display = 'flex';
}

function closeImportBackupModal() {
    const el = document.getElementById('import-backup-modal');
    if (el) el.style.display = 'none';
    pendingImportBackupData = null;
}

function toggleImportClasses(checked) {
    document.querySelectorAll('.import-class-cb').forEach(cb => { cb.checked = checked; });
}

/**
 * 選択したクラスの data_* を取り込み、system のクラス一覧をマージ（同名はファイル側の名前で更新）
 */
function mergeImportedBackupIntoLocalStorage(fileObj, selectedIds) {
    const sysKey = `${PREFIX}system`;
    let fileSystem = null;
    if (fileObj[sysKey]) {
        try { fileSystem = JSON.parse(fileObj[sysKey]); } catch (e) {}
    }

    selectedIds.forEach(id => {
        const key = `${PREFIX}data_${id}`;
        if (fileObj[key] !== undefined && fileObj[key] !== null) {
            localStorage.setItem(key, fileObj[key]);
        }
    });

    let localSys = { classes: [], currentClassId: '' };
    try {
        const s = localStorage.getItem(sysKey);
        if (s) localSys = JSON.parse(s);
    } catch (e) {}
    if (!Array.isArray(localSys.classes)) localSys.classes = [];

    selectedIds.forEach(id => {
        let name = id;
        if (fileSystem && Array.isArray(fileSystem.classes)) {
            const fc = fileSystem.classes.find(c => c.id === id);
            if (fc && fc.name != null && String(fc.name).trim()) name = String(fc.name).trim();
        }
        const idx = localSys.classes.findIndex(c => c.id === id);
        if (idx >= 0) localSys.classes[idx] = { id, name };
        else localSys.classes.push({ id, name });
    });

    if (!localSys.classes.some(c => c.id === localSys.currentClassId)) {
        localSys.currentClassId = localSys.classes.length ? localSys.classes[0].id : '';
    }
    localStorage.setItem(sysKey, JSON.stringify(localSys));
}

function confirmImportBackup() {
    const selectedIds = Array.from(document.querySelectorAll('.import-class-cb:checked')).map(cb => cb.value).filter(Boolean);
    if (selectedIds.length === 0) {
        alert('1つ以上クラスを選択してください。');
        return;
    }
    if (!pendingImportBackupData) {
        alert('読み込みデータがありません。');
        return;
    }
    mergeImportedBackupIntoLocalStorage(pendingImportBackupData, selectedIds);
    pendingImportBackupData = null;
    closeImportBackupModal();
    const fileInput = document.getElementById('import-file');
    if (fileInput) fileInput.value = '';
    alert('復元完了しました。ページを再読み込みします。');
    location.reload();
}

/** バックアップ読込ボタン：即ファイル選択ダイアログを開く */
function triggerBackupImportPicker() {
    const input = document.getElementById('import-file');
    if (input) input.click();
}

function onImportBackupFileChange(e) {
    const input = e.target;
    const selectedFile = input.files && input.files[0];
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const raw = JSON.parse(ev.target.result);
            pendingImportBackupData = {};
            Object.keys(raw).forEach(k => {
                pendingImportBackupData[normalizeBackupStorageKey(k)] = raw[k];
            });
            openImportBackupModal();
        } catch (err) {
            alert('読み込み失敗');
            pendingImportBackupData = null;
        }
        input.value = '';
    };
    reader.onerror = () => {
        alert('読み込み失敗');
        pendingImportBackupData = null;
        input.value = '';
    };
    reader.readAsText(selectedFile);
}

function showAlert(msg, type='error') { const b = document.getElementById('alert-box'); b.innerHTML = msg.replace(/\n/g, '<br>'); b.style.display = 'block'; b.className = `alert-${type}`; }
function hideAlert() { document.getElementById('alert-box').style.display = 'none'; }
