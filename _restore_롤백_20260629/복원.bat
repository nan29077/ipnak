@echo off
chcp 949 >nul
setlocal
set "SNAP=%~dp0"
set "ROOT=%~dp0.."
echo ============================================
echo   입낚 메인/피드 개편 - 이전 버전으로 되돌리기
echo   스냅샷 시점: 2026-06-29
echo ============================================
echo.
echo 복원 대상 폴더: %ROOT%
echo.
choice /C YN /M "현재 변경분을 버리고 스냅샷 상태로 되돌릴까요"
if errorlevel 2 goto :cancel

echo.
echo [1/2] src 폴더 복원 중...
if exist "%ROOT%\src" rmdir /S /Q "%ROOT%\src"
xcopy "%SNAP%src" "%ROOT%\src\" /E /I /Y >nul

echo [2/2] prisma 스키마/시드 복원 중...
copy /Y "%SNAP%prisma\schema.prisma" "%ROOT%\prisma\schema.prisma" >nul
copy /Y "%SNAP%prisma\seed.ts" "%ROOT%\prisma\seed.ts" >nul

echo.
echo 복원이 완료되었습니다.
echo 아래 명령으로 클라이언트를 재생성한 뒤 다시 실행하세요:
echo     npm run build
echo (DB에 추가된 컬럼/테이블은 그대로 두어도 기존 기능에 영향이 없습니다)
echo.
pause
exit /b 0

:cancel
echo 취소되었습니다. 변경분은 그대로 유지됩니다.
pause
exit /b 1
