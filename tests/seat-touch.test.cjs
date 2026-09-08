const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
function setup() {
    let timer, clock = 1000, hit = 1;
    const calls = [], listeners = {};
    const classList = () => { const set = new Set(); return { add: x => set.add(x), remove: x => set.delete(x), contains: x => set.has(x) }; };
    const seats = [0, 1, 2].map(i => ({ dataset: { index: String(i) }, draggable: true, classList: classList(), closest() { return this; } }));
    const body = { classList: classList() };
    const context = vm.createContext({
        Math, Date: { now: () => clock }, Array, Number,
        setTimeout(fn) { timer = fn; return 1; }, clearTimeout() { timer = null; },
        document: { body, hidden: false, elementFromPoint: () => seats[hit] || null,
            getElementById: () => ({ contains: el => seats.includes(el) }),
            addEventListener: (name, fn) => { listeners[name] = fn; } },
        window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
        clearDragOverStates: () => seats.forEach(s => s.classList.remove('drag-over')),
        getSeatElement: i => seats[i],
        getCurrentAssignmentForDrag: () => ['A', 'B', null],
        openSeatTrackModal: i => calls.push(['history', i]),
        requestSeatDrop: (a, b) => calls.push(['drop', a, b]),
        clearSeatDragGhost: () => {}, createSeatDragGhost: () => calls.push(['mouseGhost'])
    });
    vm.runInContext(`let seatTrackTouchTimer = null, seatTouchGesture = null, suppressSeatClickUntil = 0;
        let exceptionMode = false, inactiveSeats = new Set([2]), draggedIdx = null;`, context);
    for (const [start, end] of [
        ['function clearSeatTrackTouchTimer()', 'function findSeatIndexByStudentId'],
        ['function cancelSeatTouchGesture()', 'function setActionButtons'],
        ['function dragStart(e, i)', '/**\n * 反転した盤面']
    ]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), context);
    const touch = (x = 0, y = 0, identifier = 7) => ({ clientX: x, clientY: y, identifier });
    function event(touches = [touch()], changedTouches = [touch()]) {
        return { touches, changedTouches, currentTarget: seats[0], cancelable: true, prevented: false,
            preventDefault() { this.prevented = true; }, stopPropagation() {} };
    }
    return { context, calls, seats, listeners, event, touch, body,
        start() { context.handleSeatTrackTouchStart(event(), 0); },
        hold() { assert.ok(timer); const fn = timer; timer = null; clock += 550; fn(); },
        move(x, opts = {}) { const e = Object.assign(event([touch(x)]), opts); context.handleSeatTrackTouchMove(e); return e; },
        end(x = 0) { const e = event([], [touch(x)]); context.handleSeatTrackTouchEnd(e); return e; },
        hit(i) { hit = i; }, hasTimer: () => Boolean(timer),
        state: expr => vm.runInContext(expr, context)
    };
}
test('short tap stays a tap and restores native mouse dragging', () => {
    const s = setup(); s.start(); assert.equal(s.seats[0].draggable, false);
    assert.equal(s.end().prevented, false); assert.equal(s.seats[0].draggable, true);
    assert.deepEqual(s.calls, []); assert.equal(s.hasTimer(), false);
});
test('hold opens nothing until release; jitter is tolerated', () => {
    const s = setup(); s.start(); s.move(5); s.hold();
    assert.deepEqual(s.calls, []); assert.equal(s.seats[0].classList.contains('seat-touch-held'), true);
    assert.equal(s.move(6).prevented, true); assert.equal(s.end(6).prevented, true);
    assert.deepEqual(s.calls, [['history', 0]]); assert.ok(s.state('suppressSeatClickUntil') > 1550);
});
test('movement before hold permits scrolling and cancels history', () => {
    const s = setup(); s.start(); assert.equal(s.move(11).prevented, false);
    assert.equal(s.hasTimer(), false); s.end(11); assert.deepEqual(s.calls, []);
});
test('held drag blocks scrolling, highlights destination, and uses shared drop', () => {
    const s = setup(); s.start(); s.hold(); assert.equal(s.move(20).prevented, true);
    assert.equal(s.seats[1].classList.contains('drag-over'), true);
    s.end(20); assert.deepEqual(s.calls, [['drop', 0, 1]]);
    assert.equal(s.seats[0].draggable, true); assert.equal(s.seats[1].classList.contains('drag-over'), false);
});
test('inactive empty seat is a relocation target', () => {
    const s = setup(); s.hit(2); s.start(); s.hold(); s.move(20);
    assert.equal(s.seats[2].classList.contains('drag-over'), true);
    s.end(20); assert.deepEqual(s.calls, [['drop', 0, 2]]);
});
test('release outside board cancels without history or drop', () => {
    const s = setup(); s.start(); s.hold(); s.move(20); s.hit(-1); s.end(30);
    assert.deepEqual(s.calls, []);
});
test('dragging back to origin never opens history', () => {
    const s = setup(); s.start(); s.hold(); s.move(20); s.hit(0); s.end();
    assert.deepEqual(s.calls, [['drop', 0, 0]]);
});
test('second finger outside seat cancels gesture and restores mouse handling', () => {
    const s = setup(); s.start(); s.hold(); s.listeners.touchstart(s.event([s.touch(), s.touch(0, 0, 8)]));
    s.end(); assert.deepEqual(s.calls, []); assert.equal(s.seats[0].draggable, true);
});
test('blur, visibility loss, touchcancel cleanup never commit', () => {
    for (const kind of ['blur', 'visibilitychange', 'cancel']) {
        const s = setup(); s.start(); s.hold(); s.move(20);
        if (kind === 'cancel') s.context.cancelSeatTouchGesture();
        else { s.context.document.hidden = true; s.listeners[kind](); }
        s.end(20); assert.deepEqual(s.calls, []); assert.equal(s.seats[0].draggable, true);
    }
});
test('non-cancelable scrolling event cancels held gesture', () => {
    const s = setup(); s.start(); s.hold(); assert.equal(s.move(20, { cancelable: false }).prevented, false);
    s.end(20); assert.deepEqual(s.calls, []);
});
test('mouse context menu works; touch context menu does not open history early', () => {
    const s = setup(); s.start(); s.context.handleSeatContextMenu(s.event(), 0); assert.deepEqual(s.calls, []);
    s.context.cancelSeatTouchGesture(); s.context.handleSeatContextMenu(s.event(), 1);
    assert.deepEqual(s.calls, [['history', 1]]);
});
test('native mouse drag remains available after touch finishes', () => {
    const s = setup(); s.start(); const e = s.event(); e.dataTransfer = {};
    s.context.dragStart(e, 0); assert.equal(e.prevented, true);
    s.end(); e.prevented = false; s.context.dragStart(e, 0);
    assert.equal(e.prevented, false); assert.equal(e.dataTransfer.effectAllowed, 'move');
    assert.equal(s.state('draggedIdx'), 0); assert.deepEqual(s.calls, [['mouseGhost']]);
});
test('print mode ignores touch start', () => {
    const s = setup(); s.body.classList.add('print-mode'); s.start(); assert.equal(s.hasTimer(), false);
    assert.equal(s.seats[0].draggable, true);
});
test('shared drop preserves rule confirmation and empty-seat relocation', () => {
    for (const kind of ['ok', 'hard', 'soft', 'error']) {
        const s = setup(); let confirm;
        s.context.evaluateSwapBeforeConfirm = () => ({ kind, message: 'rule' });
        s.context.applyPreviewSwap = (a, b) => s.calls.push(['swap', a, b]);
        s.context.requestManualRelocation = (a, b) => s.calls.push(['relocate', a, b]);
        s.context.showSwapConfirmModal = (type, message, label, yes) => { confirm = yes; s.calls.push(['confirm', type]); };
        vm.runInContext(source.slice(source.indexOf('function requestSeatDrop('), source.indexOf('// --- データ保存・復元拡張 ---')), s.context);
        s.context.requestSeatDrop(0, 0); s.context.requestSeatDrop(2, 0); assert.deepEqual(s.calls, []);
        s.context.requestSeatDrop(0, 1);
        if (kind === 'ok') assert.deepEqual(s.calls, [['swap', 0, 1]]);
        else if (kind === 'error') assert.deepEqual(s.calls, []);
        else { assert.deepEqual(s.calls, [['confirm', kind]]); confirm(); assert.deepEqual(s.calls[1], ['swap', 0, 1]); }
        s.context.requestSeatDrop(0, 2); assert.deepEqual(s.calls.at(-1), ['relocate', 0, 2]);
    }
});
