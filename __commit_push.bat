@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist .git\index.lock del .git\index.lock

git config user.email "uncleku77@gmail.com"
git config user.name "구영"

git add src/components/RecordingProvider.tsx
git add src/components/map/MapScreen.tsx
git add src/components/AiPointRecommend.tsx
git add src/app/catch/new/page.tsx
git add src/app/api/points/recommend/route.ts
git add src/app/admin/reviews/page.tsx
git add src/app/api/admin/reviews/

git commit -m "데이터피싱 타이머·풀스크린·UI 개선 및 AI 포인트 추천 웹 검색 추가

- RecordingProvider: savedAt 저장으로 앱 재진입 시 닫힌 시간 포함 연속 카운트
- catch/new: GPS 미획득 시 lastPoint 폴백으로 어획 위치 마커 정확도 개선
- MapScreen: 풀스크린 배경 모드 추가 (시계+통계+컨트롤, 1분 무조작 화면꺼짐)
- admin/reviews: 다크 테마 가독성 개선 + 대회/날짜/상태 필터 추가
- AiPointRecommend: 네이버 블로그 검색 API 연동, 웹 조황 결과 섹션 추가
- api/points/recommend: fetchNaverBlogReports 추가, webResults 응답 포함"

git remote remove origin 2>nul
git remote add origin https://github.com/nan29077/ipnak.git
git branch -M main
git push -u origin main

echo.
echo === 커밋 및 푸시 완료 ===
pause
