const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function setup() {
    const context = vm.createContext({ NUM_COLS: 6, NUM_ROWS: 7, saves: 0, renders: 0,
        saveCurrentClassData() { context.saves++; }, renderPrintLayout() { context.renders++; } });
    for (const name of ['normalizePrintSeatGaps', 'getVisiblePrintGaps', 'cyclePrintGap']) {
        const start = source.indexOf(`function ${name}(`);
        assert.ok(start >= 0, `${name} exists`);
        const end = source.indexOf('\nfunction ', start + 1);
        vm.runInContext(source.slice(start, end < 0 ? undefined : end), context);
    }
    vm.runInContext('var printSeatGaps = normalizePrintSeatGaps();', context);
    return { context, run: code => vm.runInContext(code, context), json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)) };
}

test('legacy 1.5x maps to 2x, saved 2x is retained, and 3x round trips', () => {
    const s = setup();
    assert.deepEqual(s.json('printSeatGaps'), { columns: [1,1,1,1,1], rows: [1,1,1,1,1,1] });
    assert.deepEqual(s.json('normalizePrintSeatGaps({columns:[1.5,2,3,"2",null,2],rows:"bad"})'),
        { columns: [2,2,3,1,1], rows: [1,1,1,1,1,1] });
    assert.deepEqual(s.json('normalizePrintSeatGaps({rows:[1.5,2,3,0,4,null]})'),
        { columns: [1,1,1,1,1], rows: [2,2,3,1,1,1] });
    assert.deepEqual(s.json('normalizePrintSeatGaps(null)'), s.json('printSeatGaps'));
});

test('each boundary cycles independently and immediately saves the class setting', () => {
    const s = setup();
    for (const expected of [2, 3, 1]) {
        s.run('cyclePrintGap("columns", 2)');
        assert.equal(s.run('printSeatGaps.columns[2]'), expected);
    }
    s.run('cyclePrintGap("rows", 4)');
    assert.deepEqual(s.json('printSeatGaps'), { columns: [1,1,1,1,1], rows: [1,1,1,1,2,1] });
    assert.equal(s.context.saves, 4);
    assert.equal(s.context.renders, 4);
});

test('cropped gaps keep physical boundary identities and recover when extents reappear', () => {
    const s = setup();
    s.run('printSeatGaps = normalizePrintSeatGaps({columns:[2,3,1,2,1],rows:[1,2,3,1,2,1]})');
    assert.deepEqual(s.json('getVisiblePrintGaps({currMinC:1,currMaxC:4,currMinR:2,currMaxR:5})'),
        { columns: [3,1,2], rows: [3,1,2] });
    assert.deepEqual(s.json('getVisiblePrintGaps({currMinC:0,currMaxC:5,currMinR:0,currMaxR:6})'), s.json('printSeatGaps'));
    assert.deepEqual(s.json('getVisiblePrintGaps({currMinC:3,currMaxC:3,currMinR:4,currMaxR:4})'), {columns:[],rows:[]});
});

test('invalid boundary requests do not change or save settings', () => {
    const s = setup();
    s.run('cyclePrintGap("bad",0); cyclePrintGap("columns",-1); cyclePrintGap("rows",6); cyclePrintGap("rows",1.5)');
    assert.equal(s.context.saves, 0);
});

function layout(orientation, columns, rows, height = 1047) {
    const desk = { getBoundingClientRect: () => ({height: 41}) };
    const classroom = { querySelector: () => desk, getBoundingClientRect: () => ({width:718,height}) };
    const grid = { style: {}, closest: () => classroom };
    const context = vm.createContext({ NUM_COLS: 6, printOrientation: orientation,
        getVisiblePrintGaps: () => ({ columns, rows }),
        window: { getComputedStyle: el => el === grid ? {columnGap:'0',rowGap:'0'} :
            {paddingLeft:'5.67',paddingRight:'5.67',paddingTop:'5.67',paddingBottom:'5.67',rowGap:'17.01'} }
    });
    const start = source.indexOf('function getLandscapeSeatHeightRatio(');
    const end = source.indexOf('function autoFitPrintText(', start);
    vm.runInContext(source.slice(start,end), context);
    context.fitPrintGridLayout(grid, rows.length+1, columns.length+1);
    const px = 96/25.4;
    return { width: parseFloat(grid.style.width), height: parseFloat(grid.style.height),
        cellW: (parseFloat(grid.style.width)-columns.reduce((a,b)=>a+b,0)*px)/(columns.length+1),
        cellH: (parseFloat(grid.style.height)-rows.reduce((a,b)=>a+b,0)*px)/(rows.length+1) };
}

test('portrait subtracts each individual column gap, rather than enlarging every gap', () => {
    const base = layout('portrait',[1,1,1,1,1],[1,1,1,1,1,1]);
    const changed = layout('portrait',[1,3,1,1,1],[1,1,1,1,1,1]);
    assert.ok(Math.abs((base.cellW-changed.cellW)-2*(96/25.4)/6) < 0.001);
    assert.ok(Math.abs(changed.cellH/changed.cellW-0.9) < 0.001);
});

test('portrait absorbs larger row gaps in spare vertical space without shrinking seats', () => {
    const base = layout('portrait',[1,1,1,1,1],[1,1,1,1,1,1]);
    const changed = layout('portrait',[1,1,1,1,1],[3,3,3,3,3,3]);
    assert.ok(Math.abs(base.cellW-changed.cellW) < 0.001);
    assert.ok(Math.abs(changed.height-base.height-12*96/25.4) < 0.001);
});

test('cropped portrait keeps baseline seat sizes when wider gaps fit in the spare page width', () => {
    const base = layout('portrait',[1,1],[1,1,1,1,1,1]);
    const changed = layout('portrait',[1,3],[1,1,1,1,1,1]);
    assert.ok(Math.abs(base.cellW-changed.cellW)<0.001);
    assert.ok(Math.abs(changed.width-base.width-2*96/25.4)<0.001);
});

test('landscape accounts for all expanded rows and stays within the available page height', () => {
    const changed = layout('landscape',[2,3,1,2,1],[3,3,3,3,3,3],500);
    assert.ok(changed.height <= 500-41-11.34-17.01+0.01);
    assert.ok(Math.abs(changed.cellH/changed.cellW-0.62) < 0.001);
});
