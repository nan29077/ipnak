"use client";
/**
 * 네이티브 카메라/갤러리 훅
 *
 * - 앱(Capacitor): @capacitor/camera 로 네이티브 카메라·사진 선택기를 띄운다.
 * - 웹: null 을 반환해 호출부가 기존 <input type="file"> 방식을 그대로 쓰게 한다.
 *
 * 반환값은 항상 File 객체 배열이라 기존 업로드/압축 로직(PhotoPicker 등)과 그대로 호환된다.
 *
 * 사용 예
 *   const { isNativeCameraAvailable, takePhoto, pickFromGallery } = useNativeCamera();
 *   const files = isNativeCameraAvailable ? await takePhoto() : null;
 *   if (files) handleFiles(files);          // 네이티브 경로
 *   else fileInputRef.current?.click();     // 웹 fallback
 */
import { useCallback, useEffect, useState } from "react";
import { isNativeRuntime, importCamera } from "@/lib/capacitorPlugins";

/** 네이티브가 돌려준 파일 URI(또는 dataUrl)를 File 객체로 변환 */
async function toFile(
  photo: { webPath?: string; path?: string; dataUrl?: string; format?: string },
  index = 0
): Promise<File | null> {
  const src = photo.webPath || photo.dataUrl || photo.path;
  if (!src) return null;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const ext = (photo.format || blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const name = `ipnak-${Date.now()}-${index}.${ext}`;
    return new File([blob], name, { type: blob.type || `image/${ext}` });
  } catch {
    return null;
  }
}

export function useNativeCamera() {
  // 실제 플러그인 로드 성공 여부까지 확인해 상태를 정한다
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!isNativeRuntime()) return;
    let cancelled = false;
    (async () => {
      const { Camera } = await importCamera();
      if (!cancelled) setAvailable(!!Camera);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 권한 확인/요청 — 거부되면 false */
  const ensurePermission = useCallback(
    async (kind: "camera" | "photos"): Promise<boolean> => {
      const { Camera } = await importCamera();
      if (!Camera) return false;
      try {
        let perm = await Camera.checkPermissions();
        const current = kind === "camera" ? perm.camera : perm.photos;
        if (current !== "granted" && current !== "limited") {
          perm = await Camera.requestPermissions({ permissions: [kind] });
        }
        const next = kind === "camera" ? perm.camera : perm.photos;
        return next === "granted" || next === "limited";
      } catch {
        return false;
      }
    },
    []
  );

  /**
   * 카메라로 촬영. 성공 시 File 1개가 담긴 배열,
   * 사용자가 취소했거나 네이티브를 쓸 수 없으면 null (→ 호출부는 웹 fallback)
   */
  const takePhoto = useCallback(
    async (opts?: { quality?: number }): Promise<File[] | null> => {
      if (!isNativeRuntime()) return null;
      const { Camera, CameraResultType, CameraSource } = await importCamera();
      if (!Camera || !CameraResultType || !CameraSource) return null;
      if (!(await ensurePermission("camera"))) return null;
      try {
        const photo = await Camera.getPhoto({
          quality: opts?.quality ?? 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          // 촬영한 사진을 기기 갤러리에도 저장 (사용자 기대 동작)
          saveToGallery: true,
        });
        const file = await toFile(photo);
        return file ? [file] : null;
      } catch {
        // 사용자 취소 포함 — null 을 반환하되 웹 fallback 을 트리거하지 않도록
        // 호출부에서는 "취소"와 "미지원"을 구분하려면 isNativeCameraAvailable 을 먼저 본다.
        return null;
      }
    },
    [ensurePermission]
  );

  /**
   * 갤러리에서 선택. limit > 1 이면 다중 선택(pickImages).
   * 취소/미지원 시 null
   */
  const pickFromGallery = useCallback(
    async (opts?: { limit?: number; quality?: number }): Promise<File[] | null> => {
      if (!isNativeRuntime()) return null;
      const { Camera, CameraResultType, CameraSource } = await importCamera();
      if (!Camera || !CameraResultType || !CameraSource) return null;
      if (!(await ensurePermission("photos"))) return null;

      const limit = opts?.limit ?? 1;
      try {
        if (limit > 1 && typeof Camera.pickImages === "function") {
          const res = await Camera.pickImages({ quality: opts?.quality ?? 90, limit });
          const photos = res?.photos ?? [];
          const files = (await Promise.all(photos.map((p: any, i: number) => toFile(p, i)))).filter(
            (f): f is File => !!f
          );
          return files.length > 0 ? files : null;
        }
        const photo = await Camera.getPhoto({
          quality: opts?.quality ?? 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
        });
        const file = await toFile(photo);
        return file ? [file] : null;
      } catch {
        return null;
      }
    },
    [ensurePermission]
  );

  return {
    /** true 일 때만 네이티브 경로를 시도하고, false 면 기존 웹 input 을 쓴다 */
    isNativeCameraAvailable: available,
    takePhoto,
    pickFromGallery,
  };
}
