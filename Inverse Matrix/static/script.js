/* Inverse Workbench — browser interface.
 *
 * The browser only validates and collects input; all mathematics happens on
 * the server with exact fractions. Pure helpers (validation, paste parsing,
 * paste placement, examples) are exported for the Node test suite at the
 * bottom of the file.
 */
'use strict';

var NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d+\/\d+)$/;

var EXAMPLES = [
    { id: '2x2', label: '2 × 2 — whole-number inverse', values: [['2', '1'], ['5', '3']] },
    { id: 'tridiag', label: '3 × 3 — symmetric', values: [['2', '-1', '0'], ['-1', '2', '-1'], ['0', '-1', '2']] },
    { id: 'swap', label: '3 × 3 — needs a row swap', values: [['0', '2', '1'], ['1', '0', '3'], ['2', '1', '0']] },
    { id: 'decimal', label: '2 × 2 — decimals', values: [['0.5', '0.25'], ['1.5', '-2']] },
    { id: 'fraction', label: '2 × 2 — fractions', values: [['1/2', '1/3'], ['1/4', '1/5']] },
    { id: 'diag', label: '4 × 4 — diagonal', values: [['2', '0', '0', '0'], ['0', '-4', '0', '0'], ['0', '0', '5', '0'], ['0', '0', '0', '0.5']] },
    { id: 'singular', label: '3 × 3 — no inverse (singular)', values: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']] }
];

/* ---------- Pure helpers ---------- */

function validateValue(raw, limits) {
    raw = String(raw).trim();
    if (raw === '') return { kind: 'empty', message: 'is empty', remedy: 'Type a number (use 0 for zero).' };
    if (raw.length > limits.maxEntryLength || !NUMBER_PATTERN.test(raw)) {
        return { kind: 'invalid', message: 'is not a number', remedy: 'Use a number such as 2, -0.5 or 3/4.' };
    }
    var value;
    if (raw.indexOf('/') !== -1) {
        var parts = raw.split('/');
        if (Number(parts[1]) === 0) {
            return { kind: 'invalid', message: 'divides by zero', remedy: 'The number under the / cannot be 0.' };
        }
        value = Number(parts[0]) / Number(parts[1]);
    } else {
        value = Number(raw);
    }
    if (!isFinite(value)) {
        return { kind: 'invalid', message: 'is too large', remedy: 'Use a smaller number.' };
    }
    if (value < limits.minValue || value > limits.maxValue) {
        return { kind: 'range', message: 'is outside the allowed range',
                 remedy: 'Use a number from ' + limits.minValue + ' to ' + limits.maxValue + '.' };
    }
    return null;
}

function matrixIssues(values, limits) {
    var issues = [];
    for (var i = 0; i < values.length; i++) {
        for (var j = 0; j < values[i].length; j++) {
            var issue = validateValue(values[i][j], limits);
            if (issue) issues.push({ r: i, c: j, kind: issue.kind, message: issue.message, remedy: issue.remedy });
        }
    }
    return issues;
}

/* Split pasted spreadsheet / text data into rows of cell strings.
 * Rows: newlines or ';'. Columns: tabs, commas or runs of spaces. */
function parsePasted(text) {
    return String(text).replace(/\r/g, '').trim()
        .split(/\n|;/)
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line !== ''; })
        .map(function (line) {
            return line.replace(/^[\[(]+|[\])]+$/g, '').split(/\t|,|\s+/).filter(function (x) { return x !== ''; });
        });
}

/* Decide how a pasted block of `rows` × `width` lands at cell (r0, c0).
 *  - A square block pasted into the top-left cell replaces the whole matrix
 *    and sets its size.
 *  - Otherwise the matrix grows (never shrinks) just enough to fit the block,
 *    up to `max`; anything beyond `max` is reported as not fitting. */
function pastePlacement(size, r0, c0, rows, width, max) {
    if (r0 === 0 && c0 === 0 && rows === width && width <= max) {
        return { size: width, replace: true, fits: true };
    }
    var needed = Math.max(size, r0 + rows, c0 + width);
    return { size: Math.min(needed, max), replace: false, fits: needed <= max };
}

function parseWhole(text, lo, hi) {
    text = String(text).trim();
    if (!/^[+-]?\d+$/.test(text)) return null;
    var n = Number(text);
    return Number.isSafeInteger(n) && n >= lo && n <= hi ? n : null;
}

