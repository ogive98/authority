"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Layers,
  Play,
  Sparkles,
  Square,
} from "lucide-react";
import { ABadge } from "@/components/a/a-badge";
import { RepairWorkflowCanvas } from "@/components/super-admin/repair/repair-workflow-canvas";
import {
  MOCK_FINDINGS,
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

export function RepairControlWorkspace() {
  const [depth, setDepth] = useState<ScanDepth>("L1");
  const [domains, setDomains] = useState<RepairDomain[]>(["L0", "L1"]);
  const [activeId, setActiveId] = useState<RepairStageId>("scan");
  const [reached, setReached] = useState<Set<RepairStageId>>(
    () => new Set(["scan"]),
  );
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);

  const active = useMemo(
    () => REPAIR_PIPELINE.find((s) => s.id === activeId) ?? REPAIR_PIPELINE[0]!,
    [activeId],
  );

  useEffect(() => {
    if (!running) return;
    if (tick >= REPAIR_PIPELINE.length) {
      setRunning(false);
      return;
    }
    const stage = REPAIR_PIPELINE[tick]!;
    const t = window.setTimeout(() => {
      setActiveId(stage.id);
      setReached((prev) => new Set([...prev, stage.id]));
      setTick((n) => n + 1);
    }, 520);
    return () => window.clearTimeout(t);
  }, [running, tick]);

  function toggleDomain(id: RepairDomain) {
    setDomains((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== id);
      }
      return [...prev, id];
    });
  }

  function startSim() {
    setReached(new Set());
    setTick(0);
    setActiveId("scan");
    setRunning(true);
  }

  function stopSim() {
    setRunning(false);
  }

  return (
    <div className="repair-workspace space-y-5 p-[var(--a-space-6)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-[0.14em] text-a-violet">
            Thunder Control · Repair
          </p>
          <h1 className="mt-1 text-[length:var(--a-text-2xl)] font-medium tracking-tight text-a-fg">
            Diagnostic & Repair
          </h1>
          <p className="mt-1 max-w-xl text-[length:var(--a-text-sm)] text-a-fg-muted">
            Pipeline interactif V0 — simulation visuelle uniquement. Aucun
            apply moteur (dry-run API à venir).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startSim}
            disabled={running}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--a-radius-md)] px-3.5 py-2 text-[length:var(--a-text-sm)] font-medium",
              "bg-a-accent text-a-accent-fg hover:bg-a-accent-hover disabled:opacity-50",
            )}
          >
            <Play className="h-4 w-4" strokeWidth={1.75} />
            Simuler scan → report
          </button>
          <button
            type="button"
            onClick={stopSim}
            disabled={!running}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3.5 py-2 text-[length:var(--a-text-sm)]",
              "text-a-fg-muted hover:bg-a-surface-3 disabled:opacity-40",
            )}
          >
            <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
            Stop
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2/80 p-4 backdrop-blur-[var(--a-glass-blur)]">
          <div className="mb-3 flex items-center gap-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            <Activity className="h-3.5 w-3.5 text-a-accent" strokeWidth={1.75} />
            Profondeur de scan
          </div>
          <div className="flex flex-wrap gap-2">
            {SCAN_DEPTHS.map((d) => {
              const on = depth === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDepth(d.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-left text-[length:var(--a-text-sm)] transition-colors",
                    on
                      ? "border-a-accent bg-a-accent-muted text-a-accent-hover"
                      : "border-a-border-subtle bg-a-surface-1 text-a-fg-muted hover:border-a-border-strong",
                  )}
                >
                  <span className="a-mono font-medium">{d.id}</span>
                  <span className="ml-2">{d.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2/80 p-4 backdrop-blur-[var(--a-glass-blur)]">
          <div className="mb-3 flex items-center gap-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            <Layers className="h-3.5 w-3.5 text-a-violet" strokeWidth={1.75} />
            Domaines
          </div>
          <div className="flex flex-wrap gap-2">
            {REPAIR_DOMAINS.map((d) => {
              const on = domains.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDomain(d.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[length:var(--a-text-sm)] transition-colors",
                    on
                      ? "border-[color:var(--a-violet)] bg-a-violet-soft text-[color:var(--a-violet)]"
                      : "border-a-border-subtle bg-a-surface-1 text-a-fg-muted hover:border-a-border-strong",
                  )}
                  title={d.hint}
                >
                  <span className="a-mono font-medium">{d.id}</span>
                  <span className="ml-2">{d.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <RepairWorkflowCanvas
        activeId={activeId}
        reached={reached}
        running={running}
        onSelect={(id) => {
          setActiveId(id);
          setReached((prev) => new Set([...prev, id]));
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="repair-panel rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <ABadge tone={repairRiskTone(active.risk)}>
              {repairRiskLabel(active.risk)}
            </ABadge>
            <h2 className="text-[length:var(--a-text-lg)] font-medium">
              {active.label}
            </h2>
            <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
              {active.short} · {depth} · {domains.join("+")}
            </span>
          </div>
          <p className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
            {active.hint}
          </p>
          <p className="mt-3 max-w-2xl text-[length:var(--a-text-sm)] leading-relaxed text-a-fg">
            {active.detail}
          </p>

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
              Findings démo (mock)
            </div>
            <ul className="space-y-2">
              {MOCK_FINDINGS.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-1 px-3 py-2.5"
                >
                  <div>
                    <p className="text-[length:var(--a-text-sm)] font-medium">
                      {f.title}
                    </p>
                    <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {f.signature} → {f.scenario} · domain {f.domain}
                    </p>
                  </div>
                  <ABadge tone={repairRiskTone(f.risk)}>
                    {repairRiskLabel(f.risk)}
                  </ABadge>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-[linear-gradient(145deg,var(--a-accent-muted),var(--a-violet-soft))] p-4">
            <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
              Contrats V0
            </p>
            <ul className="mt-2 space-y-1.5 text-[length:var(--a-text-sm)] text-a-fg">
              <li>· Deterministic · no LLM</li>
              <li>· Executors allowlist only</li>
              <li>· No business mutation</li>
              <li>· Audit on every apply</li>
            </ul>
          </div>
          <div className="rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-4">
            <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
              Légende risque
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["SAFE", "LOW", "MEDIUM", "HIGH", "BLOCKED"] as const).map(
                (r) => (
                  <ABadge key={r} tone={repairRiskTone(r)}>
                    {r}
                  </ABadge>
                ),
              )}
            </div>
          </div>
          <p className="px-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Pack D077 · surface Control Console — pas AppShell ADV · pas
            Customer Portal.
          </p>
        </aside>
      </div>
    </div>
  );
}
