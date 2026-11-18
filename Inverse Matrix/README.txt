THE MATRIX — ELEMENTARY MATRIX INVERSE CALCULATOR
==================================================

PURPOSE
-------
Input:  a square matrix A (1x1 up to 10x10).
Output: the inverse A^(-1), when it exists.
Method: Gauss–Jordan row reduction using explicit elementary matrices E_i.

    E_k ... E_2 E_1 A = I
    A^(-1) = E_k ... E_2 E_1

Each row operation constructs an elementary matrix E_i and applies it to
both the evolving matrix A and the cumulative product P_i = E_i ... E_1.
The inverse is P_k, not the identity matrix. A singular matrix has no inverse.
Exact Fraction arithmetic preserves rational answers without floating error.

HOW TO RUN (Python 3.10+)
-------------------------
Windows shortcut: double-click start_windows.bat (Python must be installed).

Or start manually:
1. Install Flask:   python -m pip install -r requirements.txt
2. Launch:          python launcher.py
3. The browser opens automatically. Keep the terminal window open.
   If it does not, open the local address printed in the terminal.
4. Enter one matrix A. Use Type them or Random; adjust square size with +/-.
5. Press Find inverse. "Answer" shows A^(-1); "Solution" shows all E_i,
   their operations, intermediate matrices and cumulative products.

You may also run: python app.py   (then visit http://127.0.0.1:5000).

SUPPORTED INPUT
---------------
Integers, finite decimals, and simple fractions such as -5/2.
Values must lie in [-1000, 1000].
For a singular matrix the program explains why no inverse exists.
The random generator does not guarantee an invertible matrix.

RUN TESTS
---------
python -m unittest discover -s tests -v

FILES
-----
app.py                Flask / exact row operations / elementary matrices
launcher.py           Original local browser launcher, wording updated
start_windows.bat     Double-click Windows startup helper
templates/index.html  Adapted HTML using existing design
static/style.css      Original CSS with small inverse-related additions
static/script.js      UI behavior rewritten only for inversion
tests/test_inverse.py Tests for exact result, steps, bad inputs, singularity

NOT INCLUDED
------------
The old .pyc files are compiled caches for the original matrix calculator.
They are intentionally excluded; they are not needed for this rewrite.
The old executable and PDF documentation were not source uploads.

OPTIONAL: BUILD A WINDOWS EXECUTABLE
------------------------------------
python -m pip install pyinstaller
python -m PyInstaller --onefile --console --name "The Matrix - Inverse" ^
    --add-data "templates;templates" --add-data "static;static" launcher.py

Windows executable builds should be run on Windows, not Linux.
