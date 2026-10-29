import { AdminShell } from "@/components/admin-shell";
import { requireAdminPage } from "@/lib/server/admin-auth";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const principal = await requireAdminPage();
  return <AdminShell principal={principal}>{children}</AdminShell>;
}
