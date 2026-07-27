@echo off
del /f "E:\프로젝트\입낚\.git\HEAD.lock" 2>nul
del /f "E:\프로젝트\입낚\.git\index.lock" 2>nul
cd /d "E:\프로젝트\입낚"
git add src/app/about/page.tsx
git commit -m "수정: 어바웃 바로가기 클릭 시 모바일 랜딩 우회하고 홈으로 이동"
echo 완료! 아무 키나 누르세요...
pause
