"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  PROMISE_STATUS_LABELS,
  cancelPromise,
  fetchPromises,
  promiseBadgeTone,
  type FinPromise,
  type PromiseStatus,
} from "@/lib/finance";
import {
  softChipClass,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinPromise[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FilterMode = "" | PromiseStatus;

const STATUS_FILTERS: Array<{ id: FilterMode; label: string }> = [
  { id: "", label: "Tous" },
  { id: "OPEN", label: "Ouvertes" },
  { id: "KEPT", label: "Tenues" },
  { id: "BROKEN", label: "Rompues" },
  { id: "CANCELLED", label: "Annulées" },
];

export default function FinancePromisesPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterMode>("");
  const [selected, setSelected] = useState<FinPromise | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query?: string, filter?: FilterMode) => {
    setState({ kind: "loading" });
    const res = await fetchPromises({
      q: query,
      status: filter || undefined,
    });
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
    void load("", "");
  }, [load]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void load(q, statusFilter);
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [q, statusFilter, load]);

  async function onCancel() {
    if (!selected || selected.status !== "OPEN") return;
    setBusy(true);
    setActionError(null);
    const res = await cancelPromise(selected.id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setSelected(null);
    void load(q, statusFilter);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Promesses de paiement"
        description="Engagements client sur créances AR — sans blocage automatique des ventes."
        more={
          <AOverflowMenu
            items={[
              {
                id: "receivables",
                label: "Créances",
                onSelect: () => router.push("/finance"),
              },
              {
                id: "banking",
                label: "Banque",
                onSelect: () => router.push("/finance/banking"),
              },
              {
                id: "payments",
                label: "Encaissements",
                onSelect: () => router.push("/finance/payments"),
              },
            ]}
          />
        }
      />

      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="ptp-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / note"
              aria-label="Recherche"
            />
          }
          filters={
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filtrer par statut"
            >
              {STATUS_FILTERS.map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(chip.id)}
                    className={softChipClass(active)}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          }
          utilities={
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load(q, statusFilter)}
            >
              Filtrer
            </AButton>
          }
        />

        {state.kind === "loading" ? <ASkeleton className="h-40" /> : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune promesse"
            description="Créez une promesse depuis une créance ouverte."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full min-w-[40rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-2 py-2 font-medium">N°</th>
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Créance</th>
                  <th className="px-2 py-2 font-medium text-right">Montant</th>
                  <th className="px-2 py-2 font-medium">Échéance</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr key={row.id} className={softTr}>
                    <td className="a-mono px-2 py-2">{row.number}</td>
                    <td className="px-2 py-2">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="a-mono px-2 py-2">
                      {row.openItemNumber ?? "—"}
                    </td>
                    <td className="a-mono px-2 py-2 text-right">
                      {row.amount} {row.currency}
                    </td>
                    <td className="a-mono px-2 py-2">{row.promisedDate}</td>
                    <td className="px-2 py-2">
                      <ABadge tone={promiseBadgeTone(row.status)}>
                        {PROMISE_STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <AButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setActionError(null);
                          setSelected(row);
                        }}
                      >
                        Détail
                      </AButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </APageBody>

      <ADrawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.number ?? "Promesse"}
        description="Engagement de paiement sur créance."
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="space-y-2 text-[length:var(--a-text-sm)]">
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">Client</dt>
                <dd>{selected.customerName ?? selected.customerCode ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">Créance</dt>
                <dd className="a-mono">{selected.openItemNumber ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">Montant</dt>
                <dd className="a-mono">
                  {selected.amount} {selected.currency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">Promis pour</dt>
                <dd className="a-mono">{selected.promisedDate}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">Statut</dt>
                <dd>
                  <ABadge tone={promiseBadgeTone(selected.status)}>
                    {PROMISE_STATUS_LABELS[selected.status]}
                  </ABadge>
                </dd>
              </div>
              {selected.notes ? (
                <div>
                  <dt className="mb-1 text-a-fg-muted">Note</dt>
                  <dd>{selected.notes}</dd>
                </div>
              ) : null}
            </dl>
            {actionError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger-fg">
                {actionError}
              </p>
            ) : null}
            {selected.status === "OPEN" ? (
              <AButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onCancel()}
              >
                Annuler la promesse
              </AButton>
            ) : null}
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
