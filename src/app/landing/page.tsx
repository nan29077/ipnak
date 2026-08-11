"use client";
import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSettings } from "@/lib/appSettingsContext";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

// 새 PC 배경이 마음에 들지 않으면 false 한 번으로 기존 배경으로 복귀합니다.
const ENABLE_PC_LANDING_CINEMAGRAPH = true;
const BASS_MOBILE_BACKGROUND =
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 모바일 배경이미지4.png";
const ALL_SPECIES_MOBILE_BACKGROUND =
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 모바일 전체어종 에깅 배경이미지.png";
const BASS_PC_FALLBACK_BACKGROUND =
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지.png";
const BASS_PC_CINEMAGRAPH_BACKGROUND = "/landing-bear-bass-boat-hero-circle-only.png";
// OFF 상태 PC 배경 — 이전 버전(정중앙 배스 파이팅 컷)으로 복귀
const ALL_SPECIES_PC_BACKGROUND = "/landing-bear-bass-boat-hero-circle-only.png";

export default function LandingPage() {
  const router = useRouter();
  const { bassOnlyMode } = useAppSettings();
  const isNativeApp = useIsNativeApp();
  const [hovered, setHovered] = useState<"left" | "right" | null>(null);

  // 네이티브 앱(패키징된 Android/iOS)에서는 랜딩 페이지 표시 안 함
  // → 온보딩을 아직 안 봤으면 /onboarding, 이미 봤으면 /home 으로 바로 이동
  // (웹에서는 isNativeApp=false 이므로 기존 랜딩 동작 그대로)
  useEffect(() => {
    if (!isNativeApp) return;
    let done = true;
    try {
      done = !!localStorage.getItem("ipnak_onboarding_done");
    } catch {
      done = true; // localStorage 차단 시 온보딩을 반복 노출하지 않는다
    }
    router.replace(done ? "/home" : "/onboarding");
  }, [isNativeApp, router]);
  const [touched, setTouched] = useState<"top" | "bottom" | null>(null);
  const [topRipples, setTopRipples] = useState<Ripple[]>([]);
  const [bottomRipples, setBottomRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const goAbout = useCallback(() => { router.push("/about"); }, [router]);

  const enterApp = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      sessionStorage.setItem("ipnak_mobile_entered", "1");
      // 쿠키 세팅: 미들웨어에서 재방문 시 /measure 로 직행
      document.cookie = "ipnak_entered=mobile; path=/; max-age=86400";
      router.replace("/home");
    } else {
      sessionStorage.setItem("ipnak_pc_entered", "1");
      // 쿠키 세팅: 미들웨어에서 재방문 시 홈 유지
      document.cookie = "ipnak_entered=pc; path=/; max-age=86400";
      router.replace("/home");
    }
  }, [router]);

  /** 터치 시 리플 생성 + touched 상태 활성 (손가락 뗄 때까지 유지) */
  const handleTouch = (e: React.TouchEvent, target: "top" | "bottom") => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const id = ++nextId.current;
    setTouched(target);
    const ripple: Ripple = { id, x, y };
    if (target === "top") {
      setTopRipples(r => [...r, ripple]);
      setTimeout(() => setTopRipples(r => r.filter(rip => rip.id !== id)), 800);
    } else {
      setBottomRipples(r => [...r, ripple]);
      setTimeout(() => setBottomRipples(r => r.filter(rip => rip.id !== id)), 800);
    }
    // touched 상태는 onTouchEnd / onTouchCancel 에서 해제
  };

  const isTopActive = hovered === "left" || touched === "top";
  const isBottomActive = hovered === "right" || touched === "bottom";
  const anyActive = !!(hovered || touched);
  const mobileBackground = bassOnlyMode
    ? BASS_MOBILE_BACKGROUND
    : ALL_SPECIES_MOBILE_BACKGROUND;
  const pcBackground = bassOnlyMode
    ? BASS_PC_FALLBACK_BACKGROUND
    : ALL_SPECIES_PC_BACKGROUND;
  const showBassCinemagraph = bassOnlyMode && ENABLE_PC_LANDING_CINEMAGRAPH;
  // 배스 전용 모드 OFF — 전체어종 PC 배경에도 동일한 시네마그래프 연출 적용
  const showAllSpeciesCinemagraph = !bassOnlyMode && ENABLE_PC_LANDING_CINEMAGRAPH;

  return (
    <>
      <style>{`
        @keyframes ipnakRipple {
          0%   { transform: translate(-50%, -50%) scale(0);  opacity: 0.65; }
          60%  { opacity: 0.35; }
          100% { transform: translate(-50%, -50%) scale(9);  opacity: 0; }
        }
        .ipnak-ripple {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(234,179,8,0.55) 0%, rgba(234,179,8,0.12) 55%, transparent 100%);
          animation: ipnakRipple 0.8s ease-out forwards;
          pointer-events: none;
          z-index: 30;
        }
        @keyframes ipnakActivePulse {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1;   }
        }
        @keyframes ipnakBorderPulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1;   }
        }
        .ipnak-active-glow {
          animation: ipnakActivePulse 1.6s ease-in-out infinite;
        }
        .ipnak-active-border {
          animation: ipnakBorderPulse 1.6s ease-in-out infinite;
        }
        @keyframes ipnakCinematicDrift {
          0%, 100% { transform: scale(1.0); }
          50%      { transform: scale(1.04); }
        }
        @keyframes ipnakWaterBreath {
          0%, 100% { opacity: 0.1; transform: translate3d(-2%, 0, 0) scaleX(0.96); }
          50%      { opacity: 0.3; transform: translate3d(2%, 0, 0) scaleX(1.04); }
        }
        .ipnak-pc-cinemagraph {
          animation: ipnakCinematicDrift 10s ease-in-out infinite;
          will-change: transform;
        }
        .ipnak-water-breath {
          animation: ipnakWaterBreath 8s ease-in-out infinite;
          will-change: opacity, transform;
        }
        @keyframes ipnakSeaSwell {
          0%, 100% { opacity: 0.14; transform: translate3d(-5%, 0, 0) scaleY(1); }
          50%      { opacity: 0.32; transform: translate3d(5%, 0, 0) scaleY(1.08); }
        }
        .ipnak-sea-swell {
          animation: ipnakSeaSwell 14s ease-in-out infinite;
          will-change: opacity, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .ipnak-pc-cinemagraph,
          .ipnak-water-breath,
          .ipnak-sea-swell {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative flex h-[100dvh] w-full overflow-hidden flex-col md:flex-row">

        {/* ── 모바일 전용 배경 (배경 이미지7.png): 두 섹션에 걸쳐 하나의 배경 ── */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            backgroundImage: `url('${mobileBackground}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* 모바일 기본 어두운 베일 */}
        <div className="absolute inset-0 bg-black/35 md:hidden" />

        {/* ── PC 전용 배경 ── */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            backgroundImage: `url('${pcBackground}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {showBassCinemagraph && (
          <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block" aria-hidden="true">
            <div
              className="ipnak-pc-cinemagraph absolute -inset-[4%] bg-cover bg-center"
              style={{ backgroundImage: `url('${BASS_PC_CINEMAGRAPH_BACKGROUND}')` }}
            />
            <div className="ipnak-water-breath absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(105deg,transparent_5%,rgba(255,179,79,0.16)_31%,transparent_51%,rgba(148,206,255,0.12)_73%,transparent_96%)] mix-blend-screen" />
          </div>
        )}
        {showAllSpeciesCinemagraph && (
          <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block" aria-hidden="true">
            <div
              className="ipnak-pc-cinemagraph absolute -inset-[4%] bg-cover bg-center"
              style={{ backgroundImage: `url('${ALL_SPECIES_PC_BACKGROUND}')` }}
            />
            {/* 바다 노을 물빛 — 수평 스웰 */}
            <div className="ipnak-sea-swell absolute inset-x-0 bottom-0 h-[52%] bg-[linear-gradient(100deg,transparent_4%,rgba(148,206,255,0.16)_28%,transparent_49%,rgba(255,214,140,0.14)_71%,transparent_95%)] mix-blend-screen" />
            {/* 잔물결 반짝임 */}
            <div className="ipnak-water-breath absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(80deg,transparent_8%,rgba(255,255,255,0.10)_34%,transparent_58%,rgba(120,190,255,0.12)_79%,transparent_98%)] mix-blend-screen" />
          </div>
        )}
        <div className="absolute inset-0 hidden bg-black/10 md:block" />

        {/* ──────────────────────────────────────────────
            상단(모바일) / 좌측(PC): 입낚 소개
        ────────────────────────────────────────────── */}
        {/* 키보드로도 진입할 수 있도록 네이티브 button — Tab 포커스·Enter/Space 활성화가 기본 제공된다 */}
        <button
          type="button"
          aria-label="입낚 소개 보기"
          className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#eab308]"
          style={{
            flex: isTopActive ? "1.35" : "1",
            transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={() => setHovered("left")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("left")}
          onBlur={() => setHovered(null)}
          onClick={goAbout}
          onTouchStart={(e) => handleTouch(e, "top")}
          onTouchEnd={() => setTouched(null)}
          onTouchCancel={() => setTouched(null)}
        >
          {/* 터치·호버 공통 주황 글로우 오버레이 — 시각 효과 전용, 클릭 이벤트 차단 방지 */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-all duration-500${isTopActive ? " ipnak-active-glow" : ""}`}
            style={{
              background: isTopActive
                ? "radial-gradient(ellipse at center, rgba(234,179,8,0.18) 0%, transparent 70%)"
                : "transparent",
            }}
          />

          {/* PC 전용 호버 어둠 오버레이 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-all duration-700 hidden md:block"
            style={{
              background: hovered === "left"
                ? "linear-gradient(135deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 100%)"
                : "linear-gradient(135deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.06) 100%)",
            }}
          />

          {/* 활성 글로우 테두리 — 모바일:하단선, PC:오른쪽선 */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute transition-all duration-500
              bottom-0 left-0 right-0 h-[2px]
              md:bottom-auto md:right-0 md:top-0 md:h-full md:w-[2px] md:left-auto${isTopActive ? " ipnak-active-border" : ""}`}
            style={{
              background: isTopActive
                ? "linear-gradient(to right, transparent, rgba(234,179,8,0.85), transparent)"
                : "transparent",
            }}
          />

          {/* 터치 리플 */}
          {topRipples.map(r => (
            <span key={r.id} className="ipnak-ripple" style={{ left: r.x, top: r.y }} />
          ))}

          {/* 컨텐츠 */}
          <div
            className="relative z-10 flex flex-col items-center gap-4 px-8 text-center md:gap-5 md:px-10"
            style={{
              transform: isTopActive ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <img
              src="/logo-ipnak-master-transparent-v2.png"
              alt="입낚"
              className="h-10 transition-all duration-500 md:h-12"
              style={{
                filter: isTopActive
                  ? "drop-shadow(0 0 20px rgba(234,179,8,0.9))"
                  : "drop-shadow(0 2px 12px rgba(0,0,0,0.6))",
              }}
            />
            <h2
              className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl xl:text-5xl"
              style={{
                textShadow: isTopActive
                  ? "0 0 40px rgba(234,179,8,0.4), 0 2px 20px rgba(0,0,0,0.8)"
                  : "0 2px 20px rgba(0,0,0,0.8)",
                transition: "text-shadow 0.5s",
              }}
            >
              낚시인의 모든
              <br />
              순간을&nbsp;<span style={{ color: isTopActive ? "#facc15" : "#eab308", transition: "color 0.4s" }}>기록</span>하다
            </h2>
            <p className="max-w-xs text-sm text-white/60 md:max-w-none md:whitespace-nowrap md:text-base">
              AI 계측·어종 인식 · 조행기 · 피싱포인트 · 낚시 커뮤니티 · 중고마켓
            </p>
            <span
              className="mt-1 inline-block rounded-full px-6 py-2 text-sm font-bold transition-all duration-400 md:mt-2 md:px-7 md:py-2.5"
              style={{
                border: isTopActive ? "2px solid #eab308" : "2px solid rgba(234,179,8,0.6)",
                background: isTopActive ? "rgba(234,179,8,0.18)" : "transparent",
                color: isTopActive ? "#facc15" : "rgba(255,255,255,0.7)",
                boxShadow: isTopActive ? "0 0 24px rgba(234,179,8,0.3)" : "none",
              }}
            >
              입낚 소개 보기 →
            </span>
          </div>
        </button>

        {/* ──────────────────────────────────────────────
            OR 구분선 — 모바일:가로, PC:세로
        ────────────────────────────────────────────── */}
        <div className="relative z-20 flex flex-shrink-0 items-center justify-center gap-3 flex-row px-8 md:flex-col md:px-0 md:py-8">
          <div
            className="flex-1 transition-all duration-500 h-[1.5px] md:h-auto md:w-[1.5px]"
            style={{ background: anyActive ? "rgba(234,179,8,0.6)" : "rgba(255,255,255,0.38)" }}
          />
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black tracking-widest transition-all duration-500"
            style={{
              background: anyActive ? "rgba(234,179,8,0.18)" : "rgba(255,255,255,0.10)",
              border: anyActive ? "1.5px solid rgba(234,179,8,0.7)" : "1.5px solid rgba(255,255,255,0.45)",
              color: anyActive ? "#facc15" : "rgba(255,255,255,0.7)",
              boxShadow: anyActive ? "0 0 16px rgba(234,179,8,0.35)" : "none",
            }}
          >
            OR
          </span>
          <div
            className="flex-1 transition-all duration-500 h-[1.5px] md:h-auto md:w-[1.5px]"
            style={{ background: anyActive ? "rgba(234,179,8,0.6)" : "rgba(255,255,255,0.38)" }}
          />
        </div>

        {/* ──────────────────────────────────────────────
            하단(모바일) / 우측(PC): 앱 바로가기
        ────────────────────────────────────────────── */}
        <button
          type="button"
          aria-label="입낚 앱 바로가기"
          className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#eab308]"
          style={{
            flex: isBottomActive ? "1.35" : "1",
            transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={() => setHovered("right")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("right")}
          onBlur={() => setHovered(null)}
          onClick={enterApp}
          onTouchStart={(e) => handleTouch(e, "bottom")}
          onTouchEnd={() => setTouched(null)}
          onTouchCancel={() => setTouched(null)}
        >
          {/* 터치·호버 공통 주황 글로우 오버레이 — 시각 효과 전용, 클릭 이벤트 차단 방지 */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-all duration-500${isBottomActive ? " ipnak-active-glow" : ""}`}
            style={{
              background: isBottomActive
                ? "radial-gradient(ellipse at center, rgba(234,179,8,0.18) 0%, transparent 70%)"
                : "transparent",
            }}
          />

          {/* PC 전용 호버 어둠 오버레이 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-all duration-700 hidden md:block"
            style={{
              background: hovered === "right"
                ? "linear-gradient(225deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 100%)"
                : "linear-gradient(225deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.06) 100%)",
            }}
          />

          {/* 활성 글로우 테두리 — 모바일:상단선, PC:왼쪽선 */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute transition-all duration-500
              top-0 left-0 right-0 h-[2px]
              md:top-0 md:left-0 md:right-auto md:h-full md:w-[2px]${isBottomActive ? " ipnak-active-border" : ""}`}
            style={{
              background: isBottomActive
                ? "linear-gradient(to right, transparent, rgba(234,179,8,0.85), transparent)"
                : "transparent",
            }}
          />

          {/* 터치 리플 */}
          {bottomRipples.map(r => (
            <span key={r.id} className="ipnak-ripple" style={{ left: r.x, top: r.y }} />
          ))}

          {/* 컨텐츠 */}
          <div
            className="relative z-10 flex flex-col items-center gap-4 px-8 text-center md:gap-5 md:px-10"
            style={{
              transform: isBottomActive ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {/* 기기 뱃지 */}
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 transition-all duration-400"
              style={{
                background: isBottomActive ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.08)",
                border: isBottomActive ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {/* 모바일: 스마트폰 아이콘 */}
              <svg className="h-4 w-4 md:hidden" style={{ color: isBottomActive ? "#facc15" : "rgba(255,255,255,0.5)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
              </svg>
              {/* PC: 모니터 아이콘 */}
              <svg className="hidden h-4 w-4 md:block" style={{ color: isBottomActive ? "#facc15" : "rgba(255,255,255,0.5)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <span className="text-xs font-bold tracking-wide md:hidden" style={{ color: isBottomActive ? "#facc15" : "rgba(255,255,255,0.45)" }}>모바일 버전</span>
              <span className="hidden text-xs font-bold tracking-wide md:inline" style={{ color: isBottomActive ? "#facc15" : "rgba(255,255,255,0.45)" }}>PC 버전</span>
            </div>

            <h2
              className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl xl:text-5xl"
              style={{
                textShadow: isBottomActive
                  ? "0 0 40px rgba(234,179,8,0.4), 0 2px 20px rgba(0,0,0,0.8)"
                  : "0 2px 20px rgba(0,0,0,0.8)",
                transition: "text-shadow 0.5s",
              }}
            >
              <span className="md:hidden">더 스마트하게<br />즐기는{" "}</span>
              <span className="hidden md:inline">PC에서 더 넓게<br />즐기는{" "}</span>
              <span style={{ color: isBottomActive ? "#facc15" : "#eab308", transition: "color 0.4s" }}>
                입낚
              </span>
            </h2>

            <p className="max-w-xs text-sm text-white/60 md:max-w-none md:whitespace-nowrap md:text-base">
              <span className="md:hidden">AI로 길이·무게·어종을 한 번에 기록해 보세요.</span>
              <span className="hidden md:inline">넓은 화면에서 커뮤니티와 기록을 한눈에 만나보세요.</span>
            </p>

            <span
              className="mt-1 inline-block rounded-full px-7 py-2 text-sm font-bold text-gray-900 transition-all duration-400 md:mt-2 md:px-8 md:py-2.5"
              style={{
                background: isBottomActive
                  ? "linear-gradient(135deg, #eab308, #ca8a04)"
                  : "rgba(234,179,8,0.75)",
                boxShadow: isBottomActive
                  ? "0 0 32px rgba(234,179,8,0.5), 0 4px 16px rgba(0,0,0,0.4)"
                  : "0 2px 12px rgba(0,0,0,0.4)",
                transform: isBottomActive ? "translateY(-1px)" : "translateY(0)",
              }}
            >
              <span className="md:hidden">모바일 버전 바로가기 →</span>
              <span className="hidden md:inline">PC 버전 바로가기 →</span>
            </span>
          </div>
        </button>
      </div>
    </>
  );
}
