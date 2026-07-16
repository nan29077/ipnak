"use client";
import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { SmartRuler, type RulerResult } from "@/components/SmartRuler";

export default function RulerPage() {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [result, setResult] = useState<RulerResult | null>(null);
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="pb-10">
      <PageHeader title="스마트 자" back sub="사진 기반 물고기 길이 측정" />
      <div className="space-y-4 p-4">
        <p className="rounded-xl bg-aqua-50 p-3 text-sm text-aqua-700">
          기준 자(또는 알려진 길이의 물체)로 보정한 뒤 물고기 입~꼬리를 탭하면 길이가 계산됩니다.
          (참고: 하라스/HARAS 류 스마트 자 — 실제 AI 자동 인식은 추후 연동)
        </p>
        <PhotoPicker value={photos} onChange={setPhotos} max={1} single capture />
        {photos[0] && (
          <SmartRuler imageUrl={photos[0].preview} onComplete={setResult} />
        )}
        {result && (
          <div className="space-y-2">
            <button
              onClick={() => setShowJson((v) => !v)}
              className="text-xs font-semibold text-aqua-700 underline-offset-2 hover:underline"
            >
              측정 데이터 (JSON) {showJson ? "숨기기" : "보기"}
            </button>
            {showJson && (
              <div className="rounded-xl bg-navy-900 p-3">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-navy-100">{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
