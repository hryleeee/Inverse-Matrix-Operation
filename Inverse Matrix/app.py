"""Inverse Calculator - inverse of a square matrix using explicit elementary matrices.

Method
------
Gauss-Jordan elimination where every row operation is written as an
elementary matrix E_i.  The same operation is applied to A and to a running
product P_i = E_i ... E_1 (which starts as I).  When A has been reduced to I:

    E_k ... E_2 E_1 A = I   =>   A^-1 = E_k ... E_2 E_1 = P_k

All arithmetic uses fractions.Fraction, so decimals such as 0.1 and fractions
such as 3/4 are represented exactly and singularity is decided exactly (no
floating-point tolerance is needed or used).
"""
import re
from math import gcd
from decimal import Decimal, localcontext
from fractions import Fraction
from html import escape

from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
# A 10x10 matrix of 32-character strings is about 4 KB of JSON; 64 KB leaves
# plenty of headroom while rejecting absurd payloads before they are parsed.
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024

MAX_DIMENSION = 10
MIN_VALUE = -1000
MAX_VALUE = 1000
MAX_ENTRY_LENGTH = 32
DECIMAL_DIGITS = 6  # significant digits shown in the "Decimal" view
# Integer, finite decimal (5, -0.5, .5, 5.) or simple fraction (-3/4).
NUMBER_RE = re.compile(r'^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d+/\d+)$')


class InputError(Exception):
    """A user-facing validation problem (returned as HTTP 400)."""

    def __init__(self, title, message, remedy):
        super().__init__(message)
        self.title, self.message, self.remedy = title, message, remedy

    def to_dict(self):
        return {'title': self.title, 'message': self.message, 'remedy': self.remedy}


class VerificationError(ArithmeticError):
    """Raised if an internal correctness check fails (should never happen)."""


def verify(condition, message):
    # Explicit checks instead of `assert`, so they still run under `python -O`.
    if not condition:
        raise VerificationError(message)


# ---------------------------------------------------------------------------
# Number formatting
# ---------------------------------------------------------------------------

def number_text(n):
    """Exact representation: '3', '-5/2'."""
    return str(n)


def decimal_text(n, digits=DECIMAL_DIGITS):
    """Rounded decimal representation with `digits` significant digits.

    Uses Decimal (not float) so huge or tiny fractions never overflow.
    """
    if n.denominator == 1:
        return str(n.numerator)
    with localcontext() as ctx:
        ctx.prec = digits + 4
        value = Decimal(n.numerator) / Decimal(n.denominator)
    text = format(value, f'.{digits}g')
    if 'e' not in text and '.' in text:
        text = text.rstrip('0').rstrip('.')
    return text


# ---------------------------------------------------------------------------
# Input parsing / validation
# ---------------------------------------------------------------------------

def parse_number(value, row, col):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise InputError('Invalid matrix entry', f'Row {row}, column {col} must contain a number.',
                         'Enter a number such as 2, -0.5, or 3/4.')
    raw = str(value).strip()
    if raw == '':
        raise InputError('Empty matrix entry', f'Row {row}, column {col} is empty.',
                         'Fill in every cell of Matrix A.')
    if len(raw) > MAX_ENTRY_LENGTH or not NUMBER_RE.fullmatch(raw):
        raise InputError('Invalid matrix entry', f'Row {row}, column {col} contains an invalid number.',
                         'Use a whole number, decimal, or fraction such as 3/4.')
    try:
        n = Fraction(raw)
    except (ValueError, ZeroDivisionError, OverflowError):
        raise InputError('Invalid matrix entry', f'Row {row}, column {col} contains an invalid fraction.',
                         'Make sure any denominator is not zero.')
    if not MIN_VALUE <= n <= MAX_VALUE:
        raise InputError('Value out of range', f'Row {row}, column {col} is outside the allowed range.',
                         f'Enter a value between {MIN_VALUE} and {MAX_VALUE}.')
    return n


def parse_matrix(data):
    if not isinstance(data, list) or not data:
        raise InputError('Matrix A is missing', 'A matrix is required.', 'Fill in Matrix A.')
    n = len(data)
    if not 1 <= n <= MAX_DIMENSION:
        raise InputError('Invalid matrix size', f'A has {n} rows.',
                         f'Choose a square matrix between 1×1 and {MAX_DIMENSION}×{MAX_DIMENSION}.')
    result = []
    for r, row in enumerate(data, 1):
        if not isinstance(row, list) or len(row) != n:
            raise InputError('Matrix A must be square',
                             f'Row {r} must have {n} entries, since A has {n} rows.',
                             'Use the same number of rows and columns.')
        result.append([parse_number(value, r, c) for c, value in enumerate(row, 1)])
    return result


