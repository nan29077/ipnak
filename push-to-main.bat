@echo off
cd /d E:\프로젝트\입낚

echo [1/5] 남은 변경사항 전체 커밋...
if exist .git\index.lock del /f .git\index.lock
git add -A
git commit -m "전체 변경사항 통합 커밋 (카카오 로그인, 알리고 연동, 해양 API, UI 개선 등)"

echo [2/5] main 브랜치 전환...
git checkout main

echo [3/5] feature/alimtalk-integration 머지...
git merge feature/alimtalk-integration --no-ff -m "알리고 알림톡/SMS 연동 머지"

echo [4/5] main push...
git push origin main

echo [5/5] 불필요한 feature 브랜치 삭제...
git branch -D feature/ai-marine-legal 2>nul
git branch -D feature/alimtalk-integration 2>nul
git branch -D feature/fix-hero-image 2>nul
git branch -D feature/location-consent 2>nul
git branch -D feature/mariadb-dev-env 2>nul
git branch -D feature/naver-oauth 2>nul
git branch -D feature/upload-serve-route 2>nul
git branch -D feature/user-edit-delete 2>nul

echo 원격 feature 브랜치 삭제...
git push origin --delete feature/ai-marine-legal 2>nul
git push origin --delete feature/alimtalk-integration 2>nul
git push origin --delete feature/fix-hero-image 2>nul
git push origin --delete feature/kakao-oauth 2>nul
git push origin --delete feature/location-consent 2>nul
git push origin --delete feature/mariadb-dev-env 2>nul
git push origin --delete feature/naver-oauth 2>nul
git push origin --delete feature/upload-serve-route 2>nul
git push origin --delete feature/user-edit-delete 2>nul

echo.
echo 완료! main, sub 브랜치만 남았습니다.
pause
