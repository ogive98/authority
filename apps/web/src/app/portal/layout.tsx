export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-portal="customer" className="min-h-screen bg-a-surface-1 text-a-fg">
      {children}
    </div>
  );
}
