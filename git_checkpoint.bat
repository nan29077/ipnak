@echo off
cd /d "E:\프로젝트\입낚"
if exist ".git\index.lock" del /f ".git\index.lock"
git add -A
git commit -m "checkpoint before UX improvement"
echo Done.
pause
