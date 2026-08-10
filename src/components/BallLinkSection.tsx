"use client";
/**
 * 입낚볼 / 입낚키링 연동 UI
 * - BallLinkSection: 측정 페이지 하단 "입낚볼 연동" 카드 (NFC 태그로 볼 등록)
 * - KeyringLinkSection: 측정 페이지 하단 "입낚키링 연동" 카드 (NFC 태그로 키링 등록)
 * - MyBallManager: 마이페이지 "내 입낚볼 관리" 섹션 (연결된 볼 목록 / 등록 / 히스토리)
 * - MyKeyringManager: 마이페이지 "내 입낚키링 관리" 섹션 (연결된 키링 목록 / 등록 / 해제)
 * - Web NFC(NDEFReader)는 Android Chrome 에서만 지원 — 미지원 기기는 안내 문구 노출
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nfc, CircleDashed, History, Plus, Loader2, Check, ChevronRight, CircleHelp, Ruler, Camera, Crosshair, Download, Image as ImageIcon, Smartphone, Unlink, KeyRound, ChevronDown, ChevronUp, Hand } from "lucide-react";
import { useToast } from "@/components/Toast";
import NfcService from "@/services/NfcService";
import { IpnakBallPurchase } from "@/components/IpnakBallPurchase";
import { useUser } from "@/lib/userContext";
import { Sheet } from "@/components/ui";
import { isIOSDevice } from "@/lib/device";
import { ID_SAMPLE, ID_FORMAT_LABEL, LEGACY_ID_SAMPLE } from "@/lib/nfcTag";

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

async function registerBallApi(ballId: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch("/api/balls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ballId }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, error: data?.error };
  } catch {
    return { ok: false, status: 0 };
  }
}



/* ── 공용: 입낚키링 API 헬퍼 (볼과 동일 구조, 엔드포인트만 /api/keyrings) ── */
type Keyring = { id: string; keyringId: string; linkedAt: string };

async function fetchKeyrings(): Promise<Keyring[] | null> {
  try {
    const res = await fetch("/api/keyrings", { cache: "no-store" });
    if (!res.ok) return null; // 401(비로그인) 포함
    const data = await res.json();
    return Array.isArray(data?.keyrings) ? data.keyrings : [];
  } catch {
    return null;
  }
}

async function registerKeyringApi(keyringId: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch("/api/keyrings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyringId }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, error: data?.error };
  } catch {
    return { ok: false, status: 0 };
  }
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
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), NFC_READ_TIMEOUT_MS);
    try {
      const ballId = await NfcService.readBallId(abortController.signal);
      if (!ballId) {
        toast("NFC 태그를 읽지 못했어요. 다시 시도해 주세요.", "error");
        return;
      }
      const { ok, status, error } = await registerBallApi(ballId);
      if (!ok) {
        toast(
          status === 401
            ? "로그인 후 이용할 수 있어요."
            : (error || "볼 등록에 실패했어요. 잠시 후 다시 시도해 주세요."),
          "error"
        );
        return;
      }
      toast(`입낚볼(${ballId}) 연동 완료`, "success");
      await refresh();
    } finally {
      clearTimeout(timeoutId);
      abortController.abort(); // 정상 완료 시에도 NFC 스캔 정리
      setReading(false);
    }
  }, [supported, reading, toast, refresh]);

  return { supported, balls, reading, tagAndRegister, refresh };
}

/** 입낚키링 전용 — NFC 태그 → 등록까지 한 번에 처리하는 공용 훅 (볼 훅과 동일 구조) */
function useKeyringLink() {
  const toast = useToast();
  const [supported, setSupported] = useState<boolean | null>(null); // null = 확인 중
  const [keyrings, setKeyrings] = useState<Keyring[] | null>(null);
  const [reading, setReading] = useState(false);

  const refresh = useCallback(async () => {
    setKeyrings(await fetchKeyrings());
  }, []);

  useEffect(() => {
    let alive = true;
    NfcService.isSupported().then((v) => { if (alive) setSupported(v); });
    fetchKeyrings().then((list) => { if (alive) setKeyrings(list); });
    return () => { alive = false; };
  }, []);

  const tagAndRegister = useCallback(async () => {
    if (supported === false) {
      toast(NFC_UNSUPPORTED_MSG, "info");
      return;
    }
    if (reading) return;
    setReading(true);
    toast("키링을 평평한 바닥에 놓고 휴대폰을 키링 위에 가까이 대주세요", "info");
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), NFC_READ_TIMEOUT_MS);
    try {
      // NFC 태그에서 읽는 문자열은 볼/키링 공통 (NDEF 텍스트 레코드)
      const keyringId = await NfcService.readBallId(abortController.signal);
      if (!keyringId) {
        toast("NFC 태그를 읽지 못했어요. 다시 시도해 주세요.", "error");
        return;
      }
      const { ok, status, error } = await registerKeyringApi(keyringId);
      if (!ok) {
        toast(
          status === 401
            ? "로그인 후 이용할 수 있어요."
            : (error || "키링 등록에 실패했어요. 잠시 후 다시 시도해 주세요."),
          "error"
        );
        return;
      }
      toast(`입낚키링(${keyringId}) 연동 완료`, "success");
      await refresh();
    } finally {
      clearTimeout(timeoutId);
      abortController.abort(); // 정상 완료 시에도 NFC 스캔 정리
      setReading(false);
    }
  }, [supported, reading, toast, refresh]);

  return { supported, keyrings, reading, tagAndRegister, refresh };
}

