"use client";
/**
 * 앱 업데이트 체크 훅
 *
 * 흐름
 * 1) @capacitor/app 의 getInfo() 로 현재 설치된 앱 버전을 읽는다.
 * 2) GET /api/app-version 으로 서버의 최소 요구 버전 / 최신 버전을 받는다.
 * 3) 현재 < minVersion  → required=true  (강제 업데이트, 모달 닫기 불가)
 *    현재 < currentVersion → optional=true (권장 업데이트, 나중에 하기 가능)
 * 4) openStore() 로 플랫폼별 스토어를 연다.
 *
 * 웹에서는 아무것도 하지 않는다 (needsUpdate=false).
 *
 * 사용 예
 *   const { required, optional, latestVersion, openStore, dismiss } = useAppUpdate();
 *   {(required || optional) && <UpdateModal ... />}
 */
import { useCallback, useEffect, useState } from "react";
import { isNativeRuntime, getNativePlatform, importApp } from "@/lib/capacitorPlugins";

export type VersionPolicy = {
  minVersion: string;
  currentVersion: string;
  storeUrl: { android: string; ios: string };
  releaseNote: string;
};

/**
 * semver 스타일 버전 비교. a<b → -1, a==b → 0, a>b → 1
 * "1.2" 처럼 자리수가 달라도 0 으로 채워 비교한다.
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(/[.\-+]/).map((s) => parseInt(s, 10) || 0);
  const pb = String(b).split(/[.\-+]/).map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export function useAppUpdate(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [policy, setPolicy] = useState<VersionPolicy | null>(null);
  /** 강제 업데이트 필요 */
  const [required, setRequired] = useState(false);
  /** 권장 업데이트 (사용자가 무시 가능) */
  const [optional, setOptional] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    if (!isNativeRuntime()) return;
    setChecking(true);
    try {
      const { App } = await importApp();
      if (!App) return;

      const info = await App.getInfo();
      const version = info?.version ?? null;
      setInstalledVersion(version);
      if (!version) return;

      const res = await fetch("/api/app-version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as VersionPolicy;
      setPolicy(data);

      if (data.minVersion && compareVersions(version, data.minVersion) < 0) {
        setRequired(true);
        setOptional(false);
        return;
      }
      if (data.currentVersion && compareVersions(version, data.currentVersion) < 0) {
        setOptional(true);
      }
    } catch {
      // 네트워크/플러그인 실패 시 업데이트 안내를 띄우지 않는다 (앱 사용을 막지 않음)
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void check();
  }, [enabled, check]);

  /** 플랫폼별 스토어 열기 */
  const openStore = useCallback(async () => {
    const platform = getNativePlatform();
    const url =
      platform === "ios" ? policy?.storeUrl?.ios : policy?.storeUrl?.android;
    if (!url) return;
    // WebView 내부가 아니라 외부 브라우저/스토어 앱으로 열어야 한다
    if (typeof window !== "undefined") window.open(url, "_system");
  }, [policy]);

  /** 권장 업데이트 안내 닫기 (강제 업데이트는 닫히지 않는다) */
  const dismiss = useCallback(() => {
    if (required) return;
    setDismissed(true);
    setOptional(false);
  }, [required]);

  return {
    isSupported: isNativeRuntime(),
    checking,
    installedVersion,
    latestVersion: policy?.currentVersion ?? null,
    minVersion: policy?.minVersion ?? null,
    releaseNote: policy?.releaseNote ?? "",
    /** 강제 업데이트 — 모달을 닫을 수 없게 처리할 것 */
    required,
    /** 권장 업데이트 */
    optional: optional && !dismissed,
    /** 둘 중 하나라도 필요한 상태 */
    needsUpdate: required || (optional && !dismissed),
    check,
    openStore,
    dismiss,
  };
}
