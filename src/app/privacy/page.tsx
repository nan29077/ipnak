import { getLegalData } from "@/lib/legal";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "개인정보처리방침 | 입낚" };

export default async function PrivacyPage() {
  const { privacy_policy, company_info } = await getLegalData();

  let companyName = "주식회사 이십세기소년들";
  try {
    const ci = JSON.parse(company_info) as { company?: string };
    if (ci.company) companyName = ci.company;
  } catch {
    // 파싱 실패 시 기본값 사용
  }

  return (
    <div className="pb-16">
      <PageHeader title="개인정보처리방침" sub={companyName} />
      <div className="px-5 pt-4">
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.9] text-navy-500">
          {privacy_policy}
        </pre>
      </div>
    </div>
  );
}
