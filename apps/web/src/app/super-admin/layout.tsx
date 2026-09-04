export default function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-portal="sa" className="min-h-screen bg-a-surface-1 text-a-fg">
      {children}
    </div>
  );
}
