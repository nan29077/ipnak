@echo off
chcp 65001 >nul
echo ========================================
echo  입낚 브랜치 머지 스크립트
echo ========================================
echo.

cd /d "E:\프로젝트\입낚"

echo [1/3] 현재 브랜치 및 상태 확인...
git branch -a
echo.

echo [2/3] main -^> master push (fast-forward)...
git push origin main:master
if %errorlevel% neq 0 (
    echo [오류] master push 실패
    pause
    exit /b 1
)
echo master push 완료!
echo.

echo [3/3] main -^> sub push (fast-forward)...
git push origin main:sub
if %errorlevel% neq 0 (
    echo [오류] sub push 실패
    pause
    exit /b 1
)
echo sub push 완료!
echo.

echo ========================================
echo  최종 브랜치 상태 확인
echo ========================================
git fetch origin
git log --oneline --decorate -3
echo.
echo 모든 브랜치 머지 완료!
pause
