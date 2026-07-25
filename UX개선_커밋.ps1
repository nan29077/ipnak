Set-Location "E:\프로젝트\입낚"
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
Remove-Item ".git\HEAD.lock" -Force -ErrorAction SilentlyContinue
git add src/components/LiveScanCamera.tsx src/app/measure/page.tsx
git commit -m "AI측정 UX 개선: 모바일 카메라 자동열기 + 직접측정 seamless 전환"
Write-Host "커밋 완료!" -ForegroundColor Green
Read-Host "엔터를 누르면 창이 닫힙니다"
