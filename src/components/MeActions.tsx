"use client";
import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { clearLocalUserScope } from "@/services/DatabaseService";

export function MeActions({ isAdmin }: { isAdmin: boolean }) {
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
    <div className="space-y-2 px-4">
      {isAdmin && (
        <Link href="/admin" className="block">
          <Button variant="outline" full leftIcon={<Shield size={18} />} className="justify-start">
            관리자 페이지
          </Button>
        </Link>
      )}
      <Button
        variant="outline"
        full
        leftIcon={<LogOut size={18} />}
        className="justify-start border-orange-200/40 text-orange-400"
        onClick={logout}
      >
        로그아웃
      </Button>
    </div>
  );
}
