try {
    Set-Location $PSScriptRoot
    Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
    Remove-Item ".git\HEAD.lock" -Force -ErrorAction SilentlyContinue

    Write-Host "Prisma 클라이언트 타입 생성 중..." -ForegroundColor Cyan
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "prisma generate 실패 - 계속 진행합니다" -ForegroundColor Yellow
    }

    git add -A
    git commit -m "feat: 더미 관리 개선, 배스전용 앵글러 모드, 확인 팝업 테마 통일, 상품등록 4단계 팝업, 쇼핑 FeaturedProduct 자동 생성, 포인트 직접 입력, 중고피싱 UI 개선"
    git remote set-url origin https://github.com/nan29077/ipnak.git
    git push origin main --force
    Write-Host "Done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    Read-Host "Press Enter to close"
}
