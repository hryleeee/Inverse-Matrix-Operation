/* Inverse Workbench — browser interface.
 *
 * The browser only validates and collects input; all mathematics happens on
 * the server with exact fractions. Pure helpers (validation, paste parsing,
 * examples) are exported for the Node test suite at the bottom of the file.
 */
'use strict';

var NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d+\/\d+)$/;

var EXAMPLES = [
    { id: '2x2', label: '2 × 2 — integer inverse', values: [['2', '1'], ['5', '3']] },
    { id: 'tridiag', label: '3 × 3 — tridiagonal', values: [['2', '-1', '0'], ['-1', '2', '-1'], ['0', '-1', '2']] },
    { id: 'swap', label: '3 × 3 — needs a row swap', values: [['0', '2', '1'], ['1', '0', '3'], ['2', '1', '0']] },
    { id: 'decimal', label: '2 × 2 — decimals', values: [['0.5', '0.25'], ['1.5', '-2']] },
    { id: 'fraction', label: '2 × 2 — fractions', values: [['1/2', '1/3'], ['1/4', '1/5']] },
    { id: 'diag', label: '4 × 4 — diagonal', values: [['2', '0', '0', '0'], ['0', '-4', '0', '0'], ['0', '0', '5', '0'], ['0', '0', '0', '0.5']] },
    { id: 'singular', label: '3 × 3 — singular', values: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']] }
];

var VISIBLE_STEPS = 6;    // steps shown when a long log is collapsed
var COLLAPSE_ABOVE = 10;  // only logs longer than this start collapsed

/* ---------- Pure helpers ---------- */

function validateValue(raw, limits) {
    raw = String(raw).trim();
    if (raw === '') return { kind: 'empty', message: 'is empty', remedy: 'Fill in the cell.' };
    if (raw.length > limits.maxEntryLength || !NUMBER_PATTERN.test(raw)) {
        return { kind: 'invalid', message: 'is not a valid number', remedy: 'Use a number such as 2, -0.5 or 3/4.' };
    }
    var value;
    if (raw.indexOf('/') !== -1) {
        var parts = raw.split('/');
        if (Number(parts[1]) === 0) {
            return { kind: 'invalid', message: 'divides by zero', remedy: 'Use a nonzero denominator.' };
        }
        value = Number(parts[0]) / Number(parts[1]);
    } else {
        value = Number(raw);
    }
    if (!isFinite(value)) {
        return { kind: 'invalid', message: 'is not a finite number', remedy: 'Use a smaller number.' };
    }
    if (value < limits.minValue || value > limits.maxValue) {
        return { kind: 'range', message: 'is outside the allowed range',
                 remedy: 'Use values from ' + limits.minValue + ' to ' + limits.maxValue + '.' };
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
        view: 'exact',
        busy: false,
        stepsExpanded: false
    };

    function $(id) { return document.getElementById(id); }
    function esc(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function cells() { return Array.prototype.slice.call(document.querySelectorAll('#matrix-input .cell')); }
    function cellAt(r, c) { return document.querySelector('#matrix-input .cell[data-r="' + r + '"][data-c="' + c + '"]'); }
    var RESULT_SECTIONS = ['result', 'verification', 'steps'];

    /* ----- Random range ----- */
    function readRange() {
        var min = parseWhole($('rand-min').value, LIMITS.minValue, LIMITS.maxValue);
        var max = parseWhole($('rand-max').value, LIMITS.minValue, LIMITS.maxValue);
        var error = '';
        if (min === null || max === null) {
            error = 'The random range must use whole numbers from ' + LIMITS.minValue + ' to ' + LIMITS.maxValue + '.';
        } else if (min > max) {
            error = 'The lowest value is greater than the highest value.';
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

    /* ----- Alerts ----- */
    function showAlert(err) {
        var html = '<div class="alert" role="alert"><div class="alert-body">';
        html += '<p class="alert-title">' + esc(err.title || 'Something went wrong') + '</p>';
        if (err.message) html += '<p>' + esc(err.message) + '</p>';
        if (err.remedy) html += '<p class="alert-fix">' + esc(err.remedy) + '</p>';
        html += '</div><button type="button" class="alert-close" aria-label="Dismiss message">dismiss</button></div>';
        $('alert-area').innerHTML = html;
        $('alert-area').querySelector('.alert-close').onclick = clearAlert;
        $('alert-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    function clearAlert() { $('alert-area').innerHTML = ''; }

    /* ----- Matrix input ----- */
    function markChanged() {
        if (!state.result) return;
        $('stale-note').hidden = false;
        RESULT_SECTIONS.forEach(function (id) { $(id).classList.add('stale'); });
    }

    function renderControls() {
        $('size-value').textContent = state.size + ' × ' + state.size;
        $('space-dim').textContent = state.size + '×' + state.size;
        $('size-minus').disabled = state.size <= 1;
        $('size-plus').disabled = state.size >= LIMITS.maxDimension;
    }

    /* One CSS grid: row 1 holds column indices, column 1 holds row indices,
     * and a bracket frame is laid over the n×n block of input cells. */
    function renderMatrix() {
        var n = state.size, prev = state.renderedSize;
        var html = '<div class="mx-grid" style="grid-template-columns: auto repeat(' + n + ', var(--cell-w))"' +
            ' role="group" aria-label="Matrix A, ' + n + ' by ' + n + '">';
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
        });
        var visible = issues.filter(function (x) { return x.kind !== 'empty' || state.showEmpty; });
        visible.forEach(function (issue) {
            var cell = cellAt(issue.r, issue.c);
            if (!cell) return;
            cell.classList.add(issue.kind === 'empty' ? 'missing' : 'bad');
            cell.setAttribute('aria-invalid', 'true');
        });
        var first = visible.filter(function (e) { return e.kind !== 'empty'; })[0] || visible[0];
        $('matrix-error').textContent = first
            ? 'Row ' + (first.r + 1) + ', column ' + (first.c + 1) + ' ' + first.message + '. ' + first.remedy +
              (visible.length > 1 ? ' (' + visible.length + ' cells need attention.)' : '')
            : '';
        var total = state.size * state.size;
        var empty = issues.filter(function (x) { return x.kind === 'empty'; }).length;
        $('fill-status').textContent = (total - empty) + ' of ' + total + ' entries' +
            (issues.length === 0 ? ' · ready' : '');
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
        // A random sample may be singular; the solver reports that honestly.
        setValues(state.values.map(function (row) {
            return row.map(function () { return String(randInt(state.randMin, state.randMax)); });
        }), state.size);
    }

    function fillIdentity() {
        setValues(state.values.map(function (row, i) {
            return row.map(function (_, j) { return i === j ? '1' : '0'; });
        }), state.size);
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
        var values, size = state.size;
        // A square block pasted into the top-left cell defines the whole matrix.
        if (r0 === 0 && c0 === 0 && rows.length === width && width <= LIMITS.maxDimension) {
            size = width;
            values = emptyMatrix(size);
        } else {
            values = state.values.map(function (row) { return row.slice(); });
        }
        rows.forEach(function (row, i) {
            row.forEach(function (v, j) {
                if (r0 + i < size && c0 + j < size) values[r0 + i][c0 + j] = v;
            });
        });
        setValues(values, size);
        if (rows.length > size - r0 || width > size - c0) {
            showAlert({ title: 'Some pasted values did not fit',
                        message: 'The pasted block is larger than the space available from that cell.',
                        remedy: 'Increase the order first, or paste a square block into the top-left cell.' });
        }
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

    /* Light up the row and column indices of the focused cell (coordinates). */
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

    var AINV = '<var>A</var><sup>−1</sup>';

    function renderInverse() {
        var d = state.result;
        var html;
        if (d.invertible) {
            var decimal = state.view === 'decimal';
            var det = formatMinus(d.determinant) +
                (d.determinant.indexOf('/') !== -1 ? ' <span class="approx">≈ ' + esc(formatMinus(d.determinant_decimal)) + '</span>' : '');
            html = '<p class="status ok"><span class="status-tag">Invertible</span>' +
                '<span>det <var>A</var> = ' + esc(formatMinus(d.determinant)) + ' ≠ 0, so ' + AINV + ' exists and is unique.</span></p>';
            html += '<div class="result-display">';
            html += '<div class="result-main"><span class="eq-lhs">' + AINV + ' =</span>' +
                matrixHTML(decimal ? d.inverse_decimal : d.inverse, 'mx-lg mx-accent') + '</div>';
            if (!decimal && d.inverse_factored) {
                html += '<div class="result-main"><span class="eq-op">=</span>' +
                    '<span class="eq-scalar" aria-label="1 over ' + esc(d.inverse_factored.denominator) + '">' +
                    '<span class="frac-num">1</span><span class="frac-den">' + esc(d.inverse_factored.denominator) + '</span></span>' +
                    matrixHTML(d.inverse_factored.matrix, 'mx-lg') + '</div>';
            }
            html += '</div>';
            html += '<dl class="facts">' +
                '<div class="fact"><dt>det A</dt><dd>' + det + '</dd></div>' +
                '<div class="fact"><dt>Order</dt><dd>' + d.size + ' × ' + d.size + '</dd></div>' +
                '<div class="fact"><dt>Row operations</dt><dd>' + d.step_count + '</dd></div>' +
                '<div class="fact"><dt>Arithmetic</dt><dd>exact ℚ</dd></div></dl>';
            html += '<div class="result-tools"><div class="segmented" role="group" aria-label="Number format">' +
                '<button type="button" data-view="exact" aria-pressed="' + !decimal + '">Exact</button>' +
                '<button type="button" data-view="decimal" aria-pressed="' + decimal + '">Decimal</button></div>' +
                '<button type="button" class="text-btn" id="copy-btn">Copy ' + AINV + ' as rows</button>' +
                '<span class="tool-note">' + (decimal
                    ? 'Decimals are rounded to 6 significant digits; the exact values are used everywhere else.'
                    : 'Copied values are tab-separated and paste into a spreadsheet.') + '</span></div>';
        } else {
            html = '<p class="status fail"><span class="status-tag">Singular</span>' +
                '<span>det <var>A</var> = 0, so ' + AINV + ' does not exist.</span></p>';
            html += '<div class="result-display"><div class="result-main"><span class="eq-lhs"><var>A</var> =</span>' +
                matrixHTML(d.matrix, 'mx-lg') + '</div></div>';
            html += '<dl class="facts">' +
                '<div class="fact"><dt>det A</dt><dd>0</dd></div>' +
                '<div class="fact"><dt>Order</dt><dd>' + d.size + ' × ' + d.size + '</dd></div>' +
                '<div class="fact"><dt>Missing pivot</dt><dd>column ' + d.failure_column + '</dd></div>' +
                '<div class="fact"><dt>Row operations</dt><dd>' + d.step_count + '</dd></div></dl>';
            html += '<p class="singular-note">Elimination finds no nonzero pivot in column ' + d.failure_column +
                ', so no sequence of row operations turns <var>A</var> into <var>I</var>. The columns of <var>A</var> are linearly dependent. ' +
                '<a href="#steps">See where the reduction stops (§4).</a></p>';
        }
        $('result-body').innerHTML = html;
        $('result-meta').textContent = d.invertible
            ? d.size + ' × ' + d.size + ' · ' + d.step_count + ' elementary matrices'
            : 'No inverse';
    }

    function renderVerification() {
        var d = state.result, html;
        if (d.invertible) {
            var v = d.verification, I = identityRows(d.size);
            var rows = [
                { lhs: '<var>A</var> · ' + AINV, product: v.right, ok: v.right_ok },
                { lhs: AINV + ' · <var>A</var>', product: v.left, ok: v.left_ok }
            ];
            html = rows.map(function (row) {
                return '<div class="verify-row"><div class="verify-eq"><span class="eq-lhs">' + row.lhs + ' =</span>' +
                    matrixHTML(row.product, row.ok ? 'identity-mx' : '') +
                    '<span class="eq-op">' + (row.ok ? '=' : '≠') + '</span><span class="eq-lhs"><var>I</var></span>' +
                    (d.size <= 4 ? matrixHTML(I) : '') + '</div>' +
                    '<p class="verdict ' + (row.ok ? 'ok' : 'fail') + '"><strong>' + (row.ok ? 'Holds' : 'Fails') + '</strong>' +
                    '<span>' + (row.ok ? d.size * d.size + ' of ' + d.size * d.size + ' entries equal' : 'entries differ') + '</span></p></div>';
            }).join('');
            html += '<p class="verify-foot">Both products are computed again from the exact fractions after the inverse is found and compared with <var>I</var> for exact equality. No tolerance is used. ' +
                'A one-sided inverse of a square matrix is always two-sided; both sides are shown anyway.</p>';
        } else {
            html = '<div class="verify-row"><div class="verify-eq"><span class="eq-lhs"><var>A</var> · <var>X</var> = <var>I</var></span></div>' +
                '<p class="verdict fail"><strong>No solution</strong><span>det A = 0</span></p></div>' +
                '<p class="verify-foot">There is no matrix <var>X</var> to check. If <var>AX</var> = <var>I</var>, then det <var>A</var> · det <var>X</var> = 1, which is impossible when det <var>A</var> = 0.</p>';
        }
        $('verify-body').innerHTML = html;
    }

    function renderSteps() {
        var d = state.result;
        $('steps-body').innerHTML = d.solution_html;
        $('steps-meta').textContent = d.step_count === 1 ? '1 elementary matrix' : d.step_count + ' elementary matrices';
        state.stepsExpanded = false;
        applyStepCollapse();
    }

    function applyStepCollapse() {
        var list = $('steps-body').querySelector('.sol-steps');
        var button = $('show-all-btn');
        var count = state.result ? state.result.step_count : 0;
        if (!list || count <= COLLAPSE_ABOVE) { button.hidden = true; list && list.classList.remove('is-collapsed'); return; }
        list.classList.toggle('is-collapsed', !state.stepsExpanded);
        button.hidden = false;
        button.textContent = state.stepsExpanded
            ? 'Show only the first ' + VISIBLE_STEPS + ' steps'
            : 'Show all ' + count + ' steps (' + (count - VISIBLE_STEPS) + ' more)';
        button.setAttribute('aria-expanded', String(state.stepsExpanded));
    }

    function setNavAvailability(available) {
        document.querySelectorAll('.nav a[data-needs-result]').forEach(function (a) {
            if (available) a.removeAttribute('aria-disabled');
            else a.setAttribute('aria-disabled', 'true');
        });
    }

    function renderResult() {
        renderInverse();
        renderVerification();
        renderSteps();
        $('stale-note').hidden = true;
        RESULT_SECTIONS.forEach(function (id) {
            var section = $(id);
            section.classList.remove('stale', 'is-entering');
            section.hidden = false;
            void section.offsetWidth; // restart the entrance animation
            section.classList.add('is-entering');
        });
        setNavAvailability(true);
        $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('result-title').focus({ preventScroll: true });
    }

    function copyInverse() {
        var d = state.result;
        var rows = state.view === 'decimal' ? d.inverse_decimal : d.inverse;
        var text = rows.map(function (r) { return r.join('\t'); }).join('\n');
        var button = $('copy-btn');
        function done(ok) {
            button.textContent = ok ? 'Copied to clipboard' : 'Copy failed — select the values manually';
            setTimeout(function () { if (button.isConnected) button.innerHTML = 'Copy ' + AINV + ' as rows'; }, 1800);
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
        button.querySelector('.btn-label').innerHTML = busy ? 'Computing…' : 'Compute ' + AINV;
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
            if (missing) bits.push(missing + ' empty ' + (missing === 1 ? 'entry' : 'entries'));
            if (other) bits.push(other + ' invalid ' + (other === 1 ? 'entry' : 'entries'));
            showAlert({ title: 'A is incomplete', message: 'Matrix A has ' + bits.join(' and ') + '.',
                        remedy: 'Fill the marked cells with numbers, or load an example.' });
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
            else showAlert(data.error || { title: 'Calculation failed' });
        }).catch(function (err) {
            if (err && err.server) {
                showAlert({ title: 'Unexpected server response', message: 'The server replied with status ' + err.status + '.',
                            remedy: 'Restart the launcher and try again.' });
            } else {
                console.error(err);
                showAlert({ title: 'Cannot reach the calculator', message: 'The browser could not connect to the local server.',
                            remedy: 'Keep the launcher window open, then try again.' });
            }
        }).then(function () { setBusy(false); });
    }

    function reset() {
        state.result = null;
        state.view = 'exact';
        clearAlert();
        $('example-select').value = '';
        RESULT_SECTIONS.forEach(function (id) { $(id).hidden = true; $(id).classList.remove('stale', 'is-entering'); });
        ['result-body', 'verify-body', 'steps-body'].forEach(function (id) { $(id).innerHTML = ''; });
        $('show-all-btn').hidden = true;
        setNavAvailability(false);
        state.renderedSize = 0;
        setValues(emptyMatrix(3), 3);
        $('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
        var first = cellAt(0, 0);
        if (first) first.focus({ preventScroll: true });
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

    /* ----- Navigation: disabled links and current-section marker ----- */
    function setupNav() {
        var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
        links.forEach(function (a) {
            a.addEventListener('click', function (e) {
                if (a.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
                var target = document.querySelector(a.getAttribute('href'));
                if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', a.getAttribute('href')); }
            });
        });
        if (!('IntersectionObserver' in window)) return;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                links.forEach(function (a) {
                    a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['workspace', 'result', 'verification', 'steps', 'method'].forEach(function (id) { observer.observe($(id)); });
    }

    /* ----- Wiring ----- */
    function setupEvents() {
        $('size-minus').onclick = function () { resizeMatrix(state.size - 1); };
        $('size-plus').onclick = function () { resizeMatrix(state.size + 1); };
        $('random-btn').onclick = fillRandom;
        $('identity-btn').onclick = fillIdentity;
        $('clear-btn').onclick = function () { setValues(emptyMatrix(state.size), state.size); };
        $('example-select').onchange = function () { loadExample(this.value); };
        $('solve-btn').onclick = solve;
        $('reset-btn').onclick = reset;
        $('theme-toggle').onclick = toggleTheme;
        $('show-all-btn').onclick = function () { state.stepsExpanded = !state.stepsExpanded; applyStepCollapse(); };
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

        $('result-body').addEventListener('click', function (e) {
            var view = e.target.closest('[data-view]');
            if (view) { state.view = view.getAttribute('data-view'); renderInverse(); return; }
            if (e.target.closest('#copy-btn')) copyInverse();
        });

        // Pointing at a highlighted row traces that row through E, A and P in the same step.
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
                       parseWhole: parseWhole, resized: resized, emptyMatrix: emptyMatrix, EXAMPLES: EXAMPLES };
}
