@echo off
cd /d E:\\프로젝트\\입낚

echo [1/4] git lock 파일 정리 중...
if exist .git\index.lock del /f .git\index.lock

echo [2/4] 알리고/알림톡 파일 스테이징 중...
git add src/lib/aligo.ts
git add src/app/admin/alimtalk/
git add src/app/api/admin/alimtalk/
git add src/app/api/auth/send-otp/
git add src/app/api/auth/verify-otp/
git add prisma/schema.prisma
git add prisma/migrations/20260807_add_phone_verification/
git add src/app/api/admin/action/route.ts
git add src/lib/aiCredentials.ts
git add src/lib/passwordReset.ts
git add src/components/admin/AdminShell.tsx
git add src/app/signup/page.tsx

echo [3/4] 커밋 중...
git commit -m "알리고 알림톡/SMS 연동: 회원가입 OTP 인증, 관리자 발송 페이지, AI API 연결에서 SMS 탭 제거"

echo [4/4] feature 브랜치 push 중...
git push origin feature/alimtalk-integration

echo.
echo 완료!
timeout /t 5
exit
