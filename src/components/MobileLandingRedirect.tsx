"use client";

import { useEffect } from "react";

export function MobileLandingRedirect() {
  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const openMeasureOnMobile = (matches: boolean) => {
      if (matches && window.location.pathname === "/") {
        window.location.replace("/measure");
      }
    };

    openMeasureOnMobile(mobileQuery.matches);

    const handleViewportChange = (event: MediaQueryListEvent) => {
      openMeasureOnMobile(event.matches);
    };
    mobileQuery.addEventListener("change", handleViewportChange);

    return () => {
      mobileQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  return null;
}
