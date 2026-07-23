"use client";
/**
 * 입낚볼 연동 UI
 * - BallLinkSection: 측정 페이지 하단 "입낚볼 연동" 카드 (NFC 태그로 볼 등록)
 * - MyBallManager: 마이페이지 "내 입낚볼 관리" 섹션 (연결된 볼 목록 / 등록 / 히스토리)
 * - Web NFC(NDEFReader)는 Android Chrome 에서만 지원 — 미지원 기기는 안내 문구 노출
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Nfc, CircleDashed, History, Plus, Loader2, Check, ChevronRight, CircleHelp, Ruler, ShoppingBag, Camera, Crosshair, Download, Image as ImageIcon, Smartphone } from "lucide-react";
import { useToast } from "@/components/Toast";
import NfcService from "@/services/NfcService";
import { Sheet } from "@/components/ui";

const NFC_UNSUPPORTED_MSG = "이 기기에서는 NFC를 지원하지 않습니다. Android Chrome에서 이용해 주세요.";
const NFC_READ_TIMEOUT_MS = 20000;

type Ball = { id: string; ballId: string; linkedAt: string };

/* ── 공용: API 헬퍼 ── */
async function fetchBalls(): Promise<Ball[] | null> {
  try {
    const res = await fetch("/api/balls", { cache: "no-store" });
    if (!res.ok) return null; // 401(비로그인) 포함
    const data = await res.json();
    return Array.isArray(data?.balls) ? data.balls : [];
  } catch {
    return null;
  }
}

async function registerBallApi(ballId: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch("/api/balls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ballId }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** NFC 읽기 (무한 대기 방지 타임아웃 포함) */
async function readBallIdWithTimeout(): Promise<string | null> {
  return Promise.race<string | null>([
    NfcService.readBallId(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), NFC_READ_TIMEOUT_MS)),
  ]);
}

/** NFC 태그 → 등록까지 한 번에 처리하는 공용 훅 */
function useBallLink() {
  const toast = useToast();
  const [supported, setSupported] = useState<boolean | null>(null); // null = 확인 중
  const [balls, setBalls] = useState<Ball[] | null>(null);
  const [reading, setReading] = useState(false);

  const refresh = useCallback(async () => {
    setBalls(await fetchBalls());
  }, []);

  useEffect(() => {
    let alive = true;
    NfcService.isSupported().then((v) => { if (alive) setSupported(v); });
    fetchBalls().then((list) => { if (alive) setBalls(list); });
    return () => { alive = false; };
  }, []);

  const tagAndRegister = useCallback(async () => {
    if (supported === false) {
      toast(NFC_UNSUPPORTED_MSG, "info");
      return;
    }
    if (reading) return;
    setReading(true);
    toast("입낚볼에 휴대폰 뒷면을 가까이 대주세요", "info");
    try {
      const ballId = await readBallIdWithTimeout();
      if (!ballId) {
        toast("NFC 태그를 읽지 못했어요. 다시 시도해 주세요.", "error");
        return;
      }
      const { ok, status } = await registerBallApi(ballId);
      if (!ok) {
        toast(status === 401 ? "로그인 후 이용할 수 있어요." : "볼 등록에 실패했어요. 잠시 후 다시 시도해 주세요.", "error");
        return;
      }
      toast(`입낚볼(${ballId}) 연동 완료`, "success");
      await refresh();
    } finally {
      setReading(false);
    }
  }, [supported, reading, toast, refresh]);

  return { supported, balls, reading, tagAndRegister };
}

