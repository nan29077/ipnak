@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  [입낚] 중고나라 오류 수정 스크립트
echo ============================================
echo.
echo 1) 실행 중인 dev 서버가 있으면 먼저 닫아주세요(Ctrl+C).
echo    계속하려면 아무 키나 누르세요...
pause >nul
echo.
echo 2) Prisma 클라이언트 재생성 (marketListing 등 모델 반영)...
call npx prisma generate
echo.
echo 3) dev.db에 중고나라 테이블 생성/동기화 (기존 데이터 보존)...
call npx prisma db push
echo.
echo ============================================
echo  완료! 이제 dev 서버를 다시 시작하세요.
echo  start-dev.bat 더블클릭  또는  npm run dev
echo  접속: http://localhost:3010/market
echo ============================================
pause
