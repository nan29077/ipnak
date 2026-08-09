@echo off
cd /d E:\프로젝트\입낚
git pull origin main --no-edit
git push origin main
del push_now.bat 2>nul
del test_delete_me.tmp 2>nul
del "%~f0"
pause
