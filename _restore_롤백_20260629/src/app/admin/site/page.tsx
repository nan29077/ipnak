import Link from "next/link";
import { Megaphone, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { ShopToggle } from "@/components/admin/ShopToggle";
import { Badge, EmptyState } from "@/components/ui";
import { kstFormat, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "banners", label: "배너 · 공지", icon: Megaphone },
  { key: "general", label: "쇼핑 설정", icon: Settings2 },
];

export default async function AdminSite({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "general" ? "general" : "banners";
  const [banners, shopEnabled] = await Promise.all([
    prisma.banner.findMany({ orderBy: { order: "asc" } }),
    getBoolSetting("shop_menu_enabled"),
  ]);

  return (
    <div>
      <AdminTitle title="사이트 관리" desc="배너·공지, 사용자 앱 메뉴 노출 등 사이트 전반 설정" />

      {/* 탭 */}
      <div className="mb-5 flex gap-1.5 border-b border-navy-100">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <Link key={t.key} href={`/admin/site?tab=${t.key}`}
              className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors",
                on ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700")}>
              <Icon size={16} /> {t.label}
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
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ShopToggle initial={shopEnabled} />
        </div>
      )}
    </div>
  );
}
