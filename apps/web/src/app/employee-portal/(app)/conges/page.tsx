"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AInput,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import {
  absenceStatusTone,
  type AttAbsence,
  type AttAbsenceType,
} from "@/lib/attendance";
import { AttendanceCalendarPanel } from "@/components/attendance/attendance-calendar-panel";
import {
  EMPLOYEE_PORTAL_API,
  portalAbsenceStatusLabel,
  portalAbsenceTypeLabel,
} from "@/lib/employee-portal";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ok";
      items: AttAbsence[];
      label: string;
      employeeId: string;
    }
  | { kind: "error"; message: string };

export default function EmployeePortalCongesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [type, setType] = useState<AttAbsenceType>("PAID");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [meRes, absRes] = await Promise.all([
        fetch(EMPLOYEE_PORTAL_API.me, {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch(EMPLOYEE_PORTAL_API.absences, {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      ]);
      if (!meRes.ok || !absRes.ok) {
        setState({
          kind: "error",
          message: "Impossible de charger vos congés.",
        });
        return;
      }
      const me = (await meRes.json()) as {
        employee: {
          employeeId: string;
          matricule: string;
          displayName: string;
        };
      };
      const items = (await absRes.json()) as AttAbsence[];
      setState({
        kind: "ok",
        items,
        label: `${me.employee.matricule} · ${me.employee.displayName}`,
        employeeId: me.employee.employeeId,
      });
    } catch {
      setState({ kind: "error", message: "API indisponible." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    if (!startDate || !endDate) {
      setFormError("Début et fin sont requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(EMPLOYEE_PORTAL_API.absences, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          startDate,
          endDate,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        setFormError(
          Array.isArray(body.message)
            ? body.message.join(", ")
            : body.message || "Création refusée",
        );
        setBusy(false);
        return;
      }
      setStartDate("");
      setEndDate("");
      setReason("");
      setBusy(false);
      void load();
    } catch {
      setBusy(false);
      setFormError("API indisponible.");
    }
  }

  async function onCancel(id: string) {
    setCancellingId(id);
    setFormError(null);
    try {
      const res = await fetch(
        `${EMPLOYEE_PORTAL_API.absences}/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        setFormError(
          Array.isArray(body.message)
            ? body.message.join(", ")
            : body.message || "Annulation refusée",
        );
        setCancellingId(null);
        return;
      }
      setCancellingId(null);
      void load();
    } catch {
      setCancellingId(null);
      setFormError("API indisponible.");
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Portail employé"
        title="Mes congés"
        description={
          state.kind === "ok"
            ? `${state.label} — demande / suivi seulement (pas de solde inventé)`
            : "Demandes d’absence"
        }
      />
      <APageBody>
        {formError ? (
          <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {formError}
          </p>
        ) : null}

        {state.kind === "ok" ? (
          <APageSection title="Calendrier" bare>
            <AttendanceCalendarPanel
              employeeId={state.employeeId}
              mode="portal"
            />
          </APageSection>
        ) : null}

        <APageSection
          title="Nouvelle demande"
          action={
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onCreate()}
            >
              Envoyer la demande
            </AButton>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[length:var(--a-text-sm)] font-medium">
                Type
              </span>
              <select
                className="w-full rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
                value={type}
                onChange={(e) => setType(e.target.value as AttAbsenceType)}
              >
                <option value="PAID">Congé payé</option>
                <option value="UNPAID">Absence non payée</option>
                <option value="OTHER">Autre</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[length:var(--a-text-sm)] font-medium">
                Motif
              </span>
              <AInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optionnel"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[length:var(--a-text-sm)] font-medium">
                Début
              </span>
              <AInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[length:var(--a-text-sm)] font-medium">
                Fin
              </span>
              <AInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
        </APageSection>

        {state.kind === "loading" ? <ASkeleton className="h-40 w-full" /> : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune demande"
            description="Vos absences apparaîtront ici après envoi."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <APageSection title="Historique" bare>
            <ASoftTable className="min-w-[640px]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">Type</th>
                  <th className="a-table-cell font-medium">Période</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Motif</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </ASoftThead>
              <tbody>
                {state.items.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-table-cell">
                      {portalAbsenceTypeLabel(row.type)}
                    </td>
                    <td className="a-mono a-tabular a-table-cell">
                      {row.startDate} → {row.endDate}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={absenceStatusTone(row.status)}>
                        {portalAbsenceStatusLabel(row.status)}
                      </ABadge>
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.reason ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      {row.status === "REQUESTED" ? (
                        <AButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={cancellingId === row.id}
                          onClick={() => void onCancel(row.id)}
                        >
                          Annuler
                        </AButton>
                      ) : (
                        <span className="text-a-fg-subtle">—</span>
                      )}
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
