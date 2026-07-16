import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ReservationList } from "@/components/ReservationList";
import { safeJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
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
