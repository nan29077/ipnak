Set-Location "E:\프로젝트\입낚"
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
Remove-Item ".git\HEAD.lock" -Force -ErrorAction SilentlyContinue
git add -A
git commit -m "UX 개선 전 체크포인트"
Write-Host "Done." -ForegroundColor Green
Read-Host "Press Enter to close"
