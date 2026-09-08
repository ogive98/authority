"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  Camera,
  ChevronDown,
  ClipboardList,
  Layers,
  Play,
  RefreshCw,
  Shield,
  Square,
  Wrench,
} from "lucide-react";
import { ABadge, AButton, ADrawer, AKpiCard } from "@/components/a";
import { RepairHealthGauge } from "@/components/repair/repair-health-gauge";
import { RepairMissionRail } from "@/components/repair/repair-mission-rail";
import { RepairScanLevelCards } from "@/components/repair/repair-scan-level-cards";
import { RepairStepUpDialog } from "@/components/repair/repair-step-up-dialog";
import {
  RepairStepper,
  type RepairStepperPhase,
} from "@/components/repair/repair-stepper";
import {
  createRepairSnapshot,
  createRecoveryManifest,
  executeRepair,
  fetchRecoveryPolicies,
  fetchRepairAudit,
  fetchRepairBackups,
  fetchRepairDashboard,
  fetchRepairFindings,
  fetchRepairIncidents,
  fetchRepairMaintenance,
  fetchRepairReportingStatus,
  fetchResetScopes,
  flushRepairReporting,
  planRepair,
  previewReset,
  runRepairScan,
  verifyRepair,
  type RepairDashboard,
} from "@/lib/repair-api";
import {
  REPAIR_DOMAINS,
  SCAN_DEPTHS,
  repairHealthScore,
  repairRiskTone,
  severityTone,
  type RepairDomain,
  type RepairStageId,
  type ScanDepth,
} from "@/lib/repair-control";
import { cn } from "@/lib/utils";

type TabId =
  | "pipeline"
  | "diagnostics"
  | "repair"
  | "reset"
  | "snapshot"
  | "reporting"
  | "maintenance"
  | "audit";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "pipeline", label: "Pipeline" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "repair", label: "Réparation" },
  { id: "reset", label: "Reset" },
  { id: "snapshot", label: "Recovery" },
  { id: "reporting", label: "Reporting" },
  { id: "maintenance", label: "Maintenance" },
  { id: "audit", label: "Audit" },
];

type FindingRow = {
  id: string;
  component: string;
  severity: string;
  signatureId: string | null;
  evidenceSummary: string;
  risk: string;
  state: string;
};

