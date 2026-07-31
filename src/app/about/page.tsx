"use client";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, MapPin, BookOpen, Trophy,
  Users, ArrowLeft, Monitor,
  Fish, Ruler, CircleDot, Route, ShoppingBag,
} from "lucide-react";
import { useAppSettings, useAnglerLabel } from "@/lib/appSettingsContext";

/* ── PC 배경 이미지 3장 (각 1번씩 등장) ── */
const IMG_A = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 배경이미지3.png";
const IMG_B = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 배경이미지2.png";
const IMG_C = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 루어낚시 대회 배경이미지.png";

// 8섹션 ÷ 3이미지 = 2.667 → A:섹션0~2, B:섹션3~5, C:섹션6~7
// FeatureSection의 bgIdx = Math.floor((featIdx + 1) * 3 / 8)
// feat0=0, feat1=0, feat2=1, feat3=1, feat4=1, feat5=2

/* ── 모바일 배경 이미지 2장 (각 1번씩 등장) ── */
const MOBILE_IMG_3 = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 모바일 배경이미지2.png";
const MOBILE_IMG_4 = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 모바일 배스 랜딩 배경이미지.png";
// 배스 전용 모드 OFF 세트 — 배스 전용 컷과 겹치지 않는 전체어종 계열 이미지만 사용
const ALL_SPECIES_PC_IMAGES = [
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 배경이미지5.png",
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 송어 플라이낚시 배경이미지.png",
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 선상바다낚시 배경이미지.png",
] as const;
const BASS_PC_IMAGES = [IMG_A, IMG_B, IMG_C] as const;
const ALL_SPECIES_MOBILE_IMAGES = [
  MOBILE_IMG_3,
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 모바일 선상바다낚시 배경이미지.png",
] as const;
const BASS_MOBILE_IMAGES = [MOBILE_IMG_3, MOBILE_IMG_4] as const;

// 8섹션 ÷ 2이미지 = 4 → 3: 섹션0~3, 4: 섹션4~7
// FeatureSection의 mobileBgIdx = Math.floor((featIdx + 1) / 4)
// feat0,1,2=0, feat3,4,5=1

/* ── 기능 소개 데이터 ── */
type Feature = {
  icon: any;
  title: string;
  sub: string;
  body: string;
  color: string;
  accent: string;
  features: string[];
  // 예약 기능(reservation_enabled) OFF 시 사용할 대체 본문
  bodyReservationOff?: string;
  // 예약 기능 OFF 시 칩 목록에서 제외할 항목
  reservationChips?: string[];
  // 배스낚시 전용 모드(bass_only_mode) OFF 시 사용할 대체 본문 — useAnglerLabel() 결과를 받아 조립
  bodyBassOff?: (anglerLabel: string) => string;
};

