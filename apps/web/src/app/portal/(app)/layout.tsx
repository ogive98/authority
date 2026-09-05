import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  fetchPortalMe,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data } = await fetchPortalMe();
  if (shouldHidePortal(status) || !data) {
    notFound();
  }

  const customerLabel = `${data.customer.code} · ${data.customer.legalName}`;

  return <PortalShell customerLabel={customerLabel}>{children}</PortalShell>;
}
