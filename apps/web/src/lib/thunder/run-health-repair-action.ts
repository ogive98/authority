import {
  executeRepair,
  fetchRepairFindings,
  fetchRepairIncidents,
  planRepair,
  runRepairScan,
} from "@/lib/repair-api";
import type { HealthItem } from "@/lib/dashboard-engine";
import type { RepairDomain, ScanDepth } from "@/lib/repair-control";
import { useRepairSessionStore } from "@/stores/repair-session-store";
import {
  domainsFromHealthItems,
  THUNDER_HEALTH_REPAIR_DOMAIN,
  type ThunderRepairIntent,
} from "@/lib/thunder/health-repair-links";

export type ThunderHealthRepairAction =
  | Exclude<ThunderRepairIntent, "open">
  | "focus"
  | "refresh";

function log(text: string) {
  useRepairSessionStore.getState().push(text, "thunder");
}

function setAction(
  intent: string,
  status: "running" | "ok" | "error",
  detail?: string,
) {
  useRepairSessionStore.getState().setLastAction({
    intent,
    status,
    detail,
    at: new Date().toISOString(),
  });
}

function domainsFor(
  items: HealthItem[],
  focus: HealthItem | null,
): RepairDomain[] {
  if (focus) {
    return [THUNDER_HEALTH_REPAIR_DOMAIN[focus.id] ?? "L0"];
  }
  return domainsFromHealthItems(items);
}

async function scanAndLog(opts: {
  depth: ScanDepth;
  domains: RepairDomain[];
  label: string;
}) {
  log(`${opts.label} · scan ${opts.depth} · ${opts.domains.join("+")}`);
  const res = await runRepairScan({
    depth: opts.depth,
    domains: opts.domains,
  });
  if (!res.data) {
    log(`Scan erreur: ${res.message ?? "échec"}`);
    return null;
  }
  log(
    `Scan ${res.data.scan.id.slice(0, 8)}… → ${res.data.scan.findingCount} finding(s)`,
  );
  return res.data;
}

/**
 * Actions Repair exécutées depuis Thunder Health (reste sur `/thunder`).
 * Le journal est partagé avec le module `/repair` via repair-session-store.
 */
export async function runThunderHealthRepairAction(opts: {
  action: ThunderHealthRepairAction;
  items: HealthItem[];
  focus: HealthItem | null;
  onRefresh?: () => void;
}): Promise<void> {
  const { action, items, focus, onRefresh } = opts;

  if (action === "refresh") {
    onRefresh?.();
    log("Snapshot Thunder rafraîchi");
    setAction("refresh", "ok", "Snapshot");
    return;
  }

  const domains = domainsFor(items, focus);
  setAction(action, "running");

  try {
    if (action === "diagnostics") {
      const [f, i] = await Promise.all([
        fetchRepairFindings(),
        fetchRepairIncidents(),
      ]);
      const fc = f.data?.items?.length ?? 0;
      const ic = i.data?.items?.length ?? 0;
      const crit =
        f.data?.items?.filter((x) =>
          ["CRITICAL", "ERROR"].includes(x.severity.toUpperCase()),
        ).length ?? 0;
      log(
        `Diagnostics · ${fc} finding(s) · ${ic} incident(s) · ${crit} critique(s)`,
      );
      if (focus) {
        const hit =
          f.data?.items?.filter((x) =>
            x.component.toLowerCase().includes(focus.id.replace(/-/g, "")),
          ) ?? [];
        log(
          hit.length
            ? `Focus « ${focus.label} » · ${hit.length} finding(s) liés`
            : `Focus « ${focus.label} » · aucun finding lié (domains ${domains.join("+")})`,
        );
      }
      setAction("diagnostics", "ok", `${fc} findings · ${ic} incidents`);
      onRefresh?.();
      return;
    }

    if (action === "scan" || action === "critical" || action === "focus") {
      const depth: ScanDepth = "L1";
      const label =
        action === "scan"
          ? "Scanner"
          : action === "focus" && focus
            ? `Dépanner ${focus.label}`
            : "Dépanner alertes";
      const data = await scanAndLog({ depth, domains, label });
      if (!data) {
        setAction(action, "error", "Scan échoué");
        return;
      }
      const open = data.findings.filter((f) =>
        ["CRITICAL", "ERROR", "WARN"].includes(f.severity.toUpperCase()),
      );
      setAction(
        action,
        "ok",
        `${data.scan.findingCount} finding(s) · ${open.length} à traiter`,
      );
      onRefresh?.();
      return;
    }

    if (action === "serious") {
      const data = await scanAndLog({
        depth: "L2",
        domains: domains.length ? domains : ["L0", "L1"],
        label: "Réparer sérieusement (Deep)",
      });
      if (!data) {
        setAction("serious", "error", "Scan Deep échoué");
        return;
      }

      const candidate =
        data.findings.find((f) => f.severity.toUpperCase() === "CRITICAL") ??
        data.findings.find((f) => f.severity.toUpperCase() === "ERROR") ??
        data.findings.find((f) => f.signatureId);

      if (!candidate) {
        log("Aucun finding actionnable — fin Deep");
        setAction("serious", "ok", "Rien à réparer");
        onRefresh?.();
        return;
      }

      log(
        `Plan · finding ${candidate.id.slice(0, 8)}… · ${candidate.severity} · ${candidate.component}`,
      );
      const plan = await planRepair({ findingId: candidate.id });
      if (!plan.data) {
        log(`Plan erreur: ${plan.message ?? "échec"}`);
        setAction("serious", "error", plan.message ?? "Plan échoué");
        return;
      }

      const risk = plan.data.execution.risk.toUpperCase();
      log(
        `Plan ${plan.data.execution.id.slice(0, 8)}… · scénario ${plan.data.execution.scenarioId} · risk ${risk}`,
      );

      if (risk === "SAFE" || risk === "LOW") {
        const dry = await executeRepair({
          executionId: plan.data.execution.id,
          confirm: true,
          dryRun: true,
        });
        if (!dry.data) {
          log(`Dry-run erreur: ${dry.message ?? "échec"}`);
          setAction("serious", "error", dry.message ?? "Dry-run échoué");
          return;
        }
        log(
          `Dry-run OK · ${dry.data.execution.status} — exécution live = step-up dans module Repair`,
        );
        setAction(
          "serious",
          "ok",
          `Plan ${risk} prêt · dry-run OK`,
        );
      } else {
        log(
          `Risk ${risk} — pas d’auto-exécution (SAFE/LOW only). Continuer dans Repair.`,
        );
        setAction("serious", "ok", `Plan ${risk} — human gate`);
      }
      onRefresh?.();
      return;
    }

    setAction(action, "error", "Action inconnue");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    log(`Erreur: ${msg}`);
    setAction(action, "error", msg);
  }
}