const FEATURES: Feature[] = [
  {
    icon: Camera,
    title: "AI 카메라 계측",
    sub: "스마트폰으로 물고기 길이를 정밀 측정",
    body: "입낚볼 또는 인쇄 기준물을 물고기 옆에 두고 촬영하면 AI가 자동으로 길이를 계산합니다. 갤러리 사진도 측정 가능하며, 측정 기록은 자동으로 조행기와 연동됩니다.",
    color: "from-orange-500/80 to-orange-700/80",
    accent: "#eab308",
    features: ["실시간 AI 카메라 측정", "갤러리 사진 측정", "머리·꼬리 수동 지정", "측정 기록 자동 저장"],
  },
  {
    icon: CircleDot,
    title: "입낚볼",
    sub: "NFC 기술로 정밀 측정의 기준이 되는 스마트 볼",
    body: "40mm 진한 노랑 구체에 NFC 칩이 내장된 입낚 전용 계측 기준물입니다. 물고기 옆에 두고 촬영하면 AI가 볼의 크기를 기준으로 정확한 길이를 산출합니다. 입낚볼 없이도 인쇄 기준물이나 머리·꼬리 지정으로 측정이 가능합니다.",
    color: "from-amber-500/80 to-orange-600/80",
    accent: "#eab308",
    features: ["NFC 태그로 볼 ID 연동", "AI 기준점 자동 인식", "A4 인쇄 기준물 제공", "볼 없이도 AI 측정 가능"],
  },
  {
    icon: Route,
    title: "스마트피싱",
    sub: "내 발길이 곧 데이터가 되는 스마트 낚시",
    body: "낚시를 다니며 걸은 동선을 GPS로 실시간 기록하고, 어획 위치·시간·어종 데이터를 지도 위에 쌓아올립니다. 내가 만든 데이터로 명당 패턴을 파악하고, 워킹피드에서 다른 앵글러의 루트까지 확인하세요.",
    color: "from-teal-500/80 to-cyan-600/80",
    accent: "#14b8a6",
    features: ["GPS 실시간 동선 기록", "어획 위치 자동 핀 마킹", "워킹 피드 공유·열람", "포인트 히트맵 시각화"],
  },
  {
    icon: BookOpen,
    title: "조행기",
    sub: "나만의 낚시 일지를 기록하다",
    body: "워킹, 좌대, 바다, 민물, 보팅 등 카테고리별 조행기를 작성하고 측정 기록과 함께 저장하세요. 피싱포인트, 날씨, 장비, 미끼까지 상세한 조건을 기록해 나만의 데이터베이스를 만들 수 있습니다.",
    color: "from-emerald-500/80 to-teal-600/80",
    accent: "#10b981",
    features: ["워킹 · 좌대 · 바다 · 민물 · 보팅", "GPS 포인트 자동 기록", "날씨·조류 조건 입력", "측정 기록 연동"],
  },
  {
    icon: Users,
    title: "피드 & 커뮤니티",
    sub: "낚시인들과 기쁨을 나누다",
    body: "조황 사진과 측정 기록을 커뮤니티에 공유하고 다른 낚시인들의 피드를 팔로우하세요. 워킹피싱 전용 피드에서 배스 앵글러들과 실시간으로 소통할 수 있습니다.",
    bodyBassOff: (angler) =>
      `조황 사진과 측정 기록을 커뮤니티에 공유하고 다른 낚시인들의 피드를 팔로우하세요. 워킹피싱 전용 피드에서 ${angler}들과 실시간으로 소통할 수 있습니다.`,
    color: "from-blue-500/80 to-indigo-600/80",
    accent: "#3b82f6",
    features: ["실시간 조황 피드", "워킹피싱 전용 피드", "좋아요 · 댓글 소통", "팔로우 기반 맞춤 피드"],
  },
  {
    icon: MapPin,
    title: "피싱포인트 & 낚시 대회",
    sub: "명당을 발견하고, 대회에 도전하다",
    body: "지도 기반 피싱포인트에서 숨겨진 명당을 발견하고 직접 포인트를 등록해 공유하세요. 온라인 낚시 대회에 참여해 랭킹을 경쟁하고, 지역 낚시 예약 서비스로 편리하게 출조를 준비하세요.",
    bodyReservationOff: "지도 기반 피싱포인트에서 숨겨진 명당을 발견하고 직접 포인트를 등록해 공유하세요. 온라인 낚시 대회에 참여해 랭킹을 경쟁하고 나만의 기록에 도전하세요.",
    color: "from-rose-500/80 to-red-600/80",
    accent: "#f43f5e",
    features: ["지도 기반 피싱포인트", "포인트 직접 등록 · 공유", "온라인 낚시 대회", "낚시터 예약 서비스"],
    reservationChips: ["낚시터 예약 서비스"],
  },
  {
    icon: ShoppingBag,
    title: "중고마켓",
    sub: "낚시 용품을 낚시인들과 직접 거래하다",
    body: "사용하지 않는 낚시 용품을 다른 낚시인에게 판매하고, 원하는 장비를 합리적인 가격에 구매하세요. 채팅으로 판매자와 직접 소통하고 안전하게 거래할 수 있습니다. 루어, 릴, 낚싯대, 채비까지 모든 낚시 용품이 모이는 전문 중고 마켓입니다.",
    color: "from-cyan-500/80 to-blue-600/80",
    accent: "#06b6d4",
    features: ["낚시 용품 전문 중고 거래", "채팅으로 판매자와 직접 소통", "사진 등록으로 간편한 상품 등록", "루어·릴·낚싯대·채비 전 카테고리"],
  },
];

