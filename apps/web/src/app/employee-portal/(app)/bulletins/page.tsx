"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_BULLETINS_PATH,
  type PortalBulletin,
} from "@/lib/employee-portal";
import {
  softPageBody,
  softPanel,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: PortalBulletin[] }
  | { kind: "error"; message: string };

function formatTnd(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("fr-TN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function EmployeePortalBulletinsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(EMPLOYEE_PORTAL_API.bulletins, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            res.status === 403
              ? "Module RH indisponible pour votre société."
              : "Impossible de charger vos bulletins.",
        });
        return;
      }
      const body = (await res.json()) as { items: PortalBulletin[] };
      setState({ kind: "ok", items: body.items });
    } catch {
      setState({ kind: "error", message: "Réseau indisponible." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={softPageBody}>
      <AScreenHeader
        kicker="Portail employé"
        title="Mes bulletins"
        description="Consultation et reçu PDF — montants figés à l’édition RH (aucune invention)."
      />

      {state.kind === "loading" ? (
        <div className={`${softPanel} space-y-3 p-5`}>
          <ASkeleton className="h-8 w-48" />
          <ASkeleton className="h-24 w-full" />
        </div>
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
          title="Aucun bulletin"
          description="Vos bulletins apparaîtront ici une fois édités par les RH."
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <div className={`${softPanel} overflow-hidden`}>
          <div className={softTableWrap}>
            <table className="w-full text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-4 py-3 font-medium">Période</th>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium text-right">Net</th>
                  <th className="px-4 py-3 font-medium">PDF</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {state.items.map((b) => (
                  <tr key={b.id} className={softTr}>
                    <td className="a-mono px-4 py-3">{b.periodYm}</td>
                    <td className="a-mono px-4 py-3 text-a-fg-muted">
                      {b.number}
                    </td>
                    <td className="a-mono px-4 py-3 text-right tabular-nums">
                      {formatTnd(b.netPay)}{" "}
                      <span className="text-a-fg-muted">{b.currency}</span>
                    </td>
                    <td className="px-4 py-3">
                      {b.pdfDocumentId ? (
                        <ABadge tone="success">Disponible</ABadge>
                      ) : (
                        <ABadge tone="neutral">À générer</ABadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${EMPLOYEE_PORTAL_BULLETINS_PATH}/${b.id}`}
                        className="text-[length:var(--a-text-sm)] font-medium text-a-accent hover:underline"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
