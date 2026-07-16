// 동선 미리보기 (가벼운 SVG, 풀 지도 대신 사용)
export function MiniRoute({ points }: { points: { lat: number; lng: number }[] }) {
  if (points.length < 2) {
    return <div className="flex h-full w-full items-center justify-center bg-navy-50 text-[11px] text-navy-300">동선 없음</div>;
  }
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 120, H = 80, pad = 10;
  const sx = (lng: number) => maxLng === minLng ? W / 2 : pad + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * pad);
  const sy = (lat: number) => maxLat === minLat ? H / 2 : H - pad - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * pad);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.lng).toFixed(1)},${sy(p.lat).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full bg-gradient-to-br from-aqua-50 to-navy-50">
      <path d={d} fill="none" stroke="#16b8a6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} transform="translate(0,1)" />
      <path d={d} fill="none" stroke="#16b8a6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(points[0].lng)} cy={sy(points[0].lat)} r={3} fill="#243a63" />
      <circle cx={sx(last.lng)} cy={sy(last.lat)} r={3.5} fill="#16b8a6" stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}
