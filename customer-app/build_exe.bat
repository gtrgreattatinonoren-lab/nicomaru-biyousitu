@echo off
rem このアプリをWindowsの.exeファイルに変換します。
rem 実行にはPythonがインストールされている必要があります(README.md参照)。
cd /d "%~dp0"

echo PyInstallerをインストールしています...
python -m pip install --upgrade pyinstaller

echo .exeファイルを作成しています...
python -m PyInstaller --onefile --noconsole --name "にこまる美容室カルテ" app.py

echo.
echo 完了しました。dist フォルダの中に「にこまる美容室カルテ.exe」ができています。
pause
