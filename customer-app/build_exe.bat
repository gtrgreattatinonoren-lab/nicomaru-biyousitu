@echo off
rem Builds a Windows .exe of this app. Run this ON YOUR WINDOWS PC.
rem NOTE: This window is written in English on purpose (see run.bat for why).
cd /d "%~dp0"

echo Installing PyInstaller...
python -m pip install --upgrade pyinstaller

echo Building the .exe file...
python -m PyInstaller --onefile --noconsole --icon "app_icon.ico" --add-data "app_icon.ico;." --name "NikomaruSalonKarte" app.py

echo.
echo Done. You will find NikomaruSalonKarte.exe inside the "dist" folder.
echo (You can rename it to a Japanese name in Windows Explorer if you like -
echo  that is safe to do, unlike editing this .bat file.)
pause
