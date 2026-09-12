"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AEmptyState,
  AErrorState,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_BULLETINS_PATH,
  EMPLOYEE_PORTAL_CONGES_PATH,
  EMPLOYEE_PORTAL_DOCUMENTS_PATH,
  EMPLOYEE_PORTAL_PROFIL_PATH,
  type PortalDashboard,
} from "@/lib/employee-portal";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: PortalDashboard; label: string }
  | { kind: "error"; message: string };

function formatTnd(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("fr-TN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function KpiTile({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="a-underlay a-action-quiet block space-y-1 rounded-[var(--a-radius-md)] px-4 py-3 transition-colors hover:bg-a-surface-3/60"
    >
      <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wide text-a-fg-muted">
        {label}
      </p>
      <p className="a-mono text-[length:var(--a-text-xl)] tabular-nums text-a-fg">
        {value}
      </p>
      {hint ? (
        <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">{hint}</p>
      ) : null}
    </Link>
  );
}

export default function EmployeePortalHomePage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [meRes, dashRes] = await Promise.all([
        fetch(EMPLOYEE_PORTAL_API.me, {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch(EMPLOYEE_PORTAL_API.dashboard, {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      ]);
      if (!meRes.ok || !dashRes.ok) {
        setState({
          kind: "error",
          message: "Impossible de charger l’accueil.",
        });
        return;
      }
      const me = (await meRes.json()) as {
        employee: { matricule: string; displayName: string };
      };
      const data = (await dashRes.json()) as PortalDashboard;
      setState({
        kind: "ok",
        data,
        label: `${me.employee.matricule} · ${me.employee.displayName}`,
      });
    } catch {
      setState({ kind: "error", message: "API indisponible." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AScreenHeader
        kicker="Portail employé"
        title="Accueil"
        description={
          state.kind === "ok"
            ? `${state.label} — self-service (pas de solde inventé)`
            : "Tableau de bord personnel"
        }
      />
      <APageBody>
        {state.kind === "loading" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ASkeleton className="h-24 w-full" />
            <ASkeleton className="h-24 w-full" />
            <ASkeleton className="h-24 w-full" />
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
        {state.kind === "ok" ? (
          <>
            <APageSection title="Aperçu" bare>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiTile
                  href={EMPLOYEE_PORTAL_CONGES_PATH}
                  label="Demandes en attente"
                  value={String(state.data.pendingAbsences)}
                  hint="Congés REQUESTED"
                />
                <KpiTile
                  href={EMPLOYEE_PORTAL_CONGES_PATH}
                  label="Absences approuvées"
                  value={String(state.data.approvedAbsences)}
                />
                <KpiTile
                  href={EMPLOYEE_PORTAL_DOCUMENTS_PATH}
                  label="Documents dossier"
                  value={String(state.data.documentCount)}
                />
                <KpiTile
                  href={
                    state.data.lastBulletin
                      ? `${EMPLOYEE_PORTAL_BULLETINS_PATH}/${state.data.lastBulletin.id}`
                      : EMPLOYEE_PORTAL_BULLETINS_PATH
                  }
                  label="Dernier bulletin"
                  value={
                    state.data.lastBulletin
                      ? `${formatTnd(state.data.lastBulletin.netPay)} ${state.data.lastBulletin.currency}`
                      : "—"
                  }
                  hint={
                    state.data.lastBulletin
                      ? `${state.data.lastBulletin.number} · ${state.data.lastBulletin.periodYm}`
                      : "Aucun bulletin"
                  }
                />
              </div>
            </APageSection>

            <APageSection title="Raccourcis">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={EMPLOYEE_PORTAL_CONGES_PATH}
                  className="a-action-primary inline-flex items-center rounded-[var(--a-radius-sm)] px-3 py-2 text-[length:var(--a-text-sm)] font-medium"
                >
                  Demander un congé
                </Link>
                <Link
                  href={EMPLOYEE_PORTAL_BULLETINS_PATH}
                  className="a-action-quiet inline-flex items-center rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)] font-medium"
                >
                  Mes bulletins
                </Link>
                <Link
                  href={EMPLOYEE_PORTAL_DOCUMENTS_PATH}
                  className="a-action-quiet inline-flex items-center rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)] font-medium"
                >
                  Mes documents
                </Link>
                <Link
                  href={EMPLOYEE_PORTAL_PROFIL_PATH}
                  className="a-action-quiet inline-flex items-center rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)] font-medium"
                >
                  Mon profil
                </Link>
              </div>
            </APageSection>

            {!state.data.lastBulletin && state.data.documentCount === 0 ? (
              <AEmptyState
                title="Bienvenue"
                description="Utilisez Congés pour une demande, Bulletins pour vos reçus PDF, Documents pour le dossier RH."
              />
            ) : null}
          </>
        ) : null}
      </APageBody>
    </>
  );
}
