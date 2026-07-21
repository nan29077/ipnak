@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo DB push 중...
npx prisma db push > __db_push_result.txt 2>&1
echo.
type __db_push_result.txt
echo.
echo 완료! 개발 서버를 재시작해 주세요.
pause
