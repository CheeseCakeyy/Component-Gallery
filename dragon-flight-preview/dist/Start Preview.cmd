@echo off
setlocal
cd /d "%~dp0"
title Dragonflight Preview
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0preview-server.ps1"
if errorlevel 1 (
  echo.
  echo The preview could not start. See the message above.
  pause
)
endlocal
