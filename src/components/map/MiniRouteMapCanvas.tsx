"use client";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMap } from "react-leaflet";
import { ACTIVE_MAP_PROVIDER } from "@/lib/map";

type Point = { lat: number; lng: number };
type Cluster = { lat: number; lng: number; count: number };

/** 인접 좌표 클러스터링 — 소수점 4자리(~11m) 이내 같은 위치 묶기 */
function clusterCatchPoints(points: Point[]): Cluster[] {
  const map = new Map<string, Cluster>();
  for (const p of points) {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { lat: p.lat, lng: p.lng, count: 1 });
    }
  }
  return Array.from(map.values());
}

/** 물고기 마커 아이콘 — 단일/복수에 따라 숫자 뱃지 추가 */
function makeFishIcon(count: number): L.DivIcon {
  const FISH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6z"/>
    <path d="M18 12v.5"/>
    <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/>
    <circle cx="7" cy="12" r="1" fill="white"/>
  </svg>`;

  const badge = count > 1
    ? `<div style="position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;min-width:16px;height:16px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 2px;box-sizing:border-box;line-height:1;border:1.5px solid white;">${count}</div>`
    : "";

  return L.divIcon({
    html: `<div style="position:relative;width:28px;height:28px;">
      <div style="background:#f97316;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.45);">
        ${FISH_SVG}
      </div>
      ${badge}
    </div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** 경로 전체가 화면에 들어오도록 bounds를 자동으로 맞춘다. */
function FitBounds({ points, catchPoints }: { points: Point[]; catchPoints?: Point[] }) {
  const map = useMap();
  useEffect(() => {
    const allPts = [...points, ...(catchPoints ?? [])];
    if (allPts.length < 1) return;
    const bounds = allPts.map((p) => [p.lat, p.lng] as [number, number]);
    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.fitBounds(bounds, { padding: [18, 18], maxZoom: 17 });
    }
  }, [map, points, catchPoints]);
  return null;
}

export default function MiniRouteMapCanvas({
  points,
  catchPoints,
  interactive = false,
}: {
  points: Point[];
  catchPoints?: Point[];
  interactive?: boolean;
}) {
  const hasCatchPoints = catchPoints && catchPoints.length > 0;
  const clusters = hasCatchPoints ? clusterCatchPoints(catchPoints!) : [];

  if (points.length === 0 && !hasCatchPoints) {
    return <div className="flex h-full w-full items-center justify-center bg-navy-50 text-[11px] text-navy-300">동선 없음</div>;
  }

  const allPoints = points.length > 0 ? points : (catchPoints ?? []);
  const start = points[0] ?? allPoints[0];
  const end = points[points.length - 1] ?? allPoints[allPoints.length - 1];
  const center: [number, number] = [start.lat, start.lng];
  const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer
      center={center}
      zoom={15}
      className="h-full w-full"
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      dragging={interactive}
      touchZoom={interactive}
      zoomControl={interactive}
      attributionControl={false}
    >
      <TileLayer url={ACTIVE_MAP_PROVIDER.tileUrl!} attribution={ACTIVE_MAP_PROVIDER.attribution} />
      <FitBounds points={points} catchPoints={catchPoints} />

      {/* 동선 경로 — 그림자 효과를 위해 두 겹으로 렌더 */}
      {latLngs.length >= 2 && (
        <>
          <Polyline positions={latLngs} pathOptions={{ color: "#0d6e6e", weight: 5, opacity: 0.3 }} />
          <Polyline positions={latLngs} pathOptions={{ color: "#16b8a6", weight: 3.5, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
        </>
      )}

      {/* 출발점 (파란 점) */}
      {points.length > 0 && (
        <CircleMarker
          center={[start.lat, start.lng]}
          radius={6}
          pathOptions={{ color: "#fff", weight: 2, fillColor: "#243a63", fillOpacity: 1 }}
        />
      )}

      {/* 도착점 (오렌지 점) */}
      {points.length > 1 && (
        <CircleMarker
          center={[end.lat, end.lng]}
          radius={7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: "#f97316", fillOpacity: 1 }}
        />
      )}

      {/* 물고기 어획 위치 마커 — 클러스터링으로 숫자 뱃지 표시 */}
      {clusters.map((c, i) => (
        <Marker
          key={`catch-${i}`}
          position={[c.lat, c.lng]}
          icon={makeFishIcon(c.count)}
        />
      ))}
    </MapContainer>
  );
}
