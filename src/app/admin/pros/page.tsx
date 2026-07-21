import Link from "next/link";
import { Eye, EyeOff, Star, Settings2 } from "lucide-react";
import { AdminTitle, Card } from "@/components/admin/ui";
import { Badge } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { getPros, proModelReady } from "@/lib/curation";

export const dynamic = "force-dynamic";

export default async function AdminProsPage() {
  const pros = await getPros();
  const ready = proModelReady();

  return (
    <div>
      <AdminTitle title="프로·유튜버 관리" desc="유명 유튜버·낚시 프로를 등록하면 메인에 전용 추천 섹션이 만들어집니다. 노출 스위치로 메인 노출을 켜고 끌 수 있어요."
        right={<Link href="/admin/sections" className="rounded-lg bg-navy-50 px-3 py-2 text-[12.5px] font-semibold text-navy-600 hover:bg-navy-100">섹션 관리 →</Link>} />

      {!ready && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
          프로 테이블이 아직 없습니다. 터미널에서 <code className="rounded bg-black/30 px-1">npm run db:push</code> 실행 후 등록이 활성화됩니다.
        </div>
      )}

      <div className="mb-5">
        <CreateForm
          actionType="PRO_CREATE"
          title="프로 등록"
          fields={[
            { name: "name", label: "이름 (예: 홍길동 프로)", required: true },
            { name: "imageUrl", label: "프로필 이미지 URL" },
            { name: "bio", label: "소개" },
            { name: "linkedNickname", label: "연결할 회원 닉네임 (선택)" },
          ]}
        />
        <p className="mt-2 text-[12px] text-navy-400">연결 회원을 지정하면 그 계정이 쓴 글이 자동으로 프로 섹션에 노출됩니다. 비워두면 “글 관리”에서 직접 글을 고정하세요.</p>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold text-navy-800">등록된 프로 ({pros.length})</h2>
        {pros.length === 0 ? (
          <p className="rounded-xl bg-white/[0.03] px-3 py-6 text-center text-[13px] text-navy-400">등록된 프로가 없습니다. 위에서 추가하세요.</p>
        ) : (
          <ul className="space-y-2">
            {pros.map((p: any) => (
              <li key={p.id} className={`rounded-xl border border-navy-100 bg-[#1e1e1e] p-3 ${!p.visible ? "opacity-50" : ""}`}>
                {/* 상단: 아바타 + 이름/배지 */}
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-navy-50">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-orange-400"><Star size={18} /></span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[14px] font-bold text-navy-900">
                      {p.name}
                      {p.visible ? <Eye size={13} className="text-aqua-400" /> : <EyeOff size={13} className="text-navy-300" />}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-navy-400">
                      <Badge tone={p.linkedUserId ? "green" : "gray"}>{p.linkedUserId ? "회원 연결됨" : "연결 없음(수동 고정)"}</Badge>
                      {p.bio && <span className="truncate">{p.bio}</span>}
                    </p>
                  </div>
                </div>
                {/* 하단: 버튼 행 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/admin/curation?section=pro_${p.id}`} className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-600 hover:bg-navy-100">
                    <Settings2 size={13} /> 글 관리
                  </Link>
                  <ActionButton payload={{ type: "PRO_TOGGLE", id: p.id }} label={p.visible ? "메인 노출 끄기" : "메인 노출 켜기"} variant={p.visible ? "default" : "primary"} successMsg="변경됨" />
                  <ActionButton payload={{ type: "PRO_DELETE", id: p.id }} label="삭제" variant="danger" confirm="이 프로와 섹션을 삭제할까요?" successMsg="삭제됨" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
