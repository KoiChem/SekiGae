const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const context = vm.createContext({ Number, Math, parseInt });

function loadFunction(name, nextName) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf(`function ${nextName}(`, start);
    assert.ok(start >= 0 && end > start, `${name} source is available`);
    vm.runInContext(source.slice(start, end), context);
}

loadFunction('normalizeColorHex', 'normalizeGenderBorderData');
loadFunction('normalizeGenderBorderData', 'readGenderBorderDataFromMainUi');
loadFunction('mixHexWithWhite', 'getGenderBorderStyle');
loadFunction('getGenderBorderStyle', 'buildSeatContentHtml');

test('old gender border data defaults to fill off', () => {
    const value = context.normalizeGenderBorderData({ active: true, boy: '3', girl: '5', style: 'solid' });
    assert.equal(value.fill, false);
});

test('fill preference survives while the gender border is off', () => {
    const value = context.normalizeGenderBorderData({ active: false, boy: '3', girl: '5', style: 'solid', fill: true });
    assert.equal(value.active, false);
    assert.equal(value.fill, true);
});

test('enabled fill uses the selected gender color at eight percent', () => {
    const cfg = {
        isGbActive: true,
        gbBoy: '3',
        gbGirl: '5',
        gbStyleVal: 'solid',
        gbFill: true,
        colors: { c3: '#D7263D', c5: '#0F7173' }
    };
    assert.deepEqual(
        { ...context.getGenderBorderStyle({ gender: '男' }, cfg, false) },
        { backgroundColor: '#FCEEEF', border: '2px solid var(--c3)' }
    );
    assert.deepEqual(
        { ...context.getGenderBorderStyle({ gender: '女' }, cfg, true) },
        { backgroundColor: '#ECF4F4', border: '1.2px solid var(--c5)' }
    );
});

test('fill does not apply without an active gender border', () => {
    const cfg = { isGbActive: false, gbFill: true, colors: { c3: '#D7263D' } };
    assert.equal(context.getGenderBorderStyle({ gender: '男' }, cfg, false), null);
});
