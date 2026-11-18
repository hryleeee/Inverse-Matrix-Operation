"""Independent verification of the inverse calculator.

The expected values here are NOT produced by the code under test. They come
from (a) hand-worked textbook results, (b) an independent adjugate/cofactor
implementation written below, and (c) NumPy's LAPACK inverse when available.
"""
import os
import random
import sys
import time
import unittest
from fractions import Fraction as F

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import (MAX_DIMENSION, InputError, app, decimal_text, identity,  # noqa: E402
                 invert_with_elementary_matrices, matmul, parse_matrix, parse_number)

try:
    import numpy
except ImportError:  # pragma: no cover - numpy is optional
    numpy = None


# ---------------------------------------------------------------------------
# Independent reference implementation: cofactor expansion + adjugate
# ---------------------------------------------------------------------------

def minor(m, i, j):
    return [row[:j] + row[j + 1:] for k, row in enumerate(m) if k != i]


def det_cofactor(m):
    if len(m) == 1:
        return m[0][0]
    return sum(((-1) ** j) * m[0][j] * det_cofactor(minor(m, 0, j)) for j in range(len(m)))


def inverse_adjugate(m):
    n = len(m)
    d = det_cofactor(m)
    if d == 0:
        return None
    if n == 1:
        return [[1 / d]]
    # A^-1 = adj(A) / det(A), adj(A)[i][j] = C[j][i]
    return [[((-1) ** (i + j)) * det_cofactor(minor(m, j, i)) / d for j in range(n)] for i in range(n)]


def fr(rows):
    return [[F(x) for x in row] for row in rows]


class TextbookCases(unittest.TestCase):
    """Hand-verified expected inverses."""

    CASES = [
        # A, expected A^-1, expected det
        ([[4, 7], [2, 6]], [['3/5', '-7/10'], ['-1/5', '2/5']], 10),
        ([[1, 2], [3, 4]], [[-2, 1], ['3/2', '-1/2']], -2),
        ([[2, -1, 0], [-1, 2, -1], [0, -1, 2]],
         [['3/4', '1/2', '1/4'], ['1/2', 1, '1/2'], ['1/4', '1/2', '3/4']], 4),
        ([[1, 2, 3], [0, 1, 4], [5, 6, 0]], [[-24, 18, 5], [20, -15, -4], [-5, 4, 1]], 1),
        ([[0, 2, 1], [1, 0, 3], [2, 1, 0]],
         [['-3/13', '1/13', '6/13'], ['6/13', '-2/13', '1/13'], ['1/13', '4/13', '-2/13']], 13),
    ]

    def test_cases(self):
        for a, expected, det in self.CASES:
            with self.subTest(a=a):
                run = invert_with_elementary_matrices(fr(a))
                self.assertTrue(run['invertible'])
                self.assertEqual(run['inverse'], fr(expected))
                self.assertEqual(run['determinant'], det)

    def test_diagonal(self):
        a = parse_matrix([['2', '0', '0', '0'], ['0', '-4', '0', '0'], ['0', '0', '5', '0'], ['0', '0', '0', '0.5']])
        run = invert_with_elementary_matrices(a)
        self.assertEqual(run['inverse'], fr([['1/2', 0, 0, 0], [0, '-1/4', 0, 0], [0, 0, '1/5', 0], [0, 0, 0, 2]]))
        self.assertEqual(run['determinant'], -20)

    def test_identity_sizes(self):
        for n in range(1, MAX_DIMENSION + 1):
            run = invert_with_elementary_matrices(identity(n))
            self.assertEqual(run['inverse'], identity(n))
            self.assertEqual(run['determinant'], 1)
            self.assertEqual(run['steps'], [])

    def test_negative_and_decimal(self):
        a = parse_matrix([['-1.5', '2.25'], ['0.5', '-0.75']])  # det = 1.125 - 1.125 = 0
        self.assertFalse(invert_with_elementary_matrices(a)['invertible'])
        a = parse_matrix([['0.5', '0.25'], ['1.5', '-2']])      # det = -1 - 0.375 = -11/8
        run = invert_with_elementary_matrices(a)
        self.assertEqual(run['determinant'], F(-11, 8))
        self.assertEqual(run['inverse'], fr([['16/11', '2/11'], ['12/11', '-4/11']]))

    def test_zero_matrix_and_zero_row(self):
        for a in ([[0]], [[0, 0], [0, 0]], [[1, 2, 3], [0, 0, 0], [4, 5, 6]]):
            run = invert_with_elementary_matrices(fr(a))
            self.assertFalse(run['invertible'])
            self.assertEqual(run['determinant'], 0)

    def test_singular_classic(self):
        run = invert_with_elementary_matrices(fr([[1, 2, 3], [4, 5, 6], [7, 8, 9]]))
        self.assertFalse(run['invertible'])
        self.assertEqual(run['failure_column'], 3)

    def test_tiny_determinant_is_not_mistaken_for_singular(self):
        # det = 1e-12 exactly; a float tolerance of 1e-10 would wrongly call this singular.
        eps = '0.000000000001'
        a = parse_matrix([['1', '1'], ['1', '1.' + eps[2:]]])
        run = invert_with_elementary_matrices(a)
        self.assertTrue(run['invertible'])
        self.assertEqual(run['determinant'], F(1, 10 ** 12))
        self.assertEqual(matmul(a, run['inverse']), identity(2))

    def test_hilbert_ill_conditioned(self):
        # Hilbert matrices are notoriously ill-conditioned; exact arithmetic gets them right.
        for n in (3, 5, 8):
            h = [[F(1, i + j + 1) for j in range(n)] for i in range(n)]
            run = invert_with_elementary_matrices(h)
            self.assertEqual(matmul(h, run['inverse']), identity(n))
            # Known closed form: all entries of H^-1 are integers.
            self.assertTrue(all(v.denominator == 1 for row in run['inverse'] for v in row))