/* ── 측정 페이지: 입낚볼 연동 카드 ── */
export function BallLinkSection() {
  const { supported, balls, reading, tagAndRegister } = useBallLink();
  const linked = balls && balls.length > 0 ? balls[0] : null;
  const [guideOpen, setGuideOpen] = useState(false);
  const [linkGuideOpen, setLinkGuideOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [ballExampleOpen, setBallExampleOpen] = useState(false);

  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
            (linked ? "bg-orange-500/15 text-orange-500" : "bg-aqua-500/15 text-aqua-400")
          }
        >
          <CircleDashed size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-navy-900">입낚볼 연동</p>
          <p className="truncate text-[11px] text-navy-300">
            볼 ID: {linked ? linked.ballId : "미연결"}
          </p>
        </div>
        {linked && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-500">
            <Check size={11} strokeWidth={2.5} /> 연결됨
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={tagAndRegister}
        disabled={reading}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
      >
        {reading ? <Loader2 size={16} className="animate-spin" /> : <Nfc size={16} strokeWidth={1.9} />}
        {reading ? "볼을 태그해 주세요..." : "볼에 NFC 태그하기"}
      </button>
      {supported === false && (
        <p className="mt-2 text-center text-[11px] text-navy-300">{NFC_UNSUPPORTED_MSG}</p>
      )}
      <button
        type="button"
        onClick={() => setLinkGuideOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-[#1e1e1e] py-2.5 text-[12px] font-semibold text-navy-500 transition-colors hover:bg-navy-50 active:scale-[0.98]"
      >
        <CircleHelp size={15} strokeWidth={2} />
        입낚볼 연동방법 보기
      </button>

      <div className="mt-4 border-t border-navy-100 pt-4">
        <Link
          href="/me?ipnakBallPurchase=1"
          className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-3 text-[13px] font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
        >
          <ShoppingBag size={16} strokeWidth={2} />
          입낚볼 구매하러 가기
        </Link>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-aqua-500/30 bg-aqua-500/10 py-3 text-[13px] font-bold text-aqua-300 transition-colors hover:bg-aqua-500/15 active:scale-[0.98]"
        >
          <CircleHelp size={16} strokeWidth={2} />
          입낚볼 없이도 AI 측정이 가능해요
        </button>
      </div>

      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} title="입낚볼 없이 AI 측정하는 방법" size="md">
        <div className="space-y-4 pb-2">
          <div className="rounded-2xl border border-aqua-500/25 bg-aqua-500/10 p-3.5">
            <p className="text-[14px] font-bold text-aqua-300">사진 기록과 머리·꼬리 지정은 입낚볼 없이도 가능해요.</p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">AI 측정 화면에서 사진을 선택한 뒤 물고기의 머리와 꼬리 끝을 지정해 기록할 수 있어요.</p>
          </div>

          <GuideStep icon={<Camera size={18} />} title="1. 물고기를 위에서 선명하게 촬영해요">
            물고기 전체가 프레임에 들어오도록 하고, 몸이 휘지 않게 평평한 곳에 놓아 주세요. 그림자와 반사는 줄일수록 좋아요.
          </GuideStep>
          <GuideStep icon={<Ruler size={18} />} title="2. 가능한 경우 기준물을 함께 넣어 주세요">
            입낚볼이 없다면 아래의 40mm 인쇄 기준물을 출력해 물고기 옆에 평평하게 놓아 주세요. 반드시 물고기와 인쇄 기준물이 한 장의 사진에 함께 보여야 해요.
          </GuideStep>
          <GuideStep icon={<Crosshair size={18} />} title="3. AI 측정에서 머리와 꼬리 끝을 지정해요">
            사진을 불러온 뒤 입 끝과 꼬리 끝을 정확히 탭해 주세요. 입낚볼 미연동 상태에서는 사진 기록과 측정 지점 저장을 우선 제공해요.
          </GuideStep>

          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-3.5">
            <p className="text-[13px] font-bold text-orange-300">40mm 인쇄 기준물 사용 안내</p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">인쇄할 때는 크기 조정 없이 100%로 출력해 주세요. A4 한 장에 40mm 주황색 입낚 로고가 9개 배열됩니다. 인쇄물은 평평한 종이라 카메라와 같은 높이에 놓아야 해요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href="/ipnak-ball-40mm-logo-print-sheet-a4.svg"
                download="ipnak-ball-40mm-logo-print-sheet-a4.svg"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-2 py-2.5 text-[12px] font-bold text-white active:scale-[0.98]"
              >
                <Download size={15} /> A4 9개 인쇄물
              </a>
              <button
                type="button"
                onClick={() => setExampleOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-aqua-500/35 bg-aqua-500/10 px-2 py-2.5 text-[12px] font-bold text-aqua-300 active:scale-[0.98]"
              >
                <ImageIcon size={15} /> 예시보기
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-navy-50 px-3.5 py-3 text-[12px] leading-relaxed text-navy-400">
            인쇄물은 물고기 주변의 위·아래·대각선 등 사진 안 어느 위치에 있어도 인식할 수 있어요. 단, 인쇄물과 물고기의 수직 높이가 다르면 사진상 크기가 달라질 수 있으니 가능한 한 같은 평면에 놓아 주세요. 입체형 입낚볼도 사진 안에 선명하게 보이면 물고기 주변 어느 위치에서든 사용할 수 있어요.
          </div>
        </div>
      </Sheet>

      <Sheet open={linkGuideOpen} onClose={() => setLinkGuideOpen(false)} title="입낚볼 연동 방법" size="md">
        <div className="space-y-4 pb-2">
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-3.5">
            <p className="text-[14px] font-bold text-orange-300">입낚볼 NFC 태그로 계정을 연결해요.</p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">연동 후에는 내 입낚볼 ID와 관련 측정 기록을 앱에서 확인할 수 있어요.</p>
          </div>
          <GuideStep icon={<Nfc size={18} />} title="1. NFC 태그하기를 눌러 주세요">
            이 페이지의 ‘볼에 NFC 태그하기’ 버튼을 누른 뒤, 휴대전화의 NFC 기능을 켜 주세요.
          </GuideStep>
          <GuideStep icon={<Smartphone size={18} />} title="2. 휴대전화 뒷면을 입낚볼에 가까이 대세요">
            태그가 읽힐 때까지 휴대전화를 잠시 움직이지 말고 가까이 유지해 주세요. 읽기가 끝나면 연결 완료 메시지가 표시돼요.
          </GuideStep>
          <GuideStep icon={<Check size={18} />} title="3. 연결 상태를 확인해요">
            카드에 볼 ID와 ‘연결됨’ 표시가 나타나면 완료예요. NFC는 Android Chrome 등 지원되는 환경에서 이용할 수 있어요.
          </GuideStep>
          <div className="rounded-xl bg-navy-50 px-3.5 py-3 text-[12px] leading-relaxed text-navy-400">
            태그가 인식되지 않으면 휴대전화 케이스를 벗기거나 NFC 위치를 조금씩 바꿔 다시 시도해 주세요.
          </div>
          <button
            type="button"
            onClick={() => setBallExampleOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/35 bg-orange-500/10 py-3 text-[13px] font-bold text-orange-300 active:scale-[0.98]"
          >
            <ImageIcon size={16} /> 입낚볼 사용 예시보기
          </button>
        </div>
      </Sheet>

      <Sheet open={exampleOpen} onClose={() => setExampleOpen(false)} title="인쇄 기준물 촬영 예시" size="lg">
        <div className="space-y-3 pb-2">
          <div className="relative">
            <img
              src="/ipnak-print-reference-bass-example-v2.png"
              alt="배스와 40mm 입낚 로고 인쇄물을 평평하게 놓고 위에서 촬영한 예시"
              className="w-full rounded-2xl object-cover ring-1 ring-white/10"
            />
            <div aria-hidden>
              <LogoPrintMarker className="absolute left-[8%] top-[14%]" />
              <LogoPrintMarker className="absolute left-[57%] top-[8%]" />
              <LogoPrintMarker className="absolute right-[7%] bottom-[12%]" />
            </div>
          </div>
          <div className="rounded-xl bg-aqua-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-navy-400">
            배스와 40mm 입낚 로고 인쇄물을 같은 평면에 놓고, 두 대상이 모두 프레임 안에 들어오도록 수직에 가깝게 촬영한 예시입니다. 점선 로고는 인쇄물을 놓아도 되는 예시 위치예요. 위·아래·대각선 어디든 프레임 안에 선명하게 잡히면 측정에 사용할 수 있지만, 높이가 다르면 정확도가 떨어질 수 있어요.
          </div>
        </div>
      </Sheet>

      <Sheet open={ballExampleOpen} onClose={() => setBallExampleOpen(false)} title="입낚볼 사용 예시" size="lg">
        <div className="space-y-4 pb-2">
          <UsageExample
            src="/ipnak-ball-handheld-bass-example.png"
            title="손가락 고리에 입낚볼을 걸고 촬영"
            desc="배스를 들고 촬영할 때도 입낚볼이 물고기와 한 프레임에 선명하게 보이도록 손가락 고리를 이용해 가까이 배치해 주세요."
          />
          <UsageExample
            src="/ipnak-ball-flat-bass-example.png"
            title="배스를 바닥에 놓고 주변에 입낚볼 배치"
            desc="배스와 입낚볼을 가능한 한 같은 평면에 놓고 위에서 촬영하면 가장 안정적으로 길이를 계산할 수 있어요."
          />
        </div>
      </Sheet>
    </div>
  );
}

function LogoPrintMarker({ className }: { className?: string }) {
  return (
    <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-orange-400 bg-orange-500/20 opacity-60 ${className || ""}`}>
      <svg viewBox="60 32 96 132" className="h-7 w-7" fill="none">
        <path d="M92 52V118C92 150 138 150 138 116C138 98 118 96 110 110" stroke="#fb923c" strokeWidth="13" strokeLinecap="round" />
        <path d="M74 62L92 46L110 62" stroke="#fb923c" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="92" cy="46" r="5" fill="#fb923c" />
      </svg>
    </span>
  );
}

function UsageExample({ src, title, desc }: { src: string; title: string; desc: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <img src={src} alt={title} className="aspect-[4/3] w-full object-cover" />
      <div className="p-3.5">
        <p className="text-[13px] font-bold text-navy-800">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-navy-400">{desc}</p>
      </div>
    </div>
  );
}

function GuideStep({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-aqua-400">{icon}</span>
      <div>
        <p className="text-[13px] font-bold text-navy-800">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-navy-400">{children}</p>
      </div>
    </div>
  );
}

/* ── 마이페이지: 내 입낚볼 관리 ── */
export function MyBallManager() {
  const { supported, balls, reading, tagAndRegister } = useBallLink();

  function register() {
    tagAndRegister();
  }

  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
          <Nfc size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-navy-900">내 입낚볼 관리</p>
          <p className="text-[11px] text-navy-300">NFC 태그로 내 볼을 등록하고 기록을 모아보세요</p>
        </div>
      </div>

      {/* 연결된 볼 목록 */}
      {balls && balls.length > 0 ? (
        <ul className="space-y-2">
          {balls.map((b) => (
            <li key={b.id} className="flex items-center gap-2.5 rounded-2xl border border-navy-100 bg-surface-100 px-3.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
                <CircleDashed size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-navy-900">{b.ballId}</p>
                <p className="text-[11px] text-navy-300">
                  연동일 {String(b.linkedAt).slice(0, 10)}
                </p>
              </div>
              <Link
                href={`/diary?ballId=${encodeURIComponent(b.ballId)}`}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600 transition-colors hover:bg-navy-100"
              >
                기록 보기 <ChevronRight size={12} strokeWidth={2.2} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-navy-200 px-4 py-5 text-center">
          <p className="text-[13px] font-semibold text-navy-500">연결된 입낚볼이 없어요</p>
          <p className="mt-0.5 text-[11px] text-navy-300">아래 버튼을 누르고 입낚볼에 휴대폰을 태그해 주세요</p>
        </div>
      )}

      {/* 볼 등록: NFC 지원 기기에서만 활성화, 미지원 기기는 수동 입력 안내 */}
      {supported === false ? (
        <div className="mt-3">
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-navy-50 py-2.5 text-[13px] font-semibold text-navy-300 opacity-60"
          >
            <Nfc size={16} strokeWidth={1.9} />
            NFC 미지원 기기
          </button>
          <p className="mt-2 text-center text-[11px] text-navy-300">
            iPhone 등 NFC 미지원 환경에서는 아래 "볼 ID 직접 입력"을 이용해 주세요.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={register}
          disabled={supported === null || reading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
        >
          {reading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.2} />}
          {reading ? "볼을 태그해 주세요..." : "볼 등록 (NFC 태그)"}
        </button>
      )}

      {/* 볼 히스토리 */}
      <div className="mt-3 border-t border-navy-100 pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-navy-500">
          <History size={14} strokeWidth={1.9} /> 볼 히스토리
        </p>
        {balls && balls.length > 0 ? (
          <div className="space-y-1">
            {balls.map((b) => (
              <Link
                key={b.id}
                href={`/diary?ballId=${encodeURIComponent(b.ballId)}`}
                className="flex items-center justify-between rounded-xl px-2 py-1.5 text-[12px] font-semibold text-navy-600 transition-colors hover:bg-navy-50"
              >
                <span className="truncate">{b.ballId} 측정 기록 보기</span>
                <ChevronRight size={13} strokeWidth={2.2} className="shrink-0 text-navy-300" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-navy-300">
            이 볼로 찍은 측정 사진들이 여기에 모여요. 아직 기록이 없어요.
          </p>
        )}
      </div>
    </div>
  );
}
