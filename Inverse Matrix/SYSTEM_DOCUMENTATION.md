# System Documentation

## 1. Components

| File | Responsibility |
|---|---|
| `app.py` | Flask application. Input parsing and validation, exact Gauss–Jordan inversion with elementary matrices, determinant, decimal formatting, step-by-step HTML rendering, JSON API, error handlers |
| `launcher.py` | Finds a free port (5000 first), starts a Werkzeug server on 127.0.0.1, sets the Windows console title, opens the browser (`--no-browser` skips that) |
| `start_windows.bat` | Uses `py -3` or `python`, installs Flask if it cannot be imported, runs `launcher.py` |
| `templates/index.html` | Page structure: masthead with section navigation, compact introduction with Fig. 1, then §1 Matrix A, §2 Inverse, §3 Verification, §4 Elimination and §5 Method. Injects `window.LIMITS` from the server constants |
| `static/style.css` | Design tokens (light and dark), Swiss two-column sheets, the graph-paper input instrument, matrix typesetting, motion, responsive breakpoints (1080 px, 860 px, 640 px), reduced-motion |
| `static/script.js` | Pure helpers (validation, paste parsing, resizing, examples) plus the UI controller (`startApp`). The helpers are exported for Node tests |

## 2. Server modules (`app.py`)

| Function | Purpose |
|---|---|
| `parse_number(value, row, col)` | Accepts int/float/str. Checks the pattern `^[+-]?(\d+(\.\d*)?|\.\d+|\d+/\d+)$`, the 32-character limit, a nonzero denominator and the range [−1000, 1000]. Returns a `Fraction` or raises `InputError` |
| `parse_matrix(data)` | Requires a non-empty list of n lists, each of length n, with 1 ≤ n ≤ 10 |
| `identity`, `matmul` | Exact helpers |
| `do_row_operation` | Applies a swap, scale or add operation to a copy of a matrix |
| `row_operation_label` | Human-readable label, e.g. `R2 ← R2 − (5) R1` |
| `invert_with_elementary_matrices(a)` | The algorithm (see MATHEMATICAL_METHODS.md). Returns `invertible, inverse, determinant, steps, reduced, failure_column` |
| `verify(cond, msg)` | Raises `VerificationError`. Used instead of `assert` so the checks still run under `python -O` |
| `decimal_text(n)` | Rounds to 6 significant digits using `Decimal`, so it never overflows the way `float` can |
| `matrix_to_html`, `labeled_matrix`, `solution_to_html` | Server-side HTML for the elimination log. All numbers pass through `html.escape`. Labels are built only from internal strings. Math symbols are wrapped in `<var>` so CSS can set them as italic serif |
| `row_operation_explanation(...)`, `plain_number(n)` | Plain-language sentence for each step ("Divide row 1 by 2 so its diagonal entry becomes 1."), stored as `explanation` beside the notation `description` |
| `factored(matrix)` | Writes A⁻¹ = (1/d)·N with d the lcm of the denominators and N integral. Returns `None` when d = 1 or d > 10⁶ |

## 3. HTTP API

### `GET /`
Returns the application page.

### `POST /calculate`

Request (`Content-Type: application/json`, at most 64 KB):

```json
{ "matrix": [["2", "1"], ["5", "3"]] }
```

Entries should be **strings**, so decimals stay exact. Numbers are also accepted.

Success (200):

```json
{
  "success": true,
  "invertible": true,
  "size": 2,
  "matrix": [["2","1"],["5","3"]],
  "inverse": [["3","-1"],["-5","2"]],
  "inverse_decimal": [["3","-1"],["-5","2"]],
  "determinant": "1",
  "determinant_decimal": "1",
  "inverse_factored": null,
  "verification": {
    "right": [["1","0"],["0","1"]],
    "left":  [["1","0"],["0","1"]],
    "right_ok": true,
    "left_ok": true
  },
  "step_count": 4,
  "failure_column": null,
  "solution_html": "<ol class=\"sol-steps\" data-count=\"4\">…"
}
```

- `inverse_factored` is `{"denominator": "13", "matrix": [["-3","1","6"], …]}` when A⁻¹ has non-integer entries, so A⁻¹ = (1/13)·N.
- `verification.right` is A·A⁻¹ and `verification.left` is A⁻¹·A. They are recomputed in the request handler, separately from the checks inside the solver.
- For a singular matrix, `invertible` is `false`; `inverse`, `inverse_decimal`, `inverse_factored` and `verification` are `null`; `determinant` is `"0"`; and `failure_column` is the 1-based column with no pivot.

Errors return `{"success": false, "error": {"title", "message", "remedy"}}`:

| Status | Cause |
|---|---|
| 400 | Missing or invalid JSON, non-square matrix, bad size, empty, invalid or out-of-range entry |
| 405 | Wrong method (e.g. `GET /calculate`) |
| 413 | Body larger than 64 KB |
| 500 | Unexpected internal error (logged with a traceback; a generic message goes to the client) |

## 4. Frontend data flow

```
state = { size, renderedSize, values[][] (strings), randMin, randMax, showEmpty,
          result, stale, view, busy }

input event ─► state.values ─► updateStatus() ─► cell classes + tooltips, error text, "x of n² cells filled"
                         └──► markChanged() ─► results dimmed + "Calculate again" note
solve() ─► client validation ─► (incomplete: alert with "Fill empty cells with 0")
        └─► fetch /calculate ─► renderResult()
                                 ├─ renderResults()       Step 3: verdict, A → A⁻¹, factored form, format toggle, copy, facts
                                 ├─ renderVerification()  Step 4: verdict + A×A⁻¹ and A⁻¹×A next to I
                                 ├─ renderSteps()         Step 5: server HTML, first step opened
                                 └─ setNavAvailability() + updateStages()
```

