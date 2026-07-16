// 낚시 테마 커스텀 아이콘 셋 — fishing-icons.zip 기반 (원본 SVG: /public/icons/**)
// lucide-react 와 동일한 props(size, strokeWidth, className)를 받도록 맞춰
// 기존 사용처에서 드롭인 교체가 가능하다. 색상은 currentColor 를 사용해
// 활성/비활성 등 텍스트 컬러(테마)를 그대로 따르고, 보조 라인은 opacity 로
// 원본의 투톤 느낌을 살렸다.
import * as React from "react";

export type FishingIconProps = Omit<React.SVGProps<SVGSVGElement>, "strokeWidth"> & {
  size?: number | string;
  strokeWidth?: number;
};

function Base({ size = 24, strokeWidth = 1.8, children, ...rest }: FishingIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── 탭바/네비게이션 ──────────────────────────────────────────────

/** 홈 (탭바-네비게이션/홈.svg) */
export function IconHome(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
    </Base>
  );
}

/** 지도 (탭바-네비게이션/지도(탭).svg) */
export function IconMap(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2z" />
      <path d="M9 4v14M15 6v14" opacity={0.55} />
    </Base>
  );
}

/** 내정보 (탭바-네비게이션/내정보(탭).svg) */
export function IconUser(p: FishingIconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" opacity={0.55} />
    </Base>
  );
}

// ── 낚싯대/도구 ─────────────────────────────────────────────────

/** 낚싯대 (낚싯대-릴-도구/낚싯대.svg) — 브랜드 로고 대용 */
export function IconRod(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M15 4l-1.4 1.4 5 5L20 9z" />
      <path d="M13.6 5.4L4 15l-1 5 5-1 9.6-9.6M8 14l2 2" opacity={0.55} />
    </Base>
  );
}

/** 태클박스 (낚싯대-릴-도구/태클박스.svg) — 쇼핑/중고피싱 */
export function IconTackleBox(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M4 10l2-3h12l2 3M9 7V5h6v2M4 14h16M11 10v4" opacity={0.55} />
    </Base>
  );
}

// ── 조과기록/측정 ───────────────────────────────────────────────

/** 트로피 (조과기록-사진-측정/트로피.svg) */
export function IconTrophy(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v3M9 20h6M10 20l.5-4h3l.5 4" opacity={0.55} />
    </Base>
  );
}

/** 조행달력 (조과기록-사진-측정/조행달력.svg) — 예약 */
export function IconCalendar(p: FishingIconProps) {
  return (
    <Base {...p}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 4v4M16 4v4M13 14h4M8 17h8" opacity={0.55} />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" opacity={0.55} />
    </Base>
  );
}

/** 기록장 (조과기록-사진-측정/기록장.svg) — 조행기 */
export function IconBook(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2z" />
      <path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2M10 9h6M10 13h4" opacity={0.55} />
    </Base>
  );
}

/** 측정자 (조과기록-사진-측정/측정자.svg) */
export function IconRuler(p: FishingIconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="9" width="18" height="6" rx="1.5" />
      <path d="M7 9v3M11 9v4M15 9v3M19 9v4" opacity={0.55} />
    </Base>
  );
}

// ── 물고기/위치 ─────────────────────────────────────────────────

/** 물고기 (물고기-어종/물고기.svg) */
export function IconFish(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M3 12c2-3.6 6.2-4.9 10-4.6 2.6.2 4.6 1.8 5.6 4.6-1 2.8-3 4.4-5.6 4.6-3.8.3-8-1-10-4.6z" />
      <path d="M18.4 12l3.6-3v6z" />
      <path d="M7.4 8.7c-.7 2.1-.7 4.5 0 6.6" opacity={0.55} />
      <circle cx="6.6" cy="10.7" r="0.9" fill="currentColor" stroke="none" opacity={0.55} />
    </Base>
  );
}

/** 포인트핀 (위치-포인트-지도/포인트핀.svg) */
export function IconMapPin(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M12 3a7 7 0 0 1 7 7c0 4.5-7 11-7 11S5 14.5 5 10a7 7 0 0 1 7-7z" />
      <circle cx="12" cy="10" r="2.3" fill="currentColor" stroke="none" opacity={0.55} />
    </Base>
  );
}

// ── 커뮤니티/소셜 ───────────────────────────────────────────────

/** 별점 (커뮤니티-랭킹-공유/별점.svg) */
export function IconStar(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8-4.3-4.1 5.9-.9z" />
    </Base>
  );
}

/** 그룹 (커뮤니티-랭킹-공유/그룹.svg) */
export function IconUsers(p: FishingIconProps) {
  return (
    <Base {...p}>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M15 7a3 3 0 0 1 0 6M3.5 19a5.5 5.5 0 0 1 11 0M15 14.5c2.6.4 4.5 2.3 4.5 4.5" opacity={0.55} />
    </Base>
  );
}

/** 좋아요 (커뮤니티-랭킹-공유/좋아요.svg) */
export function IconHeart(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 11-8 11z" />
    </Base>
  );
}

/** 댓글 (커뮤니티-랭킹-공유/댓글.svg) */
export function IconComment(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M4 5h16v11H9l-4 4z" />
      <path d="M8 9h8M8 12h5" opacity={0.55} />
    </Base>
  );
}

/** 조회수 (소셜-SNS/조회수.svg) */
export function IconEye(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" opacity={0.55} />
    </Base>
  );
}

/** 트렌드 (소셜-SNS/트렌드.svg) */
export function IconTrend(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M4 15l5-5 3 3 6-6M15 5h5v5" />
      <circle cx="20" cy="5" r="1.7" opacity={0.55} />
    </Base>
  );
}

// ── 설정/계정 ───────────────────────────────────────────────────

/** 로그인 (설정-알림-계정/로그인.svg) */
export function IconLogin(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M4 4h8v16H4z" />
      <path d="M10 12h10M17 9l3 3-3 3" opacity={0.55} />
    </Base>
  );
}

/** 보안 (설정-알림-계정/보안.svg) — 관리자 */
export function IconShield(p: FishingIconProps) {
  return (
    <Base {...p}>
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
      <path d="M9 12l2 2 4-4" opacity={0.55} />
    </Base>
  );
}
