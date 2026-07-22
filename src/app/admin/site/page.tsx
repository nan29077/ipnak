import Link from "next/link";
import { Bot, Megaphone, Monitor, Sliders } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { ShopToggle } from "@/components/admin/ShopToggle";
import { PcMarginBg } from "@/components/admin/PcMarginBg";
import { BassOnlyToggle } from "@/components/admin/BassOnlyToggle";
import { ReservationToggle } from "@/components/admin/ReservationToggle";
import { WalkingFeedToggle } from "@/components/admin/WalkingFeedToggle";
import { PointsToggle } from "@/components/admin/PointsToggle";
import { GroupPointsToggle } from "@/components/admin/GroupPointsToggle";
import { AiApiConnection } from "@/components/admin/AiApiConnection";
import { getAiConnectionStatus } from "@/lib/aiCredentials";
import { Badge, EmptyState } from "@/components/ui";
import { kstFormat, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "banners", label: "배너 · 공지", icon: Megaphone },
  { key: "pcbg", label: "PC 여백 관리", icon: Monitor },
  { key: "appmode", label: "앱 기능 설정", icon: Sliders },
  { key: "api", label: "AI API 연결", icon: Bot },
];

export default async function AdminSite({ searchParams }: { searchParams: { tab?: string } }) {
  const tab =
    searchParams.tab === "api"
      ? "api"
      : searchParams.tab === "pcbg"
      ? "pcbg"
      : searchParams.tab === "appmode"
      ? "appmode"
      : "banners";
  const [banners, shopEnabled, pcMarginBg, bassOnlyMode, reservationEnabled, walkingFeedEnabled, pointsEnabled, groupPointsRequired, aiConnection] = await Promise.all([
    prisma.banner.findMany({ orderBy: { order: "asc" } }),
    getBoolSetting("shop_menu_enabled"),
    getSetting("pcMarginBgImage"),
    getBoolSetting("bass_only_mode"),
    getBoolSetting("reservation_enabled"),
    getBoolSetting("walking_feed_enabled"),
    getBoolSetting("points_enabled"),
    getBoolSetting("group_points_required"),
    getAiConnectionStatus(),
  ]);

  return (
    <div>
      <AdminTitle title="사이트 관리" desc="배너·공지, 사용자 앱 메뉴 노출 등 사이트 전반 설정" />

      {/* 탭 — 모바일에서 flex-wrap 허용 */}
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-navy-100">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <Link key={t.key} href={`/admin/site?tab=${t.key}`}
              className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors",
                on ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700")}>
              <Icon size={15} /> {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "banners" ? (
        <>
          <div className="mb-4">
            <CreateForm actionType="BANNER_CREATE" title="배너/공지 추가" fields={[
              { name: "title", label: "제목", required: true },
              { name: "body", label: "내용" },
              { name: "imageUrl", label: "이미지 URL" },
            ]} />
          </div>

          {/* PC 테이블 */}
          <div className="hidden md:block">
            <Table head={["이미지", "제목", "내용", "상태", "등록일", "관리"]}>
              {banners.length === 0 && (
                <tr><td colSpan={6} className="p-0"><EmptyState title="배너가 없습니다" desc="위 버튼으로 배너/공지를 추가해 보세요." /></td></tr>
              )}
              {banners.map((b) => (
                <tr key={b.id} className={b.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3"><img src={b.imageUrl || ""} alt="" className="h-10 w-16 rounded-lg object-cover" /></td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{b.title}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-navy-500">{b.body}</td>
                  <td className="px-4 py-3">{b.active ? <Badge tone="aqua">노출중</Badge> : <Badge tone="gray">숨김</Badge>}</td>
                  <td className="px-4 py-3 text-navy-400">{kstFormat(b.createdAt, "MM.dd")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <ActionButton payload={{ type: "BANNER_TOGGLE", id: b.id }} label={b.active ? "숨김" : "노출"} successMsg="변경되었습니다" />
                      <ActionButton payload={{ type: "BANNER_DELETE", id: b.id }} label="삭제" variant="danger" confirm="이 배너/공지를 삭제할까요?" successMsg="삭제되었습니다" />
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          {/* 모바일 카드 목록 */}
          <div className="space-y-3 md:hidden">
            {banners.length === 0 && <EmptyState title="배너가 없습니다" desc="위 버튼으로 배너/공지를 추가해 보세요." />}
            {banners.map((b) => (
              <div key={b.id} className={`rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card ${b.active ? "" : "opacity-50"}`}>
                <div className="flex items-start gap-3">
                  {b.imageUrl && <img src={b.imageUrl} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-navy-800">{b.title}</p>
                      {b.active ? <Badge tone="aqua">노출중</Badge> : <Badge tone="gray">숨김</Badge>}
                    </div>
                    {b.body && <p className="mt-0.5 truncate text-[12px] text-navy-500">{b.body}</p>}
                    <p className="mt-0.5 text-[11px] text-navy-300">{kstFormat(b.createdAt, "MM.dd")}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ActionButton payload={{ type: "BANNER_TOGGLE", id: b.id }} label={b.active ? "숨김" : "노출"} successMsg="변경되었습니다" />
                  <ActionButton payload={{ type: "BANNER_DELETE", id: b.id }} label="삭제" variant="danger" confirm="이 배너/공지를 삭제할까요?" successMsg="삭제되었습니다" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : tab === "pcbg" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PcMarginBg initial={pcMarginBg} />
        </div>
      ) : tab === "api" ? (
        <div className="max-w-2xl"><AiApiConnection initial={aiConnection} /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <PointsToggle initial={pointsEnabled} />
          <GroupPointsToggle initial={groupPointsRequired} />
          <ShopToggle initial={shopEnabled} />
          <BassOnlyToggle initial={bassOnlyMode} />
          <ReservationToggle initial={reservationEnabled} />
          <WalkingFeedToggle initial={walkingFeedEnabled} />
        </div>
      )}
    </div>
  );
}
