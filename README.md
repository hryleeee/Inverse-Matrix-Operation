# Inverse-Matrix-Operation
A modern, interactive mathematical application for calculating inverse matrices, exploring step-by-step solutions, and verifying results through matrix multiplication. Built with a mathematics-inspired interface focused on precision, clarity, and usability.
Inverse Workbench — Exact Matrix Inverse Calculator
(Formerly "The Matrix".)

A local web application that finds the inverse A⁻¹ of a square matrix A and explains every step. It uses Gauss–Jordan elimination, and each row operation is shown as an elementary matrix Eᵢ. All arithmetic is done with exact fractions, so the answers have no rounding error.

1. Overview
You enter a square matrix (1×1 up to 10×10) in the browser. The Python/Flask server:

checks the input,
reduces A to the identity matrix I with elementary row operations, building each one as an explicit matrix Eᵢ,
returns A⁻¹ = Eₖ ··· E₂E₁ (or explains why no inverse exists),
confirms that A·A⁻¹ = A⁻¹·A = I exactly before it answers.
2. Purpose and objectives
Compute correct inverses, with no floating-point error.
Teach the elementary-matrix view of Gauss–Jordan elimination.
Say clearly when a matrix is singular, and explain why.
Stay simple to run: one Python dependency (Flask) and no build step.
3. Key features
Area	Feature
Input	A graph-paper input grid with row and column indices (the indices of the focused cell light up), order stepper 1–10 (existing values are kept when resizing), arrow-key and Enter navigation, paste from a spreadsheet, CSV or [1 2; 3 4] text, live per-cell validation, filled-entry counter
Quick fill	Random (adjustable whole-number range), Identity, Clear, 7 built-in examples (including a singular one and one that needs a row swap)
§2 Inverse	Invertible/singular status, A⁻¹ as the main result, a factored form (1/d)·N when the inverse has fractions, exact det A, order, number of row operations
Formats	Exact fractions (-3/13) or decimals rounded to 6 significant digits
§3 Verification	A·A⁻¹ and A⁻¹·A recomputed exactly and shown next to I, with a verdict for each; for a singular A, a short explanation of why no inverse can exist
§4 Elimination	Every Eᵢ, the matrices before and after (Aᵢ₋₁ → Aᵢ), the running product Pᵢ (expandable), and hover tracing of the affected rows; logs longer than 10 steps start collapsed to the first 6
Utilities	Copy A⁻¹ as tab-separated rows (pastes into Excel/Sheets), Reset workspace, a warning when results are out of date after A is edited
UI	Paper, ink and vermilion design system; section navigation (result links stay disabled until there is a result); responsive (phone, tablet, desktop); light and dark themes; keyboard and screen-reader friendly; animations respect reduced-motion settings
4. Technology stack
Layer	Technology
Backend	Python 3.10+ (tested on 3.13.3), Flask ≥ 3.0, < 4 (tested on 3.1.3)
Math	Python standard library fractions.Fraction and decimal.Decimal (no NumPy needed at runtime)
Frontend	Plain HTML, CSS (custom properties) and vanilla JavaScript; no framework, no build step
Fonts	Google Fonts: IBM Plex Sans (interface), IBM Plex Mono (numbers), Source Serif 4 (headings and italic math variables). System fonts are used when offline
Tests	Python unittest; Node.js built-in node:test (optional)
5. Mathematical methods implemented
Gauss–Jordan elimination expressed as elementary matrices, using exact rational arithmetic.

E_k ··· E_2 E_1 A = I    ⟹    A⁻¹ = E_k ··· E_2 E_1
Pivoting: the first nonzero entry on or below the diagonal. Because the arithmetic is exact, any nonzero entry is a valid pivot.
Singularity: if a column has no nonzero pivot, A is singular (det A = 0).
Determinant: found during the same elimination: det A = (−1)^(number of swaps) × ∏ pivots.
Verification: Eᵢ·Aᵢ₋₁ is checked against the row operation at every step, and A⁻¹A = AA⁻¹ = I is checked at the end.
See MATHEMATICAL_METHODS.md for the full derivation.

6. System architecture
Browser (templates/index.html + static/script.js + static/style.css)
   │  validates input live, sends entries as strings
   │  POST /calculate  {"matrix": [["2","1"],["5","3"]]}
   ▼
