@echo off
chcp 65001 >nul
cd /d E:\프로젝트\입낚

echo [1/4] 깨진 커밋 3개 소프트 리셋...
if exist .git\index.lock del /f .git\index.lock
git reset --soft HEAD~3

echo [2/4] 전체 스테이징...
git add -A

echo [3/4] 올바른 메시지로 재커밋...
git commit -m "알리고 알림톡/SMS 연동: OTP 회원가입 인증, 관리자 발송 페이지, AI API 연결 SMS 탭 제거, 전체 변경사항 통합"

echo [4/4] origin main 강제 push...
git push origin main --force

echo.
git log --oneline -5
echo.
echo 완료!
pause
