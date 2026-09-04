import { AScreenHeader } from "@/components/a";

export default function SaStubPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <>
      <AScreenHeader kicker="Control Center" title={title} description={blurb} />
      <p className="p-[var(--a-space-6)] text-[length:var(--a-text-sm)] text-a-fg-muted">
        Chrome UI-14 uniquement — APIs SOC/THU déjà côté Nest, pas un module
        métier.
      </p>
    </>
  );
}