class AgainstReference(unittest.TestCase):
    def test_random_vs_adjugate(self):
        rng = random.Random(2026)
        for _ in range(150):
            n = rng.randint(1, 5)
            a = [[F(rng.randint(-6, 6), rng.choice([1, 1, 1, 2, 3])) for _ in range(n)] for _ in range(n)]
            run = invert_with_elementary_matrices(a)
            ref = inverse_adjugate(a)
            self.assertEqual(run['determinant'], det_cofactor(a))
            self.assertEqual(run['invertible'], ref is not None)
            if ref is not None:
                self.assertEqual(run['inverse'], ref)
                self.assertEqual(matmul(a, run['inverse']), identity(n))
                self.assertEqual(matmul(run['inverse'], a), identity(n))

    def test_singular_random_rank_deficient(self):
        rng = random.Random(7)
        for _ in range(50):
            n = rng.randint(2, 6)
            a = [[F(rng.randint(-9, 9)) for _ in range(n)] for _ in range(n)]
            i, j = rng.sample(range(n), 2)
            k = F(rng.randint(-3, 3))
            a[i] = [k * x for x in a[j]]  # row i is a multiple of row j
            run = invert_with_elementary_matrices(a)
            self.assertFalse(run['invertible'])
            self.assertEqual(run['determinant'], 0)

    @unittest.skipIf(numpy is None, 'NumPy not installed')
    def test_large_vs_numpy(self):
        rng = random.Random(99)
        for n in (6, 8, 10):
            a = [[F(rng.randint(-1000, 1000)) for _ in range(n)] for _ in range(n)]
            run = invert_with_elementary_matrices(a)
            expected = numpy.linalg.inv(numpy.array([[float(x) for x in r] for r in a]))
            got = numpy.array([[float(x) for x in r] for r in run['inverse']])
            self.assertTrue(numpy.allclose(got, expected, rtol=1e-9, atol=1e-12))
            det_np = numpy.linalg.det(numpy.array([[float(x) for x in r] for r in a]))
            self.assertAlmostEqual(float(run['determinant']) / det_np, 1.0, places=8)

    def test_elementary_product_equals_inverse(self):
        a = fr([[2, 1, 1], [1, 3, 2], [1, 0, 0]])
        run = invert_with_elementary_matrices(a)
        p = identity(3)
        for step in run['steps']:
            p = matmul(step['e'], p)
        self.assertEqual(p, run['inverse'])

    def test_max_size_performance(self):
        rng = random.Random(1)
        a = [[F(rng.randint(-1000, 1000)) for _ in range(10)] for _ in range(10)]
        start = time.perf_counter()
        run = invert_with_elementary_matrices(a)
        self.assertLess(time.perf_counter() - start, 5.0)
        self.assertEqual(matmul(a, run['inverse']), identity(10))


