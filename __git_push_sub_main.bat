@echo off
chcp 65001 > nul
cd /d E:\프로젝트\입낚

echo === index.lock 제거 시도 ===
del /f ".git\index.lock" 2>nul
echo.

echo === sub 브랜치 push ===
git push origin sub
echo.

echo === main 을 sub 커밋으로 fast-forward (plumbing) ===
git update-ref refs/heads/main 8b4bcb9d53fc1b15ee34aecd0ac5f10845421966
echo.

echo === main 브랜치 push ===
git push origin main
echo.

echo === 완료 ===
git log --oneline -3 sub
git log --oneline -3 main

pause
