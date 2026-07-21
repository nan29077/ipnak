"use client";
/**
 * 입낚볼 연동 UI
 * - BallLinkSection: 측정 페이지 하단 "입낚볼 연동" 카드 (NFC 태그로 볼 등록)
 * - MyBallManager: 마이페이지 "내 입낚볼 관리" 섹션 (연결된 볼 목록 / 등록 / 히스토리)
 * - Web NFC(NDEFReader)는 Android Chrome 에서만 지원 — 미지원 기기는 안내 문구 노출
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Nfc, CircleDashed, History, Plus, Loader2, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/components/Toast";
import NfcService from "@/services/NfcService";

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

      {/* 볼 등록: NFC 지원 기기에서만 활성화 */}
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
          <p className="mt-2 text-center text-[11px] text-navy-300">{NFC_UNSUPPORTED_MSG}</p>
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
