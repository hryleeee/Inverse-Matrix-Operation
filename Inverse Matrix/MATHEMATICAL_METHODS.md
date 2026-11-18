# Mathematical Methods

This document describes exactly what `app.py` computes and why it is correct.

## 1. Problem

Given a square matrix A ∈ ℚⁿˣⁿ (1 ≤ n ≤ 10), find A⁻¹ such that

```
A · A⁻¹ = I    and    A⁻¹ · A = I,
```

or show that no such matrix exists (A is **singular**, det A = 0).

## 2. Number system: exact rationals

Every entry is parsed into Python's `fractions.Fraction`:

| Input | Stored as |
|---|---|
| `7` | 7/1 |
| `-0.25` | −1/4 |
| `0.1` | 1/10 (exactly, unlike the binary float 0.1000000000000000055…) |
| `3/4` | 3/4 |

Addition, subtraction, multiplication and division of rationals give rationals, so every intermediate value and the final inverse are **exact**. This has three consequences:

1. **No floating-point tolerance is needed.** A pivot is zero only if it is exactly zero. A matrix with det A = 10⁻¹² is correctly reported as invertible, and a singular matrix is never reported as invertible because of rounding noise.
2. **Ill-conditioned matrices are handled correctly.** For example, the inverse of the 8×8 Hilbert matrix has huge integer entries. Floating-point methods lose many digits here; this app gets every digit right (see `test_hilbert_ill_conditioned`).
3. **Verification can use equality.** The checks `A·A⁻¹ == I` are exact comparisons, not "close to".

The only rounding in the system is the optional **Decimal** view, which formats each exact value to 6 significant digits using `decimal.Decimal`. That view is for display only and never feeds back into the calculation.

## 3. Elementary matrices

An elementary matrix is the identity matrix with one row operation applied to it. Left-multiplying any matrix M by E applies that same row operation to M.

| Operation (rows 1-based) | Label in the app | E | det E | E⁻¹ |
|---|---|---|---|---|
| Swap | `Ri ↔ Rj` | I with rows i, j swapped | −1 | itself |
| Scale | `Ri ← (c) Ri`, c ≠ 0 | I with Eᵢᵢ = c | c | scale by 1/c |
| Add a multiple | `Ri ← Ri + (c) Rj`, i ≠ j | I with Eᵢⱼ = c | 1 | add −c·Rj |

Every elementary matrix is invertible, so products of them are invertible too.

## 4. Algorithm: Gauss–Jordan with explicit Eᵢ

```
L ← A            (the matrix being reduced; Aᵢ in the UI)
P ← I            (running product; Pᵢ = Eᵢ ··· E₁)
det ← 1
for each column c = 1 … n:
    find the first row r ≥ c with L[r][c] ≠ 0
    if there is none:  A is singular, stop (det A = 0)
    if r ≠ c:  apply  Rc ↔ Rr                  (det ← −det)
    p ← L[c][c];  det ← det · p
    if p ≠ 1:  apply  Rc ← (1/p) Rc
    for each row k ≠ c with L[k][c] ≠ 0:
        apply  Rk ← Rk − L[k][c] · Rc
```

"Apply" means: build E from I, then set L ← E·L and P ← E·P. The code applies the row operation directly to L and P, and also checks that the result equals the matrix product E·L (and E·P). This shows the elementary-matrix interpretation holds at every step.

### Why P is the inverse

After k operations L = I, so

```
E_k ··· E_2 E_1 A = I.
```

Let B = Eₖ···E₁. Then BA = I. B is a product of invertible matrices, so B is invertible. Multiplying BA = I on the left by B⁻¹ gives A = B⁻¹. Then AB = B⁻¹B = I. So B is a two-sided inverse:

```
A⁻¹ = E_k ··· E_2 E_1 = P_k.
```

The app still checks **both** A⁻¹A = I and AA⁻¹ = I exactly before it returns a result.

### Why a missing pivot means A is singular

Suppose column c has only zeros at or below the diagonal after columns 1…c−1 have been cleared. Then the first c columns of L are all in the span of e₁,…,e₍c−1₎. That is c vectors in a (c−1)-dimensional space, so they are linearly dependent. So L is singular, and A = (Eₖ···E₁)⁻¹L is singular too: det A = 0 and no inverse exists. The app stops at that column and shows the partially reduced matrix. The column number is reported as `failure_column`.

### Pivot choice

Floating-point solvers use *partial pivoting* (the entry with the largest absolute value) to limit error growth. With exact arithmetic there is no error to grow, so the app uses the **first nonzero** entry. This keeps the steps closer to how they are done by hand and avoids unnecessary swaps.

## 5. Determinant

Taking determinants of Eₖ···E₁A = I gives ∏ det(Eᵢ) · det A = 1, so det A = 1 / ∏ det(Eᵢ). Using the table in §3:

- each swap contributes −1
- scaling the pivot row by 1/p contributes 1/p
- row additions contribute 1

```
det A = (−1)^(number of swaps) × ∏ (pivots p before scaling)
```

When a pivot is missing, det A = 0. The tests compare this value with an independent cofactor (Laplace) expansion on 150 random matrices.

## 6. Worked example

```
A = | 2  1 |
    | 5  3 |
```

| i | Operation | Eᵢ | Aᵢ | Pᵢ = Eᵢ···E₁ |
|---|---|---|---|---|
| 1 | R1 ← (1/2) R1 | [[1/2,0],[0,1]] | [[1,1/2],[5,3]] | [[1/2,0],[0,1]] |
| 2 | R2 ← R2 − (5) R1 | [[1,0],[−5,1]] | [[1,1/2],[0,1/2]] | [[1/2,0],[−5/2,1]] |
| 3 | R2 ← (2) R2 | [[1,0],[0,2]] | [[1,1/2],[0,1]] | [[1/2,0],[−5,2]] |
| 4 | R1 ← R1 − (1/2) R2 | [[1,−1/2],[0,1]] | [[1,0],[0,1]] | [[3,−1],[−5,2]] |

So A⁻¹ = [[3, −1], [−5, 2]], with pivots 2 and 1/2 and no swaps: det A = 2 · 1/2 = 1.

Check: [[2,1],[5,3]] · [[3,−1],[−5,2]] = [[6−5, −2+2],[15−15, −5+6]] = I. ✓

## 7. Complexity

There are at most n² row operations. Each one costs O(n) to apply, plus O(n³) for the two verification matrix products. The total is O(n⁵) Fraction operations. At n = 10 this measured about 0.2 s on the development machine, which the tests limit to under 5 s. Fraction sizes can grow during elimination; the 32-character and ±1000 input limits keep this bounded in practice.

## 8. Independent verification used in the tests

| Reference | Why it is independent |
|---|---|
| Hand-worked inverses (textbook cases) | Computed outside the program |
| Adjugate formula A⁻¹ = adj(A)/det A with cofactor-expansion determinants | A completely different algorithm, written separately in `tests/test_accuracy.py` |
| `numpy.linalg.inv` / `numpy.linalg.det` (LAPACK, floating point) | Separate implementation; compared with relative tolerance 1e-9 |
| Product of the recorded Eᵢ matrices | Shows that A⁻¹ really is Eₖ···E₁ |
| Known Hilbert-matrix property (integer inverse) | Mathematical identity |
