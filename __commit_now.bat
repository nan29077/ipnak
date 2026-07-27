@echo off
cd /d E:\프로젝트\입낚
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git config user.email "uncleku77@gmail.com"
git config user.name "GY"
git add -A
git commit -m "PC AI 측정 회전 버그 수정, 닫기 버튼 저장 옆 이동, SAVED 화면 캔버스 높이 축소, PC 배경 이미지 적용"
git remote set-url origin https://github.com/nan29077/ipnak.git
git push origin main
git log --oneline -3
pause
