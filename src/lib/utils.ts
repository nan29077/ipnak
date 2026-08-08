import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
}

// 한국 표준시(KST, Asia/Seoul) 고정 포맷터.
// 서버/클라이언트의 로컬 타임존과 무관하게 항상 KST 기준으로 표시한다.
// 지원 토큰: yyyy, MM, dd, HH, mm, ss (2자리), M, d, H (비-제로패딩)
const KST_TZ = "Asia/Seoul";

function kstParts(date: Date | string | number): Record<string, string> {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  if (out.hour === "24") out.hour = "00"; // 일부 런타임의 자정 표기 보정
  return out;
}

export function kstFormat(date: Date | string | number, pattern: string): string {
  const p = kstParts(date);
  const map: Record<string, string> = {
    yyyy: p.year,
    MM: p.month,
    dd: p.day,
    HH: p.hour,
    mm: p.minute,
    ss: p.second,
    M: String(Number(p.month)),
    d: String(Number(p.day)),
    H: String(Number(p.hour)),
  };
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss|M|d|H/g, (t) => map[t]);
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

// 라이브 스톱워치 표시 (초 단위까지 매초 갱신)
export function stopwatch(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(ss)}`;
  return `${pad(m)}:${pad(ss)}`;
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
