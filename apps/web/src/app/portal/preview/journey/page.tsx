"use client";

import { useState } from "react";
import Link from "next/link";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import { CompanyBrandPlate } from "@/components/shell/company-brand-plate";
import { PortalPackageJourney } from "@/components/portal/portal-package-journey";
import { PORTAL_LOGIN_PATH } from "@/lib/customer-portal";
import {
  PORTAL_JOURNEY_STUB,
  PORTAL_JOURNEY_STUB_FAILED,
} from "@/lib/portal-journey-stub";

type Variant = "en_route" | "failed";

export default function PortalJourneyPreviewPage() {
  const [variant, setVariant] = useState<Variant>("en_route");
  const delivery =
    variant === "failed" ? PORTAL_JOURNEY_STUB_FAILED : PORTAL_JOURNEY_STUB;

  return (
    <div className="min-h-screen bg-a-surface-1 text-a-fg">
      <ASkipLink href="#journey-demo" />
      <header className="flex flex-col items-center gap-3 px-[var(--a-space-6)] pb-[var(--a-space-4)] pt-[var(--a-space-6)]">
        <CompanyBrandPlate variant="hero" href={PORTAL_LOGIN_PATH} />
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
          Customer Portal · Stub
        </p>
        <h1 className="text-center text-[length:var(--a-text-lg)] font-medium tracking-tight">
          Exemple parcours colis
        </h1>
        <p className="max-w-md text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Données fictives pour visualiser le schéma interactif — pas une vraie
          livraison.
        </p>
        <Link
          href={PORTAL_LOGIN_PATH}
          className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
        >
          Connexion portal →
        </Link>
      </header>
      <main
        id="journey-demo"
        className="mx-auto max-w-3xl space-y-[var(--a-space-5)] px-[var(--a-space-6)] pb-[var(--a-space-6)]"
      >
        <div className="flex flex-wrap justify-center gap-2">
          <AButton
            type="button"
            size="sm"
            variant={variant === "en_route" ? "primary" : "secondary"}
            onClick={() => setVariant("en_route")}
          >
            Exemple · En route
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant={variant === "failed" ? "primary" : "secondary"}
            onClick={() => setVariant("failed")}
          >
            Exemple · Échec
          </AButton>
        </div>

        <p className="rounded-[var(--a-radius-md)] bg-a-surface-2 px-3 py-2 text-center text-[length:var(--a-text-xs)] text-a-fg-muted">
          Stub : {delivery.number} · commande {delivery.orderNumber} · livreur{" "}
          {delivery.driverLabel}. Cliquez les étapes du schéma.
        </p>

        <PortalPackageJourney delivery={delivery} />
      </main>
    </div>
  );
}
