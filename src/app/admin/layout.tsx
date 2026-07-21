import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/"); // SUPER_ADMIN만 접근

  return <AdminShell userId={user.id} nickname={user.nickname} avatarUrl={user.avatarUrl}>{children}</AdminShell>;
}