# ---------------------------------------------------------------------------
# Exact matrix algebra
# ---------------------------------------------------------------------------

def identity(n):
    return [[Fraction(int(i == j)) for j in range(n)] for i in range(n)]


def matmul(a, b):
    return [[sum((a[i][k] * b[k][j] for k in range(len(b))), Fraction(0))
             for j in range(len(b[0]))] for i in range(len(a))]


def do_row_operation(matrix, op, target, source=None, multiplier=None):
    """Return a copy of `matrix` with one elementary row operation applied.

    swap:  R_target <-> R_source
    scale: R_target <- multiplier * R_target          (multiplier != 0)
    add:   R_target <- R_target + multiplier * R_source
    """
    result = [row[:] for row in matrix]
    if op == 'swap':
        result[target], result[source] = result[source], result[target]
    elif op == 'scale':
        result[target] = [multiplier * x for x in result[target]]
    elif op == 'add':
        result[target] = [x + multiplier * y for x, y in zip(result[target], result[source])]
    else:
        raise ValueError(f'Unknown row operation: {op}')
    return result


def row_operation_label(op, target, source=None, multiplier=None):
    r = target + 1
    if op == 'swap':
        return f'R{r} ↔ R{source + 1}'
    if op == 'scale':
        return f'R{r} ← ({plain_number(multiplier)}) R{r}'
    sign = '+' if multiplier >= 0 else '−'
    return f'R{r} ← R{r} {sign} ({number_text(abs(multiplier))}) R{source + 1}'


def plain_number(n):
    """Exact value with a typographic minus, for prose ('−5/2')."""
    return number_text(n).replace('-', '−')


def row_operation_explanation(op, target, source=None, multiplier=None, column=0):
    """The same row operation in plain language, for first-time users."""
    r, c = target + 1, column + 1
    if op == 'swap':
        return (f'Swap row {r} and row {source + 1}, because column {c} needs a nonzero '
                f'number on the diagonal.')
    if op == 'scale':
        pivot = 1 / multiplier
        if multiplier.denominator == 1:
            action = f'Multiply row {r} by {plain_number(multiplier)}'
        elif pivot.denominator == 1:
            action = f'Divide row {r} by {plain_number(pivot)}'
        else:
            action = f'Multiply row {r} by {plain_number(multiplier)}'
        return f'{action} so its diagonal entry becomes 1.'
    entry = -multiplier  # the value being cleared from row `target`
    times = '' if abs(entry) == 1 else f'{plain_number(abs(entry))} × '
    if entry > 0:
        action = f'Subtract {times}row {source + 1} from row {r}'
    else:
        action = f'Add {times}row {source + 1} to row {r}'
    return f'{action} to make the entry in column {c} zero.'


def invert_with_elementary_matrices(a):
    """Gauss-Jordan reduction with exact elementary matrices.

    Returns a dict with:
      invertible     bool
      inverse        P_k (list of Fractions) or None if singular
      determinant    exact det(A) (0 when singular)
      steps          list of {index, description, op, e, before, after, product, affected}
      reduced        the matrix A was reduced to
      failure_column 1-based column without a pivot (singular case only)

    det(A) is obtained from the same elimination: a swap flips the sign and
    scaling a pivot row by 1/p divides it by p, so det(A) = (-1)^swaps * prod(p).
    """
    n = len(a)
    left, product = [row[:] for row in a], identity(n)
    steps = []
    determinant = Fraction(1)

    def record(op, target, source=None, multiplier=None, column=0):
        nonlocal left, product
        before = left
        e = do_row_operation(identity(n), op, target, source, multiplier)
        updated_left = do_row_operation(left, op, target, source, multiplier)
        updated_product = do_row_operation(product, op, target, source, multiplier)
        # Applying the row operation must equal left-multiplying by E.
        verify(matmul(e, before) == updated_left, 'E_i A_{i-1} does not match the row operation')
        verify(matmul(e, product) == updated_product, 'E_i P_{i-1} does not match the row operation')
        left, product = updated_left, updated_product
        steps.append({
            'index': len(steps) + 1,
            'op': op,
            'description': row_operation_label(op, target, source, multiplier),
            'explanation': row_operation_explanation(op, target, source, multiplier, column),
            'e': e, 'before': before, 'after': left, 'product': product,
            'affected': (target, source) if op == 'swap' else (target,),
        })

    for pivot_col in range(n):
        # Exact arithmetic: any nonzero entry is a valid pivot.
        pivot_row = next((r for r in range(pivot_col, n) if left[r][pivot_col] != 0), None)
        if pivot_row is None:
            return {'invertible': False, 'inverse': None, 'determinant': Fraction(0),
                    'steps': steps, 'reduced': left, 'failure_column': pivot_col + 1}
        if pivot_row != pivot_col:
            record('swap', pivot_col, source=pivot_row, column=pivot_col)
            determinant = -determinant
        pivot = left[pivot_col][pivot_col]
        determinant *= pivot
        if pivot != 1:
            record('scale', pivot_col, multiplier=1 / pivot, column=pivot_col)
        for row in range(n):
            if row != pivot_col and left[row][pivot_col] != 0:
                record('add', row, source=pivot_col, multiplier=-left[row][pivot_col], column=pivot_col)

    verify(left == identity(n), 'Final reduction is not the identity matrix')
    verify(matmul(product, a) == identity(n), 'Left inverse check A^-1 A = I failed')
    verify(matmul(a, product) == identity(n), 'Right inverse check A A^-1 = I failed')
    return {'invertible': True, 'inverse': product, 'determinant': determinant,
            'steps': steps, 'reduced': left, 'failure_column': None}


