import os
import sys
import unittest
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import app, identity, invert_with_elementary_matrices, matmul, parse_matrix


class ElementaryInverseTests(unittest.TestCase):
    def test_two_by_two(self):
        a = parse_matrix([['2', '1'], ['5', '3']])
        result = invert_with_elementary_matrices(a)
        self.assertTrue(result['invertible'])
        self.assertEqual(result['inverse'], [[3, -1], [-5, 2]])
        self.assertEqual(result['reduced'], identity(2))

    def test_fractional_inverse(self):
        a = parse_matrix([['2', '0'], ['0', '4']])
        result = invert_with_elementary_matrices(a)
        self.assertEqual(result['inverse'], [[Fraction(1, 2), 0], [0, Fraction(1, 4)]])
        self.assertEqual(matmul(result['inverse'], a), identity(2))

    def test_three_by_three(self):
        a = parse_matrix([['1', '2', '0'], ['0', '1', '3'], ['0', '0', '1']])
        result = invert_with_elementary_matrices(a)
        self.assertEqual(result['inverse'], [[1, -2, 6], [0, 1, -3], [0, 0, 1]])
        self.assertEqual(result['reduced'], identity(3))
        self.assertEqual(len(result['steps']), 3)

    def test_row_swap_required(self):
        a = parse_matrix([['0', '1'], ['2', '3']])
        result = invert_with_elementary_matrices(a)
        self.assertTrue(result['invertible'])
        self.assertIn('↔', result['steps'][0]['description'])
        self.assertEqual(matmul(a, result['inverse']), identity(2))

    def test_singular(self):
        a = parse_matrix([['1', '2'], ['2', '4']])
        result = invert_with_elementary_matrices(a)
        self.assertFalse(result['invertible'])
        self.assertIsNone(result['inverse'])
        self.assertEqual(result['failure_column'], 2)

    def test_1x1(self):
        a = parse_matrix([['-4']])
        result = invert_with_elementary_matrices(a)
        self.assertEqual(result['inverse'], [[Fraction(-1, 4)]])

    def test_decimals_exact(self):
        a = parse_matrix([['0.1', '0'], ['0', '0.2']])
        result = invert_with_elementary_matrices(a)
        self.assertEqual(result['inverse'], [[10, 0], [0, 5]])

    def test_identity_zero_operations(self):
        a = identity(3)
        result = invert_with_elementary_matrices(a)
        self.assertEqual(result['inverse'], a)
        self.assertEqual(result['steps'], [])

    def test_json_endpoint(self):
        with app.test_client() as client:
            response = client.post('/calculate', json={'matrix': [['2', '1'], ['5', '3']]})
            data = response.get_json()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(data['inverse'], [['3', '-1'], ['-5', '2']])
            self.assertIn('E<sub>1</sub>', data['solution_html'])
            self.assertIn('Conclusion', data['solution_html'])

    def test_json_reject_nonsquare(self):
        with app.test_client() as client:
            response = client.post('/calculate', json={'matrix': [['1', '2', '3'], ['4', '5', '6']]})
            self.assertEqual(response.status_code, 400)
            self.assertIn('square', response.get_json()['error']['title'].lower())

    def test_page_renders(self):
        with app.test_client() as client:
            page = client.get('/')
            self.assertEqual(page.status_code, 200)
            self.assertIn(b'Calculate inverse', page.data)
            self.assertIn(b'id="verification"', page.data)
            for stage in (b'Enter matrix', b'Calculate', b'Results', b'Verify', b'Steps'):
                self.assertIn(stage, page.data)
            self.assertIn(b'id="matrix-input"', page.data)
            self.assertNotIn(b'Add operation', page.data)


if __name__ == '__main__':
    unittest.main()
