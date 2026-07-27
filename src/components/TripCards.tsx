"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, Clock, Fish, MapPin, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { TripDetailSheet, type TripDetail } from "@/components/TripDetailSheet";
import { km, duration, kstFormat } from "@/lib/utils";

export function TripCards({ trips: initialTrips }: { trips: TripDetail[] }) {
  const router = useRouter();
  const [trips, setTrips] = useState(initialTrips);
  const [selected, setSelected] = useState<TripDetail | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmId !== id) { setConfirmId(id); return; }
    setDeletingId(id);
    setConfirmId(null);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setTrips((prev) => prev.filter((t) => t.id !== id));
      router.refresh(); // 서버 데이터(마이페이지 포함) 동기화
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3 p-4">
      {trips.map((t) => (
        <Card key={t.id} className="flex gap-3 p-3" onClick={() => { if (confirmId === t.id) { setConfirmId(null); return; } setSelected(t); }}>
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-navy-100">
            <MiniRouteMap
              points={t.routePoints}
              catchPoints={t.catches.filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng! }))}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-bold text-navy-800">{(t.title || (t.region ? `${t.region} 출조` : "스마트피싱 기록")).replace(/데이터피싱/g, "스마트피싱")}</p>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[11px] text-navy-300">{kstFormat(new Date(t.createdAt), "M.d")}</span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(t.id, e)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    confirmId === t.id
                      ? "bg-red-500/20 text-red-400"
                      : "text-navy-300 hover:bg-red-500/10 hover:text-red-400"
                  }`}
                  title={confirmId === t.id ? "한 번 더 누르면 삭제됩니다" : "삭제"}
                >
                  {deletingId === t.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} strokeWidth={1.8} />}
                </button>
              </div>
            </div>
            {confirmId === t.id && (
              <p className="mb-1 text-[11px] font-semibold text-red-400">한 번 더 누르면 삭제됩니다</p>
            )}
            <div className="mt-1 flex flex-wrap gap-1.5">
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
