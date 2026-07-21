// MapProvider 추상화
// 현재는 Leaflet(OSM)으로 동작하며, 추후 Kakao Map / Naver Map 으로 교체 가능하도록
// 공통 타입과 설정만 정의한다. 실제 렌더링은 components/map/* 에서 provider 별로 분기한다.

export type LatLng = { lat: number; lng: number };

export type MapMarker = {
  id: string;
  position: LatLng;
  kind: "current" | "catch" | "listing" | "fish";
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

// ===== 정적 맵 이미지 URL 생성 (피싱 피드 첫 장 지도용) =====
export const STATIC_MAP_DOMAIN = "staticmap.openstreetmap.de";
const STATIC_MAP_BASE = `https://${STATIC_MAP_DOMAIN}/staticmap.php`;

/** 경로 포인트를 최대 maxPts 개로 균등 축약 (URL 길이 제한 대응) */
export function simplifyRoute(points: LatLng[], maxPts = 25): LatLng[] {
  if (points.length <= maxPts) return points;
  const step = (points.length - 1) / (maxPts - 1);
  return Array.from({ length: maxPts }, (_, i) => points[Math.round(i * step)]);
}

/**
 * 이동 동선(경로)이 포함된 정적 지도 이미지 URL.
 * 피싱 피드 데이터피싱 게시물의 첫 번째 이미지로 사용.
 * 포인트가 2개 미만이면 null 반환.
 */
export function buildRouteStaticMapUrl(points: LatLng[]): string | null {
  if (points.length < 2) return null;
  const pts = simplifyRoute(points, 25);
  const mid = pts[Math.floor(pts.length / 2)];
  // 동선 경로 파라미터 (파이프 구분자)
  const pathCoords = pts.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|");
  const startMark = `${pts[0].lat.toFixed(6)},${pts[0].lng.toFixed(6)},blue`;
  const endMark = `${pts[pts.length - 1].lat.toFixed(6)},${pts[pts.length - 1].lng.toFixed(6)},red`;
  return (
    `${STATIC_MAP_BASE}?size=640x360` +
    `&center=${mid.lat.toFixed(6)},${mid.lng.toFixed(6)}&zoom=15` +
    `&markers=${startMark}&markers=${endMark}` +
    `&path=color:0x16b8a6ff|weight:4|${pathCoords}`
  );
}

/**
 * 단일 좌표의 정적 지도 이미지 URL.
 * 기존 FISHING_POINT 피드 포스트에 소급 적용되는 위치 지도용.
 */
export function buildLocationStaticMapUrl(lat: number, lng: number): string {
  return (
    `${STATIC_MAP_BASE}?size=640x360` +
    `&center=${lat.toFixed(6)},${lng.toFixed(6)}&zoom=15` +
    `&markers=${lat.toFixed(6)},${lng.toFixed(6)},red`
  );
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
