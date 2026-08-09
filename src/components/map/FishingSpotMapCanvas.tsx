"use client";
/**
 * 내 어장포인트 지도 (Leaflet) — 마이페이지 "내 어장포인트" 탭 전용.
 * - 내 스팟 마커 표시, 마커 클릭 → onSelect
 * - pickMode 일 때 지도를 탭하면 onPick 으로 좌표를 넘긴다 (새 스팟 위치 선택)
 */
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import { ACTIVE_MAP_PROVIDER } from "@/lib/map";

export type SpotMarker = { id: string; lat: number; lng: number; name: string };

/** 기본 중심 — 스팟이 하나도 없을 때 (대한민국 중앙부) */
const DEFAULT_CENTER: [number, number] = [36.5, 127.9];

/** 어장포인트 마커 아이콘 — 선택된 스팟은 주황, 나머지는 아쿠아 */
function makeSpotIcon(active: boolean): L.DivIcon {
  const bg = active ? "#f97316" : "#16b8a6";
  return L.divIcon({
    html: `<div style="position:relative;width:26px;height:26px;">
      <div style="background:${bg};border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.45);border:2px solid #fff;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    </div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** 스팟 전체가 화면에 들어오도록 bounds 를 맞춘다 (pickMode 에서는 건드리지 않는다) */
function FitSpots({ spots, enabled }: { spots: SpotMarker[]; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || spots.length === 0) return;
    if (spots.length === 1) {
      map.setView([spots[0].lat, spots[0].lng], 14);
      return;
    }
    map.fitBounds(
      spots.map((s) => [s.lat, s.lng] as [number, number]),
      { padding: [26, 26], maxZoom: 15 }
    );
  }, [map, spots, enabled]);
  return null;
}

/** pickMode: 지도 탭 → 좌표 전달 */
function PickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** 외부에서 좌표가 바뀌면 지도 중심을 옮긴다 (현재 위치 버튼 등) */
function RecenterTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.setView(position, Math.max(map.getZoom(), 14));
  }, [map, position]);
  return null;
}

export default function FishingSpotMapCanvas({
  spots,
  selectedId,
  onSelect,
  pickMode = false,
  pickedPosition = null,
  onPick,
}: {
  spots: SpotMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  pickMode?: boolean;
  pickedPosition?: [number, number] | null;
  onPick?: (lat: number, lng: number) => void;
}) {
  const first = spots[0];
  const center: [number, number] = pickedPosition
    ? pickedPosition
    : first
    ? [first.lat, first.lng]
    : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={first || pickedPosition ? 13 : 7}
      className="h-full w-full"
      scrollWheelZoom
      zoomControl
      attributionControl={false}
    >
      <TileLayer url={ACTIVE_MAP_PROVIDER.tileUrl!} attribution={ACTIVE_MAP_PROVIDER.attribution} />
      <FitSpots spots={spots} enabled={!pickMode} />
      {pickMode && onPick && <PickHandler onPick={onPick} />}
      {pickMode && <RecenterTo position={pickedPosition} />}

      {spots.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={makeSpotIcon(s.id === selectedId)}
          eventHandlers={onSelect ? { click: () => onSelect(s.id) } : undefined}
        />
      ))}

      {/* 새 스팟으로 찍은 위치 */}
      {pickMode && pickedPosition && (
        <CircleMarker
          center={pickedPosition}
          radius={9}
          pathOptions={{ color: "#fff", weight: 2.5, fillColor: "#f97316", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
