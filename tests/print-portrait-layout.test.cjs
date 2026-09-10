const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');

function loadPrintGridLayout(orientation, computedStyles) {
    const start = appSource.indexOf('function fitPrintGridLayout(');
    const end = appSource.indexOf('function autoFitPrintText(', start);
    assert.ok(start >= 0 && end > start, 'fitPrintGridLayout source is available');
    const context = vm.createContext({
        Math,
        Number,
        parseFloat,
        printOrientation: orientation,
        NUM_COLS: 6,
        window: { getComputedStyle: element => computedStyles.get(element) }
    });
    vm.runInContext(appSource.slice(start, end), context);
    return context.fitPrintGridLayout;
}

function layoutFixture() {
    const grid = {
        style: {},
        closest: () => classroom
    };
    const desk = { getBoundingClientRect: () => ({ height: 41 }) };
    const classroom = {
        querySelector: () => desk,
        getBoundingClientRect: () => ({ width: 718, height: 1047 })
    };
    const computedStyles = new Map([
        [grid, { columnGap: '3.78px', rowGap: '3.78px' }],
        [classroom, { paddingLeft: '5.67px', paddingRight: '5.67px', paddingTop: '5.67px', paddingBottom: '5.67px', rowGap: '17.01px' }]
    ]);
    return { grid, computedStyles };
}

test('A4 portrait seats use the available vertical space with a readable 0.9 height ratio', () => {
    const { grid, computedStyles } = layoutFixture();
    const fit = loadPrintGridLayout('portrait', computedStyles);
    fit(grid, 7, 6);
    const cellWidth = (parseFloat(grid.style.width) - 5 * 3.78) / 6;
    const cellHeight = (parseFloat(grid.style.height) - 6 * 3.78) / 7;
    assert.ok(Math.abs(cellHeight / cellWidth - 0.9) < 0.001);
});

test('A4 portrait alone adds vertical seat padding and triples the desk gap', () => {
    assert.match(cssSource, /body\.print-orientation-portrait \.print-classroom\s*\{[^}]*gap:\s*4\.5mm;/s);
    assert.match(cssSource, /body\.print-orientation-portrait \.print-seat-content\s*\{[^}]*padding:\s*1\.5mm 0;/s);
});
