import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import {
  BUSINESS_LOGIN_PATH,
  fetchBusinessMe,
  shouldHideShell,
} from "@/lib/business-auth";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = await fetchBusinessMe();
  if (shouldHideShell(status)) {
    redirect(BUSINESS_LOGIN_PATH);
  }

  return <AppShell>{children}</AppShell>;
}
