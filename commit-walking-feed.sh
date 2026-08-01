#!/bin/sh
# VSCode 등 IDE의 git 프로세스가 있다면 먼저 종료하거나, 아래 주석을 해제해서 lock 파일 삭제
# rm .git/index.lock

git add \
  src/app/me/page.tsx \
  "src/app/api/trips/[id]/route.ts" \
  src/components/MePageTabs.tsx \
  src/components/TripDetailSheet.tsx

git commit -m "feat: 마이페이지 및 스마트피싱 바텀시트에 워킹피드에 올리기 버튼 추가"
