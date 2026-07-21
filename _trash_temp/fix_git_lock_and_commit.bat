@echo off
chcp 65001 >nul
cd /d "E:\프로젝트\입낚"
echo [입낚] git lock 제거 및 커밋...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
git add src/components/map/MapScreen.tsx
git commit -m "fix: 포인트 상세 보기 버튼을 지역 탭 아래 우측으로 위치 이동 (기록 카드 겹침 해결)"
echo.
echo [완료] 커밋 완료
pause
