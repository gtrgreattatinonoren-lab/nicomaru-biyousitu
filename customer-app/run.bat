@echo off
rem Launches the Nikomaru Salon customer app (double-click to run).
rem NOTE: Everything below is written in English on purpose (see README.md).
rem This script writes what it is doing to run_debug.log in this same folder,
rem so that even if this window closes too fast to read, you can open that
rem log file afterwards and see exactly what happened.
cd /d "%~dp0"
set LOGFILE=run_debug.log

echo ==== %date% %time% ==== > "%LOGFILE%"
echo Step 1: run.bat started. Folder: %cd% >> "%LOGFILE%"

echo Starting Nikomaru Salon Customer App...
echo (Keep this window open. Closing it will close the app too.)
echo.

where python >nul 2>>"%LOGFILE%"
if not %errorlevel%==0 (
    echo Step 2: python.exe was NOT found on PATH >> "%LOGFILE%"
    echo [ERROR] Python was not found.
    echo Please check step 1 of README.md (installing Python).
    echo Details were saved to %LOGFILE%
    echo.
    pause
    exit /b 1
)
echo Step 2: python.exe found >> "%LOGFILE%"
python --version >> "%LOGFILE%" 2>&1

echo Step 3: launching app.py >> "%LOGFILE%"
python app.py >> "%LOGFILE%" 2>&1
set EXITCODE=%errorlevel%
echo Step 4: app.py exited with code %EXITCODE% >> "%LOGFILE%"

echo.
if not %EXITCODE%==0 (
    echo The app closed with an error. ^(exit code: %EXITCODE%^)
    echo Please open run_debug.log in this folder and share its contents
    echo so the issue can be fixed.
) else (
    echo The app was closed normally.
)
pause
