"use client";

import { useEffect } from "react";

export function MobileLandingRedirect() {
  useEffect(() => {
    const redirect = () => {
      if (window.location.pathname !== "/") return;

      const pcEntered = !!sessionStorage.getItem("ipnak_pc_entered");
      const mobileEntered = !!sessionStorage.getItem("ipnak_mobile_entered");

      // PC 세션 플래그가 있으면 홈 유지 (DevTools 모바일 시뮬레이션 오작동 방지)
      if (pcEntered) return;

      // 모바일 재방문 → AI측정
      if (mobileEntered) {
        window.location.replace("/measure");
        return;
      }

      // 첫 방문 (PC·모바일 모두) → 랜딩페이지
      window.location.replace("/landing");
    };

    // 초기 실행 (PC·모바일 공통)
    redirect();

    // DevTools 뷰포트 변경 대응
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      redirect();
    };
    mobileQuery.addEventListener("change", handleViewportChange);
    return () => mobileQuery.removeEventListener("change", handleViewportChange);
  }, []);

  return null;
}
