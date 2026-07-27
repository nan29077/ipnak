@echo off
del /f "E:\프로젝트\입낚\.git\HEAD.lock" 2>nul
del /f "E:\프로젝트\입낚\.git\index.lock" 2>nul
cd /d "E:\프로젝트\입낚"
git add src/app/landing/page.tsx
git commit -m "PC 랜딩페이지 배경 이미지를 배스 역동적 불곰(v2)으로 교체"
echo 완료! 아무 키나 누르세요...
pause
