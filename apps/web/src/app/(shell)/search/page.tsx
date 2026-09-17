"use client";

import { AEmptyState, APageBody, AScreenHeader } from "@/components/a";

/**
 * Global search stub — visible only when `platform.search` is ON in `/me/registry`.
 */
export default function SearchPage() {
  return (
    <>
      <AScreenHeader
        kicker="Plateforme"
        title="Recherche"
        description={
          <>
            Surface registry — flag{" "}
            <span className="a-mono">platform.search</span> requis. Index de
            contenu à brancher (pas de KPI inventés).
          </>
        }
      />
      <APageBody>
        <AEmptyState
          title="Recherche globale"
          description="Stub D294 — brancher l’index contenu + registry. En attendant, utilisez ⌘K pour naviguer les modules actifs."
        />
      </APageBody>
    </>
  );
}
