"use client";
/**
 * localStorage quota exceeded 시 DatabaseService 가 발생시키는
 * 'ipnak:storage-warning' CustomEvent 를 수신해 토스트를 표시하는 글로벌 리스너.
 * ToastProvider 하위에 배치해야 useToast() 가 동작한다.
 */
import { useEffect } from "react";
import { useToast } from "@/components/Toast";

export function StorageWarningListener() {
  const toast = useToast();

  useEffect(() => {
    function handleStorageWarning(e: Event) {
      const msg =
        (e as CustomEvent<{ message?: string }>).detail?.message ||
        "저장 공간이 부족하여 기기 사진 미리보기가 삭제되었습니다.";
      toast(msg, "info");
    }
    window.addEventListener("ipnak:storage-warning", handleStorageWarning);
    return () => window.removeEventListener("ipnak:storage-warning", handleStorageWarning);
  }, [toast]);

  return null;
}
