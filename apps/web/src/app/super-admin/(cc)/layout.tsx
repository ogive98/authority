import { notFound } from "next/navigation";
import { SuperAdminShell } from "@/components/super-admin/sa-shell";
import { fetchSuperAdminHealth } from "@/lib/super-admin-health";
import { shouldHideSuperAdminPortal } from "@/lib/super-admin-portal";

export default async function SuperAdminCcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = await fetchSuperAdminHealth();
  if (shouldHideSuperAdminPortal(status)) {
    notFound();
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
