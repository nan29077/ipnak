@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo !! 개발 서버를 먼저 종료하세요 (Ctrl+C) !!
echo.
pause
echo.
echo memo 컬럼 추가 중...
node -e "const {Database}=require('better-sqlite3');const db=new Database('prisma/dev.db');try{db.exec('ALTER TABLE FishingTrip ADD COLUMN memo TEXT');console.log('완료!');}catch(e){console.log('이미 추가됨 또는 오류:',e.message);}db.close();" 2>nul
IF %ERRORLEVEL% NEQ 0 (
  echo better-sqlite3 없음. npx prisma db push 시도...
  npx prisma db push --skip-generate
)
echo.
echo 완료! 개발 서버를 다시 시작하세요.
pause
