@echo off
cd /d "E:\프로젝트\입낚"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add -A
git commit -m "fix: smart fishing bottom sheet fullscreen view"
git push origin main
echo.
echo Done! Press any key...
pause
