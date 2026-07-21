"use client";
import { useState } from "react";
import { Navigation, Clock, Fish, MapPin, ChevronRight } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { TripDetailSheet, type TripDetail } from "@/components/TripDetailSheet";
import { km, duration, kstFormat } from "@/lib/utils";

export function TripCards({ trips }: { trips: TripDetail[] }) {
  const [selected, setSelected] = useState<TripDetail | null>(null);

  return (
    <div className="space-y-3 p-4">
      {trips.map((t) => (
        <Card key={t.id} className="flex gap-3 p-3" onClick={() => setSelected(t)}>
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-navy-100">
            <MiniRouteMap
              points={t.routePoints}
              catchPoints={t.catches.filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng! }))}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-navy-800">{t.title || (t.region ? `${t.region} 출조` : "데이터피싱 기록")}</p>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-navy-300">
                {kstFormat(new Date(t.createdAt), "M.d")}<ChevronRight size={13} />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="aqua"><Navigation size={11} className="mr-0.5" />{km(t.distanceM)}</Badge>
              <Badge tone="navy"><Clock size={11} className="mr-0.5" />{duration(t.durationSec)}</Badge>
              <Badge tone="green"><Fish size={11} className="mr-0.5" />{t.catches.length > 0 ? t.catches.length : (t.catchCount ?? 0)}마리</Badge>
              {t.region && <Badge tone="amber"><MapPin size={11} className="mr-0.5" />{t.region}</Badge>}
            </div>
          </div>
        </Card>
      ))}

      <TripDetailSheet open={!!selected} onClose={() => setSelected(null)} initial={selected} />
    </div>
  );
}
