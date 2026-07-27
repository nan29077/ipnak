@echo off
cd /d E:\프로젝트\입낚

echo [1/4] lock 파일 제거 중...
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock

echo [2/4] remote 확인 중...
git remote set-url origin https://github.com/nan29077/ipnak.git

echo [3/4] 커밋 중...
git commit -m "feat: 상품상세 UI 개편, 마이페이지 탭 수정, 구매버튼 배치 변경"

echo [4/4] 푸시 중...
git push origin main

echo.
echo 완료! 최근 커밋:
git log --oneline -2
pause
