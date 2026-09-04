export default function SuperAdminNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-a-surface-1 px-6 text-a-fg">
      <h1 className="text-[length:var(--a-text-xl)] font-medium">
        Page introuvable
      </h1>
      <p className="a-mono text-[length:var(--a-text-sm)] text-a-fg-subtle">
        HTTP 404
      </p>
    </div>
  );
}
