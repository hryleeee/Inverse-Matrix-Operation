# QA Report

## Addendum — v3.1.0 first-time-user UX pass (2026-11-19)

Every result below was actually executed.

| Check | Result |
|---|---|
| `python -m unittest discover -s tests` | **41 / 41 passed** (adds 4 plain-language step tests) |
| `node --test tests/test_frontend.js` | **8 / 8 passed** (adds `pastePlacement`) |
| Browser console | 0 errors |

User journey, run in the browser pane against `python app.py`:

| # | Scenario | Actual |
|---|---|---|
| J1 | First load | Stage 1 current; stages 3–5 locked with the tooltip "Available after you calculate"; clicking locked "Steps" does nothing |
| J2 | Calculate with all cells empty | "The matrix is not complete yet — There are 9 empty cells (marked in the grid)", 9 amber cells, each with the tooltip "This cell is empty. Type a number (use 0 for zero)." |
| J3 | Click **Fill empty cells with 0** | All 9 cells become 0; status "All 9 cells filled · ready to calculate"; stage 1 turns green |
| J4 | Calculate the zero matrix | "✕ This matrix has no inverse — The determinant is 0…"; Verify: "Nothing to check: there is no inverse" |
| J5 | Load "3 × 3 — needs a row swap" | Out-of-date notice with **Calculate again** appears; pressing it gives "✓ This matrix has an inverse — The determinant is 13"; factored form (1/13)·[…] on one line; facts: Determinant 13, Size 3 × 3, Steps used 7, Check Passed; Verify: "Check passed", both rows "Matches I"; all five stages green |
| J6 | Steps | 7 rows, first open; Step 1 reads "Swap row 1 and row 2, because column 1 needs a nonzero number on the diagonal. R1 ↔ R2 Swap rows"; Expand all → 7/7 open, Collapse all → 0/7 |
| J7 | Decimals toggle | −0.230769, 0.0769231, … with the note on rounding |
| J8 | Copy inverse | Status message shown (the hidden test pane blocks clipboard access, so the fallback message appeared, as designed) |
| J9 | **Edit matrix** | Scrolls to the grid, focuses cell (1,1); results stay visible |
| J10 | Paste a 2 × 4 block into row 2, column 1 of the 3 × 3 | Matrix grows to 4 × 4; row 2 = 1,2,3,4; row 1 keeps 0,2,1; results marked out of date; stage ticks cleared |
| J11 | 375 px phone | No horizontal overflow; all five stages fit (non-current ones show numbers only); every control ≥ 32 px tall except the logo link |
| J12 | 768 px tablet, random 10 × 10 | 99 collapsible steps, first open; no page overflow |

Defects found and fixed during this pass: the factored equation split `A` from its `⁻¹` and wrapped the matrix onto a new line (now one non-wrapping group); the step disclosure chevron was too small; the stage bar was cut off on phones; scale notation used an ASCII hyphen.

Not covered: real keyboard focus rings in a foreground window (the global `:focus-visible` rule exists, but the hidden pane never takes document focus), physical devices, and screen-reader testing.

---

## Addendum — v3.0.0 "Inverse Workbench" redesign (2026-11-18)

Re-run after the redesign. All results below were actually executed.

| Check | Result |
|---|---|
| `python -m unittest discover -s tests` | **37 / 37 passed** (adds `test_verification_and_factored_form`) |
| `node --test tests/test_frontend.js` | **7 / 7 passed** |
| `node --check static/script.js` | Syntax OK |
| Browser console | 0 errors |

