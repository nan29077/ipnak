import { prisma } from "@/lib/prisma";
import { AdminTitle, Card } from "@/components/admin/ui";
import { CreateForm } from "@/components/admin/CreateForm";

export const dynamic = "force-dynamic";

const KIND_KO: Record<string, string> = { MAIN: "대분류", ENV: "장소/환경", METHOD: "낚시 방식", ACCESS: "접근 스타일" };

export default async function AdminTaxonomy() {
  const [categories, species] = await Promise.all([
    prisma.fishingCategory.findMany({ orderBy: { order: "asc" } }),
    prisma.fishSpecies.findMany({ orderBy: { order: "asc" } }),
  ]);
  const byKind = (k: string) => categories.filter((c) => c.kind === k);
  const fresh = species.filter((s) => s.water === "FRESH");
  const sea = species.filter((s) => s.water === "SEA");

  return (
    <div>
      <AdminTitle title="낚시 분류 / 어종 관리" desc={`분류 ${categories.length}개 · 어종 ${species.length}개`} />

      <div className="mb-4">
        <CreateForm actionType="SPECIES_CREATE" title="어종 추가" fields={[
          { name: "label", label: "어종명", required: true },
          { name: "water", label: "구분", type: "select", options: [{ value: "FRESH", label: "민물" }, { value: "SEA", label: "바다" }] },
        ]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["MAIN", "ENV", "METHOD", "ACCESS"] as const).map((k) => (
          <Card key={k} className="p-4">
            <h2 className="mb-2 text-sm font-bold text-navy-800">{KIND_KO[k]} <span className="text-navy-300">({byKind(k).length})</span></h2>
            <div className="flex flex-wrap gap-1.5">
              {byKind(k).map((c) => <span key={c.id} className="rounded-full bg-navy-50 px-2.5 py-1 text-[12px] text-navy-600">{c.label}</span>)}
            </div>
          </Card>
        ))}
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold text-navy-800">민물 대상어 <span className="text-navy-300">({fresh.length})</span></h2>
          <div className="flex flex-wrap gap-1.5">{fresh.map((s) => <span key={s.id} className="rounded-full bg-aqua-50 px-2.5 py-1 text-[12px] text-aqua-700">{s.label}</span>)}</div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold text-navy-800">바다 대상어 <span className="text-navy-300">({sea.length})</span></h2>
          <div className="flex flex-wrap gap-1.5">{sea.map((s) => <span key={s.id} className="rounded-full bg-aqua-50 px-2.5 py-1 text-[12px] text-aqua-700">{s.label}</span>)}</div>
        </Card>
      </div>
    </div>
  );
}
