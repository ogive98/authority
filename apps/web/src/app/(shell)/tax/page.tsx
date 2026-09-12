"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: TaxCode[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function TaxCatalogPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchTaxCodes();
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AScreenHeader
        kicker="Fiscalité"
        title="TVA Tunisie"
        description="Catalogue Code TVA (7 / 13 / 19 / 0 %). CNSS et IRPP réservés au futur module RH."
        more={
          <AOverflowMenu
            items={[
              {
                id: "invoices",
                label: "Factures",
                onSelect: () => router.push("/finance/invoices"),
              },
            ]}
          />
        }
      />
      <APageBody>
        {state.kind === "loading" ? <ASkeleton className="h-40" /> : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun code TVA"
            description="Exécutez le seed pour charger le catalogue Tunisie."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <APageSection
            title="Catalogue codes TVA"
            description="Taux as-recorded — consommés par Finance et Ventes. Pas de taux inventés."
            bare
          >
            <ASoftTable className="min-w-[40rem]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">Code</th>
                  <th className="a-table-cell font-medium">Libellé</th>
                  <th className="a-table-cell font-medium">Taux</th>
                  <th className="a-table-cell font-medium">Réf. légale</th>
                  <th className="a-table-cell font-medium">Type</th>
                </tr>
              </ASoftThead>
              <tbody>
                {state.items.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-mono a-table-cell">{row.code}</td>
                    <td className="a-table-cell">{row.label}</td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {formatRateBps(row.currentRateBps)}
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.lawRef ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone="accent">{row.kind}</ABadge>
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          </APageSection>
        ) : null}
      </APageBody>
    </>
  );
}
