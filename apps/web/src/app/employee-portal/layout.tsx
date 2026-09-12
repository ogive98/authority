export default function EmployeePortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-portal="employee"
      className="min-h-screen bg-a-surface-1 text-a-fg"
    >
      {children}
    </div>
  );
}
