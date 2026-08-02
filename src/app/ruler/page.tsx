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
          물고기 옆에 기준물체(신용카드·500원 동전·A4 용지·계측자)를 놓고 촬영한 뒤,
          기준물체 양 끝 → 물고기 입~꼬리 순서로 탭하면 실제 길이가 자동 계산됩니다.
        </p>
        {/* 스마트 자는 기준물체가 잘리면 측정이 어긋나므로 크롭 편집을 쓰지 않는다 */}
        <PhotoPicker value={photos} onChange={setPhotos} max={1} single capture crop={false} />
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
              <div className="rounded-xl bg-[#122030] p-3">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-navy-100">{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
