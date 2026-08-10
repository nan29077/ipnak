"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useToast } from "@/components/Toast";
import { clearLocalUserScope } from "@/services/DatabaseService";

export function SettingsLogout() {
  const router = useRouter();
  const toast = useToast();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // 계측일지(localStorage) 계정 포인터 해제 — 다음 로그인 계정에 이전 기록이 보이지 않게 한다
    clearLocalUserScope();
    toast("로그아웃 되었습니다", "success");
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <LogOut size={16} strokeWidth={1.8} />
      </span>
      <p className="text-[14px] font-medium text-red-400">로그아웃</p>
    </button>
  );
}
