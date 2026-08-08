/**
 * 입낚 브랜드 로고 스피너
 * 노랑 원 안에 낚바늘 로고가 시계 방향으로 회전
 */
export function IpnakLogoSpinner({ size = 52 }: { size?: number }) {
  const inner = Math.round(size * 0.54);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[#eab308]"
      style={{
        width: size,
        height: size,
        animation: "spin 1.5s linear infinite",
      }}
    >
      <svg viewBox="60 32 96 132" width={inner} height={inner} fill="none" aria-label="입낚 로딩">
        <path
          d="M92 52V118C92 150 138 150 138 116C138 98 118 96 110 110"
          stroke="#0d1b2a"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M74 62L92 46L110 62"
          stroke="#0d1b2a"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="92" cy="46" r="5.5" fill="#0d1b2a" />
      </svg>
    </div>
  );
}

/**
 * 전체 화면 로딩 화면
 * loading.tsx 파일에서 사용
 * fixed inset-0 → 헤더/네비게이션 상관없이 뷰포트 정중앙 고정
 */
export function IpnakPageLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "#1a3a5c", zIndex: 9999 }}
    >
      <IpnakLogoSpinner size={52} />
    </div>
  );
}
