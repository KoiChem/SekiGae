const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

function setup() {
    const elements = new Map(), storage = new Map();
    const context = vm.createContext({
        console, URLSearchParams, setTimeout, clearTimeout,
        window: { location: { search: '' }, addEventListener() {} },
        document: {
            body: {classList: {contains: () => false}},
            addEventListener() {},
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, { value: '', checked: false, dataset: {}, classList: { toggle() {} } });
                return elements.get(id);
            }
        },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        crypto: require('node:crypto').webcrypto
    });
    vm.runInContext(source, context);
    const realShowAlert = context.showAlert;
    vm.runInContext(`
        renderAssignments = () => {};
        clearManualMoveSelection = () => {};
        updateCounters = () => {};
        clearManualSwapUndoStack = () => {};
        updateManualSwapUndoButton = () => {};
        setActionButtons = () => {};
        showAlert = () => {};
        readSeatAppearanceSettingsFromMainUi = () => ({colors:{}});
        appData = {currentClassId: 'test', classes: [{id:'test', name:'テスト'}]};
        currentStudents = [{id:'01', name:'架空一'}, {id:'02', name:'架空二'}];
        seatAssignment = Array(42).fill(null);
        seatAssignment[0] = currentStudents[0]; seatAssignment[1] = currentStudents[1];
        inactiveSeats = new Set([41]);
    `, context);
    const run = expression => vm.runInContext(expression, context);
    const snapshot = expression => JSON.parse(JSON.stringify(run(expression)));
    function record(seed) {
        run(`previewAssignment = seatAssignment.map(s => s && {...s});
            pendingHistoryShuffleMeta = {seed:${seed}, isCheckerboard:false};`);
        assert.equal(typeof context.recordShuffleCandidate, 'function', 'actual shuffle candidates must be recorded');
        context.recordShuffleCandidate();
    }
    return { context, run, snapshot, record, storage, elements, realShowAlert };
}

test('ten latest candidates retain independent arrangements and inactive seats', () => {
    const s = setup();
    for (let i = 0; i < 12; i++) s.record(i);
    assert.equal(s.run('shuffleCandidates.length'), 10);
    assert.equal(s.run('shuffleCandidates[0].seed'), 11);
    assert.equal(s.run('shuffleCandidates[9].seed'), 2);
    s.run("previewAssignment[0].name = '変更'; inactiveSeats.clear()");
    assert.equal(s.run('shuffleCandidates[0].assignment[0].name'), '架空一');
    assert.deepEqual(s.snapshot('shuffleCandidates[0].inactiveSeats'), [41]);
});

test('restoring an older candidate is an exact preview and never confirms it', () => {
    const s = setup(); s.record(1);
    s.run('[seatAssignment[0],seatAssignment[1]] = [seatAssignment[1],seatAssignment[0]]'); s.record(2);
    assert.equal(s.context.restoreShuffleCandidate(1), true);
    assert.equal(s.run('previewAssignment[0].id'), '01');
    assert.equal(s.run('seatAssignment[0].id'), '02');
    assert.equal(s.run('histories.length'), 0);
    assert.equal(s.run('pendingHistoryShuffleMeta.seed'), 1);
    assert.equal(s.run('shuffleCandidateIndex'), 1);
    assert.equal(s.context.restoreShuffleCandidate(0), true);
    assert.equal(s.run('previewAssignment[0].id'), '02');
    assert.equal(s.context.restoreShuffleCandidate(2), false);
});

test('manual edits survive candidate navigation including relocation of empty seats', () => {
    const s = setup(); s.record(1); s.record(2);
    s.context.applyPreviewRelocation(0, 41);
    s.context.restoreShuffleCandidate(1); s.context.restoreShuffleCandidate(0);
    assert.equal(s.run('previewAssignment[41].id'), '01');
    assert.deepEqual(s.snapshot('Array.from(inactiveSeats)'), [0]);
    assert.deepEqual(s.snapshot('Array.from(previewInactiveSeatsBackup)'), [41]);
    assert.equal(s.run('pendingHistoryShuffleMeta.manuallyModified'), true);
    assert.equal(s.run('histories.length'), 0);
});

test('roster and rule changes block stale candidate restoration without touching the board', () => {
    for (const change of ["currentStudents[0].id = '03'", "document.getElementById('overall-rules').value = '前列'"]) {
        const s = setup(); s.record(1); s.run('previewAssignment = null'); s.run(change);
        assert.equal(s.context.restoreShuffleCandidate(0), false);
        assert.equal(s.run('previewAssignment'), null);
        assert.equal(s.run('histories.length'), 0);
    }
});