/**
 * 뷰포트 고정 배경 관리자
 * - PC(≥768px): A/B/C 3장, data-bg-idx 기반 크로스페이드
 * - 모바일(<768px): 3/4 2장, data-mobile-bg-idx 기반 크로스페이드
 */
function FixedBgManager({
  pcImages,
  mobileImages,
}: {
  pcImages: readonly string[];
  mobileImages: readonly string[];
}) {
  const [activePcIdx, setActivePcIdx] = useState(0);
  const [activeMobileIdx, setActiveMobileIdx] = useState(0);

  useEffect(() => {
    const pickBest = (
      entries: IntersectionObserverEntry[],
      setter: (idx: number) => void,
      attr: string
    ) => {
      let best: IntersectionObserverEntry | null = null;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
      });
      if (best) {
        // TS는 콜백 내부 할당을 추적하지 못해 best를 never로 좁힘 → 명시적 캐스트
        setter(Number(((best as IntersectionObserverEntry).target as HTMLElement).dataset[attr] ?? 0));
      }
    };

    const opts = { threshold: [0.1, 0.3, 0.5, 0.7] };

    const pcObserver = new IntersectionObserver(
      (entries) => pickBest(entries, setActivePcIdx, "bgIdx"),
      opts
    );
    const mobileObserver = new IntersectionObserver(
      (entries) => pickBest(entries, setActiveMobileIdx, "mobileBgIdx"),
      opts
    );

    document.querySelectorAll("[data-bg-idx]").forEach((el) => pcObserver.observe(el));
    document.querySelectorAll("[data-mobile-bg-idx]").forEach((el) => mobileObserver.observe(el));

    return () => {
      pcObserver.disconnect();
      mobileObserver.disconnect();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 1 }}>
      {/* PC 배경 3장 — 모바일에서는 CSS로 숨김 */}
      {pcImages.map((src, i) => (
        <div
          key={`pc-${i}`}
          className="absolute inset-0 hidden md:block"
          style={{
            backgroundImage: `url('${src}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: activePcIdx === i ? 1 : 0,
            transition: "opacity 0.9s ease",
          }}
        />
      ))}
      {/* 모바일 배경 2장 — PC에서는 CSS로 숨김 */}
      {mobileImages.map((src, i) => (
        <div
          key={`mobile-${i}`}
          className="absolute inset-0 block md:hidden"
          style={{
            backgroundImage: `url('${src}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: activeMobileIdx === i ? 1 : 0,
            transition: "opacity 0.9s ease",
          }}
        />
      ))}
    </div>
  );
}

