"use client";
/**
 * 관리자 — NFC 태그 프로그래밍 안내 (볼 ID 관리 / 키링 ID 관리 탭 공용)
 *
 * 왜 필요한가
 * - NFC 칩에 무엇을, 어떤 레코드 타입으로 써야 하는지가 이 화면에서 바로 보여야
 *   생산·발주 담당자가 헤매지 않는다.
 * - 특히 "텍스트"가 아니라 "URI(URL) 레코드"로 써야 아이폰에서 상단 배너가 뜬다.
 *
 * 기본은 접힌 아코디언이라 기존 표 화면을 가리지 않는다.
 */
import { useState } from "react";
import { ChevronDown, Nfc, Smartphone, Info, Apple, Check } from "lucide-react";
import { buildTagUrl, ID_SAMPLE, ID_FORMAT_LABEL, LEGACY_ID_SAMPLE, type TagKind } from "@/lib/nfcTag";
import { TagUrlCopyButton } from "@/components/admin/TagUrlCopyButton";

const STEPS = [
  { title: "NFC Tools 앱 실행", desc: "iOS는 App Store, Android는 Play 스토어에서 무료로 받을 수 있습니다." },
  { title: "‘쓰기(WRITE)’ 탭 선택", desc: "하단 탭에서 READ 가 아닌 WRITE 를 선택하세요." },
  { title: "‘레코드 추가 → URI’ 선택", desc: "반드시 URI(URL) 레코드여야 합니다. Text 레코드는 아이폰에서 배너가 뜨지 않습니다." },
  { title: "URL 입력", desc: "위 ‘태그에 입력할 URL 형식’에 실제 ID를 넣어 전체 주소를 그대로 입력하세요. 목록의 복사 아이콘을 쓰면 가장 정확합니다." },
  { title: "폰을 NFC 태그에 가져다 대기", desc: "‘쓰기’ 버튼을 누른 뒤 폰 뒷면(안드로이드) 또는 윗부분(아이폰)을 태그에 밀착합니다." },
  { title: "완료 확인", desc: "쓰기 성공 메시지를 확인하고, READ 탭으로 다시 읽어 주소가 맞는지 검수하세요." },
];

export function NfcTagProgrammingGuide({ kind }: { kind: TagKind }) {
  const [open, setOpen] = useState(false);
  const label = kind === "ball" ? "입낚볼" : "입낚키링";

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-navy-100 bg-surface-200">
      {/* 아코디언 헤더 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-navy-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
          <Nfc className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-navy-800">NFC 태그 프로그래밍 안내</span>
          <span className="block text-xs text-navy-400">
            {label} NFC 칩에 URL을 쓰는 방법 — NFC Tools 앱 기준
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-navy-300 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-navy-100 px-4 py-4">
          {/* 앱 안내 */}
          <div className="flex gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" strokeWidth={1.9} />
            <p className="text-xs leading-relaxed text-blue-700">
              <strong>NFC Tools</strong> 앱을 사용합니다. iOS(App Store) · Android(Play 스토어) 모두 <strong>무료</strong>로 제공됩니다.
              아이폰은 iPhone 7 이상에서 NFC 쓰기가 가능합니다.
            </p>
          </div>

          {/* URL 형식 — 볼/키링 둘 다 보여준다 (담당자가 한 화면에서 확인) */}
          <div>
            <p className="mb-2 text-xs font-bold text-navy-600">태그에 입력할 URL 형식</p>
            <div className="space-y-2">
              <UrlRow kindLabel="볼" url={buildTagUrl("ball", ID_SAMPLE.ball)} sample={ID_SAMPLE.ball} format={ID_FORMAT_LABEL.ball} highlight={kind === "ball"} />
              <UrlRow kindLabel="키링" url={buildTagUrl("keyring", ID_SAMPLE.keyring)} sample={ID_SAMPLE.keyring} format={ID_FORMAT_LABEL.keyring} highlight={kind === "keyring"} />
            </div>
          </div>

          {/* 단계별 방법 */}
          <div>
            <p className="mb-2 text-xs font-bold text-navy-600">단계별 입력 방법</p>
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-gray-900">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-navy-700">{s.title}</span>
                    <span className="block text-xs leading-relaxed text-navy-400">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* 구형 텍스트 태그 안내 */}
          <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.9} />
            <div className="text-xs leading-relaxed text-amber-800">
              <p className="font-semibold">기존 텍스트 태그({LEGACY_ID_SAMPLE.ball} 형식)도 계속 사용할 수 있습니다.</p>
              <p className="mt-1">
                안드로이드 앱은 텍스트 태그를 그대로 읽습니다. 다만 <strong>아이폰은 텍스트 태그에서 배너가 뜨지 않아</strong>
                {" "}자동 연동·계측이 되지 않습니다. 아이폰까지 지원하려면 위 <strong>URL 형식으로 재프로그래밍하는 것을 권장</strong>합니다.
              </p>
            </div>
          </div>

          {/* 검수 포인트 */}
          <div className="rounded-lg bg-navy-50 px-3.5 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-navy-600">
              <Check className="h-3.5 w-3.5 text-green-500" strokeWidth={2.4} /> 쓰기 전 체크리스트
            </p>
            <ul className="space-y-1 text-xs leading-relaxed text-navy-400">
              <li>· 레코드 타입이 <strong className="text-navy-600">Text 가 아닌 URI(URL)</strong> 인지</li>
              <li>· 주소에 <strong className="text-navy-600">?id=</strong> 가 포함되어 있는지</li>
              <li>· 볼은 <code className="text-navy-600">/ball</code>, 키링은 <code className="text-navy-600">/keyring</code> 경로인지</li>
              <li>· 입력한 ID가 이 화면의 목록에 <strong className="text-navy-600">활성 상태</strong>로 등록돼 있는지</li>
              <li>· 태그를 <strong className="text-navy-600">잠금(Lock)</strong> 처리하면 이후 수정이 불가하니 검수 후 진행</li>
            </ul>
          </div>

          <div className="flex gap-2.5 rounded-lg border border-navy-100 px-3.5 py-3">
            <Apple className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" strokeWidth={1.9} />
            <p className="text-xs leading-relaxed text-navy-400">
              위 목록의 각 ID 옆 <strong className="text-navy-600">복사 아이콘</strong>을 누르면 해당 ID의 태그 URL이 그대로 복사됩니다.
              NFC Tools 의 URI 입력란에 붙여넣기만 하면 됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function UrlRow({
  kindLabel, url, sample, format, highlight,
}: {
  kindLabel: string; url: string; sample: string; format: string; highlight: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border px-3 py-2.5 " +
        (highlight ? "border-orange-400/50 bg-orange-500/5" : "border-navy-100 bg-surface-100")
      }
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className={
            "rounded px-1.5 py-0.5 text-[11px] font-bold " +
            (highlight ? "bg-orange-500 text-gray-900" : "bg-navy-100 text-navy-500")
          }
        >
          {kindLabel}
        </span>
        <span className="text-[11px] text-navy-400">{format}</span>
        <span className="ml-auto">
          <TagUrlCopyButton url={url} />
        </span>
      </div>
      <p className="break-all font-mono text-xs font-semibold text-navy-700">{url}</p>
      <p className="mt-1 text-[11px] text-navy-400">
        <span className="font-mono">{sample}</span> 자리에 실제 {kindLabel} ID를 넣으세요.
      </p>
    </div>
  );
}
