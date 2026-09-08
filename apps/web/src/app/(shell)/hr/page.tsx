"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  createContract,
  createEmployee,
  endContract,
  fetchEmployees,
  type HrEmployee,
} from "@/lib/hr";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: HrEmployee[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode = "employee" | "contract";

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

function statusTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "LEFT":
    case "ENDED":
      return "neutral";
    default:
      return "accent";
  }
}

export default function HrEmployeesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("employee");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HrEmployee | null>(null);

  const [matricule, setMatricule] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [cnssNo, setCnssNo] = useState("");
  const [hiredAt, setHiredAt] = useState("");
  const [contractType, setContractType] = useState("CDI");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [wageRef, setWageRef] = useState("");

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchEmployees(query);
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

  function openCreateEmployee() {
    setDrawerMode("employee");
    setFormError(null);
    setMatricule("");
    setDisplayName("");
    setDepartment("");
    setJobTitle("");
    setCnssNo("");
    setHiredAt("");
    setDrawerOpen(true);
  }

  function openCreateContract(row: HrEmployee) {
    setSelected(row);
    setDrawerMode("contract");
    setFormError(null);
    setContractType("CDI");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setWageRef("");
    setDrawerOpen(true);
  }

  async function onCreateEmployee() {
    setBusy(true);
    setFormError(null);
    const res = await createEmployee({
      matricule: matricule.trim(),
      displayName: displayName.trim(),
      department: department.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      cnssNo: cnssNo.trim() || undefined,
      hiredAt: hiredAt || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onCreateContract() {
    if (!selected) return;
    setBusy(true);
    setFormError(null);
    const res = await createContract({
      employeeId: selected.id,
      type: contractType,
      startDate,
      endDate: endDate || undefined,
      wageRef: wageRef.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setSelected(null);
    await load(q);
  }

  async function onEndContract(contractId: string) {
    setBusy(true);
    const res = await endContract(contractId);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  return (
    <div className="space-y-5">
      <AScreenHeader
        kicker="Ressources humaines"
        title="Employés"
        description="RH light — matricules et contrats. Pas de calcul CNSS / IRPP (paie séparée)."
        actions={
          <AButton type="button" onClick={openCreateEmployee}>
            Nouvel employé
          </AButton>
        }
      />

      <ExpertiseHintsStrip keys={["hr.cnss", "hr.irpp", "hr.tfp"]} />

      <div className="flex flex-wrap items-center gap-2">
        <AInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Matricule, nom, CNSS…"
          className="max-w-xs"
        />
        <AButton type="button" variant="ghost" onClick={() => void load(q)}>
          Filtrer
        </AButton>
      </div>

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
      {state.kind === "forbidden" ? (
        <AForbiddenState message={state.message} />
      ) : null}
      {state.kind === "error" ? (
        <AErrorState
          message={state.message}
          retryable
          onRetry={() => void load(q)}
        />
      ) : null}
      {state.kind === "ok" && state.items.length === 0 ? (
        <AEmptyState
          title="Aucun employé"
          description="Créez un employé pour démarrer le dossier RH."
          actionLabel="Nouvel employé"
          onAction={openCreateEmployee}
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--a-radius-lg)] border border-a-border-subtle">
          <table className="w-full min-w-[720px] text-left text-[length:var(--a-text-sm)]">
            <thead className="bg-a-surface-2 text-a-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Matricule</th>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Poste</th>
                <th className="px-4 py-3 font-medium">CNSS n°</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Contrats</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((row) => {
                const active = row.contracts.filter((c) => c.status === "ACTIVE");
                return (
                  <tr
                    key={row.id}
                    className="border-t border-a-border-subtle hover:bg-a-surface-2/60"
                  >
                    <td className="px-4 py-3">
                      <span className="a-mono font-medium">{row.matricule}</span>
                    </td>
                    <td className="px-4 py-3">{row.displayName}</td>
                    <td className="px-4 py-3 text-a-fg-muted">
                      {[row.jobTitle, row.department].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="a-mono px-4 py-3">{row.cnssNo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ABadge tone={statusTone(row.status)}>{row.status}</ABadge>
                    </td>
                    <td className="px-4 py-3">
                      {active.length === 0 ? (
                        <span className="text-a-fg-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {active.map((c) => (
                            <div key={c.id} className="flex items-center gap-2">
                              <span className="a-mono text-[length:var(--a-text-xs)]">
                                {c.number}
                              </span>
                              <ABadge tone="accent">{c.type}</ABadge>
                              <AButton
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void onEndContract(c.id)}
                              >
                                Clôturer
                              </AButton>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "ACTIVE" ? (
                        <AButton
                          type="button"
                          variant="ghost"
                          onClick={() => openCreateContract(row)}
                        >
                          Contrat
                        </AButton>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          drawerMode === "employee" ? "Nouvel employé" : "Nouveau contrat"
        }
      >
        <div className="space-y-4 p-1">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}

          {drawerMode === "employee" ? (
            <>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Matricule
                </span>
                <AInput
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="E-001"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Nom affiché
                </span>
                <AInput
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Département
                </span>
                <AInput
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Poste
                </span>
                <AInput
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  N° affiliation CNSS
                </span>
                <AInput
                  value={cnssNo}
                  onChange={(e) => setCnssNo(e.target.value)}
                  placeholder="Identifiant seulement — pas de taux"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Date d’embauche
                </span>
                <AInput
                  type="date"
                  value={hiredAt}
                  onChange={(e) => setHiredAt(e.target.value)}
                />
              </label>
              <AButton
                type="button"
                disabled={busy || !matricule.trim() || !displayName.trim()}
                onClick={() => void onCreateEmployee()}
              >
                Créer
              </AButton>
            </>
          ) : (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {selected?.displayName} ({selected?.matricule})
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Type
                </span>
                <select
                  className={selectClass}
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERIM">Intérim</option>
                  <option value="STAGE">Stage</option>
                  <option value="OTHER">Autre</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Début
                </span>
                <AInput
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Fin (optionnel)
                </span>
                <AInput
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Réf. salaire (libellé)
                </span>
                <AInput
                  value={wageRef}
                  onChange={(e) => setWageRef(e.target.value)}
                  placeholder="Pas de taux inventé"
                />
              </label>
              <AButton
                type="button"
                disabled={busy || !startDate}
                onClick={() => void onCreateContract()}
              >
                Créer le contrat
              </AButton>
            </>
          )}
        </div>
      </ADrawer>
    </div>
  );
}