| # | Scenario (browser pane) | Actual |
|---|---|---|
| R1 | First load, desktop | Masthead, Fig. 1, §1 instrument with indices; result nav links disabled (3 links with `aria-disabled`) |
| R2 | Click the disabled "Steps" link before computing | No navigation (hash unchanged) |
| R3 | "3 × 3 — needs a row swap" → Compute | §2 *Invertible*, det 13, A⁻¹ = (1/13)[[−3,1,6],[6,−2,1],[1,4,−2]] shown in exact and factored form; §3 both products = I, *Holds*, 9 of 9 entries equal; §4 7 elementary matrices, first R1 ↔ R2; all nav links enabled |
| R4 | 7-step log | Not collapsed (only logs longer than 10 steps collapse); "Show all" hidden |
| R5 | 10×10 random at 375 px | det shown; log collapsed to 6 of 99 steps; "Show all 99 steps (93 more)" expands to 99; cells stay 62 px wide and the grid scrolls inside its frame (342 px visible of 741 px); page `scrollWidth` = 375, no elements overflow the viewport |
| R6 | "3 × 3 — tridiagonal" at 375 px | A⁻¹ [[3/4,1/2,1/4],…] plus the factored form ¼·[[3,2,1],[2,4,2],[1,2,3]]; facts in a 2 × 2 grid |
| R7 | "3 × 3 — singular", dark scheme | §2 *Singular*, det 0, missing pivot column 3, 5 row operations; §3 "A · X = I — No solution"; §4 conclusion "no pivot in column 3" |
| R8 | Edit a cell after computing | Stale note shown; §2–§4 dimmed |
| R9 | Theme toggle | Switches `data-theme`; the button label shows the theme it switches to |
| R10 | Reset workspace | §2–§4 hidden, nav links disabled again, "0 of 9 entries" |
| R11 | Focus cell (2,3) | Row index 2 and column index 3 highlighted (checked by dispatching `focusin`, because the hidden preview pane does not take real focus) |

Layout defects found and fixed during this pass: the left bracket overlapped the row indices (row-index padding increased to 22 px); on phones, the second row of facts got a stray left border and indent (fixed with explicit 2 × 2 rules); the "Random entries range" disclosure marker hung outside the margin.

Not covered: physical devices, real keyboard focus in a foreground window (only simulated, see R11), and reduced-motion rendering (implemented in CSS but not visually checked).

---

**Date:** 2026-11-18
**Environment:** Windows 11, Python 3.13.3, Flask 3.1.3, NumPy 2.5.0 (tests only), Node.js 22.16.0, Chromium-based browser pane (desktop 1024×768, tablet 768×1024, mobile 375×812)

Every result below was actually run. Nothing is reported as passed unless it was executed.

## 1. Summary

| Suite | Command | Result |
|---|---|---|
| Python unit, integration and accuracy | `python -m unittest discover -s tests -v` | **36 / 36 passed** (1.48 s) |
| Frontend helpers | `node --test tests/test_frontend.js` | **7 / 7 passed** |
| Optimised-mode check | `python -O` + call `verify(False, …)` | `VerificationError` raised, so the checks stay active |
| Manual browser tests | Browser pane, see §4 | All passed; 0 console errors |
| Responsive tests | 375 / 768 / 1024 px with a 10×10 matrix | No page-level horizontal overflow at any width |

## 2. Mathematical accuracy tests (`tests/test_accuracy.py`)

| Test | What it checks | Expected (independent source) | Result |
|---|---|---|---|
| `test_cases` | 5 textbook matrices (2×2, 3×3, tridiagonal, swap-needed) | Hand-worked inverses and determinants | Pass |
| `test_diagonal` | 4×4 diagonal with a decimal entry | diag(1/2, −1/4, 1/5, 2), det −20 | Pass |
| `test_identity_sizes` | Iₙ for n = 1…10 | Iₙ⁻¹ = Iₙ, det 1, 0 steps | Pass |
| `test_negative_and_decimal` | Negative decimals; one singular, one not | det 0 / det −11/8, inverse [[16/11, 2/11], [12/11, −4/11]] | Pass |
| `test_zero_matrix_and_zero_row` | [0], 2×2 zero matrix, zero middle row | Singular, det 0 | Pass |
| `test_singular_classic` | [[1,2,3],[4,5,6],[7,8,9]] | Singular, fails at column 3 | Pass |
| `test_tiny_determinant_is_not_mistaken_for_singular` | det = 10⁻¹² | Invertible; A·A⁻¹ = I exactly | Pass |
| `test_hilbert_ill_conditioned` | Hilbert matrices n = 3, 5, 8 | H·H⁻¹ = I; all H⁻¹ entries are integers | Pass |
| `test_random_vs_adjugate` | 150 random 1×1–5×5 rational matrices | Independent adjugate/cofactor inverse and determinant | Pass |
| `test_singular_random_rank_deficient` | 50 matrices with one row a multiple of another | Singular, det 0 | Pass |
| `test_large_vs_numpy` | Random 6×6, 8×8, 10×10 with entries in ±1000 | `numpy.linalg.inv`/`det` within rtol 1e-9 | Pass |
| `test_elementary_product_equals_inverse` | Multiply the recorded E₁…Eₖ | Product = returned A⁻¹ | Pass |
| `test_max_size_performance` | 10×10, entries in ±1000 | Finishes in < 5 s (measured ≈ 0.2 s) and A·A⁻¹ = I | Pass |

