Set-Location "E:\프로젝트\입낚"

Write-Host "=== [1/2] main -> master push ===" -ForegroundColor Cyan
git push origin main:master
if ($LASTEXITCODE -ne 0) { Write-Host "master push 실패" -ForegroundColor Red; Read-Host; exit 1 }

Write-Host "=== [2/2] main -> sub push ===" -ForegroundColor Cyan
git push origin main:sub
if ($LASTEXITCODE -ne 0) { Write-Host "sub push 실패" -ForegroundColor Red; Read-Host; exit 1 }

Write-Host "`n=== 최종 브랜치 상태 ===" -ForegroundColor Green
git fetch origin
git log --oneline --decorate -3

Write-Host "`n완료!" -ForegroundColor Green
Read-Host "계속하려면 Enter"
