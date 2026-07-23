"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";

type PostcodeResult = {
  zonecode: string;
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
  addressType?: "R" | "J";
  bname?: string;
  buildingName?: string;
};

const SCRIPT_ID = "kakao-postcode-script";
const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export function AddressSearchModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (result: { postalCode: string; address: string }) => void;
}) {
  const embedRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    function mountPostcode() {
      if (cancelled || !embedRef.current) return;
      const api = (window as any).kakao?.Postcode || (window as any).daum?.Postcode;
      if (!api) {
        setError("주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setLoading(false);
        return;
      }
      embedRef.current.innerHTML = "";
      new api({
        oncomplete(data: PostcodeResult) {
          let address = data.roadAddress || data.address || data.jibunAddress || "";
          if (data.addressType === "R") {
            const extras = [data.bname, data.buildingName].filter(Boolean);
            if (extras.length) address += ` (${extras.join(", ")})`;
          }
          onComplete({ postalCode: data.zonecode, address });
        },
        onresize() { setLoading(false); },
        width: "100%",
        height: "100%",
      }).embed(embedRef.current, { autoClose: false });
      setLoading(false);
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if ((window as any).kakao?.Postcode || (window as any).daum?.Postcode) {
      mountPostcode();
    } else if (existing) {
      existing.addEventListener("load", mountPostcode, { once: true });
      existing.addEventListener("error", () => { setError("주소 검색 서비스 연결에 실패했습니다."); setLoading(false); }, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = mountPostcode;
      script.onerror = () => { setError("주소 검색 서비스 연결에 실패했습니다."); setLoading(false); };
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [open, onComplete]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="배송지 주소 검색" className="w-full max-w-[520px] overflow-hidden rounded-t-[28px] border border-white/10 bg-[#151b21] shadow-2xl sm:rounded-[28px]">
        <div className="h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-aqua-400" />
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400"><MapPin size={20} /></span>
          <div className="min-w-0 flex-1"><h2 className="font-extrabold text-white">배송지 주소 검색</h2><p className="text-[11px] text-white/45">도로명, 건물명 또는 지번으로 검색해 주세요</p></div>
          <button type="button" onClick={onClose} aria-label="주소 검색 닫기" className="rounded-full bg-white/[.06] p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </header>
        <div className="relative h-[min(560px,70vh)] bg-white">
          <div ref={embedRef} className="h-full w-full" />
          {loading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#151b21] text-white/60"><Loader2 size={28} className="animate-spin text-orange-400" /><p className="text-sm">주소 검색을 불러오는 중...</p></div>}
          {error && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#151b21] px-8 text-center"><Search size={32} className="text-orange-400" /><p className="mt-3 text-sm font-semibold text-white">{error}</p><button type="button" onClick={onClose} className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white">직접 입력하기</button></div>}
        </div>
        <footer className="border-t border-white/10 bg-[#151b21] px-5 py-3 text-center text-[11px] text-white/40">주소 선택 후 상세주소를 이어서 입력해 주세요.</footer>
      </section>
    </div>
  );
}
