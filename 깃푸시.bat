@echo off
chcp 65001 >nul
echo ============================================
echo  입낚 + 키득마켓 GitHub 업로드
echo ============================================
echo.

echo [1단계] GitHub 저장소 URL을 입력하세요
echo  예시: https://github.com/yunsell/ipnak
echo.

set /p IPNAK_URL=입낚 저장소 URL: 
set /p KIDUK_URL=키득마켓 저장소 URL: 
echo.

echo === 입낚 설정 중... ===
cd /d "E:\프로젝트\입낚"
if exist .git\config.lock del .git\config.lock
if exist .git\index.lock del .git\index.lock
git config user.email "uncleku77@gmail.com"
git config user.name "구영"
git remote remove origin 2>nul
git remote add origin %IPNAK_URL%
git add -A
git commit -m "소모임 시스템 구현, 로고 다크모드 수정, AppHeader 빌드에러 수정"
git branch -M main
git push -u origin main
echo.

echo === 키득마켓 설정 중... ===
cd /d "E:\프로젝트\키득마켓"
if exist .git\index.lock del .git\index.lock
if exist .git\config.lock del .git\config.lock
git remote remove origin 2>nul
git remote add origin %KIDUK_URL%
git add -A
git commit -m "모바일 헤더 로고 크기 확대"
git branch -M main
git push -u origin main
echo.
echo === 완료! ===
pause
