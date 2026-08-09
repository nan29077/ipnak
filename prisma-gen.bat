@echo off
cd /d E:\프로젝트\입낚

echo [1/3] 개발 서버 중지 중...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3010" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/3] Prisma 클라이언트 재생성 중...
npx prisma generate

echo [3/3] 개발 서버 재시작 중...
start cmd /k "cd /d E:\프로젝트\입낚 && npm run dev"

echo.
echo 완료! 새 창에서 서버가 시작됩니다.
timeout /t 3
exit
