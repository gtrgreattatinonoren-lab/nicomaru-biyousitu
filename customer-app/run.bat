@echo off
rem Launches the Nikomaru Salon customer app (double-click to run).
rem NOTE: This window is written in English on purpose. Japanese text in a
rem .bat file can be misread by Windows depending on the system's language
rem settings, which can make the window close instantly without showing an
rem error. The app itself (the window that opens) is in Japanese as normal.
cd /d "%~dp0"

echo Starting Nikomaru Salon Customer App...
echo (Keep this window open. Closing it will close the app too.)
echo.

where python >nul 2>nul
if not %errorlevel%==0 (
    echo [ERROR] Python was not found.
    echo Please check step 1 of README.md (installing Python).
    echo.
    pause
    exit /b 1
)

python app.py
set EXITCODE=%errorlevel%

echo.
if not %EXITCODE%==0 (
    echo The app closed with an error. ^(exit code: %EXITCODE%^)
    echo Please check the message above, or the file error_log.txt in this folder,
    echo and share its contents so the issue can be fixed.
) else (
    echo The app was closed normally.
)
pause
