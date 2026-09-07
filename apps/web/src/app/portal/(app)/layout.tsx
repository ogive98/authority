import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  fetchPortalMe,
  PORTAL_LOGIN_PATH,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data } = await fetchPortalMe();
  if (shouldHidePortal(status) || !data) {
    redirect(PORTAL_LOGIN_PATH);
  }

  const customerLabel = `${data.customer.code} · ${data.customer.legalName}`;

  return <PortalShell customerLabel={customerLabel}>{children}</PortalShell>;
}
