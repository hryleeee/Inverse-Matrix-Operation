# Changelog

## [3.0.0] — 2026-11-18 — "Inverse Workbench" redesign

### Changed
- **New visual identity.** The app is renamed from "The Matrix" to **Inverse Workbench**, with the wordmark [A]⁻¹. It uses warm paper, ink and one vermilion accent, IBM Plex Sans/Mono with Source Serif 4 italic for math variables, hairline rules, and graph-paper fields. The rounded cards, indigo palette and shadows are gone.
- **Layout.** Swiss-style "sheets": each section has a left label column (§ number, serif title, meta line) and a content column. There is a compact introduction with a typeset Fig. 1 (A·A⁻¹ = I for a 2×2 example), and a masthead with numbered section navigation (1 Matrix · 2 Inverse · 3 Check · 4 Steps · 5 Method). The current section is underlined, and the result links stay disabled until there is a result.
- **Matrix input.** The grid now looks like an instrument: graph paper, printed brackets, row and column indices (the indices of the focused cell light up), square cells with an ink underline and a vermilion focus underline, and an "A ∈ ℚⁿˣⁿ" title bar. Cells keep a readable minimum width on phones; wide matrices scroll inside the frame.
- **Results** are now three sequential sections instead of Answer/Steps tabs:
  - **§2 Inverse:** status tag, A⁻¹ in vermilion brackets, a factored form (1/d)·N, a facts row (det A, order, row operations, arithmetic), Exact/Decimal and Copy.
  - **§3 Verification** (new): A·A⁻¹ and A⁻¹·A, each shown next to I with a *Holds* / *Fails* verdict. For a singular A, it shows why no X with AX = I can exist.
  - **§4 Elimination:** a log with Eᵢ in the margin, monospace operations, thin graphite brackets for intermediate matrices, and expandable running products. Logs longer than 10 steps start collapsed to the first 6, with a "Show all" control.
- **§5 Method** is now a reference section with the defining equation, a table of elementary operations with det E, and the algorithm in four lines.
- Wording is shorter and more precise throughout (e.g. "Compute A⁻¹", "A is incomplete", "Reset workspace").
- The theme toggle is a text control ("Dark" / "Light") instead of an icon.
- `launcher.py` console title and banner use the new name.

### Added
- API fields `verification` (`right`, `left`, `right_ok`, `left_ok`) and `inverse_factored` (`denominator`, `matrix`), plus `factored()` in `app.py`.
- Motion: new cells scale in after a resize, a vermilion rule draws across each result section as it appears, log steps appear with a stagger, and details panels fade open. All of it is disabled under `prefers-reduced-motion`.
- Skip link, `aria-pressed` on the theme toggle, `aria-expanded` on the step-log toggle.
- Tests: `test_verification_and_factored_form`; the singular-payload test now also checks that `verification` and `inverse_factored` are `null`; the page test checks for the new markup.

### Unchanged
- All mathematics, input limits, validation rules, API error behaviour, examples, keyboard and paste input, Copy, the stale warning and Reset.

## [2.0.0] — 2026-11-18

### Added
- **Determinant** of A, computed exactly during the same elimination, shown in the result summary (with a decimal approximation for fractions).
- **Exact / Decimal** toggle for A⁻¹ (decimals rounded to 6 significant digits with `Decimal`, so they never overflow).
- **Copy A⁻¹** button (tab-separated, pastes into spreadsheets), with a fallback for non-secure contexts.
- **Reset** button.
- **Examples** menu with 7 matrices (basic, tridiagonal, row swap, decimals, fractions, diagonal, singular).
- **Identity** fill action.
- **Paste** support: spreadsheet, CSV, whitespace or `[1 2; 3 4]` text. A square block pasted into the top-left cell resizes A.
- **Keyboard navigation**: arrow keys between cells, Enter moves on (and calculates from the last cell), Ctrl/⌘+Enter calculates from any cell. Arrow keys switch tabs.
- **Result summary** card: invertible/singular status, size, det A, number of row operations.
- Singular results now show the **reduced matrix** and the column with no pivot.
- **Dark theme**: follows the system setting and can be toggled (saved in `localStorage`).
- Filled-cell counter, a loading spinner on the calculate button, and a stale-result warning.
- JSON error handlers for 405 and 413; `MAX_CONTENT_LENGTH = 64 KB`.
- API fields: `matrix`, `inverse_decimal`, `determinant`, `determinant_decimal`.
- Tests: `tests/test_accuracy.py` (25 tests: an independent adjugate reference, a NumPy cross-check, Hilbert matrices, tiny determinants, parsing, API) and `tests/test_frontend.js` (7 Node tests).
- Documentation: `README.md`, `MATHEMATICAL_METHODS.md`, `SYSTEM_DOCUMENTATION.md`, `QA_REPORT.md`, `CHANGELOG.md`.

### Changed
- **Complete UI redesign**: sticky top bar, card layout (two columns on desktop, one on tablet and phone), a token-based design system, clearer mathematical typography, timeline-style step cards, and a success/failure summary.
- Accessibility: labelled controls, `aria-invalid` on bad cells, a proper tab pattern (`aria-controls`, `aria-selected`, roving tabindex), live regions, visible focus rings, `prefers-reduced-motion`.
- The answer matrices are now rendered on the client from arrays; the step-by-step HTML is still rendered on the server.
- Correctness checks use `verify()` instead of `assert`, so they also run under `python -O`.
- Step HTML: each step shows the operation type and E·Aᵢ₋₁ → Aᵢ. The conclusion card shows the proof, the inverse and the exact check.
- `README.md` is now the main documentation and includes all of `README.txt` (running, testing, the PyInstaller build). `README.txt` is still in the folder but is out of date (for example, it still mentions the removed "Type them / Random" toggle); it can be deleted.

### Fixed
- An oversized request returned 500 instead of 413 (the catch-all exception handler swallowed `HTTPException`).
- Switching the fill mode from "Random" back to "Type them" erased every entry.
- Clear after a failed calculation left every cell flagged as empty.
- A non-JSON server response was reported as "cannot reach the server".
- `GET /calculate` returned an HTML error page instead of JSON.
- An empty entry sent to the API was reported as "invalid number" instead of "empty".

### Removed
- The fill-mode toggle ("Type them / Random"). It is replaced by explicit Random / Identity / Clear buttons, and the random range is still adjustable.
- Unused API fields `input_html`, `inverse_html` and `verification_html` (the only consumer was the old script).
- About 40 unused CSS rules left over from an earlier multi-operation calculator (`.op`, `.operand`, `.operator`, `.equation`, `.remove-btn`, `.alert-list`, `.entry-calc`, `.hover-hint`, …).
- Stale `__pycache__` bytecode.

### Unchanged on purpose
- The core algorithm: exact `Fraction` Gauss–Jordan elimination with explicit elementary matrices and first-nonzero pivoting. It was audited, found correct, and kept.
- Input limits (1×1–10×10, values in [−1000, 1000], 32 characters per entry) and the accepted number formats.
- `launcher.py`, `start_windows.bat`, `requirements.txt`, `README.txt` (superseded by `README.md`).
