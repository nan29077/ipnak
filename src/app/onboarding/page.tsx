"use client";
/**
 * 입낚 앱 온보딩 (최초 1회)
 *
 * - 4슬라이드: 소개 → 스마트 피싱 → 입낚볼/커뮤니티 → 권한 요청
 * - localStorage("ipnak_onboarding_done") 이 있으면 즉시 /home 으로 이동
 * - 앱(Capacitor)에서는 마지막 슬라이드에서 실제 네이티브 권한을 요청하고,
 *   웹에서는 권한 안내만 보여준 뒤 그대로 진행한다 (웹 동작에 영향 없음)
 * - AppShell 위에 덮이도록 fixed 전체화면으로 렌더한다
 *
 * 슬라이드 배경 이미지는 public/onboarding/ 에 넣으면 자동 적용된다.
 * (파일이 없으면 브랜드 그라디언트로 폴백 — SLIDE_IMAGES 참고)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Fish,
  MapPin,
  Users,
  ShieldCheck,
  ChevronRight,
  Camera as CameraIcon,
  Bell,
  Navigation,
  Loader2,
} from "lucide-react";
import {
  isNativeRuntime,
  importGeolocation,
  importCamera,
  importPushNotifications,
  importLocalNotifications,
} from "@/lib/capacitorPlugins";

export const ONBOARDING_DONE_KEY = "ipnak_onboarding_done";

const BRAND = "#eab308";
const BG_DARK = "#0d1b2a";

type Slide = {
  key: string;
  icon: typeof Fish;
  title: string;
  desc: string;
  /** public/onboarding/ 하위 이미지 (없으면 그라디언트 폴백) */
  image: string;
  /** 폴백 그라디언트 */
  fallback: string;
};

const SLIDES: Slide[] = [
  {
    key: "welcome",
    icon: Fish,
    title: "입낚에 오신 것을\n환영합니다",
    desc: "조황 기록부터 피싱 포인트, 계측, 커뮤니티까지.\n낚시인의 모든 순간을 입낚 하나로 담아보세요.",
    image: "/onboarding/slide-1.png",
    fallback: "linear-gradient(160deg, #12263a 0%, #0d1b2a 55%, #0a1420 100%)",
  },
  {
    key: "smart-fishing",
    icon: MapPin,
    title: "스마트 피싱 포인트",
    desc: "물때·날씨·수온·파고를 분석한 AI가\n지금 갈 만한 포인트를 순위로 추천합니다.",
    image: "/onboarding/slide-2.png",
    fallback: "linear-gradient(160deg, #123040 0%, #0d1b2a 55%, #0a1420 100%)",
  },
  {
    key: "ipnak-ball",
    icon: Users,
    title: "입낚볼로 기록하다",
    desc: "입낚볼을 함께 찍으면 길이가 자동 계측됩니다.\n기록은 커뮤니티에서 함께 나눠보세요.",
    image: "/onboarding/slide-3.png",
    fallback: "linear-gradient(160deg, #2a2410 0%, #16200f 55%, #0a1420 100%)",
  },
  {
    key: "permissions",
    icon: ShieldCheck,
    title: "원활한 사용을 위해\n권한이 필요해요",
    desc: "아래 권한을 허용하면 입낚의 기능을 모두 사용할 수 있어요.\n나중에 설정에서 언제든 변경할 수 있습니다.",
    image: "/onboarding/slide-4.png",
    fallback: "linear-gradient(160deg, #101c2c 0%, #0d1b2a 55%, #0a1420 100%)",
  },
];

