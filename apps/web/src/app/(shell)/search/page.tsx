import { AScreenHeader } from "@/components/a/a-screen-header";

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
    </>
  );
}
