"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AButton,
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
  downloadPortalDocument,
  EMPLOYEE_PORTAL_API,
  type PortalDocument,
} from "@/lib/employee-portal";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: PortalDocument[] }
  | { kind: "error"; message: string };

export default function EmployeePortalDocumentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(EMPLOYEE_PORTAL_API.documents, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            res.status === 403
              ? "Module RH indisponible pour votre société."
              : "Impossible de charger vos documents.",
        });
        return;
      }
      const body = (await res.json()) as { items: PortalDocument[] };
      setState({ kind: "ok", items: body.items });
    } catch {
      setState({ kind: "error", message: "Réseau indisponible." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDownload(id: string) {
    setBusyId(id);
    setActionError(null);
    const result = await downloadPortalDocument(id);
    if (!result.ok) setActionError(result.message);
    setBusyId(null);
  }

  return (
    <>
      <AScreenHeader
        kicker="Portail employé"
        title="Mes documents"
        description="Dossier RH lié à votre fiche — téléchargement own only."
      />
      <APageBody>
        {actionError ? (
          <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {actionError}
          </p>
        ) : null}
        {state.kind === "loading" ? (
          <ASkeleton className="h-40 w-full" />
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
            title="Aucun document"
            description="Les pièces déposées par RH apparaîtront ici."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <APageSection title="Dossier" bare>
            <ASoftTable className="min-w-[560px]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Titre</th>
                  <th className="a-table-cell font-medium">Type</th>
                  <th className="a-table-cell font-medium">Date</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </ASoftThead>
              <tbody>
                {state.items.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-mono a-table-cell">{row.number}</td>
                    <td className="a-table-cell">{row.title}</td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.kindName ?? row.kindCode ?? "—"}
                    </td>
                    <td className="a-mono a-tabular a-table-cell">
                      {row.createdAt.slice(0, 10)}
                    </td>
                    <td className="a-table-cell">
                      <AButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => void onDownload(row.id)}
                      >
                        Télécharger
                      </AButton>
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
