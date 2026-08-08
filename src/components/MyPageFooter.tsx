"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

type CompanyInfo = {
  company: string;
  representative: string;
  businessNumber: string;
  mailOrderNumber?: string;
  address: string;
  phone: string;
  email: string;
  serviceName: string;
};

type LegalData = {
  terms_of_service: string;
  privacy_policy: string;
  location_terms: string;
  company_info: string;
};

type ModalType = "terms" | "privacy" | "location" | null;

export function MyPageFooter() {
  const [data, setData] = useState<LegalData | null>(null);
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => {
    fetch("/api/legal")
      .then((r) => r.json())
      .then((d: LegalData) => setData(d))
      .catch(() => {});
  }, []);

  const company: CompanyInfo | null = data
    ? (() => {
        try {
          return JSON.parse(data.company_info) as CompanyInfo;
        } catch {
          return null;
        }
      })()
    : null;

  const modalContent =
    modal === "terms" ? data?.terms_of_service
    : modal === "privacy" ? data?.privacy_policy
    : data?.location_terms;
  const modalTitle =
    modal === "terms" ? "이용약관"
    : modal === "privacy" ? "개인정보처리방침"
    : "위치정보 이용약관";

  return (
    <>
      <footer className="mt-8 border-t border-white/10 bg-[#0a1628] px-5 py-7">
        {company && (
          <div className="mb-4 space-y-1.5 text-[11px] text-[#5a7080]">
            <p className="font-semibold text-[#7a95a8]">
              {company.serviceName || company.company}
            </p>
            <p>{company.company}</p>
            <p>
              대표: {company.representative}
              {company.businessNumber ? ` | 사업자등록번호: ${company.businessNumber}` : ""}
            </p>
            {company.mailOrderNumber && (
              <p>통신판매신고번호: {company.mailOrderNumber}</p>
            )}
            <p>{company.address}</p>
            <p>
              {company.phone ? `전화: ${company.phone}` : ""}
              {company.phone && company.email ? " | " : ""}
              {company.email ? `이메일: ${company.email}` : ""}
            </p>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3 text-[12px]">
          <button
            type="button"
            onClick={() => setModal("terms")}
            className="text-[#5a7080] underline underline-offset-2 transition-colors hover:text-[#9ab0be]"
          >
            이용약관
          </button>
          <span className="text-[#2a3f50]">|</span>
          <button
            type="button"
            onClick={() => setModal("privacy")}
            className="font-semibold text-[#5a7080] underline underline-offset-2 transition-colors hover:text-[#9ab0be]"
          >
            개인정보처리방침
          </button>
          <span className="text-[#2a3f50]">|</span>
          <button
            type="button"
            onClick={() => setModal("location")}
            className="text-[#5a7080] underline underline-offset-2 transition-colors hover:text-[#9ab0be]"
          >
            위치정보 이용약관
          </button>
        </div>

        <p className="text-[11px] text-[#3a5060]">
          &#169; 2024 주식회사 이십세기소년들. All rights reserved.
        </p>
      </footer>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="flex w-full max-w-[480px] flex-col rounded-t-3xl bg-[#0d1b2a] max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="text-[15px] font-bold text-[#c8d8e4]">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-full p-1 text-[#5a7080] transition-colors hover:text-[#9ab0be]"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-[1.8] text-[#6a8898]">
                {modalContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
