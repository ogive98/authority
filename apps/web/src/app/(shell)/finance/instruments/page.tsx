"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  INSTRUMENT_STATUS_LABELS,
  fetchInstruments,
  transitionInstrument,
  type FinInstrument,
  type InstrumentStatus,
} from "@/lib/finance";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinInstrument[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const NEXT: Partial<Record<InstrumentStatus, InstrumentStatus[]>> = {
  RECEIVED: ["DEPOSITED", "PRESENTED", "REJECTED"],
  DEPOSITED: ["PRESENTED", "CLEARED", "REJECTED"],
  PRESENTED: ["CLEARED", "REJECTED"],
};

export default function FinanceInstrumentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchInstruments();
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

  async function onTransition(id: string, status: InstrumentStatus) {
    setBusy(true);
    const reason =
      status === "REJECTED"
        ? window.prompt("Motif de rejet (optionnel)") ?? undefined
        : undefined;
    const res = await transitionInstrument(id, {
      status,
      rejectReason: reason || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load();
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Instruments"
        description="Chèques et traites — rejet = restauration des créances AR."
        actions={
          <Link
            href="/finance/payments"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
          >
            Encaissements
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        {state.kind === "loading" ? (
          <ASkeleton className="h-24 w-full" />
        ) : null}
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
            title="Aucun instrument"
            description="Créez un paiement chèque/traite pour enregistrer un instrument."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">Type</th>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Échéance</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-table-cell">{row.type}</td>
                    <td className="a-mono a-table-cell">{row.number}</td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {row.amount}
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {row.dueDate ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge
                        tone={
                          row.status === "CLEARED"
                            ? "success"
                            : row.status === "REJECTED"
                              ? "warning"
                              : "accent"
                        }
                      >
                        {INSTRUMENT_STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                    <td className="a-table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(NEXT[row.status] ?? []).map((s) => (
                          <AButton
                            key={s}
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void onTransition(row.id, s)}
                          >
                            {INSTRUMENT_STATUS_LABELS[s]}
                          </AButton>
                        ))}
                      </div>
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
