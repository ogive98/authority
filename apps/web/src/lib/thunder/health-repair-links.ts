import type { HealthItem, HealthState } from "@/lib/dashboard-engine";
import type { RepairDomain, ScanDepth } from "@/lib/repair-control";

/** Map Thunder Health check → Repair domain (L0…L5). */
export const THUNDER_HEALTH_REPAIR_DOMAIN: Record<string, RepairDomain> = {
  core: "L0",
  api: "L0",
  postgres: "L0",
  redis: "L0",
  workers: "L0",
  scheduler: "L0",
  cpu: "L0",
  ram: "L0",
  queues: "L1",
  "event-bus": "L1",
  outbox: "L1",
  breakers: "L1",
};

const UNHEALTHY: HealthState[] = [
  "DEGRADED",
  "WARNING",
  "CRITICAL",
  "OFFLINE",
];

export type ThunderRepairIntent =
  | "open"
  | "scan"
  | "diagnostics"
  | "critical"
  | "serious";

export type ThunderRepairLinkOpts = {
  intent?: ThunderRepairIntent;
  domains?: RepairDomain[];
  depth?: ScanDepth;
  /** Health check id (workers, outbox, …) for focus copy on Repair. */
  focus?: string;
  tab?: "pipeline" | "diagnostics";
};

export function domainsFromHealthItems(items: HealthItem[]): RepairDomain[] {
  const set = new Set<RepairDomain>();
  for (const item of items) {
    if (!UNHEALTHY.includes(item.state)) continue;
    const d = THUNDER_HEALTH_REPAIR_DOMAIN[item.id];
    if (d) set.add(d);
  }
  if (set.size === 0) {
    set.add("L0");
    set.add("L1");
  }
  return [...set];
}

export function buildThunderRepairHref(opts: ThunderRepairLinkOpts): string {
  const q = new URLSearchParams();
  const intent = opts.intent ?? "open";
  if (intent !== "open") q.set("intent", intent);
  if (opts.tab) q.set("tab", opts.tab);
  if (opts.domains?.length) q.set("domains", opts.domains.join(","));
  if (opts.depth) q.set("depth", opts.depth);
  if (opts.focus) q.set("focus", opts.focus);
  const qs = q.toString();
  if (opts.tab === "diagnostics" || intent === "diagnostics" || intent === "critical") {
    return qs ? `/repair?${qs}#diagnostics` : "/repair#diagnostics";
  }
  return qs ? `/repair?${qs}` : "/repair";
}
