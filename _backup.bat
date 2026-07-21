@echo off
REM ============================================================
REM  ipnak (입낚) - create a restore-point backup
REM  Copies this project to a sibling timestamped folder,
REM  excluding node_modules / .next / .git (re-installable).
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
title ipnak backup

pushd "%~dp0"
set "SRC=%CD%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "DEST=%~dp0..\입낚_backup_%TS%"

echo [backup] Source : "%SRC%"
echo [backup] Target : "%DEST%"
echo [backup] Copying (this may take a moment) ...
echo.

robocopy "%SRC%" "%DEST%" /E /XD node_modules .next .git /XF *.log /R:1 /W:1 /NFL /NDL /NP

set RC=%ERRORLEVEL%
echo.
if %RC% GEQ 8 (
  echo [backup] FAILED. robocopy exit code %RC%
) else (
  echo [backup] DONE. Backup created at:
  echo          "%DEST%"
)
popd
echo.
pause
endlocal
