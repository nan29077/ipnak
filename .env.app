# 입낚 앱 전용 빌드 환경변수
#
# 사용법:
#   npx env-cmd -f .env.app npm run build     (또는)
#   cp .env.app .env.local && npm run build
#
# 이 플래그가 true 면 useIsNativeApp() 이 무조건 true 를 반환하고,
# 앱 다운로드 바텀시트 / 랜딩 페이지가 숨겨진다.
#
# ※ capacitor.config.ts 는 Live URL(프로덕션 서버 로드) 방식이므로,
#   실서버 빌드를 그대로 쓰는 경우 이 플래그 없이도 런타임에
#   window.Capacitor.isNativePlatform() 으로 앱 환경이 감지된다.
#   (src/lib/capacitorPlugins.ts 의 isNativeRuntime() 참고)
NEXT_PUBLIC_IS_APP=true
