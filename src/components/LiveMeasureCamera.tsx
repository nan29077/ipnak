"use client";
// 카메라 동의 유틸 — LiveScanCamera 등에서 import해 사용
// LiveMeasureCamera 컴포넌트 본체 및 CameraPermissionModal은 미사용으로 제거됨
// (필요 시 git 이력에서 복원 가능)

const CAM_CONSENT_KEY = "ipnak_camera_consent";

/** 사용자가 카메라 동의 팝업에서 이미 '허용하기'를 눌렀는지 */
export function hasCameraConsent(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(CAM_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCameraConsent() {
  try {
    localStorage.setItem(CAM_CONSENT_KEY, "1");
  } catch { /* noop */ }
}
