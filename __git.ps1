Set-Location "E:\프로젝트\입낚"
Write-Host "[0] 스테일 락 파일 제거..." -ForegroundColor Cyan
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
Remove-Item ".git\HEAD.lock" -Force -ErrorAction SilentlyContinue
Remove-Item ".git\refs\heads\main.lock" -Force -ErrorAction SilentlyContinue

if (Test-Path ".git\index.lock") {
    Write-Host "경고: index.lock 삭제 실패. 강제 시도..." -ForegroundColor Yellow
}

Write-Host "[1] git add -A ..." -ForegroundColor Cyan
git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git add 실패 (exit $LASTEXITCODE)" -ForegroundColor Red
    Read-Host "Enter 눌러 종료"
    exit 1
}
Write-Host "git add 완료" -ForegroundColor Green

Write-Host "[2] git commit ..." -ForegroundColor Cyan
$msg = "feat: 더미 관리 개선, 배스전용 앵글러 모드, 확인 팝업 테마 통일, 상품등록 4단계 팝업, 쇼핑 FeaturedProduct 자동 생성, 포인트 직접 입력, 중고피싱 UI 개선"
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git commit 실패 (exit $LASTEXITCODE)" -ForegroundColor Red
    Read-Host "Enter 눌러 종료"
    exit 1
}
Write-Host "git commit 완료" -ForegroundColor Green

Write-Host "[3] git push ..." -ForegroundColor Cyan
git remote set-url origin "https://github.com/nan29077/ipnak.git"
git push origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git push 실패 (exit $LASTEXITCODE)" -ForegroundColor Red
    Read-Host "Enter 눌러 종료"
    exit 1
}

Write-Host "=== 완료! 커밋 및 푸시 성공 ===" -ForegroundColor Green
git log --oneline -2
Read-Host "Enter 눌러 종료"
