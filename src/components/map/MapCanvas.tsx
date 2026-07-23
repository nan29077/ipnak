"use client";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap, Marker } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import { ACTIVE_MAP_PROVIDER, type LatLng, type MapMarker } from "@/lib/map";

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lng]); }, [center.lat, center.lng, map]);
  return null;
}

const COLORS: Record<string, string> = { current: "#2dd4bf", catch: "#243a63", listing: "#f97316" };

// 물고기 SVG 아이콘 (lucide Fish 기반 라인형)
const FISH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.06-2.54-8.5-6z"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/></svg>`;

function createFishIcon(count: number, photoUrl?: string | null): L.DivIcon {
  const badge = count > 1
    ? `<div style="position:absolute;top:-7px;right:-7px;background:#dc2626;color:white;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid white;line-height:1;">${count}</div>`
    : "";
  const inner = photoUrl
    ? `<img src="${photoUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;display:block;" />`
    : FISH_SVG;
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px;">
      <div style="width:36px;height:36px;background:#f97316;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);overflow:hidden;">${inner}</div>
      ${badge}
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    tooltipAnchor: [0, -22],
  });
}

export default function MapCanvas({
  center, route = [], markers = [], zoom = 13, onMarkerClick,
}: {
  center: LatLng; route?: LatLng[]; markers?: MapMarker[]; zoom?: number;
  onMarkerClick?: (m: MapMarker) => void;
}) {
  const fishMarkers = markers.filter((m) => m.kind === "fish");
  const otherMarkers = markers.filter((m) => m.kind !== "fish");

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} className="h-full w-full" scrollWheelZoom>
      <TileLayer url={ACTIVE_MAP_PROVIDER.tileUrl!} attribution={ACTIVE_MAP_PROVIDER.attribution} />
      <Recenter center={center} />

      {route.length > 1 && (
        <Polyline positions={route.map((p) => [p.lat, p.lng]) as any} pathOptions={{ color: "#2dd4bf", weight: 4, opacity: 0.85 }} />
      )}

      {/* 일반 마커 (현재위치, 공개 피싱포인트, 시설 등) */}
      {otherMarkers.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.position.lat, m.position.lng]}
          radius={m.kind === "current" ? 9 : 8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[m.kind] ?? "#6b7280", fillOpacity: 1 }}
          eventHandlers={{ click: () => onMarkerClick?.(m) }}
        >
          {m.title && <Tooltip direction="top">{m.title}</Tooltip>}
        </CircleMarker>
      ))}

      {/* 피쉬 마커 — 물고기 아이콘 + 마리수 배지 */}
      {fishMarkers.map((m) => {
        const count = (m.data?.count as number) ?? 1;
        const photoUrl = m.data?.photoUrl as string | null | undefined;
        return (
          <Marker
            key={m.id}
            position={[m.position.lat, m.position.lng]}
            icon={createFishIcon(count, photoUrl)}
            eventHandlers={{ click: () => onMarkerClick?.(m) }}
          >
            {m.title && <Tooltip direction="top">{m.title}</Tooltip>}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
