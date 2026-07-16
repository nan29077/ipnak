import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ReservationList } from "@/components/ReservationList";
import { getBoolSetting } from "@/lib/settings";
import { safeJson } from "@/lib/utils";
import { CalendarX } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const reservationEnabled = await getBoolSetting("reservation_enabled");

  // 예약 기능 비활성화 시: 서비스 준비 중 페이지
  if (!reservationEnabled) {
    return (
      <div>
        <PageHeader title="예약" sub="낚시배 · 펜션 · 유료터 · 좌대 · 가이드" />
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-50">
            <CalendarX size={40} className="text-navy-300" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-lg font-bold text-navy-700">서비스 준비 중입니다.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-400">
              예약 서비스를 준비하고 있습니다.
              <br />
              조금만 기다려 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const listings = await prisma.reservationListing.findMany({ orderBy: { createdAt: "desc" } });
  const data = listings.map((l) => ({
    id: l.id, name: l.name, category: l.category, region: l.region, imageUrl: l.imageUrl,
    price: l.price, maxPeople: l.maxPeople, rating: l.rating, reviewCount: l.reviewCount,
    targetSpecies: safeJson<string[]>(l.targetSpecies, []),
  }));
  const regions = Array.from(new Set(listings.map((l) => l.region)));
  return (
    <div>
      <PageHeader title="예약" sub="낚시배 · 펜션 · 유료터 · 좌대 · 가이드" />
      <ReservationList listings={data} regions={regions} />
    </div>
  );
}
