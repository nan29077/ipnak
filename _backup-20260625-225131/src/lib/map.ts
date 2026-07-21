// MapProvider 추상화
// 현재는 Leaflet(OSM)으로 동작하며, 추후 Kakao Map / Naver Map 으로 교체 가능하도록
// 공통 타입과 설정만 정의한다. 실제 렌더링은 components/map/* 에서 provider 별로 분기한다.

export type LatLng = { lat: number; lng: number };

export type MapMarker = {
  id: string;
  position: LatLng;
  kind: "current" | "catch" | "listing";
  title?: string;
  data?: any;
};

export type MapProviderKind = "leaflet" | "kakao" | "naver";

export interface MapProviderConfig {
  kind: MapProviderKind;
  // 추후 연동 시 env 키 사용:
  // kakao  -> NEXT_PUBLIC_KAKAO_MAP_KEY
  // naver  -> NEXT_PUBLIC_NAVER_MAP_KEY
  tileUrl?: string;
  attribution?: string;
}

export const ACTIVE_MAP_PROVIDER: MapProviderConfig = {
  kind: "leaflet",
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap",
};

// 두 좌표 사이 거리 (m) — Haversine
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// 위치 권한 거부 시 사용할 더미 경로 (한강 일대 시뮬레이션)
export function mockRoute(center: LatLng, steps = 20): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < steps; i++) {
    out.push({
      lat: center.lat + Math.sin(i / 3) * 0.0025 + i * 0.0004,
      lng: center.lng + Math.cos(i / 3) * 0.0025 + i * 0.0003,
    });
  }
  return out;
}
