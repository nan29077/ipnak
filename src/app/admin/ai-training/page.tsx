import Link from "next/link";
import {
  Database, Images, SquareDashedMousePointer, BarChart3, Cpu, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { AdminTitle } from "@/components/admin/ui";
import { AiTrainingCollectTab } from "@/components/admin/AiTrainingCollectTab";
import { AiTrainingFeedTab } from "@/components/admin/AiTrainingFeedTab";
import { AiTrainingLabelTab } from "@/components/admin/AiTrainingLabelTab";
import { AiTrainingModelTab } from "@/components/admin/AiTrainingModelTab";
import { getTrainingStats } from "@/lib/aiTraining";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * AI 학습 관리 (SUPER_ADMIN 전용)
 *
 * 접근 제어는 admin/layout.tsx 에서 이미 처리한다 (비로그인 → /login, 일반회원 → /home).
 * 탭 전환은 다른 관리자 페이지와 동일하게 ?tab= 쿼리로 한다.
 */
const TABS = [
  { key: "collect", label: "데이터 수집", icon: Database },
  { key: "feed", label: "피드 사진 선별", icon: Images },
  { key: "label", label: "라벨링", icon: SquareDashedMousePointer },
  { key: "stats", label: "학습 현황", icon: BarChart3 },
  { key: "model", label: "모델 관리", icon: Cpu },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AiTrainingPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab: TabKey = (TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab : "collect") as TabKey;
  // 학습 현황은 서버에서 바로 계산해 내려준다 (별도 API 왕복 없음)
  const stats = tab === "stats" ? await getTrainingStats() : null;

  return (
    <div>
      <AdminTitle
        title="AI 학습 관리"
        desc="물고기·입낚볼·입낚키링 자동 인식(YOLO) 모델의 데이터 수집 · 라벨링 · 배포를 관리합니다."
      />

      {/* 탭 */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/admin/ai-training?tab=${t.key}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors",
                on ? "bg-orange-500 text-gray-900" : "bg-white/[0.05] text-navy-400 hover:bg-white/[0.09]",
              )}
            >
              <Icon size={15} /> {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "collect" && <AiTrainingCollectTab />}
      {tab === "feed" && <AiTrainingFeedTab />}
      {tab === "label" && <AiTrainingLabelTab />}
      {tab === "model" && <AiTrainingModelTab />}

      {tab === "stats" && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="수집된 원본 이미지" value={stats.rawCount.toLocaleString()} unit="장" />
            <StatCard label="라벨링 완료" value={stats.labeledCount.toLocaleString()} unit="장"
              sub={stats.rawCount > 0 ? `${Math.round((stats.labeledCount / stats.rawCount) * 100)}%` : undefined} />
            <StatCard label="라벨 박스" value={stats.boxCount.toLocaleString()} unit="개" />
            <StatCard label="피드 선별 대기" value={stats.selectedFeedCount.toLocaleString()} unit="장" />
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-[14px] font-bold text-navy-800">진행 상황</h3>
            {stats.rawCount > 0 && (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-[width]"
                    style={{ width: `${Math.min(100, Math.round((stats.labeledCount / stats.rawCount) * 100))}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] text-navy-400">
                  전체 {stats.rawCount.toLocaleString()}장 중 {stats.labeledCount.toLocaleString()}장 라벨링 완료
                </p>
              </>
            )}
            <dl className="mt-4 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
              <InfoRow label="최근 수집일" value={fmtDate(stats.lastCollectedAt)} />
              <InfoRow label="최근 학습(모델 적용)일" value={fmtDate(stats.lastTrainedAt)} />
            </dl>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-[14px] font-bold text-navy-800">모델 상태</h3>
            {stats.modelReady ? (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-3">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-[13px] font-semibold text-emerald-300">YOLO 모델 활성</p>
                  <p className="mt-0.5 text-[12px] text-navy-400">
                    {stats.modelMeta?.fileName ?? "best.onnx"}
                    {stats.modelMeta?.note ? ` · ${stats.modelMeta.note}` : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-[13px] font-semibold text-navy-800">배포된 모델 없음</p>
                  <p className="mt-0.5 text-[12px] text-navy-400">
                    AI 카메라는 기존 방식으로 정상 동작합니다. 모델 관리 탭에서 학습된 모델을 올리면 YOLO 감지가 켜집니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-2 text-[14px] font-bold text-navy-800">다음 단계 안내</h3>
            <ol className="space-y-1.5 text-[12.5px] leading-relaxed text-navy-400">
              <li>1. <b className="text-navy-500">데이터 수집</b> · <b className="text-navy-500">피드 사진 선별</b> 탭에서 이미지를 모읍니다.</li>
              <li>2. <b className="text-navy-500">라벨링</b> 탭에서 박스를 그리거나 Roboflow 로 보냅니다.</li>
              <li>3. 라벨링 탭의 <b className="text-navy-500">YOLO 학습셋 내보내기</b>로 zip 을 받습니다.</li>
              <li>4. <code className="text-navy-500">training-data/train_yolov8.ipynb</code> 를 Google Colab 에서 실행합니다.</li>
              <li>5. 나온 <code className="text-navy-500">best.onnx</code> 를 <b className="text-navy-500">모델 관리</b> 탭에서 업로드합니다.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11.5px] font-medium text-navy-400">{label}</p>
      <p className="mt-1.5 text-[22px] font-bold tabular-nums text-navy-800">
        {value}
        <span className="ml-1 text-[13px] font-medium text-navy-400">{unit}</span>
      </p>
      {sub && <p className="mt-0.5 text-[11.5px] font-semibold text-orange-400">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[150px] shrink-0 text-navy-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-navy-800">{value}</dd>
    </div>
  );
}
