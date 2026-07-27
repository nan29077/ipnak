@echo off
cd /d "E:\프로젝트\입낚"
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
git add src/components/TripDetailSheet.tsx
git commit -m "feat: 스마트피싱 기록 상세 - 피쉬기록·동선지도 크게보기 모달 추가"
echo.
echo 완료! 아무 키나 누르세요...
pause >nul