# ---------------------------------------------------------------------------
# HTML rendering of the step-by-step solution
# ---------------------------------------------------------------------------

def matrix_to_html(matrix, role='', affected=()):
    rows = []
    for r, row in enumerate(matrix):
        hl = f' data-hl="row-{r}"' if r in affected else ''
        cells = ''.join(f'<td{hl}>{escape(number_text(num))}</td>' for num in row)
        rows.append(f'<tr>{cells}</tr>')
    return (f'<div class="matrix-bracket" data-role="{escape(role)}">'
            f'<table class="matrix-table">{"".join(rows)}</table></div>')


def labeled_matrix(title, matrix, role='', affected=()):
    # `title` is trusted, internally generated markup (subscripts/superscripts).
    return ('<div class="labeled-matrix"><span class="matrix-label">' + title + ' =</span>'
            + matrix_to_html(matrix, role, affected) + '</div>')


def product_chain(k, limit):
    if k == 0:
        return 'I'
    if k <= limit:
        return ' '.join(f'E<sub>{j}</sub>' for j in range(k, 0, -1))
    return f'E<sub>{k}</sub> ··· E<sub>1</sub>'


OP_NAMES = {'swap': 'Swap rows', 'scale': 'Scale a row', 'add': 'Add a multiple of a row'}


def solution_to_html(a, run):
    """Server-rendered elimination log.

    Math symbols are wrapped in <var> so the stylesheet can typeset them as
    italic serif variables; numbers stay in the monospaced face.
    """
    if not run['steps']:
        parts = ['<p class="sol-note"><var>A</var> is already the identity matrix <var>I</var>, '
                 'so no row operations are needed.</p>']
    else:
        parts = [f'<ol class="sol-steps" data-count="{len(run["steps"])}">']
    for step in run['steps']:
        i, affected = step['index'], step['affected']
        # Each step is a collapsible row: plain-language sentence + notation in the
        # summary, the before/after matrices in the body.
        parts.append(
            f'<li class="sol-step" style="--i:{min(i, 14)}"><details class="step">'
            f'<summary class="sol-head"><span class="op-num">Step {i}</span>'
            f'<span class="step-text"><span class="step-plain">{escape(step["explanation"])}</span>'
            f'<span class="step-meta"><span class="sol-expr">{escape(step["description"])}</span>'
            f'<span class="op-kind">{OP_NAMES[step["op"]]}</span></span></span></summary>'
            '<div class="step-body"><div class="work">'
            + labeled_matrix(f'Before, <var>A</var><sub>{i - 1}</sub>', step['before'], f'before{i}', affected)
            + '<span class="equals" aria-label="becomes">→</span>'
            + labeled_matrix(f'After, <var>A</var><sub>{i}</sub>', step['after'], f'after{i}', affected)
            + '</div><details class="entry-details"><summary>Show as matrix multiplication '
            f'(<var>E</var><sub>{i}</sub> and running product <var>P</var><sub>{i}</sub>)</summary>'
            '<div class="details-body"><div class="work">'
            + labeled_matrix(f'<var>E</var><sub>{i}</sub>', step['e'], f'e{i}', affected)
            + labeled_matrix(f'<var>P</var><sub>{i}</sub> = {product_chain(i, 4)}', step['product'], f'product{i}', affected)
            + '</div><p class="sol-note">Multiplying <var>A</var><sub>' + str(i - 1) + '</sub> on the left by '
            f'<var>E</var><sub>{i}</sub> performs this row operation. After the last step, '
            '<var>P</var> is the inverse.</p></div></details></div></details></li>')
    if run['steps']:
        parts.append('</ol>')
    if run['invertible']:
        k = len(run['steps'])
        chain = product_chain(k, 6)
        proof = (f'{chain} <var>A</var> = <var>I</var> &nbsp;⇒&nbsp; <var>A</var><sup>−1</sup> = {chain}' if k
                 else '<var>A</var> = <var>I</var> &nbsp;⇒&nbsp; <var>A</var><sup>−1</sup> = <var>I</var>')
        parts.append(
            '<div class="sol-final"><p class="sub-title">Conclusion</p>'
            '<p>The steps turned <var>A</var> into the identity matrix <var>I</var>. Doing the same steps to '
            '<var>I</var> produces the inverse:</p>'
            f'<p class="proof-formula">{proof}</p></div>')
    else:
        parts.append(
            '<div class="sol-final singular"><p class="sub-title">Conclusion: no pivot in column '
            f'{run["failure_column"]}</p>'
            f'<p>Column {run["failure_column"]} has only zeros on and below the diagonal, so no step can put a 1 there. '
            '<var>A</var> cannot be turned into <var>I</var>: it is singular (det <var>A</var> = 0) and has no inverse.</p>'
            '<div class="work">'
            + labeled_matrix('Reduced <var>A</var>', run['reduced'], 'reduced')
            + '</div></div>')
    return ''.join(parts)


