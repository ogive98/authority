"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Camera,
  ClipboardList,
  Layers,
  Play,
  RefreshCw,
  Shield,
  Square,
  Wrench,
} from "lucide-react";
import { ABadge } from "@/components/a/a-badge";
import { RepairWorkflowCanvas } from "@/components/super-admin/repair/repair-workflow-canvas";
import {
  createRepairSnapshot,
  executeRepair,
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
  rollbackRepair,
  runRepairScan,
  verifyRepair,
  type RepairDashboard,
} from "@/lib/repair-api";
import {
  REPAIR_DOMAINS,
  REPAIR_PIPELINE,
  SCAN_DEPTHS,
  repairRiskLabel,
  repairRiskTone,
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
  { id: "repair", label: "Repair" },
  { id: "reset", label: "Reset" },
  { id: "snapshot", label: "Snapshot" },
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

export function RepairControlWorkspace() {
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
  const [backups, setBackups] = useState<Array<{ id: string; ref: string }>>(
    [],
  );
  const [audit, setAudit] = useState<unknown[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const active = useMemo(
    () => REPAIR_PIPELINE.find((s) => s.id === activeId) ?? REPAIR_PIPELINE[0]!,
    [activeId],
  );

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toISOString().slice(11, 19)} ${line}`, ...prev].slice(0, 40));
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
    try {
      const res = await planRepair({ findingId });
      if (!res.data) {
        setError(res.message ?? "Plan failed");
        return;
      }
      setLastPlanId(res.data.execution.id);
      pushLog(
        `Plan ${res.data.execution.id} scenario=${res.data.execution.scenarioId} risk=${res.data.execution.risk}`,
      );
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
      pushLog(
        `Dry-run ${res.data.execution.id} → ${res.data.execution.status}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onExecute() {
    if (!lastPlanId) return;
    setBusy(true);
    setError(null);
    setActiveId("execute");
    setReached((p) => new Set([...p, "snapshot", "execute", "verify"]));
    try {
      const res = await executeRepair({
        executionId: lastPlanId,
        confirm: true,
      });
      if (!res.data) {
        setError(res.message ?? "Execute blocked/failed");
        pushLog(`Execute: ${res.message}`);
        return;
      }
      pushLog(`Execute ${res.data.execution.id} → ${res.data.execution.status}`);
      await refreshDashboard();
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
    try {
      const res = await verifyRepair({ executionId: lastPlanId });
      if (!res.data) {
        setError(res.message ?? "Verify failed");
        return;
      }
      pushLog(`Verify ${lastPlanId}: ${JSON.stringify(res.data.detail)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRollback() {
    if (!lastPlanId) return;
    setBusy(true);
    setError(null);
    setActiveId("rollback");
    setReached((p) => new Set([...p, "rollback", "audit"]));
    try {
      const res = await rollbackRepair({ executionId: lastPlanId });
      if (!res.data) {
        setError(res.message ?? "Rollback failed");
        return;
      }
      pushLog(`Rollback ${res.data.id} → ${res.data.status}`);
      await refreshDashboard();
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
      const r = await fetchRepairBackups();
      if (r.data?.items) setBackups(r.data.items);
    }
    if (id === "audit") {
      const r = await fetchRepairAudit();
      if (r.data?.items) setAudit(r.data.items);
    }
    if (id === "diagnostics") await refreshDiagnostics();
  }

  return (
    <div className="repair-workspace space-y-5 p-[var(--a-space-6)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-[0.14em] text-a-accent">
            Module Repair · Thunder Control
          </p>
          <h1 className="mt-1 text-[length:var(--a-text-2xl)] font-medium tracking-tight text-a-fg">
            Scan & Repair AUTHORITY
          </h1>
          <p className="mt-1 max-w-2xl text-[length:var(--a-text-sm)] text-a-fg-muted">
            Module ops complet : scan → signature → plan → approval → execute
            allowlist → verify → audit → report. Aucune mutation métier.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onRunScan()}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--a-radius-md)] px-3.5 py-2 text-[length:var(--a-text-sm)] font-medium",
              "bg-a-accent text-a-accent-fg hover:bg-a-accent-hover disabled:opacity-50",
            )}
          >
            <Play className="h-4 w-4" strokeWidth={1.75} />
            Lancer scan
          </button>
          <button
            type="button"
            onClick={() => void refreshDashboard()}
            className="inline-flex items-center gap-2 rounded-[var(--a-radius-md)] a-underlay bg-a-surface-2 px-3.5 py-2 text-[length:var(--a-text-sm)] text-a-fg-muted hover:bg-a-surface-3"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Health",
            value: dashboard?.health ?? "—",
            icon: Activity,
          },
          {
            label: "Findings ouverts",
            value: String(dashboard?.openFindings ?? findings.length),
            icon: ClipboardList,
          },
          {
            label: "Incidents",
            value: String(dashboard?.openIncidents ?? incidents.length),
            icon: Shield,
          },
          {
            label: "Reports queue",
            value: String(dashboard?.reportingQueued ?? "—"),
            icon: Layers,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="a-card rounded-[var(--a-radius-md)] bg-a-surface-2 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
              <k.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {k.label}
            </div>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium a-tabular">
              {k.value}
            </p>
          </div>
        ))}
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
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <section className="rounded-[var(--a-radius-lg)] a-underlay bg-a-surface-2/80 p-4">
              <p className="mb-3 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
                Profondeur scan
              </p>
              <div className="flex flex-wrap gap-2">
                {SCAN_DEPTHS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDepth(d.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[length:var(--a-text-sm)] transition-colors",
                      depth === d.id
                        ? "bg-a-accent text-white"
                        : "bg-a-surface-3 text-a-fg-muted hover:bg-a-surface-4 hover:text-a-fg",
                    )}
                  >
                    <span className="a-mono font-medium">{d.id}</span> {d.label}
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-[var(--a-radius-lg)] a-underlay bg-a-surface-2/80 p-4">
              <p className="mb-3 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
                Domaines
              </p>
              <div className="flex flex-wrap gap-2">
                {REPAIR_DOMAINS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDomain(d.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[length:var(--a-text-sm)] transition-colors",
                      domains.includes(d.id)
                        ? "bg-a-accent-muted text-a-accent"
                        : "bg-a-surface-3 text-a-fg-muted hover:bg-a-surface-4 hover:text-a-fg",
                    )}
                  >
                    <span className="a-mono font-medium">{d.id}</span> {d.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <RepairWorkflowCanvas
            activeId={activeId}
            reached={reached}
            running={running}
            onSelect={setActiveId}
          />

          <section className="repair-panel rounded-[var(--a-radius-lg)] a-underlay bg-a-surface-2 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <ABadge tone={repairRiskTone(active.risk)}>
                {repairRiskLabel(active.risk)}
              </ABadge>
              <h2 className="text-[length:var(--a-text-lg)] font-medium">
                {active.label}
              </h2>
            </div>
            <p className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
              {active.hint}
            </p>
            <p className="mt-3 max-w-3xl text-[length:var(--a-text-sm)] leading-relaxed">
              {active.detail}
            </p>
          </section>
        </div>
      ) : null}

      {tab === "diagnostics" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="a-underlay rounded-md p-4">
            <h2 className="mb-3 font-medium">Findings</h2>
            <ul className="space-y-2">
              {findings.length === 0 ? (
                <li className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun finding — lance un scan.
                </li>
              ) : (
                findings.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--a-radius-md)] a-underlay px-3 py-2"
                  >
                    <div>
                      <p className="text-[length:var(--a-text-sm)] font-medium">
                        {f.component}
                      </p>
                      <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                        {f.signatureId ?? "UNKNOWN"} · {f.evidenceSummary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ABadge
                        tone={repairRiskTone(
                          f.risk as "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKED" | "NONE",
                        )}
                      >
                        {f.risk}
                      </ABadge>
                      <button
                        type="button"
                        className="text-[length:var(--a-text-xs)] text-a-accent hover:underline"
                        onClick={() => void onPlan(f.id)}
                      >
                        Plan
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="a-underlay rounded-md p-4">
            <h2 className="mb-3 font-medium">Incidents</h2>
            <ul className="space-y-2">
              {incidents.length === 0 ? (
                <li className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun incident agrégé.
                </li>
              ) : (
                incidents.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-[var(--a-radius-md)] a-underlay px-3 py-2"
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
      ) : null}

      {tab === "repair" ? (
        <section className="a-underlay rounded-md space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-a-accent" strokeWidth={1.75} />
            <h2 className="font-medium">Repair Engine</h2>
          </div>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            SAFE/LOW exécutables après confirm. HIGH/BLOCKED = dry-run / refus.
          </p>
          <p className="a-mono text-[length:var(--a-text-sm)]">
            lastPlanId: {lastPlanId ?? "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!lastPlanId || busy}
              onClick={() => void onDryRun()}
              className="inline-flex items-center gap-2 rounded-[var(--a-radius-md)] a-underlay bg-a-surface-1 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg-muted disabled:opacity-50"
            >
              Dry-run
            </button>
            <button
              type="button"
              disabled={!lastPlanId || busy}
              onClick={() => void onExecute()}
              className="inline-flex items-center gap-2 rounded-[var(--a-radius-md)] bg-a-accent px-3 py-2 text-[length:var(--a-text-sm)] font-medium text-a-accent-fg disabled:opacity-50"
            >
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Execute (confirm)
            </button>
            <button
              type="button"
              disabled={!lastPlanId || busy}
              onClick={() => void onVerify()}
              className="inline-flex items-center gap-2 rounded-[var(--a-radius-md)] a-underlay px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg-muted disabled:opacity-50"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={!lastPlanId || busy}
              onClick={() => void onRollback()}
              className="inline-flex items-center gap-2 rounded-md bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg disabled:opacity-50"
            >
              Rollback
            </button>
          </div>
        </section>
      ) : null}

      {tab === "reset" ? (
        <section className="a-underlay rounded-md space-y-3 p-4">
          <h2 className="font-medium">Reset Engine</h2>
          <ul className="space-y-2">
            {resetScopes.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 border-b border-a-border-subtle py-2"
              >
                <span className="text-[length:var(--a-text-sm)]">
                  {s.label}{" "}
                  <ABadge
                    tone={repairRiskTone(
                      s.risk as "SAFE" | "HIGH" | "BLOCKED" | "MEDIUM" | "LOW" | "NONE",
                    )}
                  >
                    {s.risk}
                  </ABadge>
                </span>
                <button
                  type="button"
                  className="text-[length:var(--a-text-xs)] text-a-accent hover:underline"
                  onClick={async () => {
                    const r = await previewReset({ scope: s.id });
                    pushLog(`Reset preview ${s.id}: ${JSON.stringify(r.data)}`);
                  }}
                >
                  Preview
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "snapshot" ? (
        <section className="a-underlay rounded-md space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Snapshot / Backup</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[length:var(--a-text-sm)] text-a-accent"
              onClick={async () => {
                const r = await createRepairSnapshot();
                pushLog(`Snapshot ${r.data?.ref ?? r.message}`);
                const b = await fetchRepairBackups();
                if (b.data?.items) setBackups(b.data.items);
              }}
            >
              <Camera className="h-4 w-4" strokeWidth={1.75} />
              Créer snapshot
            </button>
          </div>
          <ul className="a-mono space-y-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            {backups.map((b) => (
              <li key={b.id}>{b.ref}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "reporting" ? (
        <section className="a-underlay rounded-md space-y-3 p-4">
          <h2 className="font-medium">Central Reporting</h2>
          <dl className="a-mono grid gap-1 text-[length:var(--a-text-sm)]">
            <div className="flex justify-between">
              <dt>queued</dt>
              <dd>{reporting?.queued ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>sent</dt>
              <dd>{reporting?.sent ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>failed</dt>
              <dd>{reporting?.failed ?? "—"}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
            onClick={async () => {
              const r = await flushRepairReporting();
              pushLog(`Flush reporting: ${r.data?.flushed ?? r.message}`);
              const s = await fetchRepairReportingStatus();
              if (s.data) setReporting(s.data);
            }}
          >
            Flush outbox (local — pas d’upload central encore)
          </button>
        </section>
      ) : null}

      {tab === "maintenance" ? (
        <section className="a-underlay rounded-md space-y-2 p-4">
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
        <section className="a-underlay rounded-md space-y-2 p-4">
          <h2 className="font-medium">Audit / exécutions récentes</h2>
          <pre className="a-mono max-h-80 overflow-auto rounded-[var(--a-radius-md)] bg-a-surface-1 p-3 text-[length:var(--a-text-xs)]">
            {JSON.stringify(audit, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-[var(--a-radius-lg)] a-underlay bg-a-surface-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          <Square className="h-3 w-3" strokeWidth={1.75} />
          Journal session
        </div>
        <ul className="a-mono max-h-32 space-y-0.5 overflow-auto text-[length:var(--a-text-xs)] text-a-fg-muted">
          {log.length === 0 ? <li>—</li> : log.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </div>
  );
}
