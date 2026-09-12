"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import {
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_BULLETINS_PATH,
  type PortalBulletin,
} from "@/lib/employee-portal";

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
    <>
      <AScreenHeader
        kicker="Portail employé"
        title="Mes bulletins"
        description="Consultation et reçu PDF — montants figés à l’édition RH (aucune invention)."
      />
      <APageBody>
        {state.kind === "loading" ? (
          <div className="space-y-3">
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
          <APageSection title="Bulletins publiés" bare>
            <ASoftTable>
              <ASoftThead>
                <tr>
                  <th className="px-4 py-3 font-medium">Période</th>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium text-right">Net</th>
                  <th className="px-4 py-3 font-medium">PDF</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </ASoftThead>
              <tbody>
                {state.items.map((b) => (
                  <ASoftTr key={b.id}>
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