Flask (app.py)
   parse_matrix ─► invert_with_elementary_matrices ─► solution_to_html
   (Fraction parsing,  (Gauss–Jordan + Eᵢ + det +       (step-by-step HTML)
    range/shape checks)  exact verification)
   │  JSON: inverse, inverse_decimal, inverse_factored, determinant,
   │        verification (A·A⁻¹, A⁻¹·A), steps HTML …
   ▼
Browser renders §2 Inverse, §3 Verification and §4 Elimination
More detail is in SYSTEM_DOCUMENTATION.md.

7. Project directory structure
inverse matrix/
├── app.py                    Flask app: parsing, exact inversion, HTML steps, JSON API
├── launcher.py               Starts a local server on a free port and opens the browser
├── start_windows.bat         Double-click helper for Windows (installs Flask if needed)
├── requirements.txt          Flask>=3.0,<4
├── templates/index.html      Page markup
├── static/style.css          Design system, themes, responsive layout
├── static/script.js          UI behavior and the pure validation/paste helpers
├── tests/test_inverse.py     Original regression tests (updated)
├── tests/test_accuracy.py    Independent accuracy, parsing, edge-case and API tests
├── tests/test_frontend.js    Node tests for the browser-side helpers
├── README.md                 This file
├── MATHEMATICAL_METHODS.md   Algorithm, proofs, determinant, exactness
├── SYSTEM_DOCUMENTATION.md   Modules, API contract, data flow, design decisions
├── QA_REPORT.md              Test cases and actual results
└── CHANGELOG.md              What changed and why
8. Installation requirements
Python 3.10 or newer with pip
Flask (installed from requirements.txt)
A modern browser (Chrome, Edge, Firefox or Safari)
Optional: Node.js 18+ to run the frontend unit tests; NumPy to run the NumPy cross-check test (it is skipped if NumPy is missing)
9. Setup
Run these from inside the inverse matrix folder:

python -m pip install -r requirements.txt
10. Running the application
Windows: double-click start_windows.bat. It installs Flask if needed, then starts the launcher.

Any OS:

python launcher.py
The launcher prints a local address (port 5000 when it is free, otherwise a random free port) and opens your browser. Keep the terminal window open while you use the app. To start without opening a browser, add --no-browser.

You can also run Flask directly and then visit http://127.0.0.1:5000:

python app.py
11. Entering a matrix
Set the order with − and + (1×1 to 10×10). Existing entries are kept.

Type a value in each cell. Accepted formats:

integers: 4, -7, +2
finite decimals: 0.5, -.25, 3.
fractions: 3/4, -5/2
Every value must be between −1000 and 1000, and each entry can be at most 32 characters. Scientific notation (1e3) is not accepted.

Move between cells with the arrow keys. Enter moves to the next cell and, on the last cell, calculates.

Or use Load (example matrices), Random (set its range under Random entries range), Identity or Clear.

To paste a whole matrix, copy it from a spreadsheet or as text (1 2; 3 4), then paste it into the top-left cell. A square block resizes A to match.

Invalid cells turn red and empty cells turn amber after you try to calculate. The message under the grid names the row and column.

12. Calculating the inverse
Press Compute A⁻¹ (or Ctrl/⌘ + Enter in any cell). Three sections appear below the workspace, and the navigation links to them become active:

§2 Inverse: an Invertible or Singular tag, A⁻¹ in vermilion brackets (plus the factored form (1/d)·N when the inverse has fractions), det A, the order and the number of row operations, an Exact/Decimal toggle and Copy A⁻¹ as rows
§3 Verification: A·A⁻¹ and A⁻¹·A, each shown next to I with a Holds verdict (or, for a singular A, why no X with AX = I can exist)
§4 Elimination: every elementary matrix and how it changes A, then the conclusion
If you edit A after computing, §2–§4 are dimmed and marked as out of date until you compute again. Reset workspace clears everything and returns to an empty 3×3 matrix.

13. How the math works (short version)
Each row operation is the same as multiplying on the left by an elementary matrix:

Row operation	Elementary matrix	det Eᵢ
Rᵢ ↔ Rⱼ (swap)	I with rows i and j swapped	−1
Rᵢ ← c·Rᵢ (scale, c ≠ 0)	I with c at position (i, i)	c
Rᵢ ← Rᵢ + c·Rⱼ (add a multiple)	I with c at position (i, j)	1
Reducing A to I gives Eₖ···E₁A = I, so Eₖ···E₁ is a left inverse. For a square matrix, a left inverse is also the right inverse, so A⁻¹ = Eₖ···E₁. The app builds this product step by step as Pᵢ = EᵢPᵢ₋₁.

