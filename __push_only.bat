@echo off
cd /d E:\프로젝트\입낚
echo Pushing to GitHub...
git remote set-url origin https://github.com/nan29077/ipnak.git
git push origin main --force
if errorlevel 1 (
  echo ERROR: git push failed
  pause
  exit /b 1
)
echo === Push complete! ===
git log --oneline -2
pause
