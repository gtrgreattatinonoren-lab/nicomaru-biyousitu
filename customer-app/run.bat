@echo off
rem にこまる美容室カルテアプリを起動します(ダブルクリックで実行)
cd /d "%~dp0"
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw app.py
) else (
    python app.py
)
