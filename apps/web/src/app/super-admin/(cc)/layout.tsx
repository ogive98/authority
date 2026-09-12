import { redirect } from "next/navigation";
import { AuthApiUnavailable } from "@/components/a/auth-api-unavailable";
import { SuperAdminShell } from "@/components/super-admin/sa-shell";
import { fetchSuperAdminHealth } from "@/lib/super-admin-health";
import {
  isSuperAdminApiUnavailable,
  SA_LOGIN_PATH,
  shouldHideSuperAdminPortal,
} from "@/lib/super-admin-portal";

export default async function SuperAdminCcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = await fetchSuperAdminHealth();
  if (shouldHideSuperAdminPortal(status)) {
    // Unauthenticated / wrong realm → login (not a misleading 404)
    redirect(SA_LOGIN_PATH);
  }
  if (isSuperAdminApiUnavailable(status) || status !== 200) {
    return <AuthApiUnavailable />;
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
