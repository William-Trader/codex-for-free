@echo off
setlocal
cd /d "%~dp0"
echo Codex for Free - Windows installer
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
