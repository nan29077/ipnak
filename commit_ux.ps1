try {
    Set-Location $PSScriptRoot
    Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
    Remove-Item ".git\HEAD.lock" -Force -ErrorAction SilentlyContinue
    git add src/components/LiveScanCamera.tsx src/app/measure/page.tsx
    git commit -m "UX: auto camera open on mobile + seamless manual tap mode"
    Write-Host "Commit done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    Read-Host "Press Enter to close"
}
