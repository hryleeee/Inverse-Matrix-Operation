@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    set "PYCMD=py -3"
) else (
    set "PYCMD=python"
)
%PYCMD% -c "import flask" >nul 2>nul
if errorlevel 1 (
    echo Flask is required. Installing dependencies...
    %PYCMD% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Unable to install Flask. Check Python and Internet access.
        pause
        exit /b 1
    )
)
%PYCMD% launcher.py
if errorlevel 1 pause
