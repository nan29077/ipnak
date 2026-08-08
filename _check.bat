@echo off
REM ipnak - apply schema + lint + build verification
chcp 65001 >nul
title ipnak check (db push + lint + build)
cd /d "%~dp0"

echo ============ [1/4] prisma generate ============
call npx prisma generate
echo.
echo ============ [2/4] prisma db push (apply schema) ============
call npx prisma db push
echo.
echo ============ [3/4] npm run lint ============
call npm run lint
echo.
echo ============ [4/4] npm run build ============
call npm run build
echo.
echo ============ CHECK COMPLETE ============
pause
