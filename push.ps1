try {
    Set-Location $PSScriptRoot
    git remote set-url origin https://github.com/nan29077/ipnak.git
    git push origin main --force
    Write-Host "Push done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    Read-Host "Press Enter to close"
}
