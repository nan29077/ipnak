@echo off
REM ============================================================
REM  ipnak (입낚) - dev server launcher  [port 3010]
REM  Double-click to install deps and start the dev server.
REM  Safe for external drives (E:) and non-ASCII (Korean) paths.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title ipnak dev server (port 3010)

REM --- Always run from this script's own folder (handles Korean path) ---
cd /d "%~dp0"
echo [ipnak] Project folder: "%CD%"
echo.

set "PORT=3010"

REM --- 1) Check Node.js / npm ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo         Install Node.js LTS from https://nodejs.org/ and run again.
  echo.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js LTS.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"
echo [ipnak] Node.js %NODEV% detected.
echo.

REM --- 2) Ensure .env exists ---
if not exist ".env" (
  if exist ".env.example" (
    echo [ipnak] .env not found - creating from .env.example ...
    copy /y ".env.example" ".env" >nul
  )
)

REM --- 3) Detect broken / missing node_modules ---
set "NEED_INSTALL=0"
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\next" set "NEED_INSTALL=1"
if not exist "node_modules\.bin\next.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\@prisma\client" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  if exist "node_modules" (
    echo [ipnak] node_modules looks incomplete - cleaning ...
    rmdir /s /q "node_modules" 2>nul
  )
  if exist ".next" rmdir /s /q ".next" 2>nul
  echo [ipnak] Installing dependencies ^(npm install^) ...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [WARN] npm install failed - retrying after a clean wipe ...
    rmdir /s /q "node_modules" 2>nul
    del /f /q "package-lock.json" 2>nul
    call npm install --no-audit --no-fund
    if errorlevel 1 (
      echo.
      echo [ERROR] Dependency install failed. See messages above.
      echo.
      pause
      exit /b 1
    )
  )
) else (
  echo [ipnak] Dependencies already installed - skipping npm install.
)
echo.

REM --- 4) Database: generate client + create/seed SQLite db if missing ---
echo [ipnak] Preparing Prisma client ...
call npx prisma generate >nul 2>&1
if not exist "prisma\dev.db" (
  echo [ipnak] Local database not found - creating and seeding ...
  call npm run db:reset
) else (
  echo [ipnak] Local database found - applying schema ...
  call npx prisma db push >nul 2>&1
)
echo.

REM --- 5) Strict port: make sure 3010 is free ---
set "PORT_BUSY="
for /f "tokens=*" %%a in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do set "PORT_BUSY=1"
if defined PORT_BUSY (
  echo [ERROR] Port %PORT% is already in use.
  echo         Close the program using it, or free the port, then run again.
  echo         ^(strictPort: this launcher will not fall back to another port^)
  echo.
  pause
  exit /b 1
)

REM --- 6) Start the dev server on the fixed port ---
echo [ipnak] Starting dev server at http://localhost:%PORT%
echo [ipnak] Press Ctrl+C in this window to stop.
echo.
call npm run dev

echo.
echo [ipnak] Dev server stopped.
pause
endlocal
