import { redirect } from "next/navigation";
import { AuthApiUnavailable } from "@/components/a/auth-api-unavailable";
import {
  fetchEmployeePortalMe,
  EMPLOYEE_PORTAL_LOGIN_PATH,
  isEmployeePortalApiUnavailable,
  shouldHideEmployeePortal,
} from "@/lib/employee-portal";
import { EmployeePortalShell } from "@/components/employee-portal/employee-portal-shell";

export default async function EmployeePortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data } = await fetchEmployeePortalMe();
  if (shouldHideEmployeePortal(status)) {
    redirect(EMPLOYEE_PORTAL_LOGIN_PATH);
  }
  if (isEmployeePortalApiUnavailable(status) || !data) {
    return <AuthApiUnavailable />;
  }

  const employeeLabel = `${data.employee.matricule} · ${data.employee.displayName}`;

  return (
    <EmployeePortalShell employeeLabel={employeeLabel}>
      {children}
    </EmployeePortalShell>
  );
}