class Parsing(unittest.TestCase):
    def test_accepted_formats(self):
        cases = {'5': 5, '-5': -5, '+5': 5, '0.5': F(1, 2), '.5': F(1, 2), '5.': 5,
                 '-3/4': F(-3, 4), ' 7 ': 7, '1000': 1000, '-1000': -1000, 2: 2, 0.25: F(1, 4)}
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(parse_number(raw, 1, 1), expected)

    def test_rejected_formats(self):
        for raw in ['', '  ', 'abc', '1e3', '--1', '0x10', '1/0', '1/', '/2', '1.2.3', '½', 'NaN',
                    'inf', '1 2', '1000.01', '-1001', '3/-4', '1' * 33, None, True, [], {}]:
            with self.subTest(raw=raw):
                with self.assertRaises(InputError):
                    parse_number(raw, 1, 1)

    def test_matrix_shape(self):
        for data in [None, [], [[]], [[1, 2]], [[1], [2]], [[1, 2], [3]], [1, 2], 'abc',
                     [[1] * 11 for _ in range(11)]]:
            with self.subTest(data=data):
                with self.assertRaises(InputError):
                    parse_matrix(data)

    def test_decimal_text(self):
        self.assertEqual(decimal_text(F(1, 3)), '0.333333')
        self.assertEqual(decimal_text(F(-5, 2)), '-2.5')
        self.assertEqual(decimal_text(F(7)), '7')
        self.assertEqual(decimal_text(F(2, 3)), '0.666667')
        self.assertEqual(decimal_text(F(1, 10 ** 30)), '1e-30')
        self.assertEqual(decimal_text(F(10 ** 40, 3)), '3.33333e+39')


class Endpoint(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def post(self, payload, **kw):
        return self.client.post('/calculate', json=payload, **kw)

    def test_invertible_payload(self):
        r = self.post({'matrix': [['4', '7'], ['2', '6']]})
        d = r.get_json()
        self.assertEqual(r.status_code, 200)
        self.assertTrue(d['invertible'])
        self.assertEqual(d['inverse'], [['3/5', '-7/10'], ['-1/5', '2/5']])
        self.assertEqual(d['inverse_decimal'], [['0.6', '-0.7'], ['-0.2', '0.4']])
        self.assertEqual(d['determinant'], '10')
        self.assertEqual(d['matrix'], [['4', '7'], ['2', '6']])

    def test_verification_and_factored_form(self):
        d = self.post({'matrix': [['0', '2', '1'], ['1', '0', '3'], ['2', '1', '0']]}).get_json()
        v = d['verification']
        identity3 = [['1', '0', '0'], ['0', '1', '0'], ['0', '0', '1']]
        self.assertEqual(v['right'], identity3)
        self.assertEqual(v['left'], identity3)
        self.assertTrue(v['right_ok'] and v['left_ok'])
        self.assertEqual(d['inverse_factored'], {'denominator': '13',
                                                 'matrix': [['-3', '1', '6'], ['6', '-2', '1'], ['1', '4', '-2']]})
        # Integral inverse: no factored form.
        d = self.post({'matrix': [['2', '1'], ['5', '3']]}).get_json()
        self.assertIsNone(d['inverse_factored'])

    def test_singular_payload(self):
        d = self.post({'matrix': [['1', '2'], ['2', '4']]}).get_json()
        self.assertTrue(d['success'])
        self.assertFalse(d['invertible'])
        self.assertIsNone(d['inverse'])
        self.assertEqual(d['determinant'], '0')
        self.assertEqual(d['failure_column'], 2)
        self.assertIn('singular', d['solution_html'])
        self.assertIsNone(d['verification'])
        self.assertIsNone(d['inverse_factored'])

    def test_bad_inputs_return_400_with_message(self):
        for payload in [{}, {'matrix': None}, {'matrix': [['a']]}, {'matrix': [['']]},
                        {'matrix': [['1', '2']]}, {'matrix': [['5000']]}, ['not', 'a', 'dict']]:
            with self.subTest(payload=payload):
                r = self.post(payload)
                self.assertEqual(r.status_code, 400)
                err = r.get_json()['error']
                self.assertTrue(err['title'] and err['message'] and err['remedy'])

    def test_non_json_body(self):
        r = self.client.post('/calculate', data='garbage', content_type='text/plain')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(r.get_json()['success'])

    def test_oversized_body(self):
        r = self.client.post('/calculate', data='x' * (70 * 1024), content_type='application/json')
        self.assertEqual(r.status_code, 413)
        self.assertEqual(r.get_json()['error']['title'], 'Request too large')

    def test_get_not_allowed(self):
        r = self.client.get('/calculate')
        self.assertEqual(r.status_code, 405)
        self.assertFalse(r.get_json()['success'])

    def test_html_is_escaped(self):
        # Validation rejects markup; make sure the message does not echo it back raw.
        r = self.post({'matrix': [['<script>']]})
        self.assertNotIn('<script>', r.get_data(as_text=True))

    def test_max_size_endpoint(self):
        rng = random.Random(3)
        m = [[str(rng.randint(-50, 50)) for _ in range(10)] for _ in range(10)]
        d = self.post({'matrix': m}).get_json()
        self.assertTrue(d['success'])
        self.assertEqual(d['size'], 10)


if __name__ == '__main__':
    unittest.main()
