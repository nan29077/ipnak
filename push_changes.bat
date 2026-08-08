@echo off
chcp 65001 >nul
cd /d "E:\프로젝트\입낚"
git push origin main > push_result.txt 2>&1
type push_result.txt
pause
