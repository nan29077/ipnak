@echo off
cd /d E:\프로젝트\입낚

echo Lock 파일 정리...
if exist .git\index.lock del /f .git\index.lock

echo main 브랜치로 전환...
git checkout main

echo feature 브랜치 머지...
git merge feature/alimtalk-integration --no-ff -m "알리고 알림톡/SMS 연동 전체 머지"

echo origin main push...
git push origin main

echo 로컬 feature 브랜치 삭제...
git branch -D feature/ai-marine-legal 2>nul
git branch -D feature/alimtalk-integration 2>nul
git branch -D feature/fix-hero-image 2>nul
git branch -D feature/location-consent 2>nul
git branch -D feature/mariadb-dev-env 2>nul
git branch -D feature/naver-oauth 2>nul
git branch -D feature/upload-serve-route 2>nul
git branch -D feature/user-edit-delete 2>nul

echo.
echo 완료! main, sub 브랜치만 남았습니다.
git branch
pause
