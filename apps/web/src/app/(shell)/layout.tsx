import { redirect } from "next/navigation";
import { AuthApiUnavailable } from "@/components/a/auth-api-unavailable";
import { AppShell } from "@/components/shell";
import {
  BUSINESS_LOGIN_PATH,
  fetchBusinessMe,
  isAuthApiUnavailable,
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
  if (isAuthApiUnavailable(status) || status !== 200) {
    return <AuthApiUnavailable />;
  }

  return <AppShell>{children}</AppShell>;
}
