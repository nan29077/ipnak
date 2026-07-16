import { redirect } from "next/navigation";

// 배너/공지 관리는 "사이트 관리"로 통합되었습니다.
export default function AdminBannersRedirect() {
  redirect("/admin/site?tab=banners");
}