test('candidate storage round trip preserves snapshots, and legacy or invalid entries are ignored', () => {
    const s = setup(); s.record(1); s.context.saveCurrentClassData();
    const stored = JSON.parse(s.storage.get('SekigaeKun_v6_data_test'));
    assert.equal(stored.shuffleCandidates.length, 1);
    assert.equal(typeof s.context.loadShuffleCandidates, 'function');
    s.context.payload = stored.shuffleCandidates;
    assert.deepEqual(s.snapshot('loadShuffleCandidates(payload)'), stored.shuffleCandidates);
    assert.deepEqual(s.snapshot('loadShuffleCandidates(undefined)'), []);
    assert.deepEqual(s.snapshot('loadShuffleCandidates([{seed:1}, null, {}])'), []);
    s.context.payload = [{...stored.shuffleCandidates[0], assignment: []}, ...stored.shuffleCandidates];
    assert.equal(s.run('loadShuffleCandidates(payload).length'), 1);
});

test('confirming an older candidate updates that entry and keeps existing confirmed history', () => {
    const s = setup(); s.record(1); s.record(2);
    s.context.restoreShuffleCandidate(1);
    s.run('getPreviewPointDetails = () => ({totalScore: 4}); updateHistorySelect = () => {}');
    s.context.commitSeats();
    assert.equal(s.run('histories.length'), 1);
    assert.equal(s.run('histories[0].seed'), 1);
    assert.equal(s.run('shuffleCandidates[1].confirmed'), true);
    assert.equal(s.run('shuffleCandidates[0].confirmed'), false);
    assert.equal(s.run('previewAssignment'), null);
});

test('checkerboard candidate restores its gender pattern and exceptions', () => {
    const s = setup(); s.record(1);
    s.run('checkerboardOffset = 1; currentExceptions = new Set([3]); pendingHistoryShuffleMeta.isCheckerboard = true');
    s.context.recordShuffleCandidate();
    s.run('checkerboardOffset = 0; currentExceptions.clear()');
    s.context.restoreShuffleCandidate(0);
    assert.equal(s.run('checkerboardOffset'), 1);
    assert.deepEqual(s.snapshot('Array.from(currentExceptions)'), [3]);
});

test('cancellation restores committed inactive seats without losing candidate snapshots', () => {
    const s = setup(); s.record(1);
    s.run('previewInactiveSeatsBackup = new Set([41]); inactiveSeats = new Set([0])');
    s.context.cancelPreview();
    assert.deepEqual(s.snapshot('Array.from(inactiveSeats)'), [41]);
    assert.equal(s.run('shuffleCandidateIndex'), -1);
    assert.equal(s.run('shuffleCandidates.length'), 1);
});

test('a rejected shuffle re-enables candidate navigation', async () => {
    const s = setup(); s.record(1); s.record(2);
    s.run('isCalculating = true'); s.context.syncShuffleCandidateControls();
    assert.equal(s.elements.get('btn-candidate-older').disabled, true);
    s.run('isCalculating = false; currentStudents = []; hideAlert = () => {}');
    const get = s.context.document.getElementById;
    s.context.document.getElementById = id => id === 'alert-box' ? null : get(id);
    s.context.showAlert = s.realShowAlert;
    await s.context.prepareShuffle(false, {skipEdgeGuard: true});
    assert.equal(s.elements.get('btn-candidate-older').disabled, false);
});

test('clicking an empty seat preserves candidate edits and cancellation keeps committed vacancies', () => {
    const s = setup(); s.record(1);
    s.run('getSeatElement = () => ({classList:{add(){},remove(){}}})');
    s.context.handleSeatClick(40);
    assert.deepEqual(s.snapshot('shuffleCandidates[0].inactiveSeats'), [41, 40]);
    const stored = JSON.parse(s.storage.get('SekigaeKun_v6_data_test'));
    assert.deepEqual(stored.shuffleCandidates[0].inactiveSeats, [41, 40]);
    assert.deepEqual(stored.inactiveSeats, [41]);
    s.context.cancelPreview();
    assert.deepEqual(s.snapshot('Array.from(inactiveSeats)'), [41]);
    s.context.restoreShuffleCandidate(0);
    assert.deepEqual(s.snapshot('Array.from(inactiveSeats)'), [41, 40]);
});