type SeverityFilter = "ALL" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export function RepairWorkspace() {
  const [tab, setTab] = useState<TabId>("pipeline");
  const [depth, setDepth] = useState<ScanDepth>("L1");
  const [domains, setDomains] = useState<RepairDomain[]>(["L0", "L1"]);
  const [activeId, setActiveId] = useState<RepairStageId>("scan");
  const [reached, setReached] = useState<Set<RepairStageId>>(
    () => new Set(["scan"]),
  );
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<RepairDashboard | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [incidents, setIncidents] = useState<
    Array<{
      id: string;
      title: string;
      fingerprint: string;
      severity: string;
      count: number;
      status: string;
    }>
  >([]);
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);
  const [lastScenarioId, setLastScenarioId] = useState<string | null>(null);
  const [lastRisk, setLastRisk] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<FindingRow | null>(
    null,
  );
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [stepperPhase, setStepperPhase] = useState<RepairStepperPhase>("idle");
  const [stepperProgress, setStepperProgress] = useState(0);
  const [stepperLog, setStepperLog] = useState<string[]>([]);
  const [resetScopes, setResetScopes] = useState<
    Array<{ id: string; label: string; risk: string }>
  >([]);
  const [reporting, setReporting] = useState<{
    queued: number;
    sent: number;
    failed: number;
  } | null>(null);
  const [maintenance, setMaintenance] = useState<{
    status: string;
    notes: string[];
  } | null>(null);
  const [backups, setBackups] = useState<
    Array<{ id: string; ref: string; restorable?: boolean; note?: string }>
  >([]);
  const [recoveryPolicies, setRecoveryPolicies] = useState<
    Array<{
      id: string;
      title: string;
      status: "ALLOWED" | "DEFERRED" | "REJECTED";
      reason: string;
    }>
  >([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [scanOptionsOpen, setScanOptionsOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const healthScore = useMemo(
    () =>
      repairHealthScore({
        health: dashboard?.health,
        openFindings: dashboard?.openFindings ?? findings.length,
        openIncidents: dashboard?.openIncidents ?? incidents.length,
      }),
    [dashboard, findings.length, incidents.length],
  );

  const filteredFindings = useMemo(() => {
    if (severityFilter === "ALL") return findings;
    return findings.filter(
      (f) => f.severity.toUpperCase() === severityFilter,
    );
  }, [findings, severityFilter]);

  const pushLog = useCallback((line: string) => {
    setLog((prev) =>
      [`${new Date().toISOString().slice(11, 19)} ${line}`, ...prev].slice(
        0,
        40,
      ),
    );
  }, []);

  const refreshDashboard = useCallback(async () => {
    const res = await fetchRepairDashboard();
    if (res.status === 200 && res.data) setDashboard(res.data);
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    const [f, i] = await Promise.all([
      fetchRepairFindings(),
      fetchRepairIncidents(),
    ]);
    if (f.data?.items) setFindings(f.data.items as FindingRow[]);
    if (i.data?.items) setIncidents(i.data.items);
  }, []);

  useEffect(() => {
    void refreshDashboard();
    void refreshDiagnostics();
    if (
      typeof window !== "undefined" &&
      window.location.hash === "#diagnostics"
    ) {
      setTab("diagnostics");
    }
  }, [refreshDashboard, refreshDiagnostics]);

  function toggleDomain(id: RepairDomain) {
    setDomains((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== id);
      }
      return [...prev, id];
    });
  }

  async function onRunScan() {
    setBusy(true);
    setError(null);
    setRunning(true);
    setReached(new Set(["scan"]));
    setActiveId("scan");
    pushLog(`Scan ${depth} domains=${domains.join("+")}`);
    try {
      const res = await runRepairScan({ depth, domains });
      if (!res.data) {
        setError(res.message ?? "Scan failed");
        pushLog(`Scan error: ${res.message}`);
        return;
      }
      const stages: RepairStageId[] = [
        "scan",
        "finding",
        "signature",
        "recommend",
        "risk",
        "audit",
        "report",
      ];
      setReached(new Set(stages));
      setActiveId("finding");
      setFindings(
        res.data.findings.map((f) => ({
          id: f.id,
          component: f.component,
          severity: f.severity,
          signatureId: f.signatureId,
          evidenceSummary: f.evidenceSummary,
          risk: f.risk,
          state: "OPEN",
        })),
      );
      pushLog(
        `Scan ${res.data.scan.id} → ${res.data.scan.findingCount} finding(s)`,
      );
      await refreshDashboard();
      await refreshDiagnostics();
      setTab("diagnostics");
    } finally {
      setRunning(false);
      setBusy(false);
    }
  }

  async function onPlan(findingId: string) {
    setBusy(true);
    setError(null);
    setActiveId("plan");
    setReached((p) => new Set([...p, "plan", "approve"]));
    setStepperPhase("analysis");
    setStepperProgress(18);
    setStepperLog(["Analyse du finding…", "Matching signature / scénario…"]);
    try {
      const res = await planRepair({ findingId });
      if (!res.data) {
        setError(res.message ?? "Plan failed");
        return;
      }
      setLastPlanId(res.data.execution.id);
      setLastScenarioId(res.data.execution.scenarioId);
      setLastRisk(res.data.execution.risk);
      setStepperProgress(35);
      setStepperLog((prev) => [
        ...prev,
        `Plan prêt · ${res.data!.execution.scenarioId}`,
        `Risque ${res.data!.execution.risk}`,
      ]);
      pushLog(
        `Plan ${res.data.execution.id} scenario=${res.data.execution.scenarioId} risk=${res.data.execution.risk}`,
      );
      setSelectedFinding(null);
      setTab("repair");
    } finally {
      setBusy(false);
    }
  }

  async function onDryRun() {
    if (!lastPlanId) return;
    setBusy(true);
    setError(null);
    setActiveId("approve");
    setReached((p) => new Set([...p, "approve", "snapshot"]));
    setStepperPhase("backup");
    setStepperProgress(48);
    setStepperLog((prev) => [...prev, "Dry-run : simulation sans side-effect…"]);
    try {
      const res = await executeRepair({
        executionId: lastPlanId,
        confirm: true,
        dryRun: true,
      });
      if (!res.data) {
        setError(res.message ?? "Dry-run failed");
        pushLog(`Dry-run: ${res.message}`);
        return;
      }
      setStepperProgress(55);
      setStepperLog((prev) => [
        ...prev,
        `Dry-run ${res.data!.execution.status}`,
      ]);
      pushLog(
        `Dry-run ${res.data.execution.id} → ${res.data.execution.status}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onExecute() {
    if (!lastPlanId) return;
    setStepUpError(null);
    setStepUpOpen(true);
  }

  async function runLiveExecute(password: string) {
    if (!lastPlanId) return;
    setBusy(true);
    setStepUpError(null);
    setError(null);
    setActiveId("execute");
    setReached((p) => new Set([...p, "snapshot", "execute", "verify"]));
    setStepperPhase("repair");
    setStepperProgress(72);
    setStepperLog((prev) => [
      ...prev,
      "Re-auth OK · snapshot méta…",
      "Exécution allowlistée en cours…",
    ]);
    try {
      const res = await executeRepair({
        executionId: lastPlanId,
        confirm: true,
        password,
      });
      if (!res.data) {
        setStepUpError(res.message ?? "Execute blocked/failed");
        setError(res.message ?? "Execute blocked/failed");
        pushLog(`Execute: ${res.message}`);
        setStepperPhase("result");
        setStepperProgress(100);
        setStepperLog((prev) => [...prev, `Échec / refus : ${res.message}`]);
        return;
      }
      setStepUpOpen(false);
      setStepperPhase("verify");
      setStepperProgress(88);
      setStepperLog((prev) => [...prev, `Execute → ${res.data!.execution.status}`]);
      pushLog(
        `Execute ${res.data.execution.id} → ${res.data.execution.status}`,
      );
      const v = await verifyRepair({ executionId: lastPlanId });
      if (v.data) {
        setStepperProgress(100);
        setStepperPhase("result");
        setStepperLog((prev) => [...prev, "Vérification terminée"]);
        setReached((p) => new Set([...p, "audit", "report"]));
        setActiveId("report");
      }
      await refreshDashboard();
      await refreshDiagnostics();
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!lastPlanId) return;
    setBusy(true);
    setError(null);
    setActiveId("verify");
    setReached((p) => new Set([...p, "verify"]));
    setStepperPhase("verify");
    setStepperProgress(92);
    try {
      const res = await verifyRepair({ executionId: lastPlanId });
      if (!res.data) {
        setError(res.message ?? "Verify failed");
        return;
      }
      setStepperPhase("result");
      setStepperProgress(100);
      setStepperLog((prev) => [
        ...prev,
        res.data!.ok ? "Vérification OK — système stabilisé" : "Verify KO",
      ]);
      setReached((p) => new Set([...p, "audit", "report"]));
      pushLog(`Verify ${lastPlanId}: ${JSON.stringify(res.data.detail)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadTab(id: TabId) {
    setTab(id);
    if (id === "reset") {
      const r = await fetchResetScopes();
      if (r.data?.scopes) setResetScopes(r.data.scopes);
    }
    if (id === "reporting") {
      const r = await fetchRepairReportingStatus();
      if (r.data) setReporting(r.data);
    }
    if (id === "maintenance") {
      const r = await fetchRepairMaintenance();
      if (r.data) setMaintenance(r.data);
    }
    if (id === "snapshot") {
      const [b, p] = await Promise.all([
        fetchRepairBackups(),
        fetchRecoveryPolicies(),
      ]);
      if (b.data?.items) setBackups(b.data.items);
      if (p.data?.policies) setRecoveryPolicies(p.data.policies);
    }
    if (id === "audit") {
      const r = await fetchRepairAudit();
      if (r.data?.items) setAudit(r.data.items);
    }
    if (id === "diagnostics") await refreshDiagnostics();
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p
          className="rounded-[var(--a-radius-md)] border border-a-danger/30 bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Hero : jauge + KPIs + actions */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <RepairHealthGauge
          score={healthScore}
          findings={dashboard?.openFindings ?? findings.filter((f) => f.severity !== "INFO").length}
          label="Santé globale"
          sublabel={
            dashboard?.lastScanId
              ? `Dernier scan · ${dashboard.lastScanId.slice(0, 8)}…`
              : "Aucun scan encore — lance L1 pour démarrer"
          }
        />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AButton
              type="button"
              onClick={() => void onRunScan()}
              disabled={busy}
              className="gap-2"
            >
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Lancer scan
            </AButton>
            <AButton
              type="button"
              variant="outline"
              disabled
              title="Planification — bientôt"
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
              Planifier
            </AButton>
            <AButton
              type="button"
              variant="ghost"
              onClick={() => {
                void refreshDashboard();
                void refreshDiagnostics();
              }}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              Refresh
            </AButton>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AKpiCard
              label="Health"
              value={(dashboard?.health ?? "—").toUpperCase()}
              deltaTone={
                dashboard?.health === "ok"
                  ? "success"
                  : dashboard?.health === "degraded"
                    ? "warning"
                    : "neutral"
              }
            />
            <AKpiCard
              label="Findings ouverts"
              value={String(dashboard?.openFindings ?? findings.length)}
              delta={
                (dashboard?.openFindings ?? findings.length) > 0
                  ? "attention"
                  : undefined
              }
              deltaTone={
                (dashboard?.openFindings ?? findings.length) > 0
                  ? "danger"
                  : "success"
              }
            />
            <AKpiCard
              label="Incidents"
              value={String(dashboard?.openIncidents ?? incidents.length)}
              deltaTone={
                (dashboard?.openIncidents ?? incidents.length) > 0
                  ? "danger"
                  : "neutral"
              }
            />
            <AKpiCard
              label="Reports queue"
              value={String(dashboard?.reportingQueued ?? reporting?.queued ?? 0)}
            />
            <AKpiCard
              label="SAFE/LOW exécutables"
              value={
                dashboard?.coverage
                  ? `${dashboard.coverage.safeLowExecutable}/${dashboard.coverage.safeLowTotal}`
                  : "—"
              }
              delta={
                dashboard?.coverage?.completeAllowedSurface
                  ? "complet"
                  : undefined
              }
              deltaTone={
                dashboard?.coverage?.completeAllowedSurface
                  ? "success"
                  : "warning"
              }
            />
          </div>
          <div className="flex flex-wrap gap-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="repair-spark h-3.5 w-3.5 text-a-accent" strokeWidth={1.75} />
              {dashboard?.pendingRepairs ?? 0} réparation(s) en attente
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[color:var(--a-violet)]" strokeWidth={1.75} />
              {dashboard?.coverage?.executableCount ?? "—"} executors ·{" "}
              {dashboard?.coverage?.blockedCount ?? "—"} BLOCKED · SAFE/LOW only
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-a-border-subtle pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => void loadTab(t.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-[length:var(--a-text-sm)] transition-colors",
              tab === t.id
                ? "border-a-accent font-medium text-a-accent-hover"
                : "border-transparent text-a-fg-muted hover:text-a-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pipeline" ? (
        <div className="space-y-6">
          <RepairMissionRail
            activeStageId={activeId}
            reached={reached}
            running={running || busy}
            danger={healthScore < 60}
            onSelectPhase={setActiveId}
          />

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setScanOptionsOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-[var(--a-radius-md)] px-1 py-1 text-left text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              <span>
                Options de scan{" "}
                <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  {depth} · {domains.join("+")}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  scanOptionsOpen && "rotate-180",
                )}
                strokeWidth={1.75}
              />
            </button>
            {scanOptionsOpen ? (
              <div className="space-y-4 pl-1">
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Guide — L1 Quick suffit en routine. L3/L4 = forensics ; domaines
                  Data/Licence = surface élargie.
                </p>
                <div>
                  <p className="mb-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
                    Profondeur
                  </p>
                  <RepairScanLevelCards
                    levels={SCAN_DEPTHS}
                    selected={depth}
                    onSelect={setDepth}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
                    Domaines
                  </p>
                  <div className="flex flex-wrap gap-x-1 gap-y-1">
                    {REPAIR_DOMAINS.map((d) => {
                      const on = domains.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDomain(d.id)}
                          title={d.hint}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-[length:var(--a-text-sm)] transition-colors",
                            on
                              ? "bg-a-accent text-a-accent-fg"
                              : "bg-transparent text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                          )}
                        >
                          <span className="a-mono font-medium">{d.id}</span>{" "}
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "diagnostics" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              ["ALL", "INFO", "WARN", "ERROR", "CRITICAL"] as SeverityFilter[]
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[length:var(--a-text-xs)] font-medium",
                  severityFilter === s
                    ? "border-a-accent bg-a-accent-muted text-a-accent-hover"
                    : "border-a-border-subtle text-a-fg-muted",
                )}
              >
                {s === "ALL" ? "Tous" : s}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="a-card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-medium">
                <ClipboardList className="h-4 w-4 text-a-accent" strokeWidth={1.75} />
                Findings
              </h2>
              <ul className="space-y-2">
                {filteredFindings.length === 0 ? (
                  <li className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Aucun finding — lance un scan.
                  </li>
                ) : (
                  filteredFindings.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedFinding(f)}
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-[var(--a-radius-md)] border border-a-border-subtle px-3 py-2 text-left hover:border-a-accent/40 hover:bg-a-accent-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="text-[length:var(--a-text-sm)] font-medium">
                            {f.component}
                          </p>
                          <p className="a-mono truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                            {f.signatureId ?? "UNKNOWN"} · {f.evidenceSummary}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ABadge tone={severityTone(f.severity)}>
                            {f.severity}
                          </ABadge>
                          <ABadge
                            tone={repairRiskTone(
                              f.risk as
                                | "SAFE"
                                | "LOW"
                                | "MEDIUM"
                                | "HIGH"
                                | "BLOCKED"
                                | "NONE",
                            )}
                          >
                            {f.risk}
                          </ABadge>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <section className="a-card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-[color:var(--a-violet)]" strokeWidth={1.75} />
                Incidents
              </h2>
              <ul className="space-y-2">
                {incidents.length === 0 ? (
                  <li className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Aucun incident agrégé.
                  </li>
                ) : (
                  incidents.map((i) => (
                    <li
                      key={i.id}
                      className="rounded-[var(--a-radius-md)] border border-a-border-subtle px-3 py-2"
                    >
                      <p className="text-[length:var(--a-text-sm)] font-medium">
                        {i.title}
                      </p>
                      <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                        ×{i.count} · {i.fingerprint.slice(0, 12)}…
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "repair" ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-a-accent" strokeWidth={1.75} />
            <h2 className="font-medium">Centre de réparation</h2>
          </div>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            SAFE/LOW exécutables après confirm. HIGH/BLOCKED = dry-run / refus.
            Sensation de réparation guidée — dry-run → execute → verify.
          </p>
          <RepairStepper
            phase={stepperPhase}
            progress={stepperProgress}
            running={busy}
            scenarioId={lastScenarioId}
            risk={lastRisk}
            stepsLog={stepperLog}
          />
          <p className="a-mono text-[length:var(--a-text-sm)] text-a-fg-subtle">
            lastPlanId: {lastPlanId ?? "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              variant="outline"
              disabled={!lastPlanId || busy}
              onClick={() => void onDryRun()}
            >
              Dry-run
            </AButton>
            <AButton
              type="button"
              disabled={!lastPlanId || busy}
              onClick={() => void onExecute()}
              className="gap-2"
            >
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Execute (mot de passe)
            </AButton>
            <AButton
              type="button"
              variant="outline"
              disabled={!lastPlanId || busy}
              onClick={() => void onVerify()}
            >
              Verify
            </AButton>
          </div>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Rollback installable : BLOCKED jusqu’au Recovery SOC (artefact signé +
            backup DB). Pas de fake undo / GitHub.
          </p>
        </section>
      ) : null}

      {tab === "reset" ? (
        <section className="space-y-3">
          <h2 className="font-medium">Reset & maintenance scopes</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resetScopes.map((s) => {
              const blocked = s.risk === "BLOCKED" || s.risk === "HIGH";
              return (
                <article
                  key={s.id}
                  className={cn(
                    "a-card flex flex-col gap-3 p-4",
                    blocked && "border-a-danger/25",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{s.label}</h3>
                    <ABadge
                      tone={repairRiskTone(
                        s.risk as
                          | "SAFE"
                          | "HIGH"
                          | "BLOCKED"
                          | "MEDIUM"
                          | "LOW"
                          | "NONE",
                      )}
                    >
                      {s.risk}
                    </ABadge>
                  </div>
                  {blocked ? (
                    <p className="text-[length:var(--a-text-xs)] text-a-danger-fg">
                      Destructif / restreint — preview seulement
                    </p>
                  ) : (
                    <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Scope technique allowlisté
                    </p>
                  )}
                  <AButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const r = await previewReset({ scope: s.id });
                      pushLog(
                        `Reset preview ${s.id}: ${JSON.stringify(r.data)}`,
                      );
                    }}
                  >
                    Preview
                  </AButton>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "snapshot" ? (
        <div className="space-y-4">
          <section className="a-card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">Recovery (safe)</h2>
                <p className="mt-1 max-w-xl text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Manifeste métadonnée seulement. Pas de GitHub live, pas de
                  réécriture code, pas de restore installable tant que le backup
                  SOC n’existe pas.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={async () => {
                    const r = await createRecoveryManifest();
                    pushLog(
                      `Manifest ${r.data?.manifest.id ?? r.message} restorable=${r.data?.manifest.restorable}`,
                    );
                    const b = await fetchRepairBackups();
                    if (b.data?.items) setBackups(b.data.items);
                  }}
                >
                  <Camera className="h-4 w-4" strokeWidth={1.75} />
                  Manifeste versions
                </AButton>
                <AButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const r = await createRepairSnapshot();
                    pushLog(
                      `Meta ${r.data?.ref ?? r.message} · ${r.data?.note ?? ""}`,
                    );
                    const b = await fetchRepairBackups();
                    if (b.data?.items) setBackups(b.data.items);
                  }}
                >
                  Bookmark méta
                </AButton>
              </div>
            </div>
            <ul className="a-mono space-y-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
              {backups.length === 0 ? (
                <li>Aucun bookmark méta</li>
              ) : (
                backups.map((b) => (
                  <li key={b.id}>
                    {b.ref}
                    <span className="ml-2 text-a-danger-fg">
                      restorable={String(b.restorable ?? false)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="space-y-2">
            <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
              Politiques Recovery
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {recoveryPolicies.map((p) => (
                <article
                  key={p.id}
                  className={cn(
                    "rounded-[var(--a-radius-md)] px-3 py-3 ring-1",
                    p.status === "REJECTED" &&
                      "bg-a-danger-soft/40 ring-a-danger/25",
                    p.status === "DEFERRED" &&
                      "bg-a-warning-soft/30 ring-a-warning/20",
                    p.status === "ALLOWED" &&
                      "bg-a-accent-muted/40 ring-a-accent/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[length:var(--a-text-sm)] font-medium">
                      {p.title}
                    </h3>
                    <ABadge
                      tone={
                        p.status === "REJECTED"
                          ? "danger"
                          : p.status === "DEFERRED"
                            ? "warning"
                            : "success"
                      }
                    >
                      {p.status}
                    </ABadge>
                  </div>
                  <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {p.reason}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "reporting" ? (
        <section className="a-card space-y-3 p-4">
          <h2 className="mb-1 flex items-center gap-2 font-medium">
            <Layers className="h-4 w-4 text-a-accent" strokeWidth={1.75} />
            Central Reporting
          </h2>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Outbox locale — upload HTTP Control différé (D060)
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <AKpiCard label="Queued" value={String(reporting?.queued ?? "—")} />
            <AKpiCard label="Sent" value={String(reporting?.sent ?? "—")} />
            <AKpiCard
              label="Failed"
              value={String(reporting?.failed ?? "—")}
              deltaTone={
                (reporting?.failed ?? 0) > 0 ? "danger" : "neutral"
              }
            />
          </div>
          <AButton
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await flushRepairReporting();
              pushLog(`Flush reporting: ${r.data?.flushed ?? r.message}`);
              const s = await fetchRepairReportingStatus();
              if (s.data) setReporting(s.data);
            }}
          >
            Flush outbox local
          </AButton>
        </section>
      ) : null}

      {tab === "maintenance" ? (
        <section className="a-card space-y-2 p-4">
          <h2 className="font-medium">Maintenance</h2>
          <p className="a-mono text-[length:var(--a-text-sm)]">
            status: {maintenance?.status ?? "—"}
          </p>
          <ul className="list-disc pl-5 text-[length:var(--a-text-sm)] text-a-fg-muted">
            {(maintenance?.notes ?? []).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="a-card space-y-2 p-4">
          <h2 className="font-medium">Audit / exécutions récentes</h2>
          <pre className="a-mono max-h-80 overflow-auto rounded-[var(--a-radius-md)] bg-a-surface-1 p-3 text-[length:var(--a-text-xs)]">
            {JSON.stringify(audit, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          <Square className="h-3 w-3" strokeWidth={1.75} />
          Journal session
        </div>
        <ul className="a-mono max-h-32 space-y-0.5 overflow-auto text-[length:var(--a-text-xs)] text-a-fg-muted">
          {log.length === 0 ? <li>—</li> : log.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      <ADrawer
        open={Boolean(selectedFinding)}
        onOpenChange={(open) => {
          if (!open) setSelectedFinding(null);
        }}
        title={selectedFinding?.component ?? "Finding"}
        description={
          selectedFinding
            ? `${selectedFinding.severity} · ${selectedFinding.signatureId ?? "UNKNOWN"}`
            : undefined
        }
        footer={
          selectedFinding ? (
            <div className="flex justify-end gap-2">
              <AButton
                type="button"
                variant="outline"
                onClick={() => setSelectedFinding(null)}
              >
                Fermer
              </AButton>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onPlan(selectedFinding.id)}
                className="gap-2"
              >
                <Wrench className="h-4 w-4" strokeWidth={1.75} />
                Lancer la réparation
              </AButton>
            </div>
          ) : null
        }
      >
        {selectedFinding ? (
          <div className="space-y-4">
            <div className="rounded-[var(--a-radius-md)] border border-a-accent/30 bg-a-accent-muted p-4">
              <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-accent-hover">
                Action primaire
              </p>
              <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg">
                Planifier un scénario allowlisté puis dry-run → execute SAFE.
              </p>
            </div>
            <dl className="grid gap-3 text-[length:var(--a-text-sm)]">
              <div>
                <dt className="text-a-fg-subtle">Evidence</dt>
                <dd className="mt-0.5 text-a-fg">
                  {selectedFinding.evidenceSummary}
                </dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <ABadge tone={severityTone(selectedFinding.severity)}>
                  {selectedFinding.severity}
                </ABadge>
                <ABadge
                  tone={repairRiskTone(
                    selectedFinding.risk as
                      | "SAFE"
                      | "LOW"
                      | "MEDIUM"
                      | "HIGH"
                      | "BLOCKED"
                      | "NONE",
                  )}
                >
                  Risk {selectedFinding.risk}
                </ABadge>
                <ABadge tone="neutral">{selectedFinding.state}</ABadge>
              </div>
              <div>
                <dt className="text-a-fg-subtle">Signature</dt>
                <dd className="a-mono mt-0.5">
                  {selectedFinding.signatureId ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </ADrawer>

      <RepairStepUpDialog
        open={stepUpOpen}
        title="Exécuter la réparation"
        description={
          lastScenarioId
            ? `Scénario ${lastScenarioId}${lastRisk ? ` · risque ${lastRisk}` : ""} — SAFE/LOW only. Mot de passe session requis.`
            : "Mot de passe session requis pour un execute live."
        }
        busy={busy}
        error={stepUpError}
        onCancel={() => {
          setStepUpOpen(false);
          setStepUpError(null);
        }}
        onConfirm={(password) => void runLiveExecute(password)}
      />
    </div>
  );
}
