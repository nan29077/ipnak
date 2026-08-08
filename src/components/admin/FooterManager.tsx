"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

const PAGE_LABELS: { key: string; label: string; path: string }[] = [
  { key: "home", label: "홈", path: "/home" },
  { key: "feed", label: "피싱 피드", path: "/feed" },
  { key: "general", label: "일반 피드", path: "/general" },
  { key: "map", label: "지도", path: "/map" },
  { key: "me", label: "마이페이지", path: "/me" },
  { key: "diary", label: "다이어리", path: "/diary" },
  { key: "log", label: "낚시기록", path: "/log" },
  { key: "market", label: "중고마켓", path: "/market" },
  { key: "groups", label: "낚시단", path: "/groups" },
  { key: "tournaments", label: "대회", path: "/tournaments" },
  { key: "catch", label: "어획", path: "/catch" },
  { key: "explore", label: "탐색", path: "/explore" },
  { key: "walking", label: "워킹 피싱", path: "/walking" },
];

type Visibility = Record<string, boolean>;

export function FooterManager() {
  const toast = useToast();
  const [visibility, setVisibility] = useState<Visibility>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/footer")
      .then((r) => r.json())
      .then(({ visibility: v }: { visibility: Visibility }) => setVisibility(v ?? {}))
      .catch(() => toast("설정을 불러오지 못했습니다.", "error"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/footer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) throw new Error("저장하지 못했습니다.");
      toast("푸터 표시 설정을 저장했습니다.", "success");
    } catch {
      toast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: string) {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="card p-5 mt-4">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-navy-800">푸터 페이지별 표시 설정</h2>
        <p className="mt-1 text-[12px] text-navy-400">
          스위치를 켜면 해당 페이지 하단에 회사 정보와 약관 링크가 표시됩니다.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-navy-300">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-navy-100/40">
          {PAGE_LABELS.map(({ key, label, path }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-[13px] font-semibold text-navy-800">{label}</p>
                <p className="text-[11px] text-navy-400">{path}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!visibility[key]}
                onClick={() => toggle(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
                  visibility[key] ? "bg-orange-500" : "bg-navy-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    visibility[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-gray-900 transition hover:bg-orange-600 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        저장
      </button>
    </div>
  );
}
