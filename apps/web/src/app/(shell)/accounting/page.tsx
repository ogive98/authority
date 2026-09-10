"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  fetchAccounts,
  fetchPeriods,
  fetchTrialBalance,
  type AccAccount,
  type AccPeriod,
  type TrialBalanceRow,
} from "@/lib/accounting";
import {
  softPageBody,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";
import { cn } from "@/lib/utils";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ok";
      accounts: AccAccount[];
      periods: AccPeriod[];
      trial: TrialBalanceRow[];
      periodId: string;
    }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function AccountingPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async (periodId?: string) => {
    setState({ kind: "loading" });
    const [acc, per] = await Promise.all([fetchAccounts(), fetchPeriods()]);
    if (!acc.ok) {
      if (acc.status === 403) {
        setState({ kind: "forbidden", message: acc.message });
        return;
      }
      setState({ kind: "error", message: acc.message });
      return;
    }
    if (!per.ok) {
      setState({ kind: "error", message: per.message });
      return;
    }
    const selected =
      periodId ||
      per.data.items.find((p) => p.status === "OPEN")?.id ||
      per.data.items[0]?.id ||
      "";
    let trial: TrialBalanceRow[] = [];
    if (selected) {
      const tb = await fetchTrialBalance(selected);
      if (tb.ok) trial = tb.data.items;
    }
    setState({
      kind: "ok",
      accounts: acc.data.items,
      periods: per.data.items,
      trial,
      periodId: selected,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AScreenHeader
        kicker="Comptabilité"
        title="Grand livre V0"
        description="Plan comptable, périodes et balance — débit = crédit ; aucun taux TVA inventé."
      />
      <div className={softPageBody}>
        {state.kind === "loading" ? (
          <ASkeleton className="h-32 w-full" />
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
        {state.kind === "ok" ? (
          <>
            <section className="space-y-2">
              <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                Plan comptable
              </h2>
              {state.accounts.length === 0 ? (
                <AEmptyState
                  title="Aucun compte"
                  description="Les comptes seed (411 / 512 / 701) apparaissent après seed."
                />
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">Code</th>
                        <th className="a-table-cell font-medium">Nom</th>
                        <th className="a-table-cell font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.accounts.map((a) => (
                        <tr key={a.id} className={softTr}>
                          <td className="a-mono a-table-cell">{a.code}</td>
                          <td className="a-table-cell">{a.name}</td>
                          <td className="a-table-cell">
                            <ABadge tone="neutral">{a.type}</ABadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-end gap-3">
                <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  Balance de vérification
                </h2>
                <select
                  className={cn(softSelect, "w-auto")}
                  value={state.periodId}
                  onChange={(e) => void load(e.target.value)}
                >
                  {state.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
              {state.trial.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucune écriture POSTED pour cette période.
                </p>
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">Compte</th>
                        <th className="a-table-cell font-medium text-right">
                          Débit
                        </th>
                        <th className="a-table-cell font-medium text-right">
                          Crédit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.trial.map((r) => (
                        <tr key={r.accountId} className={softTr}>
                          <td className="a-table-cell">
                            <span className="a-mono">{r.accountCode}</span>{" "}
                            {r.accountName}
                          </td>
                          <td className="a-mono a-table-cell text-right tabular-nums">
                            {r.debit}
                          </td>
                          <td className="a-mono a-table-cell text-right tabular-nums">
                            {r.credit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