function emptyMatrix(n) {
    return Array.from({ length: n }, function () {
        return Array.from({ length: n }, function () { return ''; });
    });
}

function resized(values, n) {
    return Array.from({ length: n }, function (_, i) {
        return Array.from({ length: n }, function (_, j) {
            return values[i] && values[i][j] !== undefined ? values[i][j] : '';
        });
    });
}

/* Typographic minus sign for display (U+2212). */
function formatMinus(text) { return String(text).replace(/-/g, '−'); }

/* ---------- Browser UI ---------- */

function startApp() {
    var LIMITS = window.LIMITS;
    var state = {
        size: 3,
        renderedSize: 0,
        values: emptyMatrix(3),
        randMin: -10,
        randMax: 10,
        showEmpty: false,
        result: null,
        stale: false,
        view: 'exact',
        busy: false
    };

    function $(id) { return document.getElementById(id); }
    function esc(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function cells() { return Array.prototype.slice.call(document.querySelectorAll('#matrix-input .cell')); }
    function cellAt(r, c) { return document.querySelector('#matrix-input .cell[data-r="' + r + '"][data-c="' + c + '"]'); }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    var RESULT_SECTIONS = ['result', 'verification', 'steps'];
    var AINV = '<var>A</var><sup>−1</sup>';

    /* ----- Random range ----- */
    function readRange() {
        var min = parseWhole($('rand-min').value, LIMITS.minValue, LIMITS.maxValue);
        var max = parseWhole($('rand-max').value, LIMITS.minValue, LIMITS.maxValue);
        var error = '';
        if (min === null || max === null) {
            error = 'Use whole numbers from ' + LIMITS.minValue + ' to ' + LIMITS.maxValue + '.';
        } else if (min > max) {
            error = 'The first number must not be larger than the second.';
        }
        $('range-error').textContent = error;
        $('rand-min').classList.toggle('bad', !!error);
        $('rand-max').classList.toggle('bad', !!error);
        if (error) return false;
        state.randMin = min;
        state.randMax = max;
        $('range-summary').textContent = formatMinus(min) + ' to ' + formatMinus(max);
        return true;
    }

    /* ----- Messages ----- */
    /* err: {title, message, remedy, action: {label, run}} */
    function showAlert(err) {
        var html = '<div class="alert" role="alert"><div class="alert-body">';
        html += '<p class="alert-title">' + esc(err.title || 'Something went wrong') + '</p>';
        if (err.message) html += '<p>' + esc(err.message) + '</p>';
        if (err.remedy) html += '<p class="alert-fix">' + esc(err.remedy) + '</p>';
        if (err.action) html += '<button type="button" class="btn-tool alert-action">' + esc(err.action.label) + '</button>';
        html += '</div><button type="button" class="alert-close" aria-label="Dismiss message">Dismiss</button></div>';
        $('alert-area').innerHTML = html;
        $('alert-area').querySelector('.alert-close').onclick = clearAlert;
        if (err.action) $('alert-area').querySelector('.alert-action').onclick = err.action.run;
        $('alert-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    function clearAlert() { $('alert-area').innerHTML = ''; }

    /* ----- Matrix input ----- */
    function markChanged() {
        if (!state.result) return;
        state.stale = true;
        $('stale-note').hidden = false;
        RESULT_SECTIONS.forEach(function (id) { $(id).classList.add('stale'); });
        updateStages();
    }

    function renderControls() {
        var dim = state.size + ' × ' + state.size;
        $('size-value').textContent = dim;
        $('space-dim').textContent = dim;
        $('size-minus').disabled = state.size <= 1;
        $('size-plus').disabled = state.size >= LIMITS.maxDimension;
    }

    /* One CSS grid: row 1 holds column numbers, column 1 holds row numbers,
     * and a bracket frame is laid over the n×n block of input cells. */
    function renderMatrix() {
        var n = state.size, prev = state.renderedSize;
        var html = '<div class="mx-grid" style="grid-template-columns: auto repeat(' + n + ', var(--cell-w))"' +
            ' role="group" aria-label="Matrix A, ' + n + ' rows by ' + n + ' columns">';
        html += '<span class="idx idx-corner" aria-hidden="true">A</span>';
        for (var j = 0; j < n; j++) {
            html += '<span class="idx idx-col' + (prev && j >= prev ? ' is-new' : '') + '" data-c="' + j + '" style="grid-row:1;grid-column:' + (j + 2) + '" aria-hidden="true">' + (j + 1) + '</span>';
        }
        html += '<span class="mx-bracket-frame" style="grid-row: 2 / ' + (n + 2) + '" aria-hidden="true"></span>';
        for (var i = 0; i < n; i++) {
            html += '<span class="idx idx-row' + (prev && i >= prev ? ' is-new' : '') + '" data-r="' + i + '" style="grid-row:' + (i + 2) + ';grid-column:1" aria-hidden="true">' + (i + 1) + '</span>';
            for (var c = 0; c < n; c++) {
                var isNew = prev && (i >= prev || c >= prev);
                html += '<input type="text" inputmode="text" autocomplete="off" spellcheck="false" class="cell' + (isNew ? ' is-new' : '') + '"' +
                    ' style="grid-row:' + (i + 2) + ';grid-column:' + (c + 2) + '"' +
                    ' data-r="' + i + '" data-c="' + c + '" value="' + esc(state.values[i][c]) + '"' +
                    ' maxlength="' + LIMITS.maxEntryLength + '"' +
                    ' aria-label="Row ' + (i + 1) + ', column ' + (c + 1) + '">';
            }
        }
        html += '</div>';
        $('matrix-input').innerHTML = html;
        state.renderedSize = n;
        updateStatus();
    }

    function updateStatus() {
        var issues = matrixIssues(state.values, LIMITS);
        cells().forEach(function (cell) {
            cell.classList.remove('bad', 'missing');
            cell.removeAttribute('aria-invalid');
            cell.removeAttribute('title');
        });
        var visible = issues.filter(function (x) { return x.kind !== 'empty' || state.showEmpty; });
        visible.forEach(function (issue) {
            var cell = cellAt(issue.r, issue.c);
            if (!cell) return;
            cell.classList.add(issue.kind === 'empty' ? 'missing' : 'bad');
            cell.setAttribute('aria-invalid', 'true');
            cell.title = 'This cell ' + issue.message + '. ' + issue.remedy;
        });
        var first = visible.filter(function (e) { return e.kind !== 'empty'; })[0] || visible[0];
        $('matrix-error').textContent = first
            ? 'Row ' + (first.r + 1) + ', column ' + (first.c + 1) + ' ' + first.message + '. ' + first.remedy +
              (visible.length > 1 ? ' (' + plural(visible.length, 'cell') + ' need attention.)' : '')
            : '';
        var total = state.size * state.size;
        var empty = issues.filter(function (x) { return x.kind === 'empty'; }).length;
        $('fill-status').textContent = issues.length === 0
            ? 'All ' + total + ' cells filled · ready to calculate'
            : (total - empty) + ' of ' + total + ' cells filled';
        updateStages();
    }

    function setValues(values, size) {
        state.size = size;
        state.values = values;
        state.showEmpty = false;
        markChanged();
        renderControls();
        renderMatrix();
    }

    function resizeMatrix(newSize) {
        newSize = Math.max(1, Math.min(LIMITS.maxDimension, newSize));
        if (newSize === state.size) return;
        setValues(resized(state.values, newSize), newSize);
    }

    function fillRandom() {
        if (!readRange()) { $('range-details').open = true; return; }
        // A random sample may be singular; the calculator reports that honestly.
        setValues(state.values.map(function (row) {
            return row.map(function () { return String(randInt(state.randMin, state.randMax)); });
        }), state.size);
        clearAlert();
    }

    function fillIdentity() {
        setValues(state.values.map(function (row, i) {
            return row.map(function (_, j) { return i === j ? '1' : '0'; });
        }), state.size);
        clearAlert();
    }

    function fillEmptyWithZero() {
        setValues(state.values.map(function (row) {
            return row.map(function (v) { return String(v).trim() === '' ? '0' : v; });
        }), state.size);
        clearAlert();
        var issues = matrixIssues(state.values, LIMITS);
        if (issues.length) { state.showEmpty = true; updateStatus(); }
    }

    function loadExample(id) {
        var example = EXAMPLES.filter(function (e) { return e.id === id; })[0];
        if (!example) return;
        setValues(example.values.map(function (row) { return row.slice(); }), example.values.length);
        clearAlert();
    }

    function handlePaste(e) {
        var target = e.target;
        if (!target.classList.contains('cell')) return;
        var text = (e.clipboardData || window.clipboardData).getData('text');
        var rows = parsePasted(text);
        if (rows.length <= 1 && (!rows[0] || rows[0].length <= 1)) return; // single value: normal paste
        e.preventDefault();
        var r0 = +target.getAttribute('data-r'), c0 = +target.getAttribute('data-c');
        var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
        var place = pastePlacement(state.size, r0, c0, rows.length, width, LIMITS.maxDimension);
        var values = place.replace ? emptyMatrix(place.size) : resized(state.values, place.size);
        rows.forEach(function (row, i) {
            row.forEach(function (v, j) {
                if (r0 + i < place.size && c0 + j < place.size) values[r0 + i][c0 + j] = v;
            });
        });
        setValues(values, place.size);
        if (!place.fits) {
            showAlert({ title: 'Some pasted values did not fit',
                        message: 'The largest matrix size is ' + LIMITS.maxDimension + ' × ' + LIMITS.maxDimension + '. Values outside it were left out.',
                        remedy: 'Paste a smaller block, or paste it into the top-left cell.' });
        } else {
            clearAlert();
        }
        var landing = cellAt(r0, c0);
        if (landing) landing.focus();
    }

    function handleKeydown(e) {
        var t = e.target;
        if (!t.classList.contains('cell')) return;
        var r = +t.getAttribute('data-r'), c = +t.getAttribute('data-c'), n = state.size;
        var atStart = t.selectionStart === 0 && t.selectionEnd === 0;
        var atEnd = t.selectionStart === t.value.length && t.selectionEnd === t.value.length;
        var next = null;
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); solve(); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (r === n - 1 && c === n - 1) { solve(); return; }
            next = c < n - 1 ? cellAt(r, c + 1) : cellAt(r + 1, 0);
        } else if (e.key === 'ArrowUp' && r > 0) next = cellAt(r - 1, c);
        else if (e.key === 'ArrowDown' && r < n - 1) next = cellAt(r + 1, c);
        else if (e.key === 'ArrowLeft' && atStart && c > 0) next = cellAt(r, c - 1);
        else if (e.key === 'ArrowRight' && atEnd && c < n - 1) next = cellAt(r, c + 1);
        if (next) { e.preventDefault(); next.focus(); next.select(); }
    }

    /* Highlight the row and column numbers of the focused cell. */
    function markActiveIndices(cell) {
        document.querySelectorAll('#matrix-input .idx.is-active').forEach(function (el) { el.classList.remove('is-active'); });
        if (!cell) return;
        var r = cell.getAttribute('data-r'), c = cell.getAttribute('data-c');
        var row = document.querySelector('#matrix-input .idx-row[data-r="' + r + '"]');
        var col = document.querySelector('#matrix-input .idx-col[data-c="' + c + '"]');
        if (row) row.classList.add('is-active');
        if (col) col.classList.add('is-active');
    }

    /* ----- Result rendering ----- */
    function matrixHTML(rows, extraClass) {
        var html = '<div class="mx ' + (extraClass || '') + '"><table>';
        rows.forEach(function (row) {
            html += '<tr>' + row.map(function (v) { return '<td>' + esc(formatMinus(v)) + '</td>'; }).join('') + '</tr>';
        });
        return html + '</table></div>';
    }

    function identityRows(n) {
        return Array.from({ length: n }, function (_, i) {
            return Array.from({ length: n }, function (_, j) { return i === j ? '1' : '0'; });
        });
    }

    function figure(label, note, body, cls) {
        return '<figure class="result-fig ' + (cls || '') + '"><figcaption><span class="fig-label">' + label +
            '</span>' + (note ? '<span class="fig-note">' + note + '</span>' : '') + '</figcaption>' + body + '</figure>';
    }

    function renderResults() {
        var d = state.result;
        var html;
        var det = esc(formatMinus(d.determinant));
        if (d.invertible) {
            var decimal = state.view === 'decimal';
            html = '<div class="verdict-banner ok" role="status"><span class="verdict-icon" aria-hidden="true">✓</span><div>' +
                '<p class="verdict-title">This matrix has an inverse</p>' +
                '<p class="verdict-text">The determinant is ' + det +
                (d.determinant.indexOf('/') !== -1 ? ' (about ' + esc(formatMinus(d.determinant_decimal)) + ')' : '') +
                '. Because it is not 0, <var>A</var> has exactly one inverse.</p></div></div>';
            html += '<div class="result-display">';
            html += figure('Your matrix', '<var>A</var>', matrixHTML(d.matrix, 'mx-orig'), 'is-original');
            html += '<span class="result-arrow" aria-hidden="true">→</span>';
            html += figure('Inverse', AINV, matrixHTML(decimal ? d.inverse_decimal : d.inverse, 'mx-lg mx-accent'), 'is-answer');
            html += '</div>';
            if (!decimal && d.inverse_factored) {
                // Keep the whole equation in one non-wrapping group so A and its −1 stay together.
                html += '<div class="factored"><span class="factored-text">Same answer with the common fraction taken out:</span>' +
                    '<span class="factored-eq"><span class="eq-term">' + AINV + '</span><span>=</span>' +
                    '<span class="eq-scalar" aria-label="1 over ' + esc(d.inverse_factored.denominator) + '">' +
                    '<span class="frac-num">1</span><span class="frac-den">' + esc(d.inverse_factored.denominator) + '</span></span>' +
                    '<span>×</span>' + matrixHTML(d.inverse_factored.matrix, 'mx-inline') + '</span></div>';
            }
            html += '<div class="result-tools">' +
                '<span class="control-label" id="format-label">Show numbers as</span>' +
                '<div class="segmented" role="group" aria-labelledby="format-label">' +
                '<button type="button" data-view="exact" aria-pressed="' + !decimal + '">Fractions (exact)</button>' +
                '<button type="button" data-view="decimal" aria-pressed="' + decimal + '">Decimals</button></div>' +
                '<button type="button" class="btn-tool" id="copy-btn">Copy inverse</button>' +
                '<button type="button" class="btn-tool" data-go="workspace">Edit matrix</button>' +
                '<span class="tool-note" aria-live="polite" id="copy-status">' + (decimal
                    ? 'Decimals are rounded to 6 significant digits.'
                    : '') + '</span></div>';
            html += '<dl class="facts">' +
                '<div class="fact"><dt>Determinant</dt><dd>' + det + '</dd></div>' +
                '<div class="fact"><dt>Size</dt><dd>' + d.size + ' × ' + d.size + '</dd></div>' +
                '<div class="fact"><dt>Steps used</dt><dd>' + d.step_count + '</dd></div>' +
                '<div class="fact"><dt>Check</dt><dd class="ok-text">' + (d.verification.right_ok && d.verification.left_ok ? 'Passed' : 'Failed') + '</dd></div></dl>';
        } else {
            html = '<div class="verdict-banner fail" role="status"><span class="verdict-icon" aria-hidden="true">✕</span><div>' +
                '<p class="verdict-title">This matrix has no inverse</p>' +
                '<p class="verdict-text">The determinant is 0, so <var>A</var> is <strong>singular</strong>. Some of its rows depend on others, ' +
                'so no matrix can undo it.</p></div></div>';
            html += '<div class="result-display">' + figure('Your matrix', '<var>A</var>', matrixHTML(d.matrix, 'mx-orig mx-lg'), 'is-original') + '</div>';
            html += '<p class="singular-note">The calculation stopped at column ' + d.failure_column +
                ': it has only zeros on and below the diagonal, so it cannot be turned into a 1. ' +
                '<a href="#steps" data-go="steps">See where it stopped (Step 5)</a>.</p>';
            html += '<div class="result-tools"><button type="button" class="btn-tool" data-go="workspace">Edit matrix</button></div>';
            html += '<dl class="facts">' +
                '<div class="fact"><dt>Determinant</dt><dd>0</dd></div>' +
                '<div class="fact"><dt>Size</dt><dd>' + d.size + ' × ' + d.size + '</dd></div>' +
                '<div class="fact"><dt>Stopped at</dt><dd>column ' + d.failure_column + '</dd></div>' +
                '<div class="fact"><dt>Steps used</dt><dd>' + d.step_count + '</dd></div></dl>';
        }
        $('result-body').innerHTML = html;
        $('result-meta').textContent = d.invertible ? 'Inverse found' : 'No inverse';
    }

    function renderVerification() {
        var d = state.result, html;
        if (d.invertible) {
            var v = d.verification, ok = v.right_ok && v.left_ok, I = identityRows(d.size);
            html = '<div class="verdict-banner ' + (ok ? 'ok' : 'fail') + '" role="status"><span class="verdict-icon" aria-hidden="true">' + (ok ? '✓' : '✕') + '</span><div>' +
                '<p class="verdict-title">' + (ok ? 'Check passed: the answer is correct' : 'Check failed') + '</p>' +
                '<p class="verdict-text">An inverse must give the identity matrix <var>I</var> (1s on the diagonal, 0s elsewhere) when multiplied with <var>A</var> in either order. ' +
                (ok ? 'Both products below are exactly <var>I</var>.' : 'At least one product is not <var>I</var>.') + '</p></div></div>';
            [{ lhs: '<var>A</var> × ' + AINV, product: v.right, ok: v.right_ok },
             { lhs: AINV + ' × <var>A</var>', product: v.left, ok: v.left_ok }].forEach(function (row) {
                html += '<div class="verify-row"><div class="verify-eq"><span class="eq-lhs">' + row.lhs + ' =</span>' +
                    matrixHTML(row.product, row.ok ? 'identity-mx' : '') +
                    (d.size <= 4 ? '<span class="eq-op">' + (row.ok ? '=' : '≠') + '</span>' + matrixHTML(I) + '<span class="eq-lhs"><var>I</var></span>' : '') +
                    '</div><p class="verdict ' + (row.ok ? 'ok' : 'fail') + '"><strong>' + (row.ok ? 'Matches I' : 'Does not match I') + '</strong>' +
                    '<span>' + (row.ok ? 'all ' + d.size * d.size + ' numbers agree' : 'some numbers differ') + '</span></p></div>';
            });
            html += '<p class="verify-foot">The products are recomputed from the exact fractions and compared exactly. Nothing is rounded.</p>';
        } else {
            html = '<div class="verdict-banner fail" role="status"><span class="verdict-icon" aria-hidden="true">✕</span><div>' +
                '<p class="verdict-title">Nothing to check: there is no inverse</p>' +
                '<p class="verdict-text">If some matrix <var>X</var> gave <var>A</var> × <var>X</var> = <var>I</var>, then det <var>A</var> × det <var>X</var> would be 1. ' +
                'That is impossible when det <var>A</var> = 0.</p></div></div>';
        }
        $('verify-body').innerHTML = html;
    }

    function renderSteps() {
        var d = state.result;
        $('steps-body').innerHTML = d.solution_html;
        $('steps-meta').textContent = d.step_count === 0 ? 'No steps needed' : plural(d.step_count, 'row operation');
        var hasSteps = d.step_count > 0;
        $('expand-all-btn').hidden = !hasSteps;
        $('collapse-all-btn').hidden = !hasSteps;
        // Open the first step so first-time users see what a step contains.
        var first = $('steps-body').querySelector('details.step');
        if (first) first.open = true;
    }

    function setAllSteps(open) {
        document.querySelectorAll('#steps-body details.step').forEach(function (el) { el.open = open; });
    }

    function renderResult() {
        renderResults();
        renderVerification();
        renderSteps();
        state.stale = false;
        $('stale-note').hidden = true;
        RESULT_SECTIONS.forEach(function (id) {
            var section = $(id);
            section.classList.remove('stale', 'is-entering');
            section.hidden = false;
            void section.offsetWidth; // restart the entrance animation
            section.classList.add('is-entering');
        });
        setNavAvailability(true);
        updateStages();
        $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('result-title').focus({ preventScroll: true });
    }

    function copyInverse() {
        var d = state.result;
        var rows = state.view === 'decimal' ? d.inverse_decimal : d.inverse;
        var text = rows.map(function (r) { return r.join('\t'); }).join('\n');
        var status = $('copy-status');
        function done(ok) {
            status.textContent = ok
                ? 'Copied. Paste it into a spreadsheet or document.'
                : 'Copying is blocked by the browser. Select the numbers and copy them manually.';
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
        } else {
            done(fallbackCopy(text));
        }
    }

    function fallbackCopy(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(area);
        return ok;
    }

    function setBusy(busy) {
        state.busy = busy;
        var button = $('solve-btn');
        button.disabled = busy;
        button.classList.toggle('loading', busy);
        button.setAttribute('aria-busy', String(busy));
        button.querySelector('.btn-label').textContent = busy ? 'Calculating…' : 'Calculate inverse';
    }

    function solve() {
        if (state.busy) return;
        state.showEmpty = true;
        updateStatus();
        var issues = matrixIssues(state.values, LIMITS);
        if (issues.length) {
            var missing = issues.filter(function (x) { return x.kind === 'empty'; }).length;
            var other = issues.length - missing;
            var bits = [];
            if (missing) bits.push(plural(missing, 'empty cell'));
            if (other) bits.push(plural(other, 'cell') + ' that ' + (other === 1 ? 'is' : 'are') + ' not a valid number');
            showAlert({
                title: 'The matrix is not complete yet',
                message: 'There ' + (issues.length === 1 ? 'is ' : 'are ') + bits.join(' and ') + ' (marked in the grid).',
                remedy: other ? 'Fix the red cells. Hover over one to see what is wrong.' : 'Type a number in each marked cell.',
                action: missing ? { label: 'Fill empty cells with 0', run: fillEmptyWithZero } : null
            });
            var first = cellAt(issues[0].r, issues[0].c);
            if (first) first.focus();
            return;
        }
        clearAlert();
        setBusy(true);
        // Send strings so decimals and fractions stay exact on the server.
        fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matrix: state.values })
        }).then(function (response) {
            var type = response.headers.get('Content-Type') || '';
            if (type.indexOf('application/json') === -1) {
                throw { server: true, status: response.status };
            }
            return response.json();
        }).then(function (data) {
            if (data.success) { state.result = data; renderResult(); }
            else showAlert(data.error || { title: 'The calculation failed' });
        }).catch(function (err) {
            if (err && err.server) {
                showAlert({ title: 'Unexpected reply from the calculator', message: 'The server answered with status ' + err.status + '.',
                            remedy: 'Close and reopen the app, then try again.' });
            } else {
                console.error(err);
                showAlert({ title: 'Cannot reach the calculator', message: 'The page could not connect to the local server.',
                            remedy: 'Keep the launcher window open, then try again.' });
            }
        }).then(function () { setBusy(false); });
    }

    function reset() {
        state.result = null;
        state.stale = false;
        state.view = 'exact';
        clearAlert();
        $('example-select').value = '';
        RESULT_SECTIONS.forEach(function (id) { $(id).hidden = true; $(id).classList.remove('stale', 'is-entering'); });
        ['result-body', 'verify-body', 'steps-body'].forEach(function (id) { $(id).innerHTML = ''; });
        setNavAvailability(false);
        state.renderedSize = 0;
        setValues(emptyMatrix(3), 3);
        goTo('workspace');
    }

    /* Scroll to a section; returning to the matrix focuses its first cell. */
    function goTo(id) {
        var target = id === 'calculate' ? $('calculate') : $(id);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: id === 'calculate' ? 'center' : 'start' });
        if (id === 'workspace') { var c = cellAt(0, 0); if (c) c.focus({ preventScroll: true }); }
        else if (id === 'calculate') $('solve-btn').focus({ preventScroll: true });
        history.replaceState(null, '', '#' + id);
    }

    /* ----- Theme ----- */
    function currentTheme() {
        var explicit = document.documentElement.getAttribute('data-theme');
        if (explicit) return explicit;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function syncThemeButton() {
        var dark = currentTheme() === 'dark';
        $('theme-toggle').textContent = dark ? 'Light' : 'Dark';
        $('theme-toggle').setAttribute('aria-pressed', String(dark));
        $('theme-toggle').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    function toggleTheme() {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('matrix-theme', next); } catch (err) { /* storage unavailable: theme lasts this visit */ }
        syncThemeButton();
    }

    /* ----- Workflow stages (masthead) ----- */
    function setNavAvailability(available) {
        document.querySelectorAll('.stage[data-needs-result]').forEach(function (a) {
            if (available) { a.removeAttribute('aria-disabled'); a.removeAttribute('title'); }
            else { a.setAttribute('aria-disabled', 'true'); a.title = 'Available after you calculate'; }
        });
    }

    /* A stage is "done" when its work is complete: all cells valid (1),
     * a current result exists (2–5). */
    function updateStages() {
        var ready = matrixIssues(state.values, LIMITS).length === 0;
        var fresh = !!state.result && !state.stale;
        var done = { enter: ready, calculate: fresh, result: fresh, verify: fresh, steps: fresh };
        document.querySelectorAll('.stage').forEach(function (a) {
            a.classList.toggle('is-done', !!done[a.getAttribute('data-stage')]);
        });
    }

    function setupNav() {
        var links = Array.prototype.slice.call(document.querySelectorAll('.stage, .help-link'));
        links.forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                if (a.getAttribute('aria-disabled') === 'true') return;
                goTo(a.getAttribute('href').slice(1));
            });
        });
        if (!('IntersectionObserver' in window)) return;
        var map = { workspace: 'enter', result: 'result', verification: 'verify', steps: 'steps' };
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var key = entry.target.id === 'calculate' ? 'calculate' : map[entry.target.id];
                document.querySelectorAll('.stage').forEach(function (a) {
                    var current = a.getAttribute('data-stage') === key;
                    a.classList.toggle('is-current', current);
                    if (current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['workspace', 'calculate', 'result', 'verification', 'steps'].forEach(function (id) { observer.observe($(id)); });
    }

    /* ----- Wiring ----- */
    function setupEvents() {
        $('size-minus').onclick = function () { resizeMatrix(state.size - 1); };
        $('size-plus').onclick = function () { resizeMatrix(state.size + 1); };
        $('random-btn').onclick = fillRandom;
        $('identity-btn').onclick = fillIdentity;
        $('clear-btn').onclick = function () { setValues(emptyMatrix(state.size), state.size); clearAlert(); };
        $('example-select').onchange = function () { loadExample(this.value); };
        $('solve-btn').onclick = solve;
        $('recalc-btn').onclick = solve;
        $('reset-btn').onclick = reset;
        $('theme-toggle').onclick = toggleTheme;
        $('expand-all-btn').onclick = function () { setAllSteps(true); };
        $('collapse-all-btn').onclick = function () { setAllSteps(false); };
        ['rand-min', 'rand-max'].forEach(function (id) { $(id).addEventListener('input', readRange); });

        var input = $('matrix-input');
        input.addEventListener('input', function (e) {
            if (!e.target.classList.contains('cell')) return;
            state.values[+e.target.getAttribute('data-r')][+e.target.getAttribute('data-c')] = e.target.value;
            updateStatus();
            markChanged();
        });
        input.addEventListener('keydown', handleKeydown);
        input.addEventListener('paste', handlePaste);
        input.addEventListener('focusin', function (e) {
            if (!e.target.classList.contains('cell')) return;
            e.target.select();
            markActiveIndices(e.target);
        });
        input.addEventListener('focusout', function () { markActiveIndices(null); });

        // "Edit matrix" / "See where it stopped" links inside rendered results.
        document.addEventListener('click', function (e) {
            var go = e.target.closest('[data-go]');
            if (!go) return;
            e.preventDefault();
            goTo(go.getAttribute('data-go'));
        });

        $('result-body').addEventListener('click', function (e) {
            var view = e.target.closest('[data-view]');
            if (view) { state.view = view.getAttribute('data-view'); renderResults(); return; }
            if (e.target.closest('#copy-btn')) copyInverse();
        });

        // Pointing at a highlighted row traces that row through the matrices of a step.
        $('steps-body').addEventListener('mouseover', function (e) {
            var source = e.target.closest('[data-hl]');
            var root = e.target.closest('.sol-step');
            document.querySelectorAll('#steps-body .hl-target').forEach(function (el) { el.classList.remove('hl-target'); });
            if (!source || !root) return;
            var key = source.getAttribute('data-hl');
            root.querySelectorAll('[data-hl="' + key + '"]').forEach(function (el) { el.classList.add('hl-target'); });
        });
        $('steps-body').addEventListener('mouseleave', function () {
            document.querySelectorAll('#steps-body .hl-target').forEach(function (el) { el.classList.remove('hl-target'); });
        });
        // Entrance classes are removed once played so later re-renders start clean.
        document.addEventListener('animationend', function (e) {
            if (e.target.classList && e.target.classList.contains('is-new')) e.target.classList.remove('is-new');
        });
    }

    var select = $('example-select');
    EXAMPLES.forEach(function (ex) {
        var option = document.createElement('option');
        option.value = ex.id;
        option.textContent = ex.label;
        select.appendChild(option);
    });
    $('rand-min').value = state.randMin;
    $('rand-max').value = state.randMax;
    setupEvents();
    setupNav();
    setNavAvailability(false);
    syncThemeButton();
    renderControls();
    renderMatrix();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', startApp);
    else startApp();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateValue: validateValue, matrixIssues: matrixIssues, parsePasted: parsePasted,
                       pastePlacement: pastePlacement, parseWhole: parseWhole, resized: resized,
                       emptyMatrix: emptyMatrix, EXAMPLES: EXAMPLES };
}
