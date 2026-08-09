@echo off
cd /d "E:\프로젝트\입낙"
git push origin main:master
git push origin main:sub
git fetch origin
git log --oneline --decorate -3
pause