const PERMISSIONS = [
  {
    key: "location",
    icon: Navigation,
    label: "위치",
    desc: "내 주변 피싱 포인트 추천, 조행 경로 기록",
  },
  {
    key: "camera",
    icon: CameraIcon,
    label: "카메라 · 사진",
    desc: "물고기 계측 촬영, 조황 사진 업로드",
  },
  {
    key: "notification",
    icon: Bell,
    label: "알림",
    desc: "물때 알림, 댓글·좋아요 등 활동 소식",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  /** 이미지 로드 실패한 슬라이드 키 — 그라디언트 폴백으로 전환 */
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  // 이미 온보딩을 완료했으면 홈으로
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(ONBOARDING_DONE_KEY)) {
        router.replace("/home");
        return;
      }
    } catch {
      /* localStorage 차단 환경 — 그냥 온보딩을 보여준다 */
    }
    setReady(true);
  }, [router]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, new Date().toISOString());
    } catch {
      /* noop */
    }
    router.replace("/home");
  }, [router]);

  /** 앱에서만 실제 네이티브 권한 요청 — 웹에서는 아무것도 하지 않고 통과 */
  const requestPermissions = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      if (isNativeRuntime()) {
        // 각 권한은 실패해도 나머지 진행을 막지 않는다 (allSettled)
        await Promise.allSettled([
          (async () => {
            const { Geolocation } = await importGeolocation();
            await Geolocation?.requestPermissions();
          })(),
          (async () => {
            const { Camera } = await importCamera();
            await Camera?.requestPermissions({ permissions: ["camera", "photos"] });
          })(),
          (async () => {
            const { PushNotifications } = await importPushNotifications();
            if (!PushNotifications) return;
            const res = await PushNotifications.requestPermissions();
            if (res?.receive === "granted") await PushNotifications.register();
          })(),
          (async () => {
            const { LocalNotifications } = await importLocalNotifications();
            await LocalNotifications?.requestPermissions();
          })(),
        ]);
      }
    } finally {
      setRequesting(false);
      finish();
    }
  }, [requesting, finish]);

  if (!ready) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center"
        style={{ backgroundColor: BG_DARK }}
      >
        <Loader2 size={26} className="animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden"
      style={{ backgroundColor: BG_DARK }}
    >
      {/* ── 슬라이드 트랙 ── */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide) => (
            <SlideView
              key={slide.key}
              slide={slide}
              imageFailed={!!imgFailed[slide.key]}
              onImageError={() => setImgFailed((prev) => ({ ...prev, [slide.key]: true }))}
            >
              {slide.key === "permissions" && <PermissionList />}
            </SlideView>
          ))}
        </div>
      </div>

      {/* ── 하단 컨트롤 ── */}
      <div className="pb-safe shrink-0 px-6 pb-7 pt-4">
        {/* 인디케이터 */}
        <div className="mb-5 flex items-center justify-center gap-2" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.key}
              className="h-[6px] rounded-full transition-all duration-300"
              style={{
                width: i === index ? 22 : 6,
                backgroundColor: i === index ? BRAND : "rgba(255,255,255,0.22)",
              }}
            />
          ))}
        </div>

        {isLast ? (
          <button
            type="button"
            onClick={requestPermissions}
            disabled={requesting}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-[#161210] transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: BRAND }}
          >
            {requesting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                권한 확인 중...
              </>
            ) : (
              <>
                시작하기
                <ChevronRight size={18} strokeWidth={2.4} />
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={finish}
              className="h-[54px] shrink-0 rounded-2xl px-5 text-[14px] font-medium text-white/45 transition-colors hover:text-white/70"
            >
              건너뛰기
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, SLIDES.length - 1))}
              className="flex h-[54px] flex-1 items-center justify-center gap-1.5 rounded-2xl text-[15px] font-bold text-[#161210] transition-transform active:scale-[0.98]"
              style={{ backgroundColor: BRAND }}
            >
              다음
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 한 장의 슬라이드 — 배경 이미지(또는 그라디언트) + 아이콘 + 제목 + 설명 */
function SlideView({
  slide,
  imageFailed,
  onImageError,
  children,
}: {
  slide: Slide;
  imageFailed: boolean;
  onImageError: () => void;
  children?: React.ReactNode;
}) {
  const Icon = slide.icon;
  return (
    <section className="flex h-full w-full shrink-0 flex-col">
      {/* 배경 이미지 영역 (이미지 교체 지점) */}
      <div
        className="relative w-full shrink-0 basis-[46%] overflow-hidden"
        style={{ background: slide.fallback }}
      >
        {!imageFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image}
            alt=""
            onError={onImageError}
            className="h-full w-full object-cover"
          />
        )}
        {/* 하단 페이드 — 이미지와 본문을 자연스럽게 이어준다 */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{ background: `linear-gradient(to bottom, transparent, ${BG_DARK})` }}
        />
      </div>

      {/* 본문 */}
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-7 pt-1 text-center">
        <span
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgba(234,179,8,0.14)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Icon size={26} strokeWidth={1.7} style={{ color: BRAND }} />
        </span>
        <h1 className="whitespace-pre-line text-[24px] font-bold leading-[1.32] text-white">
          {slide.title}
        </h1>
        <p className="mt-3.5 whitespace-pre-line text-[13.5px] leading-[1.65] text-white/55">
          {slide.desc}
        </p>
        {children}
      </div>
    </section>
  );
}

/** 마지막 슬라이드의 권한 목록 안내 */
function PermissionList() {
  return (
    <ul className="mt-6 w-full space-y-2.5 text-left">
      {PERMISSIONS.map((p) => {
        const Icon = p.icon;
        return (
          <li
            key={p.key}
            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <span className="mt-0.5 shrink-0" style={{ color: BRAND }}>
              <Icon size={18} strokeWidth={1.7} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-white/90">{p.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-white/45">
                {p.desc}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
