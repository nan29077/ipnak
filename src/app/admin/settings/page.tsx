import { prisma } from "@/lib/prisma";
import { AdminTitle, Card } from "@/components/admin/ui";
import { Badge } from "@/components/ui";
import { kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ENV_KEYS = [
  { key: "GOOGLE_CLIENT_ID / SECRET", desc: "Google 소셜 로그인" },
  { key: "KAKAO_CLIENT_ID / SECRET", desc: "카카오 소셜 로그인" },
  { key: "NAVER_CLIENT_ID / SECRET", desc: "네이버 소셜 로그인" },
  { key: "NEXT_PUBLIC_KAKAO_MAP_KEY", desc: "카카오 지도 연동" },
  { key: "NEXT_PUBLIC_NAVER_MAP_KEY", desc: "네이버 지도 연동" },
  { key: "PAYMENT_API_KEY", desc: "예약 결제(PG) 연동" },
  { key: "COMMERCE_AFFILIATE_KEY", desc: "피싱태그 커머스/제휴 연동" },
];

export default async function AdminSettings() {
  const logs = await prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div>
      <AdminTitle title="설정" desc="연동 환경변수 및 운영 로그" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-navy-800">추후 API 연동 포인트 (.env)</h2>
          <div className="space-y-2">
            {ENV_KEYS.map((e) => (
              <div key={e.key} className="flex items-center justify-between rounded-lg bg-navy-50/60 px-3 py-2">
                <div><p className="font-mono text-[12px] font-semibold text-navy-700">{e.key}</p><p className="text-[11px] text-navy-400">{e.desc}</p></div>
                <Badge tone="amber">미연동</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-navy-800">최근 운영 로그</h2>
          <div className="space-y-1.5">
            {logs.length === 0 && <p className="py-4 text-center text-sm text-navy-300">로그 없음</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-[12px]">
                <span className="rounded bg-orange-500 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{l.action}</span>
                <span className="truncate text-navy-500">{l.detail || l.target || ""}</span>
                <span className="ml-auto shrink-0 text-navy-300">{kstFormat(l.createdAt, "MM.dd HH:mm")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
