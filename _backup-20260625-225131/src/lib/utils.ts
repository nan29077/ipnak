import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
}

export function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function km(meters: number) {
  return (meters / 1000).toFixed(2) + "km";
}

export function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// 위치 흐림: 공개 옵션에 따라 좌표에 무작위 오프셋 적용
export function blurCoord(
  lat: number,
  lng: number,
  visibility: string
): { lat: number; lng: number; radius: number } {
  let radius = 0;
  if (visibility === "BLUR_100") radius = 100;
  else if (visibility === "BLUR_500") radius = 500;
  if (radius === 0) return { lat, lng, radius: 0 };
  const seed = (lat + lng) * 1000;
  const a = (Math.sin(seed) + 1) * Math.PI; // 결정적 각도
  const dLat = (radius / 111000) * Math.cos(a);
  const dLng = (radius / (111000 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a);
  return { lat: lat + dLat, lng: lng + dLng, radius };
}

export function safeJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