## 3. Input, edge case and API tests

| Test | Cases | Result |
|---|---|---|
| `test_accepted_formats` | `5 -5 +5 0.5 .5 5. -3/4 " 7 " 1000 -1000`, JSON int 2, JSON float 0.25 | Pass |
| `test_rejected_formats` | `"" "  " abc 1e3 --1 0x10 1/0 1/ /2 1.2.3 ½ NaN inf "1 2" 1000.01 -1001 3/-4`, 33 chars, `None True [] {}` | Pass (all raise `InputError`) |
| `test_matrix_shape` | `None`, `[]`, `[[]]`, 1×2, 2×1, ragged, flat list, string, 11×11 | Pass (all rejected) |
| `test_decimal_text` | 1/3, −5/2, 7, 2/3, 10⁻³⁰, 10⁴⁰/3 | Pass (`0.333333`, `-2.5`, `7`, `0.666667`, `1e-30`, `3.33333e+39`) |
| `test_invertible_payload` | POST [[4,7],[2,6]] | 200; exact and decimal inverse, det 10 |
| `test_singular_payload` | POST [[1,2],[2,4]] | 200; `invertible: false`, det 0, column 2 |
| `test_bad_inputs_return_400_with_message` | 7 malformed payloads | 400 with title, message and remedy |
| `test_non_json_body` | `text/plain` body | 400 JSON |
| `test_oversized_body` | 70 KB body | 413 JSON (**was 500 before the fix**, see §5) |
| `test_get_not_allowed` | `GET /calculate` | 405 JSON |
| `test_html_is_escaped` | Entry `<script>` | Rejected; not echoed back raw |
| `test_max_size_endpoint` | 10×10 POST | 200 |
| Original `tests/test_inverse.py` (11 tests) | 2×2, fractions, 3×3, row swap, singular, 1×1, decimals, identity, endpoint, non-square, page | All pass. Two assertions were updated only because the page and step wording changed: the page now has "Find inverse" and `id="matrix-input"` instead of "Inversion method", and the steps have `E<sub>1</sub>` and "Conclusion" instead of "Elementary matrix" |

## 4. Manual UI tests (browser pane, run against `python app.py`)

| # | Scenario | Expected | Actual |
|---|---|---|---|
| 1 | Load the page | 3×3 empty grid, "0 / 9 filled" | As expected |
| 2 | Example "3×3 needs a row swap", then Find inverse | Invertible, det 13, 7 operations, first step R1 ↔ R2 | As expected |
| 3 | Answer tab, exact view | A⁻¹ = (1/13)[[−3,1,6],[6,−2,1],[1,4,−2]] | As expected |
| 4 | Decimal toggle | −0.230769, 0.0769231 … and a rounding note | As expected |
| 5 | Edit a cell after solving | Stale note shown, result dimmed | As expected |
| 6 | Reset | Result hidden, 3×3 empty, "0 / 9 filled" | As expected |
| 7 | Find inverse with all cells empty | Alert "Matrix A is not complete yet… 9 empty cells", 9 amber cells, no request sent | As expected |
| 8 | Type `1/0` | Red cell; "Row 2, column 2 divides by zero" | As expected |
| 9 | Paste `1\t2\n2\t4` into the top-left cell | Matrix resizes to 2×2 with those values | As expected |
| 10 | Solve the pasted singular matrix | "A is singular — no inverse exists", det 0, 1 operation, column 2 | As expected |
| 11 | Arrow Down from (1,1) | Focus moves to (2,1) | As expected |
| 12 | Size + after 2×2 | Grows to 3×3 and keeps the existing values | As expected |
| 13 | Example "2×2 fractions" | det 1/60 ≈ 0.0166667, A⁻¹ [[12,−20],[−15,30]] | As expected |
| 14 | Step-by-step tab (tridiagonal) | 8 step cards with E, Aᵢ₋₁ → Aᵢ and highlighted rows | As expected |
| 15 | Dark color scheme | All surfaces, text and status colours readable | As expected |
| 16 | Console | No errors | 0 errors |