def factored(matrix):
    """Write M as (1/d)·N with N integral, where d is the lcm of the denominators.

    Returns None when d == 1 (already integral) or when N would be unwieldy.
    """
    d = 1
    for row in matrix:
        for v in row:
            d = d * v.denominator // gcd(d, v.denominator)
    if d == 1 or d > 10 ** 6:
        return None
    return {'denominator': str(d), 'matrix': [[str(int(v * d)) for v in row] for row in matrix]}


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------

def error_response(title, message, remedy, status):
    return jsonify({'success': False, 'error': {'title': title, 'message': message, 'remedy': remedy}}), status


@app.route('/')
def index():
    return render_template('index.html', limits={
        'maxDimension': MAX_DIMENSION, 'minValue': MIN_VALUE, 'maxValue': MAX_VALUE,
        'maxEntryLength': MAX_ENTRY_LENGTH,
    })


@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise InputError('No matrix submitted', 'No matrix data was received.',
                             'Enter Matrix A and press Find inverse.')
        a = parse_matrix(data.get('matrix'))
        run = invert_with_elementary_matrices(a)
        inverse = run['inverse']
        verification = None
        if inverse:
            # Recomputed here (independently of the checks inside the solver) so the
            # page can display both products and their exact comparison with I.
            right, left = matmul(a, inverse), matmul(inverse, a)
            verification = {
                'right': [[number_text(v) for v in row] for row in right],
                'left': [[number_text(v) for v in row] for row in left],
                'right_ok': right == identity(len(a)),
                'left_ok': left == identity(len(a)),
            }
        return jsonify({
            'verification': verification,
            'inverse_factored': factored(inverse) if inverse else None,
            'success': True,
            'invertible': run['invertible'],
            'size': len(a),
            'matrix': [[number_text(v) for v in row] for row in a],
            'inverse': [[number_text(v) for v in row] for row in inverse] if inverse else None,
            'inverse_decimal': [[decimal_text(v) for v in row] for row in inverse] if inverse else None,
            'determinant': number_text(run['determinant']),
            'determinant_decimal': decimal_text(run['determinant']),
            'step_count': len(run['steps']),
            'failure_column': run['failure_column'],
            'solution_html': solution_to_html(a, run),
        })
    except InputError as error:
        return jsonify({'success': False, 'error': error.to_dict()}), 400
    except HTTPException:
        raise  # e.g. 413 Request Entity Too Large: handled by the error handlers below
    except Exception:
        app.logger.exception('Matrix inversion failed')
        return error_response('Calculation error', 'An unexpected error prevented the inversion.',
                              'Check Matrix A and try again.', 500)


@app.errorhandler(413)
def too_large(_error):
    return error_response('Request too large', 'The submitted data is larger than allowed.',
                          f'Use at most a {MAX_DIMENSION}×{MAX_DIMENSION} matrix with short entries.', 413)


@app.errorhandler(405)
def method_not_allowed(_error):
    return error_response('Method not allowed', 'This address only accepts POST requests.',
                          'Use the Find inverse button in the app.', 405)


if __name__ == '__main__':
    app.run(debug=False)
