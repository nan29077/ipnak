"use client";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";

export function MeActions({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
      <Link href="/settings" className="block">
        <Button
          variant="outline"
          full
          leftIcon={<Settings size={18} />}
          className="justify-start"
        >
          설정
        </Button>
      </Link>
      <Button
        variant="outline"
        full
        leftIcon={<LogOut size={18} />}
        className="justify-start border-red-100 text-red-500"
        onClick={logout}
      >
        로그아웃
      </Button>
    </div>
  );
}
