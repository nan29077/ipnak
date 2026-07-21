Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
Remove-Item -Force ".git\HEAD.lock" -ErrorAction SilentlyContinue
git add "src\components\map\MapScreen.tsx"
git commit -m "fix: point detail button moved to top-right below region tabs"
Write-Host "Done! Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
