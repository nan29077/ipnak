"use client";
/**
 * 햅틱(진동) 피드백 훅
 *
 * 앱(Capacitor)에서만 실제 진동하고, 웹에서는 모든 함수가 noop 이다.
 * (웹 navigator.vibrate 는 브라우저 지원이 제각각이고 사용자 경험을 해치는 경우가 많아 쓰지 않는다)
 *
 * 사용 예
 *   const haptics = useHaptics();
 *   haptics.success();   // 등록 성공
 *   haptics.error();     // 실패
 *   haptics.tap();       // 가벼운 탭 피드백
 */
import { useMemo } from "react";
import { isNativeRuntime, importHaptics } from "@/lib/capacitorPlugins";

/** 훅 없이도 쓸 수 있는 모듈 함수들 (이벤트 핸들러 안에서 직접 호출 가능) */

/** 알림형 진동 공통 처리 — 플러그인이 없으면 조용히 통과 */
async function notify(kind: "Success" | "Warning" | "Error"): Promise<void> {
  if (!isNativeRuntime()) return;
  const { Haptics, NotificationType } = await importHaptics();
  if (!Haptics || !NotificationType) return;
  try {
    await Haptics.notification({ type: NotificationType[kind] });
  } catch {
    /* noop */
  }
}

/** 알림형 진동 — 성공 */
export async function hapticSuccess(): Promise<void> {
  return notify("Success");
}

/** 알림형 진동 — 경고 */
export async function hapticWarning(): Promise<void> {
  return notify("Warning");
}

/** 알림형 진동 — 실패/에러 */
export async function hapticError(): Promise<void> {
  return notify("Error");
}

/** 충격형 진동 — 버튼 탭 등 가벼운 피드백 */
export async function hapticTap(
  strength: "light" | "medium" | "heavy" = "light"
): Promise<void> {
  if (!isNativeRuntime()) return;
  const { Haptics, ImpactStyle } = await importHaptics();
  if (!Haptics || !ImpactStyle) return;
  const style =
    strength === "heavy"
      ? ImpactStyle.Heavy
      : strength === "medium"
        ? ImpactStyle.Medium
        : ImpactStyle.Light;
  try {
    await Haptics.impact({ style });
  } catch {
    /* noop */
  }
}

/** 지정 시간(ms) 동안 진동 */
export async function hapticVibrate(durationMs = 300): Promise<void> {
  if (!isNativeRuntime()) return;
  const { Haptics } = await importHaptics();
  try {
    await Haptics?.vibrate({ duration: durationMs });
  } catch {
    /* noop */
  }
}

export function useHaptics() {
  return useMemo(
    () => ({
      /** 앱에서만 true */
      isSupported: isNativeRuntime(),
      success: hapticSuccess,
      warning: hapticWarning,
      error: hapticError,
      tap: hapticTap,
      vibrate: hapticVibrate,
    }),
    []
  );
}
