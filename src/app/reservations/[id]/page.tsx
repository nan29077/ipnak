import { notFound } from "next/navigation";
import { Star, MapPin, Users, Fish, Check, CalendarX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Card, Badge } from "@/components/ui";
import { BookingForm } from "@/components/BookingForm";
import { reservationCategoryLabel } from "@/lib/taxonomy";
import { safeJson, won, kstFormat } from "@/lib/utils";
import { getBoolSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: { id: string } }) {
  const reservationEnabled = await getBoolSetting("reservation_enabled");
  if (!reservationEnabled) {
    return (
      <div>
        <PageHeader title="예약" back />
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
  const user = await getCurrentUser();
  const l = await prisma.reservationListing.findUnique({
    where: { id: params.id },
    include: { owner: { select: { id: true, nickname: true, avatarUrl: true } }, slots: { orderBy: { date: "asc" } } },
  });
  if (!l) notFound();

  const images = safeJson<string[]>(l.images, l.imageUrl ? [l.imageUrl] : []);
  const species = safeJson<string[]>(l.targetSpecies, []);
  const amenities = safeJson<string[]>(l.amenities, []);
  const services = safeJson<string[]>(l.services, []);
  const slots = l.slots.map((s) => ({ date: kstFormat(s.date, "yyyy-MM-dd"), timeLabel: s.timeLabel, remaining: s.capacity - s.booked }));

  return (
    <div className="pb-28 md:pb-10">
      <PageHeader title={reservationCategoryLabel(l.category)} back />
      {/* 이미지 갤러리 */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {images.map((src, i) => (
          <img key={i} src={src} alt={`${l.name} 사진 ${i + 1}`} className="h-56 w-full shrink-0 snap-center object-cover sm:w-2/3" />
        ))}
      </div>

      <div className="space-y-5 p-4">
        <div>
          <Badge tone="navy">{reservationCategoryLabel(l.category)}</Badge>
          <h1 className="mt-2 text-xl font-bold text-navy-800">{l.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-navy-400">
            <span className="inline-flex items-center gap-1"><MapPin size={14} />{l.region} · {l.address}</span>
            <span className="inline-flex items-center gap-1"><Star size={14} className="fill-amber-400 text-amber-400" />{l.rating} ({l.reviewCount})</span>
            <span className="inline-flex items-center gap-1"><Users size={14} />최대 {l.maxPeople}명</span>
          </div>
        </div>

        {l.description && <p className="text-sm leading-relaxed text-navy-600">{l.description}</p>}

        {species.length > 0 && (
          <Section title="이용 가능 어종" icon={<Fish size={15} />}>
            <div className="flex flex-wrap gap-1.5">{species.map((s) => <Badge key={s} tone="aqua">{s}</Badge>)}</div>
          </Section>
        )}

        {amenities.length > 0 && (
          <Section title="편의시설">
            <div className="grid grid-cols-2 gap-1.5">{amenities.map((a) => <span key={a} className="inline-flex items-center gap-1.5 text-sm text-navy-600"><Check size={14} className="text-aqua-500" />{a}</span>)}</div>
          </Section>
        )}
        {services.length > 0 && (
          <Section title="제공 서비스">
            <div className="grid grid-cols-2 gap-1.5">{services.map((a) => <span key={a} className="inline-flex items-center gap-1.5 text-sm text-navy-600"><Check size={14} className="text-aqua-500" />{a}</span>)}</div>
          </Section>
        )}

        <Section title="취소 정책">
          <p className="text-sm text-navy-500">{l.cancelPolicy}</p>
        </Section>

        {l.owner && (
          <Card className="flex items-center gap-2 p-3">
            <img src={l.owner.avatarUrl || ""} alt="" className="h-9 w-9 rounded-full object-cover" />
            <div><p className="text-xs text-navy-400">운영자</p><p className="text-sm font-semibold text-navy-800">{l.owner.nickname}</p></div>
            <p className="ml-auto text-lg font-extrabold text-navy-800">{won(l.price)}<span className="text-xs font-normal text-navy-300"> / 1인</span></p>
          </Card>
        )}
      </div>

      <BookingForm listingId={l.id} price={l.price} maxPeople={l.maxPeople} slots={slots} loggedIn={!!user} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy-800">{icon}{title}</h2>
      {children}
    </section>
  );
}
