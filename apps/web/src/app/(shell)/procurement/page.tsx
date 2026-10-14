"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import {
  APageBody,
  AScreenHeader,
  ASkeleton,
  ATabs,
  erpListDescription,
} from "@/components/a";
import { ProcurementPoPanel } from "@/components/procurement/po-panel";
import { ProcurementPoliciesPanel } from "@/components/procurement/policies-panel";
import { ProcurementReceiptsPanel } from "@/components/procurement/receipts-panel";
import { ProcurementSuggestionsPanel } from "@/components/procurement/suggestions-panel";
import { useProcurementMeta } from "@/components/procurement/shared";

type Tab = "pos" | "suggestions" | "receipts" | "policies";

const TABS = [
  { id: "pos", label: "Bons de commande" },
  { id: "suggestions", label: "Suggestions" },
  { id: "receipts", label: "Réceptions" },
  { id: "policies", label: "Seuils de stock" },
] as const;

function parseTab(raw: string | null): Tab {
  return TABS.some((t) => t.id === raw) ? (raw as Tab) : "pos";
}

export default function ProcurementPage() {
  return (
    <Suspense fallback={<ASkeleton className="h-48 w-full" />}>
      <ProcurementWorkspace />
    </Suspense>
  );
}

function ProcurementWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const meta = useProcurementMeta();

  const setTab = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "pos") sp.delete("tab");
      else sp.set("tab", next);
      const qs = sp.toString();
      router.replace(qs ? `/procurement?${qs}` : "/procurement");
    },
    [router, searchParams],
  );

  return (
    <>
      <AScreenHeader
        kicker="Achats"
        title="Bons de commande fournisseur"
        description={erpListDescription(
          null,
          "Suggestions → BC → envoi fournisseur → réception stock + dette AP (D324)",
        )}
      />

      <APageBody>
        <ATabs
          ariaLabel="Sections achats"
          variant="underline"
          items={TABS}
          value={tab}
          onValueChange={setTab}
        />

        {!meta.ready ? <ASkeleton className="h-48 w-full" /> : null}

        {meta.ready && tab === "pos" ? <ProcurementPoPanel meta={meta} /> : null}
        {meta.ready && tab === "suggestions" ? (
          <ProcurementSuggestionsPanel meta={meta} />
        ) : null}
        {meta.ready && tab === "receipts" ? (
          <ProcurementReceiptsPanel meta={meta} />
        ) : null}
        {meta.ready && tab === "policies" ? (
          <ProcurementPoliciesPanel meta={meta} />
        ) : null}
      </APageBody>
    </>
  );
}