/** 아이폰인지 확인 (SSR 에서는 false — 첫 렌더 후 useEffect 로 확정) */
function useIsIOS() {
  const [ios, setIos] = useState(false);
  useEffect(() => { setIos(isIOSDevice()); }, []);
  return ios;
}

/**
 * 아이폰 전용 연동 안내 (측정 페이지 볼·키링 카드 공용)
 *
 * 아이폰은 앱 안에서 NFC 를 직접 읽지 못한다. 대신 태그에 URL 이 적혀 있으면
 * 폰에 갖다 대는 순간 화면 상단에 배너가 뜨고, 그 배너를 탭하면 앱/웹이 열린다.
 * 그래서 "직접 입력"을 전면에 두는 대신 태그 사용법을 먼저 보여주고,
 * 수동 입력은 fallback 으로 접어 둔다.
 */
function IosTagPrompt({
  kind, manualId, onManualIdChange, registering, onRegister, onOpenGuide,
}: {
  kind: "ball" | "keyring";
  manualId: string;
  onManualIdChange: (v: string) => void;
  registering: boolean;
  onRegister: () => void;
  onOpenGuide: () => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const label = kind === "ball" ? "입낚볼" : "입낚키링";
  const shortLabel = kind === "ball" ? "볼" : "키링";

  return (
    <div className="space-y-2">
      {/* 태그 안내 — 아이폰의 기본 동작(상단 배너)을 그대로 설명한다 */}
      <div className="rounded-2xl border border-aqua-500/25 bg-aqua-500/10 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua-500/15 text-aqua-300">
            <Nfc size={17} strokeWidth={2} />
            <span className="absolute inset-0 animate-ping rounded-full bg-aqua-400/20" />
          </span>
          <p className="text-[13px] font-bold text-aqua-200">
            {shortLabel}을 아이폰에 가져다 대세요
          </p>
        </div>
        <ol className="mt-2.5 space-y-1.5 pl-[46px] text-[12px] leading-relaxed text-navy-400">
          <li className="flex gap-1.5">
            <Hand size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-aqua-400" />
            <span>{label}을 아이폰 <b className="font-semibold text-navy-500">윗부분</b>에 가까이 대세요.</span>
          </li>
          <li className="flex gap-1.5">
            <Smartphone size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-aqua-400" />
            <span>화면 상단에 뜨는 <b className="font-semibold text-navy-500">입낚 배너를 탭</b>하세요.</span>
          </li>
          <li className="flex gap-1.5">
            <Check size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-aqua-400" />
            <span>연동과 측정 화면이 한 번에 열려요.</span>
          </li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onOpenGuide}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-[#162538] py-2 text-[12px] font-semibold text-navy-500 transition-colors hover:bg-navy-50 active:scale-[0.98]"
      >
        <CircleHelp size={15} strokeWidth={2} />
        입낚볼/입낚키링 연동 방법
      </button>

      {/* fallback — 태그가 안 될 때를 위한 수동 입력 (기본은 접힘) */}
      <div className="overflow-hidden rounded-[14px] border border-navy-100">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-navy-50"
        >
          <span className="text-[12px] font-semibold text-navy-400">직접 입력하기</span>
          {manualOpen
            ? <ChevronUp size={14} className="shrink-0 text-navy-300" />
            : <ChevronDown size={14} className="shrink-0 text-navy-300" />}
        </button>
        {manualOpen && (
          <div className="space-y-2 border-t border-navy-100 px-3.5 pb-3.5 pt-3">
            <p className="text-[12px] text-navy-400">박스에 표시된 아이디를 직접 입력하세요.</p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(e) => onManualIdChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onRegister()}
                placeholder={`예: ${ID_SAMPLE[kind]}`}
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-navy-800 placeholder-navy-300 outline-none focus:border-orange-400/50"
              />
              <button
                type="button"
                onClick={onRegister}
                disabled={!manualId.trim() || registering}
                className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors active:bg-orange-600 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : "등록"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 측정 페이지: 입낚볼 연동 카드 ── */
export function BallLinkSection({ ballEnabled = true, keyringEnabled = false }: { ballEnabled?: boolean; keyringEnabled?: boolean } = {}) {
  const router = useRouter();
  const { supported, balls, reading, tagAndRegister, refresh } = useBallLink();
  const toast = useToast();
  const isIOS = useIsIOS();
  const linked = balls && balls.length > 0 ? balls[0] : null;
  const [guideOpen, setGuideOpen] = useState(false);
  const [linkGuideOpen, setLinkGuideOpen] = useState(false);
  const [linkGuideTab, setLinkGuideTab] = useState<"android" | "iphone">("android");
  const [exampleOpen, setExampleOpen] = useState(false);
  const [ballExampleOpen, setBallExampleOpen] = useState(false);
  const [manualId, setManualId] = useState("");
  const [registering, setRegistering] = useState(false);
  const currentUser = useUser();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [ballPrice, setBallPrice] = useState<number | null>(null);

  async function registerManual() {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    setRegistering(true);
    try {
      const { ok, status, error } = await registerBallApi(trimmed);
      if (ok) {
        toast(`입낚볼(${trimmed}) 연동 완료`, "success");
        setManualId("");
        await refresh();
      } else {
        toast(status === 401 ? "로그인 후 이용할 수 있어요." : (error || "볼 ID를 확인해 주세요."), "error");
      }
    } finally {
      setRegistering(false);
    }
  }

  useEffect(() => {
    fetch("/api/shop/ipnak-ball/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const first = data?.products?.[0];
        if (first?.price) setBallPrice(Number(first.price));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-3">
      <div className="mb-2 flex items-center gap-2.5">
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
          <p className="truncate text-[12px] text-navy-300">
            볼 ID: {linked ? linked.ballId : "미연결"}
          </p>
        </div>
        {linked && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-500">
            <Check size={11} strokeWidth={2.5} /> 연결됨
          </span>
        )}
      </div>
      {/* 볼이 연동되지 않은 경우에만 표시 (로딩 중 플래시 방지: balls !== null 체크) */}
      {balls !== null && !linked && (
        supported === false ? (
          isIOS ? (
            /* 아이폰 — 태그 → 상단 배너 탭 안내 (수동 입력은 접어서 fallback 유지) */
            <IosTagPrompt
              kind="ball"
              manualId={manualId}
              onManualIdChange={setManualId}
              registering={registering}
              onRegister={registerManual}
              onOpenGuide={() => { setLinkGuideTab("iphone"); setLinkGuideOpen(true); }}
            />
          ) : (
          /* NFC 미지원 데스크톱 브라우저 등 — ID 직접 입력 */
          <div className="space-y-2">
            <p className="pl-[46px] text-left text-[13px] text-navy-400">
              박스에 표시된 아이디를 직접 입력하세요.
            </p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registerManual()}
                placeholder={`예: ${ID_SAMPLE.ball}`}
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-navy-800 placeholder-navy-300 outline-none focus:border-orange-400/50"
              />
              <button
                type="button"
                onClick={registerManual}
                disabled={!manualId.trim() || registering}
                className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors active:bg-orange-600 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : "등록"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setLinkGuideTab("iphone"); setLinkGuideOpen(true); }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-[#162538] py-2 text-[12px] font-semibold text-navy-500 transition-colors hover:bg-navy-50 active:scale-[0.98]"
            >
              <CircleHelp size={15} strokeWidth={2} />
              입낚볼/입낚키링 연동 방법
            </button>
          </div>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={tagAndRegister}
              disabled={supported === null || reading}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
            >
              {reading ? <Loader2 size={16} className="animate-spin" /> : <Nfc size={16} strokeWidth={1.9} />}
              {reading ? "볼을 태그해 주세요..." : "볼에 NFC 태그하기"}
            </button>
            <button
              type="button"
              onClick={() => { setLinkGuideTab("android"); setLinkGuideOpen(true); }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-[#162538] py-2 text-[12px] font-semibold text-navy-500 transition-colors hover:bg-navy-50 active:scale-[0.98]"
            >
              <CircleHelp size={15} strokeWidth={2} />
              입낚볼/입낚키링 연동 방법
            </button>
          </>
        )
      )}

      {/* 볼 히스토리 — 연결된 볼이 있을 때 */}
      {balls !== null && balls.length > 0 && (
        <div className="mt-3 border-t border-navy-100 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-navy-500">
            <History size={14} strokeWidth={1.9} /> 볼 히스토리
          </p>
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
        </div>
      )}

      <div className="mt-3 border-t border-navy-100 pt-3">
        <button
          type="button"
          onClick={() => setPurchaseOpen(true)}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2.5 text-[13px] font-bold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          입낚볼 구매하러 가기
        </button>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-aqua-500/30 bg-aqua-500/10 py-2.5 text-[13px] font-bold text-aqua-300 transition-colors hover:bg-aqua-500/15 active:scale-[0.98]"
        >
          <CircleHelp size={16} strokeWidth={2} />
          입낚볼 없이도 AI 측정이 가능해요
          <span className="rounded-lg bg-aqua-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-aqua-300">보기</span>
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
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">인쇄할 때는 크기 조정 없이 100%로 출력해 주세요. A4 한 장에 40mm 진한 노랑색 입낚 로고가 9개 배열됩니다. 인쇄물은 평평한 종이라 카메라와 같은 높이에 놓아야 해요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => router.push("/print/ball-sheet")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-2 py-2.5 text-[12px] font-bold text-gray-900 active:scale-[0.98]"
              >
                <Download size={15} /> 입낚볼 이미지 인쇄
              </button>
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

      <IpnakLinkGuideSheet
        open={linkGuideOpen}
        onClose={() => setLinkGuideOpen(false)}
        defaultTab={linkGuideTab}
        defaultProduct="ball"
        ballEnabled={ballEnabled}
        keyringEnabled={keyringEnabled}
        onOpenBallExample={() => setBallExampleOpen(true)}
      />

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

      <Sheet open={ballExampleOpen} onClose={() => setBallExampleOpen(false)} title="입낚볼/입낚키링 사용 예시" size="diary">
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
          <UsageExample
            src="/ipnak-keyring-usage-example.png"
            title="입낚키링을 물고기 주변 어디든 놓고 촬영"
            desc="입낚키링은 고리 없이 디스크만 물고기 옆 바닥에 놓으면 돼요. 프레임 안 어느 위치에 있어도 인식할 수 있어요."
          />
        </div>
      </Sheet>
      <IpnakBallPurchase
        price={ballPrice ?? 0}
        buyer={{ name: currentUser?.nickname ?? "", email: currentUser?.email ?? "" }}
        hideCard
        triggerOpen={purchaseOpen}
        onOpened={() => setPurchaseOpen(false)}
      />
    </div>
  );
}

function LogoPrintMarker({ className }: { className?: string }) {
  return (
    <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-orange-400 bg-orange-500/20 opacity-60 ${className || ""}`}>
      <svg viewBox="60 32 96 132" className="h-7 w-7" fill="none">
        <path d="M92 52V118C92 150 138 150 138 116C138 98 118 96 110 110" stroke="#facc15" strokeWidth="13" strokeLinecap="round" />
        <path d="M74 62L92 46L110 62" stroke="#facc15" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="92" cy="46" r="5" fill="#facc15" />
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

/* ─────────────────────────────────────────────────────────────
   연동 방법 안내 시트
   1차 탭: 입낚볼 | 입낚키링   (서비스 스위치가 꺼진 상품은 탭에서 제외)
   2차 탭: 안드로이드 | 아이폰 (기존 내용 그대로 유지)
───────────────────────────────────────────────────────────── */
type GuideProduct = "ball" | "keyring";

export function IpnakLinkGuideSheet({
  open, onClose, defaultTab, defaultProduct = "ball",
  ballEnabled = true, keyringEnabled = false, onOpenBallExample,
}: {
  open: boolean;
  onClose: () => void;
  defaultTab: "android" | "iphone";
  defaultProduct?: GuideProduct;
  ballEnabled?: boolean;
  keyringEnabled?: boolean;
  onOpenBallExample?: () => void;
}) {
  const [product, setProduct] = useState<GuideProduct>(defaultProduct);
  const [tab, setTab] = useState<"android" | "iphone">(defaultTab);

  // 시트를 열 때마다 호출한 쪽이 지정한 기기 탭으로 맞춘다 (NFC 미지원 → 아이폰).
  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  // 스위치가 꺼진 상품 탭이 선택돼 있으면 켜져 있는 쪽으로 보정한다.
  useEffect(() => {
    if (product === "ball" && !ballEnabled && keyringEnabled) setProduct("keyring");
    else if (product === "keyring" && !keyringEnabled && ballEnabled) setProduct("ball");
  }, [product, ballEnabled, keyringEnabled]);

  // 둘 다 꺼져 있으면 연동 방법 자체를 노출하지 않는다.
  if (!ballEnabled && !keyringEnabled) return null;

  const activeProduct: GuideProduct = ballEnabled && keyringEnabled ? product : (ballEnabled ? "ball" : "keyring");
  const label = activeProduct === "ball" ? "입낚볼" : "입낚키링";

  return (
    <Sheet open={open} onClose={onClose} title="입낚볼/입낚키링 연동 방법" size="md">
      {/* 1차 탭 — 상품 종류 (둘 다 켜져 있을 때만 표시) */}
      {ballEnabled && keyringEnabled && (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setProduct("ball")}
            className={
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-bold transition-colors " +
              (activeProduct === "ball"
                ? "border-orange-500 bg-orange-500 text-gray-900"
                : "border-navy-100 text-navy-400 hover:text-navy-600")
            }
          >
            <CircleDashed size={15} strokeWidth={2} />
            입낚볼
          </button>
          <button
            type="button"
            onClick={() => setProduct("keyring")}
            className={
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-bold transition-colors " +
              (activeProduct === "keyring"
                ? "border-orange-500 bg-orange-500 text-gray-900"
                : "border-navy-100 text-navy-400 hover:text-navy-600")
            }
          >
            <KeyRound size={15} strokeWidth={2} />
            입낚키링
          </button>
        </div>
      )}

      {/* 2차 탭 — 기기 종류 */}
      <div className="mb-4 flex rounded-xl bg-navy-50 p-1">
        <button
          type="button"
          onClick={() => setTab("android")}
          className={
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold transition-colors " +
            (tab === "android"
              ? "bg-[#1a2e44] text-orange-300 shadow"
              : "text-navy-400 hover:text-navy-600")
          }
        >
          <Nfc size={15} strokeWidth={2} />
          안드로이드
        </button>
        <button
          type="button"
          onClick={() => setTab("iphone")}
          className={
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold transition-colors " +
            (tab === "iphone"
              ? "bg-[#1a2e44] text-aqua-300 shadow"
              : "text-navy-400 hover:text-navy-600")
          }
        >
          <Smartphone size={15} strokeWidth={2} />
          아이폰
        </button>
      </div>

      {/* 안드로이드 탭 */}
      {tab === "android" && (
        <div className="space-y-4 pb-2">
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-3.5">
            <p className="text-[14px] font-bold text-orange-300">{label} NFC 태그로 계정을 연결해요.</p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">연동 후에는 내 {label} ID와 관련 측정 기록을 앱에서 확인할 수 있어요.</p>
          </div>
          <GuideStep icon={<Nfc size={18} />} title="1. NFC 태그하기를 눌러 주세요">
            {activeProduct === "ball"
              ? "이 페이지의 ‘볼에 NFC 태그하기’ 버튼을 누른 뒤, 휴대전화의 NFC 기능을 켜 주세요."
              : "이 페이지의 ‘키링에 NFC 태그하기’ 버튼을 누른 뒤, 휴대전화의 NFC 기능을 켜 주세요."}
          </GuideStep>
          <GuideStep icon={<Smartphone size={18} />} title={`2. 휴대전화 뒷면을 ${label}에 가까이 대세요`}>
            태그가 읽힐 때까지 휴대전화를 잠시 움직이지 말고 가까이 유지해 주세요. 읽기가 끝나면 연결 완료 메시지가 표시돼요.
          </GuideStep>
          <GuideStep icon={<Check size={18} />} title="3. 연결 상태를 확인해요">
            카드에 {activeProduct === "ball" ? "볼" : "키링"} ID와 ‘연결됨’ 표시가 나타나면 완료예요. NFC는 Android Chrome 등 지원되는 환경에서 이용할 수 있어요.
          </GuideStep>
          {activeProduct === "keyring" && <KeyringFlatNotice />}
          <div className="rounded-xl bg-navy-50 px-3.5 py-3 text-[12px] leading-relaxed text-navy-400">
            태그가 인식되지 않으면 휴대전화 케이스를 벗기거나 NFC 위치를 조금씩 바꿔 다시 시도해 주세요.
          </div>
          {onOpenBallExample && (
            <button
              type="button"
              onClick={onOpenBallExample}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/35 bg-orange-500/10 py-3 text-[13px] font-bold text-orange-300 active:scale-[0.98]"
            >
              <ImageIcon size={16} /> 입낚볼/입낚키링 사용 예시보기
            </button>
          )}
        </div>
      )}

      {/* 아이폰 탭 — 태그(상단 배너) 방식이 기본, 직접 입력은 fallback */}
      {tab === "iphone" && (
        <div className="space-y-4 pb-2">
          <div className="rounded-2xl border border-aqua-500/25 bg-aqua-500/10 p-3.5">
            <p className="text-[14px] font-bold text-aqua-300">{label}을 폰에 대면 상단에 배너가 떠요.</p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">
              아이폰은 앱을 켜지 않아도 NFC 태그를 읽어요. 배너를 탭하면 연동과 계측 화면이 한 번에 열립니다.
            </p>
          </div>
          <GuideStep icon={<Smartphone size={18} />} title={`1. ${label}을 아이폰 윗부분에 대세요`}>
            잠금 화면이나 홈 화면 상태에서 {activeProduct === "ball" ? "볼" : "키링"}을 아이폰 상단(카메라 근처)에 가까이 대주세요.
            {activeProduct === "keyring" && " 키링은 평평한 바닥에 놓고 폰을 위에서 가까이 대면 잘 읽혀요."}
          </GuideStep>
          <GuideStep icon={<Nfc size={18} />} title="2. 화면 위에 뜨는 입낚 배너를 탭하세요">
            배너를 탭하면 입낚이 열리면서 태그한 {activeProduct === "ball" ? "볼" : "키링"} ID가 자동으로 선택돼요.
            처음 태그한 {activeProduct === "ball" ? "볼" : "키링"}이면 등록 확인 화면이 먼저 나와요.
          </GuideStep>
          <GuideStep icon={<Check size={18} />} title="3. 바로 AI 계측을 시작하세요">
            이미 등록된 {activeProduct === "ball" ? "볼" : "키링"}이면 확인 절차 없이 곧장 계측 화면이 열려요.
          </GuideStep>
          {activeProduct === "keyring" && <KeyringFlatNotice />}

          {/* fallback — 태그가 읽히지 않을 때 */}
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-3.5">
            <p className="text-[13px] font-bold text-orange-300">배너가 뜨지 않으면 코드를 직접 입력하세요</p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">
              연동 화면의 ‘직접 입력하기’를 펼쳐 박스 측면 또는 {activeProduct === "ball" ? "볼" : "키링"} 본체에 인쇄된 ID를 입력하면 돼요.
            </p>
            <div className="mt-2.5 flex items-center justify-center rounded-xl border border-aqua-500/30 bg-[#0d1b2a] py-3">
              <span className="font-mono text-[18px] font-extrabold tracking-widest text-aqua-300">
                {ID_SAMPLE[activeProduct]}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-navy-400">
              코드 형식: {ID_FORMAT_LABEL[activeProduct]}
            </p>
            <p className="mt-1 text-[11px] text-navy-400">
              먼저 구매하신 제품은 <span className="font-mono">{LEGACY_ID_SAMPLE[activeProduct]}</span> 형식일 수 있어요. 이 코드도 그대로 사용할 수 있습니다.
            </p>
          </div>

          <div className="rounded-xl bg-navy-50 px-3.5 py-3 text-[12px] leading-relaxed text-navy-400">
            코드는 영문 대소문자를 구분하지 않아요. 예를 들어{" "}
            <span className="font-mono font-semibold text-aqua-300">{ID_SAMPLE[activeProduct].toLowerCase()}</span>과{" "}
            <span className="font-mono font-semibold text-aqua-300">{ID_SAMPLE[activeProduct]}</span>은 동일하게 인식돼요.
            아이폰 NFC 읽기는 iPhone 7 이상에서 동작해요.
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** 키링 전용 주의사항 — 평평한 바닥에 놓고 태그해야 인식이 잘 된다 */
function KeyringFlatNotice() {
  return (
    <div className="flex gap-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-3">
      <KeyRound size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-orange-400" />
      <p className="text-[12px] leading-relaxed text-orange-200">
        키링을 평평한 바닥에 내려놓고 스마트폰을 키링 위에 가까이 대주세요.
      </p>
    </div>
  );
}

/* ── 마이페이지: 내 입낚볼 관리 ── */
export function MyBallManager() {
  const { supported, balls, reading, tagAndRegister, refresh } = useBallLink();
  const toast = useToast();
  const [manualId, setManualId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const hasBalls = balls !== null && balls.length > 0;

  async function registerManual() {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    setRegistering(true);
    try {
      const { ok, status, error } = await registerBallApi(trimmed);
      if (ok) {
        toast(`입낚볼(${trimmed}) 연동 완료`, "success");
        setManualId("");
        await refresh();
      } else {
        toast(status === 401 ? "로그인 후 이용할 수 있어요." : (error || "볼 ID를 확인해 주세요."), "error");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function unlinkBall(b: Ball) {
    if (confirmingId !== b.id) {
      // 1차: 확인 상태로 전환
      setConfirmingId(b.id);
      return;
    }
    // 2차: 실제 해제
    setConfirmingId(null);
    setUnlinkingId(b.id);
    try {
      const res = await fetch("/api/balls", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id }),
      });
      if (res.ok) {
        toast(`입낚볼(${b.ballId}) 연동 해제`, "success");
        await refresh();
      } else {
        toast("연동 해제에 실패했어요.", "error");
      }
    } finally {
      setUnlinkingId(null);
    }
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
      {balls === null ? null : hasBalls ? (
        <ul className="space-y-2">
          {balls.map((b) => (
            <li key={b.id} className="flex items-center gap-2.5 rounded-2xl border border-navy-100 bg-surface-100 px-3.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
                <CircleDashed size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-navy-900">{b.ballId}</p>
                <p className="text-[11px] text-navy-300">연동일 {String(b.linkedAt).slice(0, 10)}</p>
              </div>
              <Link
                href={`/diary?ballId=${encodeURIComponent(b.ballId)}`}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600 transition-colors hover:bg-navy-100"
              >
                기록 보기 <ChevronRight size={12} strokeWidth={2.2} />
              </Link>
              {confirmingId === b.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => unlinkBall(b)}
                    disabled={unlinkingId === b.id}
                    className="rounded-lg bg-red-500/15 px-2 py-1 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-40"
                  >
                    {unlinkingId === b.id ? <Loader2 size={12} className="animate-spin" /> : "해제"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg bg-navy-50 px-2 py-1 text-[11px] font-bold text-navy-500 transition-colors hover:bg-navy-100"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => unlinkBall(b)}
                  disabled={unlinkingId === b.id}
                  title="연동 해제"
                  className="shrink-0 rounded-full p-1.5 text-navy-300 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                >
                  <Unlink size={14} strokeWidth={1.9} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-navy-200 px-4 py-5 text-center">
          <p className="text-[13px] font-semibold text-navy-500">연결된 입낚볼이 없어요</p>
          <p className="mt-0.5 text-[11px] text-navy-300">아래 버튼을 눌러 볼을 등록해 주세요</p>
        </div>
      )}

      {/* 볼 등록 — 로드 완료 후 연결된 볼이 없을 때만 표시 */}
      {balls !== null && !hasBalls && (
        supported === false ? (
          /* iPhone 등 NFC 미지원 — ID 직접 입력 */
          <div className="mt-3 space-y-2">
            <p className="text-center text-[12px] text-navy-400">
              박스에 표시된 아이디를 직접 입력하세요.
            </p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registerManual()}
                placeholder={`예: ${ID_SAMPLE.ball}`}
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-navy-800 placeholder-navy-300 outline-none focus:border-orange-400/50"
              />
              <button
                type="button"
                onClick={registerManual}
                disabled={!manualId.trim() || registering}
                className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors active:bg-orange-600 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : "등록"}
              </button>
            </div>
          </div>
        ) : (
          /* Android Chrome 등 NFC 지원 */
          <button
            type="button"
            onClick={tagAndRegister}
            disabled={supported === null || reading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
          >
            {reading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.2} />}
            {reading ? "볼을 태그해 주세요..." : "볼 등록 (NFC 태그)"}
          </button>
        )
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

/* ── 마이페이지: 내 입낚키링 관리 (MyBallManager 와 동일 구조) ── */
export function MyKeyringManager() {
  const { supported, keyrings, reading, tagAndRegister, refresh } = useKeyringLink();
  const toast = useToast();
  const [manualId, setManualId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const hasKeyrings = keyrings !== null && keyrings.length > 0;

  async function registerManual() {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    setRegistering(true);
    try {
      const { ok, status, error } = await registerKeyringApi(trimmed);
      if (ok) {
        toast(`입낚키링(${trimmed}) 연동 완료`, "success");
        setManualId("");
        await refresh();
      } else {
        toast(status === 401 ? "로그인 후 이용할 수 있어요." : (error || "키링 ID를 확인해 주세요."), "error");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function unlinkKeyring(k: Keyring) {
    if (confirmingId !== k.id) {
      // 1차: 확인 상태로 전환
      setConfirmingId(k.id);
      return;
    }
    // 2차: 실제 해제
    setConfirmingId(null);
    setUnlinkingId(k.id);
    try {
      const res = await fetch("/api/keyrings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: k.id }),
      });
      if (res.ok) {
        toast(`입낚키링(${k.keyringId}) 연동 해제`, "success");
        await refresh();
      } else {
        toast("연동 해제에 실패했어요.", "error");
      }
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
          <Nfc size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-navy-900">내 입낚키링 관리</p>
          <p className="text-[11px] text-navy-300">NFC 태그로 내 키링을 등록하고 기록을 모아보세요</p>
        </div>
      </div>

      {/* 연결된 키링 목록 */}
      {keyrings === null ? null : hasKeyrings ? (
        <ul className="space-y-2">
          {keyrings.map((k) => (
            <li key={k.id} className="flex items-center gap-2.5 rounded-2xl border border-navy-100 bg-surface-100 px-3.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
                <KeyRound size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-navy-900">{k.keyringId}</p>
                <p className="text-[11px] text-navy-300">연동일 {String(k.linkedAt).slice(0, 10)}</p>
              </div>
              <Link
                href={`/diary?keyringId=${encodeURIComponent(k.keyringId)}`}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600 transition-colors hover:bg-navy-100"
              >
                기록 보기 <ChevronRight size={12} strokeWidth={2.2} />
              </Link>
              {confirmingId === k.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => unlinkKeyring(k)}
                    disabled={unlinkingId === k.id}
                    className="rounded-lg bg-red-500/15 px-2 py-1 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-40"
                  >
                    {unlinkingId === k.id ? <Loader2 size={12} className="animate-spin" /> : "해제"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg bg-navy-50 px-2 py-1 text-[11px] font-bold text-navy-500 transition-colors hover:bg-navy-100"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => unlinkKeyring(k)}
                  disabled={unlinkingId === k.id}
                  title="연동 해제"
                  className="shrink-0 rounded-full p-1.5 text-navy-300 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                >
                  <Unlink size={14} strokeWidth={1.9} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-navy-200 px-4 py-5 text-center">
          <p className="text-[13px] font-semibold text-navy-500">연결된 입낚키링이 없어요</p>
          <p className="mt-0.5 text-[11px] text-navy-300">아래 버튼을 눌러 키링을 등록해 주세요</p>
        </div>
      )}

      {/* 키링 등록 — 로드 완료 후 연결된 키링이 없을 때만 표시 */}
      {keyrings !== null && !hasKeyrings && (
        supported === false ? (
          /* iPhone 등 NFC 미지원 — ID 직접 입력 */
          <div className="mt-3 space-y-2">
            <p className="text-center text-[12px] text-navy-400">
              박스에 표시된 아이디를 직접 입력하세요.
            </p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registerManual()}
                placeholder={`예: ${ID_SAMPLE.keyring}`}
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-navy-800 placeholder-navy-300 outline-none focus:border-orange-400/50"
              />
              <button
                type="button"
                onClick={registerManual}
                disabled={!manualId.trim() || registering}
                className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors active:bg-orange-600 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : "등록"}
              </button>
            </div>
          </div>
        ) : (
          /* Android Chrome 등 NFC 지원 */
          <button
            type="button"
            onClick={tagAndRegister}
            disabled={supported === null || reading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
          >
            {reading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.2} />}
            {reading ? "키링을 태그해 주세요..." : "키링 등록 (NFC 태그)"}
          </button>
        )
      )}

      {/* 키링 히스토리 — 볼 히스토리와 동일 UI */}
      <div className="mt-3 border-t border-navy-100 pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-navy-500">
          <History size={14} strokeWidth={1.9} /> 키링 히스토리
        </p>
        {keyrings && keyrings.length > 0 ? (
          <div className="space-y-1">
            {keyrings.map((k) => (
              <Link
                key={k.id}
                href={`/diary?keyringId=${encodeURIComponent(k.keyringId)}`}
                className="flex items-center justify-between rounded-xl px-2 py-1.5 text-[12px] font-semibold text-navy-600 transition-colors hover:bg-navy-50"
              >
                <span className="truncate">{k.keyringId} 측정 기록 보기</span>
                <ChevronRight size={13} strokeWidth={2.2} className="shrink-0 text-navy-300" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-navy-300">
            이 키링으로 찍은 측정 사진들이 여기에 모여요. 아직 기록이 없어요.
          </p>
        )}
      </div>

      {/* 키링 사용 안내 */}
      <div className="mt-3 border-t border-navy-100 pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-navy-500">
          <KeyRound size={14} strokeWidth={1.9} /> 키링 사용 안내
        </p>
        <p className="text-[11px] leading-relaxed text-navy-300">
          키링을 평평한 바닥에 내려놓고 스마트폰을 키링 위에 가까이 대주세요. 측정할 때도 키링을 바닥에 눕히고 카메라를 바로 위에서 수직으로 찍어야 정확해요.
        </p>
      </div>
    </div>
  );
}

/* ── 측정 페이지: 입낚키링 연동 카드 (BallLinkSection 과 동일 구조) ── */
export function KeyringLinkSection({ ballEnabled = false, keyringEnabled = true }: { ballEnabled?: boolean; keyringEnabled?: boolean } = {}) {
  const { supported, keyrings, reading, tagAndRegister, refresh } = useKeyringLink();
  const toast = useToast();
  const currentUser = useUser();
  const isIOS = useIsIOS();
  const linked = keyrings && keyrings.length > 0 ? keyrings[0] : null;
  const [linkGuideOpen, setLinkGuideOpen] = useState(false);
  const [linkGuideTab, setLinkGuideTab] = useState<"android" | "iphone">("android");
  const [manualId, setManualId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [keyringPrice, setKeyringPrice] = useState<number | null>(null);

  async function registerManual() {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    setRegistering(true);
    try {
      const { ok, status, error } = await registerKeyringApi(trimmed);
      if (ok) {
        toast(`입낚키링(${trimmed}) 연동 완료`, "success");
        setManualId("");
        await refresh();
      } else {
        toast(status === 401 ? "로그인 후 이용할 수 있어요." : (error || "키링 ID를 확인해 주세요."), "error");
      }
    } finally {
      setRegistering(false);
    }
  }

  useEffect(() => {
    fetch("/api/shop/ipnak-ball/products?type=keyring")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const first = data?.products?.[0];
        if (first?.price) setKeyringPrice(Number(first.price));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <span
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
            (linked ? "bg-orange-500/15 text-orange-500" : "bg-aqua-500/15 text-aqua-400")
          }
        >
          <KeyRound size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-navy-900">입낚키링 연동</p>
          <p className="truncate text-[12px] text-navy-300">
            키링 ID: {linked ? linked.keyringId : "미연결"}
          </p>
        </div>
        {linked && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-500">
            <Check size={11} strokeWidth={2.5} /> 연결됨
          </span>
        )}
      </div>

      {/* 키링이 연동되지 않은 경우에만 표시 (로딩 중 플래시 방지) */}
      {keyrings !== null && !linked && (
        supported === false ? (
          isIOS ? (
            /* 아이폰 — 태그 → 상단 배너 탭 안내 (수동 입력은 접어서 fallback 유지) */
            <IosTagPrompt
              kind="keyring"
              manualId={manualId}
              onManualIdChange={setManualId}
              registering={registering}
              onRegister={registerManual}
              onOpenGuide={() => { setLinkGuideTab("iphone"); setLinkGuideOpen(true); }}
            />
          ) : (
          /* NFC 미지원 데스크톱 브라우저 등 — ID 직접 입력 */
          <div className="space-y-2">
            <p className="pl-[46px] text-left text-[13px] text-navy-400">
              박스에 표시된 아이디를 직접 입력하세요.
            </p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registerManual()}
                placeholder={`예: ${ID_SAMPLE.keyring}`}
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-navy-800 placeholder-navy-300 outline-none focus:border-orange-400/50"
              />
              <button
                type="button"
                onClick={registerManual}
                disabled={!manualId.trim() || registering}
                className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-[13px] font-semibold text-gray-900 transition-colors active:bg-orange-600 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : "등록"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setLinkGuideTab("iphone"); setLinkGuideOpen(true); }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-[#162538] py-2 text-[12px] font-semibold text-navy-500 transition-colors hover:bg-navy-50 active:scale-[0.98]"
            >
              <CircleHelp size={15} strokeWidth={2} />
              입낚볼/입낚키링 연동 방법
            </button>
          </div>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={tagAndRegister}
              disabled={supported === null || reading}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
            >
              {reading ? <Loader2 size={16} className="animate-spin" /> : <Nfc size={16} strokeWidth={1.9} />}
              {reading ? "키링을 태그해 주세요..." : "키링에 NFC 태그하기"}
            </button>
            <button
              type="button"
              onClick={() => { setLinkGuideTab("android"); setLinkGuideOpen(true); }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-navy-100 bg-[#162538] py-2 text-[12px] font-semibold text-navy-500 transition-colors hover:bg-navy-50 active:scale-[0.98]"
            >
              <CircleHelp size={15} strokeWidth={2} />
              입낚볼/입낚키링 연동 방법
            </button>
          </>
        )
      )}

      {/* 연결된 키링 목록 */}
      {keyrings !== null && keyrings.length > 0 && (
        <div className="mt-3 border-t border-navy-100 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-navy-500">
            <History size={14} strokeWidth={1.9} /> 연결된 키링
          </p>
          <div className="space-y-1">
            {keyrings.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-[12px] font-semibold text-navy-600">
                <span className="truncate">{k.keyringId}</span>
                <span className="shrink-0 text-[11px] font-normal text-navy-300">{String(k.linkedAt).slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-navy-100 pt-3">
        <button
          type="button"
          onClick={() => setPurchaseOpen(true)}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-2.5 text-[13px] font-bold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          입낚키링 구매하러 가기
        </button>
        <div className="flex gap-2.5 rounded-xl border border-aqua-500/25 bg-aqua-500/10 px-3.5 py-3">
          <KeyRound size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-aqua-400" />
          <p className="text-[12px] leading-relaxed text-navy-400">
            입낚키링은 지름 40mm 원형 디스크예요. 측정할 때는 바닥에 평평하게 놓고 카메라를 바로 위에서 수직으로 찍어 주세요.
          </p>
        </div>
      </div>

      <IpnakLinkGuideSheet
        open={linkGuideOpen}
        onClose={() => setLinkGuideOpen(false)}
        defaultTab={linkGuideTab}
        defaultProduct="keyring"
        ballEnabled={ballEnabled}
        keyringEnabled={keyringEnabled}
      />
      <IpnakBallPurchase
        price={0}
        buyer={{ name: currentUser?.nickname ?? "", email: currentUser?.email ?? "" }}
        ballEnabled={false}
        keyringEnabled
        keyringPrice={keyringPrice ?? 0}
        hideCard
        triggerOpen={purchaseOpen}
        onOpened={() => setPurchaseOpen(false)}
      />
    </div>
  );
}
