"use client";

import { useState, useEffect } from "react";
import { FileText, Shield, Building2, Save, Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type LegalTab = "terms" | "privacy" | "location";

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

export function LegalManagement() {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<LegalTab>("terms");
  const [terms, setTerms] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [locationTerms, setLocationTerms] = useState("");
  const [company, setCompany] = useState<CompanyInfo>({
    company: "",
    representative: "",
    businessNumber: "",
    mailOrderNumber: "",
    address: "",
    phone: "",
    email: "",
    serviceName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/legal")
      .then((r) => r.json())
      .then((d) => {
        setTerms(d.terms_of_service ?? "");
        setPrivacy(d.privacy_policy ?? "");
        setLocationTerms(d.location_terms ?? "");
        try {
          const ci: CompanyInfo = JSON.parse(d.company_info ?? "{}");
          setCompany({
            company: ci.company ?? "",
            representative: ci.representative ?? "",
            businessNumber: ci.businessNumber ?? "",
            mailOrderNumber: ci.mailOrderNumber ?? "",
            address: ci.address ?? "",
            phone: ci.phone ?? "",
            email: ci.email ?? "",
            serviceName: ci.serviceName ?? "",
          });
        } catch {
          // 파싱 실패 시 기본값 유지
        }
      })
      .catch(() => toast("데이터를 불러오지 못했습니다.", "error"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/legal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms_of_service: terms,
          privacy_policy: privacy,
          location_terms: locationTerms,
          company_info: JSON.stringify(company),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장하지 못했습니다.");
      }
      toast("약관·정책·사업자정보를 저장했습니다.", "success");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "저장하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-[13px] text-navy-800 placeholder:text-navy-400 outline-none transition focus:border-aqua-400 focus:ring-1 focus:ring-aqua-400/30";
  const textareaClass = `${inputClass} min-h-[400px] resize-y font-mono leading-relaxed`;

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-500 to-navy-700 text-white shadow-soft">
          <Shield size={20} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-navy-800">약관 · 정책 관리</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-navy-400">
            이용약관, 개인정보처리방침, 사업자 정보를 관리합니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center py-10 text-navy-300">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          {/* 약관 탭 */}
          <div className="mt-5 flex border-b border-navy-100" role="tablist">
            <LegalTabButton
              active={activeTab === "terms"}
              icon={<FileText size={15} />}
              label="이용약관"
              onClick={() => setActiveTab("terms")}
            />
            <LegalTabButton
              active={activeTab === "privacy"}
              icon={<Shield size={15} />}
              label="개인정보처리방침"
              onClick={() => setActiveTab("privacy")}
            />
            <LegalTabButton
              active={activeTab === "location"}
              icon={<MapPin size={15} />}
              label="위치정보 이용약관"
              onClick={() => setActiveTab("location")}
            />
          </div>

          <div className="mt-4">
            {activeTab === "terms" ? (
              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold text-navy-600">이용약관 내용</span>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className={textareaClass}
                  placeholder="이용약관을 입력하세요..."
                />
              </label>
            ) : activeTab === "privacy" ? (
              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold text-navy-600">개인정보처리방침 내용</span>
                <textarea
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  className={textareaClass}
                  placeholder="개인정보처리방침을 입력하세요..."
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold text-navy-600">위치정보 이용약관 내용</span>
                <textarea
                  value={locationTerms}
                  onChange={(e) => setLocationTerms(e.target.value)}
                  className={textareaClass}
                  placeholder="위치정보 이용약관을 입력하세요..."
                />
              </label>
            )}
          </div>

          {/* 사업자 정보 섹션 */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-navy-500" strokeWidth={1.8} />
              <h3 className="text-[13px] font-bold text-navy-700">사업자 정보</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CompanyField
                label="서비스명"
                value={company.serviceName}
                onChange={(v) => setCompany((c) => ({ ...c, serviceName: v }))}
                inputClass={inputClass}
              />
              <CompanyField
                label="법인명"
                value={company.company}
                onChange={(v) => setCompany((c) => ({ ...c, company: v }))}
                inputClass={inputClass}
              />
              <CompanyField
                label="대표자"
                value={company.representative}
                onChange={(v) => setCompany((c) => ({ ...c, representative: v }))}
                inputClass={inputClass}
              />
              <CompanyField
                label="사업자등록번호"
                value={company.businessNumber}
                onChange={(v) => setCompany((c) => ({ ...c, businessNumber: v }))}
                inputClass={inputClass}
              />
              <CompanyField
                label="통신판매신고번호"
                value={company.mailOrderNumber ?? ""}
                onChange={(v) => setCompany((c) => ({ ...c, mailOrderNumber: v }))}
                inputClass={inputClass}
              />
              <CompanyField
                label="전화"
                value={company.phone}
                onChange={(v) => setCompany((c) => ({ ...c, phone: v }))}
                inputClass={inputClass}
              />
              <CompanyField
                label="이메일"
                value={company.email}
                onChange={(v) => setCompany((c) => ({ ...c, email: v }))}
                inputClass={inputClass}
              />
              <div className="sm:col-span-2">
                <CompanyField
                  label="주소"
                  value={company.address}
                  onChange={(v) => setCompany((c) => ({ ...c, address: v }))}
                  inputClass={inputClass}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-gray-900 transition hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            저장
          </button>
        </>
      )}
    </div>
  );
}

function LegalTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 min-w-fit items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors ${
        active
          ? "border-orange-500 text-orange-500"
          : "border-transparent text-navy-400 hover:text-navy-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CompanyField({
  label,
  value,
  onChange,
  inputClass,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputClass: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-navy-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={label}
      />
    </label>
  );
}
