import { APageBody, AScreenHeader } from "@/components/a";

export default function SearchPage() {
  return (
    <>
      <AScreenHeader
        title="Recherche"
        description={
          <>
            Stub — visible seulement si flag{" "}
            <span className="a-mono">platform.search</span> est ON dans le
            registry.
          </>
        }
      />
      <APageBody>
        <p className="text-[13px] text-a-fg-muted">
          Recherche globale — à brancher sur le registry et l’index de contenu.
        </p>
      </APageBody>
    </>
  );
}
