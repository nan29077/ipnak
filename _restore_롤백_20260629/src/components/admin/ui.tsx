import { Badge } from "@/components/ui";

// 관리자 공용 프레젠테이션 (서버 컴포넌트에서 사용 가능)
export function AdminTitle({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-800">{title}</h1>
        {desc && <p className="mt-1 text-sm text-navy-400">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-card">
      <table className="w-full min-w-[600px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-navy-50/70 text-[12px] font-semibold uppercase tracking-wide text-navy-400 backdrop-blur">
          <tr className="border-b border-navy-100">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">{children}</tbody>
      </table>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; tone: "navy" | "aqua" | "amber" | "red" | "green" | "gray" }> = {
  PENDING: { label: "대기", tone: "amber" },
  RESOLVED: { label: "처리완료", tone: "aqua" },
  REJECTED: { label: "반려", tone: "red" },
  REVIEW: { label: "심사중", tone: "amber" },
  APPROVED: { label: "승인", tone: "green" },
  REQUESTED: { label: "예약요청", tone: "amber" },
  CONFIRMED: { label: "확정", tone: "aqua" },
  CANCELLED: { label: "취소", tone: "red" },
  DONE: { label: "이용완료", tone: "gray" },
  SUPER_ADMIN: { label: "관리자", tone: "navy" },
  ANGLER: { label: "낚시꾼", tone: "gray" },
  PARTNER: { label: "파트너", tone: "aqua" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
