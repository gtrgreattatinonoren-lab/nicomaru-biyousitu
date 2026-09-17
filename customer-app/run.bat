@echo off
rem Launches the Nikomaru Salon customer app (double-click to run).
rem NOTE: Everything below is written in English on purpose (see README.md).
rem This script writes what it is doing to run_debug.log in this same folder,
rem so that even if this window closes too fast to read, you can open that
rem log file afterwards and see exactly what happened.
cd /d "%~dp0"
set LOGFILE=run_debug.log

echo ==== run.bat started ==== > "%LOGFILE%"
echo Folder: %cd% >> "%LOGFILE%"

echo Starting Nikomaru Salon Customer App...
echo (Keep this window open. Closing it will close the app too.)
echo Log file: %LOGFILE%
echo.

echo About to run: python app.py >> "%LOGFILE%"
python app.py >> "%LOGFILE%" 2>&1
set EXITCODE=%errorlevel%
echo app.py finished with exit code %EXITCODE% >> "%LOGFILE%"

echo.
if not %EXITCODE%==0 (
    echo The app closed with an error. ^(exit code: %EXITCODE%^)
    echo Please open run_debug.log in this folder and share its contents
    echo so the issue can be fixed.
) else (
    echo The app was closed normally.
)
pause
