import { redirect } from "next/navigation";
import { AuthApiUnavailable } from "@/components/a/auth-api-unavailable";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  fetchPortalMe,
  isPortalApiUnavailable,
  PORTAL_LOGIN_PATH,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data } = await fetchPortalMe();
  if (shouldHidePortal(status)) {
    redirect(PORTAL_LOGIN_PATH);
  }
  if (isPortalApiUnavailable(status) || !data) {
    return <AuthApiUnavailable />;
  }

  const customerLabel = `${data.customer.code} · ${data.customer.legalName}`;

  return <PortalShell customerLabel={customerLabel}>{children}</PortalShell>;
}
