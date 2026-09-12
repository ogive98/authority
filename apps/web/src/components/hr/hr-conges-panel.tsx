"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  APageSection,
  ASkeleton,
} from "@/components/a";
import {
  absenceStatusTone,
  approveAbsence,
  cancelAbsence,
  createAbsence,
  fetchAbsences,
  rejectAbsence,
  type AttAbsence,
  type AttAbsenceStatus,
  type AttAbsenceType,
} from "@/lib/attendance";
import { fetchEmployees, type HrEmployee } from "@/lib/hr";
import {
  softGhostBtn,
  softPanel,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: AttAbsence[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

/** Soft Glass Congés panel — request/approve only, no quotas (D218). */
export function HrCongesPanel() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [filter, setFilter] = useState<AttAbsenceStatus | "">("");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<AttAbsenceType>("PAID");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const [abs, emp] = await Promise.all([
      fetchAbsences(filter ? { status: filter } : undefined),
      fetchEmployees(undefined, "ACTIVE"),
    ]);
    if (emp.ok) setEmployees(emp.data.items);
    if (!abs.ok) {
      if (abs.status === 403) {
        setState({ kind: "forbidden", message: abs.message });
        return;
      }
      setState({ kind: "error", message: abs.message });
      return;
    }
    setState({ kind: "ok", items: abs.data });
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormError(null);
    setEmployeeId(employees[0]?.id ?? "");
    setType("PAID");
    setStartDate("");
    setEndDate("");
    setReason("");
    setDrawerOpen(true);
  }

  async function onCreate() {
    if (!employeeId || !startDate || !endDate) {
      setFormError("Employé, début et fin sont requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createAbsence({
      employeeId,
      type,
      startDate,
      endDate,
      reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    void load();
  }

  async function onDecide(id: string, action: "approve" | "reject" | "cancel") {
    setBusy(true);
    const res =
      action === "approve"
        ? await approveAbsence(id)
        : action === "reject"
          ? await rejectAbsence(id)
          : await cancelAbsence(id);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    void load();
  }

  return (
    <APageSection
      bare
      title="Congés"
      description={
        <>
          Demandes d’absence PAID / UNPAID / OTHER — approbation seulement. Aucun
          solde ni quota tunisien inventé. Portail salarié :{" "}
          <a
            href="/employee-portal/login"
            className="a-mono text-a-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            /employee-portal
          </a>
        </>
      }
    >
      {formError ? (
        <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
          {formError}
        </p>
      ) : null}

      <AFilterBar
        filters={
          <select
            className="rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-1.5 text-[length:var(--a-text-sm)] text-a-fg"
            value={filter}
            onChange={(e) =>
              setFilter((e.target.value || "") as AttAbsenceStatus | "")
            }
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            <option value="REQUESTED">REQUESTED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        }
        utilities={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle absence
          </AButton>
        }
      />

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
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
          title="Aucune absence"
          description="Créez une demande ici ou via le portail salarié (employé lié Identity)."
          actionLabel="Nouvelle absence"
          onAction={openCreate}
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <div className={softTableWrap}>
          <table className="w-full min-w-[720px] text-left text-[length:var(--a-text-sm)]">
            <thead className={softThead}>
              <tr>
                <th className="a-table-cell font-medium">Employé</th>
                <th className="a-table-cell font-medium">Type</th>
                <th className="a-table-cell font-medium">Période</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Motif</th>
                <th className="a-table-cell font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((row) => (
                <tr key={row.id} className={softTr}>
                  <td className="a-table-cell">
                    {row.employeeMatricule
                      ? `${row.employeeMatricule} · `
                      : ""}
                    {row.employeeDisplayName ?? "—"}
                  </td>
                  <td className="a-mono a-table-cell">{row.type}</td>
                  <td className="a-mono a-table-cell tabular-nums">
                    {row.startDate} → {row.endDate}
                  </td>
                  <td className="a-table-cell">
                    <ABadge tone={absenceStatusTone(row.status)}>
                      {row.status}
                    </ABadge>
                  </td>
                  <td className="a-table-cell text-a-fg-muted">
                    {row.reason ?? "—"}
                  </td>
                  <td className="a-table-cell">
                    {row.status === "REQUESTED" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-[length:var(--a-text-sm)] font-medium text-a-accent hover:underline disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void onDecide(row.id, "approve")}
                        >
                          Approuver
                        </button>
                        <button
                          type="button"
                          className="text-[length:var(--a-text-sm)] font-medium text-a-danger-fg hover:underline disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void onDecide(row.id, "reject")}
                        >
                          Refuser
                        </button>
                        <button
                          type="button"
                          className={`${softGhostBtn} disabled:opacity-50`}
                          disabled={busy}
                          onClick={() => void onDecide(row.id, "cancel")}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <span className="text-a-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle absence"
        description="Demande REQUESTED — pas de calcul de solde."
      >
        <div className={`${softPanel} space-y-3`}>
          <label className="block space-y-1.5">
            <span className="text-[length:var(--a-text-sm)] font-medium">
              Employé
            </span>
            <select
              className="w-full rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.matricule} · {e.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[length:var(--a-text-sm)] font-medium">
              Type
            </span>
            <select
              className="w-full rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
              value={type}
              onChange={(e) => setType(e.target.value as AttAbsenceType)}
            >
              <option value="PAID">PAID</option>
              <option value="UNPAID">UNPAID</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[length:var(--a-text-sm)] font-medium">
              Début
            </span>
            <AInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
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
              required
            />
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
          <div className="flex justify-end gap-2 pt-2">
            <AButton
              type="button"
              variant="ghost"
              onClick={() => setDrawerOpen(false)}
            >
              Fermer
            </AButton>
            <AButton type="button" disabled={busy} onClick={() => void onCreate()}>
              Créer
            </AButton>
          </div>
        </div>
      </ADrawer>
    </APageSection>
  );
}
