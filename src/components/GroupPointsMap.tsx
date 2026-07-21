"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type GroupPointItem = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string | null;
  authorNickname: string;
};

// Leaflet 기본 아이콘 경로 수정
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ORANGE_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const PICK_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  points: GroupPointItem[];
  /** true이면 지도 클릭으로 위치 선택 모드 */
  pickMode?: boolean;
  /** 선택된 위치 콜백 */
  onPick?: (lat: number, lng: number) => void;
  height?: number;
}

export function GroupPointsMap({ points, pickMode = false, onPick, height = 240 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // 지도 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [36.5, 127.8],
      zoom: 7,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 포인트 마커 갱신
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // 기존 마커 제거
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    // 새 마커 추가
    points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: ORANGE_ICON }).addTo(map);
      marker.bindPopup(
        `<div style="min-width:120px"><b style="font-size:13px">${p.title}</b>${
          p.description ? `<br/><span style="font-size:12px;color:#666">${p.description}</span>` : ""
        }<br/><span style="font-size:11px;color:#999">by ${p.authorNickname}</span></div>`,
        { maxWidth: 200 }
      );
      markersRef.current.push(marker);
    });
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [points]);

  // 픽 모드 토글
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLatLng([lat, lng]);
      } else {
        pickMarkerRef.current = L.marker([lat, lng], { icon: PICK_ICON }).addTo(map);
      }
      onPickRef.current?.(lat, lng);
    };

    if (pickMode) {
      map.on("click", handleClick);
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.off("click", handleClick);
      map.getContainer().style.cursor = "";
      if (pickMarkerRef.current) {
        pickMarkerRef.current.remove();
        pickMarkerRef.current = null;
      }
    }
    return () => {
      map.off("click", handleClick);
    };
  }, [pickMode]);

  return (
    <div ref={containerRef} style={{ height, width: "100%", borderRadius: "12px", overflow: "hidden" }} />
  );
}
