"use client";
import { useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export default function LandingPage() {
  const router = useRouter();
  const [hovered, setHovered] = useState<"left" | "right" | null>(null);
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
      router.push("/home");
    } else {
      sessionStorage.setItem("ipnak_pc_entered", "1");
      // 쿠키 세팅: 미들웨어에서 재방문 시 홈 유지
      document.cookie = "ipnak_entered=pc; path=/; max-age=86400";
      router.push("/home");
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
      `}</style>

      <div className="relative flex h-[100dvh] w-full overflow-hidden flex-col md:flex-row">

        {/* ── 모바일 전용 배경 (배경 이미지7.png): 두 섹션에 걸쳐 하나의 배경 ── */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            backgroundImage: "url('/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 모바일 배경이미지4.png')",
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
            backgroundImage: "url('/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-black/0 hidden md:block" />

        {/* ──────────────────────────────────────────────
            상단(모바일) / 좌측(PC): 입낚 소개
        ────────────────────────────────────────────── */}
        <div
          className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden"
          style={{
            flex: isTopActive ? "1.35" : "1",
            transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={() => setHovered("left")}
          onMouseLeave={() => setHovered(null)}
          onClick={goAbout}
          onTouchStart={(e) => handleTouch(e, "top")}
          onTouchEnd={() => setTouched(null)}
          onTouchCancel={() => setTouched(null)}
        >
          {/* 터치·호버 공통 주황 글로우 오버레이 */}
          <div
            className={`absolute inset-0 transition-all duration-500${isTopActive ? " ipnak-active-glow" : ""}`}
            style={{
              background: isTopActive
                ? "radial-gradient(ellipse at center, rgba(234,179,8,0.18) 0%, transparent 70%)"
                : "transparent",
            }}
          />

          {/* PC 전용 호버 어둠 오버레이 */}
          <div
            className="absolute inset-0 transition-all duration-700 hidden md:block"
            style={{
              background: hovered === "left"
                ? "linear-gradient(135deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 100%)"
                : "linear-gradient(135deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.06) 100%)",
            }}
          />

          {/* 활성 글로우 테두리 — 모바일:하단선, PC:오른쪽선 */}
          <div
            className={`absolute transition-all duration-500
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
              src="/logo-ipnak.png"
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
            <p className="max-w-xs text-sm text-white/60 md:text-base">
              AI 계측 · 조행기 · 피싱포인트 · 낚시 커뮤니티
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
        </div>

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
        <div
          className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden"
          style={{
            flex: isBottomActive ? "1.35" : "1",
            transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={() => setHovered("right")}
          onMouseLeave={() => setHovered(null)}
          onClick={enterApp}
          onTouchStart={(e) => handleTouch(e, "bottom")}
          onTouchEnd={() => setTouched(null)}
          onTouchCancel={() => setTouched(null)}
        >
          {/* 터치·호버 공통 주황 글로우 오버레이 */}
          <div
            className={`absolute inset-0 transition-all duration-500${isBottomActive ? " ipnak-active-glow" : ""}`}
            style={{
              background: isBottomActive
                ? "radial-gradient(ellipse at center, rgba(234,179,8,0.18) 0%, transparent 70%)"
                : "transparent",
            }}
          />

          {/* PC 전용 호버 어둠 오버레이 */}
          <div
            className="absolute inset-0 transition-all duration-700 hidden md:block"
            style={{
              background: hovered === "right"
                ? "linear-gradient(225deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 100%)"
                : "linear-gradient(225deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.06) 100%)",
            }}
          />

          {/* 활성 글로우 테두리 — 모바일:상단선, PC:왼쪽선 */}
          <div
            className={`absolute transition-all duration-500
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
              <span className="md:hidden">손 안에서 더 깊게<br />즐기는{" "}</span>
              <span className="hidden md:inline">PC에서 더 넓게<br />즐기는{" "}</span>
              <span style={{ color: isBottomActive ? "#facc15" : "#eab308", transition: "color 0.4s" }}>
                입낚
              </span>
            </h2>

            <p className="max-w-xs text-sm text-white/60 md:text-base">
              <span className="md:hidden">AI 계측·조행기·피드를 스마트폰으로 바로</span>
              <span className="hidden md:inline">넓은 화면으로 커뮤니티와 기록을 한눈에</span>
            </p>

            <button
              onClick={(e) => { e.stopPropagation(); enterApp(); }}
              className="mt-1 rounded-full px-7 py-2 text-sm font-bold text-white transition-all duration-400 md:mt-2 md:px-8 md:py-2.5"
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
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
