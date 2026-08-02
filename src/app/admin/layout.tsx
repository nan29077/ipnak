import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // SUPER_ADMIN만 접근 — "/" 로 보내면 미들웨어가 다시 /landing 으로 튕겨
  // 로그인한 낚시꾼이 랜딩 화면으로 돌아가버리므로 홈으로 돌려보낸다
  if (user.role !== "SUPER_ADMIN") redirect("/home");

  return <AdminShell userId={user.id} nickname={user.nickname} avatarUrl={user.avatarUrl}>{children}</AdminShell>;
}
