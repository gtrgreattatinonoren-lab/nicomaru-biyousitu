@echo off
rem にこまる美容室カルテアプリを起動します(ダブルクリックで実行)
rem ※ この黒い画面(コンソール)はアプリの裏側の状態を表示するためのものです。
rem    閉じずに、アプリの画面と一緒にそのままにしておいてください。
cd /d "%~dp0"

echo にこまる美容室カルテを起動しています...
echo (この画面を閉じるとアプリも終了します)
echo.

where python >nul 2>nul
if not %errorlevel%==0 (
    echo [エラー] Pythonが見つかりませんでした。
    echo README.md の「1. Pythonをインストールする」を確認してください。
    echo.
    pause
    exit /b 1
)

python app.py
set EXITCODE=%errorlevel%

echo.
if not %EXITCODE%==0 (
    echo アプリが予期せず終了しました。(終了コード: %EXITCODE%)
    echo 上に表示されているエラー内容、または同じフォルダ内の error_log.txt の内容を教えてください。
) else (
    echo アプリを終了しました。
)
pause
