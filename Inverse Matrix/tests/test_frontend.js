// Unit tests for the browser-side helpers in static/script.js.
// Run with: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ui = require(path.join(__dirname, '..', 'static', 'script.js'));

const LIMITS = { maxDimension: 10, minValue: -1000, maxValue: 1000, maxEntryLength: 32 };

test('validateValue accepts the formats the server accepts', () => {
    for (const v of ['5', '-5', '+5', '0.5', '.5', '5.', '-3/4', ' 7 ', '1000', '-1000']) {
        assert.equal(ui.validateValue(v, LIMITS), null, v);
    }
});

test('validateValue classifies problems', () => {
    assert.equal(ui.validateValue('', LIMITS).kind, 'empty');
    assert.equal(ui.validateValue('   ', LIMITS).kind, 'empty');
    for (const v of ['abc', '1e3', '--1', '1/0', '0/0', '1.2.3', '3/-4', '1'.repeat(33)]) {
        assert.equal(ui.validateValue(v, LIMITS).kind, 'invalid', v);
    }
    assert.equal(ui.validateValue('1001', LIMITS).kind, 'range');
    assert.equal(ui.validateValue('-5000/2', LIMITS).kind, 'range');
});

test('matrixIssues reports positions', () => {
    const issues = ui.matrixIssues([['1', ''], ['x', '2']], LIMITS);
    assert.deepEqual(issues.map(i => [i.r, i.c, i.kind]), [[0, 1, 'empty'], [1, 0, 'invalid']]);
});

test('parsePasted handles spreadsheet, CSV, spaces and brackets', () => {
    assert.deepEqual(ui.parsePasted('1\t2\n3\t4\n'), [['1', '2'], ['3', '4']]);
    assert.deepEqual(ui.parsePasted('1, 2\r\n3, 4'), [['1', '2'], ['3', '4']]);
    assert.deepEqual(ui.parsePasted('1  -2   3/4'), [['1', '-2', '3/4']]);
    assert.deepEqual(ui.parsePasted('[1 2; 3 4]'), [['1', '2'], ['3', '4']]);
    assert.deepEqual(ui.parsePasted('7'), [['7']]);
});

test('pastePlacement replaces, grows or reports overflow', () => {
    // Square block into the top-left cell: becomes the whole matrix (may shrink).
    assert.deepEqual(ui.pastePlacement(3, 0, 0, 2, 2, 10), { size: 2, replace: true, fits: true });
    // Non-square block at the top-left: grow to fit, keep other values.
    assert.deepEqual(ui.pastePlacement(2, 0, 0, 2, 4, 10), { size: 4, replace: false, fits: true });
    // Block pasted further in: grow just enough.
    assert.deepEqual(ui.pastePlacement(3, 1, 1, 3, 3, 10), { size: 4, replace: false, fits: true });
    // Fits inside the current matrix: no change of size.
    assert.deepEqual(ui.pastePlacement(5, 0, 1, 2, 2, 10), { size: 5, replace: false, fits: true });
    // Too large: cap at max and report.
    assert.deepEqual(ui.pastePlacement(9, 8, 8, 4, 4, 10), { size: 10, replace: false, fits: false });
});

test('resized keeps existing values and pads with empty cells', () => {
    assert.deepEqual(ui.resized([['1', '2'], ['3', '4']], 3), [['1', '2', ''], ['3', '4', ''], ['', '', '']]);
    assert.deepEqual(ui.resized([['1', '2'], ['3', '4']], 1), [['1']]);
});

test('parseWhole enforces whole numbers in range', () => {
    assert.equal(ui.parseWhole('-10', -1000, 1000), -10);
    assert.equal(ui.parseWhole('1.5', -1000, 1000), null);
    assert.equal(ui.parseWhole('2000', -1000, 1000), null);
});

test('every example is square and valid', () => {
    for (const ex of ui.EXAMPLES) {
        const n = ex.values.length;
        assert.ok(ex.values.every(r => r.length === n), ex.id);
        assert.equal(ui.matrixIssues(ex.values, LIMITS).length, 0, ex.id);
    }
});
