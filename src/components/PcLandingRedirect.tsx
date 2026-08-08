"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** PC(≥1024px) 첫 방문 시 랜딩 페이지로 이동 — 모바일은 무시 */
export function PcLandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth >= 1024 && !sessionStorage.getItem("ipnak_pc_entered")) {
      router.replace("/landing");
    }
  }, [router]);
  return null;
}
