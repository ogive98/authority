export default function SearchPage() {
  return (
    <div className="space-y-2 p-[var(--a-space-6)]">
      <h1 className="text-[length:var(--a-text-xl)] font-semibold">Recherche</h1>
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Stub — visible seulement si flag <span className="a-mono">platform.search</span>{" "}
        est ON dans le registry.
      </p>
    </div>
  );
}
