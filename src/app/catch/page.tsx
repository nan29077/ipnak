import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import { isBassOnlySpecies } from "@/lib/taxonomy";
import { PageHeader, EmptyState, Button } from "@/components/ui";
import { CatchRecordList, type CatchRecordItem } from "@/components/CatchRecordList";

export const dynamic = "force-dynamic";

// 피쉬 기록 목록: 측정값(길이·추정 무게)·측정 방법·PB·어종 평균 대비 표시
export default async function CatchListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [records, bassOnlyMode] = await Promise.all([
    prisma.catchRecord.findMany({
      where: { userId: user.id },
      include: { fishingPoint: true },
      orderBy: { createdAt: "desc" },
    }),
    getBoolSetting("bass_only_mode"),
  ]);

  const data: CatchRecordItem[] = records.map((r) => ({
    id: r.id,
    speciesName: r.speciesName,
    species: r.species,
    estimatedWeight: r.estimatedWeight,
    sizeCm: r.sizeCm,
    photoUrl: r.photoUrl,
    measuredLengthCm: r.measuredLengthCm,
    confidence: r.confidence,
    region: r.fishingPoint?.region ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  // 배스 전용 모드에서는 헤더 카운트도 실제 표시되는(필터된) 기록 수를 따른다
  const visibleCount = bassOnlyMode
    ? data.filter((r) => isBassOnlySpecies(r.speciesName)).length
    : data.length;

  return (
    <div className="pb-10">
      <PageHeader
        title="피쉬 기록"
        back
        sub={`${visibleCount}건의 기록`}
        right={
          <Link href="/catch/new">
            <Button size="sm" className="rounded-full" leftIcon={<Plus size={15} />}>기록하기</Button>
          </Link>
        }
      />
      {data.length === 0 ? (
        <EmptyState
          title="피쉬 기록이 없습니다"
          desc="스마트 자로 측정하고 첫 기록을 남겨보세요"
          action={<Link href="/catch/new"><Button size="sm">기록 남기기</Button></Link>}
        />
      ) : (
        <CatchRecordList records={data} />
      )}
    </div>
  );
}