- `renderMatrix()` builds one CSS grid: row 1 holds the column numbers, column 1 holds the row numbers, and a bracket frame is laid over the n×n block of cells. Cells added by a resize (index ≥ `renderedSize`) get an `is-new` entrance animation.
- **Workflow stages** (masthead): `updateStages()` marks a stage *done* (green number) when its work is complete: stage 1 when every cell is valid, stages 2–5 when a result exists and is not stale. An `IntersectionObserver` marks the stage in view as *current* (`aria-current="step"`). Stages 3–5 carry `aria-disabled="true"` and a tooltip until the first calculation, and do not navigate.
- `goTo(id)` scrolls to a stage; returning to the matrix focuses its first cell, and "Calculate" focuses the Calculate button. Results are kept while the user edits.
- `pastePlacement()` (pure, unit-tested) decides where a pasted block goes: a square block in the top-left cell replaces the matrix; any other block grows the matrix just enough to fit, up to 10×10, and reports anything that did not fit.

- `showEmpty` stays false until the user first tries to calculate, so empty cells are not shown as errors while the user is still typing.
- A JSON-only check on responses tells "server returned an unexpected page" apart from "server unreachable".
- The theme is stored in `localStorage` (`matrix-theme`) inside `try/catch`. A small inline script in `<head>` applies it before the first paint.

## 5. Design system

The identity is meant to read like a printed linear algebra text on graph paper, not like a web dashboard.

- **Palette:** warm paper (`--paper #f4f0e6`), ink (`--ink #1d1b17`) and one accent, vermilion (`--accent #b5391e`). Vermilion is used only for the primary action, the inverse, section numbers, focus and errors. Forest green (`--ok`) marks verified or invertible results; ochre (`--warn`) marks empty or out-of-date states. The dark theme is a warm "night desk" palette with the same roles.
- **Tokens:** `--paper(-raised/-sunk)`, `--rule(-strong)`, `--grid(-major)`, `--ink(-2)`, `--graphite`, `--accent(-strong/-wash)`, `--ok(-wash)`, `--warn(-wash)`, `--focus-ring`, `--cell-w/-h`, `--label-col`, `--ease`.
- **Type:** IBM Plex Sans for the interface, IBM Plex Mono for numbers and operation notation (tabular figures), and Source Serif 4 italic for math variables (`<var>`) and section headings.
- **Structure:** each section is a "sheet" with a heavy top rule, a left label column (§ number, title, meta) and a content column. There are no rounded cards and no shadows. Hierarchy comes from rules, type and spacing.
- **Matrices:** printed brackets with short serifs. Editable cells are boxes with an ink underline on graph paper, with row and column indices around them. The inverse uses vermilion brackets, intermediate matrices in the log use thin graphite brackets, and verified products are set in green.
- **Motion:** new cells scale in after a resize, focus draws a vermilion underline, a vermilion rule draws across each result section as it appears (staggered 0 / 80 / 160 ms), log steps appear with a 45 ms stagger, and running-product panels fade open. Under `prefers-reduced-motion`, all of this is reduced to instant changes.
- **Layout:** label column and content at 860 px and above, stacked below. Below 980 px the stage bar moves to its own row; below 480 px only the current stage shows its name (the others show their number, with the name kept for screen readers). Buttons and stepper controls are at least 40 px tall. Matrix cells keep a usable minimum width (3.9 rem on phones), and wide matrices scroll inside their own frame, so the page never scrolls sideways.

## 6. Important implementation decisions

| Decision | Reason |
|---|---|
| Keep exact `Fraction` arithmetic and the elementary-matrix algorithm | It was already correct, and it is the educational purpose of the app |
| Track the determinant during elimination instead of adding a cofactor routine | No extra O(n!) or O(n³) pass; it comes from the same steps the user sees |
| Explicit `verify()` instead of `assert` | `python -O` removes `assert` statements |
| Return arrays (`inverse`, `inverse_decimal`, `matrix`) and render the answer on the client | Allows the Exact/Decimal toggle and Copy without another request; removes three unused server HTML fields |
| Remove the "Type them / Random" mode toggle | Switching it back to "Type them" erased every entry. It is replaced by explicit Random / Identity / Clear actions |
| `MAX_CONTENT_LENGTH = 64 KB` | Rejects oversized bodies before parsing |
| No framework and no build step | The app is small. Plain JS keeps setup to `pip install flask` |
| Sequential sections instead of Answer/Steps tabs | The inverse, its verification and its derivation read in order like a worked solution. The stage bar still jumps directly to each one |
| Name the UI after the user's task (Enter matrix, Calculate, Results, Verify, Steps; Size, Examples, Start over) | First-time users should not need to know "order", "elimination" or "workspace". The mathematical notation is still shown, next to plain language |
| Every step collapsible, first one open | A one-line summary per step keeps long solutions scannable (99 steps for a 10×10); opening the first step shows newcomers what a step contains. This replaced the earlier "show first 6 steps" collapse |
| Paste grows the matrix instead of truncating | Truncating silently lost data; growing to fit (up to 10×10) matches what users expect from a spreadsheet |