function FeatureSection({
  feat,
  idx,
  reservationEnabled,
  bassOnlyMode,
  anglerLabel,
}: {
  feat: Feature;
  idx: number;
  reservationEnabled: boolean;
  bassOnlyMode: boolean;
  anglerLabel: string;
}) {
  const Icon = feat.icon;
  // PC: 8섹션 ÷ 3이미지
  const bgIdx = Math.floor(((idx + 1) * 3) / 8);
  // 모바일: 8섹션 ÷ 2이미지 (feat0~2=0, feat3~5=1)
  const mobileBgIdx = Math.floor((idx + 1) / 4);
  // 배스 전용 모드 OFF 시: 배스 전용 문구를 일반 낚시 문구로 대체
  const bassAdjustedBody =
    bassOnlyMode || !feat.bodyBassOff ? feat.body : feat.bodyBassOff(anglerLabel);
  // 예약 기능 OFF 시: 예약 관련 문구·칩 숨김
  const body = reservationEnabled ? bassAdjustedBody : feat.bodyReservationOff ?? bassAdjustedBody;
  const chips = reservationEnabled
    ? feat.features
    : feat.features.filter((f) => !feat.reservationChips?.includes(f));

  return (
    <section
      className="relative flex min-h-screen items-center justify-center px-6 py-24"
      data-bg-idx={bgIdx}
      data-mobile-bg-idx={mobileBgIdx}
      style={{ zIndex: 2 }}
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            idx % 2 === 0
              ? "linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.72) 100%)"
              : "linear-gradient(225deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.72) 100%)",
        }}
      />
      <div
        className={`relative z-10 flex w-full max-w-4xl flex-col gap-8 ${idx % 2 === 0 ? "items-start" : "items-end text-right"}`}
      >
        {/* 아이콘 + 카테고리 */}
        <div className={`flex items-center gap-3 ${idx % 2 !== 0 ? "flex-row-reverse" : ""}`}>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: feat.accent + "30", border: `1.5px solid ${feat.accent}50` }}
          >
            <Icon size={28} style={{ color: feat.accent }} />
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-bold tracking-wide"
            style={{ background: feat.accent + "20", color: feat.accent }}
          >
            기능 소개
          </span>
        </div>

        {/* 제목 */}
        <div>
          <h2 className="text-4xl font-black leading-tight text-white lg:text-5xl">
            {feat.title}
          </h2>
          <p className="mt-2 text-lg font-medium" style={{ color: feat.accent }}>
            {feat.sub}
          </p>
        </div>

        {/* 설명 */}
        <p className="max-w-xl text-base leading-relaxed text-white/65">
          {body}
        </p>

        {/* 피처 칩 */}
        <div className={`flex flex-wrap gap-2 ${idx % 2 !== 0 ? "justify-end" : ""}`}>
          {chips.map((f) => (
            <span
              key={f}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white/80 backdrop-blur-sm"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  const router = useRouter();
  // 예약 기능 스위치 — layout.tsx의 getBoolSetting("reservation_enabled") 값이 context로 전달됨
  const { reservationEnabled, bassOnlyMode } = useAppSettings();
  // 배스 전용 모드 ON → "앵글러", OFF → "낚시꾼"
  const anglerLabel = useAnglerLabel();
  const pcBackgrounds = bassOnlyMode ? BASS_PC_IMAGES : ALL_SPECIES_PC_IMAGES;
  const mobileBackgrounds = bassOnlyMode ? BASS_MOBILE_IMAGES : ALL_SPECIES_MOBILE_IMAGES;

  const enterApp = useCallback(() => {
    // 모바일 랜딩 리다이렉트 우회: 세션 플래그 설정 후 홈으로 이동
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ipnak_mobile_entered", "1");
      sessionStorage.setItem("ipnak_pc_entered", "1");
    }
    router.replace("/home");
  }, [router]);

  return (
    <div className="relative" style={{ background: "#080c10" }}>

      {/* ── 뷰포트 고정 배경 (3장 크로스페이드) ── */}
      <FixedBgManager pcImages={pcBackgrounds} mobileImages={mobileBackgrounds} />

      {/* ── 고정 상단 내비 ── */}
      <nav
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 md:px-8 md:py-5"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
      >
        {/* 돌아가기 버튼 */}
        <button
          onClick={() => { if (window.history.length > 1) router.back(); else router.replace("/home"); }}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white md:gap-2 md:px-4 md:text-base"
        >
          <ArrowLeft size={18} />
          <span className="hidden md:inline">돌아가기</span>
        </button>

        {/* 로고 */}
        <img
          src="/logo-ipnak-master-transparent-v2.png"
          alt="입낚"
          className="h-8 drop-shadow-lg md:h-10"
        />

        {/* 버전 입장 버튼 */}
        <button
          onClick={enterApp}
          className="rounded-full bg-[#eab308] px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-yellow-500/30 transition hover:bg-yellow-400 active:scale-95 md:px-6 md:py-2.5 md:text-sm"
        >
          <span className="md:hidden">입장 →</span>
          <span className="hidden md:inline">PC 버전 입장 →</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════
          섹션 1: 히어로
      ══════════════════════════════════════════ */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-24"
        data-bg-idx={0}
        data-mobile-bg-idx={0}
        style={{ zIndex: 2 }}
      >
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6 text-center">
          {/* 히어로 로고 */}
          <img
            src="/logo-ipnak-master-transparent-v2.png"
            alt="입낚"
            className="h-20 drop-shadow-[0_4px_24px_rgba(234,179,8,0.7)]"
          />
          <h1 className="text-5xl font-black leading-tight tracking-tight text-white lg:text-6xl">
            낚시인의 모든
            <br />
            순간을&nbsp;<span className="text-orange-400">기록</span>하다
          </h1>
          <p className="text-lg text-white/60 lg:text-xl">
            스마트 AI 계측부터 스마트피싱, 조행기, 피싱포인트, 낚시 커뮤니티까지
            <br />
            입낚 하나로 경험하세요
          </p>

          {/* 앱 다운로드 버튼 */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-[164px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#1a1a2e", border: "1.5px solid rgba(255,255,255,0.15)" }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M3.18 23.76A2 2 0 0 1 2 22V2a2 2 0 0 1 1.18-1.76L14 12 3.18 23.76zM16.54 9.46l-2.83-2.83L5.3.22 17.6 7l-1.06 2.46zM5.3 23.78l9.41-6.41 2.83-2.83L17.6 17l-12.3 6.78zM20 13.5 17.6 12 20 10.5l2.4 1.5L20 13.5z"/>
              </svg>
              Google Play
            </a>
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-[164px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#1a1a2e", border: "1.5px solid rgba(255,255,255,0.15)" }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              App Store
            </a>
          </div>

          {/* 스크롤 유도 */}
          <div className="mt-8 flex flex-col items-center gap-2 animate-bounce">
            <span className="text-xs font-semibold tracking-widest text-white/30">SCROLL</span>
            <svg className="h-5 w-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          섹션 2–7: 기능별 소개
      ══════════════════════════════════════════ */}
      {FEATURES.map((feat, idx) => (
        <FeatureSection
          key={feat.title}
          feat={feat}
          idx={idx}
          reservationEnabled={reservationEnabled}
          bassOnlyMode={bassOnlyMode}
          anglerLabel={anglerLabel}
        />
      ))}

      {/* ══════════════════════════════════════════
          섹션 8: 앱 다운로드 (마무리)
      ══════════════════════════════════════════ */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-24"
        data-bg-idx={2}
        data-mobile-bg-idx={1}
        style={{ zIndex: 2 }}
      >
        <div className="absolute inset-0 bg-black/72" />
        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-8 text-center">
          <span className="rounded-full bg-orange-500/20 px-4 py-1.5 text-xs font-bold tracking-wider text-orange-400">
            지금 시작하기
          </span>
          <h2 className="text-5xl font-black leading-tight text-white">
            입낚과 함께
            <br />
            <span className="text-orange-400">더 스마트</span>한 낚시
          </h2>
          <p className="text-base text-white/55">
            Android와 iOS 앱을 무료로 다운로드하고<br />
            모든 기능을 지금 바로 경험해보세요
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-[168px] items-center gap-3 rounded-2xl px-7 py-4 text-sm font-bold text-white transition-all duration-300 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #1e2030, #252840)", border: "1.5px solid rgba(255,255,255,0.12)" }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-green-400" fill="currentColor">
                <path d="M3.18 23.76A2 2 0 0 1 2 22V2a2 2 0 0 1 1.18-1.76L14 12 3.18 23.76zM16.54 9.46l-2.83-2.83L5.3.22 17.6 7l-1.06 2.46zM5.3 23.78l9.41-6.41 2.83-2.83L17.6 17l-12.3 6.78zM20 13.5 17.6 12 20 10.5l2.4 1.5L20 13.5z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px] font-normal text-white/50">다운로드 for</div>
                <div className="text-base font-black">Android</div>
              </div>
            </a>
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-[168px] items-center gap-3 rounded-2xl px-7 py-4 text-sm font-bold text-white transition-all duration-300 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #1e2030, #252840)", border: "1.5px solid rgba(255,255,255,0.12)" }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-white" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px] font-normal text-white/50">다운로드 for</div>
                <div className="text-base font-black">iOS</div>
              </div>
            </a>
          </div>

          {/* 버전 입장 */}
          <div className="mt-2 flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-px w-16 bg-white/10" />
              <span className="text-xs text-white/25">또는</span>
              <div className="h-px w-16 bg-white/10" />
            </div>
            <button
              onClick={enterApp}
              className="flex items-center gap-2 text-sm font-semibold text-white/50 transition hover:text-orange-400"
            >
              <Monitor size={16} />
              <span className="md:hidden">모바일버전으로 바로 입장하기 →</span>
              <span className="hidden md:inline">PC 버전으로 바로 입장하기 →</span>
            </button>
          </div>
        </div>

        {/* 하단 저작권 */}
        <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center">
          <p className="text-xs text-white/20">© 2025 입낚. All rights reserved.</p>
        </div>
      </section>
    </div>
  );
}
