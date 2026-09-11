"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  createBulletin,
  createCnssSnapshot,
  createContract,
  createEmployee,
  createIrppSnapshot,
  endContract,
  fetchBulletinPreview,
  fetchBulletins,
  fetchCnssPreview,
  fetchEmployees,
  fetchIrppPreview,
  type Bulletin,
  type BulletinPreview,
  type CnssPreview,
  type HrContract,
  type HrEmployee,
  type IrppPreview,
} from "@/lib/hr";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  softPageBody,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: HrEmployee[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode = "employee" | "contract" | "cnss" | "irpp" | "bulletin";

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
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
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
  const [wageBase, setWageBase] = useState("");
  const [cnssContract, setCnssContract] = useState<HrContract | null>(null);
  const [cnssPreview, setCnssPreview] = useState<CnssPreview | null>(null);
  const [irppPreview, setIrppPreview] = useState<IrppPreview | null>(null);
  const [bulletinPreview, setBulletinPreview] =
    useState<BulletinPreview | null>(null);
  const [periodYm, setPeriodYm] = useState(
    new Date().toISOString().slice(0, 7),
  );

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const [res, bul] = await Promise.all([
      fetchEmployees(query),
      fetchBulletins({ limit: 30 }),
    ]);
    if (bul.ok) setBulletins(bul.data.items);
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
    setWageBase("");
    setDrawerOpen(true);
  }

  async function openCnss(contract: HrContract) {
    setDrawerMode("cnss");
    setCnssContract(contract);
    setCnssPreview(null);
    setIrppPreview(null);
    setBulletinPreview(null);
    setFormError(null);
    const ym = new Date().toISOString().slice(0, 7);
    setPeriodYm(ym);
    setDrawerOpen(true);
    setBusy(true);
    const res = await fetchCnssPreview(contract.id, ym);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCnssPreview(res.data);
  }

  async function openIrpp(contract: HrContract) {
    setDrawerMode("irpp");
    setCnssContract(contract);
    setCnssPreview(null);
    setIrppPreview(null);
    setBulletinPreview(null);
    setFormError(null);
    const ym = new Date().toISOString().slice(0, 7);
    setPeriodYm(ym);
    setDrawerOpen(true);
    setBusy(true);
    const res = await fetchIrppPreview(contract.id, ym);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setIrppPreview(res.data);
  }

  async function openBulletin(contract: HrContract) {
    setDrawerMode("bulletin");
    setCnssContract(contract);
    setCnssPreview(null);
    setIrppPreview(null);
    setBulletinPreview(null);
    setFormError(null);
    const ym = new Date().toISOString().slice(0, 7);
    setPeriodYm(ym);
    setDrawerOpen(true);
    setBusy(true);
    const res = await fetchBulletinPreview(contract.id, ym);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setBulletinPreview(res.data);
  }

  async function refreshCnssPreview() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await fetchCnssPreview(cnssContract.id, periodYm);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCnssPreview(res.data);
  }

  async function refreshIrppPreview() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await fetchIrppPreview(cnssContract.id, periodYm);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setIrppPreview(res.data);
  }

  async function refreshBulletinPreview() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await fetchBulletinPreview(cnssContract.id, periodYm);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setBulletinPreview(res.data);
  }

  async function onSnapshot() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await createCnssSnapshot({
      contractId: cnssContract.id,
      periodYm,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onIrppSnapshot() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await createIrppSnapshot({
      contractId: cnssContract.id,
      periodYm,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onCreateBulletin() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await createBulletin({
      contractId: cnssContract.id,
      periodYm,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
    router.push(`/hr/bulletins/${res.data.id}`);
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
      wageBase: wageBase.trim() ? Number(wageBase) : undefined,
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
    <>
      <AScreenHeader
        kicker="Ressources humaines"
        title="Employés"
        description="RH — wageBase, CNSS, IRPP, bulletin + impression Soft Glass. Aucun taux inventé."
        actions={
          <AButton type="button" onClick={openCreateEmployee}>
            Nouvel employé
          </AButton>
        }
      />

      <div className={softPageBody}>
      <ExpertiseHintsStrip
        keys={[
          "hr.cnss.employee",
          "hr.cnss.employer",
          "hr.cnss.ceiling",
          "hr.irpp",
          "hr.tfp",
        ]}
      />

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
        <div className={softTableWrap}>
          <table className="w-full min-w-[720px] text-left text-[length:var(--a-text-sm)]">
            <thead className={softThead}>
              <tr>
                <th className="a-table-cell font-medium">Matricule</th>
                <th className="a-table-cell font-medium">Nom</th>
                <th className="a-table-cell font-medium">Poste</th>
                <th className="a-table-cell font-medium">CNSS n°</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Contrats</th>
                <th className="a-table-cell font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((row) => {
                const active = row.contracts.filter((c) => c.status === "ACTIVE");
                return (
                  <tr key={row.id} className={softTr}>
                    <td className="a-table-cell">
                      <span className="a-mono font-medium">{row.matricule}</span>
                    </td>
                    <td className="a-table-cell">{row.displayName}</td>
                    <td className="a-table-cell text-a-fg-muted">
                      {[row.jobTitle, row.department].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="a-mono a-table-cell">{row.cnssNo ?? "—"}</td>
                    <td className="a-table-cell">
                      <ABadge tone={statusTone(row.status)}>{row.status}</ABadge>
                    </td>
                    <td className="a-table-cell">
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
                                onClick={() => void openCnss(c)}
                              >
                                CNSS
                              </AButton>
                              <AButton
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void openIrpp(c)}
                              >
                                IRPP
                              </AButton>
                              <AButton
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void openBulletin(c)}
                              >
                                Bulletin
                              </AButton>
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
                    <td className="a-table-cell">
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

      {bulletins.length > 0 ? (
        <section className="mt-8 space-y-3">
          <h2
            id="bulletins"
            className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f97316]"
          >
            Bulletins récents
          </h2>
          <div className={softTableWrap}>
            <table className="w-full min-w-[640px] text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Période</th>
                  <th className="a-table-cell font-medium">Employé</th>
                  <th className="a-table-cell font-medium">Net</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bulletins.map((b) => (
                  <tr key={b.id} className={softTr}>
                    <td className="a-mono a-table-cell">{b.number}</td>
                    <td className="a-mono a-table-cell">{b.periodYm}</td>
                    <td className="a-table-cell">
                      {b.matricule ? `${b.matricule} · ` : ""}
                      {b.employeeName ?? "—"}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {b.netPay} {b.currency}
                    </td>
                    <td className="a-table-cell">
                      <Link
                        href={`/hr/bulletins/${b.id}`}
                        className="text-[length:var(--a-text-sm)] font-medium text-a-accent hover:underline"
                      >
                        Imprimer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          drawerMode === "employee"
            ? "Nouvel employé"
            : drawerMode === "contract"
              ? "Nouveau contrat"
              : drawerMode === "irpp"
                ? "IRPP — preview"
                : drawerMode === "bulletin"
                  ? "Bulletin — preview"
                  : "CNSS — preview"
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
          ) : null}

          {drawerMode === "contract" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {selected?.displayName} ({selected?.matricule})
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Type
                </span>
                <select
                  className={softSelect}
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
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Base CNSS TND (saisie humaine)
                </span>
                <AInput
                  value={wageBase}
                  onChange={(e) => setWageBase(e.target.value)}
                  placeholder="ex. 1200.000"
                  className="a-mono"
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
          ) : null}

          {drawerMode === "cnss" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Contrat {cnssContract?.number} · base{" "}
                <span className="a-mono">
                  {cnssContract?.wageBase ?? "—"}
                </span>{" "}
                TND
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période (YYYY-MM)
                </span>
                <AInput
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void refreshCnssPreview()}
              >
                Recalculer
              </AButton>
              {cnssPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p>
                    Assiette{" "}
                    <span className="a-mono tabular-nums">
                      {cnssPreview.assiette.toFixed(3)}
                    </span>
                    {cnssPreview.ceilingApplied ? " · plafond appliqué" : ""}
                  </p>
                  <p>
                    Salarié{" "}
                    <span className="a-mono tabular-nums">
                      {cnssPreview.employeeAmount != null
                        ? cnssPreview.employeeAmount.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  <p>
                    Employeur{" "}
                    <span className="a-mono tabular-nums">
                      {cnssPreview.employerAmount != null
                        ? cnssPreview.employerAmount.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  {!cnssPreview.ready ? (
                    <p className="text-a-warning">
                      Expertise requise : {cnssPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !cnssPreview?.ready}
                onClick={() => void onSnapshot()}
              >
                Enregistrer snapshot
              </AButton>
            </>
          ) : null}

          {drawerMode === "irpp" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Assiette = wageBase − CNSS salarié · barème annuel / 12. Aucun
                seuil inventé.
              </p>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Contrat {cnssContract?.number} · base{" "}
                <span className="a-mono">
                  {cnssContract?.wageBase ?? "—"}
                </span>{" "}
                TND
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période (YYYY-MM)
                </span>
                <AInput
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void refreshIrppPreview()}
              >
                Recalculer
              </AButton>
              {irppPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p>
                    CNSS salarié{" "}
                    <span className="a-mono tabular-nums">
                      {irppPreview.cnssEmployeeAmount != null
                        ? irppPreview.cnssEmployeeAmount.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  <p>
                    Imposable mensuel{" "}
                    <span className="a-mono tabular-nums">
                      {irppPreview.taxableMonthly != null
                        ? irppPreview.taxableMonthly.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  <p>
                    Imposable annuel{" "}
                    <span className="a-mono tabular-nums">
                      {irppPreview.annualTaxable != null
                        ? irppPreview.annualTaxable.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  <p>
                    IRPP annuel{" "}
                    <span className="a-mono tabular-nums">
                      {irppPreview.annualIrpp != null
                        ? irppPreview.annualIrpp.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  <p>
                    IRPP mensuel{" "}
                    <span className="a-mono tabular-nums">
                      {irppPreview.monthlyIrpp != null
                        ? irppPreview.monthlyIrpp.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  {!irppPreview.ready ? (
                    <p className="text-a-warning">
                      Expertise requise : {irppPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !irppPreview?.ready}
                onClick={() => void onIrppSnapshot()}
              >
                Enregistrer snapshot
              </AButton>
            </>
          ) : null}

          {drawerMode === "bulletin" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Compose CNSS + IRPP snapshots pour la période. Net = wageBase −
                CNSS salarié − IRPP mensuel. Pas de PDF V0.
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période (YYYY-MM)
                </span>
                <AInput
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void refreshBulletinPreview()}
              >
                Recalculer
              </AButton>
              {bulletinPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p>
                    {bulletinPreview.matricule} · {bulletinPreview.employeeName}
                  </p>
                  <p>
                    Base{" "}
                    <span className="a-mono tabular-nums">
                      {bulletinPreview.wageBase?.toFixed(3) ?? "—"}
                    </span>
                  </p>
                  <p>
                    CNSS salarié{" "}
                    <span className="a-mono tabular-nums">
                      {bulletinPreview.cnssEmployeeAmount?.toFixed(3) ?? "—"}
                    </span>
                  </p>
                  <p>
                    CNSS employeur{" "}
                    <span className="a-mono tabular-nums">
                      {bulletinPreview.cnssEmployerAmount?.toFixed(3) ?? "—"}
                    </span>
                  </p>
                  <p>
                    IRPP mensuel{" "}
                    <span className="a-mono tabular-nums">
                      {bulletinPreview.irppMonthly?.toFixed(3) ?? "—"}
                    </span>
                  </p>
                  <p>
                    Net{" "}
                    <span className="a-mono tabular-nums font-medium">
                      {bulletinPreview.netPay?.toFixed(3) ?? "—"}
                    </span>{" "}
                    {bulletinPreview.currency}
                  </p>
                  {!bulletinPreview.ready ? (
                    <p className="text-a-warning">
                      Snapshots requis : {bulletinPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !bulletinPreview?.ready}
                onClick={() => void onCreateBulletin()}
              >
                Enregistrer & imprimer
              </AButton>
            </>
          ) : null}
        </div>
      </ADrawer>
    </>
  );
}
