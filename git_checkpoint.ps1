Set-Location "E:\프로젝트\입낚"
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
git add -A
git commit -m "checkpoint before UX improvement"
Write-Host "Done." -ForegroundColor Green
Read-Host "Press Enter to close"