14. Sample inputs and expected outputs
Example 1 — 2×2

A = | 4  7 |      det A = 10      A⁻¹ = |  3/5   -7/10 |
    | 2  6 |                             | -1/5    2/5  |
Check: 4·(3/5) + 7·(−1/5) = 12/5 − 7/5 = 1 and 4·(−7/10) + 7·(2/5) = −28/10 + 28/10 = 0.

Example 2 — 2×2, four elementary matrices (the "2×2 basic" example)

A = | 2  1 |   R1 ← (1/2)R1,  R2 ← R2 − 5R1,  R2 ← 2R2,  R1 ← R1 − (1/2)R2
    | 5  3 |
A⁻¹ = E₄E₃E₂E₁ = |  3  -1 |      det A = 1
                 | -5   2 |
Example 3 — 3×3 that needs a row swap (the "3×3 needs a row swap" example)

A = | 0  2  1 |                  A⁻¹ = (1/13) | -3   1   6 |
    | 1  0  3 |     det A = 13                 |  6  -2   1 |
    | 2  1  0 |                                |  1   4  -2 |
The first operation is R1 ↔ R2, because the (1,1) entry is 0.

Example 4 — fractions

A = | 1/2  1/3 |    det A = 1/60    A⁻¹ = |  12  -20 |
    | 1/4  1/5 |                          | -15   30 |
Example 5 — singular

A = | 1  2  3 |
    | 4  5  6 |    det A = 0  →  "A is singular — no inverse exists" (column 3 has no pivot)
    | 7  8  9 |
15. Error handling
Situation	What the user sees
Empty cells	Amber cells and the alert Matrix A is not complete yet; the request is not sent
Non-numeric value, 1/0, 1e3, …	Red cell and a message naming the row, column and fix
Value outside −1000…1000	Red cell: outside the allowed range
Singular matrix	A clear singular status, det A = 0, and the reduced matrix showing the missing pivot
Malformed or non-square API payload	HTTP 400 with {title, message, remedy}
Payload over 64 KB	HTTP 413 Request too large
Server unreachable	Cannot reach the calculator. Keep the launcher window open…
Unexpected server error	HTTP 500 with a generic message; details are logged on the server, not shown to the user
The server repeats every check, so it is safe even when the browser checks are bypassed.

16. Testing
From the inverse matrix folder:

python -m unittest discover -s tests -v
node --test tests/test_frontend.js
The Python suite (36 tests) compares results with hand-worked inverses, an independent cofactor/adjugate implementation, and NumPy (when installed). It also covers parsing, edge cases and the HTTP API. See QA_REPORT.md for the latest results.

17. Known limitations
The maximum size is 10×10, and entries must be between −1000 and 1000. Both limits are set at the top of app.py.
Scientific notation is not accepted.
For 9×9 and 10×10 matrices, the step-by-step HTML can reach about 2 MB (about 100 steps × 4 matrices). It still renders, and only the first 6 steps are shown until you expand the log, but it is heavy on low-end phones.
Exact fractions can have very long numerators and denominators. Those cells scroll horizontally instead of wrapping.
Decimal view is rounded to 6 significant digits. Use Exact for precise values.
Row tracing by hover needs a mouse; touch users see the static highlighting.
The app needs the local Python server; it is not a static, offline-only page.
Random fill does not guarantee an invertible matrix (singular results are reported honestly).
18. Troubleshooting
Problem	Fix
ModuleNotFoundError: No module named 'flask'	Run python -m pip install -r requirements.txt
The browser does not open	Copy the address printed in the terminal into your browser
Cannot reach the calculator	The launcher window was closed. Start it again
Port 5000 is busy	launcher.py picks a free port automatically. With python app.py, stop the other program first
Fonts look plain	Google Fonts could not load (offline). The app still works with system fonts
'python' is not recognized (Windows)	Install Python from python.org and tick Add to PATH, or use py -3 launcher.py
Optional: Windows executable
python -m pip install pyinstaller
python -m PyInstaller --onefile --console --name "Inverse Workbench" --add-data "templates;templates" --add-data "static;static" launcher.py
Build it on Windows. The ; separator in --add-data is Windows-specific.

19. Credits and license
Built with Flask and the Python standard library. Fonts: Space Grotesk, Inter and JetBrains Mono, served by Google Fonts.

License: the project has no license file, so no license is claimed here. Add a LICENSE file to state the terms.
