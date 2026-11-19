# Inverse-Matrix-Operation
A modern, interactive mathematical application for calculating inverse matrices, exploring step-by-step solutions, and verifying results through matrix multiplication. Built with a mathematics-inspired interface focused on precision, clarity, and usability.
Inverse Workbench — Exact Matrix Inverse Calculator
(Formerly "The Matrix".)

A local web application that finds the inverse A⁻¹ of a square matrix A and explains every step. It uses Gauss–Jordan elimination, and each row operation is shown as an elementary matrix Eᵢ. All arithmetic is done with exact fractions, so the answers have no rounding error.

Here’s how to run it in VS Code.

1. Open the right folder

Use File → Open Folder… and choose the inner folder, the one that contains app.py:

Downloads\inverse matrix-20261118T022608Z-1-001\inverse matrix

2. Install the Python extension

In the Extensions panel (Ctrl+Shift+X), search for Python (by Microsoft) and install it. Then press Ctrl+Shift+P, run Python: Select Interpreter, and pick your Python 3.10 or newer.

3. Install Flask (first time only)

Open the terminal with Terminal → New Terminal (Ctrl+`) and run:

python -m pip install -r requirements.txt

4. Run the app

python launcher.py

Your browser should open the calculator. If it doesn’t, copy the http://127.0.0.1:… address printed in the terminal into your browser. Keep the terminal open while you use the app. Press Ctrl+C in the terminal to stop it.

Instead of the launcher, you can run python app.py and then open http://127.0.0.1:5000.

5. Run the tests (optional)

python -m unittest discover -s tests -v

Optional: start it with F5

If you want to start it with F5 (and use breakpoints), create .vscode/launch.json inside the inverse matrix folder:

{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run The Matrix",
      "type": "debugpy",
      "request": "launch",
      "program": "${workspaceFolder}/launcher.py",
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}

After that, pressing F5 starts the app and opens the browser.
