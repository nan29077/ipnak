@echo off
cd /d "E:\프로젝트\입낚"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
git add src/components/AiPointRecommend.tsx
git commit -m "비로그인 시 AI 포인트 추천 클릭 시 로그인 안내 메시지 표시"
pause
