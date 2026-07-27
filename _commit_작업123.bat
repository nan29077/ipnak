@echo off
chcp 65001 > nul
cd /d E:\프로젝트\입낚

echo [1] Git 락 파일 제거 중...
del /f .git\HEAD.lock 2>nul
del /f .git\index.lock 2>nul
del /f .git\objects\maintenance.lock 2>nul

echo [2] 변경 파일 스테이징...
git add src/app/groups/[id]/page.tsx
git add src/app/groups/new/page.tsx
git add src/app/groups/[id]/manage/page.tsx
git add src/app/about/page.tsx
git add src/components/ui.tsx
git add src/components/market/ChatPageHeader.tsx
git add next.config.mjs
git add src/app/layout.tsx

echo [3] 커밋 중...
git commit -m "낚시단 포인트 좌표 동네명 표시, 뒤로가기 개선, 페이지 속도 최적화"

echo.
echo 완료!
pause
