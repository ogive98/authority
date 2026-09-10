"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import {
  softPageBody,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: TaxCode[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function TaxCatalogPage() {
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
        actions={
          <Link
            href="/finance/invoices"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
          >
            Factures
          </Link>
        }
      />
      <div className={softPageBody}>
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
          <div className={softTableWrap}>
            <table className="w-full min-w-[40rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="a-table-cell font-medium">Code</th>
                  <th className="a-table-cell font-medium">Libellé</th>
                  <th className="a-table-cell font-medium">Taux</th>
                  <th className="a-table-cell font-medium">Réf. légale</th>
                  <th className="a-table-cell font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr key={row.id} className={softTr}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
