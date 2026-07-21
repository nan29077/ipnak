import Link from "next/link";
import { Eye, EyeOff, Settings2 } from "lucide-react";
import { AdminTitle, Card } from "@/components/admin/ui";
import { Badge } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { getAdminSections, ensureDefaultSections, curationModelReady, sectionTypeLabel, SECTION_TYPES } from "@/lib/curation";

export const dynamic = "force-dynamic";

function paramSummary(p: any) {
  const bits: string[] = [];
  if (p?.species) bits.push(`어종 ${p.species}`);
  if (p?.region) bits.push(`지역 ${p.region}`);
  if (p?.keywords) bits.push(`키워드 ${Array.isArray(p.keywords) ? p.keywords.join("·") : p.keywords}`);
  if (p?.period) bits.push(p.period === "weekly" ? "금주" : p.period === "monthly" ? "월간" : "전체기간");
  return bits.join(" · ") || "기본";
}

export default async function AdminSectionsPage() {
  await ensureDefaultSections(); // 모델 준비됐는데 비어 있으면 기본 섹션 1회 시드
  const sections = await getAdminSections();
  const ready = curationModelReady();

  return (
    <div>
      <AdminTitle title="섹션 관리" desc="메인 홈에 노출할 섹션을 추가·정렬하고, 스위치로 노출을 켜고 끕니다. 끈 섹션은 메인에서 완전히 빠집니다."
        right={<span className="flex gap-1.5">
          <Link href="/admin/pros" className="rounded-lg bg-navy-50 px-3 py-2 text-[12.5px] font-semibold text-navy-600 hover:bg-navy-100">프로 관리</Link>
          <Link href="/admin/curation" className="rounded-lg bg-navy-50 px-3 py-2 text-[12.5px] font-semibold text-navy-600 hover:bg-navy-100">글 큐레이션 →</Link>
        </span>} />

      {!ready && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
          섹션 테이블이 아직 없습니다. 터미널에서 <code className="rounded bg-black/30 px-1">npm run db:push</code> 실행 후 추가·편집이 활성화됩니다. (지금 메인은 기본 섹션으로 자동 노출됩니다.)
        </div>
      )}

      {/* 섹션 추가 */}
      <div className="mb-5">
        <CreateForm
          actionType="SECTION_CREATE"
          title="새 섹션 추가"
          fields={[
            { name: "title", label: "섹션 제목", required: true },
            { name: "sType", label: "유형", type: "select", required: true, options: SECTION_TYPES.map((t) => ({ value: t.key, label: t.label })) },
            { name: "species", label: "어종 (어종 유형 시)" },
            { name: "region", label: "지역 (지역 유형 시: 서울·전라도 등)" },
            { name: "keywords", label: "키워드 (테마 유형 시, 쉼표구분)" },
            { name: "period", label: "기간", type: "select", options: [{ value: "all", label: "전체" }, { value: "weekly", label: "금주" }, { value: "monthly", label: "월간" }] },
            { name: "mode", label: "노출 방식", type: "select", options: [{ value: "AUTO", label: "자동(점수순)" }, { value: "MANUAL", label: "수동(고정글)" }] },
          ]}
        />
      </div>

      {/* 섹션 목록 */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-800">메인 섹션 ({sections.filter((s) => s.visible).length}개 노출 / 총 {sections.length}개)</h2>
          <Badge tone="gray">위에서부터 메인 순서</Badge>
        </div>
        <ul className="space-y-2">
          {sections.map((s, i) => (
            <li key={s.key} className={`rounded-xl border border-navy-100 bg-[#1e1e1e] p-3 ${!s.visible ? "opacity-50" : ""}`}>
              {/* 상단: 번호 + 제목/배지 */}
              <div className="flex items-start gap-2 mb-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[12px] font-bold text-orange-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-navy-900">
                    {s.title}
                    {s.visible ? <Eye size={13} className="text-aqua-400" /> : <EyeOff size={13} className="text-navy-300" />}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-navy-400">
                    <Badge tone="navy">{sectionTypeLabel(s.type)}</Badge>
                    <Badge tone={s.mode === "MANUAL" ? "amber" : "gray"}>{s.mode === "MANUAL" ? "수동 고정" : "자동 점수순"}</Badge>
                    <span>{paramSummary(s.params)}</span>
                  </p>
                </div>
              </div>
              {/* 하단: 버튼 행 — 모바일 전폭으로 여유 있게 배치 */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/admin/curation?section=${s.key}`} className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-600 hover:bg-navy-100">
                  <Settings2 size={13} /> 글 관리
                </Link>
                {s.id ? (
                  <>
                    <ActionButton payload={{ type: "SECTION_MOVE", id: s.id, dir: "up" }} label="▲" variant="ghost" successMsg="이동됨" />
                    <ActionButton payload={{ type: "SECTION_MOVE", id: s.id, dir: "down" }} label="▼" variant="ghost" successMsg="이동됨" />
                    <ActionButton payload={{ type: "SECTION_TOGGLE", id: s.id }} label={s.visible ? "● 노출 끄기" : "○ 노출 켜기"} variant={s.visible ? "primary" : "default"} successMsg="변경됨" />
                    <ActionButton payload={{ type: "SECTION_DELETE", id: s.id }} label="삭제" variant="danger" confirm="이 섹션을 삭제할까요?" successMsg="삭제됨" />
                  </>
                ) : (
                  <Badge tone="gray">기본(db:push 후 편집)</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
