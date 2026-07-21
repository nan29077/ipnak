import { redirect } from "next/navigation";
import { Bell, Shield, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { MyBallManager } from "@/components/BallLinkSection";
import { BallManualInput } from "@/components/BallManualInput";
import { PageHeader } from "@/components/ui";
import { SettingsLogout } from "@/components/SettingsLogout";

export const dynamic = "force-dynamic";
export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#161616] pb-24">
      <PageHeader title="설정" />

      <div className="mx-auto max-w-[640px] space-y-5 px-4 py-4">

        {/* 입낚볼 (NFC) 관리 */}
        <section>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
            입낚볼 · NFC
          </p>
          <MyBallManager />
          <BallManualInput />
        </section>

        {/* 알림 설정 */}
        <section>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
            알림
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e]">
            <SettingsRow icon={<Bell size={18} />} label="푸시 알림" hint="기기 설정에서 관리" />
          </div>
        </section>

        {/* 계정 */}
        <section>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
            계정
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e]">
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60">
                <Shield size={16} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-white/80">이메일</p>
                <p className="truncate text-[12px] text-white/40">{user.email}</p>
              </div>
            </div>
            <div className="h-px bg-white/10" />
            <SettingsLogout />
          </div>
        </section>

        <p className="pt-2 text-center text-[11px] text-white/20">입낚 v1.0</p>
      </div>
    </div>
  );
}

function SettingsRow({ icon, label, hint, href }: { icon: React.ReactNode; label: string; hint?: string; href?: string }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-white/80">{label}</p>
        {hint && <p className="text-[12px] text-white/40">{hint}</p>}
      </div>
      <ChevronRight size={16} className="shrink-0 text-white/30" />
    </div>
  );
}
