# 입낚 (ipnak) — 낚시 커뮤니티 MVP

GPS 낚시 동선 기록, 사진 기반 스마트 자 계측, 피싱 포인트 공유, 인스타그램형 커뮤니티 피드,
온라인 낚시 대회, 낚시배·펜션·좌대 예약을 한 앱에 담은 **모바일 우선 / PWA 지향** 풀스택 웹앱입니다.

> 기술 스택: **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma + SQLite · 자체 세션 인증 · Leaflet/OSM · lucide-react · zod · date-fns**

---

## 1. 실행 방법

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 파일 생성 (.env.example 복사)
cp .env.example .env

# 3) 데이터베이스 생성 + 시드 데이터 주입
npm run db:reset      # = prisma db push --force-reset && 시드 실행
#  (또는) npm run db:push && npm run db:seed

# 4) 개발 서버 실행
npm run dev
# http://localhost:3000
```

빌드/실행:

```bash
npm run build   # prisma generate + next build
npm run start   # 프로덕션 실행
npm run lint    # ESLint
```

> 참고: 이 저장소는 `lint` / `build` / `typecheck`가 모두 통과한 상태입니다.

---

## 2. 테스트 계정

로그인 화면(`/login`) 하단의 **"관리자 테스트 로그인" / "낚시꾼 테스트 로그인"** 버튼으로 즉시 로그인할 수 있습니다.

| 구분 | 이메일 | 비밀번호 | 역할 |
|------|--------|----------|------|
| 최고관리자 | `admin@ipnak.test` | `Admin1234!` | `SUPER_ADMIN` |
| 낚시꾼 회원 | `angler@ipnak.test` | `Angler1234!` | `ANGLER` |

- `SUPER_ADMIN` 만 `/admin` 접근 가능 (그 외 접근 시 홈으로 리다이렉트)
- `PARTNER` 역할은 낚시배/펜션/좌대 운영자용으로 **구조만 준비**되어 있습니다. (관리자 → 회원 관리에서 지정 가능)

---

## 3. 주요 기능 & 화면

### 반응형 레이아웃
- **모바일**: 하단 Bottom Navigation (홈 / 지도 / 대회 / 예약 / 마이) + 중앙 플로팅 기록 버튼, iOS safe-area 대응
- **PC / 태블릿**: 하단 네비 숨김, **화면 오른쪽 세로 네비게이션** (아이콘 + 라벨)
- **관리자(`/admin`)**: PC 대시보드 중심 + 오른쪽 세로 네비게이션

### 화면 목록
| 경로 | 설명 |
|------|------|
| `/login`, `/signup` | 이메일 로그인/가입, 카카오·네이버·Google 버튼(mock), 테스트 로그인, 관심분야 선택 |
| `/` (`/feed`) | 인스타그램형 피드. 일반/피싱포인트/대회 게시글, 이미지 carousel, 쇼핑 태그, 좋아요·댓글·저장·공유 |
| `/post/new` | 일반 게시글 작성 (사진·캡션·어종·분류·쇼핑태그·공개범위) |
| `/post/[id]` | 게시글 상세 |
| `/profile/[id]`, `/me` | 프로필(게시글·피싱포인트·대회기록 탭), 팔로우, 내 예약/설정/로그아웃 |
| `/map` | GPS 동선 기록(시작/일시정지/종료), 현재위치·동선 polyline·피싱포인트 마커, 마커 클릭 상세 시트 |
| `/trip` | 내 낚시 세션 목록 (이동거리·시간·마릿수·대표어종·동선 미리보기) |
| `/catch/new` | 물고기 기록: 카메라 촬영 → 스마트 자 측정 → 어종/분류/채비/쇼핑태그/위치공개/피드공유 |
| `/ruler` | 스마트 자 단독 측정 (측정 JSON 확인용) |
| `/tournaments`, `/tournaments/[id]` | 대회 목록(주간/월간/왕중왕, 어종/상태 필터), 상세·규칙·리더보드·계측 제출 |
| `/reservations`, `/reservations/[id]` | 예약 상품(낚시배/펜션/유료터/좌대/해상펜션/가이드), 지역·가격 필터, mock 예약 |
| `/shop/[id]` | 쇼핑 태그 상품 상세 (mock 구매) |
| `/admin/*` | 관리자: 대시보드·회원·게시글/피싱포인트·댓글·신고·대회·대회심사·예약상품·예약내역·상품·분류/어종·배너·설정 |

### 스마트 자 / 스마트 룰러 (참고 앱: 하라스 / HARAS)
사진 기반 **수동 포인트 + 기준 길이 보정** 방식으로 물고기 길이를 측정합니다. (AI 자동 인식은 추후 연동)
1. 사진 업로드 → 캔버스 표시
2. 기준 자(계측판 등) **시작점·끝점** 탭 + 기준 길이(cm) 입력 → `pixelsPerCm` 계산
3. 물고기 **입 끝·꼬리 끝** 탭 → 픽셀 거리 → cm 환산 (0.1cm 단위)
4. 측정 신뢰도 표시, 재측정 가능, 측정 데이터 JSON 저장
5. 대회 제출용 메타데이터(원본/측정 이미지, 보정·측정 좌표, 기준 길이, GPS, 시간, 조작 의심 플래그) 보관

저장 필드: `originalImageUrl, measuredImageUrl, calibrationStart{x,y}, calibrationEnd{x,y}, calibrationLengthCm, fishHeadPoint{x,y}, fishTailPoint{x,y}, measuredLengthCm, confidence, tamperFlag, createdAt`

### 위치 민감성
피싱 포인트는 **정확히 공개 / 반경 100m 흐림 / 반경 500m 흐림 / 비공개** 옵션을 제공하며, 흐림 옵션 선택 시 좌표가 결정적으로 오프셋되어 노출됩니다.

### 시드 데이터 (`prisma/seed.ts`)
관리자 1 · 낚시꾼 12명 · 게시글 30+ · 피싱 포인트 24 · 상품(쇼핑태그) 24 · 대회 6 · 예약 상품 12 · 예약 내역 6 · 분류/어종 전체 · 댓글/좋아요/팔로우/신고/배너/알림 mock.
지역: 한강·팔당·대청호·낙동강·안동호·여수·통영·제주·군산·포항·속초·부산.

---

## 4. 추후 API 연동 포인트

모두 현재는 **mock / local** 로 동작하며, 아래 지점만 교체하면 실제 연동됩니다.

| 영역 | 연동 위치 | 환경변수 (.env.example) |
|------|-----------|--------------------------|
| 소셜 로그인 (카카오/네이버/Google) | `src/components/SocialButtons.tsx`, `src/app/api/auth/*` | `GOOGLE_CLIENT_ID/SECRET`, `KAKAO_CLIENT_ID/SECRET`, `NAVER_CLIENT_ID/SECRET` |
| 지도 (카카오/네이버 지도) | `src/lib/map.ts` (`ACTIVE_MAP_PROVIDER`), `src/components/map/MapCanvas.tsx` — Provider 추상화로 교체 | `NEXT_PUBLIC_KAKAO_MAP_KEY`, `NEXT_PUBLIC_NAVER_MAP_KEY` |
| 예약 결제(PG) | `src/app/api/bookings/route.ts`, `src/components/BookingForm.tsx` | `PAYMENT_API_KEY` |
| 쇼핑 태그 커머스/제휴 | `src/app/api/products/route.ts`, `src/components/ProductTagPicker.tsx`, `/shop/[id]` | `COMMERCE_AFFILIATE_KEY` |
| 이미지 업로드(스토리지) | `src/components/PhotoPicker.tsx` — 현재 미리보기 + placeholder URL | (S3/스토리지 키 추가) |
| AI 자동 계측 | `src/components/SmartRuler.tsx` — 현재 수동 포인트 측정 | (계측 API 추가) |

> **지도 Provider 추상화**: `src/lib/map.ts`의 `MapProviderConfig` / `ACTIVE_MAP_PROVIDER`를 `kakao` 또는 `naver`로 바꾸고 `MapCanvas`에 분기를 추가하면 됩니다. 현재는 `leaflet`(OSM).

---

## 5. 데이터 모델 (Prisma)

`User, Session, Post, PostImage, Comment, Like, Bookmark, Follow, ShareEvent, Report,
FishingTrip, RoutePoint, FishingPoint, CatchRecord, GearSetup, FishingCategory, FishSpecies,
Product, PostProductTag, Tournament, TournamentEntry, ReservationListing, ReservationSlot,
Booking, Notification, AdminLog, Banner`

- 필드명은 영어, UI 라벨은 한국어.
- SQLite는 Prisma `enum`을 지원하지 않아 `role`/`status` 등은 **String + 주석**으로 관리합니다.
- 모든 관리자 CRUD는 실제 DB에 반영되며, 결제/외부 API만 mock 입니다.

---

## 6. 프로젝트 구조

```
src/
  app/                # App Router 페이지 + /api 라우트
    admin/            # 관리자 (전용 layout + 우측 네비)
    api/              # 인증/SNS/피싱/대회/예약/관리자 액션 핸들러
  components/         # AppShell, FeedCard, SmartRuler, MapView, 관리자 UI 등
  lib/                # prisma, auth(세션), queries, taxonomy(분류/어종), map, utils
prisma/
  schema.prisma       # 데이터 모델
  seed.ts             # 더미 데이터
```

---

## 7. 완료 기준 체크리스트
- [x] `npm install` 후 실행 가능 / `npm run dev` 확인
- [x] 관리자·낚시꾼 테스트 버튼 로그인
- [x] 모바일 하단 네비 / PC 우측 세로 네비
- [x] 인스타그램형 피드 (피싱포인트 + 일반)
- [x] GPS 동선/포인트 (geolocation, 권한 거부 시 시뮬레이션)
- [x] 스마트 자 측정 흐름
- [x] 대회 목록 + 리더보드 + 제출/심사
- [x] 예약 상품 + mock 예약
- [x] 관리자 대시보드 + 관리 메뉴 (DB 반영)
- [x] 시드 데이터 / README / `.env.example`
- [x] lint / build 통과
