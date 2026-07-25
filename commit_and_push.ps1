try {
    Set-Location $PSScriptRoot
    Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
    Remove-Item ".git\HEAD.lock" -Force -ErrorAction SilentlyContinue
    git add src/app/api/trips/`[id`]/route.ts src/components/RecordingProvider.tsx src/app/catch/new/page.tsx src/app/landing/page.tsx src/components/map/MapScreen.tsx src/components/TripDetailSheet.tsx src/app/api/catch/route.ts src/components/LiveScanCamera.tsx src/components/FeedCard.tsx src/components/ui.tsx src/app/post/`[id`]/page.tsx src/app/post/`[id`]/PostDetailClient.tsx
    git commit -m "fix: fish catch count showing 0 in card and detail sheet`nfeat: GPS 경로 정확도 개선 (정확도 30m 필터, 최소 3m 이동 필터, maximumAge=0)`nfix: 가로 모드 직접 측정 시 이미지 누워서 보이는 문제 수정`nfeat: 피드 캐러셀 슬라이드 자연스러운 전환 애니메이션 및 손가락 추적 드래그 구현`nfix: 피드 캐러셀 가로 드래그 중 세로 스크롤 간섭 제거 (non-passive touchmove)`nfix: 좋아요/저장 후 다른 페이지 갔다 돌아와도 상태 유지 (router.refresh로 라우터 캐시 무효화)`nfix: 댓글 입력창 터치 시 키보드가 Sheet를 가리는 문제 수정 (visualViewport 기반 max-height 동적 조정)`nfeat: 피드 상세페이지 아래로 스와이프하면 이전 페이지로 돌아가기"
    git remote set-url origin https://github.com/nan29077/ipnak.git
    git push origin main --force
    Write-Host "Done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    Read-Host "Press Enter to close"
}