## 5. Defects found and fixed

| # | Defect | Root cause | Fix | Verified by |
|---|---|---|---|---|
| D1 | Oversized request returned **500** "Calculation error" instead of 413 | The catch-all `except Exception` in `/calculate` swallowed Werkzeug's `RequestEntityTooLarge` | Re-raise `HTTPException`; add a JSON 413 handler; set `MAX_CONTENT_LENGTH` | `test_oversized_body` (failed before the fix, passes after) |
| D2 | No request size limit | `MAX_CONTENT_LENGTH` not configured | Set to 64 KB | `test_oversized_body` |
| D3 | Correctness checks disabled under `python -O` | They used `assert` | `verify()` raising `VerificationError` | Manual `python -O` check |
| D4 | Switching the fill toggle from "Random" back to "Type them" **erased every entry** | `fillMatrix('manual')` reset all values to `''` | Toggle replaced by explicit Random / Identity / Clear actions | UI tests 1, 12 |
| D5 | After a failed Solve, pressing Clear left every cell flagged amber | `showEmpty` was not reset by the Clear action | All bulk changes go through `setValues()`, which resets it | UI test 6 |
| D6 | A non-JSON server reply (e.g. an HTML error page) was reported as "Cannot reach the server" | `response.json()` threw, and the code treated that as a network failure | Content-Type check with a separate message | Code review; `test_get_not_allowed` / `test_oversized_body` confirm the server now always returns JSON |
| D7 | `GET /calculate` returned an HTML 405 page | No handler | JSON 405 handler | `test_get_not_allowed` |
| D8 | An empty entry sent to the API gave "invalid number" | No separate empty check | Specific "Empty matrix entry" message | `test_bad_inputs_return_400_with_message` |
| D9 | Singular result gave no determinant and no reduced matrix | Not implemented | det A computed during elimination; reduced matrix shown | `test_singular_payload`, UI test 10 |
| D10 | Tabs had no `aria-controls` or keyboard switching; invalid cells were not announced | Missing ARIA | Added `aria-controls`, `aria-selected`, roving `tabindex`, arrow keys, `aria-invalid`, live regions | Code review |

Two layout issues introduced during the redesign were found in browser testing and fixed before release: the brand mark wrapped "A / −1" (fixed by using flex instead of grid), and superscripts were split from their labels in flex containers (fixed by wrapping them in spans).

## 6. Mathematical audit conclusion

The original algorithm was **correct**: exact Gauss–Jordan elimination with first-nonzero pivoting, explicit elementary matrices, and exact left and right inverse checks. It was kept unchanged in substance. The independent adjugate comparison (150 matrices), the NumPy comparison (up to 10×10), the hand-worked cases and the edge cases found **no mathematical errors**. The new determinant output matches cofactor expansion in every tested case.

## 7. Not covered / remaining risks

- No automated end-to-end browser test (e.g. Playwright); the UI was tested manually in the browser pane as listed in §4.
- Clipboard copy was checked by code review only (headless clipboard permissions block an automated check).
- Not tested on physical iOS or Android devices; mobile was emulated at 375×812.
- `launcher.py` was smoke-tested with `--no-browser`. Port 5000 was busy, so it fell back to a free port (50565). `GET /` returned 200, `/static/style.css` returned 200, and `POST /calculate` [[4,7],[2,6]] returned [[3/5,−7/10],[−1/5,2/5]] with det 10. `start_windows.bat` (unchanged) was not run.
